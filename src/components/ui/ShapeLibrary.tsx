/** Saved-shape library panel (bottom-left, above the minimap). */
import { useMemo, useState } from 'react';
import type { CanvasElement, LibraryItem } from '../../types';
import { useShapeLibraryStore } from '../../store/shapeLibraryStore';
import { useElementStore } from '../../store/elementStore';
import { useToolStore } from '../../store/toolStore';
import { historyActions } from '../../hooks/useHistory';
import { getSelectedElements, getViewportCenterWorld } from '../../utils/actions';
import { cloneElementsForPaste } from '../../utils/sanitizeElements';
import { getElementsBounds, getLineEndpoints } from '../../utils/geometry';
import { Icon } from '../ui/Icon';

/** Simplified (non-rough) thumbnail of saved elements. */
function renderThumbnail(elements: CanvasElement[]): string {
  const W = 120;
  const H = 80;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(2, 2);

  const bounds = getElementsBounds(elements);
  if (!bounds) return canvas.toDataURL();
  const scale = Math.min((W - 16) / Math.max(1, bounds.width), (H - 16) / Math.max(1, bounds.height), 2);
  const ox = (W - bounds.width * scale) / 2 - bounds.x * scale;
  const oy = (H - bounds.height * scale) / 2 - bounds.y * scale;
  const tx = (x: number) => x * scale + ox;
  const ty = (y: number) => y * scale + oy;

  for (const el of [...elements].sort((a, b) => a.zIndex - b.zIndex)) {
    ctx.strokeStyle = el.strokeColor === 'transparent' ? '#999' : el.strokeColor;
    ctx.lineWidth = Math.max(1, el.strokeWidth * scale * 0.75);
    ctx.globalAlpha = el.opacity;
    const x = tx(el.x);
    const y = ty(el.y);
    const w = Math.abs(el.width) * scale;
    const h = Math.abs(el.height) * scale;
    const fill = el.fillColor !== 'transparent';
    if (fill) ctx.fillStyle = el.fillColor;

    switch (el.type) {
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        if (fill) ctx.fill();
        ctx.stroke();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w / 2, y + h);
        ctx.lineTo(x, y + h / 2);
        ctx.closePath();
        if (fill) ctx.fill();
        ctx.stroke();
        break;
      case 'line':
      case 'arrow': {
        const [s, e] = getLineEndpoints(el);
        ctx.beginPath();
        ctx.moveTo(tx(s.x), ty(s.y));
        ctx.lineTo(tx(e.x), ty(e.y));
        ctx.stroke();
        break;
      }
      case 'freehand': {
        const pts = el.points ?? [];
        if (pts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(tx(el.x + pts[0].x), ty(el.y + pts[0].y));
          for (const p of pts) ctx.lineTo(tx(el.x + p.x), ty(el.y + p.y));
          ctx.stroke();
        }
        break;
      }
      case 'text':
        ctx.font = `${Math.max(6, (el.fontSize ?? 16) * scale)}px sans-serif`;
        ctx.fillStyle = el.strokeColor;
        ctx.fillText((el.text ?? '').split('\n')[0].slice(0, 18), x, y + Math.max(6, (el.fontSize ?? 16) * scale));
        break;
      default:
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, Math.min(4, el.edgeRoundness * scale));
        if (fill) ctx.fill();
        ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  return canvas.toDataURL();
}

function Thumb({ item, onInsert, onRemove }: { item: LibraryItem; onInsert: () => void; onRemove: () => void }) {
  const src = useMemo(() => renderThumbnail(item.elements), [item.elements]);
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onInsert}
        className="block w-full overflow-hidden rounded-xl bg-black/[0.03] ring-1 ring-black/[0.06] transition-all hover:ring-indigo-400 active:scale-[0.97] dark:bg-white/[0.04] dark:ring-white/[0.08]"
        aria-label={`Insert ${item.name}`}
      >
        <img src={src} alt={item.name} width={120} height={80} className="h-20 w-full object-contain" draggable={false} />
      </button>
      <p className="mt-1 truncate text-center text-[11px] opacity-60">{item.name}</p>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.name}`}
        className="ui-btn absolute -top-1.5 -right-1.5 h-5 w-5 bg-white opacity-0 shadow ring-1 ring-black/10 transition-opacity group-hover:opacity-100 dark:bg-gray-800 dark:ring-white/15"
      >
        <Icon name="close" size={9} strokeWidth={2.4} />
      </button>
    </div>
  );
}

export function ShapeLibrary() {
  const { items, isOpen, addItem, removeItem, setOpen } = useShapeLibraryStore();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const hasSelection = useToolStore((s) => s.selectedIds.length > 0);

  if (!isOpen) return null;

  const saveSelection = () => {
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    addItem(name.trim() || `Shape ${items.length + 1}`, selected);
    setName('');
    setSaving(false);
  };

  const insert = (item: LibraryItem) => {
    const center = getViewportCenterWorld();
    const bounds = getElementsBounds(item.elements);
    if (!bounds) return;
    historyActions.saveSnapshot();
    const store = useElementStore.getState();
    // Fresh ids; groups/bindings cleared; recentered on the viewport.
    const clones = cloneElementsForPaste(
      item.elements.map((el) => ({ ...el, groupId: undefined, startBinding: undefined, endBinding: undefined })),
      center.x - (bounds.x + bounds.width / 2),
      center.y - (bounds.y + bounds.height / 2),
      store.getMaxZIndex() + 1
    );
    store.addElements(clones);
    useToolStore.getState().setSelectedIds(clones.map((c) => c.id));
    useToolStore.getState().setActiveTool('select');
    setOpen(false);
  };

  return (
    <div className="panel animate-in pointer-events-auto fixed bottom-20 left-4 z-40 w-[296px]">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h2 className="text-[13px] font-semibold">Shape library</h2>
        <button type="button" className="ui-btn h-6.5 w-6.5" onClick={() => setOpen(false)} aria-label="Close library">
          <Icon name="close" size={12} />
        </button>
      </div>

      <div className="px-3 pb-3">
        {saving ? (
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') saveSelection();
                if (e.key === 'Escape') setSaving(false);
              }}
              placeholder={`Shape ${items.length + 1}`}
              className="w-full rounded-lg border border-black/10 bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none focus:border-indigo-400 dark:border-white/10"
            />
            <button
              type="button"
              className="rounded-lg bg-indigo-500 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-600"
              onClick={saveSelection}
            >
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => setSaving(true)}
            className={`mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/15 py-2 text-[12.5px] font-medium transition-colors dark:border-white/15 ${
              hasSelection ? 'hover:border-indigo-400 hover:text-indigo-500' : 'opacity-40'
            }`}
          >
            <Icon name="plus" size={13} strokeWidth={2.2} />
            Save selection to library
          </button>
        )}

        {items.length === 0 ? (
          <p className="px-2 py-5 text-center text-[12px] leading-relaxed opacity-45">
            No saved shapes yet.
            <br />
            Select elements and click Save.
          </p>
        ) : (
          <div className="grid max-h-72 grid-cols-2 gap-2.5 overflow-y-auto p-1">
            {items.map((item) => (
              <Thumb key={item.id} item={item} onInsert={() => insert(item)} onRemove={() => removeItem(item.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
