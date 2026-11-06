// Cliente mínimo para las pruebas de la API (test-endpoints.mjs, test-security.mjs).
import assert from "node:assert/strict";
import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import http from "node:http";
import https from "node:https";
import { deflateSync } from "node:zlib";

export const base = process.env.TEST_API_URL || "http://127.0.0.1:3087/api";
export const adminBase = process.env.TEST_ADMIN_URL || "http://127.0.0.1:8188";
// Dominios de desarrollo: el idioma de la API depende del Host (gateway).
export const englishHost = new URL(process.env.TEST_SITE_URL_EN || "http://yourevent.localhost:5187").hostname;
export const spanishHost = new URL(process.env.TEST_SITE_URL_ES || "http://localhost:5187").hostname;

/** fetch() de Node no deja fijar Host (y el idioma depende de él): node:http/https sí. */
export function send(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(target, { method, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    request.on("error", reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

// API de Mailpit (compose.yml y compose.ci.yml): ahí llegan los correos de la API
const mailpit = process.env.TEST_MAILPIT_URL || "http://127.0.0.1:8026";
/** Token del último enlace de confirmación enviado a `address`, esperando a que llegue. */
export async function verificationToken(address) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const list = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`).then((r) => r.json());
    for (const { ID } of list.messages ?? []) {
      const mail = await fetch(`${mailpit}/api/v1/message/${ID}`).then((r) => r.json());
      const token = /\/confirmar-correo\?token=([\w-]{43})/.exec(mail.Text)?.[1];
      if (token) return token;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No llegó a ${address} el correo de confirmación`);
}

/**
 * Cliente con sus propias cookies (la de sesión y las de acceso a landings), como un navegador.
 * `raw` devuelve la respuesta sin interpretar. Una cuenta nueva no usa la API hasta confirmar su
 * correo: el cliente lo confirma al registrarse, salvo con `{ confirm: false }`.
 */
export function client({ confirm = true } = {}) {
  const jar = new Map();
  const load = (value) => {
    jar.clear();
    for (const pair of value.split("; ").filter(Boolean)) jar.set(pair.split("=")[0], pair);
  };
  const header = () => [...jar.values()].join("; ");
  const api = {
    async raw(path, { method = "GET", body, headers = {}, json = true, csrf = true } = {}) {
      const r = await send(base + path, {
        method,
        headers: {
          ...(body !== undefined && json ? { "Content-Type": "application/json" } : {}),
          ...(csrf ? { "X-TuEvento-Client": "1" } : {}),
          ...(jar.size ? { Cookie: header() } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: json ? JSON.stringify(body) : body } : {}),
      });
      const set = r.headers["set-cookie"];
      for (const line of set ?? []) {
        const pair = line.split(";")[0];
        const name = pair.split("=")[0];
        // Una cookie vacía o caducada es la forma de borrarla
        if (pair.endsWith("=") || /max-age=0\b|expires=thu, 01 jan 1970/i.test(line)) jar.delete(name);
        else jar.set(name, pair);
      }
      let data = {};
      try { data = JSON.parse(r.text || "{}"); } catch { data = { _text: r.text }; }
      if (confirm && path === "/auth/register" && method === "POST" && r.status === 201) {
        const verified = await send(`${base}/auth/email/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-TuEvento-Client": "1", ...headers },
          body: JSON.stringify({ token: await verificationToken(body.email) }),
        });
        assert.equal(verified.status, 200, verified.text.slice(0, 200));
      }
      return { status: r.status, headers: r.headers, data, text: r.text, setCookie: set ?? [] };
    },
    /** Llama y comprueba el estado esperado (por defecto 200). */
    async call(path, method = "GET", body, expected = 200, headers = {}) {
      const r = await api.raw(path, { method, body, headers });
      assert.equal(r.status, expected, `${method} ${path} → ${r.status} ${r.text.slice(0, 200)}`);
      return r.data;
    },
    cookie: header,
    setCookie: load,
  };
  return api;
}

/** Cliente OAuth fijo de pruebas (`MCP_TEST_MODE`) y recurso MCP del dominio principal. */
export const mcpOAuth = {
  clientId: "tuevento-pruebas",
  redirectUri: "http://127.0.0.1/callback",
  resource: `${process.env.TEST_SITE_URL_ES || "http://tuevento.localhost:5187"}/api/mcp`,
};

/** URL de autorización con PKCE; `overrides` cambia o quita (undefined) parámetros. */
export function mcpAuthorizeUrl(overrides = {}) {
  const verifier = randomBytes(32).toString("base64url");
  const params = {
    client_id: mcpOAuth.clientId,
    redirect_uri: mcpOAuth.redirectUri,
    response_type: "code",
    scope: "mcp:read",
    resource: mcpOAuth.resource,
    state: randomBytes(8).toString("hex"),
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    ...overrides,
  };
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined));
  return { path: `/mcp/oauth/auth?${query}`, verifier, state: params.state };
}

/** Abre la autorización como el navegador de `user` y devuelve el paso de consentimiento. */
export async function mcpStartConsent(user, overrides) {
  const flow = mcpAuthorizeUrl(overrides);
  const start = await user.raw(flow.path);
  assert.equal(start.status, 303, start.text.slice(0, 200));
  const uid = /\/interaction\/([^/?]+)/.exec(start.headers.location)?.[1];
  assert.ok(uid, start.headers.location);
  return { ...flow, uid };
}

/** Sigue las redirecciones de la API hasta la del cliente y devuelve sus parámetros. */
export async function mcpFollowToClient(user, location) {
  for (let hops = 0; hops < 5; hops += 1) {
    if (location.startsWith(mcpOAuth.redirectUri)) return new URL(location).searchParams;
    const { pathname, search } = new URL(location, base);
    const next = await user.raw(`${pathname.replace(/^\/api/, "")}${search}`);
    assert.equal(next.status, 303, next.text.slice(0, 200));
    location = next.headers.location;
  }
  throw new Error("Demasiadas redirecciones");
}

/** Pide el token del cliente fijo; devuelve la respuesta sin interpretar. */
export const mcpTokenRequest = async (fields, host) => {
  const r = await send(`${base}/mcp/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(host ? { Host: host } : {}) },
    body: new URLSearchParams(Object.entries({ client_id: mcpOAuth.clientId, ...fields }).filter(([, value]) => value !== undefined)).toString(),
  });
  return { status: r.status, data: JSON.parse(r.text || "{}") };
};

/** Aserción `private_key_jwt` del cliente de pruebas; la semilla es la de `testJwtClient` en la API. */
export function mcpClientAssertion(audience, jti = randomBytes(8).toString("hex")) {
  const clientId = "tuevento-pruebas-jwt";
  const seed = createHash("sha256").update(clientId).digest();
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: "EdDSA", typ: "JWT" })}.${encode({ iss: clientId, sub: clientId, aud: audience, jti, iat: now, exp: now + 60 })}`;
  return `${body}.${sign(null, Buffer.from(body), key).toString("base64url")}`;
}

/** Flujo completo: consentimiento aceptado y código cambiado por tokens. */
export async function mcpConnect(user, overrides) {
  const flow = await mcpStartConsent(user, overrides);
  const { redirectTo } = await user.call(`/mcp/oauth/interaction/${flow.uid}/decision`, "POST", { allow: true });
  const params = await mcpFollowToClient(user, redirectTo);
  const tokens = await mcpTokenRequest({
    grant_type: "authorization_code",
    code: params.get("code"),
    code_verifier: flow.verifier,
    redirect_uri: mcpOAuth.redirectUri,
    resource: mcpOAuth.resource,
  });
  assert.equal(tokens.status, 200, JSON.stringify(tokens.data));
  return { ...flow, params, tokens: tokens.data };
}

/** Llamada JSON-RPC a `/mcp` con un token. */
export async function mcpCall(token, method, params, host) {
  const r = await send(`${base}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(host ? { Host: host } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return { status: r.status, headers: r.headers, body: JSON.parse(r.text || "{}") };
}

export const unique = Date.now();
export const password = randomBytes(20).toString("hex");
/** Cuenta válida y única; `prefix` permite limpiarlas al final. */
export const account = (prefix, n, extra = {}) => ({
  firstName: "Prueba",
  lastName: "Automática",
  email: `${prefix}-${unique}-${n}@example.invalid`,
  phone: "+527770000000",
  password,
  accountType: "organizer",
  ...extra,
});

export const eventData = (extra = {}) => ({
  title: "QA · Celebración",
  description: "Traer alegría",
  // Siempre en el futuro: un día después de su fecha, el evento queda en solo lectura
  date: `${new Date().getUTCFullYear() + 1}-12-20T23:00:00.000Z`,
  timeZone: "America/Mexico_City",
  location: "Jardín de pruebas",
  theme: "floral",
  ...extra,
});
export const invitationData = (extra = {}) => ({
  name: "Familia de prueba",
  kind: "family",
  email: "prueba@example.invalid",
  phone: "+527770001111",
  notes: "Privado",
  members: [{ name: "Ana García", kind: "adult", notes: "" }],
  ...extra,
});

export function suiteRunner() {
  const records = [];
  return {
    records,
    async suite(name, fn) {
      await fn();
      records.push({ name, passed: true });
      console.log("PASS", name);
    },
  };
}

const json = { "Content-Type": "application/json" };

/** Sesión del panel de administración, para preparar cupones como lo haría el administrador. */
async function adminCookie() {
  const login = await send(`${adminBase}/api/login`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ username: process.env.TEST_ADMIN_USER || "admin", password: process.env.TEST_ADMIN_PASSWORD || "Password.Password.1" }),
  });
  assert.equal(login.status, 200, login.text);
  return login.headers["set-cookie"][0].split(";")[0];
}

