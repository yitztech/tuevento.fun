// Solo funciones: index.ts reexporta este módulo, y lo que se usa de index se lee al llamarlas
import { geoPointSchema, type GeoPoint } from "./index";

/** Hosts de los enlaces de mapas que se aceptan al pegar uno (y en cada redirección). */
export const mapLinkHosts = [
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
  "maps.apple.com",
  "waze.com",
  "www.waze.com",
  "ul.waze.com",
] as const;
/** Hosts de enlaces cortos: hay que seguir su redirección para ver las coordenadas. */
export const shortMapLinkHosts = ["maps.app.goo.gl", "goo.gl"] as const;

export function isMapLinkHost(hostname: string): boolean {
  return (mapLinkHosts as readonly string[]).includes(hostname.toLowerCase());
}

const pair = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
function point(lat: string, lng: string): GeoPoint | null {
  const parsed = geoPointSchema.safeParse({ lat: Number(lat), lng: Number(lng) });
  return parsed.success ? parsed.data : null;
}

/**
 * Coordenadas de un enlace de Google Maps, Apple Maps o Waze ya resuelto (sin redirecciones
 * pendientes). Orden de preferencia: el lugar marcado (!3d…!4d…), los parámetros de la consulta
 * y, al final, el centro de la vista (@lat,lng), que puede no ser el lugar.
 */
export function coordinatesFromMapLink(link: string): GeoPoint | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !isMapLinkHost(url.hostname)) return null;
  const path = decodeURIComponent(url.pathname);
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(path + url.search);
  if (pin) {
    const found = point(pin[1], pin[2]);
    if (found) return found;
  }
  for (const key of ["q", "query", "ll", "destination", "daddr", "sll", "center"]) {
    const match = pair.exec(url.searchParams.get(key) ?? "");
    if (match) {
      const found = point(match[1], match[2]);
      if (found) return found;
    }
  }
  const place = /\/place\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(path);
  if (place) {
    const found = point(place[1], place[2]);
    if (found) return found;
  }
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(path);
  return view ? point(view[1], view[2]) : null;
}

/** Lugar encontrado en el mapa. */
export type GeoPlace = GeoPoint & {
  label: string;
  city: string;
  region: string;
  country: string;
};
