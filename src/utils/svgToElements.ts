/** AI-returned SVG → CanvasElement[] conversion. */
import { nanoid } from 'nanoid';
import type { CanvasElement, ElementType, Point } from '../types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function parseColor(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  const v = raw.trim();
  if (!v || v === 'inherit' || v.startsWith('url(')) return fallback;
  if (v === 'none') return 'transparent';
  return v;
}

/** Walk up the DOM collecting an inherited presentation attribute. */
function inherited(node: Element, attr: string): string | null {
  let cur: Element | null = node;
  while (cur && cur.tagName.toLowerCase() !== 'svg') {
    const direct = cur.getAttribute(attr);
    if (direct) return direct;
    const style = cur.getAttribute('style');
    if (style) {
      const m = style.match(new RegExp(`(?:^|;)\\s*${attr}\\s*:\\s*([^;]+)`));
      if (m) return m[1].trim();
    }
    cur = cur.parentElement;
  }
  return null;
}

function num(el: Element, attr: string, fallback = 0): number {
  const v = parseFloat(el.getAttribute(attr) ?? '');
  return Number.isFinite(v) ? v : fallback;
}

interface StyleCtx {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
}

function styleFor(node: Element): StyleCtx {
  const stroke = parseColor(inherited(node, 'stroke'), '#1e1e1e');
  let fill = parseColor(inherited(node, 'fill'), '#1e1e1e');
  // SVG default fill is black; for shape conversion an unspecified fill on
  // stroked primitives reads better as filled (AI output relies on it).
  const swRaw = parseFloat(inherited(node, 'stroke-width') ?? '');
  const opRaw = parseFloat(inherited(node, 'opacity') ?? '');
  const fsRaw = parseFloat(inherited(node, 'font-size') ?? '');
  return {
    strokeColor: stroke === 'transparent' ? (fill === 'transparent' ? '#1e1e1e' : fill) : stroke,
    fillColor: fill,
    strokeWidth: Number.isFinite(swRaw) ? clamp(swRaw, 1, 6) : 2,
    opacity: Number.isFinite(opRaw) ? clamp(opRaw, 0, 1) : 1,
    fontSize: Number.isFinite(fsRaw) ? clamp(fsRaw, 12, 48) : 16,
  };
}

function baseElement(type: ElementType, s: StyleCtx, z: number): CanvasElement {
  const now = Date.now();
  return {
    id: nanoid(),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    strokeColor: s.strokeColor,
    fillColor: s.fillColor,
    strokeWidth: s.strokeWidth,
    roughness: 1,
    opacity: s.opacity,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    edgeRoundness: 0,
    rotation: 0,
    zIndex: z,
    createdAt: now,
    updatedAt: now,
  };
}

