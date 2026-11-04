// Validación de los cupones que crea el panel. La base de datos repite estas reglas (migración 032).
const CODE = /^[A-Z0-9-]{3,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Solo el formato que envía el panel: un año de 4 cifras que PostgreSQL siempre entiende
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

const invalid = () => ({ status: 422 });
const inRange = (value, max) => Number.isInteger(value) && value >= 1 && value <= max;

/** El cuerpo, si es un objeto solo con los campos conocidos (AGENTS.md §23), o lanza 422. */
function known(body, fields) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw invalid();
  if (Object.keys(body).some((key) => !fields.includes(key))) throw invalid();
  return body;
}

/** Datos de un cupón nuevo, o lanza 422: un porcentaje o una cantidad, nunca los dos. */
export function parseCoupon(input) {
  const body = known(input, ["code", "percentOff", "amountOffCents", "maxRedemptions", "expiresAt"]);
  const code = String(body.code ?? "").trim().toUpperCase();
  const percentOff = body.percentOff ?? null;
  const amountOffCents = body.amountOffCents ?? null;
  const maxRedemptions = body.maxRedemptions ?? null;
  const expiresAt = body.expiresAt ?? null;
  if (!CODE.test(code)) throw invalid();
  if ((percentOff === null) === (amountOffCents === null)) throw invalid();
  if (percentOff !== null && !inRange(percentOff, 100)) throw invalid();
  if (amountOffCents !== null && !inRange(amountOffCents, 100_000)) throw invalid();
  if (maxRedemptions !== null && !inRange(maxRedemptions, 100_000)) throw invalid();
  if (expiresAt !== null && !(INSTANT.test(expiresAt) && Date.parse(expiresAt) > Date.now())) throw invalid();
  return { code, percentOff, amountOffCents, expiresAt: expiresAt && new Date(expiresAt).toISOString(), maxRedemptions };
}

/** Cupón que se activa o desactiva, o lanza 422. */
export function parseCouponState(input) {
  const body = known(input, ["id", "active"]);
  if (!UUID.test(String(body.id ?? "")) || typeof body.active !== "boolean") throw invalid();
  return { id: body.id, active: body.active };
}
