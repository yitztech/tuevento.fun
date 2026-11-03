import type { Event, Invitation } from "@tuevento/contracts";
import { ApiError } from "../errors";
import type { EventApi } from "../api";
import { applyChanges, clearData, refreshMetrics, removeEventLocally } from "./local";
import { Outbox, type OutboxOperation } from "./outbox";
import type { OfflineStore } from "./store";

const CURSOR = "sync-cursor";
const LAST_SYNC = "sync-last";
/** Espera exponencial entre reintentos tras un error de red: de 2 s a 5 min. */
export const retryDelays = { first: 2_000, max: 300_000 } as const;

export type SyncStatus = {
  state: "idle" | "syncing" | "waiting" | "signed-out";
  pending: number;
  conflicts: number;
  failed: number;
  lastSyncAt?: string;
  /** Con `waiting`: cuándo se reintenta. */
  nextRetryAt?: string;
};

export type SyncResult = {
  sent: number;
  pulled: boolean;
  /** Por qué paró antes de terminar. */
  stopped?: "network" | "auth";
};

type Timers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export type SyncEngineOptions = {
  api: EventApi;
  store: OfflineStore;
  outbox?: Outbox;
  /** 401: la copia local ya se borró; la app pide entrar otra vez. */
  onAuthLost?: () => void;
  onStatus?: (status: SyncStatus) => void;
  /** Tras aplicar cambios a la copia local (para volver a pintar). */
  onData?: () => void;
  timers?: Timers;
  now?: () => number;
  pageLimit?: number;
};

/** Sin respuesta del servidor, o un fallo suyo pasajero: se reintenta más tarde, sin tocar la cola. */
export const isTransient = (error: unknown) =>
  !(error instanceof ApiError) ||
  error.status === 0 ||
  error.status >= 500 ||
  error.status === 429 ||
  error.code === "idempotency_in_progress";

/**
 * Sincronización: primero envía la cola en orden y después descarga los cambios. Se llama al
 * arrancar, al volver la red y al volver la app a primer plano (`run`); dos llamadas a la vez
 * comparten la misma vuelta.
 */
export class SyncEngine {
  readonly outbox: Outbox;
  private running: Promise<SyncResult> | null = null;
  private follow: Promise<SyncResult> | null = null;
  private failures = 0;
  private timer: unknown = null;
  private stopped = false;
  private timers: Timers;
  private now: () => number;
  status: SyncStatus = { state: "idle", pending: 0, conflicts: 0, failed: 0 };

