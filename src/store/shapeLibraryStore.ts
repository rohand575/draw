import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { CanvasElement, LibraryItem } from '../types';
import { LS_SHAPE_LIBRARY } from '../constants';

interface ShapeLibraryStore {
  items: LibraryItem[];
  isOpen: boolean;

  addItem: (name: string, elements: CanvasElement[]) => void;
  removeItem: (id: string) => void;
  renameItem: (id: string, name: string) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

function load(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(LS_SHAPE_LIBRARY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(items: LibraryItem[]) {
  try {
    localStorage.setItem(LS_SHAPE_LIBRARY, JSON.stringify(items));
  } catch {
    /* quota / unavailable */
  }
}

export const useShapeLibraryStore = create<ShapeLibraryStore>((set) => ({
  items: load(),
  isOpen: false,

  addItem: (name, elements) =>
    set((s) => {
      const items = [...s.items, { id: nanoid(), name, elements: structuredClone(elements) }];
      persist(items);
      return { items };
    }),

  removeItem: (id) =>
    set((s) => {
      const items = s.items.filter((i) => i.id !== id);
      persist(items);
      return { items };
    }),

  renameItem: (id, name) =>
    set((s) => {
      const items = s.items.map((i) => (i.id === id ? { ...i, name } : i));
      persist(items);
      return { items };
    }),

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
}));
