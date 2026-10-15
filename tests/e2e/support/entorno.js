// Contra qué app se prueba. Por defecto, la de `docker compose up` en localhost.
export const baseURL = process.env.E2E_BASE_URL || "http://localhost:5187";
// Un idioma por dominio: el inglés vive en otro host. Contra localhost se resuelve a
// 127.0.0.1 desde Chromium, así que no hace falta DNS ni OrbStack (tampoco en CI).
export const englishURL =
  process.env.E2E_BASE_URL_EN || `http://en.tueventofun.orb.local:${new URL(baseURL).port || 80}`;
export const local = /^(localhost|127\.0\.0\.1)$/.test(new URL(baseURL).hostname);
