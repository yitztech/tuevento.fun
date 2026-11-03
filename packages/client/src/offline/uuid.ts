/**
 * UUIDv7 (RFC 9562): 48 bits de milisegundos y 74 aleatorios. Los ids creados en el teléfono sin
 * conexión no se pueden enumerar y se ordenan por fecha de creación.
 */
export function uuidv7(now = Date.now()): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let time = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // versión 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
