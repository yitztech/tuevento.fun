import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Subject, filter, map, merge, interval } from "rxjs";
import { Database } from "./database";
import { PostcardsService } from "./postcards";
import { NoticeService } from "./notices";
import { hashPassword, verifyPassword } from "./password";
import { siteUrl } from "./locale-env";
import {
  accountLimits,
  calendarFile,
  countMetrics,
  defaultLocale,
  eventSlugPattern,
  notificationMessage,
  openInvitationLimits,
  type EventInput,
  type Invitation,
  type Event,
  type InvitationInput,
  type LockedPublicEvent,
  type Member,
  type PublicEvent,
  type PublicInvitation,
  type RegistrationInput,
  type Status,
} from "@tuevento/contracts";

/** Cuántos intentos fallidos bloquean la contraseña de una página pública, y por cuánto tiempo. */
const EVENT_PASSWORD_MAX_FAILURES = 10;
const EVENT_PASSWORD_LOCK_MINUTES = 15;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
type Counts = { accepted: number; declined: number; pending: number };
const countStatuses = (members: { status: Status }[]): Counts => {
  const accepted = members.filter((m) => m.status === "accepted").length;
  const declined = members.filter((m) => m.status === "declined").length;
  return { accepted, declined, pending: members.length - accepted - declined };
};
const eventView = (r: any): Event => ({
  id: r.id,
  title: r.title,
  description: r.description,
  date: r.date.toISOString(),
  timeZone: r.time_zone,
  location: r.location,
  theme: r.theme,
  archived: r.archived,
  cancelled: r.cancelled,
  hasPublicPassword: !!r.public_password_hash,
  slug: r.slug ?? "",
  createdAt: r.created_at.toISOString(),
  metrics: countMetrics([]),
});
/** Dos eventos no pueden compartir dirección: el índice único lo impide y aquí se avisa claro. */
const slugConflict = (e: any): never => {
  if (e.code === "23505") throw new ConflictException("errors.eventSlugTaken");
  throw e;
};
const memberView = (m: any) => ({
  id: m.id,
  name: m.name,
  kind: m.kind,
  notes: m.notes,
  status: m.status,
});
@Injectable()
export class Updates {
  private changes = new Subject<string>();
  emit(userId: string) {
    this.changes.next(userId);
  }
  stream(userId: string) {
    return merge(
      this.changes.pipe(
        filter((id) => id === userId),
        map(() => ({ data: { type: "changed" } })),
      ),
      interval(25000).pipe(map(() => ({ data: { type: "heartbeat" } }))),
    );
  }
}
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  constructor(
    private db: Database,
    private updates: Updates,
    private postcards: PostcardsService,
    private notices: NoticeService,
  ) {}
  /** Los avisos por correo no bloquean la petición: un fallo solo se registra. */
  private notify(task: Promise<void>, label: string) {
    task.catch((e: Error) => this.logger.error(`${label}: ${e.message}`));
  }
  async owned(userId: string, id: string) {
    const [r] = await this.db.query(
      "SELECT * FROM events WHERE id=$1 AND user_id=$2",
      [id, userId],
    );
    if (!r) throw new NotFoundException("errors.couldntFindEvent");
    return r;
  }
  async invitations(userId: string, eventId: string): Promise<Invitation[]> {
    await this.owned(userId, eventId);
    const invites = await this.db.query(
      "SELECT * FROM invitations WHERE event_id=$1 ORDER BY created_at",
      [eventId],
    );
    const members = await this.db.query(
      "SELECT m.* FROM members m JOIN invitations i ON i.id=m.invitation_id WHERE i.event_id=$1 ORDER BY m.position",
      [eventId],
    );
    return invites.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      notes: r.notes,
      kind: r.kind,
      token: r.token,
      parentId: r.parent_id ?? null,
      createdAt: r.created_at.toISOString(),
      members: members.filter((m) => m.invitation_id === r.id).map(memberView),
    }));
  }
  async event(userId: string, id: string) {
    const event = eventView(await this.owned(userId, id));
    event.metrics = countMetrics(await this.invitations(userId, id));
    return event;
  }
  async list(userId: string): Promise<Event[]> {
    const events = await this.db.query(
      "SELECT * FROM events WHERE user_id=$1 ORDER BY date",
      [userId],
    );
    if (!events.length) return [];
    const ids = events.map((e) => e.id);
    const invites = await this.db.query(
      "SELECT id,event_id FROM invitations WHERE event_id=ANY($1::uuid[])",
      [ids],
    );
    const members = await this.db.query(
      "SELECT m.invitation_id,m.kind,m.status FROM members m JOIN invitations i ON i.id=m.invitation_id WHERE i.event_id=ANY($1::uuid[])",
      [ids],
    );
    const membersByInvite = new Map<string, Pick<Member, "kind" | "status">[]>();
    for (const m of members) {
      const list = membersByInvite.get(m.invitation_id) ?? [];
      list.push({ kind: m.kind, status: m.status });
      membersByInvite.set(m.invitation_id, list);
    }
    const invitesByEvent = new Map<string, { members: Pick<Member, "kind" | "status">[] }[]>();
    for (const inv of invites) {
      const list = invitesByEvent.get(inv.event_id) ?? [];
      list.push({ members: membersByInvite.get(inv.id) ?? [] });
      invitesByEvent.set(inv.event_id, list);
    }
    return events.map((r) => {
      const event = eventView(r);
      event.metrics = countMetrics(invitesByEvent.get(r.id) ?? []);
      return event;
    });
  }
  async saveEvent(userId: string, input: EventInput, id?: string) {
    const before = id ? await this.owned(userId, id) : null;
    const eventId = id || randomUUID();
    // undefined conserva la contraseña actual; "" la quita; cualquier otro texto la cambia
    const keepPassword = input.publicPassword === undefined;
    const passwordHash =
      keepPassword || !input.publicPassword
        ? null
        : await hashPassword(input.publicPassword);
    if (id)
      await this.db
        .query(
          "UPDATE events SET title=$1,description=$2,date=$3,time_zone=$4,location=$5,theme=$6,archived=$7,cancelled=$8,slug=$9,public_password_hash=CASE WHEN $10 THEN public_password_hash ELSE $11 END,public_password_failures=CASE WHEN $10 THEN public_password_failures ELSE 0 END,public_password_locked_until=CASE WHEN $10 THEN public_password_locked_until ELSE NULL END WHERE id=$12 AND user_id=$13",
          [
            input.title,
            input.description,
            input.date,
            input.timeZone,
            input.location,
            input.theme,
            input.archived,
            input.cancelled,
            input.slug || null,
            keepPassword,
            passwordHash,
            id,
            userId,
          ],
        )
        .catch(slugConflict);
    else
      await this.db
        .query(
          "INSERT INTO events(id,user_id,title,description,date,time_zone,location,theme,archived,cancelled,slug,public_password_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          [
            eventId,
            userId,
            input.title,
            input.description,
            input.date,
            input.timeZone,
            input.location,
            input.theme,
            input.archived,
            input.cancelled,
            input.slug || null,
            passwordHash,
          ],
        )
        .catch(slugConflict);
    if (before && !input.archived) {
      const date = before.date.getTime() !== new Date(input.date).getTime();
      const place =
        before.location !== input.location || before.time_zone !== input.timeZone;
      if (input.cancelled && !before.cancelled)
        this.notify(this.notices.eventCancelled(eventId), "Aviso de cancelación");
      else if (!input.cancelled && (date || place))
        this.notify(this.notices.eventChanged(eventId, { date, place }), "Aviso de cambios");
    }
    this.updates.emit(userId);
    return this.event(userId, eventId);
  }
  /** Número de invitaciones que han nacido de una genérica. */
  private async registrationCount(invitationId: string) {
    const [{ n }] = await this.db.query(
      "SELECT count(*)::int AS n FROM invitations WHERE parent_id=$1",
      [invitationId],
    );
    return n as number;
  }
  /** Aviso dentro de la aplicación al organizador (campana y tiempo real). */
  private async notifyOwner(
    c: { query: (sql: string, params?: unknown[]) => Promise<any> },
    userId: string,
    eventId: string,
    guestName: string,
    counts: Counts,
  ) {
    await c.query(
      "INSERT INTO notifications(id,user_id,event_id,guest_name,message,counts) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        userId,
        eventId,
        guestName,
        notificationMessage(counts, defaultLocale),
        JSON.stringify(counts),
      ],
    );
  }
  /** Dirección pública libre, para avisar mientras el organizador escribe. */
  async slugAvailable(userId: string, slug: string, eventId?: string) {
    if (eventId) await this.owned(userId, eventId);
    const rows = await this.db.query(
      "SELECT id FROM events WHERE slug=$1 AND ($2::uuid IS NULL OR id<>$2)",
      [slug, eventId ?? null],
    );
    return { available: rows.length === 0 };
  }
  async removeEvent(userId: string, id: string) {
    await this.owned(userId, id);
    await this.postcards.purge(id);
    await this.db.query("DELETE FROM events WHERE id=$1 AND user_id=$2", [
      id,
      userId,
    ]);
    this.updates.emit(userId);
    return { ok: true };
  }
  async saveInvitation(
    userId: string,
    eventId: string,
    data: InvitationInput,
    id?: string,
  ) {
    await this.owned(userId, eventId);
    const invitationId = id || randomUUID();
    await this.db.transaction(async (c) => {
      const prior = id
        ? (
            await c.query(
              "SELECT * FROM invitations WHERE id=$1 AND event_id=$2 FOR UPDATE",
              [id, eventId],
            )
          ).rows[0]
        : null;
      if (id && !prior)
        throw new NotFoundException("errors.couldntFindInvitation");
      const existing = id
        ? (
            await c.query("SELECT id FROM members WHERE invitation_id=$1", [id])
          ).rows.map((m) => m.id)
        : [];
      if (data.members.some((m) => m.id && !existing.includes(m.id)))
        throw new BadRequestException(
          "errors.memberDoesntBelongInvitation",
        );
      if (id)
        await c.query(
          "UPDATE invitations SET name=$1,email=$2,phone=$3,notes=$4,kind=$5 WHERE id=$6",
          [
            data.name || data.email || data.phone,
            data.email,
            data.phone,
            data.notes,
            data.kind,
            id,
          ],
        );
      else
        await c.query(
          "INSERT INTO invitations(id,event_id,name,email,phone,notes,kind,token) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            invitationId,
            eventId,
            data.name || data.email || data.phone,
            data.email,
            data.phone,
            data.notes,
            data.kind,
            randomBytes(24).toString("base64url"),
          ],
        );
      const retained = data.members.map((m) => m.id).filter(Boolean);
      await c.query(
        "DELETE FROM members WHERE invitation_id=$1 AND NOT (id=ANY($2::uuid[]))",
        [invitationId, retained],
      );
      for (const [i, m] of data.members.entries()) {
        if (m.id)
          await c.query(
            "UPDATE members SET name=$1,kind=$2,notes=$3,position=$4 WHERE id=$5 AND invitation_id=$6",
            [m.name, m.kind, m.notes, i, m.id, invitationId],
          );
        else
          await c.query(
            "INSERT INTO members(id,invitation_id,name,kind,notes,position) VALUES($1,$2,$3,$4,$5,$6)",
            [randomUUID(), invitationId, m.name, m.kind, m.notes, i],
          );
      }
    });
    this.updates.emit(userId);
    return (await this.invitations(userId, eventId)).find(
      (i) => i.id === invitationId,
    )!;
  }
  async removeInvitation(userId: string, eventId: string, id: string) {
    await this.owned(userId, eventId);
    const rows = await this.db.query(
      "DELETE FROM invitations WHERE id=$1 AND event_id=$2 RETURNING id",
      [id, eventId],
    );
    if (!rows.length) throw new NotFoundException();
    this.updates.emit(userId);
    return { ok: true };
  }
  async publicInvitation(token: string): Promise<PublicInvitation> {
    const [r] = await this.db.query(
      "SELECT i.id,i.name,i.kind,e.id AS event_id,e.title,e.description,e.date,e.time_zone,e.location,e.theme,e.cancelled,u.first_name,u.last_name,u.avatar,u.is_demo FROM invitations i JOIN events e ON e.id=i.event_id JOIN users u ON u.id=e.user_id WHERE i.token=$1 AND e.archived=false",
      [token],
    );
    if (!r)
      throw new NotFoundException("errors.invitationIsntAvailablePlease");
    const members = await this.db.query(
      "SELECT id,name,kind,status FROM members WHERE invitation_id=$1 ORDER BY position",
      [r.id],
    );
    const registrations = r.kind === "open" ? await this.registrationCount(r.id) : 0;
    return {
      name: r.name,
      kind: r.kind,
      event: {
        title: r.title,
        description: r.description,
        date: r.date.toISOString(),
        timeZone: r.time_zone,
        location: r.location,
        theme: r.theme,
        cancelled: r.cancelled,
      },
      registrationsFull: registrations >= openInvitationLimits.registrations,
      host: {
        firstName: r.first_name,
        lastName: r.last_name,
        avatar: r.avatar,
      },
      members: members as PublicInvitation["members"],
      postcard: await this.postcards.publicPostcard(r.event_id, r.theme),
      isDemo: r.is_demo,
    };
  }
  async rsvp(token: string, members: { id: string; status: Status }[]) {
    let owner = "";
    const sent: { eventId: string; invitationId: string; name: string; counts: Counts }[] = [];
    await this.db.transaction(async (c) => {
      const r = (
        await c.query(
          "SELECT i.*, e.user_id, e.cancelled FROM invitations i JOIN events e ON e.id=i.event_id WHERE i.token=$1 AND e.archived=false FOR UPDATE OF i",
          [token],
        )
      ).rows[0];
      if (!r)
        throw new NotFoundException("errors.invitationIsntAvailable");
      if (r.cancelled) throw new BadRequestException("errors.eventCancelled");
      const existing = (
        await c.query(
          "SELECT id,status,name FROM members WHERE invitation_id=$1 ORDER BY position",
          [r.id],
        )
      ).rows;
      if (
        members.length !== existing.length ||
        members.some((m) => !existing.some((e) => e.id === m.id))
      )
        throw new BadRequestException(
          "errors.memberListHasChanged",
        );
      const changed = members.some(
        (m) => existing.find((e) => e.id === m.id)?.status !== m.status,
      );
      if (!changed) return;
      for (const m of members)
        await c.query(
          "UPDATE members SET status=$1 WHERE id=$2 AND invitation_id=$3",
          [m.status, m.id, r.id],
        );
      // Se guardan las cantidades; el texto se arma en el idioma de quien lo lee.
      const counts = countStatuses(members);
      await this.notifyOwner(c, r.user_id, r.event_id, r.name, counts);
      owner = r.user_id;
      sent.push({ eventId: r.event_id, invitationId: r.id, name: r.name, counts });
    });
    if (owner) this.updates.emit(owner);
    for (const s of sent) {
      this.notify(this.notices.guestReply(s.invitationId), "Confirmación al invitado");
      this.notify(this.notices.ownerReply(s.eventId, s.name, s.counts), "Aviso al organizador");
    }
    return this.publicInvitation(token);
  }
  /** Invitado de una invitación genérica: se crea su propia invitación ya respondida. */
  async register(token: string, data: RegistrationInput): Promise<{ token: string }> {
    const childId = randomUUID();
    const childToken = randomBytes(24).toString("base64url");
    const sent: { owner: string; eventId: string; name: string; counts: Counts }[] = [];
    await this.db.transaction(async (c) => {
      const r = (
        await c.query(
          "SELECT i.id,i.event_id,e.user_id,e.cancelled FROM invitations i JOIN events e ON e.id=i.event_id WHERE i.token=$1 AND i.kind='open' AND e.archived=false FOR UPDATE OF i",
          [token],
        )
      ).rows[0];
      if (!r) throw new NotFoundException("errors.invitationIsntAvailable");
      if (r.cancelled) throw new BadRequestException("errors.eventCancelled");
      // El bloqueo de la fila padre serializa los registros: el límite no se puede saltar en paralelo
      if ((await this.registrationCount(r.id)) >= openInvitationLimits.registrations)
        throw new ConflictException("errors.openInvitationFull");
      const name = data.name || data.email || data.phone;
      await c.query(
        "INSERT INTO invitations(id,event_id,name,email,phone,notes,kind,token,parent_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [childId, r.event_id, name, data.email, data.phone, data.notes, data.kind, childToken, r.id],
      );
      for (const [i, m] of data.members.entries())
        await c.query(
          "INSERT INTO members(id,invitation_id,name,kind,notes,status,position) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [randomUUID(), childId, m.name, m.kind, m.notes, m.status, i],
        );
      const counts = countStatuses(data.members);
      await this.notifyOwner(c, r.user_id, r.event_id, name, counts);
      sent.push({ owner: r.user_id, eventId: r.event_id, name, counts });
    });
    for (const s of sent) {
      this.updates.emit(s.owner);
      this.notify(this.notices.guestReply(childId), "Confirmación al invitado");
      this.notify(this.notices.ownerReply(s.eventId, s.name, s.counts), "Aviso al organizador");
    }
    return { token: childToken };
  }
  /** Evento por su dirección pública, sin invitados. Con contraseña y sin acceso, solo `locked`. */
  async publicEvent(slug: string, access?: string): Promise<PublicEvent | LockedPublicEvent> {
    const r = await this.eventBySlug(slug);
    if (r.public_password_hash && !(await this.hasAccess(r.id, access)))
      return { locked: true };
    return {
      locked: false,
      title: r.title,
      description: r.description,
      date: r.date.toISOString(),
      timeZone: r.time_zone,
      location: r.location,
      theme: r.theme,
      cancelled: r.cancelled,
      host: { firstName: r.first_name, lastName: r.last_name, avatar: r.avatar },
      postcard: await this.postcards.publicPostcard(r.id, r.theme),
    };
  }
  private async eventBySlug(slug: string) {
    if (!eventSlugPattern.test(slug) || slug.length > accountLimits.eventSlug)
      throw new NotFoundException("errors.eventIsntAvailable");
    const [r] = await this.db.query(
      "SELECT e.*,u.first_name,u.last_name,u.avatar FROM events e JOIN users u ON u.id=e.user_id WHERE e.slug=$1 AND e.archived=false",
      [slug],
    );
    if (!r) throw new NotFoundException("errors.eventIsntAvailable");
    return r;
  }
  private async hasAccess(eventId: string, token?: string) {
    if (!token) return false;
    const rows = await this.db.query(
      "SELECT 1 FROM event_access WHERE token_hash=$1 AND event_id=$2 AND expires_at>now()",
      [digest(token), eventId],
    );
    return rows.length > 0;
  }
  /**
   * Contraseña de la página pública. Devuelve el token de acceso (solo se guarda su hash),
   * o null si el evento no tiene contraseña. Tras varios fallos, bloquea un rato.
   */
  async unlockEvent(slug: string, password: string): Promise<string | null> {
    const r = await this.eventBySlug(slug);
    if (!r.public_password_hash) return null;
    if (r.public_password_locked_until && new Date(r.public_password_locked_until) > new Date())
      throw new HttpException("errors.tooManyAttemptsPlease", HttpStatus.TOO_MANY_REQUESTS);
    if (!(await verifyPassword(password, r.public_password_hash))) {
      await this.db.query(
        "UPDATE events SET public_password_failures=public_password_failures+1, public_password_locked_until=CASE WHEN public_password_failures+1>=$2 THEN now()+make_interval(mins => $3) ELSE public_password_locked_until END WHERE id=$1",
        [r.id, EVENT_PASSWORD_MAX_FAILURES, EVENT_PASSWORD_LOCK_MINUTES],
      );
      throw new UnauthorizedException("errors.eventPasswordIncorrect");
    }
    await this.db.query(
      "UPDATE events SET public_password_failures=0, public_password_locked_until=NULL WHERE id=$1",
      [r.id],
    );
    await this.db.query("DELETE FROM event_access WHERE expires_at<now()");
    const token = randomBytes(32).toString("base64url");
    await this.db.query(
      "INSERT INTO event_access(token_hash,event_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
      [digest(token), r.id],
    );
    return token;
  }
  async calendarForEvent(slug: string, access?: string): Promise<string> {
    const r = await this.eventBySlug(slug);
    if (r.public_password_hash && !(await this.hasAccess(r.id, access)))
      throw new NotFoundException("errors.eventIsntAvailable");
    return this.calendar(r, `${siteUrl(defaultLocale)}/e/${slug}`);
  }
  async calendarForInvitation(token: string): Promise<string> {
    const [r] = await this.db.query(
      "SELECT e.* FROM invitations i JOIN events e ON e.id=i.event_id WHERE i.token=$1 AND e.archived=false",
      [token],
    );
    if (!r) throw new NotFoundException("errors.invitationIsntAvailablePlease");
    return this.calendar(r, r.slug ? `${siteUrl(defaultLocale)}/e/${r.slug}` : undefined);
  }
  private calendar(r: any, url?: string) {
    return calendarFile({
      uid: r.id,
      title: r.title,
      description: r.description,
      start: r.date,
      location: r.location,
      url,
      cancelled: r.cancelled,
    });
  }
}
