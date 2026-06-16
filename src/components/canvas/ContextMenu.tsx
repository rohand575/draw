/** Right-click contextual operations on selection or canvas. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useShapeLibraryStore } from '../../store/shapeLibraryStore';
import { useToolStore } from '../../store/toolStore';
import { historyActions } from '../../hooks/useHistory';
import {
  bringForward,
  bringToFront,
  deleteSelection,
  duplicateSelection,
  getSelectedElements,
  selectAll,
  sendBackward,
  sendToBack,
  groupSelection,
  toggleLockSelection,
  ungroupSelection,
  zoomToFit,
} from '../../utils/actions';
import { copySelectionToClipboard, pasteFromClipboard } from '../../utils/clipboard';
import { sanitizeHyperlink } from '../../utils/urlSafety';

export type DialogKind = 'embed-url' | 'hyperlink' | 'frame-name' | 'connector-label';

export interface ContextMenuState {
  x: number;
  y: number;
  /** World point where the menu was opened (paste target). */
  worldX: number;
  worldY: number;
  targetId: string | null;
}

interface Props {
  menu: ContextMenuState;
  onClose: () => void;
  onRequestDialog: (kind: DialogKind, elementId: string) => void;
  onInsertEmbed: (worldX: number, worldY: number) => void;
  onInsertImage: (worldX: number, worldY: number) => void;
}

interface Item {
  label: string;
  shortcut?: string;
  danger?: boolean;
  divider?: boolean;
  action: () => void;
}

export function ContextMenu({ menu, onClose, onRequestDialog, onInsertEmbed, onInsertImage }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.min(menu.x, window.innerWidth - r.width - 8),
      y: Math.min(menu.y, window.innerHeight - r.height - 8),
    });
  }, [menu.x, menu.y]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const elements = useElementStore.getState().elements;
  const target = menu.targetId ? elements.find((el) => el.id === menu.targetId) : null;
  const selected = getSelectedElements();
  const single = selected.length === 1;
  const anyLocked = selected.some((el) => el.locked);
  const hasGroup = selected.some((el) => el.groupId);
  const isConnector = target && (target.type === 'line' || target.type === 'arrow');

  const items: (Item | { divider: true })[] = [];

  if (target) {
    items.push(
      { label: 'Copy', shortcut: 'Ctrl+C', action: () => copySelectionToClipboard() },
      { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => duplicateSelection() },
      { divider: true },
      ...(single
        ? [
            { label: 'Bring forward', shortcut: 'Ctrl+]', action: bringForward },
            { label: 'Send backward', shortcut: 'Ctrl+[', action: sendBackward },
          ]
        : []),
      { label: 'Bring to front', shortcut: 'Ctrl+Shift+]', action: bringToFront },
      { label: 'Send to back', shortcut: 'Ctrl+Shift+[', action: sendToBack },
      { divider: true }
    );

    if (selected.length >= 2) items.push({ label: 'Group', shortcut: 'Ctrl+G', action: groupSelection });
    if (hasGroup) items.push({ label: 'Ungroup', shortcut: 'Ctrl+Shift+G', action: ungroupSelection });
    items.push({
      label: anyLocked ? 'Unlock' : 'Lock',
      shortcut: 'Ctrl+L',
      action: toggleLockSelection,
    });
    items.push({ divider: true });

    if (isConnector) {
      items.push({
        label: target.connectorStyle === 'elbow' ? 'Straight connector' : 'Elbow connector',
        action: () => {
          historyActions.saveSnapshot();
          useElementStore.getState().updateElement(target.id, {
            connectorStyle: target.connectorStyle === 'elbow' ? 'straight' : 'elbow',
          });
        },
      });
      items.push({
        label: target.connectorLabel ? 'Edit label' : 'Add label',
        action: () => onRequestDialog('connector-label', target.id),
      });
      items.push({ divider: true });
    }

    if (target.type === 'embed') {
      items.push({
        label: target.embedUrl ? 'Edit embed URL' : 'Add embed URL',
        action: () => onRequestDialog('embed-url', target.id),
      });
      items.push({ divider: true });
    }
    if (target.type === 'frame') {
      items.push({
        label: 'Rename frame',
        action: () => onRequestDialog('frame-name', target.id),
      });
      items.push({ divider: true });
    }

    items.push({
      label: target.hyperlink ? 'Edit link' : 'Add link',
      action: () => onRequestDialog('hyperlink', target.id),
    });
    if (target.hyperlink) {
      items.push({
        label: 'Open link',
        action: () => {
          const safe = sanitizeHyperlink(target.hyperlink!);
          if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
        },
      });
    }
    items.push({ divider: true });
    items.push({
      label: 'Add to library',
      action: () => {
        const lib = useShapeLibraryStore.getState();
        lib.addItem(`Shape ${lib.items.length + 1}`, selected);
        lib.setOpen(true);
      },
    });
    items.push({ divider: true });
    items.push({
      label: 'Delete',
      shortcut: 'Del',
      danger: true,
      action: deleteSelection,
    });
  } else {
    items.push(
      {
        label: 'Paste here',
        shortcut: 'Ctrl+V',
        action: () => void pasteFromClipboard(menu.worldX, menu.worldY),
      },
      { label: 'Select all', shortcut: 'Ctrl+A', action: selectAll },
      { divider: true },
      { label: 'Insert image…', action: () => onInsertImage(menu.worldX, menu.worldY) },
      { label: 'Insert embed…', action: () => onInsertEmbed(menu.worldX, menu.worldY) },
      { divider: true },
      {
        label: useCanvasStore.getState().showGrid ? 'Hide grid' : 'Show grid',
        shortcut: 'G',
        action: () => useCanvasStore.getState().toggleGrid(),
      },
      { label: 'Zoom to fit', shortcut: 'Ctrl+1', action: zoomToFit }
    );
    if (useToolStore.getState().selectedIds.length > 0) {
      items.push({ divider: true });
      items.push({ label: 'Deselect', shortcut: 'Esc', action: () => useToolStore.getState().clearSelection() });
    }
  }

  return (
    <div
      ref={ref}
      className="panel animate-in fixed z-[60] min-w-52 py-1.5"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
    >
      {items.map((item, i) =>
        'divider' in item && item.divider && !('label' in item) ? (
          <div key={i} className="mx-3 my-1 border-t border-black/[0.06] dark:border-white/[0.07]" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={`flex w-full items-center justify-between gap-6 px-3.5 py-1.5 text-left text-[13px] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07] ${
              (item as Item).danger ? 'text-red-500' : ''
            }`}
            onClick={() => {
              (item as Item).action();
              onClose();
            }}
          >
            <span>{(item as Item).label}</span>
            {(item as Item).shortcut && (
              <span className="text-[11px] opacity-40">{(item as Item).shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  );
}
