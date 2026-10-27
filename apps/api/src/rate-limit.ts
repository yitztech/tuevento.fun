import type { FastifyRequest } from "fastify";
import { tooManyRequests } from "./problem";

/**
 * Límite de intentos por ventana fija, en memoria (la API corre en un solo proceso). Cada clave
 * («login:ip:…», «login:account:…») cuenta por separado; pasado el máximo responde 429 con
 * `Retry-After` (AGENTS.md §24).
 */
export class RateLimit {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(
    readonly max: number,
    readonly windowMs: number,
  ) {}

  /** Cuenta un intento y lanza 429 si la clave ya pasó del máximo. */
  hit(key: string, now = Date.now()) {
    const entry = this.current(key, now);
    entry.count++;
    if (entry.count > this.max) throw tooManyRequests((entry.reset - now) / 1000);
  }

  /** Como `hit`, pero sin contar: para bloquear antes de comprobar una contraseña. */
  check(key: string, now = Date.now()) {
    const entry = this.hits.get(key);
    if (entry && entry.reset > now && entry.count >= this.max)
      throw tooManyRequests((entry.reset - now) / 1000);
  }

  /** Cuenta sin lanzar; devuelve si aún está dentro del límite. */
  allow(key: string, now = Date.now()) {
    const entry = this.current(key, now);
    return ++entry.count <= this.max;
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private current(key: string, now: number) {
    if (this.hits.size > 10_000)
      for (const [k, entry] of this.hits) if (entry.reset <= now) this.hits.delete(k);
    let entry = this.hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + this.windowMs };
      this.hits.set(key, entry);
    }
    return entry;
  }
}

const minutes = (n: number) => n * 60 * 1000;
/**
 * Máximo por IP de los formularios públicos. Las suites de pruebas lanzan cientos de peticiones
 * desde la misma IP: compose.yml y compose.ci.yml lo suben con PUBLIC_RATE_LIMIT_PER_IP. Los
 * límites por cuenta o por correo no cambian, y las pruebas los ejercitan.
 */
const perIp = (production: number) => Number(process.env.PUBLIC_RATE_LIMIT_PER_IP) || production;

export const limits = {
  /** Inicio de sesión: intentos por IP y fallos por cuenta. */
  loginIp: new RateLimit(perIp(30), minutes(15)),
  loginAccount: new RateLimit(5, minutes(15)),
  /** Registro de cuentas por IP. */
  register: new RateLimit(perIp(10), minutes(60)),
  /** Recuperación de contraseña: por IP y por correo (este último sin revelar si la cuenta existe). */
  resetIp: new RateLimit(Number(process.env.RESET_MAX_PER_IP) || perIp(10), minutes(15)),
  resetAccount: new RateLimit(3, minutes(15)),
  /** Formularios públicos: newsletter (por IP y por correo), respuestas y registros de invitados, contraseña de página pública. */
  newsletterIp: new RateLimit(perIp(10), minutes(60)),
  newsletterEmail: new RateLimit(3, minutes(60)),
  publicForm: new RateLimit(perIp(60), minutes(15)),
  unlockIp: new RateLimit(perIp(20), minutes(15)),
  /** Accesos a la landing desde enlaces personales: cada uno crea una fila en event_access. */
  landingAccessIp: new RateLimit(perIp(60), minutes(15)),
  /** Búsquedas en el mapa (Nominatim) y enlaces de mapas pegados. */
  geoIp: new RateLimit(perIp(20), minutes(1)),
  geoLinkIp: new RateLimit(perIp(10), minutes(1)),
};

export const ipKey = (scope: string, req: FastifyRequest) => `${scope}:ip:${req.ip}`;
