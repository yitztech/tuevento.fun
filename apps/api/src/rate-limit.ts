import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Database } from "./database";
import { tooManyRequests } from "./problem";

/**
 * Límite de intentos por ventana fija, en memoria: para los formularios públicos, donde perder la
 * cuenta al reiniciar no abre nada (el acceso usa `SharedRateLimit`). Cada clave
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

/** Lo que necesitan los límites compartidos de la base de datos. */
type Rows = Pick<Database, "query">;
/** En la tabla va el hash de la clave: ni correos ni IP en claro. */
const stored = (key: string) => createHash("sha256").update(key).digest("hex");

/** Cuenta un intento de forma atómica, abriendo una ventana nueva si la anterior acabó. */
async function bump(db: Rows, key: string, windowMs: number) {
  const [row] = await db.query<{ count: string; wait: string }>(
    `INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+make_interval(secs => $2::double precision))
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
       next_at = CASE WHEN rate_limits.reset_at <= now() THEN NULL ELSE rate_limits.next_at END,
       reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
     RETURNING count, extract(epoch FROM reset_at - now()) AS wait`,
    [stored(key), windowMs / 1000],
  );
  return { count: Number(row.count), wait: Number(row.wait) };
}

/** Estado de una clave con la ventana abierta; undefined si no hay ninguna. */
async function read(db: Rows, key: string) {
  const [row] = await db.query<{ count: string; wait: string; pause: string | null }>(
    `SELECT count, extract(epoch FROM reset_at - now()) AS wait, extract(epoch FROM next_at - now()) AS pause
     FROM rate_limits WHERE key=$1 AND reset_at > now()`,
    [stored(key)],
  );
  return row && { count: Number(row.count), wait: Number(row.wait), pause: Number(row.pause ?? 0) };
}

const forget = (db: Rows, key: string) => db.query("DELETE FROM rate_limits WHERE key=$1", [stored(key)]);

/**
 * Como `RateLimit`, pero en PostgreSQL: el acceso (login, registro, recuperación) no se reinicia con
 * el proceso y vale igual con varios procesos. Cuesta una escritura por intento, así que se reserva
 * para el acceso; el resto de formularios sigue en memoria.
 */
export class SharedRateLimit {
  constructor(
    readonly max: number,
    readonly windowMs: number,
  ) {}

  async hit(db: Rows, key: string) {
    const { count, wait } = await bump(db, key, this.windowMs);
    if (count > this.max) throw tooManyRequests(wait);
  }

  async check(db: Rows, key: string) {
    const entry = await read(db, key);
    if (entry && entry.count >= this.max) throw tooManyRequests(entry.wait);
  }

  async allow(db: Rows, key: string) {
    return (await bump(db, key, this.windowMs)).count <= this.max;
  }

  reset(db: Rows, key: string) {
    return forget(db, key);
  }
}

/** Espera tras `failures` fallos: 0 con los fallos libres y después 1 s, 2 s, 4 s… hasta el tope. */
export const backoffDelayMs = (failures: number, free: number, maxDelayMs: number) =>
  failures < free ? 0 : Math.min(maxDelayMs, 1000 * 2 ** (failures - free));

/**
 * Freno progresivo por cuenta (OWASP, «account lockout»): no bloquea a la primera, sino que hace
 * esperar cada vez más entre fallos. Solo con `lockAfter` fallos en la ventana se cierra del todo,
 * como freno de emergencia. Así, quien solo conoce el correo de alguien no puede dejarlo fuera con
 * cinco intentos.
 */
export class SharedBackoff {
  constructor(
    readonly free: number,
    readonly maxDelayMs: number,
    readonly lockAfter: number,
    readonly windowMs: number,
  ) {}

  /** Lanza 429 con `Retry-After` si la clave aún debe esperar o está cerrada. */
  async check(db: Rows, key: string) {
    const entry = await read(db, key);
    if (!entry) return;
    if (entry.count >= this.lockAfter) throw tooManyRequests(entry.wait);
    if (entry.pause > 0) throw tooManyRequests(entry.pause);
  }

  /** Cuenta un fallo. Devuelve true justo cuando la clave pasa a estar cerrada. */
  async fail(db: Rows, key: string) {
    const { count } = await bump(db, key, this.windowMs);
    const delay = backoffDelayMs(count, this.free, this.maxDelayMs);
    if (delay)
      await db.query("UPDATE rate_limits SET next_at=now()+make_interval(secs => $2::double precision) WHERE key=$1", [
        stored(key),
        delay / 1000,
      ]);
    return count === this.lockAfter;
  }

  reset(db: Rows, key: string) {
    return forget(db, key);
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
  loginIp: new SharedRateLimit(perIp(30), minutes(15)),
  loginAccountIp: new SharedRateLimit(5, minutes(15)),
  loginAccount: new SharedBackoff(5, 60_000, 50, minutes(60)),
  loginDevice: new SharedRateLimit(5, minutes(15)),
  /** Registro de cuentas por IP. */
  register: new SharedRateLimit(perIp(10), minutes(60)),
  /** Registros con un correo ya usado, por IP: frena a quien prueba correos para ver cuáles existen. */
  registerTaken: new SharedRateLimit(perIp(5), minutes(60)),
  /** Fallos de la contraseña actual al cambiarla, por cuenta: una sesión robada no la adivina. */
  passwordChange: new SharedRateLimit(5, minutes(15)),
  /** Reenvíos del correo para confirmar la cuenta, por cuenta. */
  verifyEmail: new SharedRateLimit(3, minutes(60)),
  /** Abrir pagos por organizador: cada intento crea una sesión en Stripe. */
  checkout: new RateLimit(20, minutes(15)),
  /** Comprobar cupones por organizador: frena a quien prueba códigos al azar. */
  coupon: new RateLimit(10, minutes(15)),
  /** Recuperación de contraseña: por IP y por correo (este último sin revelar si la cuenta existe). */
  resetIp: new SharedRateLimit(Number(process.env.RESET_MAX_PER_IP) || perIp(10), minutes(15)),
  resetAccount: new SharedRateLimit(3, minutes(15)),
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
