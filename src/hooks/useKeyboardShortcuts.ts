/** Global keydown router — complete shortcut reference (§ shortcuts dialog). */
import { useEffect } from 'react';
import { COLOR_PALETTE, FONT_SIZES, STROKE_COLOR_SHORTCUTS, TOOLS } from '../constants';
import { useCanvasStore } from '../store/canvasStore';
import { useElementStore } from '../store/elementStore';
import { useFindStore } from '../store/findStore';
import { useToolStore } from '../store/toolStore';
import { useAIStore } from '../store/aiStore';
import { historyActions } from './useHistory';
import {
  applyStyleToSelection,
  bringForward,
  bringToFront,
  deleteSelection,
  duplicateSelection,
  getSelectedElements,
  getViewportCenterWorld,
  groupSelection,
  nudgeSelection,
  resetStyleSnapshotCoalescing,
  selectAll,
  sendBackward,
  sendToBack,
  toggleLockSelection,
  ungroupSelection,
  zoomToFit,
  zoomToSelection,
} from '../utils/actions';
import { copySelectionToClipboard, pasteFromClipboard } from '../utils/clipboard';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function setFontSizeStep(direction: 1 | -1) {
  const tool = useToolStore.getState();
  const selectedText = getSelectedElements().filter((el) => el.type === 'text' && !el.locked);
  const current = selectedText[0]?.fontSize ?? tool.fontSize;
  const idx = FONT_SIZES.findIndex((s) => s >= current);
  const base = idx === -1 ? FONT_SIZES.length - 1 : idx;
  const nextIdx = Math.min(FONT_SIZES.length - 1, Math.max(0, base + direction));
  const next = FONT_SIZES[nextIdx];
  tool.setFontSize(next);
  if (selectedText.length > 0) {
    resetStyleSnapshotCoalescing();
    applyStyleToSelection({ fontSize: next });
  }
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const typing = isTypingTarget(e.target);

      // While typing, only the find shortcut passes through (handled by the
      // editor/FindBar themselves); everything else stays native.
      if (typing) return;

      // --- Find -----------------------------------------------------------
      if (ctrl && key === 'f') {
        e.preventDefault();
        useFindStore.getState().open('canvas');
        return;
      }

      // --- History --------------------------------------------------------
      if (ctrl && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) historyActions.redo();
        else historyActions.undo();
        return;
      }
      if (ctrl && key === 'y') {
        e.preventDefault();
        historyActions.redo();
        return;
      }

      // --- Clipboard / selection ops --------------------------------------
      if (ctrl && key === 'c') {
        copySelectionToClipboard();
        return;
      }
      if (ctrl && key === 'v') {
        const c = getViewportCenterWorld();
        void pasteFromClipboard(c.x, c.y);
        return;
      }
      if (ctrl && key === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (ctrl && key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }

      // --- Grouping / lock --------------------------------------------------
      if (ctrl && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
        return;
      }
      if (ctrl && key === 'l') {
        e.preventDefault();
        toggleLockSelection();
        return;
      }

      // --- Z-order ----------------------------------------------------------
      if (ctrl && (key === ']' || e.code === 'BracketRight')) {
        e.preventDefault();
        if (e.shiftKey) bringToFront();
        else bringForward();
        return;
      }
      if (ctrl && (key === '[' || e.code === 'BracketLeft')) {
        e.preventDefault();
        if (e.shiftKey) sendToBack();
        else sendBackward();
        return;
      }

      // --- View -------------------------------------------------------------
      if (ctrl && key === '0') {
        e.preventDefault();
        useCanvasStore.getState().resetView();
        return;
      }
      if (ctrl && key === '1') {
        e.preventDefault();
        zoomToFit();
        return;
      }
      if (ctrl && key === '2') {
        e.preventDefault();
        zoomToSelection();
        return;
      }
      if (ctrl && (key === '=' || key === '+')) {
        e.preventDefault();
        useCanvasStore.getState().zoomIn(window.innerWidth / 2, window.innerHeight / 2);
        return;
      }
      if (ctrl && key === '-') {
        e.preventDefault();
        useCanvasStore.getState().zoomOut(window.innerWidth / 2, window.innerHeight / 2);
        return;
      }

      // --- Font size (Ctrl+Shift+< / >) --------------------------------------
      if (ctrl && e.shiftKey && (key === ',' || key === '<')) {
        e.preventDefault();
        setFontSizeStep(-1);
        return;
      }
      if (ctrl && e.shiftKey && (key === '.' || key === '>')) {
        e.preventDefault();
        setFontSizeStep(1);
        return;
      }

      if (ctrl) return; // unhandled ctrl combos stay native

      // --- Delete / escape / tab ---------------------------------------------
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (key === 'escape') {
        const { shortcutsOpen, setShortcutsOpen } = useCanvasStore.getState();
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
        if (useAIStore.getState().isOpen) {
          useAIStore.getState().setOpen(false);
          return;
        }
        const tool = useToolStore.getState();
        if (tool.selectedIds.length > 0) tool.clearSelection();
        else tool.setActiveTool('select');
        return;
      }
      if (key === 'tab') {
        e.preventDefault();
        const { elements } = useElementStore.getState();
        const unlocked = elements.filter((el) => !el.locked);
        if (unlocked.length === 0) return;
        const tool = useToolStore.getState();
        const currentIdx = unlocked.findIndex((el) => el.id === tool.selectedIds[0]);
        const nextIdx = e.shiftKey
          ? (currentIdx - 1 + unlocked.length) % unlocked.length
          : (currentIdx + 1) % unlocked.length;
        tool.setActiveTool('select');
        tool.setSelectedIds([unlocked[nextIdx].id]);
        return;
      }

      // --- Arrow-key nudges ---------------------------------------------------
      if (key.startsWith('arrow')) {
        const step = e.shiftKey ? 10 : 1;
        const map: Record<string, [number, number]> = {
          arrowup: [0, -step],
          arrowdown: [0, step],
          arrowleft: [-step, 0],
          arrowright: [step, 0],
        };
        const delta = map[key];
        if (delta && useToolStore.getState().selectedIds.length > 0) {
          e.preventDefault();
          nudgeSelection(delta[0], delta[1]);
        }
        return;
      }

      if (e.altKey) {
        // Alt+1–8 fill color, Alt+0 transparent fill.
        if (/^[0-8]$/.test(key)) {
          e.preventDefault();
          const fill = key === '0' ? 'transparent' : COLOR_PALETTE[parseInt(key, 10) - 1];
          if (fill !== undefined) {
            useToolStore.getState().setFillColor(fill);
            resetStyleSnapshotCoalescing();
            applyStyleToSelection({ fillColor: fill });
          }
        }
        return;
      }

      // --- Stroke colors 1–8 ----------------------------------------------------
      if (/^[1-8]$/.test(key)) {
        const color = STROKE_COLOR_SHORTCUTS[parseInt(key, 10) - 1];
        if (color) {
          useToolStore.getState().setStrokeColor(color);
          resetStyleSnapshotCoalescing();
          applyStyleToSelection({ strokeColor: color });
        }
        return;
      }

      // --- Tools + misc singles ---------------------------------------------------
      if (key === '?' || (key === '/' && e.shiftKey)) {
        useCanvasStore.getState().toggleShortcuts();
        return;
      }
      if (key === 'g') {
        useCanvasStore.getState().toggleGrid();
        return;
      }
      const tool = TOOLS.find((t) => t.shortcut.toLowerCase() === key);
      if (tool) {
        useToolStore.getState().setActiveTool(tool.id);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
