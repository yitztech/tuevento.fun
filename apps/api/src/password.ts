import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

/** Hash scrypt con sal: "sal:clave". Lo usan las contraseñas de cuenta y las de página pública. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const result = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(result, Buffer.from(expected, "hex"));
}
