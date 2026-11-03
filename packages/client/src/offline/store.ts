/** Colecciones de la copia local. `outbox` es la cola de escrituras; `meta`, el cursor y contadores. */
export type Collection = "events" | "invitations" | "notifications" | "provider" | "outbox" | "meta";

/**
 * Almacén de la copia local, por colección. En el teléfono es IndexedDB cifrado
 * (`apps/web/src/offline-store.ts`); en las pruebas, `MemoryStore`.
 */
export interface OfflineStore {
  get<T>(collection: Collection, id: string): Promise<T | undefined>;
  set<T>(collection: Collection, id: string, value: T): Promise<void>;
  delete(collection: Collection, id: string): Promise<void>;
  list<T>(collection: Collection): Promise<T[]>;
  /** Borra todo, cola incluida (cerrar sesión, 401, otra cuenta). */
  clear(): Promise<void>;
}

/** Almacén en memoria: pruebas, y la web si algún día lo necesita. Copia los valores como lo haría IndexedDB. */
export class MemoryStore implements OfflineStore {
  private data = new Map<Collection, Map<string, string>>();
  private bucket(collection: Collection) {
    let map = this.data.get(collection);
    if (!map) {
      map = new Map();
      this.data.set(collection, map);
    }
    return map;
  }
  async get<T>(collection: Collection, id: string) {
    const raw = this.bucket(collection).get(id);
    return raw === undefined ? undefined : (JSON.parse(raw) as T);
  }
  async set<T>(collection: Collection, id: string, value: T) {
    this.bucket(collection).set(id, JSON.stringify(value));
  }
  async delete(collection: Collection, id: string) {
    this.bucket(collection).delete(id);
  }
  async list<T>(collection: Collection) {
    return [...this.bucket(collection).values()].map((raw) => JSON.parse(raw) as T);
  }
  async clear() {
    this.data.clear();
  }
}
