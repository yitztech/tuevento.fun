import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { verifyPassword } from "./password.mjs";

const SESSION_MS = 12 * 60 * 60 * 1000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const digest = (value) => createHash("sha256").update(String(value ?? "")).digest();
const sameText = (a, b) => timingSafeEqual(digest(a), digest(b));

/**
 * Un único administrador: usuario y hash de contraseña vienen del entorno.
 * Las sesiones viven en memoria (se pierden al reiniciar el contenedor) y solo se guarda
 * el hash del token; los intentos fallidos se cuentan por IP con una ventana de 15 minutos.
 */
export function createAuth({ username, passwordHash, maxFailures = 10, now = () => Date.now() }) {
  const sessions = new Map();
  const failures = new Map();

  const blocked = (ip) => {
    const entry = failures.get(ip);
    if (!entry) return false;
    if (now() - entry.since > FAILURE_WINDOW_MS) {
      failures.delete(ip);
      return false;
    }
    return entry.count >= maxFailures;
  };

  const recordFailure = (ip) => {
    const entry = failures.get(ip);
    if (!entry || now() - entry.since > FAILURE_WINDOW_MS) failures.set(ip, { count: 1, since: now() });
    else entry.count += 1;
  };

  return {
    /** Devuelve { token } o { error }: "blocked" tras demasiados fallos, "invalid" si no coincide. */
    async login(ip, user, password) {
      if (blocked(ip)) return { error: "blocked" };
      // Se verifica siempre la contraseña, aunque el usuario no coincida: tarda lo mismo.
      const userOk = sameText(user, username);
      const passwordOk = await verifyPassword(String(password ?? ""), passwordHash);
      if (!userOk || !passwordOk) {
        recordFailure(ip);
        return { error: "invalid" };
      }
      failures.delete(ip);
      const token = randomBytes(32).toString("base64url");
      sessions.set(digest(token).toString("hex"), now() + SESSION_MS);
      return { token };
    },
    valid(token) {
      if (!token) return false;
      const key = digest(token).toString("hex");
      const expires = sessions.get(key);
      if (!expires) return false;
      if (expires < now()) {
        sessions.delete(key);
        return false;
      }
      return true;
    },
    logout(token) {
      if (token) sessions.delete(digest(token).toString("hex"));
    },
    SESSION_MS,
  };
}
