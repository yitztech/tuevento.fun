import { createHash, createPublicKey, createPrivateKey, hkdfSync } from "node:crypto";
import { Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { accountArea, isLocale, localePrefix, localesOfSite, siteLocale, type AccountType, type Locale, type McpScope } from "@tuevento/contracts";
import { Database } from "../database";
import { localeEnv } from "../locale-env";
import { requestLocale } from "../request-locale";
import { oauthAdapter } from "./mcp.oauth-adapter";
import type { McpAuthContext } from "./mcp.types";

/** Rutas del servidor OAuth; el consentimiento (`/interaction/`) lo atiende `McpConsentController`. */
export const OAUTH_PATH = "/api/mcp/oauth";
const isConsentRoute = (path: string) => path.startsWith(`${OAUTH_PATH}/interaction/`);
export const isOAuthRoute = (path: string) =>
  (path === OAUTH_PATH || path.startsWith(`${OAUTH_PATH}/`)) && !isConsentRoute(path);

/** Solo lectura: es lo único que se concede por OAuth, lo pida quien lo pida. */
const GRANTED_SCOPE = "mcp:read";
const ACCESS_TOKEN_TTL = 3600;
const REFRESH_TOKEN_TTL = 30 * 24 * 3600;
/**
 * Clientes admitidos por CIMD (§28: no se sigue ninguna URL sin lista blanca). ChatGPT usa
 * `/oauth/client.json` con los servidores que anuncian `iss`, y `/oauth/<id>/client.json` con el resto.
 */
const CLIENT_METADATA = /^https:\/\/chatgpt\.com\/oauth\/(?:[A-Za-z0-9_-]+\/)?client\.json$/;
export const clientMetadataAllowed = (clientId: string) => CLIENT_METADATA.test(clientId);

/**
 * Idioma del consentimiento: el primero de `ui_locales` (OIDC, admite `pt-BR`) que aloje este dominio;
 * si no, el de la cuenta con sesión; si no, el del dominio. Un dominio no aloja los idiomas del otro.
 */
export function consentLocale(domain: Locale, uiLocales: unknown, accountLocale?: string | null): Locale {
  const hosted = localesOfSite(domain);
  const requested = typeof uiLocales === "string" ? uiLocales.split(/\s+/).map((tag) => tag.split("-")[0].toLowerCase()) : [];
  const match = [...requested, accountLocale].find(
    (tag): tag is Locale => typeof tag === "string" && isLocale(tag) && hosted.includes(tag),
  );
  return match ?? domain;
}

/** Solo pruebas: cliente fijo, escrituras y `POST /api/mcp/tokens`. Nunca en compose.prod.yml. */
export const mcpTestMode = () => process.env.MCP_TEST_MODE === "true";
const TEST_CLIENT = {
  client_id: "tuevento-pruebas",
  client_name: "Cliente de pruebas",
  application_type: "native",
  token_endpoint_auth_method: "none",
  redirect_uris: ["http://127.0.0.1/callback"],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
};

const derive = (purpose: string) =>
  Buffer.from(hkdfSync("sha256", process.env.APP_SECRET as string, "", `tuevento:mcp-oauth:${purpose}`, 32));

const ed25519 = (seed: Buffer) =>
  createPrivateKey({
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]),
    format: "der",
    type: "pkcs8",
  });

/** Clave Ed25519 estable por entorno. Los tokens son opacos: solo firma lo que publica el emisor. */
function signingKey() {
  const key = ed25519(derive("signing-key"));
  return { ...key.export({ format: "jwk" }), ...createPublicKey(key).export({ format: "jwk" }), use: "sig" };
}

/** Igual que ChatGPT, se autentica con `private_key_jwt`. La semilla es pública: solo vale en pruebas. */
const testJwtClient = () => ({
  ...TEST_CLIENT,
  client_id: "tuevento-pruebas-jwt",
  token_endpoint_auth_method: "private_key_jwt",
  token_endpoint_auth_signing_alg: "EdDSA",
  jwks: {
    keys: [createPublicKey(ed25519(createHash("sha256").update("tuevento-pruebas-jwt").digest())).export({ format: "jwk" })],
  },
});

type Provider = InstanceType<typeof import("oidc-provider").default>;
type Site = { issuer: string; resource: string; origin: string; provider: Provider };
type Account = { id: string; account_type: AccountType; is_demo: boolean };

