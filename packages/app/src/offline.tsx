import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import {
  ApiError,
  type ApiOptions,
  type EventApi,
  OfflineEventApi,
  type OfflineStore,
  type OutboxOperation,
  refreshMetrics,
  removeEventLocally,
  SyncEngine,
  type SyncStatus,
} from "@tuevento/client";
import type { Event, Invitation, User } from "@tuevento/contracts";
import { tr } from "./i18n";
import type { Runtime } from "./context";
import { Button } from "./ui/button";

/** Clave de la copia local con el usuario: para arrancar sin conexión (fase 8c). */
const USER_KEY = "user";

export type OfflineState = {
  status: SyncStatus;
  /** La cola entera, en orden (pendientes, en conflicto y fallidas). */
  queue: OutboxOperation[];
  /** Ids de los eventos e invitaciones con cambios sin enviar. */
  pendingIds: Set<string>;
  syncNow: () => Promise<void>;
  /** Vuelve a leer la cola (después de guardar algo). */
  refresh: () => Promise<void>;
  /** Lo que tiene el servidor del dato de una operación; `null` si ya no existe. */
  saved: (operation: OutboxOperation) => Promise<Event | Invitation | null>;
  /** Conflicto: reenvía la versión del teléfono sobre la versión actual del servidor. */
  keepMine: (operation: OutboxOperation) => Promise<void>;
  /** Conflicto o fallo: se queda lo del servidor y se olvidan los cambios del teléfono de ese dato. */
  keepSaved: (operation: OutboxOperation) => Promise<void>;
};

const idle: SyncStatus = { state: "idle", pending: 0, conflicts: 0, failed: 0 };
const entityId = (operation: OutboxOperation) => ("id" in operation.entity ? operation.entity.id : null);
const sameEntity = (a: OutboxOperation, b: OutboxOperation) =>
  a.entity.kind === b.entity.kind && entityId(a) === entityId(b);
const notFound = (error: unknown) => error instanceof ApiError && error.status === 404;

/** Estado de la red según el sistema; en la web, siempre con red. */
export function useOnline(runtime: Runtime) {
  const [online, setOnline] = useState(() => runtime.network?.online() ?? true);
  useEffect(() => {
    setOnline(runtime.network?.online() ?? true);
    return runtime.network?.onChange(setOnline);
  }, [runtime]);
  return online;
}

/** Usuario de la última sesión guardado en la copia local: para arrancar sin conexión. */
export async function savedOfflineUser(runtime: Runtime): Promise<User | null> {
  if (!runtime.offlineOwner || !runtime.openOfflineStore) return null;
  const owner = await runtime.offlineOwner().catch(() => null);
  if (!owner) return null;
  const store = await runtime.openOfflineStore(owner).catch(() => null);
  return (await store?.get<User>("meta", USER_KEY).catch(() => undefined)) ?? null;
}

/**
 * Trabajo sin conexión en las apps (organizadores): copia local cifrada, cola y sincronización.
 * Sin `openOfflineStore` (la web) o para un proveedor devuelve la API normal y `offline` nulo.
 */
