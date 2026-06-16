/** Canvas 2D rendering of every element type (+ rough.js drawable cache). */
import type { Drawable, Options } from 'roughjs/bin/core';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { RoughGenerator } from 'roughjs/bin/generator';
import type { CanvasElement, Theme } from '../../types';
import {
  CODE_BG,
  CODE_FONT,
  FIND_HIGHLIGHT,
  FIND_HIGHLIGHT_ACTIVE,
  HAND_FONT,
  UI_FONT,
} from '../../constants';
import { getElbowRoute, getElementBounds, getLineEndpoints, hashString } from '../../utils/geometry';
import { CODE_THEME_DARK, languageLabel, tokenizeLine } from '../../utils/codeDetection';
import { wrapTextToLines } from '../../utils/textWrap';

export interface DrawableCacheEntry {
  hash: string;
  drawables: Drawable[];
}
export type DrawableCache = Map<string, DrawableCacheEntry>;

export interface ElementFindHighlight {
  start: number;
  end: number;
  active: boolean;
}

export interface RenderOptions {
  theme: Theme;
  cache?: DrawableCache;
  getImage?: (el: CanvasElement) => HTMLImageElement | null;
  findHighlights?: ElementFindHighlight[];
}

/**
 * Per-element-identity memo. Elements are immutable (the store replaces the
 * object on every edit), so an unchanged element keeps its reference across
 * frames and we can hash it once. This is the hot path: elementVisualHash runs
 * for every visible rough element on every animation frame during pan / zoom /
 * drag, and for freehand the points.join() below is the expensive part.
 */
const hashCache = new WeakMap<CanvasElement, string>();

/** Hash of every visual field that affects rough.js output. */
export function elementVisualHash(el: CanvasElement): string {
  const cached = hashCache.get(el);
  if (cached !== undefined) return cached;
  const pts = el.points ? el.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';') : '';
  const hash = [
    el.type,
    el.x.toFixed(2),
    el.y.toFixed(2),
    el.width.toFixed(2),
    el.height.toFixed(2),
    pts,
    el.strokeColor,
    el.fillColor,
    el.strokeWidth,
    el.roughness,
    el.strokeStyle,
    el.fillStyle,
    el.edgeRoundness,
    el.connectorStyle ?? 'straight',
  ].join('|');
  hashCache.set(el, hash);
  return hash;
}

/** rough.js option bag for an element; seed derived from id for stable sketchiness. */
export function buildRoughOptions(el: CanvasElement): Options {
  const o: Options = {
    seed: hashString(el.id),
    stroke: el.strokeColor,
    strokeWidth: el.strokeWidth,
    roughness: el.roughness,
  };
  if (el.strokeStyle === 'dashed') o.strokeLineDash = [el.strokeWidth * 4, el.strokeWidth * 4];
  else if (el.strokeStyle === 'dotted') o.strokeLineDash = [el.strokeWidth, el.strokeWidth * 2.5];
  if (el.fillColor && el.fillColor !== 'transparent') {
    o.fill = el.fillColor;
    o.fillStyle = el.fillStyle;
    o.hachureGap = 4 + el.strokeWidth * 1.5;
    o.fillWeight = el.strokeWidth / 2;
  }
  return o;
}

