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

/**
 * Freno progresivo por cuenta (OWASP, «account lockout»): no bloquea a la primera, sino que hace
 * esperar cada vez más entre fallos (1 s, 2 s, 4 s… hasta `maxDelayMs`). Solo con `lockAfter`
 * fallos en la ventana se cierra del todo, como freno de emergencia. Así, quien solo conoce el
 * correo de alguien no puede dejarlo fuera con cinco intentos.
 */
export class Backoff {
  private entries = new Map<string, { failures: number; reset: number; next: number }>();
  constructor(
    readonly free: number,
    readonly maxDelayMs: number,
    readonly lockAfter: number,
    readonly windowMs: number,
  ) {}

  /** Lanza 429 con `Retry-After` si la clave aún debe esperar o está cerrada. */
  check(key: string, now = Date.now()) {
    const entry = this.live(key, now);
    if (!entry) return;
    if (entry.failures >= this.lockAfter) throw tooManyRequests((entry.reset - now) / 1000);
    if (entry.next > now) throw tooManyRequests((entry.next - now) / 1000);
  }

  /** Cuenta un fallo. Devuelve true justo cuando la clave pasa a estar cerrada. */
  fail(key: string, now = Date.now()) {
    let entry = this.live(key, now);
    if (!entry) {
      if (this.entries.size > 10_000)
        for (const [k, e] of this.entries) if (e.reset <= now) this.entries.delete(k);
      entry = { failures: 0, reset: now + this.windowMs, next: 0 };
      this.entries.set(key, entry);
    }
    entry.failures++;
    if (entry.failures >= this.free)
      entry.next = now + Math.min(this.maxDelayMs, 1000 * 2 ** (entry.failures - this.free));
    return entry.failures === this.lockAfter;
  }

  reset(key: string) {
    this.entries.delete(key);
  }

  private live(key: string, now: number) {
    const entry = this.entries.get(key);
    if (entry && entry.reset <= now) {
      this.entries.delete(key);
      return undefined;
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
  /**
   * Inicio de sesión: intentos por IP; fallos por cuenta desde cada IP (el límite estricto); freno
   * progresivo por cuenta desde cualquier IP; y fallos desde un dispositivo de confianza, que no
   * pasa por el freno de la cuenta.
   */
  loginIp: new RateLimit(perIp(30), minutes(15)),
  loginAccountIp: new RateLimit(5, minutes(15)),
  loginAccount: new Backoff(5, 60_000, 50, minutes(60)),
  loginDevice: new RateLimit(5, minutes(15)),
  /** Registro de cuentas por IP. */
  register: new RateLimit(perIp(10), minutes(60)),
  /** Reenvíos del correo para confirmar la cuenta, por cuenta. */
  verifyEmail: new RateLimit(3, minutes(60)),
  /** Abrir pagos por organizador: cada intento crea una sesión en Stripe. */
  checkout: new RateLimit(20, minutes(15)),
  /** Recuperación de contraseña: por IP y por correo (este último sin revelar si la cuenta existe). */
  resetIp: new RateLimit(Number(process.env.RESET_MAX_PER_IP) || perIp(10), minutes(15)),
  resetAccount: new RateLimit(3, minutes(15)),
  /** Formularios públicos: newsletter (por IP y por correo), respuestas y registros de invitados, contraseña de página pública. */
  newsletterIp: new RateLimit(perIp(10), minutes(60)),
  newsletterEmail: new RateLimit(3, minutes(60)),
  publicForm: new RateLimit(perIp(60), minutes(15)),
  unlockIp: new RateLimit(perIp(20), minutes(15)),
  /** Fallos con la contraseña de una página pública desde cada IP. */
  unlockEventIp: new RateLimit(10, minutes(15)),
  /** Accesos a la landing desde enlaces personales: cada uno crea una fila en event_access. */
  landingAccessIp: new RateLimit(perIp(60), minutes(15)),
  /** Búsquedas en el mapa (Nominatim) con sesión y sin ella, y enlaces de mapas pegados. */
  geoIp: new RateLimit(perIp(20), minutes(1)),
  geoAnonymousIp: new RateLimit(perIp(6), minutes(1)),
  geoLinkIp: new RateLimit(perIp(10), minutes(1)),
};

export const ipKey = (scope: string, req: FastifyRequest) => `${scope}:ip:${req.ip}`;
