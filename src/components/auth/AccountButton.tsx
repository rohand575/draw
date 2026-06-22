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
      <>
        <div className="toolbar-divider mx-1.5" />
        <button
          type="button"
          onClick={openDialog}
          className="flex h-9 items-center gap-2 rounded-xl border border-black/[0.08] px-3 text-[13px] font-medium transition-colors hover:bg-black/[0.045] active:scale-[0.97] dark:border-white/[0.1] dark:hover:bg-white/[0.06]"
        >
          <Icon name="user" size={15} strokeWidth={2} className="opacity-70" />
          Sign in
        </button>
      </>
    );
  }

  const initial = (user?.email?.trim()?.[0] ?? 'U').toUpperCase();

  return (
    <>
      <div className="toolbar-divider mx-1.5" />
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          title={syncLabel(sync.state, sync.lastSyncedAt)}
          className="flex h-9 items-center gap-1.5 rounded-xl pr-1.5 pl-1 transition-colors hover:bg-black/[0.045] active:scale-[0.97] dark:hover:bg-white/[0.06]"
        >
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-[12px] font-semibold text-white shadow-[0_2px_6px_-1px_rgb(79_70_229/0.5)] ring-1 ring-white/15">
            {initial}
            <span
              className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white transition-colors dark:border-[#181820] ${SYNC_DOT[sync.state]}`}
            />
          </span>
          <Icon name="chevronDown" size={14} className={`opacity-40 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

      {open && (
        <div className="panel animate-in absolute top-full right-0 z-50 mt-2 w-[270px] overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-[15px] font-semibold text-white shadow-[0_2px_6px_-1px_rgb(79_70_229/0.5)] ring-1 ring-white/15">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{user?.email ?? 'Signed in'}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] opacity-60">
                <span className={`h-1.5 w-1.5 rounded-full ${SYNC_DOT[sync.state]}`} />
                {syncLabel(sync.state, sync.lastSyncedAt)}
                {sync.pendingCount > 0 && ` · ${sync.pendingCount} pending`}
              </p>
            </div>
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
    </>
  );
}