const ROUGH_TYPES = new Set(['rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'freehand']);

export function isRoughRenderable(el: CanvasElement): boolean {
  return ROUGH_TYPES.has(el.type);
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  return (
    `M ${x + rr} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} ` +
    `L ${x + w} ${y + h - rr} Q ${x + w} ${y + h} ${x + w - rr} ${y + h} ` +
    `L ${x + rr} ${y + h} Q ${x} ${y + h} ${x} ${y + h - rr} ` +
    `L ${x} ${y + rr} Q ${x} ${y} ${x + rr} ${y} Z`
  );
}

function arrowheadLines(el: CanvasElement): [number, number, number, number][] {
  const headLen = 16 + 2 * el.strokeWidth;
  let fromX: number;
  let fromY: number;
  let tipX: number;
  let tipY: number;
  if (el.connectorStyle === 'elbow') {
    const route = getElbowRoute(el);
    const a = route[route.length - 2];
    const b = route[route.length - 1];
    fromX = a.x;
    fromY = a.y;
    tipX = b.x;
    tipY = b.y;
  } else {
    const [s, e] = getLineEndpoints(el);
    fromX = s.x;
    fromY = s.y;
    tipX = e.x;
    tipY = e.y;
  }
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const a1 = angle - Math.PI / 6;
  const a2 = angle + Math.PI / 6;
  return [
    [tipX, tipY, tipX - headLen * Math.cos(a1), tipY - headLen * Math.sin(a1)],
    [tipX, tipY, tipX - headLen * Math.cos(a2), tipY - headLen * Math.sin(a2)],
  ];
}

/** Pure drawable generation (shared by main thread + worker). */
export function generateDrawables(gen: RoughGenerator, el: CanvasElement): Drawable[] {
  const o = buildRoughOptions(el);
  const b = getElementBounds(el);

  switch (el.type) {
    case 'rectangle':
      if (el.edgeRoundness > 0) {
        return [gen.path(roundedRectPath(b.x, b.y, b.width, b.height, el.edgeRoundness), o)];
      }
      return [gen.rectangle(b.x, b.y, b.width, b.height, o)];
    case 'diamond': {
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      return [
        gen.polygon(
          [
            [cx, b.y],
            [b.x + b.width, cy],
            [cx, b.y + b.height],
            [b.x, cy],
          ],
          o
        ),
      ];
    }
    case 'ellipse':
      return [gen.ellipse(b.x + b.width / 2, b.y + b.height / 2, b.width, b.height, o)];
    case 'line':
    case 'arrow': {
      const out: Drawable[] = [];
      if (el.connectorStyle === 'elbow') {
        const route = getElbowRoute(el);
        out.push(gen.linearPath(route.map((p) => [p.x, p.y] as [number, number]), o));
      } else {
        const [s, e] = getLineEndpoints(el);
        out.push(gen.line(s.x, s.y, e.x, e.y, o));
      }
      if (el.type === 'arrow') {
        const headOpts: Options = { ...o, strokeLineDash: undefined, fill: undefined };
        for (const [x1, y1, x2, y2] of arrowheadLines(el)) {
          out.push(gen.line(x1, y1, x2, y2, headOpts));
        }
      }
      return out;
    }
    case 'freehand': {
      const pts = (el.points ?? []).map((p) => [el.x + p.x, el.y + p.y] as [number, number]);
      if (pts.length < 2) return [];
      // Rough-drawn freehand looks bad on top of already-rough input.
      return [gen.linearPath(pts, { ...o, roughness: 0 })];
    }
    default:
      return [];
  }
}

function getCachedDrawables(
  el: CanvasElement,
  gen: RoughGenerator,
  cache?: DrawableCache
): Drawable[] {
  if (!cache) return generateDrawables(gen, el);
  const hash = elementVisualHash(el);
  const entry = cache.get(el.id);
  if (entry && entry.hash === hash) return entry.drawables;
  const drawables = generateDrawables(gen, el);
  cache.set(el.id, { hash, drawables });
  return drawables;
}

// ---------------------------------------------------------------------------
// Text / code helpers
// ---------------------------------------------------------------------------

export function textFont(el: CanvasElement): string {
  return `${el.fontSize ?? 20}px ${el.isCode ? CODE_FONT : HAND_FONT}`;
}

export function textLineHeight(el: CanvasElement): number {
  return (el.fontSize ?? 20) * (el.isCode ? 1.5 : 1.3);
}

export const CODE_PADDING = 16;

/** Visible lines for a text element (wrap-aware). */
export function getTextLines(el: CanvasElement): string[] {
  const text = el.text ?? '';
  if (el.textWrap && el.width > 0 && !el.isCode) {
    return wrapTextToLines(text, Math.max(8, el.width), textFont(el));
  }
  return text.split('\n');
}

function drawFindHighlights(
  ctx: CanvasRenderingContext2D,
  el: CanvasElement,
  highlights: ElementFindHighlight[],
  originX: number,
  originY: number,
  lineHeight: number
) {
  // Only for non-wrapped layouts (raw lines map 1:1 to rendered lines).
  const text = el.text ?? '';
  const lines = text.split('\n');
  const lineStarts: number[] = [];
  let acc = 0;
  for (const line of lines) {
    lineStarts.push(acc);
    acc += line.length + 1;
  }
  ctx.save();
  ctx.font = textFont(el);
  for (const h of highlights) {
    for (let i = 0; i < lines.length; i++) {
      const ls = lineStarts[i];
      const le = ls + lines[i].length;
      const s = Math.max(h.start, ls);
      const e = Math.min(h.end, le);
      if (s >= e) continue;
      const preW = ctx.measureText(lines[i].slice(0, s - ls)).width;
      const w = ctx.measureText(lines[i].slice(s - ls, e - ls)).width;
      ctx.fillStyle = h.active ? FIND_HIGHLIGHT_ACTIVE : FIND_HIGHLIGHT;
      ctx.fillRect(originX + preW - 1, originY + i * lineHeight - 1, w + 2, lineHeight);
    }
  }
  ctx.restore();
}

function renderText(ctx: CanvasRenderingContext2D, el: CanvasElement, opts: RenderOptions) {
  const lineHeight = textLineHeight(el);
  ctx.font = textFont(el);
  ctx.textBaseline = 'top';
  const pad = lineHeight * 0.08;

  if (!el.textWrap && opts.findHighlights?.length) {
    drawFindHighlights(ctx, el, opts.findHighlights, el.x, el.y + pad, lineHeight);
    ctx.font = textFont(el);
  }
  ctx.fillStyle = el.strokeColor;
  const lines = getTextLines(el);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], el.x, el.y + pad + i * lineHeight);
  }
}