function pointsFromAttr(raw: string | null): Point[] {
  if (!raw) return [];
  const nums = raw.trim().split(/[\s,]+/).map(parseFloat).filter(Number.isFinite);
  const pts: Point[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

function relativize(el: CanvasElement, absPts: Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of absPts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  el.x = minX;
  el.y = minY;
  el.width = maxX - minX;
  el.height = maxY - minY;
  el.points = absPts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}

/**
 * Parse an SVG string into canvas elements, translated so the viewBox center
 * lands on (centerX, centerY).
 */
export function parseSVGToElements(
  svgText: string,
  centerX: number,
  centerY: number,
  startZIndex: number
): CanvasElement[] {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const src = doc.querySelector('svg');
  if (!src) return [];

  // Mount hidden so path.getTotalLength()/getPointAtLength() work.
  const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  host.style.position = 'absolute';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.setAttribute('width', '10');
  host.setAttribute('height', '10');
  for (const attr of Array.from(src.attributes)) host.setAttribute(attr.name, attr.value);
  while (src.firstChild) host.appendChild(src.firstChild);
  document.body.appendChild(host);

  const out: CanvasElement[] = [];
  let z = startZIndex;

  const visit = (node: Element) => {
    const tag = node.tagName.toLowerCase();
    const s = styleFor(node);

    switch (tag) {
      case 'g': {
        for (const child of Array.from(node.children)) visit(child);
        return;
      }
      case 'rect': {
        const el = baseElement('rectangle', s, z++);
        el.x = num(node, 'x');
        el.y = num(node, 'y');
        el.width = num(node, 'width');
        el.height = num(node, 'height');
        el.edgeRoundness = clamp(num(node, 'rx'), 0, 100);
        out.push(el);
        return;
      }
      case 'circle': {
        const el = baseElement('ellipse', s, z++);
        const r = num(node, 'r');
        el.x = num(node, 'cx') - r;
        el.y = num(node, 'cy') - r;
        el.width = r * 2;
        el.height = r * 2;
        out.push(el);
        return;
      }
      case 'ellipse': {
        const el = baseElement('ellipse', s, z++);
        const rx = num(node, 'rx');
        const ry = num(node, 'ry');
        el.x = num(node, 'cx') - rx;
        el.y = num(node, 'cy') - ry;
        el.width = rx * 2;
        el.height = ry * 2;
        out.push(el);
        return;
      }
      case 'line': {
        const el = baseElement('line', s, z++);
        el.roughness = 0;
        const pts = [
          { x: num(node, 'x1'), y: num(node, 'y1') },
          { x: num(node, 'x2'), y: num(node, 'y2') },
        ];
        relativize(el, pts);
        out.push(el);
        return;
      }
      case 'polyline':
      case 'polygon': {
        const pts = pointsFromAttr(node.getAttribute('points'));
        if (pts.length < 2) return;
        if (tag === 'polygon') pts.push({ ...pts[0] });
        const el = baseElement('freehand', s, z++);
        el.roughness = 0;
        relativize(el, pts);
        out.push(el);
        return;
      }
      case 'path': {
        const path = node as SVGPathElement;
        let total = 0;
        try {
          total = path.getTotalLength();
        } catch {
          return;
        }
        if (!Number.isFinite(total) || total <= 0) return;
        const step = 5;
        const pts: Point[] = [];
        for (let d = 0; d <= total; d += step) {
          const p = path.getPointAtLength(d);
          pts.push({ x: p.x, y: p.y });
        }
        const endP = path.getPointAtLength(total);
        pts.push({ x: endP.x, y: endP.y });
        if (pts.length < 2) return;
        const el = baseElement('freehand', s, z++);
        el.roughness = 0;
        relativize(el, pts);
        out.push(el);
        return;
      }
      case 'text': {
        const el = baseElement('text', s, z++);
        const content = (node.textContent ?? '').trim();
        if (!content) return;
        el.text = content;
        el.fontSize = s.fontSize;
        el.strokeColor = s.fillColor !== 'transparent' ? s.fillColor : s.strokeColor;
        el.x = num(node, 'x');
        el.y = num(node, 'y') - s.fontSize; // SVG text y = baseline
        const approxW = content.length * s.fontSize * 0.55;
        const anchor = inherited(node, 'text-anchor');
        if (anchor === 'middle') el.x -= approxW / 2;
        else if (anchor === 'end') el.x -= approxW;
        el.width = approxW;
        el.height = s.fontSize * 1.3;
        out.push(el);
        return;
      }
      default:
        return; // defs, gradients, filters, etc.
    }
  };

  try {
    for (const child of Array.from(host.children)) visit(child);
  } finally {
    document.body.removeChild(host);
  }

  // Translate so the viewBox center maps to the requested viewport center.
  const vb = (host.getAttribute('viewBox') ?? '0 0 800 600').split(/[\s,]+/).map(parseFloat);
  const vbCx = (vb[0] ?? 0) + (vb[2] ?? 800) / 2;
  const vbCy = (vb[1] ?? 0) + (vb[3] ?? 600) / 2;
  const dx = centerX - vbCx;
  const dy = centerY - vbCy;
  for (const el of out) {
    el.x += dx;
    el.y += dy;
  }
  return out;
}
