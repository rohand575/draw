import { create } from 'zustand';
import type { Bounds, Theme } from '../types';
import { DEFAULT_ZOOM, LS_THEME, MAX_ZOOM, MIN_ZOOM } from '../constants';

interface CanvasStore {
  offsetX: number;
  offsetY: number;
  zoom: number;
  theme: Theme;
  showGrid: boolean;
  snapToGrid: boolean;
  isPanning: boolean;
  shortcutsOpen: boolean;
  sidebarOpen: boolean;

  setOffset: (x: number, y: number) => void;
  setZoom: (zoom: number, centerX?: number, centerY?: number) => void;
  zoomIn: (centerX?: number, centerY?: number) => void;
  zoomOut: (centerX?: number, centerY?: number) => void;
  resetView: () => void;
  zoomToBounds: (bounds: Bounds, viewportW: number, viewportH: number, padding?: number) => void;
  setIsPanning: (v: boolean) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleShortcuts: () => void;
  setShortcutsOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  loadState: (partial: Partial<{ offsetX: number; offsetY: number; zoom: number }>) => void;
}

const initialTheme = ((): Theme => {
  try {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'light';
})();

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  offsetX: 0,
  offsetY: 0,
  zoom: DEFAULT_ZOOM,
  theme: initialTheme,
  showGrid: true,
  snapToGrid: false,
  isPanning: false,
  shortcutsOpen: false,
  sidebarOpen: false,

  setOffset: (x, y) => set({ offsetX: x, offsetY: y }),

  setZoom: (newZoom, centerX, centerY) => {
    const { zoom, offsetX, offsetY } = get();
    const z = clampZoom(newZoom);
    if (z === zoom) return;
    if (centerX !== undefined && centerY !== undefined) {
      // Keep the world point under the cursor stationary.
      set({
        zoom: z,
        offsetX: offsetX + centerX / z - centerX / zoom,
        offsetY: offsetY + centerY / z - centerY / zoom,
      });
    } else {
      set({ zoom: z });
    }
  },

  zoomIn: (cx, cy) => get().setZoom(get().zoom * 1.1, cx, cy),
  zoomOut: (cx, cy) => get().setZoom(get().zoom * 0.909, cx, cy),
  resetView: () => set({ offsetX: 0, offsetY: 0, zoom: DEFAULT_ZOOM }),

  zoomToBounds: (b, vw, vh, padding = 60) => {
    if (b.width <= 0 && b.height <= 0) return;
    const z = clampZoom(Math.min((vw - padding * 2) / Math.max(1, b.width), (vh - padding * 2) / Math.max(1, b.height)));
    set({
      zoom: z,
      offsetX: vw / (2 * z) - (b.x + b.width / 2),
      offsetY: vh / (2 * z) - (b.y + b.height / 2),
    });
  },

  setIsPanning: (v) => set({ isPanning: v }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  toggleTheme: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem(LS_THEME, theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },

  toggleShortcuts: () => set((s) => ({ shortcutsOpen: !s.shortcutsOpen })),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  loadState: (partial) => set(partial),
}));
