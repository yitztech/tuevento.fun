import { Body, Controller, Get, HttpCode, Injectable, Logger, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import {
  coordinatesFromMapLink,
  geoLinkSchema,
  geoReverseSchema,
  geoSearchSchema,
  isMapLinkHost,
  shortMapLinkHosts,
  type GeoPlace,
  type GeoPoint,
  type Locale,
} from "@tuevento/contracts";
import { Database } from "./database";
import { parse, ProblemException } from "./problem";
import { ipKey, limits } from "./rate-limit";
import { requestLocale } from "./request-locale";

/** Nominatim (OpenStreetMap) por defecto; GEOCODER_URL apunta a uno propio o al doble de pruebas. */
const geocoderUrl = () => (process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org").replace(/\/+$/, "");
const userAgent = `TuEventoFun/${process.env.RELEASE_SHA || "dev"} (contacto@tuevento.fun)`;
/** Política de Nominatim: como mucho una petición por segundo, para toda la API. */
const minIntervalMs = Number(process.env.GEOCODER_MIN_INTERVAL_MS ?? 1100);
const timeoutMs = 10_000;
/** Redirecciones que se siguen en un enlace corto (maps.app.goo.gl), comprobando el host en cada una. */
const maxRedirects = 3;

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

const unavailable = () =>
  new ProblemException({ status: 503, code: "geocoder_unavailable", detail: "errors.geocoderUnavailable" });

function placeView(p: NominatimPlace): GeoPlace {
  const a = p.address ?? {};
  return {
    lat: Number(p.lat),
    lng: Number(p.lon),
    label: p.display_name,
    city: a.city || a.town || a.village || a.municipality || a.county || "",
    region: a.state || a.region || "",
    country: (a.country_code || "").toUpperCase(),
  };
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  /** Cola de llamadas a Nominatim: cada una espera a que pase el intervalo desde la anterior. */
  private queue: Promise<unknown> = Promise.resolve();
  private last = 0;
  constructor(private db: Database) {}

  async search(q: string, locale: Locale): Promise<GeoPlace[]> {
    const key = q.toLowerCase().replace(/\s+/g, " ").trim();
    return this.cached("search", key, locale, async () => {
      const params = new URLSearchParams({ q: key, format: "jsonv2", addressdetails: "1", limit: "5", "accept-language": locale });
      const rows = await this.nominatim<NominatimPlace[]>(`/search?${params}`);
      return Array.isArray(rows) ? rows.map(placeView) : [];
    });
  }

  async reverse(point: GeoPoint, locale: Locale): Promise<GeoPlace | null> {
    // Cinco decimales (~1 m): puntos casi iguales comparten caché
    const lat = point.lat.toFixed(5), lng = point.lng.toFixed(5);
    return this.cached("reverse", `${lat},${lng}`, locale, async () => {
      const params = new URLSearchParams({ lat, lon: lng, format: "jsonv2", addressdetails: "1", "accept-language": locale });
      const row = await this.nominatim<NominatimPlace & { error?: string }>(`/reverse?${params}`);
      return row && !row.error && row.lat ? placeView(row) : null;
    });
  }

  /** Coordenadas de un enlace de mapas; los cortos se resuelven sin leer su contenido. */
  async parseLink(link: string, fetcher: typeof fetch = fetch): Promise<GeoPoint> {
    let url = new URL(link);
    for (let hop = 0; (shortMapLinkHosts as readonly string[]).includes(url.hostname); hop++) {
      if (hop >= maxRedirects) break;
      const res = await fetcher(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs) }).catch(() => {
        throw unavailable();
      });
      await res.body?.cancel().catch(() => {});
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location) break;
      const next = new URL(location, url);
      // Protección SSRF: solo se sigue a hosts de mapas y por HTTPS
      if (next.protocol !== "https:" || !isMapLinkHost(next.hostname)) break;
      url = next;
    }
    const point = coordinatesFromMapLink(url.toString());
    if (!point)
      throw new ProblemException({
        status: 422,
        code: "geo_link_without_coordinates",
        detail: "errors.mapLinkWithoutCoordinates",
        errors: [{ field: "url", code: "geo_link_without_coordinates", message: "errors.mapLinkWithoutCoordinates" }],
      });
    return point;
  }

  private async cached<T>(kind: "search" | "reverse", key: string, locale: Locale, load: () => Promise<T>): Promise<T> {
    const hash = createHash("sha256").update(key).digest("hex");
    const [hit] = await this.db.query<{ response: T }>(
      "SELECT response FROM geo_cache WHERE kind=$1 AND key_hash=$2 AND locale=$3 AND created_at > now() - interval '30 days'",
      [kind, hash, locale],
    );
    if (hit) return hit.response;
    const value = await load();
    await this.db.query(
      "INSERT INTO geo_cache(kind,key_hash,locale,response) VALUES($1,$2,$3,$4) ON CONFLICT (kind,key_hash,locale) DO UPDATE SET response=EXCLUDED.response, created_at=now()",
      [kind, hash, locale, JSON.stringify(value)],
    );
    return value;
  }

  private nominatim<T>(path: string): Promise<T> {
    const run = async () => {
      const wait = this.last + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.last = Date.now();
      try {
        const res = await fetch(`${geocoderUrl()}${path}`, {
          headers: { "User-Agent": userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as T;
      } catch (e) {
        // El error de terceros no se reenvía: se registra y se responde uno propio (§22)
        this.logger.warn(`Geocodificador no disponible: ${(e as Error).message}`);
        throw unavailable();
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }
}

/** Búsqueda en el mapa. Sin sesión: la usa también la búsqueda pública de proveedores. */
@Controller("geo")
export class GeoController {
  constructor(private geo: GeoService) {}
  @Get("search") async search(@Req() req: FastifyRequest, @Query() query: unknown) {
    const { q } = parse(geoSearchSchema, query, req, 400);
    limits.geoIp.hit(ipKey("geo", req));
    return this.geo.search(q, requestLocale(req));
  }
  @Get("reverse") async reverse(@Req() req: FastifyRequest, @Query() query: unknown) {
    const point = parse(geoReverseSchema, query, req, 400);
    limits.geoIp.hit(ipKey("geo", req));
    return { place: await this.geo.reverse(point, requestLocale(req)) };
  }
  @Post("parse-link") @HttpCode(200) async parseLink(@Req() req: FastifyRequest, @Body() body: unknown) {
    const { url } = parse(geoLinkSchema, body, req);
    limits.geoLinkIp.hit(ipKey("geo-link", req));
    return this.geo.parseLink(url);
  }
}