  constructor(private options: SyncEngineOptions) {
    this.outbox = options.outbox ?? new Outbox(options.store);
    this.timers = options.timers ?? {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    this.now = options.now ?? Date.now;
  }

  /**
   * Una vuelta completa. Si ya hay una en curso, se hace otra al terminar (lo encolado mientras
   * tanto también se envía) y se devuelve esa; varias llamadas a la vez comparten la siguiente.
   */
  run(): Promise<SyncResult> {
    if (this.running) {
      this.follow ??= this.running.then(() => {
        this.follow = null;
        return this.run();
      });
      return this.follow;
    }
    this.stopped = false;
    this.cancelRetry();
    this.running = this.cycle().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Deja de reintentar (cerrar sesión, app en segundo plano). */
  stop() {
    this.stopped = true;
    this.cancelRetry();
  }

  private cancelRetry() {
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }

  private async cycle(): Promise<SyncResult> {
    await this.report("syncing");
    const result: SyncResult = { sent: 0, pulled: false };
    try {
      result.sent = await this.flush();
      await this.pull();
      result.pulled = true;
      this.failures = 0;
      await this.options.store.set("meta", LAST_SYNC, new Date(this.now()).toISOString());
      await this.report("idle");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        result.stopped = "auth";
        await this.signOut();
      } else if (isTransient(error)) {
        result.stopped = "network";
        this.scheduleRetry();
        await this.report("waiting");
      } else throw error;
    }
    return result;
  }

  /** Envía la cola en orden. Un error pasajero corta la vuelta (y la cola queda igual). */
  private async flush(): Promise<number> {
    let sent = 0;
    for (const queued of await this.outbox.pending()) {
      // Puede haber cambiado (rebase) mientras se enviaba la anterior
      const operation = (await this.options.store.get<OutboxOperation>("outbox", queued.id)) ?? queued;
      if (operation.state !== "pending") continue;
      try {
        const response = await this.send(operation);
        await this.outbox.remove(operation.id);
        await this.applyResponse(operation, response);
        sent++;
        this.options.onData?.();
      } catch (error) {
        if (isTransient(error) || (error instanceof ApiError && error.status === 401)) {
          await this.outbox.update({ ...operation, attempts: operation.attempts + 1 });
          throw error;
        }
        const apiError = error as ApiError;
        const currentVersion = apiError.body?.currentVersion;
        await this.outbox.update({
          ...operation,
          attempts: operation.attempts + 1,
          state: apiError.status === 409 ? "conflict" : "failed",
          error: apiError.message,
          ...(typeof currentVersion === "number" ? { currentVersion } : {}),
        });
      }
    }
    return sent;
  }

  private send(operation: OutboxOperation) {
    return this.options.api.request<unknown>(operation.path, operation.method, operation.body, {
      "Idempotency-Key": operation.idempotencyKey,
      ...(operation.baseVersion !== undefined ? { "If-Match": `"${operation.baseVersion}"` } : {}),
    });
  }

  /** Guarda lo que devolvió el servidor y pone al día la versión de las ediciones siguientes del mismo dato. */
  private async applyResponse(operation: OutboxOperation, response: unknown) {
    const { store } = this.options;
    const { entity } = operation;
    if (entity.kind === "notifications") return;
    if (operation.method === "DELETE") {
      if (entity.kind === "event") await removeEventLocally(store, entity.id);
      else {
        await store.delete("invitations", entity.id);
        await refreshMetrics(store, entity.eventId);
      }
      return;
    }
    const saved = response as (Event | Invitation) & { version?: number };
    if (!saved || typeof saved !== "object" || saved.id !== entity.id) return;
    if (entity.kind === "event") {
      const previous = await store.get<Event>("events", entity.id);
      // Las métricas las calcula el teléfono con sus invitaciones (pueden ir por delante)
      await store.set("events", entity.id, previous ? { ...saved, metrics: previous.metrics } : saved);
    } else {
      await store.set("invitations", entity.id, saved);
      await refreshMetrics(store, entity.eventId);
    }
    if (typeof saved.version === "number")
      for (const later of await this.outbox.pending())
        if (later.entity.kind === entity.kind && "id" in later.entity && later.entity.id === entity.id && later.baseVersion !== undefined)
          await this.outbox.update({ ...later, baseVersion: saved.version });
  }

  /** Descarga los cambios desde el cursor guardado; con el cursor caducado (410), todo otra vez. */
  private async pull(): Promise<void> {
    const { store, api } = this.options;
    let cursor = await store.get<string>("meta", CURSOR);
    for (let page = 0; page < 1000; page++) {
      let changes: Awaited<ReturnType<EventApi["syncChanges"]>>;
      try {
        changes = await api.syncChanges(cursor, this.options.pageLimit);
      } catch (error) {
        if (error instanceof ApiError && error.status === 410 && cursor) {
          await clearData(store);
          await store.delete("meta", CURSOR);
          cursor = undefined;
          continue;
        }
        throw error;
      }
      const busy = new Set(
        (await this.outbox.all()).flatMap((o) => ("id" in o.entity ? [o.entity.id] : [])),
      );
      await applyChanges(store, changes, busy);
      await store.set("meta", CURSOR, changes.nextCursor);
      cursor = changes.nextCursor;
      this.options.onData?.();
      if (!changes.hasMore) return;
    }
  }

  private scheduleRetry() {
    if (this.stopped) return;
    this.failures++;
    const delay = Math.min(retryDelays.first * 2 ** (this.failures - 1), retryDelays.max);
    this.status = { ...this.status, nextRetryAt: new Date(this.now() + delay).toISOString() };
    this.cancelRetry();
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      void this.run();
    }, delay);
  }

  /** 401: se borra la copia local (cola incluida) y se deja de reintentar. */
  private async signOut() {
    this.stop();
    await this.options.store.clear();
    this.status = { state: "signed-out", pending: 0, conflicts: 0, failed: 0 };
    this.options.onStatus?.(this.status);
    this.options.onAuthLost?.();
  }

  private async report(state: SyncStatus["state"]) {
    const all = await this.outbox.all();
    this.status = {
      state,
      pending: all.filter((o) => o.state === "pending").length,
      conflicts: all.filter((o) => o.state === "conflict").length,
      failed: all.filter((o) => o.state === "failed").length,
      lastSyncAt: await this.options.store.get<string>("meta", LAST_SYNC),
      ...(state === "waiting" ? { nextRetryAt: this.status.nextRetryAt } : {}),
    };
    this.options.onStatus?.(this.status);
  }

  /** Cuántos fallos seguidos lleva (para las pruebas y el aviso de la 8c). */
  get consecutiveFailures() {
    return this.failures;
  }
}
