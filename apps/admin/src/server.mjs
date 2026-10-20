import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createAuth } from "./auth.mjs";
import { createDatabase } from "./db.mjs";
import { isPasswordHash } from "./password.mjs";
import * as stats from "./stats.mjs";
import { umamiFromEnv } from "./umami.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const browserDir = join(here, "../dist/browser");
const PAGE_SIZE = 25;
const COOKIE = "admin_session";
const MAX_BODY = 2048;
const HEALTH_TIMEOUT_MS = 900;

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}`);
  return value;
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

// Los archivos estáticos (la compilación de Angular, `npm run build -w @tuevento/admin`) se leen una
// vez al arrancar. Solo se sirven los de esa carpeta con un tipo conocido; index.html, en `/`.
async function loadAssets() {
  const assets = new Map();
  for (const file of await readdir(browserDir, { recursive: true })) {
    const type = TYPES[extname(file)];
    if (!type) continue;
    const route = file === "index.html" ? "/" : `/${file.split(sep).join("/")}`;
    assets.set(route, { body: await readFile(join(browserDir, file)), type });
  }
  if (!assets.has("/")) throw new Error(`Falta ${join(browserDir, "index.html")}: compila el panel con \`npm run build -w @tuevento/admin\``);
  return assets;
}

const SECURITY = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

function send(res, status, headers, body) {
  res.writeHead(status, { ...SECURITY, ...headers });
  res.end(body);
}

const json = (res, status, data, headers = {}) =>
  send(res, status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }, JSON.stringify(data));

const intParam = (value, min, max, fallback) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Cuerpo JSON obligatorio (la cookie SameSite=Strict y este tipo de contenido cierran el CSRF).
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return reject({ status: 415 });
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) reject({ status: 413 });
      else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject({ status: 400 });
      }
    });
    req.on("error", () => reject({ status: 400 }));
  });
}

const cookieValue = (req) => {
  const found = String(req.headers.cookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  return found ? decodeURIComponent(found.slice(COOKIE.length + 1)) : "";
};

const sessionCookie = (token, maxAge) =>
  `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.COOKIE_SECURE === "false" ? "" : "; Secure"}`;

export async function start({ port = Number(process.env.PORT || 3088) } = {}) {
  const assets = await loadAssets();
  const passwordHash = required("ADMIN_PASSWORD_HASH");
  // Un hash recortado (p. ej. por un `$` interpretado como variable) dejaría el panel sin entrada posible
  if (!isPasswordHash(passwordHash)) {
    throw new Error("ADMIN_PASSWORD_HASH no es un hash válido: genéralo con `npm run hash-password -w @tuevento/admin` y pégalo entero");
  }
  const auth = createAuth({
    username: required("ADMIN_USER"),
    passwordHash,
    maxFailures: Number(process.env.ADMIN_MAX_FAILURES || 10),
  });
  const umami = umamiFromEnv();
  const db = createDatabase({ connectionString: required("DATABASE_URL"), password: process.env.PGPASSWORD });

  const requireSession = (req, res) => {
    if (auth.valid(cookieValue(req))) return true;
    json(res, 401, { error: "unauthorized" });
    return false;
  };

  // Sano si el rol `admin_ro` entra y lee lo que muestra el panel (rol creado y permisos de la migración 014)
  const healthy = () => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), HEALTH_TIMEOUT_MS);
    });
    return Promise.race([db.query("SELECT 1 FROM events LIMIT 1"), timeout])
      .then(() => true, () => false)
      .finally(() => clearTimeout(timer));
  };

  const api = {
    "GET /api/health": async (req, res) =>
      (await healthy()) ? json(res, 200, { status: "ok" }) : json(res, 503, { status: "error" }),
    "POST /api/login": async (req, res) => {
      const body = await readJson(req);
      const ip = req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";
      const result = await auth.login(ip, String(body.username ?? ""), String(body.password ?? ""));
      if (result.error === "blocked") return json(res, 429, { error: "blocked" });
      if (result.error) return json(res, 401, { error: "invalid" });
      return json(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(result.token, auth.SESSION_MS / 1000) });
    },
    "POST /api/logout": (req, res) => {
      auth.logout(cookieValue(req));
      return json(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
    },
    "GET /api/session": (req, res) => {
      if (requireSession(req, res)) json(res, 200, { ok: true });
    },
    "GET /api/stats": async (req, res, url) => {
      if (!requireSession(req, res)) return;
      const days = intParam(url.searchParams.get("days"), 1, 90, 30);
      const [overview, activity] = await Promise.all([stats.overview(db), stats.activity(db, days)]);
      return json(res, 200, { overview, activity });
    },
    // Países: Umami los guarda, la base no. Sin Umami configurado (desarrollo), el panel lo dice.
    "GET /api/countries": async (req, res, url) => {
      if (!requireSession(req, res)) return;
      const days = intParam(url.searchParams.get("days"), 1, 90, 30);
      if (!umami) return json(res, 200, { available: false, days, rows: [] });
      try {
        return json(res, 200, { available: true, days, rows: await umami.countries(days) });
      } catch (error) {
        console.error(`Umami: ${error.message}`);
        return json(res, 502, { error: "umami" });
      }
    },
    "GET /api/users": async (req, res, url) => {
      if (!requireSession(req, res)) return;
      const page = intParam(url.searchParams.get("page"), 1, 10_000, 1);
      const rows = await stats.users(db, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE });
      return json(res, 200, { page, pageSize: PAGE_SIZE, rows });
    },
    "GET /api/events": async (req, res, url) => {
      if (!requireSession(req, res)) return;
      const page = intParam(url.searchParams.get("page"), 1, 10_000, 1);
      const rows = await stats.events(db, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE });
      return json(res, 200, { page, pageSize: PAGE_SIZE, rows });
    },
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://admin.local");
    try {
      // Solo dice que el proceso vive (contrato de la plataforma); la base la comprueba /api/health
      if (req.method === "GET" && url.pathname === "/healthz") return send(res, 200, { "Content-Type": "text/plain" }, "ok");
      if (req.method === "GET" && assets.has(url.pathname)) {
        const { body, type } = assets.get(url.pathname);
        return send(res, 200, { "Content-Type": type, "Cache-Control": "no-cache" }, body);
      }
      const handler = api[`${req.method} ${url.pathname}`];
      if (handler) return await handler(req, res, url);
      if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "notFound" });
      return send(res, 404, { "Content-Type": "text/plain" }, "not found");
    } catch (error) {
      if (error?.status) return json(res, error.status, { error: "request" });
      console.error(error);
      return json(res, 500, { error: "server" });
    }
  });
  await new Promise((resolve) => server.listen(port, "0.0.0.0", resolve));
  return { server, db, close: () => new Promise((resolve) => server.close(resolve)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await start();
  console.log(`Admin escuchando en ${process.env.PORT || 3088}`);
}
