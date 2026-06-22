/**
 * Cloud sync engine — keeps local IndexedDB canvases mirrored to the Supabase
 * `canvases` table for the signed-in user.
 *
 * Model (single-user, multi-device):
 *   - Local-first: IndexedDB stays the fast source of truth; the cloud is a mirror.
 *   - Push: edits are queued and flushed to the cloud on a debounce.
 *   - Pull: a full two-way merge runs on sign-in, window focus, and "Sync now".
 *   - Conflicts: last-write-wins per canvas, compared on `updatedAt`.
 *   - Deletes: soft-delete tombstones so a delete on one device propagates.
 *   - Offline: push/delete intents persist in localStorage and flush on reconnect.
 *
 * Decoupled from documentStore via `setAfterSyncHandler` to avoid an import cycle.
 */
import { supabase, isCloudConfigured, CANVASES_TABLE } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useSyncStore } from '../store/syncStore';
import {
  deleteCanvasDocument,
  getAllCanvasDocuments,
  getCanvasDocument,
  putCanvasDocument,
} from './persistence';
import type { CanvasDocument, CanvasElement, CanvasState } from '../types';
import { CLOUD_PUSH_DEBOUNCE_MS, LS_PENDING_PUSH, LS_PENDING_DELETE } from '../constants';

/** Row shape of the `canvases` table. */
interface CanvasRow {
  id: string;
  user_id: string;
  name: string;
  data: { elements: CanvasElement[]; canvasState: CanvasState };
  created_at: number | string; // bigint epoch-ms (PostgREST may serialize as string)
  updated_at: number | string;
  deleted: boolean;
}

const DEFAULT_NAME = /^Untitled \d+$/;

function rowToDoc(row: CanvasRow): CanvasDocument {
  return {
    id: row.id,
    name: row.name,
    elements: row.data?.elements ?? [],
    canvasState: row.data?.canvasState ?? { offsetX: 0, offsetY: 0, zoom: 1 },
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deleted: row.deleted,
  };
}

function docToRow(doc: CanvasDocument, userId: string): CanvasRow {
  return {
    id: doc.id,
    user_id: userId,
    name: doc.name,
    data: { elements: doc.elements, canvasState: doc.canvasState },
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    deleted: false,
  };
}

// ---------------------------------------------------------------------------
// Persistent offline queues (ids only — content is re-read from IndexedDB).
// ---------------------------------------------------------------------------
function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* storage full / unavailable — best effort */
  }
}

const pendingPush = loadSet(LS_PENDING_PUSH);
const pendingDelete = loadSet(LS_PENDING_DELETE);

function persistQueues() {
  saveSet(LS_PENDING_PUSH, pendingPush);
  saveSet(LS_PENDING_DELETE, pendingDelete);
  useSyncStore.getState().setPending(pendingPush.size + pendingDelete.size);
}

// ---------------------------------------------------------------------------
// Wiring helpers
// ---------------------------------------------------------------------------
type AfterSync = (reapplyCurrent: boolean) => Promise<void> | void;
let afterSync: AfterSync | null = null;

/** documentStore registers here so sync can refresh the in-memory canvas list. */
export function setAfterSyncHandler(fn: AfterSync) {
  afterSync = fn;
}

function userId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}
function online(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
function offlineKind(): 'offline' | 'error' {
  return online() ? 'error' : 'offline';
}

// ---------------------------------------------------------------------------
// Push queue + flush
// ---------------------------------------------------------------------------
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let busy = false; // serializes flush() and fullSync() — only one talks to the network

/** Queue a canvas to be pushed to the cloud (debounced). */
export function queuePush(doc: CanvasDocument) {
  if (!isCloudConfigured || !userId()) return;
  pendingPush.add(doc.id);
  pendingDelete.delete(doc.id);
  persistQueues();
  scheduleFlush();
}

/** Queue a canvas deletion to be tombstoned in the cloud. */
export function queueDelete(id: string) {
  if (!isCloudConfigured || !userId()) return;
  pendingPush.delete(id);
  pendingDelete.add(id);
  persistQueues();
  scheduleFlush();
}

function scheduleFlush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void flush();
  }, CLOUD_PUSH_DEBOUNCE_MS);
}

