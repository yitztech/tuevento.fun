import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Formato: scrypt$N$r$p$sal$hash (base64). Así la contraseña nunca se guarda en claro.
const derive = promisify(scrypt);
const COST = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, KEY_LENGTH, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [name, N, r, p, salt, expected] = String(stored ?? "").split("$");
  if (name !== "scrypt" || !salt || !expected) return false;
  const want = Buffer.from(expected, "base64");
  const got = await derive(password, Buffer.from(salt, "base64"), want.length, { N: Number(N), r: Number(r), p: Number(p) });
  return got.length === want.length && timingSafeEqual(got, want);
}
