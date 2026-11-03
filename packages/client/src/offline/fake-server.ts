// Servidor falso para las pruebas de la sincronización: imita lo que hace la API real con
// eventos, invitaciones, avisos, Idempotency-Key, If-Match y /sync/changes (migración 028).
import { countMetrics, emptyMetrics, type Event, type Invitation, type Notification, type SyncChanges } from "@tuevento/contracts";

type Change = { seq: number; kind: "event" | "invitation" | "notification"; id: string } | { seq: number; kind: "deleted"; entity: "event" | "invitation"; id: string };
export type Logged = { method: string; path: string; body?: unknown; headers: Record<string, string> };

const problem = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ status, code, detail: message, message, ...extra }), { status, headers: { "Content-Type": "application/json" } });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

export class FakeServer {
  events = new Map<string, Event>();
  invitations = new Map<string, Invitation>();
  notifications = new Map<string, Notification>();
  log: Logged[] = [];
  /** "down": sin red (fetch lanza TypeError); "hang": nunca responde. */
  mode: "up" | "down" | "hang" = "up";
  /** Respuestas forzadas para las siguientes peticiones (después, lo normal). */
  forced: Response[] = [];
  /** Última purga de tombstones (como sync_clock.purged_seq y purged_at). */
  private purgedSeq = 0;
  private purgedAt = 0;
  private seq = 0;
  private changes: Change[] = [];
  private replies = new Map<string, Response>();

  private stamp(kind: "event" | "invitation" | "notification", id: string) {
    this.changes.push({ seq: ++this.seq, kind, id });
  }
  private tombstone(entity: "event" | "invitation", id: string) {
    this.changes.push({ seq: ++this.seq, kind: "deleted", entity, id });
  }
  private eventView(event: Event): Event {
    return { ...event, metrics: countMetrics([...this.invitations.values()].filter((i) => i.eventId === event.id)) };
  }

