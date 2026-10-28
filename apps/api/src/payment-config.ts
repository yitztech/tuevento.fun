/**
 * Configuración de los pagos, aparte de PaymentsService para que EventsService la use sin
 * importarlo (PaymentsService depende de Updates, que vive en events.ts).
 */
export const secretKey = () => process.env.STRIPE_SECRET_KEY || "";
export const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET || "";
export const stripeApiUrl = () => (process.env.STRIPE_API_URL || "https://api.stripe.com").replace(/\/+$/, "");
export const paymentsEnabled = () => !!secretKey();

/** Con la clave de Stripe, la del webhook es obligatoria (§20): sin ella ningún pago se confirmaría. */
export function assertPaymentsConfig() {
  if (paymentsEnabled() && !webhookSecret()) throw new Error("STRIPE_WEBHOOK_SECRET is required with STRIPE_SECRET_KEY");
}

/** SQL del tramo pagado de un evento (`e` es la fila de events): el mayor de sus pagos confirmados. */
export const paidTierSql = "(SELECT max(p.tier)::int FROM event_payments p WHERE p.event_id=e.id AND p.status='paid')";
