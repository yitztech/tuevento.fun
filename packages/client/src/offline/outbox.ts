import type { OfflineStore } from "./store";
import { uuidv7 } from "./uuid";

/** Dato al que afecta una operación: para reordenar, anular y aplicar la respuesta. */
export type OutboxEntity =
  | { kind: "event"; id: string }
  | { kind: "invitation"; id: string; eventId: string }
  | { kind: "notifications" };

export type OutboxState = "pending" | "failed" | "conflict";

export type OutboxOperation = {
  id: string;
  /** La misma en cada reintento: el servidor no repite el efecto (Idempotency-Key). */
  idempotencyKey: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** Versión sobre la que se editó (If-Match). */
  baseVersion?: number;
  entity: OutboxEntity;
  createdAt: string;
  /** Orden de llegada: se envían en este orden (una creación antes que sus invitaciones). */
  order: number;
  attempts: number;
  state: OutboxState;
  /** Mensaje ya traducido del servidor, o la clave del catálogo. */
  error?: string;
  /** En un conflicto: la versión que tiene el servidor. */
  currentVersion?: number;
};

export type NewOperation = Pick<OutboxOperation, "method" | "path" | "body" | "baseVersion" | "entity"> & {
  idempotencyKey?: string;
};

const COUNTER = "outbox-order";

/** Cola ordenada de escrituras pendientes, guardada en el mismo almacén (y cifrada con él). */
export class Outbox {
  constructor(private store: OfflineStore) {}

  async enqueue(operation: NewOperation, now = new Date()): Promise<OutboxOperation> {
    const counter = (await this.store.get<number>("meta", COUNTER)) ?? 0;
    await this.store.set("meta", COUNTER, counter + 1);
    const queued: OutboxOperation = {
      ...operation,
      id: uuidv7(now.getTime()),
      idempotencyKey: operation.idempotencyKey ?? globalThis.crypto.randomUUID(),
      createdAt: now.toISOString(),
      order: counter + 1,
      attempts: 0,
      state: "pending",
    };
    await this.store.set("outbox", queued.id, queued);
    return queued;
  }

  /** Todas, en orden de llegada. */
  async all(): Promise<OutboxOperation[]> {
    return (await this.store.list<OutboxOperation>("outbox")).sort((a, b) => a.order - b.order);
  }

  async pending(): Promise<OutboxOperation[]> {
    return (await this.all()).filter((o) => o.state === "pending");
  }

  async update(operation: OutboxOperation) {
    await this.store.set("outbox", operation.id, operation);
  }

  async remove(id: string) {
    await this.store.delete("outbox", id);
  }

  /** Quita las operaciones que cumplen `match` (p. ej. todo lo de un evento que nunca llegó a crearse). */
  async removeWhere(match: (operation: OutboxOperation) => boolean) {
    for (const operation of await this.all()) if (match(operation)) await this.remove(operation.id);
  }

  /** Devuelve a la cola una operación en conflicto o fallida (el usuario decidió reintentar). */
  async retry(id: string, baseVersion?: number) {
    const operation = await this.store.get<OutboxOperation>("outbox", id);
    if (!operation) return;
    await this.update({
      ...operation,
      state: "pending",
      error: undefined,
      currentVersion: undefined,
      ...(baseVersion !== undefined ? { baseVersion } : {}),
    });
  }
}
