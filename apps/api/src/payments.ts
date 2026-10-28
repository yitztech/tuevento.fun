import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { guestTiers, type Locale, type TierIndex, translate, upgradeCents } from "@tuevento/contracts";
import { Database } from "./database";
import { Updates } from "./events";
import { paidTierSql, paymentsEnabled, secretKey, stripeApiUrl, webhookSecret } from "./payment-config";

/**
 * Pago único por evento con Stripe Checkout: la API crea la sesión y el organizador paga en la
 * página de Stripe; el pago solo cuenta cuando llega el webhook firmado (nunca por la vuelta del
 * navegador). Sin STRIPE_SECRET_KEY los pagos están apagados y nada se limita por ellos. En las
 * pruebas, STRIPE_API_URL apunta al doble (services/payments-fake).
 */
/** Antigüedad máxima de un webhook: evita que se repita uno capturado (la que usa Stripe). */
const SIGNATURE_TOLERANCE_S = 300;

/** Comprueba la cabecera Stripe-Signature (`t=…,v1=…`): HMAC-SHA256 de `t.cuerpo` con la clave del webhook. */
export function validStripeSignature(raw: string, header: string, secret: string, nowMs = Date.now()) {
  const parts = header.split(",").map((p) => p.split("=", 2) as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  if (!Number.isInteger(t) || Math.abs(nowMs / 1000 - t) > SIGNATURE_TOLERANCE_S) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest();
  return parts
    .filter(([k, v]) => k === "v1" && /^[0-9a-f]{64}$/.test(v ?? ""))
    .some(([, v]) => timingSafeEqual(expected, Buffer.from(v, "hex")));
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private db: Database,
    private updates: Updates,
  ) {}

  /**
   * Abre el pago del tramo `tier` para un evento del organizador y devuelve la URL de Stripe. Si el
   * evento ya pagó un tramo menor, se cobra solo la diferencia.
   */
  async checkout(userId: string, eventId: string, tier: TierIndex, locale: Locale, site: string) {
    if (!paymentsEnabled()) throw new NotFoundException("errors.paymentsUnavailable");
    const [event] = await this.db.query(
      `SELECT e.id, e.title, u.email, u.is_demo, ${paidTierSql} AS paid_tier,
         (SELECT count(*) FROM members m JOIN invitations i ON i.id=m.invitation_id WHERE i.event_id=e.id)::int AS people
       FROM events e JOIN users u ON u.id=e.user_id WHERE e.id=$1 AND e.user_id=$2`,
      [eventId, userId],
    );
    if (!event) throw new NotFoundException("errors.couldntFindEvent");
    // La demostración se borra sola: no se cobra por sus eventos
    if (event.is_demo) throw new ConflictException("errors.paymentDemo");
    const paid = event.paid_tier as TierIndex | null;
    if (paid !== null && tier <= paid) throw new ConflictException("errors.paymentTierAlreadyPaid");
    const max = guestTiers[tier].maxGuests;
    if (max !== null && event.people > max)
      throw new ConflictException("errors.paymentTierTooSmall");
    const id = randomUUID();
    const cents = upgradeCents(paid, tier);
    await this.db.query(
      "INSERT INTO event_payments(id,event_id,user_id,tier,amount_cents,currency) VALUES($1,$2,$3,$4,$5,'usd')",
      [id, eventId, userId, tier, cents],
    );
    const back = `${site}/pago?evento=${eventId}`;
    const form = new URLSearchParams({
      mode: "payment",
      client_reference_id: id,
      customer_email: event.email,
      locale,
      success_url: `${back}&pagado=1`,
      cancel_url: back,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(cents),
      // El título lo escribe el organizador: es su contenido, no se traduce
      "line_items[0][price_data][product_data][name]": event.title.slice(0, 250),
      "line_items[0][price_data][product_data][description]":
        max !== null
          ? translate(locale, "pricing.upTo", { guests: max })
          : translate(locale, "pricing.moreThan", { guests: Number(guestTiers[tier - 1].maxGuests) }),
      "metadata[payment_id]": id,
      "metadata[event_id]": eventId,
      "metadata[tier]": String(tier),
    });
    let session: { id?: string; url?: string };
    try {
      const response = await fetch(`${stripeApiUrl()}/v1/checkout/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey()}`,
          "Content-Type": "application/x-www-form-urlencoded",
          // Un reintento con la misma clave no crea otra sesión (§21)
          "Idempotency-Key": id,
        },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      session = await response.json();
      if (!response.ok || !session.id || !session.url) throw new Error(`Stripe respondió ${response.status}`);
    } catch (e) {
      this.logger.error(`No se pudo abrir el pago ${id}: ${(e as Error).message}`);
      throw new ServiceUnavailableException("errors.paymentProviderUnavailable");
    }
    await this.db.query("UPDATE event_payments SET checkout_id=$1, updated_at=now() WHERE id=$2", [session.id, id]);
    return { url: session.url };
  }

  /** Webhook de Stripe: firma comprobada e idempotente (un pago ya confirmado no cambia). */
  async webhook(raw: string | undefined, signature: string | undefined) {
    if (!paymentsEnabled()) throw new NotFoundException("errors.paymentsUnavailable");
    if (!raw || !signature || !validStripeSignature(raw, signature, webhookSecret()))
      throw new BadRequestException("errors.paymentSignatureInvalid");
    const event = JSON.parse(raw) as {
      type?: string;
      data?: { object?: { id?: string; client_reference_id?: string; payment_status?: string; amount_total?: number; currency?: string } };
    };
    const session = event.data?.object;
    const completed = ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type ?? "");
    if (!completed || session?.payment_status !== "paid") return { received: true };
    // El importe y la sesión tienen que ser los que abrió la API: no se acepta otro pago
    const [row] = await this.db.query(
      `UPDATE event_payments SET status='paid', paid_at=now(), updated_at=now()
       WHERE id::text=$1 AND checkout_id=$2 AND amount_cents=$3 AND currency=$4 AND status='pending'
       RETURNING event_id, user_id`,
      [session.client_reference_id ?? "", session.id ?? "", session.amount_total ?? -1, session.currency ?? ""],
    );
    if (row?.user_id) this.updates.emit(row.user_id);
    return { received: true };
  }
}
