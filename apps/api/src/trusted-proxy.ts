import { lookup } from "node:dns/promises";
/**
 * Proxy de confianza: solo el servicio `gateway` de la red interna del compose.
 * El gateway sobrescribe X-Forwarded-For con la IP real del cliente; cualquier
 * otro emisor (incluido un cliente que llegue directo a la API) no es de
 * confianza y su X-Forwarded-For se ignora. Docker puede cambiar la IP del
 * gateway al recrearlo, así que se vuelve a resolver periódicamente. Si el nombre
 * no resuelve, no se confía en nadie.
 */
const GATEWAY_HOST = "gateway";
const REFRESH_MS = 15_000;
let trusted = new Set<string>();
const plain = (address: string) => address.replace(/^::ffff:/i, "");
async function refresh() {
  try {
    const found = await lookup(GATEWAY_HOST, { all: true });
    trusted = new Set(found.map((entry) => plain(entry.address)));
  } catch {
    trusted = new Set();
  }
}
export async function startTrustedProxyRefresh() {
  await refresh();
  setInterval(() => void refresh(), REFRESH_MS).unref();
}
export const isTrustedProxy = (address: string) => trusted.has(plain(address));
