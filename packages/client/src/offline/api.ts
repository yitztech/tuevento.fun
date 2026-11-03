import {
  emptyMetrics,
  type Event,
  type EventInput,
  type Invitation,
  type InvitationInput,
  type Member,
  type Notification,
} from "@tuevento/contracts";
import { ApiError } from "../errors";
import { type ApiOptions, EventApi } from "../api";
import { localInvitations, refreshMetrics, removeEventLocally } from "./local";
import type { NewOperation, OutboxOperation } from "./outbox";
import type { OfflineStore } from "./store";
import { isTransient, type SyncEngine } from "./sync";
import { uuidv7 } from "./uuid";

/** Lecturas y escrituras con red esperan esto como máximo antes de usar la copia local. */
export const offlineTimeoutMs = 8_000;
/** Prefijo de las personas añadidas sin conexión: el servidor les da su id al guardar. */
const LOCAL_MEMBER = "local-";

export type OfflineOptions = {
  store: OfflineStore;
  engine: SyncEngine;
  /** Estado de la red según el sistema (`@capacitor/network`). */
  online: () => boolean;
  timeoutMs?: number;
  now?: () => Date;
};

class Timeout extends Error {}
const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Timeout("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const byDate = (a: Event, b: Event) => a.date.localeCompare(b.date);
const notFound = (key: string) => new ApiError(404, key);
/** Cuerpo para el servidor: sin los ids de las personas que aún no conoce. */
const withoutLocalMembers = <T extends { members: { id?: string }[] }>(data: T): T => ({
  ...data,
  members: data.members.map(({ id, ...member }) => (id && !id.startsWith(LOCAL_MEMBER) ? { id, ...member } : member)),
});

/**
 * La misma API que `EventApi` para los eventos, las invitaciones y los avisos, pero que funciona sin
 * red: lee primero del servidor (8 s como máximo) y, si no hay respuesta, de la copia local; sin
 * red, las escrituras se aplican a la copia local y se ponen en la cola (`SyncEngine` las envía).
 * Con escrituras pendientes en la cola, las nuevas también van a la cola, para no adelantarlas.
 * Lo demás (postales, pagos, proveedores, invitados) sigue necesitando red, como hasta ahora.
 */
export class OfflineEventApi extends EventApi {
  private readonly offline: Required<Omit<OfflineOptions, "now">> & { now: () => Date };

  constructor(api: ApiOptions, offline: OfflineOptions) {
    super(api);
    this.offline = { timeoutMs: offlineTimeoutMs, now: () => new Date(), ...offline };
  }

  private get store() {
    return this.offline.store;
  }

  /** Con red y sin nada en la cola, se intenta primero el servidor. */
  private async direct() {
    return this.offline.online() && (await this.offline.engine.outbox.pending()).length === 0;
  }

  /** Lectura con red primero; un fallo de red o el tiempo agotado → la copia local. */
  private async read<T>(remote: () => Promise<T>, save: (value: T) => Promise<void>, local: () => Promise<T>) {
    if (await this.direct()) {
      try {
        const value = await withTimeout(remote(), this.offline.timeoutMs);
        await save(value);
        return value;
      } catch (error) {
        if (!isTransient(error)) throw error;
      }
    }
    return local();
  }

  /**
   * Escritura: con red, directa (con su Idempotency-Key, para que un reintento desde la cola no la
   * repita); sin red, a la cola y a la copia local.
   */
  private async write<T>(operation: NewOperation, save: (value: T) => Promise<void>, local: () => Promise<T>) {
    const idempotencyKey = operation.idempotencyKey ?? globalThis.crypto.randomUUID();
    if (await this.direct()) {
      try {
        const value = await withTimeout(
          this.request<T>(operation.path, operation.method, operation.body, {
            "Idempotency-Key": idempotencyKey,
            ...(operation.baseVersion !== undefined ? { "If-Match": `"${operation.baseVersion}"` } : {}),
          }),
          this.offline.timeoutMs,
        );
        await save(value);
        return value;
      } catch (error) {
        if (!isTransient(error)) throw error;
      }
    }
    const value = await local();
    await this.offline.engine.outbox.enqueue({ ...operation, idempotencyKey }, this.offline.now());
    // Con red (la petición directa falló a medias o la cola tenía pendientes), se envía ya
    if (this.offline.online()) void this.offline.engine.run();
    return value;
  }

  override events = () =>
    this.read(
      () => this.request<Event[]>("/events"),
      async (events) => {
        const ids = new Set(events.map((e) => e.id));
        for (const old of await this.store.list<Event>("events"))
          if (!ids.has(old.id)) await removeEventLocally(this.store, old.id);
        for (const event of events) await this.store.set("events", event.id, event);
      },
      async () => (await this.store.list<Event>("events")).sort(byDate),
    );

  override event = (id: string) =>
    this.read(
      () => this.request<Event>(`/events/${id}`),
      (event) => this.store.set("events", event.id, event),
      async () => {
        const event = await this.store.get<Event>("events", id);
        if (!event) throw notFound("errors.couldntFindEvent");
        return event;
      },
    );

  override invitations = (eventId: string) =>
    this.read(
      () => this.request<Invitation[]>(`/events/${eventId}/invitations`),
      async (invitations) => {
        const ids = new Set(invitations.map((i) => i.id));
        for (const old of await localInvitations(this.store, eventId))
          if (!ids.has(old.id)) await this.store.delete("invitations", old.id);
        for (const invitation of invitations) await this.store.set("invitations", invitation.id, invitation);
        await refreshMetrics(this.store, eventId);
      },
      async () => (await localInvitations(this.store, eventId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );

  override notifications = () =>
    this.read(
      () => this.request<Notification[]>("/notifications"),
      async (notifications) => {
        for (const notification of notifications) await this.store.set("notifications", notification.id, notification);
      },
      async () =>
        (await this.store.list<Notification>("notifications"))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 100),
    );

  override saveEvent = async (data: EventInput, id?: string) => {
    const now = this.offline.now().toISOString();
    if (!id) {
      // Id del teléfono: crear dos veces (red que se corta a mitad) devuelve el mismo evento
      const newId = uuidv7(this.offline.now().getTime());
      return this.write<Event>(
        { method: "POST", path: "/events", body: { ...data, id: newId }, entity: { kind: "event", id: newId } },
        (event) => this.store.set("events", event.id, event),
        async () => {
          const { publicPassword, geo, ...fields } = data;
          const event: Event = {
            ...fields,
            id: newId,
            geo: geo ?? null,
            createdAt: now,
            updatedAt: now,
            version: 1,
            metrics: emptyMetrics(),
            hasPublicPassword: !!publicPassword,
            passwordFailures: 0,
            paidTier: null,
          };
          await this.store.set("events", newId, event);
          return event;
        },
      );
    }
    const current = await this.store.get<Event>("events", id);
    return this.write<Event>(
      { method: "PATCH", path: `/events/${id}`, body: data, baseVersion: current?.version, entity: { kind: "event", id } },
      async (event) => {
        await this.store.set("events", event.id, current ? { ...event, metrics: current.metrics } : event);
      },
      async () => {
        if (!current) throw notFound("errors.couldntFindEvent");
        const { publicPassword, geo, ...fields } = data;
        const event: Event = {
          ...current,
          ...fields,
          geo: geo === undefined ? current.geo : geo,
          hasPublicPassword: publicPassword === undefined ? current.hasPublicPassword : publicPassword !== "",
          updatedAt: now,
        };
        await this.store.set("events", id, event);
        return event;
      },
    );
  };

  override deleteEvent = async (id: string) => {
    const outbox = this.offline.engine.outbox;
    const queued = await outbox.all();
    const ofEvent = (o: OutboxOperation) =>
      ("id" in o.entity && o.entity.id === id) || (o.entity.kind === "invitation" && o.entity.eventId === id);
    // Creado sin conexión y aún sin enviar: basta con olvidarlo
    if (queued.some((o) => o.entity.kind === "event" && o.entity.id === id && o.method === "POST")) {
      await outbox.removeWhere(ofEvent);
      await removeEventLocally(this.store, id);
      return { ok: true };
    }
    return this.write<{ ok: boolean }>(
      { method: "DELETE", path: `/events/${id}`, entity: { kind: "event", id } },
      () => removeEventLocally(this.store, id),
      async () => {
        await outbox.removeWhere(ofEvent);
        await removeEventLocally(this.store, id);
        return { ok: true };
      },
    );
  };

  override saveInvitation = async (eventId: string, data: InvitationInput, id?: string) => {
    const now = this.offline.now().toISOString();
    const invitationId = id ?? uuidv7(this.offline.now().getTime());
    const current = id ? await this.store.get<Invitation>("invitations", id) : undefined;
    const save = async (invitation: Invitation) => {
      await this.store.set("invitations", invitation.id, invitation);
      await refreshMetrics(this.store, eventId);
    };
    const local = async () => {
      if (id && !current) throw notFound("errors.couldntFindInvitation");
      const statuses = new Map(current?.members.map((m) => [m.id, m.status]));
      const members: Member[] = data.members.map((m) => ({
        id: m.id ?? `${LOCAL_MEMBER}${uuidv7()}`,
        name: m.name,
        kind: m.kind,
        notes: m.notes ?? "",
        status: (m.id && statuses.get(m.id)) || "pending",
      }));
      const { id: _id, ...fields } = data;
      const invitation: Invitation = {
        ...fields,
        name: data.name || data.email || data.phone,
        id: invitationId,
        eventId,
        // El enlace lo crea el servidor: hasta sincronizar, la invitación no se puede compartir
        token: current?.token ?? "",
        parentId: current?.parentId ?? null,
        members,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        version: current?.version ?? 1,
      };
      await save(invitation);
      return invitation;
    };
    const body = withoutLocalMembers(id ? data : { ...data, id: invitationId });
    return this.write<Invitation>(
      id
        ? { method: "PUT", path: `/events/${eventId}/invitations/${id}`, body, baseVersion: current?.version, entity: { kind: "invitation", id, eventId } }
        : { method: "POST", path: `/events/${eventId}/invitations`, body, entity: { kind: "invitation", id: invitationId, eventId } },
      save,
      local,
    );
  };

  override deleteInvitation = async (eventId: string, id: string) => {
    const outbox = this.offline.engine.outbox;
    const remove = async () => {
      await this.store.delete("invitations", id);
      await refreshMetrics(this.store, eventId);
    };
    const mine = (o: OutboxOperation) => o.entity.kind === "invitation" && o.entity.id === id;
    if ((await outbox.all()).some((o) => mine(o) && o.method === "POST")) {
      await outbox.removeWhere(mine);
      await remove();
      return { ok: true };
    }
    return this.write<{ ok: boolean }>(
      { method: "DELETE", path: `/events/${eventId}/invitations/${id}`, entity: { kind: "invitation", id, eventId } },
      remove,
      async () => {
        await outbox.removeWhere(mine);
        await remove();
        return { ok: true };
      },
    );
  };

  override readNotifications = () =>
    this.write<{ ok: boolean }>(
      { method: "POST", path: "/notifications/read", body: {}, entity: { kind: "notifications" } },
      () => this.markRead(),
      async () => {
        await this.markRead();
        return { ok: true };
      },
    );

  private async markRead() {
    for (const notification of await this.store.list<Notification>("notifications"))
      if (!notification.read) await this.store.set("notifications", notification.id, { ...notification, read: true });
  }
}
