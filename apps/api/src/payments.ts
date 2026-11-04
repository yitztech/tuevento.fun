import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { discountedCents, guestTiers, type Locale, type TierIndex, translate, upgradeCents } from "@tuevento/contracts";
import { isUniqueViolation } from "./auth";
import { Database } from "./database";
import { Updates } from "./events";
import { CHECKOUT_MINUTES, paidTierSql, paymentsEnabled, stripeApiUrl, stripeHeaders, stripeLocale, webhookSecret } from "./payment-config";
import { ProblemException } from "./problem";

/**
 * Pago único por evento con Stripe Checkout: la API crea la sesión y el organizador paga en la
 * página de Stripe; el pago solo cuenta cuando llega el webhook firmado (nunca por la vuelta del
 * navegador). Sin STRIPE_SECRET_KEY los pagos están apagados y nada se limita por ellos. En las
 * pruebas, STRIPE_API_URL apunta al doble (services/payments-fake).
 *
 * Los cupones son propios: la API calcula el importe y Stripe cobra ese importe. Mientras el pago
 * está pendiente, su fila de coupon_redemptions reserva el uso; si el pago se cancela, se libera.
 */
/** Antigüedad máxima de un webhook: evita que se repita uno capturado (la que usa Stripe). */
const SIGNATURE_TOLERANCE_S = 300;

/** Una reserva cuenta mientras su sesión puede seguir abierta, con margen por si el webhook se retrasa. */
const RESERVATION_MINUTES = CHECKOUT_MINUTES + 4;

/** La misma respuesta si el cupón no existe, caducó, se agotó o ya se usó: no da pistas a quien adivina. */
const couponInvalid = () => new ProblemException({ status: 422, code: "coupon_invalid", detail: "errors.couponInvalid" });