export function useOfflineSync({
  runtime,
  options,
  base,
  user,
  online,
  onAuthLost,
  onData,
}: {
  runtime: Runtime;
  options: ApiOptions;
  base: EventApi;
  user: User | null;
  online: boolean;
  onAuthLost: () => void;
  onData: () => void;
}): { api: EventApi; offline: OfflineState | null } {
  const enabled = !!runtime.openOfflineStore && !!user && user.accountType !== "provider";
  const [session, setSession] = useState<{ store: OfflineStore; engine: SyncEngine; api: OfflineEventApi } | null>(null);
  const [status, setStatus] = useState<SyncStatus>(idle);
  const [queue, setQueue] = useState<OutboxOperation[]>([]);
  const callbacks = useRef({ onAuthLost, onData });
  callbacks.current = { onAuthLost, onData };

  useEffect(() => {
    if (!enabled || !user) {
      setSession(null);
      setQueue([]);
      setStatus(idle);
      return;
    }
    let alive = true;
    let engine: SyncEngine | undefined;
    void (async () => {
      const store = await runtime.openOfflineStore?.(user.id);
      if (!store || !alive) return;
      const readQueue = async () => {
        if (alive && engine) setQueue(await engine.outbox.all());
      };
      engine = new SyncEngine({
        api: base,
        store,
        onStatus: (next) => {
          if (!alive) return;
          setStatus(next);
          void readQueue();
        },
        onData: () => {
          if (alive) callbacks.current.onData();
        },
        onAuthLost: () => {
          if (alive) callbacks.current.onAuthLost();
        },
      });
      const api = new OfflineEventApi(options, { store, engine, online: () => runtime.network?.online() ?? true });
      setSession({ store, engine, api });
      await readQueue();
      if (runtime.network?.online() ?? true) void engine.run().catch(() => {});
    })().catch(() => {
      // Sin copia local (llavero no disponible): la app sigue funcionando con red, como antes
    });
    return () => {
      alive = false;
      engine?.stop();
    };
  }, [enabled, user?.id, runtime, base, options]);

  // El usuario guardado (para arrancar sin red) sigue al de la sesión: nombre, foto…
  useEffect(() => {
    if (session && user) void session.store.set("meta", USER_KEY, user).catch(() => {});
  }, [session, user]);

  // Al volver la red y al volver la app a primer plano, se envía la cola y se descarga lo nuevo
  useEffect(() => {
    if (session && online) void session.engine.run().catch(() => {});
  }, [session, online]);
  useEffect(() => {
    if (!session) return;
    const visible = () => {
      if (document.visibilityState === "visible" && (runtime.network?.online() ?? true))
        void session.engine.run().catch(() => {});
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [session, runtime]);

  const refresh = useCallback(async () => {
    if (session) setQueue(await session.engine.outbox.all());
  }, [session]);

  const saved = useCallback(
    async (operation: OutboxOperation): Promise<Event | Invitation | null> => {
      const { entity } = operation;
      try {
        if (entity.kind === "event") return await base.event(entity.id);
        if (entity.kind === "invitation")
          return (await base.invitations(entity.eventId)).find((i) => i.id === entity.id) ?? null;
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
      return null;
    },
    [base],
  );

  const offline = useMemo<OfflineState | null>(() => {
    if (!session) return null;
    const { store, engine } = session;
    const keepLocal = async (operation: OutboxOperation, value: Event | Invitation | null) => {
      const { entity } = operation;
      if (entity.kind === "event") {
        if (value) await store.set("events", entity.id, value);
        else await removeEventLocally(store, entity.id);
      } else if (entity.kind === "invitation") {
        if (value) await store.set("invitations", entity.id, value);
        else await store.delete("invitations", entity.id);
        await refreshMetrics(store, entity.eventId);
      }
    };
    return {
      status,
      queue,
      pendingIds: new Set(queue.flatMap((o) => (o.state === "pending" && entityId(o) ? [entityId(o) as string] : []))),
      refresh,
      saved,
      syncNow: async () => {
        await engine.run();
        await refresh();
      },
      keepMine: async (operation) => {
        const current = await saved(operation);
        if (!current) {
          await engine.outbox.removeWhere((o) => sameEntity(o, operation));
          await keepLocal(operation, null);
        } else await engine.outbox.retry(operation.id, current.version);
        // Vuelve a la cola al instante; el envío no hace esperar a la pantalla
        await refresh();
        callbacks.current.onData();
        void engine
          .run()
          .then(refresh)
          .catch(() => {});
      },
      keepSaved: async (operation) => {
        const current = await saved(operation);
        await engine.outbox.removeWhere((o) => sameEntity(o, operation));
        await keepLocal(operation, current);
        await refresh();
        callbacks.current.onData();
      },
    };
  }, [session, status, queue, refresh, saved]);

  return { api: session?.api ?? base, offline };
}

/**
 * Aviso fijo de las apps: sin conexión, con cambios por enviar o con cambios que revisar.
 * En la web nunca aparece.
 */
export function OfflineBanner({ online, offline }: { online: boolean; offline: OfflineState | null }) {
  const [busy, setBusy] = useState(false);
  const pending = offline?.queue.filter((o) => o.state === "pending").length ?? 0;
  const review = offline?.queue.filter((o) => o.state !== "pending").length ?? 0;
  if (online && !pending && !review) return null;
  const syncing = busy || offline?.status.state === "syncing";
  return (
    <div className={`offline-banner ${online ? "" : "is-offline"}`} role="status">
      {!online && (
        <p>
          <CloudOff size={18} aria-hidden="true" />
          {tr("offline.banner")}
        </p>
      )}
      {(pending > 0 || review > 0) && (
        <div className="offline-banner-actions">
          {pending > 0 && <span>{tr("offline.pendingChanges", { count: pending })}</span>}
          {pending > 0 && offline && (
            <Button
              variant="outline"
              size="sm"
              disabled={!online || syncing}
              title={online ? undefined : tr("offline.needsConnection")}
              onClick={async () => {
                setBusy(true);
                try {
                  await offline.syncNow();
                } catch {
                  // El propio motor reintenta y el aviso sigue mostrando lo pendiente
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {syncing ? tr("offline.syncing") : tr("offline.syncNow")}
            </Button>
          )}
          {review > 0 && (
            <Link className="offline-review" to="/sincronizar">
              <TriangleAlert size={16} aria-hidden="true" />
              {tr("offline.reviewChanges", { count: review })}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Marca de un evento o una invitación con cambios sin enviar. */
export function PendingMark({ id, offline }: { id: string; offline: OfflineState | null }) {
  if (!offline?.pendingIds.has(id)) return null;
  return (
    <span className="pending-mark">
      <span className="dot pending" aria-hidden="true" />
      {tr("offline.pendingMark")}
    </span>
  );
}

/** Motivo junto a una acción que solo funciona con conexión. */
export function NeedsConnection({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <p className="field-hint offline-hint" role="status">
      <CloudOff size={14} aria-hidden="true" />
      {tr("offline.needsConnection")}
    </p>
  );
}
