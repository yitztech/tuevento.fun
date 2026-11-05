import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import {
  importRecordKey,
  newRecordKey,
  openRecord,
  sealRecord,
  type Collection,
  type OfflineStore,
  type SealedRecord,
} from '@tuevento/client';

// Copia local de las apps (docs/PLAN-PROVEEDORES-Y-OFFLINE.md, fase 8b): IndexedDB con cada
// registro cifrado con AES-GCM 256. La clave es aleatoria por cuenta y vive en el llavero de iOS o
// el Keystore de Android (SecureStorage), nunca en IndexedDB ni en localStorage.
const DB_NAME = 'tueventofun-offline';
const RECORDS = 'records';
const OWNER = 'tueventofun:offline-owner';
const keyName = (userId: string) => `tueventofun:offline-key:${userId}`;

type Row = SealedRecord & { k: string; c: Collection; id: string };

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Conexiones abiertas: se cierran antes de borrar la base, o el borrado queda bloqueado. */
const connections = new Set<IDBDatabase>();

async function openDatabase(): Promise<IDBDatabase> {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    const records = req.result.createObjectStore(RECORDS, { keyPath: 'k' });
    records.createIndex('c', 'c');
  };
  const db = await request(req);
  connections.add(db);
  // Otra pestaña o versión pide borrar o cambiar la base: se suelta en vez de bloquearla
  db.onversionchange = () => {
    db.close();
    connections.delete(db);
  };
  return db;
}

/**
 * Borra la base. Un borrado bloqueado deja en cola toda apertura posterior (la app no arrancaría
 * sin red): antes se cierran las conexiones propias, y como máximo se esperan 3 s.
 */
function deleteDatabase(): Promise<void> {
  for (const db of connections) db.close();
  connections.clear();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = done;
  });
}

class EncryptedStore implements OfflineStore {
  constructor(
    private db: IDBDatabase,
    private key: CryptoKey,
  ) {}

  private records(mode: IDBTransactionMode) {
    return this.db.transaction(RECORDS, mode).objectStore(RECORDS);
  }

  /** Un registro que no se puede abrir (alterado, o de otra clave) se descarta. */
  private async open<T>(row: Row | undefined): Promise<T | undefined> {
    if (!row) return undefined;
    try {
      return await openRecord<T>(this.key, row.c, row.id, row);
    } catch {
      await this.delete(row.c, row.id);
      return undefined;
    }
  }

  async get<T>(collection: Collection, id: string) {
    return this.open<T>(await request<Row | undefined>(this.records('readonly').get(`${collection}\u0000${id}`)));
  }

  async set<T>(collection: Collection, id: string, value: T) {
    const sealed = await sealRecord(this.key, collection, id, value);
    await request(this.records('readwrite').put({ k: `${collection}\u0000${id}`, c: collection, id, ...sealed } satisfies Row));
  }

  async delete(collection: Collection, id: string) {
    await request(this.records('readwrite').delete(`${collection}\u0000${id}`));
  }

  async list<T>(collection: Collection) {
    const rows = await request<Row[]>(this.records('readonly').index('c').getAll(collection));
    const values = await Promise.all(rows.map((row) => this.open<T>(row)));
    return values.filter((value): value is Awaited<T> => value !== undefined) as T[];
  }

  async clear() {
    await request(this.records('readwrite').clear());
  }
}

/**
 * Abrir y borrar van en fila: el borrado tras un 401 al arrancar no se cruza con la apertura del
 * inicio de sesión que llega justo después.
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

/** Cuenta dueña de la copia local guardada (para arrancar sin conexión con ella). */
export async function offlineOwner(): Promise<string | null> {
  return ((await SecureStorage.getItem(OWNER).catch(() => null)) as string | null) ?? null;
}

/** Borra la copia local y la clave de quien la tenía (cerrar sesión, 401, otra cuenta). */
export const clearOfflineStore = (): Promise<void> => serial(clear);

async function clear(): Promise<void> {
  const owner = (await SecureStorage.getItem(OWNER).catch(() => null)) as string | null;
  // Sin dueño no hay copia que borrar (la base se crea siempre después de guardar el dueño)
  if (!owner) return;
  await deleteDatabase();
  await SecureStorage.removeItem(keyName(owner)).catch(() => {});
  await SecureStorage.removeItem(OWNER).catch(() => {});
}

/** Abre la copia local de una cuenta; la de otra cuenta se borra antes. */
export const openOfflineStore = (userId: string): Promise<OfflineStore> => serial(() => open(userId));

async function open(userId: string): Promise<OfflineStore> {
  // Un fallo al leer el llavero no es «sin clave»: se propaga, para no borrar la copia ni la cola
  const owner = (await SecureStorage.getItem(OWNER)) as string | null;
  if (owner !== userId) await clear();
  const saved = (await SecureStorage.getItem(keyName(userId))) as string | null;
  let key: CryptoKey;
  if (saved) key = await importRecordKey(saved);
  else {
    // Sin clave, lo que hubiera guardado ya no se puede leer: se empieza de cero
    await deleteDatabase();
    const fresh = await newRecordKey();
    await SecureStorage.setItem(keyName(userId), fresh.exported);
    key = fresh.key;
  }
  await SecureStorage.setItem(OWNER, userId);
  return new EncryptedStore(await openDatabase(), key);
}
