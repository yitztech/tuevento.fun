import { ProblemException } from "./problem";

/** Un cursor más antiguo puede haber perdido tombstones ya purgados (migración 028). */
const CURSOR_MAX_AGE_DAYS = 90;
/** Sin cursor: todo, desde antes del primer número (el perfil de proveedor anterior a la 028 tiene 0). */
export const START = -1;

export type Cursor = { seq: number; issuedAt: number };

/**
 * Un cursor caduca si tiene más de 90 días o si es anterior a la última purga de tombstones en
 * número **y** en fecha. Uno emitido después de la purga (p. ej. a mitad de una descarga completa)
 * vale aunque su número sea menor: quien lo tiene no conocía lo que se purgó.
 */
export function cursorExpired(
  cursor: Cursor,
  clock: { purgedSeq: number; purgedAt: Date | null } | undefined,
  now = Date.now(),
): boolean {
  if (now - cursor.issuedAt > CURSOR_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return true;
  if (!clock?.purgedAt || clock.purgedSeq <= 0) return false;
  // El cursor guarda segundos: se compara con la purga redondeada hacia abajo
  return cursor.seq < clock.purgedSeq && cursor.issuedAt < Math.floor(clock.purgedAt.getTime() / 1000) * 1000;
}

const invalidCursor = () =>
  new ProblemException({ status: 400, code: "invalid_sync_cursor", detail: "errors.invalidSyncCursor" });
export const cursorExpiredError = () =>
  new ProblemException({ status: 410, code: "sync_cursor_expired", detail: "errors.syncCursorExpired" });

/** Cursor opaco: base64url de `{v, s, t}` (versión, número del reloj de la cuenta y segundos de emisión). */
export function encodeCursor(seq: number, issuedAt = Date.now()): string {
  return Buffer.from(JSON.stringify({ v: 1, s: seq, t: Math.floor(issuedAt / 1000) })).toString("base64url");
}

export function decodeCursor(text: string): Cursor {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    throw invalidCursor();
  }
  const { v, s, t } = (value ?? {}) as { v?: unknown; s?: unknown; t?: unknown };
  if (v !== 1 || !Number.isSafeInteger(s) || (s as number) < START || !Number.isSafeInteger(t) || (t as number) < 0)
    throw invalidCursor();
  return { seq: s as number, issuedAt: (t as number) * 1000 };
}