/** Crea un cupón con un código único y devuelve `{ code, id }`. */
export async function createCoupon(fields) {
  const code = `QA-${randomBytes(5).toString("hex").toUpperCase()}`;
  const created = await send(`${adminBase}/api/coupons`, {
    method: "POST",
    headers: { ...json, Cookie: await adminCookie() },
    body: JSON.stringify({ code, ...fields }),
  });
  assert.equal(created.status, 201, created.text);
  return { code, ...JSON.parse(created.text) };
}

/** Activa o desactiva un cupón desde el panel. */
export async function setCouponActive(id, active) {
  const changed = await send(`${adminBase}/api/coupons/active`, {
    method: "POST",
    headers: { ...json, Cookie: await adminCookie() },
    body: JSON.stringify({ id, active }),
  });
  assert.equal(changed.status, 200, changed.text);
}

/** Ejecuta SQL en la base de datos local o del CI, para fijar estados que la API no deja crear. */
export function sql(query) {
  return execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "tuevento", "-d", "tueventofun", "-Atc", query], { encoding: "utf8" }).trim();
}

/**
 * Deja la cuenta como la crea el registro con Google (que no se puede hacer sin Google): sin teléfono
 * y con el paso de pedirlo pendiente. Solo en local o en el CI, donde hay `docker compose`.
 */
