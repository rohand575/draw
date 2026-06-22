/** IndexedDB persistence for multi-canvas documents. */
import { openDB, type IDBPDatabase } from 'idb';
import type { CanvasDocument, CanvasDocumentMeta } from '../types';
import { DB_NAME, DB_VERSION, STORE_NAME } from '../constants';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllCanvasMetas(): Promise<CanvasDocumentMeta[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE_NAME)) as CanvasDocument[];
  return all
    .map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCanvasDocument(id: string): Promise<CanvasDocument | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id) as Promise<CanvasDocument | undefined>;
}

/** Full documents (not just metas) — used by cloud sync to reconcile/upload. */
export async function getAllCanvasDocuments(): Promise<CanvasDocument[]> {
  const db = await getDB();
  return (await db.getAll(STORE_NAME)) as CanvasDocument[];
}

export async function putCanvasDocument(doc: CanvasDocument): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, doc);
}

export async function deleteCanvasDocument(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}
