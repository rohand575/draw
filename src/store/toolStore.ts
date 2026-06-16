import { create } from 'zustand';
import type { FillStyle, StrokeStyle, StyleSettings, Tool } from '../types';
import {
  DEFAULT_EDGE_ROUNDNESS,
  DEFAULT_FILL_COLOR,
  DEFAULT_FILL_STYLE,
  DEFAULT_FONT_SIZE,
  DEFAULT_OPACITY,
  DEFAULT_ROUGHNESS,
  DEFAULT_STROKE_COLOR,
  DEFAULT_STROKE_STYLE,
  DEFAULT_STROKE_WIDTH,
} from '../constants';

interface ToolStore extends StyleSettings {
  activeTool: Tool;
  /** True = tool stays active after drawing one shape. */
  lockToolMode: boolean;
  selectedIds: string[];

  setActiveTool: (tool: Tool) => void;
  setStrokeColor: (c: string) => void;
  setFillColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;
  setRoughness: (r: number) => void;
  setOpacity: (o: number) => void;
  setFontSize: (s: number) => void;
  setStrokeStyle: (s: StrokeStyle) => void;
  setFillStyle: (s: FillStyle) => void;
  setEdgeRoundness: (r: number) => void;
  toggleLockToolMode: () => void;

  setSelectedIds: (ids: string[]) => void;
  addSelectedId: (id: string) => void;
  removeSelectedId: (id: string) => void;
  clearSelection: () => void;

  getStyle: () => StyleSettings;
}

export const useToolStore = create<ToolStore>((set, get) => ({
  activeTool: 'select',
  strokeColor: DEFAULT_STROKE_COLOR,
  fillColor: DEFAULT_FILL_COLOR,
  strokeWidth: DEFAULT_STROKE_WIDTH,
  roughness: DEFAULT_ROUGHNESS,
  opacity: DEFAULT_OPACITY,
  fontSize: DEFAULT_FONT_SIZE,
  strokeStyle: DEFAULT_STROKE_STYLE,
  fillStyle: DEFAULT_FILL_STYLE,
  edgeRoundness: DEFAULT_EDGE_ROUNDNESS,
  lockToolMode: true,
  selectedIds: [],

  setActiveTool: (tool) => set({ activeTool: tool }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setFillColor: (fillColor) => set({ fillColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setRoughness: (roughness) => set({ roughness }),
  setOpacity: (opacity) => set({ opacity }),
  setFontSize: (fontSize) => set({ fontSize }),
  setStrokeStyle: (strokeStyle) => set({ strokeStyle }),
  setFillStyle: (fillStyle) => set({ fillStyle }),
  setEdgeRoundness: (edgeRoundness) => set({ edgeRoundness }),
  toggleLockToolMode: () => set((s) => ({ lockToolMode: !s.lockToolMode })),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  addSelectedId: (id) =>
    set((s) => (s.selectedIds.includes(id) ? s : { selectedIds: [...s.selectedIds, id] })),
  removeSelectedId: (id) => set((s) => ({ selectedIds: s.selectedIds.filter((x) => x !== id) })),
  clearSelection: () => set({ selectedIds: [] }),

  getStyle: () => {
    const s = get();
    return {
      strokeColor: s.strokeColor,
      fillColor: s.fillColor,
      strokeWidth: s.strokeWidth,
      roughness: s.roughness,
      opacity: s.opacity,
      fontSize: s.fontSize,
      strokeStyle: s.strokeStyle,
      fillStyle: s.fillStyle,
      edgeRoundness: s.edgeRoundness,
    };
  },
}));