export function pedirTelefono(email) {
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "tuevento", "-d", "tueventofun", "-c",
    `UPDATE users SET phone='',must_add_phone=true WHERE email='${email.replace(/'/g, "''")}'`], { stdio: "ignore" });
}

/** Borra las cuentas de prueba (solo en local, contra el PostgreSQL de Docker; si no se puede, se ignora). */
export function cleanup(prefix) {
  if (process.env.TEST_API_URL) return;
  try {
    execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "tuevento", "-d", "tueventofun", "-c",
      `DELETE FROM users WHERE email LIKE '${prefix}-${unique}-%@example.invalid'; DELETE FROM newsletter_subscribers WHERE email LIKE '${prefix}-${unique}-%@example.invalid';`],
      { stdio: "ignore" });
  } catch { /* limpieza de cortesía */ }
}

/** PNG de un color, como data URL: una foto válida y diminuta para las subidas. */
export function pngDataUrl(width = 4, height = 3) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x88)]);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** Datos mínimos de un negocio que se puede publicar (le falta la foto). */
export const providerData = (extra = {}) => ({
  businessName: `Banquetes QA ${unique}`,
  categories: ["catering"],
  geo: { lat: 18.921831, lng: -99.234567 },
  whatsapp: "+52 777 123 4567",
  city: "Cuernavaca",
  ...extra,
});