function renderCodeBlock(ctx: CanvasRenderingContext2D, el: CanvasElement, opts: RenderOptions) {
  const b = getElementBounds(el);
  const lineHeight = textLineHeight(el);
  const lang = el.codeLanguage ?? 'code';

  // Background card (always dark for legibility).
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.width, b.height, 10);
  ctx.fillStyle = CODE_BG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Language badge top-right.
  ctx.font = `600 10px ${UI_FONT}`;
  ctx.textBaseline = 'top';
  const label = languageLabel(lang);
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.roundRect(b.x + b.width - lw - 22, b.y + 8, lw + 14, 16, 5);
  ctx.fill();
  ctx.fillStyle = '#8e95b3';
  ctx.fillText(label, b.x + b.width - lw - 15, b.y + 11.5);

  // Clip code to the card.
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.width, b.height, 10);
  ctx.clip();

  ctx.font = textFont(el);
  if (opts.findHighlights?.length) {
    drawFindHighlights(
      ctx,
      el,
      opts.findHighlights.map((h) => ({ ...h })),
      b.x + CODE_PADDING,
      b.y + CODE_PADDING,
      lineHeight
    );
    ctx.font = textFont(el);
  }

  const lines = (el.text ?? '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    let x = b.x + CODE_PADDING;
    const y = b.y + CODE_PADDING + i * lineHeight + lineHeight * 0.12;
    for (const tok of tokenizeLine(lines[i], lang)) {
      ctx.fillStyle = CODE_THEME_DARK[tok.kind];
      ctx.fillText(tok.text, x, y);
      x += ctx.measureText(tok.text).width;
    }
  }
  ctx.restore();
}