/** Drains both queues to the network. Throws on the first failure. */
async function drainQueues(uid: string): Promise<void> {
  for (const id of [...pendingDelete]) {
    const { error } = await supabase!
      .from(CANVASES_TABLE)
      .update({ deleted: true, updated_at: Date.now() })
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw error;
    pendingDelete.delete(id);
    persistQueues();
  }
  for (const id of [...pendingPush]) {
    const doc = await getCanvasDocument(id);
    if (!doc) {
      // Deleted locally before it ever pushed — nothing to upload.
      pendingPush.delete(id);
      persistQueues();
      continue;
    }
    const { error } = await supabase!.from(CANVASES_TABLE).upsert(docToRow(doc, uid), { onConflict: 'id' });
    if (error) throw error;
    pendingPush.delete(id);
    persistQueues();
  }
}

/** Flush queued pushes/deletes (called on debounce, reconnect, tab-hide). */
export async function flush(): Promise<void> {
  if (!supabase || !isCloudConfigured) return;
  const uid = userId();
  if (!uid) return;
  if (pendingPush.size === 0 && pendingDelete.size === 0) return;
  if (!online()) {
    useSyncStore.getState().setState('offline');
    return;
  }
  if (busy) return;

  busy = true;
  useSyncStore.getState().setState('syncing');
  try {
    await drainQueues(uid);
    useSyncStore.getState().markSynced();
  } catch (e) {
    useSyncStore.getState().setState(offlineKind(), (e as Error)?.message ?? null);
  } finally {
    busy = false;
  }
}

// ---------------------------------------------------------------------------
// Two-way merge
// ---------------------------------------------------------------------------
/**
 * Reconcile local and cloud for the signed-in user.
 * @param reapplyCurrent re-apply the open canvas from merged storage afterward
 *   (true on sign-in, false on focus to avoid clobbering active edits).
 */
export async function fullSync(reapplyCurrent = false): Promise<void> {
  if (!supabase || !isCloudConfigured) return;
  const uid = userId();
  if (!uid) return;
  if (!online()) {
    useSyncStore.getState().setState('offline');
    return;
  }
  if (busy) return;

  busy = true;
  useSyncStore.getState().setState('syncing');
  try {
    const { data, error } = await supabase.from(CANVASES_TABLE).select('*').eq('user_id', uid);
    if (error) throw error;
    const rows = (data ?? []) as CanvasRow[];

    const localDocs = await getAllCanvasDocuments();
    const localById = new Map(localDocs.map((d) => [d.id, d]));
    const cloudById = new Map(rows.map((r) => [r.id, r]));

    // 1) Cloud → local (newer cloud wins; tombstones delete locally).
    for (const row of rows) {
      const local = localById.get(row.id);
      if (row.deleted) {
        if (local) await deleteCanvasDocument(row.id);
        continue;
      }
      if (!local || Number(row.updated_at) > local.updatedAt) {
        await putCanvasDocument(rowToDoc(row));
      }
    }

    // 2) Local → cloud (auto-upload guest canvases; locally-newer wins).
    for (const local of localDocs) {
      if (pendingDelete.has(local.id)) continue;
      const row = cloudById.get(local.id);
      if (!row) {
        // Skip empty, never-touched default canvases so new devices don't
        // litter the account with blank "Untitled N" docs.
        if (local.elements.length > 0 || !DEFAULT_NAME.test(local.name)) {
          pendingPush.add(local.id);
        }
      } else if (!row.deleted && local.updatedAt > Number(row.updated_at)) {
        pendingPush.add(local.id);
      }
    }
    persistQueues();

    // 3) Push everything we just queued.
    await drainQueues(uid);
    useSyncStore.getState().markSynced();
  } catch (e) {
    useSyncStore.getState().setState(offlineKind(), (e as Error)?.message ?? null);
  } finally {
    busy = false;
  }

  // Refresh the in-memory list / open canvas from the merged storage.
  if (afterSync) await afterSync(reapplyCurrent);
}

/** Manual "Sync now" — full merge without re-applying the open canvas. */
export function requestFullSync(): Promise<void> {
  return fullSync(false);
}

// ---------------------------------------------------------------------------
// Auth lifecycle
// ---------------------------------------------------------------------------
/** Called when a user signs in: merge, then re-apply the open canvas. */
export async function onSignIn(): Promise<void> {
  await fullSync(true);
}

/** Called on sign-out: stop syncing and drop this session's pending queue. */
export function onSignOut(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  pendingPush.clear();
  pendingDelete.clear();
  persistQueues();
  useSyncStore.getState().setState('idle');
}
