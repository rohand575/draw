import { create } from 'zustand';
import type { AlignType, CanvasElement, DistributeAxis } from '../types';
import { getConnectionPointAbsolute, getElementBounds, getElementsBounds } from '../utils/geometry';
import { cloneElementsForPaste } from '../utils/sanitizeElements';

interface ElementStore {
  elements: CanvasElement[];

  setElements: (els: CanvasElement[]) => void;
  addElement: (el: CanvasElement) => void;
  addElements: (els: CanvasElement[]) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>) => void;
  updateElements: (patches: Map<string, Partial<CanvasElement>>) => void;
  removeElements: (ids: string[]) => void;
  duplicateElements: (ids: string[], offsetX?: number, offsetY?: number) => CanvasElement[];
  clearAll: () => void;

  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  getMaxZIndex: () => number;

  groupElements: (ids: string[]) => void;
  ungroupElements: (ids: string[]) => void;
  lockElements: (ids: string[], locked: boolean) => void;

  alignElements: (ids: string[], type: AlignType) => void;
  distributeElements: (ids: string[], axis: DistributeAxis) => void;

  updateConnectorBindings: (movedShapeIds: string[]) => void;
}

export const useElementStore = create<ElementStore>((set, get) => ({
  elements: [],

  setElements: (els) => set({ elements: els }),
  addElement: (el) => set((s) => ({ elements: [...s.elements, el] })),
  addElements: (els) => set((s) => ({ elements: [...s.elements, ...els] })),

  updateElement: (id, patch) =>
    set((s) => ({
      elements: s.elements.map((el) => (el.id === id ? { ...el, ...patch, updatedAt: Date.now() } : el)),
    })),

  /** Batched variant — one commit / one subscriber notification. */
  updateElements: (patches) => {
    if (patches.size === 0) return;
    const now = Date.now();
    set((s) => ({
      elements: s.elements.map((el) => {
        const patch = patches.get(el.id);
        return patch ? { ...el, ...patch, updatedAt: now } : el;
      }),
    }));
  },

  removeElements: (ids) => {
    const drop = new Set(ids);
    set((s) => ({ elements: s.elements.filter((el) => !drop.has(el.id)) }));
  },

  duplicateElements: (ids, offsetX = 20, offsetY = 20) => {
    const { elements, getMaxZIndex } = get();
    const idSet = new Set(ids);
    const source = elements.filter((el) => idSet.has(el.id));
    if (source.length === 0) return [];
    const clones = cloneElementsForPaste(source, offsetX, offsetY, getMaxZIndex() + 1);
    set((s) => ({ elements: [...s.elements, ...clones] }));
    return clones;
  },

  clearAll: () => set({ elements: [] }),

  bringForward: (id) => {
    const sorted = [...get().elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((el) => el.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const a = sorted[idx];
    const b = sorted[idx + 1];
    get().updateElements(new Map([
      [a.id, { zIndex: b.zIndex }],
      [b.id, { zIndex: a.zIndex }],
    ]));
  },

  sendBackward: (id) => {
    const sorted = [...get().elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((el) => el.id === id);
    if (idx <= 0) return;
    const a = sorted[idx];
    const b = sorted[idx - 1];
    get().updateElements(new Map([
      [a.id, { zIndex: b.zIndex }],
      [b.id, { zIndex: a.zIndex }],
    ]));
  },

  bringToFront: (id) => {
    get().updateElement(id, { zIndex: get().getMaxZIndex() + 1 });
  },

  sendToBack: (id) => {
    const min = get().elements.reduce((m, el) => Math.min(m, el.zIndex), 0);
    get().updateElement(id, { zIndex: min - 1 });
  },

  getMaxZIndex: () => get().elements.reduce((m, el) => Math.max(m, el.zIndex), 0),

  groupElements: (ids) => {
    const groupId = crypto.randomUUID();
    const patches = new Map<string, Partial<CanvasElement>>();
    for (const id of ids) patches.set(id, { groupId });
    get().updateElements(patches);
  },

  ungroupElements: (ids) => {
    const patches = new Map<string, Partial<CanvasElement>>();
    for (const id of ids) patches.set(id, { groupId: undefined });
    get().updateElements(patches);
  },

  lockElements: (ids, locked) => {
    const patches = new Map<string, Partial<CanvasElement>>();
    for (const id of ids) patches.set(id, { locked });
    get().updateElements(patches);
  },

  alignElements: (ids, type) => {
    const { elements } = get();
    const idSet = new Set(ids);
    const targets = elements.filter((el) => idSet.has(el.id) && !el.locked);
    if (targets.length < 2) return;
    const union = getElementsBounds(targets);
    if (!union) return;

    const patches = new Map<string, Partial<CanvasElement>>();
    for (const el of targets) {
      const b = getElementBounds(el);
      let dx = 0;
      let dy = 0;
      switch (type) {
        case 'left':
          dx = union.x - b.x;
          break;
        case 'right':
          dx = union.x + union.width - (b.x + b.width);
          break;
        case 'centerX':
          dx = union.x + union.width / 2 - (b.x + b.width / 2);
          break;
        case 'top':
          dy = union.y - b.y;
          break;
        case 'bottom':
          dy = union.y + union.height - (b.y + b.height);
          break;
        case 'centerY':
          dy = union.y + union.height / 2 - (b.y + b.height / 2);
          break;
      }
      if (dx !== 0 || dy !== 0) patches.set(el.id, { x: el.x + dx, y: el.y + dy });
    }
    get().updateElements(patches);
    get().updateConnectorBindings(ids);
  },

  distributeElements: (ids, axis) => {
    const { elements } = get();
    const idSet = new Set(ids);
    const targets = elements.filter((el) => idSet.has(el.id) && !el.locked);
    if (targets.length < 3) return;

    const horizontal = axis === 'horizontal';
    const sorted = [...targets].sort((a, b) => {
      const ba = getElementBounds(a);
      const bb = getElementBounds(b);
      return horizontal ? ba.x - bb.x : ba.y - bb.y;
    });

    const first = getElementBounds(sorted[0]);
    const last = getElementBounds(sorted[sorted.length - 1]);
    const totalSize = sorted.reduce((sum, el) => {
      const b = getElementBounds(el);
      return sum + (horizontal ? b.width : b.height);
    }, 0);
    const span = horizontal ? last.x + last.width - first.x : last.y + last.height - first.y;
    const gap = (span - totalSize) / (sorted.length - 1);

    const patches = new Map<string, Partial<CanvasElement>>();
    let cursor = horizontal ? first.x : first.y;
    for (const el of sorted) {
      const b = getElementBounds(el);
      const delta = cursor - (horizontal ? b.x : b.y);
      if (delta !== 0) {
        patches.set(el.id, horizontal ? { x: el.x + delta } : { y: el.y + delta });
      }
      cursor += (horizontal ? b.width : b.height) + gap;
    }
    get().updateElements(patches);
    get().updateConnectorBindings(ids);
  },

  /** Re-attach bound connector endpoints after their shapes move/resize. */
  updateConnectorBindings: (movedShapeIds) => {
    if (movedShapeIds.length === 0) return;
    const moved = new Set(movedShapeIds);
    const { elements } = get();
    const byId = new Map(elements.map((el) => [el.id, el]));
    const patches = new Map<string, Partial<CanvasElement>>();

    for (const el of elements) {
      if (el.type !== 'arrow' && el.type !== 'line') continue;
      const startRef = el.startBinding && moved.has(el.startBinding.elementId);
      const endRef = el.endBinding && moved.has(el.endBinding.elementId);
      if (!startRef && !endRef) continue;

      const pts = el.points ?? [
        { x: 0, y: 0 },
        { x: el.width, y: el.height },
      ];
      let start = { x: el.x + pts[0].x, y: el.y + pts[0].y };
      let end = { x: el.x + pts[pts.length - 1].x, y: el.y + pts[pts.length - 1].y };

      if (el.startBinding) {
        const shape = byId.get(el.startBinding.elementId);
        if (shape) start = getConnectionPointAbsolute(shape, el.startBinding.point);
      }
      if (el.endBinding) {
        const shape = byId.get(el.endBinding.elementId);
        if (shape) end = getConnectionPointAbsolute(shape, el.endBinding.point);
      }

      patches.set(el.id, {
        x: start.x,
        y: start.y,
        width: end.x - start.x,
        height: end.y - start.y,
        points: [
          { x: 0, y: 0 },
          { x: end.x - start.x, y: end.y - start.y },
        ],
      });
    }
    get().updateElements(patches);
  },
}));