function renderImage(ctx: CanvasRenderingContext2D, el: CanvasElement, opts: RenderOptions) {
  const b = getElementBounds(el);
  const img = opts.getImage?.(el) ?? null;
  if (img) {
    ctx.drawImage(img, b.x, b.y, b.width, b.height);
    return;
  }
  // Decoding placeholder.
  ctx.save();
  ctx.strokeStyle = opts.theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b.x, b.y, b.width, b.height);
  ctx.setLineDash([]);
  ctx.fillStyle = opts.theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  ctx.font = `12px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Loading image…', b.x + b.width / 2, b.y + b.height / 2);
  ctx.restore();
}

function renderEmbedPlaceholder(ctx: CanvasRenderingContext2D, el: CanvasElement, opts: RenderOptions) {
  const b = getElementBounds(el);
  const dark = opts.theme === 'dark';
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.width, b.height, 12);
  ctx.fillStyle = dark ? '#1c1c26' : '#ffffff';
  ctx.fill();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Browser chrome bar.
  const barH = Math.min(32, b.height * 0.18);
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.width, barH, [12, 12, 0, 0]);
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  ctx.fill();
  const dotY = b.y + barH / 2;
  const dotColors = ['#ff5f57', '#febc2e', '#28c840'];
  dotColors.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(b.x + 14 + i * 14, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });

  // URL pill.
  const pillX = b.x + 60;
  const pillW = Math.max(40, b.width - 74);
  ctx.beginPath();
  ctx.roundRect(pillX, dotY - 8, pillW, 16, 8);
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  ctx.fill();
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  ctx.font = `11px ${UI_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const urlText = el.embedUrl ? el.embedUrl.replace(/^https?:\/\//, '').slice(0, 48) : 'No URL set';
  ctx.save();
  ctx.beginPath();
  ctx.rect(pillX + 8, dotY - 8, pillW - 16, 16);
  ctx.clip();
  ctx.fillText(urlText, pillX + 10, dotY + 0.5);
  ctx.restore();

  // Play glyph.
  const cx = b.x + b.width / 2;
  const cy = b.y + barH + (b.height - barH) / 2 - 6;
  const r = Math.min(26, b.width / 8, b.height / 6);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.1)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.28, cy - r * 0.42);
  ctx.lineTo(cx + r * 0.48, cy);
  ctx.lineTo(cx - r * 0.28, cy + r * 0.42);
  ctx.closePath();
  ctx.fillStyle = '#6366f1';
  ctx.fill();

  // Hint.
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  ctx.font = `12px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(el.embedUrl ? 'Double-click to interact' : 'Double-click to add URL', cx, cy + r + 18);
  ctx.restore();
  ctx.textAlign = 'left';
}

function renderFrame(ctx: CanvasRenderingContext2D, el: CanvasElement, opts: RenderOptions) {
  const b = getElementBounds(el);
  const dark = opts.theme === 'dark';
  ctx.save();
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';
  ctx.fillRect(b.x, b.y, b.width, b.height);
  ctx.strokeStyle = dark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)';
  ctx.lineWidth = Math.max(1, el.strokeWidth * 0.75);
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(b.x, b.y, b.width, b.height);
  ctx.setLineDash([]);

  ctx.font = `500 12px ${UI_FONT}`;
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = dark ? 'rgba(148,163,184,0.9)' : 'rgba(100,116,139,0.95)';
  ctx.fillText(el.frameName ?? 'Frame', b.x + 2, b.y - 6);
  ctx.restore();
}

function renderConnectorLabel(ctx: CanvasRenderingContext2D, el: CanvasElement, opts: RenderOptions) {
  if (!el.connectorLabel) return;
  let mx: number;
  let my: number;
  if (el.connectorStyle === 'elbow') {
    const route = getElbowRoute(el);
    mx = (route[1].x + route[2].x) / 2;
    my = (route[1].y + route[2].y) / 2;
  } else {
    const [s, e] = getLineEndpoints(el);
    mx = (s.x + e.x) / 2;
    my = (s.y + e.y) / 2;
  }
  const dark = opts.theme === 'dark';
  ctx.save();
  ctx.font = `500 13px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(el.connectorLabel).width;
  ctx.beginPath();
  ctx.roundRect(mx - w / 2 - 9, my - 12, w + 18, 24, 12);
  ctx.fillStyle = dark ? '#22222e' : '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99,102,241,0.55)';
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.fillStyle = dark ? '#d4d4e2' : '#37374a';
  ctx.fillText(el.connectorLabel, mx, my + 0.5);
  ctx.restore();
  ctx.textAlign = 'left';
}

function renderHyperlinkBadge(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  const b = getElementBounds(el);
  const x = b.x + 4;
  const y = b.y + b.height - 18;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, 18, 18, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(25,113,194,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Chain-link glyph.
  ctx.strokeStyle = '#1971c2';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 5.5, y + 12.5);
  ctx.lineTo(x + 12.5, y + 5.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 5.8, y + 12.2, 3.2, Math.PI * 0.6, Math.PI * 1.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 12.2, y + 5.8, 3.2, Math.PI * 1.6, Math.PI * 0.6);
  ctx.stroke();
  ctx.restore();
}

function renderLockBadge(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  const b = getElementBounds(el);
  const x = b.x + b.width - 20;
  const y = b.y + 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, 18, 18, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99,102,241,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = '#6366f1';
  ctx.fillStyle = '#6366f1';
  ctx.lineWidth = 1.6;
  // Shackle.
  ctx.beginPath();
  ctx.arc(x + 9, y + 7.5, 3, Math.PI, 0);
  ctx.stroke();
  // Body.
  ctx.beginPath();
  ctx.roundRect(x + 4.5, y + 7.5, 9, 6.5, 1.5);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function renderElement(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  gen: RoughGenerator,
  el: CanvasElement,
  opts: RenderOptions
) {
  ctx.save();
  ctx.globalAlpha = el.opacity;

  switch (el.type) {
    case 'rectangle':
    case 'diamond':
    case 'ellipse':
    case 'freehand':
      for (const d of getCachedDrawables(el, gen, opts.cache)) rc.draw(d);
      break;
    case 'line':
    case 'arrow':
      for (const d of getCachedDrawables(el, gen, opts.cache)) rc.draw(d);
      renderConnectorLabel(ctx, el, opts);
      break;
    case 'text':
      if (el.isCode) renderCodeBlock(ctx, el, opts);
      else renderText(ctx, el, opts);
      break;
    case 'image':
      renderImage(ctx, el, opts);
      break;
    case 'embed':
      renderEmbedPlaceholder(ctx, el, opts);
      break;
    case 'frame':
      renderFrame(ctx, el, opts);
      break;
  }

  if (el.hyperlink) renderHyperlinkBadge(ctx, el);
  if (el.locked) renderLockBadge(ctx, el);
  ctx.restore();
}
