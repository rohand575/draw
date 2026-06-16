/** Validation for untrusted element data (clipboard pastes, file imports). */
import type { CanvasElement, CanvasState, Point } from '../types';
import { sanitizeEmbedUrl, sanitizeHyperlink } from './urlSafety';

const ELEMENT_TYPES = new Set([
  'rectangle',
  'diamond',
  'ellipse',
  'line',
  'arrow',
  'freehand',
  'text',
  'image',
  'frame',
  'embed',
]);
const STROKE_STYLES = new Set(['solid', 'dashed', 'dotted']);
const FILL_STYLES = new Set(['solid', 'hachure', 'cross-hatch']);
const CONNECTOR_STYLES = new Set(['straight', 'elbow']);
const CONNECTION_POINTS = new Set(['n', 's', 'e', 'w', 'center']);

const isFinite_ = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function sanitizePoints(raw: unknown): Point[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pts: Point[] = [];
  for (const p of raw) {
    if (p && typeof p === 'object' && isFinite_((p as Point).x) && isFinite_((p as Point).y)) {
      pts.push({ x: (p as Point).x, y: (p as Point).y });
    }
  }
  return pts.length > 0 ? pts : undefined;
}

function sanitizeBinding(raw: unknown): { elementId: string; point: never } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const b = raw as { elementId?: unknown; point?: unknown };
  if (typeof b.elementId !== 'string' || !b.elementId) return undefined;
  if (typeof b.point !== 'string' || !CONNECTION_POINTS.has(b.point)) return undefined;
  return { elementId: b.elementId, point: b.point as never };
}

/** Validate a single untrusted element. Returns null when unsalvageable. */
export function sanitizeElement(raw: unknown): CanvasElement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.type !== 'string' || !ELEMENT_TYPES.has(r.type)) return null;
  if (!isFinite_(r.x) || !isFinite_(r.y)) return null;

  const type = r.type as CanvasElement['type'];
  const points = sanitizePoints(r.points);
  if ((type === 'line' || type === 'arrow' || type === 'freehand') && (!points || points.length < 2)) {
    return null;
  }

  const el: CanvasElement = {
    id: r.id,
    type,
    x: r.x,
    y: r.y,
    width: isFinite_(r.width) ? r.width : 0,
    height: isFinite_(r.height) ? r.height : 0,
    strokeColor: typeof r.strokeColor === 'string' ? r.strokeColor : '#1e1e1e',
    fillColor: typeof r.fillColor === 'string' ? r.fillColor : 'transparent',
    strokeWidth: isFinite_(r.strokeWidth) ? clamp(r.strokeWidth, 0, 50) : 2,
    roughness: isFinite_(r.roughness) ? clamp(r.roughness, 0, 10) : 1,
    opacity: isFinite_(r.opacity) ? clamp(r.opacity, 0, 1) : 1,
    strokeStyle: STROKE_STYLES.has(r.strokeStyle as string) ? (r.strokeStyle as CanvasElement['strokeStyle']) : 'solid',
    fillStyle: FILL_STYLES.has(r.fillStyle as string) ? (r.fillStyle as CanvasElement['fillStyle']) : 'hachure',
    edgeRoundness: isFinite_(r.edgeRoundness) ? clamp(r.edgeRoundness, 0, 100) : 0,
    rotation: 0,
    zIndex: isFinite_(r.zIndex) ? r.zIndex : 0,
    createdAt: isFinite_(r.createdAt) ? r.createdAt : Date.now(),
    updatedAt: isFinite_(r.updatedAt) ? r.updatedAt : Date.now(),
  };

  if (points) el.points = points;
  if (typeof r.text === 'string') el.text = r.text;
  if (isFinite_(r.fontSize)) el.fontSize = clamp(r.fontSize, 4, 400);
  if (typeof r.textWrap === 'boolean') el.textWrap = r.textWrap;
  if (typeof r.isCode === 'boolean') el.isCode = r.isCode;
  if (typeof r.codeLanguage === 'string') el.codeLanguage = r.codeLanguage.slice(0, 32);
  if (typeof r.imageData === 'string' && r.imageData.startsWith('data:image/')) el.imageData = r.imageData;
  if (typeof r.embedUrl === 'string') {
    const safe = sanitizeEmbedUrl(r.embedUrl);
    if (safe) el.embedUrl = safe;
  }
  if (typeof r.locked === 'boolean') el.locked = r.locked;
  if (typeof r.groupId === 'string' && r.groupId) el.groupId = r.groupId;
  if (typeof r.hyperlink === 'string') {
    const safe = sanitizeHyperlink(r.hyperlink);
    if (safe) el.hyperlink = safe;
  }
  const sb = sanitizeBinding(r.startBinding);
  if (sb) el.startBinding = sb;
  const eb = sanitizeBinding(r.endBinding);
  if (eb) el.endBinding = eb;
  if (CONNECTOR_STYLES.has(r.connectorStyle as string)) {
    el.connectorStyle = r.connectorStyle as CanvasElement['connectorStyle'];
  }
  if (typeof r.connectorLabel === 'string') el.connectorLabel = r.connectorLabel.slice(0, 500);
  if (typeof r.frameName === 'string') el.frameName = r.frameName.slice(0, 200);

  return el;
}

