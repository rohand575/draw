/** Top-left document chip → canvas switcher panel (rename / delete / create). */
import { useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '../../store/documentStore';
import { Icon } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function CanvasSwitcher() {
  const { currentCanvasId, canvasList, isSaving } = useDocumentStore();
  const [open, setOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = canvasList.find((m) => m.id === currentCanvasId);
  const menuMeta = canvasList.find((m) => m.id === menuFor);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMenuFor(null);
        setRenamingId(null);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setMenuFor(null);
        setRenamingId(null);
      }
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      void useDocumentStore.getState().renameCanvas(renamingId, renameValue);
    }
    setRenamingId(null);
  };

  return (
    <div ref={rootRef} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="panel flex h-12 items-center gap-2.5 py-2 pr-3 pl-2 transition-transform active:scale-[0.98]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_2px_6px_-1px_rgb(79_70_229/0.5)] ring-1 ring-white/15">
          <Icon name="canvasDoc" size={16} strokeWidth={2} />
        </span>
        <span className="max-w-40 truncate text-[13.5px] font-semibold tracking-[-0.01em]">{current?.name ?? 'Canvas'}</span>
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium opacity-50" title={isSaving ? 'Saving…' : 'All changes saved'}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${isSaving ? 'bg-amber-400' : 'bg-emerald-400/80'}`} />
          {isSaving ? 'Saving…' : 'Saved'}
        </span>
        <Icon name="chevronDown" size={14} className={`opacity-40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="panel animate-in absolute top-0 left-full z-50 ml-2 w-[330px] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
            <span className="text-[11px] font-semibold tracking-widest uppercase opacity-45">Canvases</span>
            <span className="text-[11px] tabular-nums opacity-35">{canvasList.length}</span>
          </div>

          <div className="max-h-80 overflow-y-auto px-1.5 pb-1.5">
            {canvasList.length === 0 && (
              <p className="px-3 py-6 text-center text-[12.5px] opacity-45">No canvases yet. Create one below.</p>
            )}
            {canvasList.map((meta) => {
              const active = meta.id === currentCanvasId;
              return (
                <div
                  key={meta.id}
                  className={`group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
                    active ? 'bg-indigo-500/[0.08]' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon name="canvasDoc" size={16} className={active ? 'text-indigo-500' : 'opacity-40'} />
                  {renamingId === meta.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={commitRename}
                      className="w-full rounded-md border border-indigo-400 bg-transparent px-1.5 py-0.5 text-[13px] outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      className={`flex-1 truncate text-left text-[13px] ${active ? 'cursor-text' : ''}`}
                      title={active ? 'Click to rename' : 'Open canvas'}
                      onClick={() => {
                        if (active) {
                          // Already on this canvas → click the name to rename it inline.
                          setRenamingId(meta.id);
                          setRenameValue(meta.name);
                        } else {
                          void useDocumentStore.getState().openCanvas(meta.id);
                          setOpen(false);
                        }
                      }}
                      onDoubleClick={() => {
                        setRenamingId(meta.id);
                        setRenameValue(meta.name);
                      }}
                    >
                      <span className={active ? 'font-semibold text-indigo-500' : ''}>{meta.name}</span>
                    </button>
                  )}
                  {active && renamingId !== meta.id && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}

                  <button
                    type="button"
                    aria-label={`Options for ${meta.name}`}
                    aria-haspopup="menu"
                    className={`ui-btn h-6 w-6 hover:!opacity-100 ${menuFor === meta.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      setMenuAnchor(e.currentTarget.getBoundingClientRect());
                      setMenuFor((prev) => (prev === meta.id ? null : meta.id));
                    }}
                  >
                    <Icon name="dots" size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-black/[0.06] p-2 dark:border-white/[0.07]">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-500 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-600 active:scale-[0.98]"
              onClick={() => {
                void useDocumentStore.getState().createCanvas();
                setOpen(false);
              }}
            >
              <Icon name="plus" size={14} strokeWidth={2.2} />
              New canvas
            </button>
          </div>
        </div>
      )}

      {menuFor && menuAnchor && menuMeta && (
        <Menu
          anchor={menuAnchor}
          onClose={() => setMenuFor(null)}
          items={[
            {
              label: 'Rename',
              icon: 'pencilEdit',
              onSelect: () => {
                setRenamingId(menuMeta.id);
                setRenameValue(menuMeta.name);
              },
            },
            {
              label: 'Delete',
              icon: 'trash',
              danger: true,
              onSelect: () => setConfirmDelete({ id: menuMeta.id, name: menuMeta.name }),
            },
          ]}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          danger
          icon="trash"
          title={`Delete “${confirmDelete.name}”?`}
          description="This canvas and everything on it will be permanently removed. This can’t be undone."
          confirmLabel="Delete"
          onConfirm={() => {
            void useDocumentStore.getState().deleteCanvas(confirmDelete.id);
            setConfirmDelete(null);
            setOpen(false);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
