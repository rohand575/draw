/** Top-bar account chip: sign-in entry point, or account + sync-status menu. */
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore, type SyncState } from '../../store/syncStore';
import { isCloudConfigured } from '../../lib/supabase';
import { requestFullSync } from '../../utils/cloudSync';
import { Icon } from '../ui/Icon';

const SYNC_DOT: Record<SyncState, string> = {
  idle: 'bg-emerald-400/90',
  syncing: 'bg-amber-400 animate-pulse',
  offline: 'bg-gray-400',
  error: 'bg-red-500',
};

function syncLabel(state: SyncState, lastSyncedAt: number | null): string {
  if (state === 'syncing') return 'Syncing…';
  if (state === 'offline') return 'Offline — changes saved locally';
  if (state === 'error') return 'Sync error — will retry';
  if (lastSyncedAt) {
    const mins = Math.floor((Date.now() - lastSyncedAt) / 60000);
    if (mins < 1) return 'All changes synced';
    if (mins < 60) return `Synced ${mins} min ago`;
    return 'Synced';
  }
  return 'All changes synced';
}

export function AccountButton() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const openDialog = useAuthStore((s) => s.openDialog);
  const sync = useSyncStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  // Hidden entirely when cloud isn't configured, or while auth is resolving.
  if (!isCloudConfigured || status === 'loading') return null;

  if (status === 'signed-out') {
    return (
      <button
        type="button"
        onClick={openDialog}
        className="panel pointer-events-auto flex h-11 items-center gap-2 px-3.5 text-[13px] font-semibold transition-transform active:scale-[0.98]"
      >
        <Icon name="user" size={16} />
        Sign in
      </button>
    );
  }

  return (
    <div ref={rootRef} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={syncLabel(sync.state, sync.lastSyncedAt)}
        className="panel flex h-11 items-center gap-2 px-2.5 transition-transform active:scale-[0.98]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
          <Icon name="user" size={15} strokeWidth={2} />
        </span>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${SYNC_DOT[sync.state]}`} />
        <Icon name="chevronDown" size={13} className={`opacity-45 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="panel animate-in absolute top-full right-0 z-50 mt-2 w-[270px] overflow-hidden">
          <div className="px-4 pt-3.5 pb-3">
            <p className="truncate text-[13px] font-semibold">{user?.email ?? 'Signed in'}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] opacity-60">
              <span className={`h-1.5 w-1.5 rounded-full ${SYNC_DOT[sync.state]}`} />
              {syncLabel(sync.state, sync.lastSyncedAt)}
              {sync.pendingCount > 0 && ` · ${sync.pendingCount} pending`}
            </p>
          </div>

          <div className="border-t border-black/[0.06] p-1.5 dark:border-white/[0.07]">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-black/[0.05] disabled:opacity-50 dark:hover:bg-white/[0.07]"
              disabled={sync.state === 'syncing'}
              onClick={() => void requestFullSync()}
            >
              <Icon name="cloud" size={15} className="opacity-70" />
              Sync now
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-red-500 transition-colors hover:bg-red-500/10"
              onClick={() => {
                setOpen(false);
                void useAuthStore.getState().signOut();
              }}
            >
              <Icon name="signOut" size={15} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
