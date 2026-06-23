import type { Tool } from '../types';

export const DEFAULT_ZOOM = 1;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.1;
export const GRID_SIZE = 20;

export const DEFAULT_STROKE_COLOR = '#1e1e1e';
export const DEFAULT_STROKE_COLOR_DARK = '#e9e9ef';
export const DEFAULT_FILL_COLOR = 'transparent';
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_ROUGHNESS = 3;
export const DEFAULT_OPACITY = 1;
export const DEFAULT_FONT_SIZE = 40;
export const DEFAULT_STROKE_STYLE = 'solid' as const;
export const DEFAULT_FILL_STYLE = 'hachure' as const;
export const DEFAULT_EDGE_ROUNDNESS = 0;

export const HANDLE_SIZE = 8;
export const SELECTION_PADDING = 4;
export const CONNECTOR_SNAP_DISTANCE = 20;
export const ALIGNMENT_SNAP_THRESHOLD = 6;

export const DB_NAME = 'canvas-db';
export const DB_VERSION = 1;
export const STORE_NAME = 'canvases';
export const AUTOSAVE_DEBOUNCE_MS = 500;
export const DEFAULT_CANVAS_ID = 'default';

/** Cloud sync: how long after the last edit a canvas is pushed to Supabase.
 *  Kept short so signed-in edits propagate to other devices near-instantly; a
 *  drag still coalesces into a single write thanks to the debounce. */
export const CLOUD_PUSH_DEBOUNCE_MS = 600;
/** Cloud sync: how long to coalesce realtime change events before pulling. */
export const CLOUD_REALTIME_PULL_DEBOUNCE_MS = 800;
export const LS_PENDING_PUSH = 'canvas-cloud-pending-push';
export const LS_PENDING_DELETE = 'canvas-cloud-pending-delete';

export const MAX_HISTORY = 50;
export const IMAGE_CACHE_MAX = 60;
export const IMAGE_PASTE_MAX_DIM = 800;
export const MIN_EMBED_WIDTH = 200;
export const MIN_EMBED_HEIGHT = 150;

export const STROKE_WIDTHS = [1, 2, 3, 4, 6];
export const UI_STROKE_WIDTHS = [1, 2, 4];
export const ROUGHNESS_LEVELS = [0, 1, 2, 3];
export const ROUGHNESS_LABELS = ['None', 'Low', 'Medium', 'High'];
export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];
export const EDGE_ROUNDNESS_OPTIONS = [0, 8, 16];

export const SIDEBAR_WIDTH = 280;

export const COLOR_PALETTE = [
  '#1e1e1e',
  '#e03131',
  '#2f9e44',
  '#1971c2',
  '#f08c00',
  '#6741d9',
  '#0c8599',
  '#e64980',
  'transparent',
];

/** Solid stroke colors (palette minus transparent) for the 1–8 shortcuts. */
export const STROKE_COLOR_SHORTCUTS = COLOR_PALETTE.filter((c) => c !== 'transparent');

export const ACCENT = '#6366f1';
export const GUIDE_COLOR = '#e03131';
export const FIND_HIGHLIGHT = 'rgba(252, 232, 170, 0.85)';
export const FIND_HIGHLIGHT_ACTIVE = 'rgba(250, 204, 21, 0.95)';
export const CODE_BG = '#1e1e2e';

export const CANVAS_BG_LIGHT = '#fafafa';
export const CANVAS_BG_DARK = '#15151b';

export const HAND_FONT = 'Virgil, "Segoe Print", "Comic Sans MS", cursive';
export const CODE_FONT =
  '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, Monaco, monospace';
export const UI_FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export interface ToolDef {
  id: Tool;
  label: string;
  shortcut: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: 'V' },
  { id: 'hand', label: 'Hand', shortcut: 'H' },
  { id: 'frame', label: 'Frame', shortcut: 'F' },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R' },
  { id: 'diamond', label: 'Diamond', shortcut: 'D' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O' },
  { id: 'line', label: 'Line', shortcut: 'L' },
  { id: 'arrow', label: 'Arrow', shortcut: 'A' },
  { id: 'freehand', label: 'Pencil', shortcut: 'P' },
  { id: 'text', label: 'Text', shortcut: 'T' },
];

export const LS_THEME = 'canvas-theme';
export const LS_SHAPE_LIBRARY = 'canvas-shape-library';
export const LS_OPENAI_KEY = 'openai-api-key';