  /** Purga los tombstones: un cursor anterior en número y en fecha responde 410. */
  purge() {
    this.purgedSeq = this.seq;
    this.purgedAt = Date.now();
    this.changes = this.changes.filter((c) => c.kind !== "deleted");
  }
  /** Borrado hecho desde otro dispositivo. */
  deleteElsewhere(id: string) {
    this.events.delete(id);
    this.tombstone("event", id);
    for (const i of [...this.invitations.values()]) if (i.eventId === id) {
      this.invitations.delete(i.id);
      this.tombstone("invitation", i.id);
    }
  }
  /** Lo que haría otro dispositivo: cambiar un evento en el servidor. */
  editElsewhere(id: string, title: string) {
    const event = this.events.get(id);
    if (!event) throw new Error(`sin evento ${id}`);
    this.events.set(id, { ...event, title, version: event.version + 1 });
    this.stamp("event", id);
  }
  /** Un invitado responde: cambia la persona, la invitación conserva su versión y llega un aviso. */
  guestReplies(invitationId: string) {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) throw new Error(`sin invitación ${invitationId}`);
    this.invitations.set(invitationId, { ...invitation, members: invitation.members.map((m) => ({ ...m, status: "accepted" })) });
    this.stamp("invitation", invitationId);
    const id = crypto.randomUUID();
    this.notifications.set(id, { id, eventId: invitation.eventId, eventTitle: "", guestName: invitation.name, message: "1", read: false, createdAt: new Date().toISOString() });
    this.stamp("notification", id);
  }

  fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api/, "") + url.search;
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (this.mode === "down") throw new TypeError("Failed to fetch");
    if (this.mode === "hang") return new Promise<Response>(() => {});
    this.log.push({ method, path, body, headers });
    const forced = this.forced.shift();
    if (forced) return forced;
    const key = headers["idempotency-key"];
    if (key && this.replies.has(key)) return this.replies.get(key)!.clone();
    const response = this.route(method, url.pathname.replace(/^\/api/, ""), url.searchParams, body, headers);
    if (key && response.ok) this.replies.set(key, response.clone());
    return response;
  };

  private route(method: string, path: string, query: URLSearchParams, body: any, headers: Record<string, string>): Response {
    const ifMatch = headers["if-match"] ? Number(headers["if-match"].replace(/"/g, "")) : undefined;
    const now = new Date().toISOString();
    if (method === "GET" && path === "/events") return json([...this.events.values()].map((e) => this.eventView(e)));
    if (method === "POST" && path === "/events") {
      const { id = crypto.randomUUID(), publicPassword, ...data } = body;
      const saved = this.events.get(id);
      if (saved) return json(this.eventView(saved), 201);
      if (!data.title) return problem(422, "validation_failed", "Escribe el nombre del evento.");
      const event: Event = { ...data, id, geo: data.geo ?? null, slug: data.slug || "evento", createdAt: now, updatedAt: now, version: 1, metrics: emptyMetrics(), hasPublicPassword: !!publicPassword, passwordFailures: 0, paidTier: null };
      this.events.set(id, event);
      this.stamp("event", id);
      return json(this.eventView(event), 201);
    }
    let m = path.match(/^\/events\/([^/]+)$/);
    if (m) {
      const event = this.events.get(m[1]);
      if (!event) return problem(404, "not_found", "No encontramos el evento.");
      if (method === "GET") return json(this.eventView(event));
      if (method === "PATCH") {
        if (ifMatch !== undefined && ifMatch !== event.version)
          return problem(409, "version_conflict", "Esto cambió en otro dispositivo.", { currentVersion: event.version });
        const { publicPassword, ...data } = body;
        const next = { ...event, ...data, version: event.version + 1, updatedAt: now };
        this.events.set(event.id, next);
        this.stamp("event", event.id);
        return json(this.eventView(next));
      }
      if (method === "DELETE") {
        this.events.delete(event.id);
        this.tombstone("event", event.id);
        for (const i of [...this.invitations.values()]) if (i.eventId === event.id) {
          this.invitations.delete(i.id);
          this.tombstone("invitation", i.id);
        }
        return json({ ok: true });
      }
    }
    m = path.match(/^\/events\/([^/]+)\/invitations$/);
    if (m) {
      if (!this.events.has(m[1])) return problem(404, "not_found", "No encontramos el evento.");
      if (method === "GET") return json([...this.invitations.values()].filter((i) => i.eventId === m![1]));
      const { id = crypto.randomUUID(), ...data } = body;
      const saved = this.invitations.get(id);
      if (saved) return json(saved, saved.eventId === m[1] ? 201 : 409);
      const invitation: Invitation = { ...data, id, eventId: m[1], token: `t-${id}`, parentId: null, createdAt: now, updatedAt: now, version: 1, members: data.members.map((p: any) => ({ id: crypto.randomUUID(), status: "pending", ...p })) };
      this.invitations.set(id, invitation);
      this.stamp("invitation", id);
      return json(invitation, 201);
    }
    m = path.match(/^\/events\/([^/]+)\/invitations\/([^/]+)$/);
    if (m) {
      const invitation = this.invitations.get(m[2]);
      if (!invitation || invitation.eventId !== m[1]) return problem(404, "not_found", "No encontramos la invitación.");
      if (method === "PUT") {
        if (ifMatch !== undefined && ifMatch !== invitation.version)
          return problem(409, "version_conflict", "Esto cambió en otro dispositivo.", { currentVersion: invitation.version });
        const next = { ...invitation, ...body, version: invitation.version + 1, updatedAt: now, members: body.members.map((p: any) => ({ status: "pending", ...p, id: p.id ?? crypto.randomUUID() })) };
        this.invitations.set(invitation.id, next);
        this.stamp("invitation", invitation.id);
        return json(next);
      }
      if (method === "DELETE") {
        this.invitations.delete(invitation.id);
        this.tombstone("invitation", invitation.id);
        return json({ ok: true });
      }
    }
    if (method === "GET" && path === "/notifications") return json([...this.notifications.values()]);
    if (method === "POST" && path === "/notifications/read") {
      for (const [id, n] of this.notifications) this.notifications.set(id, { ...n, read: true });
      return json({ ok: true });
    }
    if (method === "GET" && path === "/sync/changes") {
      const cursor = query.get("cursor");
      const [seqText, issuedText] = (cursor ?? "-1.0").split(".");
      const from = Number(seqText);
      if (cursor !== null && from < this.purgedSeq && Number(issuedText) < this.purgedAt)
        return problem(410, "sync_cursor_expired", "Copia demasiado antigua.");
      const limit = Number(query.get("limit") ?? 100);
      // Lo último de cada dato desde el cursor (como el reloj por fila de la API real)
      const latest = new Map<string, Change>();
      for (const change of this.changes) if (change.seq > from) latest.set(`${change.kind === "deleted" ? change.entity : change.kind}:${change.id}`, change);
      const ordered = [...latest.values()].sort((a, b) => a.seq - b.seq);
      const page = ordered.slice(0, limit);
      const result: SyncChanges = { events: [], invitations: [], notifications: [], deleted: [], nextCursor: `${page.at(-1)?.seq ?? from}.${Date.now()}`, hasMore: ordered.length > limit };
      for (const change of page) {
        if (change.kind === "deleted") {
          if (cursor !== null) result.deleted.push({ entity: change.entity, id: change.id });
        } else if (change.kind === "event") {
          const e = this.events.get(change.id);
          if (e) result.events.push(this.eventView(e));
        } else if (change.kind === "invitation") {
          const i = this.invitations.get(change.id);
          if (i) result.invitations.push(i);
        } else {
          const n = this.notifications.get(change.id);
          if (n) result.notifications.push(n);
        }
      }
      return json(result);
    }
    return problem(404, "not_found", "No encontrado");
  }
}
