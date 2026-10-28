import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * Tokens que el organizador vuelve a necesitar (los enlaces de sus invitaciones): la base de datos
 * guarda un HMAC para buscarlos y una copia cifrada (AES-256-GCM) para mostrárselos, nunca el
 * token en claro. Las dos claves salen de APP_SECRET, que vive en el entorno y no en la base de
 * datos ni en sus copias: con solo un volcado de la base no se puede abrir ninguna invitación.
 */
const MIN_SECRET_LENGTH = 32;
let keys: { lookup: Buffer; seal: Buffer; links: Buffer } | null = null;

/** Comprueba APP_SECRET al arrancar (§20): sin él, o demasiado corto, la API no arranca. */
export function assertAppSecret() {
  const secret = process.env.APP_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH)
    throw new Error(`APP_SECRET is required (${MIN_SECRET_LENGTH}+ random characters)`);
}

function derived() {
  if (keys) return keys;
  assertAppSecret();
  const key = (purpose: string) =>
    Buffer.from(hkdfSync("sha256", process.env.APP_SECRET as string, "", `tuevento:${purpose}`, 32));
  keys = { lookup: key("invitation-lookup"), seal: key("invitation-seal"), links: key("signed-links") };
  return keys;
}

/** HMAC con el que se busca una invitación por el token de su enlace. */
export const tokenLookup = (token: string) =>
  createHmac("sha256", derived().lookup).update(token).digest("hex");

/** Token cifrado para guardarlo: nonce, texto cifrado y etiqueta, en base64url. */
export function sealToken(token: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derived().seal, nonce);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString("base64url");
}

/** Token en claro a partir de su copia cifrada; lanza si se alteró o la clave no es la misma. */
export function openToken(sealed: string) {
  const raw = Buffer.from(sealed, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", derived().seal, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
}

/** Firma corta para enlaces que llegan por correo (p. ej. darse de baja), atada a su propósito. */
export const signLink = (purpose: string, value: string) =>
  createHmac("sha256", derived().links).update(`${purpose}:${value}`).digest("base64url");

/** Token nuevo de invitación con las tres formas que se guardan durante la transición. */
export function newInvitationToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: tokenLookup(token), sealed: sealToken(token) };
}
