/** Bridge between elementStore and historyStore. */
import { useCallback, useRef } from 'react';
import { useElementStore } from '../store/elementStore';
import { useHistoryStore } from '../store/historyStore';
import { useToolStore } from '../store/toolStore';

export function useHistory() {
  const isUndoRedoRef = useRef(false);

  const saveSnapshot = useCallback(() => {
    if (isUndoRedoRef.current) return;
    useHistoryStore.getState().pushState(useElementStore.getState().elements);
  }, []);

  const popSnapshot = useCallback(() => {
    useHistoryStore.getState().popState();
  }, []);

  const undo = useCallback(() => {
    const current = useElementStore.getState().elements;
    const previous = useHistoryStore.getState().undo(current);
    if (previous) {
      isUndoRedoRef.current = true;
      useElementStore.getState().setElements(structuredClone(previous));
      pruneSelection();
      isUndoRedoRef.current = false;
    }
  }, []);

  const redo = useCallback(() => {
    const current = useElementStore.getState().elements;
    const next = useHistoryStore.getState().redo(current);
    if (next) {
      isUndoRedoRef.current = true;
      useElementStore.getState().setElements(structuredClone(next));
      pruneSelection();
      isUndoRedoRef.current = false;
    }
  }, []);

  return { saveSnapshot, popSnapshot, undo, redo };
}

/** Drop selection entries that no longer exist after an undo/redo. */
function pruneSelection() {
  const ids = new Set(useElementStore.getState().elements.map((e) => e.id));
  const { selectedIds, setSelectedIds } = useToolStore.getState();
  const pruned = selectedIds.filter((id) => ids.has(id));
  if (pruned.length !== selectedIds.length) setSelectedIds(pruned);
}

/** Imperative helpers for non-hook contexts (context menu, etc.). */
export const historyActions = {
  saveSnapshot: () => useHistoryStore.getState().pushState(useElementStore.getState().elements),
  popSnapshot: () => useHistoryStore.getState().popState(),
  undo: () => {
    const current = useElementStore.getState().elements;
    const previous = useHistoryStore.getState().undo(current);
    if (previous) {
      useElementStore.getState().setElements(structuredClone(previous));
      pruneSelection();
    }
  },
  redo: () => {
    const current = useElementStore.getState().elements;
    const next = useHistoryStore.getState().redo(current);
    if (next) {
      useElementStore.getState().setElements(structuredClone(next));
      pruneSelection();
    }
  },
};
