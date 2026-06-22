/** Lightweight cloud-sync status, surfaced in the account chip. */
import { create } from 'zustand';

export type SyncState =
  | 'idle' // up to date, nothing pending
  | 'syncing' // a push/pull is in flight
  | 'offline' // no network; edits are queued locally
  | 'error'; // last sync attempt failed

interface SyncStore {
  state: SyncState;
  lastSyncedAt: number | null;
  pendingCount: number;
  error: string | null;
  setState: (state: SyncState, error?: string | null) => void;
  setPending: (pendingCount: number) => void;
  markSynced: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  state: 'idle',
  lastSyncedAt: null,
  pendingCount: 0,
  error: null,
  setState: (state, error = null) => set({ state, error }),
  setPending: (pendingCount) => set({ pendingCount }),
  markSynced: () => set({ state: 'idle', error: null, lastSyncedAt: Date.now() }),
}));
