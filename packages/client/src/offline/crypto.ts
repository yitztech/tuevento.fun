/**
 * Cifrado de cada registro de la copia local con AES-GCM de 256 bits (WebCrypto). La clave es
 * aleatoria por cuenta y vive en el llavero del sistema (SecureStorage), nunca junto a los datos.
 * El dato adicional autenticado es la colección y el id: un registro no se puede mover a otra clave.
 */
export type SealedRecord = { iv: string; data: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBase64 = (bytes: Uint8Array) => {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const additionalData = (collection: string, id: string) => encoder.encode(`${collection}\u0000${id}`);

/** Clave nueva, exportada en base64 para guardarla en el llavero. */
export async function newRecordKey(): Promise<{ key: CryptoKey; exported: string }> {
  const key = await globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = new Uint8Array(await globalThis.crypto.subtle.exportKey("raw", key));
  return { key: await importRecordKey(toBase64(raw)), exported: toBase64(raw) };
}

/** La clave guardada, no exportable una vez importada. */
export function importRecordKey(exported: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey("raw", fromBase64(exported), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function sealRecord(key: CryptoKey, collection: string, id: string, value: unknown): Promise<SealedRecord> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(collection, id) },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

/** Falla (OperationError) si el registro se alteró, se movió o la clave no es la suya. */
export async function openRecord<T>(key: CryptoKey, collection: string, id: string, sealed: SealedRecord): Promise<T> {
  const plain = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(sealed.iv), additionalData: additionalData(collection, id) },
    key,
    fromBase64(sealed.data),
  );
  return JSON.parse(decoder.decode(plain)) as T;
}
