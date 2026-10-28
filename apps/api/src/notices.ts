import { Injectable, Logger } from "@nestjs/common";
import {
  translate,
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
} from "./mail-templates";
import { siteUrl } from "./locale-env";
import { openToken } from "./tokens";

/** Fecha y hora del evento en el idioma de quien la lee y en la zona del evento. */
export function eventDateText(date: Date, timeZone: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

/**
 * Avisos por correo. Se envían en segundo plano: un SMTP lento o caído nunca impide guardar.
 * El idioma y el dominio son los del organizador, porque el invitado no tiene cuenta.
 */
@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);

  constructor(
    private db: Database,
    private mail: MailService,
  ) {}

  /** Datos del evento, su organizador y el idioma en el que se le escribe a todos. */
  private async eventFor(eventId: string) {
    const [r] = await this.db.query(
      "SELECT e.id,e.title,e.location,e.date,e.time_zone,e.slug,e.user_id,u.email AS owner_email,u.first_name AS owner_name,u.locale FROM events e JOIN users u ON u.id=e.user_id WHERE e.id=$1",
      [eventId],
    );
    if (!r) return null;
    const locale = normalizeLocale(r.locale);
    return { ...r, locale, site: siteUrl(locale) };
  }

  private send(locale: Locale, message: MailMessage) {
    this.mail
      .send(locale, message)
      .catch((e: Error) => this.logger.error(`No se pudo enviar un aviso: ${e.message}`));
  }

  private async guestsOf(eventId: string) {
    return this.db.query(
      "SELECT name,email,token_sealed FROM invitations WHERE event_id=$1 AND kind<>'open' AND email IS NOT NULL AND email<>''",
      [eventId],
    );
  }

  /** Cambio de fecha o lugar: a cada invitado con correo, un solo aviso por edición. */
  async eventChanged(eventId: string, changes: { date: boolean; place: boolean }) {
    const event = await this.eventFor(eventId);
    if (!event) return;
    const when = eventDateText(event.date, event.time_zone, event.locale);
    const texts = [
      ...(changes.date ? [translate(event.locale, "mail.eventChanged.dateChanged", { date: when })] : []),
      ...(changes.place ? [translate(event.locale, "mail.eventChanged.placeChanged", { location: event.location })] : []),
    ];
    for (const guest of await this.guestsOf(eventId))
      this.send(
        event.locale,
        eventChangedMail(event.locale, {
          to: guest.email,
          name: guest.name,
          event: event.title,
          changes: texts,
          url: `${event.site}/i/${openToken(guest.token_sealed)}`,
          site: event.site,
        }),
      );
  }

  async eventCancelled(eventId: string) {
    const event = await this.eventFor(eventId);
    if (!event) return;
    for (const guest of await this.guestsOf(eventId))
      this.send(
        event.locale,
        eventCancelledMail(event.locale, {
          to: guest.email,
          name: guest.name,
          event: event.title,
          url: `${event.site}/i/${openToken(guest.token_sealed)}`,
          site: event.site,
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
    this.send(
      event.locale,
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
      }),
    );
  }

  /** Aviso al organizador por correo, además del aviso dentro de la aplicación. */
  async ownerReply(
    eventId: string,
    guest: string,
    counts: { accepted: number; declined: number; pending: number },
  ) {
    const event = await this.eventFor(eventId);
    if (!event?.owner_email) return;
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
