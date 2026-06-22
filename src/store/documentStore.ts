import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { CanvasDocument, CanvasDocumentMeta } from '../types';
import {
  deleteCanvasDocument,
  getAllCanvasMetas,
  getCanvasDocument,
  putCanvasDocument,
} from '../utils/persistence';
import { queueDelete, queuePush } from '../utils/cloudSync';
import { useElementStore } from './elementStore';
import { useCanvasStore } from './canvasStore';
import { useHistoryStore } from './historyStore';
import { useToolStore } from './toolStore';

interface DocumentStore {
  currentCanvasId: string | null;
  canvasList: CanvasDocumentMeta[];
  isSaving: boolean;
  isLoading: boolean;

  init: () => Promise<void>;
  saveCurrentCanvas: () => Promise<void>;
  createCanvas: (name?: string) => Promise<void>;
  openCanvas: (id: string) => Promise<void>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  /** Re-sync the in-memory list/open canvas from storage after a cloud merge. */
  refreshAfterSync: (reapplyCurrent: boolean) => Promise<void>;
}

/** Serial save queue — concurrent saves never interleave. */
let saveQueue: Promise<void> = Promise.resolve();

function snapshotCurrentDoc(id: string, meta: CanvasDocumentMeta): CanvasDocument {
  const { elements } = useElementStore.getState();
  const { offsetX, offsetY, zoom, theme, showGrid } = useCanvasStore.getState();
  return {
    id,
    name: meta.name,
    elements: structuredClone(elements),
    canvasState: { offsetX, offsetY, zoom, theme, showGrid },
    createdAt: meta.createdAt,
    updatedAt: Date.now(),
  };
}

function applyDocument(doc: CanvasDocument) {
  useElementStore.getState().setElements(doc.elements ?? []);
  const cs = doc.canvasState;
  if (cs) {
    useCanvasStore.getState().loadState({ offsetX: cs.offsetX, offsetY: cs.offsetY, zoom: cs.zoom });
    if (cs.theme) useCanvasStore.getState().setTheme(cs.theme);
    if (typeof cs.showGrid === 'boolean' && useCanvasStore.getState().showGrid !== cs.showGrid) {
      useCanvasStore.getState().toggleGrid();
    }
  }
  useHistoryStore.getState().clear();
  useToolStore.getState().clearSelection();
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  currentCanvasId: null,
  canvasList: [],
  isSaving: false,
  isLoading: false,

  init: async () => {
    set({ isLoading: true });
    try {
      const metas = await getAllCanvasMetas();
      if (metas.length === 0) {
        const now = Date.now();
        const meta: CanvasDocumentMeta = { id: nanoid(), name: 'Untitled 1', createdAt: now, updatedAt: now };
        await putCanvasDocument({
          ...meta,
          elements: [],
          canvasState: { offsetX: 0, offsetY: 0, zoom: 1 },
        });
        set({ canvasList: [meta], currentCanvasId: meta.id });
      } else {
        set({ canvasList: metas });
        const doc = await getCanvasDocument(metas[0].id);
        if (doc) {
          applyDocument(doc);
          set({ currentCanvasId: doc.id });
        }
      }
    } finally {
      set({ isLoading: false });
    }
  },

  saveCurrentCanvas: () => {
    const { currentCanvasId, canvasList } = get();
    if (!currentCanvasId) return Promise.resolve();
    const meta = canvasList.find((m) => m.id === currentCanvasId);
    if (!meta) return Promise.resolve(); // canvas was deleted — don't resurrect it

    // Capture state at call time, write serially.
    const doc = snapshotCurrentDoc(currentCanvasId, meta);
    saveQueue = saveQueue
      .then(async () => {
        // Re-check existence right before writing (delete-then-save race).
        if (!get().canvasList.some((m) => m.id === doc.id)) return;
        set({ isSaving: true });
        await putCanvasDocument(doc);
        queuePush(doc); // mirror to cloud (no-op when signed out)
        set((s) => ({
          isSaving: false,
          canvasList: s.canvasList
            .map((m) => (m.id === doc.id ? { ...m, updatedAt: doc.updatedAt } : m))
            .sort((a, b) => b.updatedAt - a.updatedAt),
        }));
      })
      .catch(() => set({ isSaving: false }));
    return saveQueue;
  },

  createCanvas: async (name) => {
    await get().saveCurrentCanvas();
    const now = Date.now();
    const meta: CanvasDocumentMeta = {
      id: nanoid(),
      name: name || `Untitled ${get().canvasList.length + 1}`,
      createdAt: now,
      updatedAt: now,
    };
    await putCanvasDocument({ ...meta, elements: [], canvasState: { offsetX: 0, offsetY: 0, zoom: 1 } });
    set((s) => ({ canvasList: [meta, ...s.canvasList], currentCanvasId: meta.id }));
    useElementStore.getState().setElements([]);
    useCanvasStore.getState().resetView();
    useHistoryStore.getState().clear();
    useToolStore.getState().clearSelection();
  },

  openCanvas: async (id) => {
    if (id === get().currentCanvasId) return;
    set({ isLoading: true });
    try {
      await get().saveCurrentCanvas();
      const doc = await getCanvasDocument(id);
      if (doc) {
        applyDocument(doc);
        set({ currentCanvasId: id });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  renameCanvas: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      canvasList: s.canvasList.map((m) => (m.id === id ? { ...m, name: trimmed } : m)),
    }));
    const doc = await getCanvasDocument(id);
    if (doc) {
      const updated = { ...doc, name: trimmed, updatedAt: Date.now() };
      await putCanvasDocument(updated);
      queuePush(updated);
    }
  },

  deleteCanvas: async (id) => {
    const { currentCanvasId, canvasList } = get();
    await deleteCanvasDocument(id);
    queueDelete(id); // tombstone in cloud (no-op when signed out)
    const remaining = canvasList.filter((m) => m.id !== id);
    set({ canvasList: remaining });

    if (currentCanvasId === id) {
      if (remaining.length > 0) {
        set({ currentCanvasId: null });
        const doc = await getCanvasDocument(remaining[0].id);
        if (doc) {
          applyDocument(doc);
          set({ currentCanvasId: doc.id });
        }
      } else {
        set({ currentCanvasId: null });
        await get().createCanvas('Untitled 1');
      }
    }
  },

  refreshAfterSync: async (reapplyCurrent) => {
    const metas = await getAllCanvasMetas();
    const prevCurrent = get().currentCanvasId;

    // Everything was removed on another device — start fresh.
    if (metas.length === 0) {
      set({ canvasList: [], currentCanvasId: null });
      await get().createCanvas('Untitled 1');
      return;
    }

    set({ canvasList: metas });

    const stillExists = prevCurrent != null && metas.some((m) => m.id === prevCurrent);
    if (!stillExists) {
      // The open canvas was deleted elsewhere — open the most recent one.
      const doc = await getCanvasDocument(metas[0].id);
      if (doc) {
        applyDocument(doc);
        set({ currentCanvasId: doc.id });
      }
    } else if (reapplyCurrent) {
      // Sign-in merge: reflect any pulled changes to the open canvas.
      const doc = await getCanvasDocument(prevCurrent);
      if (doc) applyDocument(doc);
    }
  },
}));
