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

function openDatabase(): Promise<IDBDatabase> {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    const records = req.result.createObjectStore(RECORDS, { keyPath: 'k' });
    records.createIndex('c', 'c');
  };
  return request(req);
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
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

/** Borra la copia local y la clave de quien la tenía (cerrar sesión, 401, otra cuenta). */
export async function clearOfflineStore(): Promise<void> {
  const owner = (await SecureStorage.getItem(OWNER).catch(() => null)) as string | null;
  await deleteDatabase();
  if (owner) await SecureStorage.removeItem(keyName(owner)).catch(() => {});
  await SecureStorage.removeItem(OWNER).catch(() => {});
}

/** Abre la copia local de una cuenta; la de otra cuenta se borra antes. */
export async function openOfflineStore(userId: string): Promise<OfflineStore> {
  const owner = (await SecureStorage.getItem(OWNER).catch(() => null)) as string | null;
  if (owner !== userId) await clearOfflineStore();
  const saved = (await SecureStorage.getItem(keyName(userId)).catch(() => null)) as string | null;
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
