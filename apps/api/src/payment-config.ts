import type { Locale } from "@tuevento/contracts";

/**
 * Configuración de los pagos, aparte de PaymentsService para que EventsService la use sin
 * importarlo (PaymentsService depende de Updates, que vive en events.ts).
 */
export const secretKey = () => process.env.STRIPE_SECRET_KEY || "";
export const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET || "";
export const stripeApiUrl = () => (process.env.STRIPE_API_URL || "https://api.stripe.com").replace(/\/+$/, "");
export const paymentsEnabled = () => !!secretKey();

/** Versión de la API de Stripe con la que se escribió esta integración: un cambio de la cuenta no la altera. */
export const STRIPE_VERSION = "2026-10-28.endive";
/** Cabeceras de toda petición a Stripe. */
export const stripeHeaders = () => ({ Authorization: `Bearer ${secretKey()}`, "Stripe-Version": STRIPE_VERSION });

/** Minutos que una sesión de Checkout sigue abierta: Stripe exige al menos 30 (y como máximo 24 horas). */
export const CHECKOUT_MINUTES = 31;

/** Idioma de la página de Stripe: español de América y portugués de Brasil, como la app. */
const stripeLocales: Record<Locale, string> = { es: "es-419", en: "en", pt: "pt-BR", de: "de", fr: "fr" };
export const stripeLocale = (locale: Locale) => stripeLocales[locale];

/** Con la clave de Stripe, la del webhook es obligatoria (§20): sin ella ningún pago se confirmaría. */
export function assertPaymentsConfig() {
  if (paymentsEnabled() && !webhookSecret()) throw new Error("STRIPE_WEBHOOK_SECRET is required with STRIPE_SECRET_KEY");
}

/** SQL del tramo pagado de un evento (`e` es la fila de events): el mayor de sus pagos confirmados. */
export const paidTierSql = "(SELECT max(p.tier)::int FROM event_payments p WHERE p.event_id=e.id AND p.status='paid')";
