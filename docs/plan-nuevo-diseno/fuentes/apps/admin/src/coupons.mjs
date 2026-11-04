// Validación de los cupones que crea el panel. La base de datos repite estas reglas (migración 032).
const CODE = /^[A-Z0-9-]{3,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = () => ({ status: 422 });
const inRange = (value, max) => Number.isInteger(value) && value >= 1 && value <= max;

/** Datos de un cupón nuevo, o lanza 422: un porcentaje o una cantidad, nunca los dos. */
export function parseCoupon(body) {
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
  if (expiresAt !== null && !(typeof expiresAt === "string" && Date.parse(expiresAt) > Date.now())) throw invalid();
  return { code, percentOff, amountOffCents, expiresAt, maxRedemptions };
}

/** Cupón que se activa o desactiva, o lanza 422. */
export function parseCouponState(body) {
  if (!UUID.test(String(body.id ?? "")) || typeof body.active !== "boolean") throw invalid();
  return { id: body.id, active: body.active };
}
