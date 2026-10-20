import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ServiceUnavailableException,
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import type { FastifyRequest, FastifyReply } from "fastify";
import { clientPlatform } from "./client-platform";
import { Database } from "./database";
import {
  passwordResetPaths,
  PASSWORD_RESET_MINUTES,
  normalizeLocale,
  translate,
  type Locale,
  type RegisterInput,
  type User,
} from "@tuevento/contracts";
import { requestLocale } from "./request-locale";
import { hashPassword, verifyPassword } from "./password";
import { ipKey, limits } from "./rate-limit";
import { MailService } from "./mail";
import { passwordChangedMail, passwordResetMail } from "./mail-templates";
import { siteUrl } from "./locale-env";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const INVALID_RESET_LINK =
  "common.passwordResetLinkInvalid";
/** Error de PostgreSQL por un valor repetido en un índice único. */
export const isUniqueViolation = (e: unknown) =>
  (e as { code?: unknown } | null)?.code === "23505";
/** Fila de `users` tal como la devuelve PostgreSQL. */
export type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar: string | null;
  is_demo: boolean;
  is_owner: boolean | null;
  locale: string | null;
  password_hash: string | null;
};
export const userView = (r: UserRow): User => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  phone: r.phone,
  avatar: r.avatar,
  isDemo: r.is_demo,
  isOwner: r.is_owner === true,
  locale: normalizeLocale(r.locale),
});
/**
 * Cookies de la API (AGENTS.md §24): con HTTPS llevan el prefijo `__Host-` (Secure, Path=/ y sin
 * Domain: cada dominio tiene la suya). En local y en el CI, sin HTTPS, el navegador rechazaría ese
 * prefijo y se usa el nombre sin él.
 */
const secureCookies = process.env.COOKIE_SECURE === "true";
export const cookieName = (name: string) => (secureCookies ? `__Host-${name}` : name);
export const SESSION_COOKIE = cookieName("session");
export const GOOGLE_NONCE_COOKIE = cookieName("google_nonce");
/** Cookie de sesión anterior (`session`, Path=/api): se lee mientras caduca y se borra al renovar. */
const LEGACY_SESSION_COOKIE = "session";
const legacyCookieOptions = { path: "/api", httpOnly: true, sameSite: "lax" as const, secure: secureCookies };
export const sessionToken = (req: FastifyRequest) =>
  req.cookies[SESSION_COOKIE] || req.cookies[LEGACY_SESSION_COOKIE];
