// Contra qué app se prueba. Por defecto, la de `docker compose up` en localhost.
export const baseURL = process.env.E2E_BASE_URL || "http://localhost:5187";
// Un idioma por dominio: el inglés vive en otro host. Contra localhost se resuelve a
// 127.0.0.1 desde Chromium, así que no hace falta DNS ni OrbStack (tampoco en CI).
export const englishURL =
  process.env.E2E_BASE_URL_EN || `http://en.tueventofun.orb.local:${new URL(baseURL).port || 80}`;
export const local = /^(localhost|127\.0\.0\.1)$/.test(new URL(baseURL).hostname);

// Ritmo "humano" para seguir la ejecución a ojo (todo en ms, 0 = a toda velocidad):
//   E2E_SLOWMO  pausa tras cada acción     E2E_TECLADO  pausa entre teclas
//   E2E_PAUSA   espera al final de cada escenario para ver el resultado
export const slowMo = Number(process.env.E2E_SLOWMO || 0);
export const teclado = Number(process.env.E2E_TECLADO || 0);
export const pausa = Number(process.env.E2E_PAUSA || 0);
export const lento = slowMo + teclado + pausa > 0;

// Destino de las pruebas: la web (por defecto), la app de Android (emulador) o la de iOS (simulador).
export const target = process.env.E2E_TARGET || "web";
export const android = target === "android";
export const ios = target === "ios";
