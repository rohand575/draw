import { create } from 'zustand';
import type { FindMatch } from '../types';

export type FindMode = 'canvas' | 'text';

interface FindStore {
  isOpen: boolean;
  mode: FindMode;
  query: string;
  /** Canvas-mode matches across element text fields. */
  matches: FindMatch[];
  /** Text-mode matches within the active inline editor. */
  textMatches: { start: number; end: number }[];
  activeIndex: number;

  open: (mode: FindMode) => void;
  close: () => void;
  setQuery: (q: string) => void;
  setMatches: (m: FindMatch[]) => void;
  setTextMatches: (m: { start: number; end: number }[]) => void;
  setActiveIndex: (i: number) => void;
  next: () => void;
  prev: () => void;
}

export const useFindStore = create<FindStore>((set, get) => ({
  isOpen: false,
  mode: 'canvas',
  query: '',
  matches: [],
  textMatches: [],
  activeIndex: 0,

  open: (mode) => set({ isOpen: true, mode, activeIndex: 0 }),
  close: () => set({ isOpen: false, query: '', matches: [], textMatches: [], activeIndex: 0 }),
  setQuery: (query) => set({ query }),
  setMatches: (matches) => set({ matches }),
  setTextMatches: (textMatches) => set({ textMatches }),
  setActiveIndex: (activeIndex) => set({ activeIndex }),

  next: () => {
    const total = get().mode === 'canvas' ? get().matches.length : get().textMatches.length;
    if (total === 0) return;
    set({ activeIndex: (get().activeIndex + 1) % total });
  },
  prev: () => {
    const total = get().mode === 'canvas' ? get().matches.length : get().textMatches.length;
    if (total === 0) return;
    set({ activeIndex: (get().activeIndex - 1 + total) % total });
  },
}));
