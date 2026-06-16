import { create } from 'zustand';
import type { CanvasElement } from '../types';
import { MAX_HISTORY } from '../constants';

interface HistoryStore {
  past: CanvasElement[][];
  future: CanvasElement[][];

  pushState: (elements: CanvasElement[]) => void;
  /** Pops the latest past entry without applying it (degenerate-draw cleanup). */
  popState: () => void;
  undo: (current: CanvasElement[]) => CanvasElement[] | null;
  redo: (current: CanvasElement[]) => CanvasElement[] | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

const deepCopy = (els: CanvasElement[]): CanvasElement[] => structuredClone(els);

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],

  pushState: (elements) =>
    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), deepCopy(elements)],
      future: [],
    })),

  popState: () => set((s) => ({ past: s.past.slice(0, -1) })),

  undo: (current) => {
    const { past } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [...s.future, deepCopy(current)],
    }));
    return previous;
  },

  redo: (current) => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[future.length - 1];
    set((s) => ({
      future: s.future.slice(0, -1),
      past: [...s.past, deepCopy(current)],
    }));
    return next;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clear: () => set({ past: [], future: [] }),
}));
