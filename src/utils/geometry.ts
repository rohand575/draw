import type {
  AlignmentGuide,
  Bounds,
  CanvasElement,
  ConnectionPointName,
  Point,
  ResizeHandle,
} from '../types';
import { CONNECTOR_SNAP_DISTANCE, HANDLE_SIZE, SELECTION_PADDING } from '../constants';

/** Normalize possibly-negative width/height into a top-left-anchored box. */
export function normalizeBox(x: number, y: number, width: number, height: number): Bounds {
  return {
    x: width < 0 ? x + width : x,
    y: height < 0 ? y + height : y,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

/** World-space bounds of an element (points-aware for line/arrow/freehand). */
export function getElementBounds(el: CanvasElement): Bounds {
  if (el.points && el.points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: el.x + minX, y: el.y + minY, width: maxX - minX, height: maxY - minY };
  }
  return normalizeBox(el.x, el.y, el.width, el.height);
}

/** Union bounds over a set of elements; null when empty. */
export function getElementsBounds(els: CanvasElement[]): Bounds | null {
  if (els.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of els) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** Distance from point to a line segment. */
export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

/** Absolute endpoints for a 2-point line/arrow. */
export function getLineEndpoints(el: CanvasElement): [Point, Point] {
  const pts = el.points ?? [
    { x: 0, y: 0 },
    { x: el.width, y: el.height },
  ];
  const a = pts[0] ?? { x: 0, y: 0 };
  const b = pts[pts.length - 1] ?? { x: el.width, y: el.height };
  return [
    { x: el.x + a.x, y: el.y + a.y },
    { x: el.x + b.x, y: el.y + b.y },
  ];
}

/** 3-segment orthogonal elbow route through the horizontal midpoint. */
export function getElbowRoute(el: CanvasElement): Point[] {
  const [s, e] = getLineEndpoints(el);
  const midX = (s.x + e.x) / 2;
  return [s, { x: midX, y: s.y }, { x: midX, y: e.y }, e];
}

/** Hit test a single element. Locked elements never hit. */
export function hitTestElement(el: CanvasElement, x: number, y: number, tolerance = 5): boolean {
  if (el.locked) return false;
  const b = getElementBounds(el);

  switch (el.type) {
    case 'line':
    case 'arrow': {
      const tol = tolerance + el.strokeWidth;
      if (el.connectorStyle === 'elbow') {
        const route = getElbowRoute(el);
        for (let i = 0; i < route.length - 1; i++) {
          if (distToSegment(x, y, route[i].x, route[i].y, route[i + 1].x, route[i + 1].y) <= tol) return true;
        }
        return false;
      }
      const [s, e] = getLineEndpoints(el);
      return distToSegment(x, y, s.x, s.y, e.x, e.y) <= tol;
    }
    case 'freehand': {
      const pts = el.points ?? [];
      const tol = tolerance + el.strokeWidth;
      for (let i = 0; i < pts.length - 1; i++) {
        if (
          distToSegment(x, y, el.x + pts[i].x, el.y + pts[i].y, el.x + pts[i + 1].x, el.y + pts[i + 1].y) <= tol
        ) {
          return true;
        }
      }
      return false;
    }
    case 'diamond': {
      // Manhattan-distance test against the diamond's normalized form.
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const hw = b.width / 2 + tolerance;
      const hh = b.height / 2 + tolerance;
      if (hw <= 0 || hh <= 0) return false;
      const inside = Math.abs(x - cx) / hw + Math.abs(y - cy) / hh <= 1;
      if (el.fillColor !== 'transparent') return inside;
      if (!inside) return false;
      const ihw = Math.max(0.0001, b.width / 2 - tolerance);
      const ihh = Math.max(0.0001, b.height / 2 - tolerance);
      return Math.abs(x - cx) / ihw + Math.abs(y - cy) / ihh > 1;
    }
    case 'ellipse': {
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const rx = b.width / 2 + tolerance;
      const ry = b.height / 2 + tolerance;
      if (rx <= 0 || ry <= 0) return false;
      const norm = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (el.fillColor !== 'transparent') return norm <= 1;
      if (norm > 1) return false;
      const irx = Math.max(0.0001, b.width / 2 - tolerance);
      const iry = Math.max(0.0001, b.height / 2 - tolerance);
      return ((x - cx) / irx) ** 2 + ((y - cy) / iry) ** 2 > 1;
    }
    case 'image':
    case 'text':
    case 'embed':
      // Always "filled".
      return (
        x >= b.x - tolerance &&
        x <= b.x + b.width + tolerance &&
        y >= b.y - tolerance &&
        y <= b.y + b.height + tolerance
      );
    case 'frame': {
      // Border only (label strip above top edge also counts).
      const onOuter =
        x >= b.x - tolerance &&
        x <= b.x + b.width + tolerance &&
        y >= b.y - tolerance &&
        y <= b.y + b.height + tolerance;
      if (!onOuter) return false;
      const inInner =
        x > b.x + tolerance && x < b.x + b.width - tolerance && y > b.y + tolerance && y < b.y + b.height - tolerance;
      const onLabel = y >= b.y - 26 && y <= b.y && x >= b.x && x <= b.x + Math.min(b.width, 160);
      return !inInner || onLabel;
    }
    default: {
      // rectangle (and other filled boxes)
      const onOuter =
        x >= b.x - tolerance &&
        x <= b.x + b.width + tolerance &&
        y >= b.y - tolerance &&
        y <= b.y + b.height + tolerance;
      if (!onOuter) return false;
      if (el.fillColor !== 'transparent') return true;
      const inInner =
        x > b.x + tolerance && x < b.x + b.width - tolerance && y > b.y + tolerance && y < b.y + b.height - tolerance;
      return !inInner;
    }
  }
}

/** Topmost hittable element at a point (caller passes z-desc sorted array). */
export function getTopElementAt(
  sortedDesc: CanvasElement[],
  x: number,
  y: number,
  tolerance = 5
): CanvasElement | null {
  for (const el of sortedDesc) {
    if (hitTestElement(el, x, y, tolerance)) return el;
  }
  return null;
}

export interface HandlePosition {
  handle: ResizeHandle;
  x: number;
  y: number;
}

/** 8 resize handle centers around (padded) bounds. */
export function getResizeHandles(b: Bounds, pad = SELECTION_PADDING): HandlePosition[] {
  const x0 = b.x - pad;
  const y0 = b.y - pad;
  const x1 = b.x + b.width + pad;
  const y1 = b.y + b.height + pad;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  return [
    { handle: 'nw', x: x0, y: y0 },
    { handle: 'n', x: mx, y: y0 },
    { handle: 'ne', x: x1, y: y0 },
    { handle: 'e', x: x1, y: my },
    { handle: 'se', x: x1, y: y1 },
    { handle: 's', x: mx, y: y1 },
    { handle: 'sw', x: x0, y: y1 },
    { handle: 'w', x: x0, y: my },
  ];
}

export function getHandleAtPoint(b: Bounds, x: number, y: number, zoom: number): ResizeHandle | null {
  const r = (HANDLE_SIZE / zoom) * 0.75 + 3 / zoom;
  for (const h of getResizeHandles(b)) {
    if (Math.abs(x - h.x) <= r && Math.abs(y - h.y) <= r) return h.handle;
  }
  return null;
}

/** Endpoint handle index (0 = start, 1 = end) for line/arrow, else null. */
export function getEndpointAtPoint(el: CanvasElement, x: number, y: number, zoom: number): 0 | 1 | null {
  const [s, e] = getLineEndpoints(el);
  const r = (HANDLE_SIZE / zoom) * 0.75 + 4 / zoom;
  if (distance(x, y, s.x, s.y) <= r) return 0;
  if (distance(x, y, e.x, e.y) <= r) return 1;
  return null;
}

export const CONNECTABLE_TYPES = new Set(['rectangle', 'diamond', 'ellipse', 'frame', 'text', 'image']);

/** Absolute world position of a named connection point on a shape. */
export function getConnectionPointAbsolute(el: CanvasElement, point: ConnectionPointName): Point {
  const b = getElementBounds(el);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  switch (point) {
    case 'n':
      return { x: cx, y: b.y };
    case 's':
      return { x: cx, y: b.y + b.height };
    case 'e':
      return { x: b.x + b.width, y: cy };
    case 'w':
      return { x: b.x, y: cy };
    default:
      return { x: cx, y: cy };
  }
}

export interface ConnectionSnap {
  elementId: string;
  point: ConnectionPointName;
  x: number;
  y: number;
}

/** Closest connection point on any snap-eligible, unlocked element within range. */
export function findNearestConnectionPoint(
  x: number,
  y: number,
  elements: CanvasElement[],
  excludeIds: Set<string> | string[] = [],
  snapDistance = CONNECTOR_SNAP_DISTANCE
): ConnectionSnap | null {
  const excluded = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);
  let best: ConnectionSnap | null = null;
  let bestDist = snapDistance;
  for (const el of elements) {
    if (el.locked || excluded.has(el.id) || !CONNECTABLE_TYPES.has(el.type)) continue;
    for (const name of ['n', 's', 'e', 'w', 'center'] as ConnectionPointName[]) {
      const p = getConnectionPointAbsolute(el, name);
      const d = distance(x, y, p.x, p.y);
      if (d <= bestDist) {
        bestDist = d;
        best = { elementId: el.id, point: name, x: p.x, y: p.y };
      }
    }
  }
  return best;
}

export interface GuideResult {
  dx: number;
  dy: number;
  guides: AlignmentGuide[];
}

/**
 * Compare moving bounds against static element edges/centers; return the
 * smallest snap delta within threshold per axis plus the guide lines to draw.
 */
export function computeAlignmentGuides(
  moving: Bounds,
  staticElements: CanvasElement[],
  threshold: number
): GuideResult {
  const mEdgesX = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
  const mEdgesY = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];

  let bestDx: number | null = null;
  let bestDy: number | null = null;
  let guideX: { pos: number; b: Bounds } | null = null;
  let guideY: { pos: number; b: Bounds } | null = null;

  for (const el of staticElements) {
    const b = getElementBounds(el);
    const sEdgesX = [b.x, b.x + b.width / 2, b.x + b.width];
    const sEdgesY = [b.y, b.y + b.height / 2, b.y + b.height];
    for (const m of mEdgesX) {
      for (const s of sEdgesX) {
        const d = s - m;
        if (Math.abs(d) <= threshold && (bestDx === null || Math.abs(d) < Math.abs(bestDx))) {
          bestDx = d;
          guideX = { pos: s, b };
        }
      }
    }
    for (const m of mEdgesY) {
      for (const s of sEdgesY) {
        const d = s - m;
        if (Math.abs(d) <= threshold && (bestDy === null || Math.abs(d) < Math.abs(bestDy))) {
          bestDy = d;
          guideY = { pos: s, b };
        }
      }
    }
  }

  const guides: AlignmentGuide[] = [];
  if (guideX) {
    const top = Math.min(moving.y, guideX.b.y);
    const bottom = Math.max(moving.y + moving.height, guideX.b.y + guideX.b.height);
    guides.push({ type: 'vertical', position: guideX.pos, start: top - 12, end: bottom + 12 });
  }
  if (guideY) {
    const left = Math.min(moving.x, guideY.b.x);
    const right = Math.max(moving.x + moving.width, guideY.b.x + guideY.b.width);
    guides.push({ type: 'horizontal', position: guideY.pos, start: left - 12, end: right + 12 });
  }
  return { dx: bestDx ?? 0, dy: bestDy ?? 0, guides };
}

export function snapToGridValue(v: number, gridSize: number): number {
  return Math.round(v / gridSize) * gridSize;
}

/** Stable numeric hash from a string (for rough.js seeds). */
export function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

export function cursorForHandle(handle: ResizeHandle): string {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    default:
      return 'ew-resize';
  }
}