/** Un servidor de autorización por dominio: cada uno con su emisor, su sesión y su recurso. */
@Injectable()
export class McpOAuth implements OnModuleInit {
  private sites = new Map<Locale, Site>();
  private sessionNotFound!: typeof import("oidc-provider").errors.SessionNotFound;

  constructor(private db: Database) {}

  async onModuleInit() {
    const { default: Provider, errors } = await import("oidc-provider");
    this.sessionNotFound = errors.SessionNotFound;
    for (const domain of ["es", "en"] as const) {
      const origin = localeEnv("SITE_URL", domain).replace(/\/+$/, "");
      if (!origin) continue;
      const issuer = `${origin}${OAUTH_PATH}`;
      const resource = `${origin}/api/mcp`;
      const provider = new Provider(issuer, {
        adapter: oauthAdapter(this.db, issuer) as never,
        clients: mcpTestMode() ? [TEST_CLIENT as never, testJwtClient() as never] : [],
        cookies: {
          keys: [derive("cookies").toString("base64url")],
          names: { session: "mcp_session", interaction: "mcp_interaction", resume: "mcp_resume" },
        },
        jwks: { keys: [signingKey() as never] },
        enabledJWA: { idTokenSigningAlgValues: ["EdDSA"] },
        clientDefaults: { id_token_signed_response_alg: "EdDSA" },
        claims: { openid: ["sub"] },
        scopes: [GRANTED_SCOPE],
        responseTypes: ["code"],
        clientAuthMethods: ["none", "private_key_jwt"],
        pkce: { required: () => true },
        features: {
          devInteractions: { enabled: false },
          revocation: { enabled: true },
          clientIdMetadataDocument: {
            enabled: true,
            ack: "draft-02",
            allowFetch: async (_ctx: unknown, clientId: string) => clientMetadataAllowed(clientId),
          },
          resourceIndicators: {
            enabled: true,
            defaultResource: () => resource,
            useGrantedResource: () => true,
            getResourceServerInfo: (_ctx: unknown, requested: string) => {
              if (requested !== resource) throw new errors.InvalidTarget();
              return { scope: GRANTED_SCOPE, audience: resource, accessTokenTTL: ACCESS_TOKEN_TTL, accessTokenFormat: "opaque" };
            },
          },
        } as never,
        interactions: { url: (_ctx, interaction) => `${OAUTH_PATH}/interaction/${interaction.uid}` },
        findAccount: async (_ctx, id) => ((await this.account(id)) ? { accountId: id, claims: async () => ({ sub: id }) } : undefined),
        expiresWithSession: () => false,
        issueRefreshToken: async (_ctx, client) => client.grantTypeAllowed("refresh_token"),
        ttl: {
          AccessToken: ACCESS_TOKEN_TTL,
          AuthorizationCode: 60,
          Grant: REFRESH_TOKEN_TTL,
          Interaction: 600,
          RefreshToken: REFRESH_TOKEN_TTL,
          Session: 600,
        },
        renderError: (ctx, out) => {
          ctx.type = "application/json";
          ctx.body = { error: out.error, error_description: out.error_description };
        },
      });
      provider.proxy = true;
      this.sites.set(domain, { issuer, resource, origin, provider });
    }
  }

  private async account(id: string) {
    // Una cuenta que aún no termina el registro no conecta asistentes
    const [user] = await this.db.query<Account>(
      "SELECT id, account_type, is_demo FROM users WHERE id = $1 AND NOT must_choose_type AND NOT must_add_phone AND NOT (must_verify_email AND email_verified_at IS NULL)",
      [id],
    );
    return user && !user.is_demo ? user : undefined;
  }

  /** Dominio de la petición; `undefined` si ese dominio no está configurado. */
  site(req: FastifyRequest) {
    return this.sites.get(siteLocale(requestLocale(req)));
  }

