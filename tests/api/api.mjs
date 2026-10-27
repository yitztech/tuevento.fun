// Cliente mínimo para las pruebas de la API (test-endpoints.mjs, test-security.mjs).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import http from "node:http";
import https from "node:https";

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
