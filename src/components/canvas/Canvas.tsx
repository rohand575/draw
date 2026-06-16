/**
 * Master interactive canvas: render loop, pointer state machine (draw / move /
 * resize / endpoint-edit / box-select / pan / pinch), text editing, embeds,
 * find highlights, context menu, dialogs, drawable cache + worker bridge.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import rough from 'roughjs/bin/rough';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { RoughGenerator } from 'roughjs/bin/generator';
import type { AlignmentGuide, Bounds, CanvasElement, Point, ResizeHandle } from '../../types';
import {
  ALIGNMENT_SNAP_THRESHOLD,
  CANVAS_BG_DARK,
  CANVAS_BG_LIGHT,
  GRID_SIZE,
  IMAGE_CACHE_MAX,
  MIN_EMBED_HEIGHT,
  MIN_EMBED_WIDTH,
} from '../../constants';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useFindStore } from '../../store/findStore';
import { useToolStore } from '../../store/toolStore';
import { historyActions } from '../../hooks/useHistory';
import { createElement } from '../../utils/createElement';
import {
  boundsContain,
  boundsOverlap,
  computeAlignmentGuides,
  cursorForHandle,
  distance,
  findNearestConnectionPoint,
  getElementBounds,
  getEndpointAtPoint,
  getHandleAtPoint,
  getLineEndpoints,
  getTopElementAt,
  hitTestElement,
  normalizeBox,
  snapToGridValue,
  type ConnectionSnap,
} from '../../utils/geometry';
import {
  elementVisualHash,
  isRoughRenderable,
  renderElement,
  textLineHeight,
  textFont,
  type DrawableCache,
  type ElementFindHighlight,
} from '../../features/drawing/renderElement';
import { renderGrid } from '../../features/drawing/renderGrid';
import {
  drawAlignmentGuides,
  drawConnectionIndicators,
  drawEndpointHandles,
  drawGroupBounds,
  drawRubberBand,
  drawSelectionBox,
} from '../../features/selection/renderSelection';
import { getMeasureCtx, wrapTextToLines } from '../../utils/textWrap';
import { sanitizeEmbedUrl, sanitizeHyperlink } from '../../utils/urlSafety';
import { pasteImageBlob } from '../../utils/clipboard';
import { TextEditorOverlay } from './TextEditorOverlay';
import { EmbedLayer } from './EmbedLayer';
import { ContextMenu, type ContextMenuState, type DialogKind } from './ContextMenu';
import { PromptDialog } from '../ui/PromptDialog';

type Mode =
  | 'none'
  | 'drawing'
  | 'moving'
  | 'resizing'
  | 'editing-point'
  | 'box-select'
  | 'panning'
  | 'pinch';

interface Interaction {
  mode: Mode;
  startWorld: Point;
  startScreen: Point;
  elementId: string | null;
  handle: ResizeHandle | null;
  endpointIndex: 0 | 1 | null;
  originals: Map<string, { x: number; y: number }>;
  resizeOriginal: {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize?: number;
    points?: Point[];
  } | null;
  snapshotted: boolean;
  moved: boolean;
  panStart: { offsetX: number; offsetY: number };
  rightButton: boolean;
  potentialLink: string | null;
  boxAdditive: boolean;
  prevSelection: string[];
}

interface EditingState {
  id: string;
  wrapContainerId: string | null;
  caretIndex: number | null;
  isNew: boolean;
}

interface DialogState {
  kind: DialogKind;
  elementId: string;
}

const freshInteraction = (): Interaction => ({
  mode: 'none',
  startWorld: { x: 0, y: 0 },
  startScreen: { x: 0, y: 0 },
  elementId: null,
  handle: null,
  endpointIndex: null,
  originals: new Map(),
  resizeOriginal: null,
  snapshotted: false,
  moved: false,
  panStart: { offsetX: 0, offsetY: 0 },
  rightButton: false,
  potentialLink: null,
  boxAdditive: false,
  prevSelection: [],
});

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roughRef = useRef<{ rc: RoughCanvas; gen: RoughGenerator } | null>(null);

  const needsRenderRef = useRef(true);
  const interactionRef = useRef<Interaction>(freshInteraction());
  const drawableCacheRef = useRef<DrawableCache>(new Map());
  const imageCacheRef = useRef<Map<string, { img: HTMLImageElement; src: string }>>(new Map());
  const zSortRef = useRef<{ src: CanvasElement[] | null; asc: CanvasElement[]; desc: CanvasElement[] }>({
    src: null,
    asc: [],
    desc: [],
  });
  const guidesRef = useRef<AlignmentGuide[]>([]);
  const boxRectRef = useRef<Bounds | null>(null);
  const snapRef = useRef<ConnectionSnap | null>(null);
  const connectorDragRef = useRef(false);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchPrevRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const spaceDownRef = useRef(false);
  const editingRef = useRef<EditingState | null>(null);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  editingRef.current = editing;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const sx = clientX - (rect?.left ?? 0);
    const sy = clientY - (rect?.top ?? 0);
    const { offsetX, offsetY, zoom } = useCanvasStore.getState();
    return { x: sx / zoom - offsetX, y: sy / zoom - offsetY };
  }, []);

  const toScreenLocal = useCallback((clientX: number, clientY: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  const sortedElements = useCallback(() => {
    const { elements } = useElementStore.getState();
    if (zSortRef.current.src !== elements) {
      const asc = [...elements].sort((a, b) => a.zIndex - b.zIndex);
      zSortRef.current = { src: elements, asc, desc: [...asc].reverse() };
    }
    return zSortRef.current;
  }, []);

  const getImage = useCallback((el: CanvasElement): HTMLImageElement | null => {
    if (!el.imageData) return null;
    const cache = imageCacheRef.current;
    let entry = cache.get(el.id);
    if (!entry || entry.src !== el.imageData) {
      const img = new Image();
      img.onload = () => {
        needsRenderRef.current = true;
      };
      img.src = el.imageData;
      entry = { img, src: el.imageData };
      cache.set(el.id, entry);
      if (cache.size > IMAGE_CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
    } else {
      cache.delete(el.id);
      cache.set(el.id, entry); // refresh LRU recency
    }
    return entry.img.complete && entry.img.naturalWidth > 0 ? entry.img : null;
  }, []);

  const setCursor = useCallback((cursor: string) => {
    if (canvasRef.current && canvasRef.current.style.cursor !== cursor) {
      canvasRef.current.style.cursor = cursor;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Text editing session
  // -------------------------------------------------------------------------

  const commitTextEditing = useCallback(() => {
    const session = editingRef.current;
    if (!session) return;
    editingRef.current = null;
    setEditing(null);
    const store = useElementStore.getState();
    const el = store.elements.find((x) => x.id === session.id);
    if (!el) return;
    if (!el.text || el.text.trim() === '') {
      store.removeElements([session.id]);
      if (session.isNew) historyActions.popSnapshot();
    } else {
      const tool = useToolStore.getState();
      if (tool.activeTool === 'text' && !tool.lockToolMode) tool.setActiveTool('select');
    }
    needsRenderRef.current = true;
  }, []);

  const startTextEditing = useCallback(
    (existing: CanvasElement | null, wx: number, wy: number, caretIndex: number | null) => {
      commitTextEditing();
      const store = useElementStore.getState();
      const tool = useToolStore.getState();
      historyActions.saveSnapshot();

      if (existing) {
        let containerId: string | null = null;
        if (existing.textWrap) {
          const container = sortedElements().desc.find(
            (el) =>
              el.type === 'rectangle' &&
              el.id !== existing.id &&
              boundsContain(getElementBounds(el), getElementBounds(existing))
          );
          containerId = container?.id ?? null;
        }
        tool.clearSelection();
        setEditing({ id: existing.id, wrapContainerId: containerId, caretIndex, isNew: false });
        needsRenderRef.current = true;
        return;
      }

      // Container detection: topmost rectangle under the cursor wraps the text.
      const container = sortedElements().desc.find((el) => {
        if (el.type !== 'rectangle' || el.locked) return false;
        const b = getElementBounds(el);
        return wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height;
      });

      const el = createElement('text', wx, wy, tool.getStyle(), store.getMaxZIndex() + 1);
      const lh = textLineHeight(el);
      if (container) {
        const cb = getElementBounds(container);
        el.x = cb.x + 8;
        el.y = Math.min(Math.max(wy - lh / 2, cb.y + 8), cb.y + cb.height - lh / 2);
        el.width = cb.width - 16;
        el.textWrap = true;
      } else {
        el.y = wy - lh / 2;
      }
      el.height = lh;
      store.addElement(el);
      tool.clearSelection();
      setEditing({ id: el.id, wrapContainerId: container?.id ?? null, caretIndex: null, isNew: true });
      needsRenderRef.current = true;
    },
    [commitTextEditing, sortedElements]
  );

  /** Approximate caret index from a click position inside a text element. */
  const caretIndexAt = useCallback((el: CanvasElement, wx: number, wy: number): number => {
    const text = el.text ?? '';
    const lines = text.split('\n');
    const lh = textLineHeight(el);
    const pad = el.isCode ? 16 : 0;
    const lineIdx = Math.max(0, Math.min(lines.length - 1, Math.floor((wy - el.y - pad) / lh)));
    const ctx = getMeasureCtx();
    ctx.font = textFont(el);
    const targetX = wx - el.x - pad;
    const line = lines[lineIdx];
    let col = line.length;
    for (let i = 0; i <= line.length; i++) {
      if (ctx.measureText(line.slice(0, i)).width >= targetX) {
        col = Math.max(0, i - (ctx.measureText(line.slice(0, i)).width - targetX > ctx.measureText(line.charAt(i - 1) || '').width / 2 ? 1 : 0));
        break;
      }
    }
    let idx = 0;
    for (let i = 0; i < lineIdx; i++) idx += lines[i].length + 1;
    return idx + col;
  }, []);

  // -------------------------------------------------------------------------
  // Interaction cancellation (pinch start)
  // -------------------------------------------------------------------------

  const cancelInteraction = useCallback(() => {
    const it = interactionRef.current;
    const store = useElementStore.getState();
    if (it.mode === 'drawing' && it.elementId) {
      store.removeElements([it.elementId]);
      historyActions.popSnapshot();
    } else if ((it.mode === 'moving' || it.mode === 'resizing' || it.mode === 'editing-point') && it.snapshotted) {
      historyActions.undo();
    }
    guidesRef.current = [];
    boxRectRef.current = null;
    snapRef.current = null;
    connectorDragRef.current = false;
    interactionRef.current = freshInteraction();
    needsRenderRef.current = true;
  }, []);

  // -------------------------------------------------------------------------
  // Pointer down
  // -------------------------------------------------------------------------

  const startMoving = useCallback((ids: string[], wx: number, wy: number, presnapshotted: boolean) => {
    const it = interactionRef.current;
    const { elements } = useElementStore.getState();
    const idSet = new Set(ids);
    it.mode = 'moving';
    it.startWorld = { x: wx, y: wy };
    it.originals = new Map();
    it.snapshotted = presnapshotted;
    it.moved = false;

    for (const el of elements) {
      if (idSet.has(el.id) && !el.locked) it.originals.set(el.id, { x: el.x, y: el.y });
    }
    // Frames carry fully-contained, unlocked elements with them.
    for (const el of elements) {
      if (!idSet.has(el.id) || el.type !== 'frame' || el.locked) continue;
      const fb = getElementBounds(el);
      for (const other of elements) {
        if (other.id === el.id || other.locked || it.originals.has(other.id)) continue;
        if (boundsContain(fb, getElementBounds(other))) {
          it.originals.set(other.id, { x: other.x, y: other.y });
        }
      }
    }
  }, []);

  const handleSelectDown = useCallback(
    (wx: number, wy: number, e: PointerEvent) => {
      const it = interactionRef.current;
      const tool = useToolStore.getState();
      const store = useElementStore.getState();
      const { zoom } = useCanvasStore.getState();
      const { desc } = sortedElements();
      const tolerance = 5 / zoom;

      // 1) Handles / endpoints on the current single selection.
      if (tool.selectedIds.length === 1) {
        const el = store.elements.find((x) => x.id === tool.selectedIds[0]);
        if (el && !el.locked) {
          if (el.type === 'line' || el.type === 'arrow') {
            const ep = getEndpointAtPoint(el, wx, wy, zoom);
            if (ep !== null) {
              it.mode = 'editing-point';
              it.elementId = el.id;
              it.endpointIndex = ep;
              it.startWorld = { x: wx, y: wy };
              it.resizeOriginal = {
                x: el.x,
                y: el.y,
                width: el.width,
                height: el.height,
                points: structuredClone(el.points ?? []),
              };
              connectorDragRef.current = true;
              return;
            }
          } else {
            const handle = getHandleAtPoint(getElementBounds(el), wx, wy, zoom);
            if (handle) {
              it.mode = 'resizing';
              it.elementId = el.id;
              it.handle = handle;
              it.startWorld = { x: wx, y: wy };
              const b = getElementBounds(el);
              it.resizeOriginal = {
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                fontSize: el.fontSize,
                points: el.points ? structuredClone(el.points) : undefined,
              };
              return;
            }
          }
        }
      }

      // 2) Element hit.
      const hit = getTopElementAt(desc, wx, wy, tolerance);
      if (hit) {
        if (e.shiftKey) {
          // Toggle membership; no drag from a shift-click.
          if (tool.selectedIds.includes(hit.id)) tool.removeSelectedId(hit.id);
          else tool.addSelectedId(hit.id);
          return;
        }
        let ids = tool.selectedIds;
        if (!ids.includes(hit.id)) {
          ids = hit.groupId
            ? store.elements.filter((el) => el.groupId === hit.groupId).map((el) => el.id)
            : [hit.id];
          tool.setSelectedIds(ids);
        }
        let presnap = false;
        if (e.altKey) {
          // Alt+drag duplicates in place, then drags the duplicates.
          historyActions.saveSnapshot();
          const clones = store.duplicateElements(ids, 0, 0);
          ids = clones.map((c) => c.id);
          tool.setSelectedIds(ids);
          presnap = true;
        }
        startMoving(ids, wx, wy, presnap);
        return;
      }

      // 3) Box select on empty canvas.
      if (!e.shiftKey) tool.clearSelection();
      it.mode = 'box-select';
      it.startWorld = { x: wx, y: wy };
      it.boxAdditive = e.shiftKey;
      it.prevSelection = [...tool.selectedIds];
      boxRectRef.current = null;
    },
    [sortedElements, startMoving]
  );

  const handleDrawDown = useCallback(
    (wx: number, wy: number) => {
      const it = interactionRef.current;
      const tool = useToolStore.getState();
      const store = useElementStore.getState();
      const { snapToGrid } = useCanvasStore.getState();

      let x = wx;
      let y = wy;
      if (snapToGrid) {
        x = snapToGridValue(x, GRID_SIZE);
        y = snapToGridValue(y, GRID_SIZE);
      }

      historyActions.saveSnapshot();
      const el = createElement(tool.activeTool as CanvasElement['type'], x, y, tool.getStyle(), store.getMaxZIndex() + 1);

      if (tool.activeTool === 'arrow' || tool.activeTool === 'line') {
        const snap = findNearestConnectionPoint(wx, wy, store.elements, [el.id]);
        if (snap) {
          el.x = snap.x;
          el.y = snap.y;
          el.startBinding = { elementId: snap.elementId, point: snap.point };
        }
        connectorDragRef.current = true;
      }

      store.addElement(el);
      it.mode = 'drawing';
      it.elementId = el.id;
      it.startWorld = { x: el.x, y: el.y };
    },
    []
  );

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Palm rejection for large flat touch contacts.
      if (e.pointerType === 'touch' && e.width > 70 && e.height > 70) return;

      canvas.setPointerCapture(e.pointerId);
      const local = toScreenLocal(e.clientX, e.clientY);
      pointersRef.current.set(e.pointerId, local);

      // Two-finger gesture: cancel in-flight interaction, become pinch-only.
      if (pointersRef.current.size === 2) {
        if (interactionRef.current.mode !== 'none' && interactionRef.current.mode !== 'pinch') {
          cancelInteraction();
        }
        interactionRef.current.mode = 'pinch';
        const [a, b] = [...pointersRef.current.values()];
        pinchPrevRef.current = {
          dist: distance(a.x, a.y, b.x, b.y),
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
        };
        return;
      }

      commitTextEditing();
      setContextMenu(null);
      if (activeEmbedId) setActiveEmbedId(null);

      const { x: wx, y: wy } = toWorld(e.clientX, e.clientY);
      const it = interactionRef.current;
      it.startScreen = local;
      it.startWorld = { x: wx, y: wy };
      it.moved = false;
      it.potentialLink = null;

      const cs = useCanvasStore.getState();
      const tool = useToolStore.getState();

      const beginPan = (rightButton: boolean) => {
        it.mode = 'panning';
        it.rightButton = rightButton;
        it.panStart = { offsetX: cs.offsetX, offsetY: cs.offsetY };
        cs.setIsPanning(true);
        setCursor('grabbing');
      };

      if (e.button === 2 || e.button === 1) {
        beginPan(e.button === 2);
        return;
      }
      if (spaceDownRef.current || tool.activeTool === 'hand') {
        beginPan(false);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (tool.activeTool === 'select') {
          const hit = getTopElementAt(sortedElements().desc, wx, wy, 5 / cs.zoom);
          if (hit?.hyperlink) it.potentialLink = hit.hyperlink;
        }
        beginPan(false);
        return;
      }

      if (tool.activeTool === 'select') {
        handleSelectDown(wx, wy, e);
      } else if (tool.activeTool === 'text') {
        const hit = getTopElementAt(sortedElements().desc, wx, wy, 5 / cs.zoom);
        if (hit && hit.type === 'text') {
          startTextEditing(hit, wx, wy, caretIndexAt(hit, wx, wy));
        } else {
          startTextEditing(null, wx, wy, null);
        }
      } else {
        handleDrawDown(wx, wy);
      }
      needsRenderRef.current = true;
    },
    [activeEmbedId, cancelInteraction, caretIndexAt, commitTextEditing, handleDrawDown, handleSelectDown, setCursor, sortedElements, startTextEditing, toScreenLocal, toWorld]
  );

  // -------------------------------------------------------------------------
  // Pointer move
  // -------------------------------------------------------------------------

  const updateHoverCursor = useCallback(
    (wx: number, wy: number) => {
      const tool = useToolStore.getState();
      const { zoom } = useCanvasStore.getState();
      if (spaceDownRef.current || tool.activeTool === 'hand') {
        setCursor('grab');
        return;
      }
      if (tool.activeTool === 'text') {
        setCursor('text');
        return;
      }
      if (tool.activeTool !== 'select') {
        setCursor('crosshair');
        return;
      }
      const store = useElementStore.getState();
      if (tool.selectedIds.length === 1) {
        const el = store.elements.find((x) => x.id === tool.selectedIds[0]);
        if (el && !el.locked) {
          if (el.type === 'line' || el.type === 'arrow') {
            if (getEndpointAtPoint(el, wx, wy, zoom) !== null) {
              setCursor('move');
              return;
            }
          } else {
            const handle = getHandleAtPoint(getElementBounds(el), wx, wy, zoom);
            if (handle) {
              setCursor(cursorForHandle(handle));
              return;
            }
          }
        }
      }
      const hit = getTopElementAt(sortedElements().desc, wx, wy, 5 / zoom);
      setCursor(hit ? 'move' : 'default');
    },
    [setCursor, sortedElements]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const it = interactionRef.current;
      const local = toScreenLocal(e.clientX, e.clientY);

      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, local);
      }

      // Pinch zoom + two-finger pan.
      if (it.mode === 'pinch' && pointersRef.current.size >= 2) {
        const [a, b] = [...pointersRef.current.values()];
        const dist = distance(a.x, a.y, b.x, b.y);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const prev = pinchPrevRef.current;
        if (prev && prev.dist > 0) {
          const cs = useCanvasStore.getState();
          cs.setZoom(cs.zoom * (dist / prev.dist), midX, midY);
          const cs2 = useCanvasStore.getState();
          cs2.setOffset(
            cs2.offsetX + (midX - prev.midX) / cs2.zoom,
            cs2.offsetY + (midY - prev.midY) / cs2.zoom
          );
        }
        pinchPrevRef.current = { dist, midX, midY };
        needsRenderRef.current = true;
        return;
      }

      const { x: wx, y: wy } = toWorld(e.clientX, e.clientY);
      const cs = useCanvasStore.getState();
      const store = useElementStore.getState();

      if (!it.moved && it.mode !== 'none') {
        const dxs = local.x - it.startScreen.x;
        const dys = local.y - it.startScreen.y;
        if (Math.hypot(dxs, dys) > 4) it.moved = true;
      }

      switch (it.mode) {
        case 'none':
          if (e.buttons === 0) updateHoverCursor(wx, wy);
          return;

        case 'panning': {
          const dx = (local.x - it.startScreen.x) / cs.zoom;
          const dy = (local.y - it.startScreen.y) / cs.zoom;
          cs.setOffset(it.panStart.offsetX + dx, it.panStart.offsetY + dy);
          return;
        }

        case 'drawing': {
          const el = store.elements.find((x) => x.id === it.elementId);
          if (!el) return;
          let px = wx;
          let py = wy;
          if (cs.snapToGrid) {
            px = snapToGridValue(px, GRID_SIZE);
            py = snapToGridValue(py, GRID_SIZE);
          }

          if (el.type === 'line' || el.type === 'arrow') {
            const snap = findNearestConnectionPoint(wx, wy, store.elements, [el.id]);
            snapRef.current = snap;
            const ex = snap ? snap.x : px;
            const ey = snap ? snap.y : py;
            store.updateElement(el.id, {
              width: ex - el.x,
              height: ey - el.y,
              points: [
                { x: 0, y: 0 },
                { x: ex - el.x, y: ey - el.y },
              ],
            });
          } else if (el.type === 'freehand') {
            const pts = el.points ?? [];
            store.updateElement(el.id, {
              points: [...pts, { x: wx - el.x, y: wy - el.y }],
            });
          } else {
            store.updateElement(el.id, { width: px - el.x, height: py - el.y });
          }
          needsRenderRef.current = true;
          return;
        }

        case 'moving': {
          let dx = wx - it.startWorld.x;
          let dy = wy - it.startWorld.y;
          if (dx === 0 && dy === 0) return;
          if (!it.snapshotted) {
            historyActions.saveSnapshot();
            it.snapshotted = true;
          }

          guidesRef.current = [];
          if (cs.snapToGrid) {
            const patches = new Map<string, Partial<CanvasElement>>();
            for (const [id, orig] of it.originals) {
              patches.set(id, {
                x: snapToGridValue(orig.x + dx, GRID_SIZE),
                y: snapToGridValue(orig.y + dy, GRID_SIZE),
              });
            }
            store.updateElements(patches);
          } else {
            // Alignment guides against static elements.
            const movingIds = it.originals;
            const movingEls = store.elements.filter((el) => movingIds.has(el.id));
            const movingBounds = movingEls.length
              ? movingEls.reduce(
                  (acc, el) => {
                    const orig = movingIds.get(el.id)!;
                    const b = getElementBounds({ ...el, x: orig.x + dx, y: orig.y + dy });
                    return {
                      x: Math.min(acc.x, b.x),
                      y: Math.min(acc.y, b.y),
                      x2: Math.max(acc.x2, b.x + b.width),
                      y2: Math.max(acc.y2, b.y + b.height),
                    };
                  },
                  { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity }
                )
              : null;
            if (movingBounds) {
              const statics = store.elements.filter((el) => !movingIds.has(el.id) && !el.locked);
              const result = computeAlignmentGuides(
                {
                  x: movingBounds.x,
                  y: movingBounds.y,
                  width: movingBounds.x2 - movingBounds.x,
                  height: movingBounds.y2 - movingBounds.y,
                },
                statics,
                ALIGNMENT_SNAP_THRESHOLD / cs.zoom
              );
              dx += result.dx;
              dy += result.dy;
              guidesRef.current = result.guides;
            }
            const patches = new Map<string, Partial<CanvasElement>>();
            for (const [id, orig] of it.originals) {
              patches.set(id, { x: orig.x + dx, y: orig.y + dy });
            }
            store.updateElements(patches);
          }
          store.updateConnectorBindings([...it.originals.keys()]);
          needsRenderRef.current = true;
          return;
        }

        case 'resizing': {
          const el = store.elements.find((x) => x.id === it.elementId);
          const o = it.resizeOriginal;
          if (!el || !o || !it.handle) return;
          if (!it.snapshotted) {
            historyActions.saveSnapshot();
            it.snapshotted = true;
          }

          let dx = wx - it.startWorld.x;
          let dy = wy - it.startWorld.y;
          let nx = o.x;
          let ny = o.y;
          let nw = o.width;
          let nh = o.height;
          const h = it.handle;
          if (h.includes('e')) nw = o.width + dx;
          if (h.includes('w')) {
            nx = o.x + dx;
            nw = o.width - dx;
          }
          if (h.includes('s')) nh = o.height + dy;
          if (h.includes('n')) {
            ny = o.y + dy;
            nh = o.height - dy;
          }
          if (cs.snapToGrid) {
            nx = snapToGridValue(nx, GRID_SIZE);
            ny = snapToGridValue(ny, GRID_SIZE);
            nw = snapToGridValue(nw, GRID_SIZE);
            nh = snapToGridValue(nh, GRID_SIZE);
          }

          if (el.type === 'freehand' && o.points) {
            const sx = o.width !== 0 ? nw / o.width : 1;
            const sy = o.height !== 0 ? nh / o.height : 1;
            store.updateElement(el.id, {
              x: nx,
              y: ny,
              width: nw,
              height: nh,
              points: o.points.map((p) => ({ x: p.x * sx, y: p.y * sy })),
            });
          } else if (el.type === 'text' && el.isCode) {
            const scale = Math.min(
              Math.abs(nw) / Math.max(1, o.width),
              Math.abs(nh) / Math.max(1, o.height)
            );
            const fontSize = Math.min(200, Math.max(8, (o.fontSize ?? 14) * scale));
            store.updateElement(el.id, { x: nx, y: ny, width: Math.abs(nw), height: Math.abs(nh), fontSize });
          } else if (el.type === 'text') {
            const width = Math.max(20, Math.abs(nw));
            const probe = { ...el, width, textWrap: true };
            const lines = Math.max(1, (probe.text ?? '').length === 0 ? 1 : getTextLineCount(probe));
            const height = lines * textLineHeight(el);
            store.updateElement(el.id, { x: nx, y: ny, width, height, textWrap: true });
          } else {
            store.updateElement(el.id, { x: nx, y: ny, width: nw, height: nh });
          }
          store.updateConnectorBindings([el.id]);
          needsRenderRef.current = true;
          return;
        }

        case 'editing-point': {
          const el = store.elements.find((x) => x.id === it.elementId);
          const o = it.resizeOriginal;
          if (!el || !o || it.endpointIndex === null) return;
          if (!it.snapshotted) {
            historyActions.saveSnapshot();
            it.snapshotted = true;
          }

          let px = wx;
          let py = wy;
          if (cs.snapToGrid) {
            px = snapToGridValue(px, GRID_SIZE);
            py = snapToGridValue(py, GRID_SIZE);
          }
          // Shift constrains the angle to 45° steps around the other endpoint.
          if (e.shiftKey) {
            const pts = o.points ?? [];
            const otherIdx = it.endpointIndex === 0 ? pts.length - 1 : 0;
            const anchor = { x: o.x + (pts[otherIdx]?.x ?? 0), y: o.y + (pts[otherIdx]?.y ?? 0) };
            const ang = Math.atan2(py - anchor.y, px - anchor.x);
            const step = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
            const d = distance(anchor.x, anchor.y, px, py);
            px = anchor.x + d * Math.cos(step);
            py = anchor.y + d * Math.sin(step);
          }
          const snap = findNearestConnectionPoint(px, py, store.elements, [el.id]);
          snapRef.current = snap;
          if (snap) {
            px = snap.x;
            py = snap.y;
          }

          const pts = o.points ?? [
            { x: 0, y: 0 },
            { x: o.width, y: o.height },
          ];
          if (it.endpointIndex === 0) {
            const endAbs = { x: o.x + pts[pts.length - 1].x, y: o.y + pts[pts.length - 1].y };
            store.updateElement(el.id, {
              x: px,
              y: py,
              width: endAbs.x - px,
              height: endAbs.y - py,
              points: [
                { x: 0, y: 0 },
                { x: endAbs.x - px, y: endAbs.y - py },
              ],
            });
          } else {
            store.updateElement(el.id, {
              width: px - el.x,
              height: py - el.y,
              points: [
                { x: 0, y: 0 },
                { x: px - el.x, y: py - el.y },
              ],
            });
          }
          needsRenderRef.current = true;
          return;
        }

        case 'box-select': {
          boxRectRef.current = normalizeBox(
            it.startWorld.x,
            it.startWorld.y,
            wx - it.startWorld.x,
            wy - it.startWorld.y
          );
          needsRenderRef.current = true;
          return;
        }

        default:
          return;
      }
    },
    [toScreenLocal, toWorld, updateHoverCursor]
  );

  // -------------------------------------------------------------------------
  // Pointer up
  // -------------------------------------------------------------------------

  const openContextMenuAt = useCallback(
    (clientX: number, clientY: number) => {
      const { x: wx, y: wy } = toWorld(clientX, clientY);
      const tool = useToolStore.getState();
      const { zoom } = useCanvasStore.getState();
      const { desc } = sortedElements();

      let target = getTopElementAt(desc, wx, wy, 5 / zoom);
      if (!target) {
        // Locked elements still get a context menu (to allow Unlock).
        target =
          desc.find((el) => el.locked && hitTestElement({ ...el, locked: false }, wx, wy, 5 / zoom)) ?? null;
      }
      if (target && !tool.selectedIds.includes(target.id)) {
        tool.setSelectedIds([target.id]);
      }
      setContextMenu({ x: clientX, y: clientY, worldX: wx, worldY: wy, targetId: target?.id ?? null });
    },
    [sortedElements, toWorld]
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const it = interactionRef.current;
      pointersRef.current.delete(e.pointerId);

      if (it.mode === 'pinch') {
        if (pointersRef.current.size < 2) {
          pinchPrevRef.current = null;
          interactionRef.current = freshInteraction();
        }
        return;
      }

      const store = useElementStore.getState();
      const tool = useToolStore.getState();
      const cs = useCanvasStore.getState();
      const { x: wx, y: wy } = toWorld(e.clientX, e.clientY);

      switch (it.mode) {
        case 'panning': {
          cs.setIsPanning(false);
          if (!it.moved) {
            if (it.rightButton) {
              openContextMenuAt(e.clientX, e.clientY);
            } else if (it.potentialLink) {
              const safe = sanitizeHyperlink(it.potentialLink);
              if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
            }
          }
          break;
        }

        case 'drawing': {
          const el = store.elements.find((x) => x.id === it.elementId);
          if (el) {
            const degenerate =
              el.type === 'embed'
                ? false
                : el.type === 'line' || el.type === 'arrow'
                  ? Math.hypot(el.width, el.height) < 2
                  : el.type === 'freehand'
                    ? (el.points?.length ?? 0) < 2 ||
                      Math.max(getElementBounds(el).width, getElementBounds(el).height) < 2
                    : Math.abs(el.width) < 2 && Math.abs(el.height) < 2;

            if (degenerate) {
              store.removeElements([el.id]);
              historyActions.popSnapshot();
            } else {
              if (el.type === 'line' || el.type === 'arrow') {
                if (snapRef.current) {
                  store.updateElement(el.id, {
                    endBinding: { elementId: snapRef.current.elementId, point: snapRef.current.point },
                  });
                }
              } else if (el.type !== 'freehand') {
                // Normalize negative width/height so x/y is the top-left.
                const b = normalizeBox(el.x, el.y, el.width, el.height);
                store.updateElement(el.id, { x: b.x, y: b.y, width: b.width, height: b.height });
                if (el.type === 'embed') {
                  const w = Math.max(b.width, MIN_EMBED_WIDTH);
                  const hgt = Math.max(b.height, MIN_EMBED_HEIGHT);
                  store.updateElement(el.id, { width: w, height: hgt });
                  setDialog({ kind: 'embed-url', elementId: el.id });
                }
              }
              tool.setSelectedIds([el.id]);
            }
            // Lock-tool-mode off → revert to select after one shape (even pruned).
            if (!tool.lockToolMode) tool.setActiveTool('select');
          }
          break;
        }

        case 'editing-point': {
          const el = store.elements.find((x) => x.id === it.elementId);
          if (el && it.endpointIndex !== null) {
            const binding = snapRef.current
              ? { elementId: snapRef.current.elementId, point: snapRef.current.point }
              : undefined;
            store.updateElement(el.id, it.endpointIndex === 0 ? { startBinding: binding } : { endBinding: binding });
          }
          break;
        }

        case 'resizing': {
          const el = store.elements.find((x) => x.id === it.elementId);
          if (el && el.type !== 'line' && el.type !== 'arrow' && el.type !== 'freehand') {
            const b = normalizeBox(el.x, el.y, el.width, el.height);
            store.updateElement(el.id, { x: b.x, y: b.y, width: b.width, height: b.height });
            store.updateConnectorBindings([el.id]);
          }
          break;
        }

        case 'box-select': {
          const rect = boxRectRef.current;
          if (rect && (rect.width > 2 || rect.height > 2)) {
            const inside = store.elements
              .filter((el) => !el.locked && boundsOverlap(rect, getElementBounds(el)))
              .map((el) => el.id);
            const merged = it.boxAdditive ? [...new Set([...it.prevSelection, ...inside])] : inside;
            tool.setSelectedIds(merged);
          }
          break;
        }

        default:
          break;
      }

      guidesRef.current = [];
      boxRectRef.current = null;
      snapRef.current = null;
      connectorDragRef.current = false;
      interactionRef.current = freshInteraction();
      needsRenderRef.current = true;
      updateHoverCursor(wx, wy);
    },
    [openContextMenuAt, toWorld, updateHoverCursor]
  );

  // -------------------------------------------------------------------------
  // Double-click
  // -------------------------------------------------------------------------

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const { x: wx, y: wy } = toWorld(e.clientX, e.clientY);
      const { zoom } = useCanvasStore.getState();
      const tool = useToolStore.getState();
      if (tool.activeTool !== 'select' && tool.activeTool !== 'text') return;

      const hit = getTopElementAt(sortedElements().desc, wx, wy, 5 / zoom);
      if (!hit) {
        startTextEditing(null, wx, wy, null);
        return;
      }
      switch (hit.type) {
        case 'text':
          startTextEditing(hit, wx, wy, caretIndexAt(hit, wx, wy));
          return;
        case 'line':
        case 'arrow':
          setDialog({ kind: 'connector-label', elementId: hit.id });
          return;
        case 'frame':
          setDialog({ kind: 'frame-name', elementId: hit.id });
          return;
        case 'embed':
          if (hit.embedUrl) setActiveEmbedId(hit.id);
          else setDialog({ kind: 'embed-url', elementId: hit.id });
          return;
        default:
          return;
      }
    },
    [caretIndexAt, sortedElements, startTextEditing, toWorld]
  );

  // -------------------------------------------------------------------------
  // Wheel + space + listeners
  // -------------------------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cs = useCanvasStore.getState();
      const local = toScreenLocal(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.002;
        cs.setZoom(cs.zoom * (1 + delta), local.x, local.y);
      } else {
        cs.setOffset(cs.offsetX - e.deltaX / cs.zoom, cs.offsetY - e.deltaY / cs.zoom);
      }
      needsRenderRef.current = true;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isTyping(e.target)) {
        if (!spaceDownRef.current) {
          spaceDownRef.current = true;
          if (interactionRef.current.mode === 'none') setCursor('grab');
        }
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spaceDownRef.current = false;
        if (interactionRef.current.mode === 'none') setCursor('default');
      }
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onPointerDown, onPointerMove, onPointerUp, setCursor, toScreenLocal]);

  // Drag-and-drop image files.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        const { x, y } = toWorld(e.clientX, e.clientY);
        void pasteImageBlob(file, x, y);
      }
    };
    container.addEventListener('dragover', onDragOver);
    container.addEventListener('drop', onDrop);
    return () => {
      container.removeEventListener('dragover', onDragOver);
      container.removeEventListener('drop', onDrop);
    };
  }, [toWorld]);

  // -------------------------------------------------------------------------
  // Worker bridge (drawable pre-generation)
  // -------------------------------------------------------------------------

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../../workers/renderWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
    if (!worker) return;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg?.type !== 'drawables') return;
      const cache = drawableCacheRef.current;
      for (const r of msg.results as { id: string; hash: string; drawables: never[] }[]) {
        const entry = cache.get(r.id);
        if (!entry || entry.hash !== r.hash) cache.set(r.id, { hash: r.hash, drawables: r.drawables });
      }
      needsRenderRef.current = true;
    };

    let rafId: number | null = null;
    const post = () => {
      rafId = null;
      const { elements } = useElementStore.getState();
      const cache = drawableCacheRef.current;
      // Evict entries for elements that no longer exist.
      const live = new Set(elements.map((el) => el.id));
      for (const id of [...cache.keys()]) {
        if (!live.has(id)) cache.delete(id);
      }
      const payload = elements
        .filter((el) => isRoughRenderable(el) && cache.get(el.id)?.hash !== elementVisualHash(el))
        .map((el) => ({ ...el, imageData: undefined, text: undefined }));
      if (payload.length > 0) worker!.postMessage({ type: 'generate', elements: payload });
    };
    const unsub = useElementStore.subscribe(() => {
      if (rafId === null) rafId = requestAnimationFrame(post);
    });
    post();

    return () => {
      unsub();
      if (rafId !== null) cancelAnimationFrame(rafId);
      worker?.terminate();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Render loop
  // -------------------------------------------------------------------------

  useEffect(() => {
    const unsubs = [
      useElementStore.subscribe(() => {
        needsRenderRef.current = true;
      }),
      useCanvasStore.subscribe(() => {
        needsRenderRef.current = true;
      }),
      useToolStore.subscribe(() => {
        needsRenderRef.current = true;
      }),
      useFindStore.subscribe(() => {
        needsRenderRef.current = true;
      }),
    ];

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!roughRef.current) {
      roughRef.current = { rc: rough.canvas(canvas), gen: rough.generator() };
    }

    const observer = new ResizeObserver(() => {
      needsRenderRef.current = true;
    });
    observer.observe(container);

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!needsRenderRef.current) return;
      needsRenderRef.current = false;

      const { rc, gen } = roughRef.current!;
      const cs = useCanvasStore.getState();
      const { elements } = useElementStore.getState();
      const tool = useToolStore.getState();
      const find = useFindStore.getState();
      const it = interactionRef.current;
      const dpr = window.devicePixelRatio || 1;

      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = cs.theme === 'dark' ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.setTransform(dpr * cs.zoom, 0, 0, dpr * cs.zoom, dpr * cs.offsetX * cs.zoom, dpr * cs.offsetY * cs.zoom);

      if (cs.showGrid) renderGrid(ctx, cw, ch, cs.offsetX, cs.offsetY, cs.zoom, cs.theme);

      // Viewport culling with margin.
      const margin = 64 / cs.zoom;
      const viewBounds: Bounds = {
        x: -cs.offsetX - margin,
        y: -cs.offsetY - margin,
        width: cw / cs.zoom + margin * 2,
        height: ch / cs.zoom + margin * 2,
      };

      // Canvas-mode find highlights per element.
      let findMap: Map<string, ElementFindHighlight[]> | null = null;
      if (find.isOpen && find.mode === 'canvas' && find.query && find.matches.length > 0) {
        findMap = new Map();
        find.matches.forEach((m, i) => {
          const list = findMap!.get(m.elementId) ?? [];
          list.push({ start: m.start, end: m.end, active: i === find.activeIndex });
          findMap!.set(m.elementId, list);
        });
      }

      const editingId = editingRef.current?.id ?? null;
      const sorted =
        zSortRef.current.src === elements
          ? zSortRef.current.asc
          : (() => {
              const asc = [...elements].sort((a, b) => a.zIndex - b.zIndex);
              zSortRef.current = { src: elements, asc, desc: [...asc].reverse() };
              return asc;
            })();

      for (const el of sorted) {
        if (el.id === editingId) continue;
        const b = getElementBounds(el);
        if (!boundsOverlap(viewBounds, { x: b.x - 4, y: b.y - 4, width: b.width + 8, height: b.height + 8 })) {
          continue;
        }
        renderElement(ctx, rc, gen, el, {
          theme: cs.theme,
          cache: drawableCacheRef.current,
          getImage,
          findHighlights: findMap?.get(el.id),
        });
      }

      // Connection-point indicators while dragging a connector.
      if (connectorDragRef.current) {
        const exclude = new Set<string>(it.elementId ? [it.elementId] : []);
        drawConnectionIndicators(ctx, sorted, cs.zoom, snapRef.current, exclude);
      }

      // Alignment guides.
      if (guidesRef.current.length > 0) drawAlignmentGuides(ctx, guidesRef.current, cs.zoom);

      // Selection chrome.
      if (tool.selectedIds.length > 0 && it.mode !== 'drawing') {
        const idSet = new Set(tool.selectedIds);
        const selectedEls = elements.filter((el) => idSet.has(el.id) && el.id !== editingId);
        const single = selectedEls.length === 1;
        for (const el of selectedEls) {
          if (el.locked) {
            drawSelectionBox(ctx, getElementBounds(el), cs.zoom, { locked: true });
          } else if (el.type === 'line' || el.type === 'arrow') {
            if (single) drawEndpointHandles(ctx, el, cs.zoom);
            else drawSelectionBox(ctx, getElementBounds(el), cs.zoom, {});
          } else {
            drawSelectionBox(ctx, getElementBounds(el), cs.zoom, { withHandles: single });
          }
        }
        if (selectedEls.length > 1) {
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const el of selectedEls) {
            const b = getElementBounds(el);
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
          }
          const union = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          const groupIds = new Set(selectedEls.map((el) => el.groupId));
          if (groupIds.size === 1 && !groupIds.has(undefined)) {
            drawGroupBounds(ctx, union, cs.zoom);
          } else {
            drawSelectionBox(ctx, union, cs.zoom, {});
          }
        }
      }

      // Rubber band.
      if (it.mode === 'box-select' && boxRectRef.current) {
        drawRubberBand(ctx, boxRectRef.current, cs.zoom);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const unsub of unsubs) unsub();
    };
  }, [getImage]);

  // -------------------------------------------------------------------------
  // Dialog handling
  // -------------------------------------------------------------------------

  const dialogElement = dialog
    ? useElementStore.getState().elements.find((el) => el.id === dialog.elementId)
    : null;

  const closeDialog = () => setDialog(null);

  const confirmDialog = (value: string) => {
    if (!dialog) return;
    const store = useElementStore.getState();
    const el = store.elements.find((x) => x.id === dialog.elementId);
    if (!el) {
      closeDialog();
      return;
    }
    historyActions.saveSnapshot();
    switch (dialog.kind) {
      case 'embed-url': {
        const safe = sanitizeEmbedUrl(value);
        if (safe) store.updateElement(el.id, { embedUrl: safe });
        break;
      }
      case 'hyperlink': {
        const safe = sanitizeHyperlink(value);
        if (safe) store.updateElement(el.id, { hyperlink: safe });
        break;
      }
      case 'frame-name':
        store.updateElement(el.id, { frameName: value.trim() || 'Frame' });
        break;
      case 'connector-label':
        store.updateElement(el.id, { connectorLabel: value.trim() || undefined });
        break;
    }
    closeDialog();
  };

  const removeDialogValue = () => {
    if (!dialog) return;
    const store = useElementStore.getState();
    historyActions.saveSnapshot();
    switch (dialog.kind) {
      case 'embed-url':
        store.updateElement(dialog.elementId, { embedUrl: undefined });
        break;
      case 'hyperlink':
        store.updateElement(dialog.elementId, { hyperlink: undefined });
        break;
      case 'connector-label':
        store.updateElement(dialog.elementId, { connectorLabel: undefined });
        break;
      default:
        break;
    }
    closeDialog();
  };

  const dialogMeta: Record<DialogKind, { title: string; description?: string; placeholder: string; initial: (el: CanvasElement) => string; removable: boolean }> = {
    'embed-url': {
      title: 'Embed URL',
      description: 'YouTube and Vimeo links become players. Other sites load in a sandboxed frame.',
      placeholder: 'https://…',
      initial: (el) => el.embedUrl ?? '',
      removable: true,
    },
    hyperlink: {
      title: 'Link',
      description: 'Ctrl+click the element to open it. http(s) and mailto only.',
      placeholder: 'https://… or mailto:…',
      initial: (el) => el.hyperlink ?? '',
      removable: true,
    },
    'frame-name': {
      title: 'Rename frame',
      placeholder: 'Frame name',
      initial: (el) => el.frameName ?? 'Frame',
      removable: false,
    },
    'connector-label': {
      title: 'Connector label',
      placeholder: 'Label text',
      initial: (el) => el.connectorLabel ?? '',
      removable: true,
    },
  };

  const editingElement = useElementStore((s) =>
    editing ? s.elements.find((el) => el.id === editing.id) : undefined
  );

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        role="application"
        aria-label="Drawing canvas"
        aria-describedby="canvas-instructions"
        onDoubleClick={onDoubleClick}
      />
      <p id="canvas-instructions" className="sr-only">
        Infinite drawing canvas. Pick a tool from the left toolbar or press its shortcut key, then
        click and drag to draw. Press question mark for the full list of keyboard shortcuts.
      </p>
      <div aria-live="polite" className="sr-only" />

      <EmbedLayer activeEmbedId={activeEmbedId} />

      {editing && editingElement && (
        <TextEditorOverlay
          key={editing.id}
          element={editingElement}
          wrapContainerId={editing.wrapContainerId}
          caretIndex={editing.caretIndex}
          onCommit={commitTextEditing}
        />
      )}

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onRequestDialog={(kind, elementId) => {
            setContextMenu(null);
            setDialog({ kind, elementId });
          }}
          onInsertEmbed={(wx, wy) => {
            setContextMenu(null);
            const store = useElementStore.getState();
            historyActions.saveSnapshot();
            const el = createElement('embed', wx - 240, wy - 135, useToolStore.getState().getStyle(), store.getMaxZIndex() + 1);
            el.width = 480;
            el.height = 270;
            store.addElement(el);
            useToolStore.getState().setSelectedIds([el.id]);
            setDialog({ kind: 'embed-url', elementId: el.id });
          }}
          onInsertImage={(wx, wy) => {
            setContextMenu(null);
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) void pasteImageBlob(file, wx, wy);
            };
            input.click();
          }}
        />
      )}

      {dialog && dialogElement && (
        <PromptDialog
          title={dialogMeta[dialog.kind].title}
          description={dialogMeta[dialog.kind].description}
          placeholder={dialogMeta[dialog.kind].placeholder}
          initialValue={dialogMeta[dialog.kind].initial(dialogElement)}
          removable={dialogMeta[dialog.kind].removable && !!dialogMeta[dialog.kind].initial(dialogElement)}
          onConfirm={confirmDialog}
          onRemove={removeDialogValue}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function getTextLineCount(el: CanvasElement): number {
  // Wrap-aware line count for resize recalculation.
  return wrapTextToLines(el.text ?? '', Math.max(8, el.width), textFont(el)).length;
}
