import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Formato: scrypt:N:r:p:sal:hash (base64). Así la contraseña nunca se guarda en claro.
// Sin `$`: Docker Compose (y Coolify, que lo usa) interpreta `$` en las variables y recortaría el valor.
// El formato anterior, con `$`, se sigue aceptando.
const derive = promisify(scrypt);
const COST = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const parse = (stored) => {
  const [name, N, r, p, salt, expected, ...rest] = String(stored ?? "").split(/[:$]/);
  if (name !== "scrypt" || rest.length || !BASE64.test(salt ?? "") || !BASE64.test(expected ?? "")) return null;
  const cost = { N: Number(N), r: Number(r), p: Number(p) };
  if (!Object.values(cost).every((n) => Number.isInteger(n) && n > 0)) return null;
  return { cost, salt: Buffer.from(salt, "base64"), want: Buffer.from(expected, "base64") };
};

// Para comprobar ADMIN_PASSWORD_HASH al arrancar: un valor recortado o pegado a medias no pasa.
export const isPasswordHash = (stored) => parse(stored)?.want.length === KEY_LENGTH;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, KEY_LENGTH, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), hash.toString("base64")].join(":");
}

export async function verifyPassword(password, stored) {
  const parsed = parse(stored);
  if (!parsed) return false;
  const got = await derive(password, parsed.salt, parsed.want.length, parsed.cost);
  return got.length === parsed.want.length && timingSafeEqual(got, parsed.want);
}