export type AuthedRequest = FastifyRequest & { user: User };
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private db: Database,
    private mail: MailService,
  ) {}
  passwordHash(password: string) {
    return hashPassword(password);
  }
  async register(data: RegisterInput, locale: Locale) {
    const passwordHash = await this.passwordHash(data.password);
    try {
      const [r] = await this.db.query<UserRow>(
        "INSERT INTO users(id,first_name,last_name,email,phone,password_hash,locale) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          randomUUID(),
          data.firstName,
          data.lastName,
          data.email,
          data.phone,
          passwordHash,
          locale,
        ],
      );
      return userView(r);
    } catch (e: unknown) {
      if (isUniqueViolation(e))
        throw new ConflictException(
          "errors.emailAddressAlreadyRegistered",
        );
      throw e;
    }
  }
  /**
   * Límites (§24): intentos por IP y fallos por cuenta. La cuenta se bloquea por cuenta y no solo
   * por IP, para frenar el adivinado contra un correo desde muchas IP.
   */
  async login(email: string, password: string, req: FastifyRequest) {
    const key = `login:account:${email.toLowerCase()}`;
    limits.loginIp.hit(ipKey("login", req));
    limits.loginAccount.check(key);
    const [r] = await this.db.query<UserRow>(
      "SELECT * FROM users WHERE email=$1 AND is_demo=false",
      [email],
    );
    const { valid, rehash } = await verifyPassword(password, r?.password_hash);
    if (!r || !valid) {
      limits.loginAccount.allow(key);
      throw new UnauthorizedException(
        "errors.emailAddressPasswordIncorrect",
      );
    }
    limits.loginAccount.reset(key);
    // Los hashes scrypt anteriores pasan a Argon2id al entrar
    if (rehash)
      await this.db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        await this.passwordHash(password),
        r.id,
      ]);
    return userView(r);
  }
  cookieOptions() {
    return {
      path: "/",
      httpOnly: true,
      sameSite: "lax" as const,
      secure: secureCookies,
    };
  }
  async session(user: User, req: FastifyRequest, reply: FastifyReply, kind: "login" | "registration" = "login") {
    const previous = sessionToken(req);
    if (previous)
      await this.db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(previous),
      ]);
    const token = randomBytes(32).toString("base64url");
    await this.db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at,platform,app_version) VALUES($1,$2,now()+interval '7 days',$3,$4)",
      [hash(token), user.id, clientPlatform(req), String(req.headers["x-app-version"] || "web").slice(0,64)],
    );
    if (!user.isDemo) {
      // Idioma de la cuenta = el del dominio por el que entra: ahí le llegan los correos
      const locale = requestLocale(req);
      if (user.locale !== locale) {
        await this.db.query("UPDATE users SET locale=$1 WHERE id=$2", [locale, user.id]);
        user = { ...user, locale };
      }
      await this.db.query("INSERT INTO activity(id,kind,platform,user_id) VALUES($1,$2,$3,$4)", [randomUUID(), kind, clientPlatform(req), user.id]);
      if (kind === "registration") await this.db.query("UPDATE users SET registration_platform=$1 WHERE id=$2", [clientPlatform(req), user.id]);
    }
    if (req.cookies[LEGACY_SESSION_COOKIE] && LEGACY_SESSION_COOKIE !== SESSION_COOKIE)
      reply.clearCookie(LEGACY_SESSION_COOKIE, legacyCookieOptions);
    reply.setCookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: 7 * 86400,
    });
    return user;
  }
  /**
   * Envía un enlace para elegir contraseña nueva, en el idioma del dominio por el que
   * entró el usuario, desde el remitente de ese dominio y apuntando a ese dominio.
   * La respuesta es la misma exista o no la cuenta.
   */
  async requestPasswordReset(email: string, req: FastifyRequest) {
    const locale = requestLocale(req);
    limits.resetIp.hit(ipKey("reset", req));
    // Pasado el límite por correo se responde igual, sin enviar nada: no revela si la cuenta existe
    const [user] = limits.resetAccount.allow(`reset:account:${email}`)
      ? await this.db.query(
          "SELECT id,first_name,email FROM users WHERE email=$1 AND is_demo=false",
          [email],
        )
      : [];
    if (user) {
      const token = randomBytes(32).toString("base64url");
      // Solo vale el último enlace pedido
      await this.db.query("DELETE FROM password_resets WHERE user_id=$1", [user.id]);
      await this.db.query(
        `INSERT INTO password_resets(token_hash,user_id,locale,expires_at) VALUES($1,$2,$3,now()+interval '${PASSWORD_RESET_MINUTES} minutes')`,
        [hash(token), user.id, locale],
      );
      const site = siteUrl(locale);
      // Sin esperar al SMTP: el tiempo de respuesta no revela si la cuenta existe
      void this.mail
        .send(
          locale,
          passwordResetMail(locale, {
            to: user.email,
            name: user.first_name,
            url: `${site}${passwordResetPaths.reset}?token=${token}`,
            site,
            minutes: PASSWORD_RESET_MINUTES,
          }),
        )
        .catch((e: Error) =>
          this.logger.error(`No se pudo enviar el correo de recuperación: ${e.message}`),
        );
    }
    return {
      ok: true,
      message: translate(locale, "account.resetLinkSent"),
    };
  }
  /** Cambia la contraseña con un enlace válido, cierra todas las sesiones y avisa por correo. */
  async resetPassword(token: string, password: string) {
    const passwordHash = await this.passwordHash(password);
    const result = await this.db.transaction(async (c) => {
      const {
        rows: [reset],
      } = await c.query(
        "DELETE FROM password_resets WHERE token_hash=$1 RETURNING user_id, locale, expires_at > now() AS valid",
        [hash(token)],
      );
      if (!reset?.valid) return null;
      const {
        rows: [user],
      } = await c.query(
        "UPDATE users SET password_hash=$1 WHERE id=$2 AND is_demo=false RETURNING *",
        [passwordHash, reset.user_id],
      );
      if (!user) return null;
      await c.query("DELETE FROM password_resets WHERE user_id=$1", [user.id]);
      await c.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
      return { user, locale: normalizeLocale(reset.locale) };
    });
    if (!result) throw new BadRequestException(INVALID_RESET_LINK);
    limits.loginAccount.reset(`login:account:${result.user.email}`);
    const site = siteUrl(result.locale);
    void this.mail
      .send(
        result.locale,
        passwordChangedMail(result.locale, {
          to: result.user.email,
          name: result.user.first_name,
          site,
          resetUrl: `${site}${passwordResetPaths.request}`,
        }),
      )
      .catch((e: Error) =>
        this.logger.error(`No se pudo enviar el aviso de contraseña cambiada: ${e.message}`),
      );
    return userView(result.user);
  }
  async current(req: FastifyRequest) {
    const token = sessionToken(req);
    if (!token)
      throw new UnauthorizedException("errors.signInToContinue");
    const [r] = await this.db.query<UserRow>(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [hash(token)],
    );
    if (!r)
      throw new UnauthorizedException(
        "errors.sessionHasExpiredPlease",
      );
    return userView(r);
  }
  async logout(req: FastifyRequest, reply: FastifyReply) {
    const token = sessionToken(req);
    if (token)
      await this.db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(token),
      ]);
    reply.clearCookie(SESSION_COOKIE, this.cookieOptions());
    if (LEGACY_SESSION_COOKIE !== SESSION_COOKIE)
      reply.clearCookie(LEGACY_SESSION_COOKIE, legacyCookieOptions);
    return { ok: true };
  }
  async google(
    credential: string,
    nonce: string,
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    if (!process.env.GOOGLE_CLIENT_ID)
      throw new ServiceUnavailableException(
        "errors.googleSignHasntBeen",
      );
    const validNonce = req.cookies[GOOGLE_NONCE_COOKIE] === nonce;
    reply.clearCookie(GOOGLE_NONCE_COOKIE, this.cookieOptions());
    if (!validNonce)
      throw new BadRequestException(
        "errors.googleRequestHasExpired",
      );
    let payload: TokenPayload | undefined;
    try {
      const ticket = await new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
      ).verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        "errors.couldntVerifyGoogleSign",
      );
    }
    if (
      !payload?.email_verified ||
      !payload.email ||
      payload.nonce !== nonce
    )
      throw new UnauthorizedException("errors.googleDidntConfirmIdentity");
    const [existing] = await this.db.query<UserRow>(
      "SELECT * FROM users WHERE google_sub=$1",
      [payload.sub],
    );
    if (existing) return userView(existing);
    const [sameEmail] = await this.db.query(
      "SELECT id FROM users WHERE email=$1",
      [payload.email.toLowerCase()],
    );
    if (sameEmail)
      throw new ConflictException(
        "errors.alreadyHaveAccountEmail",
      );
    const locale = requestLocale(req);
    try {
      const [r] = await this.db.query<UserRow>(
        "INSERT INTO users(id,first_name,last_name,email,google_sub,locale) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          randomUUID(),
          payload.given_name || translate(locale, "common.host"),
          payload.family_name || "",
          payload.email.toLowerCase(),
          payload.sub,
          locale,
        ],
      );
      await this.db.query("INSERT INTO activity(id,kind,platform,user_id) VALUES($1,'registration',$2,$3)", [randomUUID(), clientPlatform(req), r.id]);
      await this.db.query("UPDATE users SET registration_platform=$1 WHERE id=$2", [clientPlatform(req),r.id]);
      return userView(r);
    } catch (e: unknown) {
      if (isUniqueViolation(e))
        throw new ConflictException(
          "errors.accountAlreadyExistsPlease",
        );
      throw e;
    }
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    request.user = await this.auth.current(request);
    return true;
  }
}