/** Ejecuta una consulta y devuelve sus filas: con el pool o dentro de una transacción. */
type Rows = (sql: string, params: unknown[]) => Promise<Record<string, any>[]>;

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
   * evento ya pagó un tramo menor, se cobra solo la diferencia. Un cupón descuenta sobre ese importe;
   * si lo cubre todo, el pago queda confirmado sin pasar por Stripe (`url: null`, `paid: true`).
   * Cada evento tiene un solo intento abierto: el nuevo cierra los anteriores, para no cobrar dos veces.
   */
  async checkout(userId: string, eventId: string, tier: TierIndex, locale: Locale, site: string, coupon?: string) {
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
    const full = upgradeCents(paid, tier);
    // Con un cupón que no vale no se toca nada: el intento abierto sigue pudiéndose pagar
    if (coupon) await this.checkCoupon(userId, coupon);
    await this.releasePending(userId, eventId, coupon);
    const cents = coupon
      ? await this.reservePayment(id, eventId, userId, tier, full, coupon)
      : full;
    if (!coupon)
      await this.db.query(
        "INSERT INTO event_payments(id,event_id,user_id,tier,amount_cents,currency) VALUES($1,$2,$3,$4,$5,'usd')",
        [id, eventId, userId, tier, cents],
      );
    if (cents === 0) {
      this.updates.emit(userId);
      return { url: null, paid: true };
    }
    const back = `${site}/pago?evento=${eventId}`;
    const form = new URLSearchParams({
      mode: "payment",
      client_reference_id: id,
      customer_email: event.email,
      locale: stripeLocale(locale),
      expires_at: String(Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60),
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
      ...(coupon ? { "metadata[coupon]": coupon } : {}),
    });
    let session: { id?: string; url?: string };
    try {
      const response = await fetch(`${stripeApiUrl()}/v1/checkout/sessions`, {
        method: "POST",
        headers: {
          ...stripeHeaders(),
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
      await this.cancelPayment(id);
      throw new ServiceUnavailableException("errors.paymentProviderUnavailable");
    }
    const [open] = await this.db.query(
      "UPDATE event_payments SET checkout_id=$1, updated_at=now() WHERE id=$2 AND status='pending' RETURNING id",
      [session.id, id],
    );
    if (!open) {
      // Otra petición sustituyó este intento mientras Stripe abría la sesión: nadie debe poder pagarla
      await this.expireSession(session.id!);
      throw new ConflictException("errors.paymentInProgress");
    }
    return { url: session.url, paid: false };
  }

  /** Lo que descuenta un cupón, si esta cuenta aún puede usarlo. */
  async checkCoupon(userId: string, code: string) {
    if (!paymentsEnabled()) throw new NotFoundException("errors.paymentsUnavailable");
    const coupon = await this.usableCoupon((sql, params) => this.db.query(sql, params), code, userId);
    return { code: coupon.code, percentOff: coupon.percentOff, amountOffCents: coupon.amountOffCents };
  }

  /**
   * Cupón activo que le queda algún uso y que esta cuenta no ha gastado. Las reservas propias no
   * cuentan: el mismo organizador puede volver a intentarlo. Con `lock`, hasta el final de la
   * transacción nadie más comprueba el mismo cupón: dos pagos no se llevan el último uso.
   */
  private async usableCoupon(rows: Rows, code: string, userId: string, lock = false) {
    const [coupon] = await rows(
      `SELECT id, code, percent_off::int AS "percentOff", amount_off_cents::int AS "amountOffCents",
         max_redemptions::int AS "maxRedemptions"
       FROM coupons WHERE code=$1 AND active AND (expires_at IS NULL OR expires_at > now())${lock ? " FOR UPDATE" : ""}`,
      [code],
    );
    if (!coupon) throw couponInvalid();
    const [uses] = await rows(
      `SELECT count(*) FILTER (WHERE r.user_id=$2 AND p.status='paid')::int AS mine,
         count(*) FILTER (WHERE p.status='paid'
           OR (r.user_id IS DISTINCT FROM $2 AND p.created_at > now() - make_interval(mins => $3::int)))::int AS taken
       FROM coupon_redemptions r JOIN event_payments p ON p.id=r.payment_id WHERE r.coupon_id=$1`,
      [coupon.id, userId, RESERVATION_MINUTES],
    );
    if (uses?.mine || (coupon.maxRedemptions !== null && uses!.taken >= coupon.maxRedemptions)) throw couponInvalid();
    return coupon as { id: string; code: string; percentOff: number | null; amountOffCents: number | null; maxRedemptions: number | null };
  }

  /** Crea el pago con su cupón y devuelve lo que se cobra. Si es 0, el pago nace confirmado. */
  private async reservePayment(id: string, eventId: string, userId: string, tier: TierIndex, full: number, code: string) {
    try {
      return await this.db.transaction(async (client) => {
        const rows: Rows = async (sql, params) => (await client.query(sql, params)).rows;
        const coupon = await this.usableCoupon(rows, code, userId, true);
        const cents = discountedCents(full, coupon);
        await client.query(
          `INSERT INTO event_payments(id,event_id,user_id,tier,amount_cents,currency,status,paid_at)
           VALUES($1,$2,$3,$4,$5,'usd',$6,$7)`,
          [id, eventId, userId, tier, cents, cents === 0 ? "paid" : "pending", cents === 0 ? new Date() : null],
        );
        await client.query(
          "INSERT INTO coupon_redemptions(payment_id,coupon_id,user_id,discount_cents) VALUES($1,$2,$3,$4)",
          [id, coupon.id, userId, full - cents],
        );
        return cents;
      });
    } catch (e) {
      // Otra petición de la misma cuenta ganó la carrera por este cupón
      if (isUniqueViolation(e)) throw couponInvalid();
      throw e;
    }
  }

  /** El intento nuevo sustituye a los pendientes del evento y a la reserva de su cupón: esas sesiones dejan de poder pagarse. */
  private async releasePending(userId: string, eventId: string, code?: string) {
    const pending = await this.db.query(
      `SELECT p.id, p.checkout_id FROM event_payments p
       LEFT JOIN coupon_redemptions r ON r.payment_id=p.id
       LEFT JOIN coupons c ON c.id=r.coupon_id
       WHERE p.status='pending' AND (p.event_id=$1 OR (c.code=$2 AND r.user_id=$3))`,
      [eventId, code ?? null, userId],
    );
    for (const payment of pending) {
      if (payment.checkout_id) await this.expireSession(payment.checkout_id);
      await this.cancelPayment(payment.id);
    }
  }

  /** Caduca una sesión abierta. Si ya se completó, ese pago sigue en curso: 409. Si no se sabe, 503. */
  private async expireSession(checkoutId: string) {
    const url = `${stripeApiUrl()}/v1/checkout/sessions/${encodeURIComponent(checkoutId)}`;
    try {
      const expired = await fetch(`${url}/expire`, { method: "POST", headers: stripeHeaders(), signal: AbortSignal.timeout(30_000) });
      if (expired.ok) return;
      const response = await fetch(url, { headers: stripeHeaders(), signal: AbortSignal.timeout(30_000) });
      // Stripe ya no la conoce (p. ej. se cambiaron las claves): nadie puede pagarla
      if (response.status === 404) return;
      if (!response.ok) throw new Error(`Stripe respondió ${response.status}`);
      const { status } = (await response.json()) as { status?: string };
      if (status === "expired") return;
      if (status !== "complete") throw new Error(`La sesión sigue en estado ${status}`);
    } catch (e) {
      this.logger.error(`No se pudo caducar la sesión ${checkoutId}: ${(e as Error).message}`);
      throw new ServiceUnavailableException("errors.paymentProviderUnavailable");
    }
    throw new ConflictException("errors.paymentInProgress");
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
    // Sesión caducada o pago diferido rechazado: ese intento ya no se cobrará
    if (["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type ?? "")) {
      await this.cancelPayment(session?.client_reference_id ?? "", session?.id ?? "");
      return { received: true };
    }
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
    if (!row) await this.reportUnmatched(session?.client_reference_id ?? "", session?.id ?? "");
    return { received: true };
  }

  /** Stripe cobró una sesión que no corresponde a un pago abierto: hay que revisarla a mano. Un webhook repetido no avisa. */
  private async reportUnmatched(paymentId: string, checkoutId: string) {
    const [paid] = await this.db.query("SELECT 1 FROM event_payments WHERE id::text=$1 AND checkout_id=$2 AND status='paid'", [paymentId, checkoutId]);
    if (!paid) this.logger.error(`Stripe cobró la sesión ${checkoutId}, que no coincide con ningún pago abierto`);
  }

  /** Cierra un pago pendiente que ya no se cobrará y libera su cupón. Un pago confirmado no cambia. */
  private async cancelPayment(paymentId: string, checkoutId: string | null = null) {
    await this.db.query(
      `WITH closed AS (
         UPDATE event_payments SET status='canceled', updated_at=now()
         WHERE id::text=$1 AND ($2::text IS NULL OR checkout_id=$2) AND status='pending' RETURNING id
       )
       DELETE FROM coupon_redemptions r USING closed WHERE r.payment_id=closed.id`,
      [paymentId, checkoutId],
    );
  }
}
