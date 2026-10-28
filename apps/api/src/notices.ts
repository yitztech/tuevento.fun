import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  translate,
  mailPaths,
  normalizeLocale,
  statusLabels,
  type Locale,
  type Status,
} from "@tuevento/contracts";
import { Database } from "./database";
import { MailService, type MailMessage } from "./mail";
import {
  eventCancelledMail,
  eventChangedMail,
  guestReplyMail,
  ownerReplyMail,
  type Unsubscribe,
} from "./mail-templates";
import { localeEnv, siteUrl } from "./locale-env";
import { emailHash, openToken, signLink } from "./tokens";
import { paidTierSql, paymentsEnabled } from "./payment-config";

/** Fecha y hora del evento en el idioma de quien la lee y en la zona del evento. */
export function eventDateText(date: Date, timeZone: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

/** Correos al día que puede recibir una misma dirección de parte de la plataforma (avisos a invitados). */
const RECIPIENT_DAILY = 5;
/** Direcciones distintas a las que un organizador puede hacer escribir al día. */
const OWNER_DAILY_RECIPIENTS = 50;
/** Los cambios de un evento se agrupan: un aviso como mucho cada 30 minutos y 3 al día. */
const CHANGE_GAP_MINUTES = 30;
const CHANGE_BATCHES_PER_DAY = 3;
/** Cada cuánto se envían los avisos de cambios que ya tocan (las pruebas lo acortan). */
const tickMs = () => Number(process.env.NOTICE_TICK_MS) || 60_000;

type Guest = { name: string; email: string; token_sealed: string };
type EventForNotice = NonNullable<Awaited<ReturnType<NoticeService["eventFor"]>>>;

/**
 * Avisos por correo. Se envían en segundo plano: un SMTP lento o caído nunca impide guardar.
 * El idioma y el dominio son los del organizador, porque el invitado no tiene cuenta.
 *
 * Para que nadie use la plataforma para mandar spam con su remitente: solo escriben a los
 * invitados los organizadores con el correo confirmado, cada dirección recibe pocos correos al día,
 * cada organizador llega a pocas direcciones nuevas al día, quien se da de baja no recibe más y los
 * cambios de un evento se agrupan en un solo aviso.
 */
@Injectable()
export class NoticeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NoticeService.name);
  private timer?: NodeJS.Timeout;
  private flushing: Promise<void> | null = null;

  constructor(
    private db: Database,
    private mail: MailService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.flushChanges(), tickMs());
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Datos del evento, su organizador y el idioma en el que se le escribe a todos. */
  private async eventFor(eventId: string) {
    const [r] = await this.db.query(
      `SELECT e.id,e.title,e.location,e.date,e.time_zone,e.slug,e.user_id,u.email AS owner_email,u.first_name AS owner_name,u.locale,u.email_verified_at IS NOT NULL AS owner_verified, ${paidTierSql} IS NOT NULL AS paid FROM events e JOIN users u ON u.id=e.user_id WHERE e.id=$1`,
      [eventId],
    );
    if (!r) return null;
    const locale = normalizeLocale(r.locale);
    return { ...r, locale, site: siteUrl(locale), origin: localeEnv("SITE_URL", locale).replace(/\/+$/, "") };
  }

  private send(locale: Locale, message: MailMessage) {
    this.mail
      .send(locale, message)
      .catch((e: Error) => this.logger.error(`No se pudo enviar un aviso: ${e.message}`));
  }

  /**
   * Correo a un invitado si cabe en los cupos: el organizador tiene el correo confirmado, la
   * dirección no se dio de baja, no pasó de sus correos del día y el organizador no pasó de sus
   * direcciones del día. Lo enviado queda contado.
   */
  private async sendToGuest(
    event: EventForNotice,
    kind: "event_changed" | "event_cancelled" | "guest_reply",
    email: string,
    build: (unsubscribe: Unsubscribe) => MailMessage,
  ) {
    // Correo confirmado y, con los pagos activos, evento pagado: el plan gratuito no escribe a invitados
    if (!event.owner_verified || (paymentsEnabled() && !event.paid)) return;
    const recipient = emailHash(email);
    const [r] = await this.db.query(
      `SELECT
         EXISTS(SELECT 1 FROM mail_suppressions WHERE email_hash=$1) AS suppressed,
         (SELECT count(*) FROM mail_sends WHERE recipient_hash=$1 AND created_at > now() - interval '1 day')::int AS recipient,
         (SELECT count(DISTINCT recipient_hash) FROM mail_sends WHERE owner_id=$2 AND created_at > now() - interval '1 day')::int AS owner,
         EXISTS(SELECT 1 FROM mail_sends WHERE owner_id=$2 AND recipient_hash=$1 AND created_at > now() - interval '1 day') AS known`,
      [recipient, event.user_id],
    );
    if (r.suppressed) return;
    if (r.recipient >= RECIPIENT_DAILY || (!r.known && r.owner >= OWNER_DAILY_RECIPIENTS)) {
      this.logger.warn(`Aviso a un invitado sin enviar: cupo diario agotado (evento ${event.id}, ${kind})`);
      return;
    }
    await this.db.query(
      "INSERT INTO mail_sends(id,owner_id,event_id,recipient_hash,kind) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), event.user_id, event.id, recipient, kind],
    );
    const query = new URLSearchParams({ h: recipient, s: signLink("unsubscribe", recipient) });
    this.send(
      event.locale,
      build({
        page: `${event.site}${mailPaths.unsubscribe}?${query}`,
        oneClick: `${event.origin}/api/mail/unsubscribe?${query}`,
      }),
    );
  }

  private async guestsOf(eventId: string): Promise<Guest[]> {
    return this.db.query<Guest>(
      "SELECT name,email,token_sealed FROM invitations WHERE event_id=$1 AND kind<>'open' AND email IS NOT NULL AND email<>''",
      [eventId],
    );
  }

  /**
   * Cambio de fecha o lugar: se apunta y se agrupa con los que lleguen en los 30 minutos
   * siguientes al último aviso. El primero sale al momento.
   */
  async eventChanged(eventId: string, changes: { date: boolean; place: boolean }) {
    await this.db.query(
      `INSERT INTO event_change_notices(event_id,date_changed,place_changed,due_at)
       SELECT $1,$2,$3,greatest(now(), (SELECT max(sent_at) FROM event_notice_batches WHERE event_id=$1) + make_interval(mins => $4))
       -- Sin el correo del organizador confirmado no se avisa: el cambio no gasta turno
       WHERE EXISTS (SELECT 1 FROM events e JOIN users u ON u.id=e.user_id WHERE e.id=$1 AND u.email_verified_at IS NOT NULL
         AND (NOT $5::boolean OR ${paidTierSql} IS NOT NULL))
       ON CONFLICT (event_id) DO UPDATE SET
         date_changed = event_change_notices.date_changed OR EXCLUDED.date_changed,
         place_changed = event_change_notices.place_changed OR EXCLUDED.place_changed`,
      [eventId, changes.date, changes.place, CHANGE_GAP_MINUTES, paymentsEnabled()],
    );
    await this.flushChanges();
  }

  /** Envía los avisos de cambios que ya tocan. Una sola pasada a la vez en este proceso. */
  flushChanges(): Promise<void> {
    this.flushing ??= this.flushDue()
      .catch((e: Error) => this.logger.error(`No se pudieron enviar los avisos de cambios: ${e.message}`))
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }

  private async flushDue() {
    const due = await this.db.transaction(async (c) => {
      const { rows } = await c.query(
        `DELETE FROM event_change_notices WHERE event_id IN (
           SELECT event_id FROM event_change_notices WHERE due_at <= now() ORDER BY due_at LIMIT 20 FOR UPDATE SKIP LOCKED
         ) RETURNING event_id, date_changed, place_changed`,
      );
      const ready = [];
      for (const row of rows) {
        // Tope diario: el aviso espera a que el más antiguo de los del día cumpla 24 h
        const { rows: batches } = await c.query(
          "SELECT sent_at FROM event_notice_batches WHERE event_id=$1 AND sent_at > now() - interval '1 day' ORDER BY sent_at",
          [row.event_id],
        );
        if (batches.length >= CHANGE_BATCHES_PER_DAY) {
          await c.query(
            "INSERT INTO event_change_notices(event_id,date_changed,place_changed,due_at) VALUES($1,$2,$3,$4::timestamptz + interval '1 day')",
            [row.event_id, row.date_changed, row.place_changed, batches[0].sent_at],
          );
          continue;
        }
        await c.query("INSERT INTO event_notice_batches(event_id) VALUES($1)", [row.event_id]);
        ready.push(row);
      }
      return ready;
    });
    for (const row of due) await this.sendChange(row.event_id, { date: row.date_changed, place: row.place_changed });
  }

  private async sendChange(eventId: string, changes: { date: boolean; place: boolean }) {
    const event = await this.eventFor(eventId);
    if (!event) return;
    const when = eventDateText(event.date, event.time_zone, event.locale);
    const texts = [
      ...(changes.date ? [translate(event.locale, "mail.eventChanged.dateChanged", { date: when })] : []),
      ...(changes.place ? [translate(event.locale, "mail.eventChanged.placeChanged", { location: event.location })] : []),
    ];
    for (const guest of await this.guestsOf(eventId))
      await this.sendToGuest(event, "event_changed", guest.email, (unsubscribe) =>
        eventChangedMail(event.locale, {
          to: guest.email,
          name: guest.name,
          event: event.title,
          changes: texts,
          url: `${event.site}/i/${openToken(guest.token_sealed)}`,
          site: event.site,
          unsubscribe,
        }),
      );
  }

  /** Cancelación: sale al momento y deja sin efecto los avisos de cambios pendientes. */
  async eventCancelled(eventId: string) {
    await this.db.query("DELETE FROM event_change_notices WHERE event_id=$1", [eventId]);
    const event = await this.eventFor(eventId);
    if (!event) return;
    for (const guest of await this.guestsOf(eventId))
      await this.sendToGuest(event, "event_cancelled", guest.email, (unsubscribe) =>
        eventCancelledMail(event.locale, {
          to: guest.email,
          name: guest.name,
          event: event.title,
          url: `${event.site}/i/${openToken(guest.token_sealed)}`,
          site: event.site,
          unsubscribe,
        }),
      );
  }

  /** Confirmación al invitado con sus personas y estados, si dejó correo. */
  async guestReply(invitationId: string) {
    const [inv] = await this.db.query(
      "SELECT i.name,i.email,i.token_sealed,i.event_id FROM invitations i WHERE i.id=$1",
      [invitationId],
    );
    if (!inv?.email) return;
    const event = await this.eventFor(inv.event_id);
    if (!event) return;
    const members = await this.db.query(
      "SELECT name,status FROM members WHERE invitation_id=$1 ORDER BY position",
      [invitationId],
    );
    await this.sendToGuest(event, "guest_reply", inv.email, (unsubscribe) =>
      guestReplyMail(event.locale, {
        to: inv.email,
        name: inv.name,
        event: event.title,
        members: members.map((m) => ({
          name: m.name,
          status: translate(event.locale, statusLabels[m.status as Status]),
        })),
        url: `${event.site}/i/${openToken(inv.token_sealed)}`,
        site: event.site,
        unsubscribe,
      }),
    );
  }

  /** Baja de los avisos a invitados desde el enlace firmado de un correo. Idempotente. */
  async unsubscribe(recipient: string, signature: string) {
    const expected = Buffer.from(signLink("unsubscribe", recipient));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
    await this.db.query("INSERT INTO mail_suppressions(email_hash) VALUES($1) ON CONFLICT DO NOTHING", [recipient]);
    return true;
  }

  /** Aviso al organizador por correo, además del aviso dentro de la aplicación. */
  async ownerReply(
    eventId: string,
    guest: string,
    counts: { accepted: number; declined: number; pending: number },
  ) {
    const event = await this.eventFor(eventId);
    // Sin el correo confirmado, la cuenta pudo crearse con el correo de otra persona
    if (!event?.owner_email || !event.owner_verified) return;
    this.send(
      event.locale,
      ownerReplyMail(event.locale, {
        to: event.owner_email,
        name: event.owner_name,
        guest,
        event: event.title,
        counts,
        url: `${event.site}/eventos/${event.id}`,
        site: event.site,
      }),
    );
  }
}
