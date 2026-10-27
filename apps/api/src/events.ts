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
import type { PoolClient } from "pg";
import { Database } from "./database";
import { isUniqueViolation } from "./auth";
import { PostcardsService } from "./postcards";
import { NoticeService } from "./notices";
import { hashPassword, verifyPassword } from "./password";
import { siteUrl } from "./locale-env";
import {
  accountLimits,
  calendarFile,
  countMetrics,
  defaultLocale,
  eventLandingPath,
  eventSlugPattern,
  notificationMessage,
  openInvitationLimits,
  publicCodePattern,
  slugify,
  type EventInput,
  type EventLanding,
  type Invitation,
  type Event,
  type GeoPoint,
  type InvitationInput,
  type LandingAddress,
  type Locale,
  type Member,
  type PublicEvent,
  type PublicInvitation,
  type RegistrationInput,
  type Status,
} from "@tuevento/contracts";

/** Cuántos intentos fallidos bloquean la contraseña de una página pública, y por cuánto tiempo. */
const EVENT_PASSWORD_MAX_FAILURES = 10;
const EVENT_PASSWORD_LOCK_MINUTES = 15;
/** Lo que dura el acceso de un invitado a la landing desde su enlace personal. */
const GUEST_ACCESS_DAYS = 180;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
type Counts = { accepted: number; declined: number; pending: number };
const countStatuses = (members: { status: Status }[]): Counts => {
  const accepted = members.filter((m) => m.status === "accepted").length;
  const declined = members.filter((m) => m.status === "declined").length;
  return { accepted, declined, pending: members.length - accepted - declined };
};
/** Fila de `events` tal como la devuelve PostgreSQL. */
type EventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  date: Date;
  time_zone: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  theme: Event["theme"];
  archived: boolean;
  cancelled: boolean;
  public_password_hash: string | null;
  slug: string | null;
  created_at: Date;
};
type MemberRow = Pick<Member, "id" | "name" | "kind" | "notes" | "status">;
/** Punto del lugar guardado en dos columnas, o null si el evento no tiene. */
const geoView = (r: { latitude: number | null; longitude: number | null }): GeoPoint | null =>
  r.latitude === null || r.longitude === null ? null : { lat: r.latitude, lng: r.longitude };
