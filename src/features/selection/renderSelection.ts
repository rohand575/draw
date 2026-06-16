/** Selection box, handles, alignment guides, connection points, rubber band. */
import type { AlignmentGuide, Bounds, CanvasElement } from '../../types';
import { ACCENT, GUIDE_COLOR, HANDLE_SIZE, SELECTION_PADDING, UI_FONT } from '../../constants';
import {
  CONNECTABLE_TYPES,
  getConnectionPointAbsolute,
  getElementBounds,
  getLineEndpoints,
  getResizeHandles,
} from '../../utils/geometry';
import type { ConnectionSnap } from '../../utils/geometry';

export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  b: Bounds,
  zoom: number,
  options: { locked?: boolean; withHandles?: boolean } = {}
) {
  const pad = SELECTION_PADDING;
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5 / zoom;
  if (options.locked) ctx.setLineDash([4 / zoom, 3 / zoom]);
  ctx.strokeRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
  ctx.setLineDash([]);

  if (options.withHandles && !options.locked) {
    const size = HANDLE_SIZE / zoom;
    for (const h of getResizeHandles(b)) {
      ctx.beginPath();
      ctx.roundRect(h.x - size / 2, h.y - size / 2, size, size, 2 / zoom);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.25 / zoom;
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawEndpointHandles(ctx: CanvasRenderingContext2D, el: CanvasElement, zoom: number) {
  const [s, e] = getLineEndpoints(el);
  const r = (HANDLE_SIZE / zoom) * 0.62;
  ctx.save();
  for (const p of [s, e]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.5 / zoom;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGroupBounds(ctx: CanvasRenderingContext2D, b: Bounds, zoom: number) {
  const pad = SELECTION_PADDING + 4;
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  ctx.strokeRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
  ctx.setLineDash([]);

  const fs = 10 / zoom;
  ctx.font = `600 ${fs}px ${UI_FONT}`;
  const label = 'Group';
  const w = ctx.measureText(label).width;
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.roundRect(b.x - pad, b.y - pad - 16 / zoom, w + 12 / zoom, 13 / zoom, 3 / zoom);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x - pad + 6 / zoom, b.y - pad - 9.5 / zoom);
  ctx.restore();
}

export function drawAlignmentGuides(ctx: CanvasRenderingContext2D, guides: AlignmentGuide[], zoom: number) {
  ctx.save();
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  for (const g of guides) {
    ctx.beginPath();
    if (g.type === 'vertical') {
      ctx.moveTo(g.position, g.start);
      ctx.lineTo(g.position, g.end);
    } else {
      ctx.moveTo(g.start, g.position);
      ctx.lineTo(g.end, g.position);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Edge-midpoint indicators on connectable shapes while drawing an arrow. */
export function drawConnectionIndicators(
  ctx: CanvasRenderingContext2D,
  elements: CanvasElement[],
  zoom: number,
  activeSnap: ConnectionSnap | null,
  excludeIds: Set<string>
) {
  ctx.save();
  for (const el of elements) {
    if (el.locked || excludeIds.has(el.id) || !CONNECTABLE_TYPES.has(el.type)) continue;
    for (const name of ['n', 's', 'e', 'w'] as const) {
      const p = getConnectionPointAbsolute(el, name);
      const isActive = activeSnap?.elementId === el.id && activeSnap.point === name;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (isActive ? 6 : 3.5) / zoom, 0, Math.PI * 2);
      if (isActive) {
        ctx.fillStyle = ACCENT;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(99,102,241,0.85)';
        ctx.fill();
      }
    }
  }
  // Center snap indicator if active.
  if (activeSnap?.point === 'center') {
    ctx.beginPath();
    ctx.arc(activeSnap.x, activeSnap.y, 6 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRubberBand(ctx: CanvasRenderingContext2D, rect: Bounds, zoom: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(99,102,241,0.08)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([4 / zoom, 3 / zoom]);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

/** Dashed outline for locked elements that are selected. */
export function drawLockedOutline(ctx: CanvasRenderingContext2D, el: CanvasElement, zoom: number) {
  drawSelectionBox(ctx, getElementBounds(el), zoom, { locked: true, withHandles: false });
}
