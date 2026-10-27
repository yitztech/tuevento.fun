// Cliente mínimo para las pruebas de la API (test-endpoints.mjs, test-security.mjs).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import http from "node:http";
import https from "node:https";
import { deflateSync } from "node:zlib";

export const base = process.env.TEST_API_URL || "http://127.0.0.1:3087/api";
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

/**
 * Cliente con sus propias cookies (la de sesión y las de acceso a landings), como un navegador.
 * `raw` devuelve la respuesta sin interpretar.
 */
export function client() {
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

export const unique = Date.now();
export const password = randomBytes(20).toString("hex");
/** Cuenta válida y única; `prefix` permite limpiarlas al final. */
export const account = (prefix, n, extra = {}) => ({
  firstName: "Prueba",
  lastName: "Automática",
  email: `${prefix}-${unique}-${n}@example.invalid`,
  phone: "+527770000000",
  password,
  ...extra,
});

export const eventData = (extra = {}) => ({
  title: "QA · Celebración",
  description: "Traer alegría",
  date: "2026-12-20T23:00:00Z",
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