const eventView = (r: EventRow): Event => ({
  id: r.id,
  title: r.title,
  description: r.description,
  date: r.date.toISOString(),
  timeZone: r.time_zone,
  location: r.location,
  geo: geoView(r),
  theme: r.theme,
  archived: r.archived,
  cancelled: r.cancelled,
  hasPublicPassword: !!r.public_password_hash,
  slug: r.slug ?? "",
  createdAt: r.created_at.toISOString(),
  metrics: countMetrics([]),
});
/** Dos eventos no pueden compartir dirección: el índice único lo impide y aquí se avisa claro. */
const slugConflict = (e: unknown): never => {
  if (isUniqueViolation(e)) throw new ConflictException("errors.eventSlugTaken");
  throw e;
};
const memberView = (m: MemberRow) => ({
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
    // Todo evento tiene landing: sin dirección escrita, se conserva la que tenía o sale del título
    const slug = input.slug || before?.slug || (await this.freeSlug(userId, input.title, eventId));
    // undefined conserva la contraseña actual; "" la quita; cualquier otro texto la cambia
    const keepPassword = input.publicPassword === undefined;
    const passwordHash =
      keepPassword || !input.publicPassword
        ? null
        : await hashPassword(input.publicPassword);
    // Igual con el punto del mapa: undefined (apps anteriores) lo conserva, null lo quita
    const keepGeo = input.geo === undefined;
    if (id)
      await this.db
        .query(
          "UPDATE events SET title=$1,description=$2,date=$3,time_zone=$4,location=$5,theme=$6,archived=$7,cancelled=$8,slug=$9,public_password_hash=CASE WHEN $10 THEN public_password_hash ELSE $11 END,public_password_failures=CASE WHEN $10 THEN public_password_failures ELSE 0 END,public_password_locked_until=CASE WHEN $10 THEN public_password_locked_until ELSE NULL END,latitude=CASE WHEN $14 THEN latitude ELSE $15 END,longitude=CASE WHEN $14 THEN longitude ELSE $16 END WHERE id=$12 AND user_id=$13",
          [
            input.title,
            input.description,
            input.date,
            input.timeZone,
            input.location,
            input.theme,
            input.archived,
            input.cancelled,
            slug,
            keepPassword,
            passwordHash,
            id,
            userId,
            keepGeo,
            input.geo?.lat ?? null,
            input.geo?.lng ?? null,
          ],
        )
        .catch(slugConflict);
    else
      await this.db
        .query(
          "INSERT INTO events(id,user_id,title,description,date,time_zone,location,theme,archived,cancelled,slug,public_password_hash,latitude,longitude) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
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
            slug,
            passwordHash,
            input.geo?.lat ?? null,
            input.geo?.lng ?? null,
          ],
        )
        .catch(slugConflict);
    if (before && !input.archived) {
      const date = before.date.getTime() !== new Date(input.date).getTime();
      const movedPin =
        !keepGeo &&
        (before.latitude !== (input.geo?.lat ?? null) || before.longitude !== (input.geo?.lng ?? null));
      const place =
        before.location !== input.location || before.time_zone !== input.timeZone || movedPin;
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
    c: Pick<PoolClient, "query">,
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
  /** Dirección libre en la cuenta, para avisar mientras el organizador escribe. */
  async slugAvailable(userId: string, slug: string, eventId?: string) {
    if (eventId) await this.owned(userId, eventId);
    const rows = await this.db.query(
      "SELECT id FROM events WHERE user_id=$1 AND slug=$2 AND ($3::uuid IS NULL OR id<>$3)",
      [userId, slug, eventId ?? null],
    );
    return { available: rows.length === 0 };
  }
  /** Dirección a partir del título, libre en la cuenta: la limpia y, si está ocupada, con -2, -3… */
  private async freeSlug(userId: string, title: string, eventId: string) {
    let base = slugify(title, accountLimits.eventSlug - 5);
    if (base.length < 3) base = base ? `evento-${base}` : "evento";
    const taken = new Set(
      (
        await this.db.query(
          "SELECT slug FROM events WHERE user_id=$1 AND id<>$2 AND (slug=$3 OR slug LIKE $3 || '-%')",
          [userId, eventId, base],
        )
      ).map((r) => r.slug as string),
    );
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      if (!taken.has(candidate)) return candidate;
    }
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
      "SELECT i.id,i.name,i.kind,e.id AS event_id,e.title,e.description,e.date,e.time_zone,e.location,e.latitude,e.longitude,e.theme,e.cancelled,u.first_name,u.last_name,u.avatar,u.is_demo FROM invitations i JOIN events e ON e.id=i.event_id JOIN users u ON u.id=e.user_id WHERE i.token=$1 AND e.archived=false",
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
        geo: geoView(r),
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
  /** Evento por el código de su cuenta y su dirección; los archivados solo los ve su dueño. */
  private async eventByAddress(code: string, slug: string) {
    if (!publicCodePattern.test(code) || !eventSlugPattern.test(slug) || slug.length > accountLimits.eventSlug)
      throw new NotFoundException("errors.eventIsntAvailable");
    const [r] = await this.db.query(
      "SELECT e.*,u.public_code,u.first_name,u.last_name,u.avatar FROM events e JOIN users u ON u.id=e.user_id WHERE u.public_code=$1 AND e.slug=$2",
      [code, slug],
    );
    if (!r) throw new NotFoundException("errors.eventIsntAvailable");
    return r;
  }
  private async publicView(r: EventRow & { first_name: string; last_name: string; avatar: string | null }): Promise<PublicEvent> {
    return {
      title: r.title,
      description: r.description,
      date: r.date.toISOString(),
      timeZone: r.time_zone,
      location: r.location,
      geo: geoView(r),
      theme: r.theme,
      cancelled: r.cancelled,
      host: { firstName: r.first_name, lastName: r.last_name, avatar: r.avatar },
      postcard: await this.postcards.publicPostcard(r.id, r.theme),
    };
  }
  /** Acceso vigente a la landing: el de un invitado (con el token de su invitación) o el de la contraseña. */
  private async grantedAccess(eventId: string, token?: string) {
    if (!token) return null;
    const [r] = await this.db.query(
      "SELECT a.invitation_id,i.token FROM event_access a LEFT JOIN invitations i ON i.id=a.invitation_id WHERE a.token_hash=$1 AND a.event_id=$2 AND a.expires_at>now()",
      [digest(token), eventId],
    );
    return r ? { invitationToken: (r.token as string | null) ?? null, guest: r.invitation_id !== null } : null;
  }
  /**
   * Landing según quién la abre: el organizador; un invitado que entró con su enlace personal; o
   * alguien que acertó la contraseña. Sin acceso, el evento no existe para quien pregunta (404),
   * salvo que tenga contraseña: entonces solo `locked`.
   */
  async landing(
    code: string,
    slug: string,
    viewerId: string | null,
    access: (eventId: string) => string | undefined,
  ): Promise<EventLanding> {
    const r = await this.eventByAddress(code, slug);
    const owner = viewerId === r.user_id;
    if (r.archived && !owner) throw new NotFoundException("errors.eventIsntAvailable");
    // Quien abrió un enlace personal ve esa invitación, aunque sea el organizador comprobándolo
    const granted = await this.grantedAccess(r.id, access(r.id));
    if (granted?.invitationToken && !r.archived)
      return { access: "guest", token: granted.invitationToken, ...(owner ? { eventId: r.id } : {}) };
    if (owner) return { access: "owner", eventId: r.id, event: await this.publicView(r) };
    if (r.public_password_hash)
      return granted && !granted.guest
        ? { access: "password", event: await this.publicView(r) }
        : { access: "locked" };
    throw new NotFoundException("errors.eventIsntAvailable");
  }
  /** Enlace personal: crea el acceso del invitado a la landing (solo se guarda su hash). */
  async invitationAccess(token: string): Promise<LandingAddress & { eventId: string; access: string }> {
    const [r] = await this.db.query(
      "SELECT i.id,i.event_id,e.slug,u.public_code FROM invitations i JOIN events e ON e.id=i.event_id JOIN users u ON u.id=e.user_id WHERE i.token=$1 AND e.archived=false",
      [token],
    );
    if (!r) throw new NotFoundException("errors.invitationIsntAvailablePlease");
    await this.db.query("DELETE FROM event_access WHERE expires_at<now()");
    const access = randomBytes(32).toString("base64url");
    await this.db.query(
      "INSERT INTO event_access(token_hash,event_id,invitation_id,expires_at) VALUES($1,$2,$3,now()+make_interval(days => $4))",
      [digest(access), r.event_id, r.id, GUEST_ACCESS_DAYS],
    );
    return { code: r.public_code, slug: r.slug, eventId: r.event_id, access };
  }
  /** Las direcciones /e/<dirección> de antes de la landing: a cuál llevan, si solo hay una. */
  async legacyAddress(slug: string): Promise<LandingAddress> {
    if (!eventSlugPattern.test(slug) || slug.length > accountLimits.eventSlug)
      throw new NotFoundException("errors.eventIsntAvailable");
    const rows = await this.db.query(
      "SELECT u.public_code,e.slug FROM events e JOIN users u ON u.id=e.user_id WHERE e.slug=$1 AND e.archived=false LIMIT 2",
      [slug],
    );
    if (rows.length !== 1) throw new NotFoundException("errors.eventIsntAvailable");
    return { code: rows[0].public_code, slug: rows[0].slug };
  }
  /**
   * Contraseña del evento. Devuelve el token de acceso (solo se guarda su hash) y el evento,
   * o null si no tiene contraseña. Tras varios fallos, bloquea un rato.
   */
  async unlockLanding(code: string, slug: string, password: string): Promise<{ token: string; eventId: string } | null> {
    const r = await this.eventByAddress(code, slug);
    if (r.archived) throw new NotFoundException("errors.eventIsntAvailable");
    if (!r.public_password_hash) return null;
    if (r.public_password_locked_until && new Date(r.public_password_locked_until) > new Date())
      throw new HttpException("errors.tooManyAttemptsPlease", HttpStatus.TOO_MANY_REQUESTS);
    const { valid, rehash } = await verifyPassword(password, r.public_password_hash);
    if (!valid) {
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
    // Los hashes scrypt anteriores pasan a Argon2id al acertar la contraseña
    if (rehash)
      await this.db.query("UPDATE events SET public_password_hash=$1 WHERE id=$2", [
        await hashPassword(password),
        r.id,
      ]);
    await this.db.query("DELETE FROM event_access WHERE expires_at<now()");
    const token = randomBytes(32).toString("base64url");
    await this.db.query(
      "INSERT INTO event_access(token_hash,event_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
      [digest(token), r.id],
    );
    return { token, eventId: r.id };
  }
  /** .ics de la landing, para quien puede verla. */
  async calendarForLanding(
    code: string,
    slug: string,
    viewerId: string | null,
    access: (eventId: string) => string | undefined,
    locale: Locale,
  ): Promise<string> {
    const landing = await this.landing(code, slug, viewerId, access);
    if (landing.access === "locked") throw new NotFoundException("errors.eventIsntAvailable");
    // La URL sale de lo guardado, no de lo que llegó en la petición
    const r = await this.eventByAddress(code, slug);
    return this.calendar(r, this.landingUrl(r.public_code, r.slug, locale));
  }
  async calendarForInvitation(token: string, locale: Locale): Promise<string> {
    const [r] = await this.db.query(
      "SELECT e.*,u.public_code FROM invitations i JOIN events e ON e.id=i.event_id JOIN users u ON u.id=e.user_id WHERE i.token=$1 AND e.archived=false",
      [token],
    );
    if (!r) throw new NotFoundException("errors.invitationIsntAvailablePlease");
    return this.calendar(r, this.landingUrl(r.public_code, r.slug, locale));
  }
  private landingUrl(code: string, slug: string, locale: Locale) {
    return `${siteUrl(locale)}${eventLandingPath(code, slug)}`;
  }
  private calendar(r: EventRow, url?: string) {
    return calendarFile({
      uid: r.id,
      title: r.title,
      description: r.description,
      start: r.date,
      location: r.location,
      geo: geoView(r),
      url,
      cancelled: r.cancelled,
    });
  }
}
