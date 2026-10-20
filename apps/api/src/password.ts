import { argon2 as argon2Callback, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const argon2 = promisify(argon2Callback);

/** Argon2id con los parámetros mínimos de OWASP: 19 MiB, 2 pasadas, 1 hilo (AGENTS.md §24). */
const params = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 } as const;
const prefix = `$argon2id$v=19$m=${params.memory},t=${params.passes},p=${params.parallelism}$`;

async function argon2id(password: string, nonce: Buffer) {
  return (await argon2("argon2id", { message: password, nonce, ...params })) as Buffer;
}

/** Hash en formato PHC. Lo usan las contraseñas de cuenta y las de página pública. */
export async function hashPassword(password: string) {
  const nonce = randomBytes(16);
  const hash = await argon2id(password, nonce);
  return `${prefix}${nonce.toString("base64url")}$${hash.toString("base64url")}`;
}

/** Hash de relleno: el login tarda lo mismo exista o no la cuenta. */
const dummyHash = hashPassword(randomBytes(16).toString("hex"));

/**
 * Comprueba la contraseña. Acepta también los hashes scrypt anteriores ("sal:clave"); `rehash`
 * indica que hay que volver a guardarla con Argon2id.
 */
export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) {
    await verifyPassword(password, await dummyHash);
    return { valid: false, rehash: false };
  }
  if (stored.startsWith(prefix)) {
    const [nonce, expected] = stored.slice(prefix.length).split("$");
    const result = await argon2id(password, Buffer.from(nonce, "base64url"));
    const target = Buffer.from(expected ?? "", "base64url");
    return { valid: target.length === result.length && timingSafeEqual(result, target), rehash: false };
  }
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return { valid: false, rehash: false };
  const result = (await scrypt(password, salt, 64)) as Buffer;
  const target = Buffer.from(expected, "hex");
  const valid = target.length === result.length && timingSafeEqual(result, target);
  return { valid, rehash: valid };
}