  /** Atiende la ruta OAuth con el cuerpo sin leer: `oidc-provider` lee y responde por su cuenta. */
  handle(req: FastifyRequest, reply: FastifyReply) {
    const site = this.site(req);
    if (!site) return false;
    reply.hijack();
    const raw = req.raw as typeof req.raw & { originalUrl?: string };
    // El gateway no la sobrescribe: el host es siempre el de la cabecera `Host`
    delete raw.headers["x-forwarded-host"];
    raw.originalUrl = raw.url;
    raw.url = (raw.url as string).slice(OAUTH_PATH.length) || "/";
    void site.provider.callback()(raw, reply.raw);
    return true;
  }

  /** Documento de RFC 9728 del recurso `/api/mcp` en este dominio. */
  protectedResource(req: FastifyRequest) {
    const site = this.site(req);
    return (
      site && {
        resource: site.resource,
        authorization_servers: [site.issuer],
        scopes_supported: [GRANTED_SCOPE],
        bearer_methods_supported: ["header"],
      }
    );
  }

  /** Cabecera del 401, con la que el cliente descubre cómo pedir un token. */
  challenge(req: FastifyRequest, error?: "invalid_token" | "insufficient_scope") {
    const metadata = `${this.site(req)?.origin ?? ""}/.well-known/oauth-protected-resource/api/mcp`;
    return `Bearer resource_metadata="${metadata}", scope="${GRANTED_SCOPE}"${error ? `, error="${error}"` : ""}`;
  }

  /** Token emitido por OAuth: vigente, para este dominio, con el alcance concedido y de una cuenta válida. */
  async verify(req: FastifyRequest, token: string, locale: Locale): Promise<McpAuthContext | null> {
    const site = this.site(req);
    const access = await site?.provider.AccessToken.find(token);
    if (!site || !access?.accountId || access.aud !== site.resource) return null;
    const scopes = (access.scope ?? "").split(" ").filter((scope): scope is McpScope => scope === GRANTED_SCOPE);
    const user = await this.account(access.accountId);
    if (!user || !scopes.length) return null;
    return { actorType: accountArea(user.account_type), userId: user.id, clientName: access.clientId ?? "", scopes, locale };
  }

  /** Página de consentimiento en el idioma de quien entra. Un paso caducado también la abre: ahí lo explica. */
  async consentPage(req: FastifyRequest, reply: FastifyReply, uid: string, accountLocale?: string | null) {
    const site = this.required(req);
    const uiLocales = await this.interaction(site, req, reply).then(
      ({ params }) => params.ui_locales,
      () => undefined,
    );
    const locale = consentLocale(siteLocale(requestLocale(req)), uiLocales, accountLocale);
    return `${localePrefix(locale)}/conectar-asistente?uid=${encodeURIComponent(uid)}`;
  }

  /** Datos que muestra la pantalla de consentimiento. */
  async consent(req: FastifyRequest, reply: FastifyReply) {
    const site = this.required(req);
    const { params } = await this.interaction(site, req, reply);
    const client = await site.provider.Client.find(String(params.client_id));
    return { clientName: client?.clientName ?? String(params.client_id), scopes: [GRANTED_SCOPE] };
  }

  /** Respuesta de la persona: devuelve la URL con la que el navegador sigue el flujo. */
  async decide(req: FastifyRequest, reply: FastifyReply, accountId: string, allow: boolean) {
    const site = this.required(req);
    const { provider } = site;
    const { params } = await this.interaction(site, req, reply);
    if (!allow)
      return provider.interactionResult(req.raw, reply.raw, {
        error: "access_denied",
        error_description: "The user denied access",
      });
    const grant = new provider.Grant({ accountId, clientId: String(params.client_id) });
    // `oidc-provider` también cuenta `scopes` como alcances propios: si faltan, vuelve a pedir consentimiento
    grant.addOIDCScope(`openid ${GRANTED_SCOPE}`);
    grant.addResourceScope(site.resource, GRANTED_SCOPE);
    return provider.interactionResult(req.raw, reply.raw, { login: { accountId }, consent: { grantId: await grant.save() } });
  }

  /** El paso en curso; caducado o de otro navegador, 404. */
  private async interaction(site: Site, req: FastifyRequest, reply: FastifyReply) {
    try {
      return await site.provider.interactionDetails(req.raw, reply.raw);
    } catch (error) {
      if (error instanceof this.sessionNotFound) throw new NotFoundException();
      throw error;
    }
  }

  private required(req: FastifyRequest) {
    const site = this.site(req);
    if (!site) throw new NotFoundException();
    return site;
  }
}
