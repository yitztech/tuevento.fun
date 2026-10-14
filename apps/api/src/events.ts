import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID, randomBytes } from "node:crypto";
import { Subject, filter, map, merge, interval } from "rxjs";
import { Database } from "./database";
import {
  countMetrics,
  type EventInput,
  type InvitationInput,
  type Invitation,
  type Event,
  type Member,
  type PublicInvitation,
  type Status,
} from "@tuevento/contracts";
const eventView = (r: any): Event => ({
  id: r.id,
  title: r.title,
  description: r.description,
  date: r.date.toISOString(),
  timeZone: r.time_zone,
  location: r.location,
  theme: r.theme,
  archived: r.archived,
  createdAt: r.created_at.toISOString(),
  metrics: countMetrics([]),
});
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
  constructor(
    private db: Database,
    private updates: Updates,
  ) {}
  async owned(userId: string, id: string) {
    const [r] = await this.db.query(
      "SELECT * FROM events WHERE id=$1 AND user_id=$2",
      [id, userId],
    );
    if (!r) throw new NotFoundException("No encontramos este evento.");
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
    if (id) await this.owned(userId, id);
    const eventId = id || randomUUID();
    if (id)
      await this.db.query(
        "UPDATE events SET title=$1,description=$2,date=$3,time_zone=$4,location=$5,theme=$6,archived=$7 WHERE id=$8 AND user_id=$9",
        [
          input.title,
          input.description,
          input.date,
          input.timeZone,
          input.location,
          input.theme,
          input.archived,
          id,
          userId,
        ],
      );
    else
      await this.db.query(
        "INSERT INTO events(id,user_id,title,description,date,time_zone,location,theme,archived) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
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
        ],
      );
    this.updates.emit(userId);
    return this.event(userId, eventId);
  }
  async removeEvent(userId: string, id: string) {
    await this.owned(userId, id);
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
        throw new NotFoundException("No encontramos la invitación.");
      const existing = id
        ? (
            await c.query("SELECT id FROM members WHERE invitation_id=$1", [id])
          ).rows.map((m) => m.id)
        : [];
      if (data.members.some((m) => m.id && !existing.includes(m.id)))
        throw new BadRequestException(
          "Un integrante no pertenece a esta invitación.",
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
      "SELECT i.id,i.name,i.kind,e.title,e.description,e.date,e.time_zone,e.location,e.theme,u.first_name,u.last_name,u.avatar,u.is_demo FROM invitations i JOIN events e ON e.id=i.event_id JOIN users u ON u.id=e.user_id WHERE i.token=$1 AND e.archived=false",
      [token],
    );
    if (!r)
      throw new NotFoundException(
        "Esta invitación no está disponible. Consulta con tu anfitrión.",
      );
    const members = await this.db.query(
      "SELECT id,name,kind,status FROM members WHERE invitation_id=$1 ORDER BY position",
      [r.id],
    );
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
      },
      host: {
        firstName: r.first_name,
        lastName: r.last_name,
        avatar: r.avatar,
      },
      members: members as PublicInvitation["members"],
      isDemo: r.is_demo,
    };
  }
  async rsvp(token: string, members: { id: string; status: Status }[]) {
    let owner = "";
    await this.db.transaction(async (c) => {
      const r = (
        await c.query(
          "SELECT i.*, e.user_id FROM invitations i JOIN events e ON e.id=i.event_id WHERE i.token=$1 AND e.archived=false FOR UPDATE OF i",
          [token],
        )
      ).rows[0];
      if (!r)
        throw new NotFoundException("Esta invitación no está disponible.");
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
          "La lista de integrantes cambió. Recarga la invitación.",
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
      const accepted = members.filter((m) => m.status === "accepted").length,
        declined = members.filter((m) => m.status === "declined").length,
        pending = members.length - accepted - declined;
      const message = `${accepted} ${accepted === 1 ? "confirmado" : "confirmados"}, ${declined} no ${declined === 1 ? "asistirá" : "asistirán"} y ${pending} en espera.`;
      await c.query(
        "INSERT INTO notifications(id,user_id,event_id,guest_name,message,counts) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          r.user_id,
          r.event_id,
          r.name,
          message,
          JSON.stringify({ accepted, declined, pending }),
        ],
      );
      owner = r.user_id;
    });
    if (owner) this.updates.emit(owner);
    return this.publicInvitation(token);
  }
}