/**
 * Sanitize an array of untrusted elements: drop malformed entries and
 * regenerate ids that collide with `existingIds` or repeat within the batch.
 */
export function sanitizeElements(raw: unknown, existingIds?: Set<string>): CanvasElement[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(existingIds ?? []);
  const out: CanvasElement[] = [];
  const idRemap = new Map<string, string>();

  for (const entry of raw) {
    const el = sanitizeElement(entry);
    if (!el) continue;
    if (seen.has(el.id)) {
      const fresh = crypto.randomUUID();
      idRemap.set(el.id, fresh);
      el.id = fresh;
    }
    seen.add(el.id);
    out.push(el);
  }

  // Remap bindings that pointed at regenerated ids.
  if (idRemap.size > 0) {
    for (const el of out) {
      if (el.startBinding && idRemap.has(el.startBinding.elementId)) {
        el.startBinding = { ...el.startBinding, elementId: idRemap.get(el.startBinding.elementId)! };
      }
      if (el.endBinding && idRemap.has(el.endBinding.elementId)) {
        el.endBinding = { ...el.endBinding, elementId: idRemap.get(el.endBinding.elementId)! };
      }
      if (el.groupId && idRemap.has(el.groupId)) el.groupId = idRemap.get(el.groupId);
    }
  }
  return out;
}

/**
 * Clone elements for paste/duplicate: fresh ids, remapped groupIds, bindings
 * remapped when both endpoints are in the set (cleared otherwise).
 */
export function cloneElementsForPaste(
  source: CanvasElement[],
  offsetX: number,
  offsetY: number,
  startZIndex: number
): CanvasElement[] {
  const idMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  for (const el of source) idMap.set(el.id, crypto.randomUUID());

  return source.map((el, i) => {
    const clone: CanvasElement = structuredClone(el);
    clone.id = idMap.get(el.id)!;
    clone.x += offsetX;
    clone.y += offsetY;
    clone.zIndex = startZIndex + i;
    clone.createdAt = Date.now();
    clone.updatedAt = Date.now();
    if (clone.groupId) {
      if (!groupMap.has(clone.groupId)) groupMap.set(clone.groupId, crypto.randomUUID());
      clone.groupId = groupMap.get(clone.groupId);
    }
    if (clone.startBinding) {
      const mapped = idMap.get(clone.startBinding.elementId);
      clone.startBinding = mapped ? { ...clone.startBinding, elementId: mapped } : undefined;
    }
    if (clone.endBinding) {
      const mapped = idMap.get(clone.endBinding.elementId);
      clone.endBinding = mapped ? { ...clone.endBinding, elementId: mapped } : undefined;
    }
    return clone;
  });
}

export interface ImportedProject {
  elements: CanvasElement[];
  canvasState: CanvasState | null;
}

/** Parse + sanitize a .mcv/.json project file. Null when invalid. */
export function importProjectFile(text: string, existingIds?: Set<string>): ImportedProject | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as { elements?: unknown; canvasState?: unknown };
  if (!Array.isArray(obj.elements)) return null;

  const elements = sanitizeElements(obj.elements, existingIds);

  let canvasState: CanvasState | null = null;
  if (obj.canvasState && typeof obj.canvasState === 'object') {
    const cs = obj.canvasState as Record<string, unknown>;
    if (isFinite_(cs.offsetX) && isFinite_(cs.offsetY) && isFinite_(cs.zoom) && (cs.zoom as number) > 0) {
      canvasState = {
        offsetX: cs.offsetX as number,
        offsetY: cs.offsetY as number,
        zoom: cs.zoom as number,
      };
      if (cs.theme === 'light' || cs.theme === 'dark') canvasState.theme = cs.theme;
      if (typeof cs.showGrid === 'boolean') canvasState.showGrid = cs.showGrid;
    }
  }
  return { elements, canvasState };
}
