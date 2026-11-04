/**
 * Precio del servicio por evento, según el número de invitados. Un pago único por
 * evento, en dólares (USD), sin suscripción. El precio público vive en `/precios`.
 */
export const guestTiers = [
  { maxGuests: 50, usd: 5 },
  { maxGuests: 100, usd: 10 },
  { maxGuests: 150, usd: 20 },
  // Más de 150 invitados: sin límite superior
  { maxGuests: null, usd: 30 },
] as const;

export type GuestTier = (typeof guestTiers)[number];

/** Tramo que corresponde a un evento con `guests` invitados. */
export function tierForGuests(guests: number): GuestTier {
  if (!Number.isInteger(guests) || guests < 0)
    throw new RangeError("El número de invitados debe ser un entero mayor o igual que 0");
  return guestTiers.find((tier) => tier.maxGuests === null || guests <= tier.maxGuests)!;
}

/**
 * Máximo de invitados que cubre un tramo pagado (null: sin límite). Al añadir invitados a
 * un evento, el total no puede superar el máximo del tramo que el evento ha pagado.
 */
export function guestLimitFor(paid: GuestTier): number | null {
  return paid.maxGuests;
}

/** ¿Caben `toAdd` invitados más en un evento que tiene `current` y ha pagado el tramo `paid`? */
export function canAddGuests(current: number, toAdd: number, paid: GuestTier): boolean {
  if (!Number.isInteger(toAdd) || toAdd < 0)
    throw new RangeError("Los invitados a añadir deben ser un entero mayor o igual que 0");
  const limit = guestLimitFor(paid);
  return limit === null || current + toAdd <= limit;
}

/** Posición de un tramo en `guestTiers` (0 = hasta 50…): es lo que guarda y envía la API. */
export type TierIndex = 0 | 1 | 2 | 3;

/**
 * Centavos de dólar que cuesta pasar al tramo `tier` desde el ya pagado (`paid`, o null si el
 * evento no ha pagado): solo la diferencia. 0 si el tramo no es mayor que el pagado.
 */
export function upgradeCents(paid: TierIndex | null, tier: TierIndex): number {
  const already = paid === null ? 0 : guestTiers[paid].usd;
  return Math.max(0, (guestTiers[tier].usd - already) * 100);
}

/**
 * Menor cobro con tarjeta: Stripe rechaza importes por debajo de su mínimo, que depende de la moneda
 * en la que liquida la cuenta (0.50 USD o 10 MXN). Un dólar cabe en cualquiera de ellas.
 */
export const MIN_CHARGE_CENTS = 100;

/** Lo que descuenta un cupón: un porcentaje o una cantidad en centavos, nunca los dos. */
export type CouponDiscount = { percentOff: number | null; amountOffCents: number | null };

/**
 * Centavos que se cobran por `cents` con un cupón. 0 significa gratis: ese pago no pasa por Stripe.
 * Un resultado por debajo del mínimo se sube al mínimo, sin pasar nunca del precio sin cupón.
 */
export function discountedCents(cents: number, { percentOff, amountOffCents }: CouponDiscount): number {
  const off = percentOff !== null ? Math.round((cents * percentOff) / 100) : (amountOffCents ?? 0);
  const final = Math.max(0, cents - off);
  return final > 0 && final < MIN_CHARGE_CENTS ? Math.min(cents, MIN_CHARGE_CENTS) : final;
}
