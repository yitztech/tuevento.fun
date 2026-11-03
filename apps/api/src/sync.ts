import { Controller, Get, Header, Injectable, Query, Req, UseGuards } from "@nestjs/common";
import {
  syncQuerySchema,
  type Locale,
  type SyncChanges,
  type SyncDeleted,
} from "@tuevento/contracts";
import { SessionGuard, type AuthedRequest } from "./auth";
import { Database } from "./database";
import { EventsService } from "./events";
import { parse } from "./problem";
import { ProvidersService } from "./providers";
import { requestLocale } from "./request-locale";

import { cursorExpired, cursorExpiredError, decodeCursor, encodeCursor, START } from "./sync-cursor";

type Change =
  | { seq: number; kind: "event"; id: string }
  | { seq: number; kind: "invitation"; id: string; eventId: string }
  | { seq: number; kind: "notification"; id: string }
  | { seq: number; kind: "provider"; id: string }
  | { seq: number; kind: "deleted"; entity: SyncDeleted["entity"]; id: string };

@Injectable()
export class SyncService {
  constructor(
    private db: Database,
    private events: EventsService,
    private providers: ProvidersService,
  ) {}

  /**
   * Lo que cambió en la cuenta desde el cursor, ordenado por el reloj de la cuenta. Los números de
   * una página salen de una sola instantánea (REPEATABLE READ): ninguna escritura que se confirme a
   * mitad deja un hueco. El contenido se lee después, y puede ser más nuevo que su número: el
   * teléfono lo recibirá otra vez en la página siguiente y lo sobrescribe igual.
   */
  async changes(userId: string, locale: Locale, cursorText: string | undefined, limit: number): Promise<SyncChanges> {
    const cursor = cursorText ? decodeCursor(cursorText) : null;
    const from = cursor?.seq ?? START;
    const page = await this.db.transaction(async (c) => {
      await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      if (cursor) {
        const { rows: [clock] } = await c.query<{ purged_seq: string; purged_at: Date | null }>(
          "SELECT purged_seq, purged_at FROM sync_clock WHERE user_id=$1",
          [userId],
        );
        if (cursorExpired(cursor, clock && { purgedSeq: Number(clock.purged_seq), purgedAt: clock.purged_at }))
          throw cursorExpiredError();
      }
      const take = limit + 1;
      const params = [userId, from, take];
      const [events, invitations, notifications, provider, deleted] = await Promise.all([
        c.query<{ id: string; seq: string }>(
          "SELECT id, sync_seq AS seq FROM events WHERE user_id=$1 AND sync_seq>$2 ORDER BY sync_seq LIMIT $3",
          params,
        ),
        c.query<{ id: string; event_id: string; seq: string }>(
          "SELECT i.id, i.event_id, i.sync_seq AS seq FROM invitations i JOIN events e ON e.id=i.event_id WHERE e.user_id=$1 AND i.sync_seq>$2 ORDER BY i.sync_seq LIMIT $3",
          params,
        ),
        c.query<{ id: string; seq: string }>(
          "SELECT id, sync_seq AS seq FROM notifications WHERE user_id=$1 AND sync_seq>$2 ORDER BY sync_seq LIMIT $3",
          params,
        ),
        c.query<{ id: string; seq: string }>(
          "SELECT id, sync_seq AS seq FROM provider_profiles WHERE user_id=$1 AND sync_seq>$2 ORDER BY sync_seq LIMIT $3",
          params,
        ),
        // Sin cursor no hay nada que borrar en el teléfono
        cursor
          ? c.query<{ entity: SyncDeleted["entity"]; entity_id: string; seq: string }>(
              "SELECT entity, entity_id, seq FROM sync_tombstones WHERE user_id=$1 AND seq>$2 ORDER BY seq LIMIT $3",
              params,
            )
          : Promise.resolve({ rows: [] as { entity: SyncDeleted["entity"]; entity_id: string; seq: string }[] }),
      ]);
      const all: Change[] = [
        ...events.rows.map((r) => ({ seq: Number(r.seq), kind: "event" as const, id: r.id })),
        ...invitations.rows.map((r) => ({ seq: Number(r.seq), kind: "invitation" as const, id: r.id, eventId: r.event_id })),
        ...notifications.rows.map((r) => ({ seq: Number(r.seq), kind: "notification" as const, id: r.id })),
        ...provider.rows.map((r) => ({ seq: Number(r.seq), kind: "provider" as const, id: r.id })),
        ...deleted.rows.map((r) => ({ seq: Number(r.seq), kind: "deleted" as const, entity: r.entity, id: r.entity_id })),
      ].sort((a, b) => a.seq - b.seq);
      return { items: all.slice(0, limit), hasMore: all.length > limit };
    });

    const ids = (kind: Change["kind"]) => page.items.filter((i) => i.kind === kind).map((i) => i.id);
    const eventIds = ids("event");
    const notificationIds = ids("notification");
    const invitationsByEvent = new Map<string, Set<string>>();
    for (const item of page.items)
      if (item.kind === "invitation")
        invitationsByEvent.set(item.eventId, (invitationsByEvent.get(item.eventId) ?? new Set()).add(item.id));

    // Lo que se borró después de la instantánea simplemente no aparece: su tombstone llegará después
    const [events, notifications, invitationLists, provider] = await Promise.all([
      eventIds.length ? this.events.list(userId, eventIds) : [],
      notificationIds.length ? this.events.notifications(userId, locale, notificationIds) : [],
      Promise.all(
        [...invitationsByEvent].map(([eventId, wanted]) =>
          this.events
            .invitations(userId, eventId)
            .then((list) => list.filter((i) => wanted.has(i.id)))
            .catch(() => []),
        ),
      ),
      ids("provider").length ? this.providers.profile(userId) : null,
    ]);
    const last = page.items.at(-1)?.seq ?? from;
    return {
      events,
      invitations: invitationLists.flat(),
      notifications,
      ...(provider ? { provider } : {}),
      deleted: page.items.flatMap((i) => (i.kind === "deleted" ? [{ entity: i.entity, id: i.id }] : [])),
      nextCursor: encodeCursor(last),
      hasMore: page.hasMore,
    };
  }
}

/** Sincronización de las apps sin conexión: cualquier tipo de cuenta, solo con sus datos. */
@Controller("sync")
@UseGuards(SessionGuard)
export class SyncController {
  constructor(private sync: SyncService) {}
  @Get("changes")
  @Header("Cache-Control", "no-store")
  changes(@Req() req: AuthedRequest, @Query() query: unknown) {
    const { cursor, limit } = parse(syncQuerySchema, query, req, 400);
    return this.sync.changes(req.user.id, requestLocale(req), cursor, limit);
  }
}
