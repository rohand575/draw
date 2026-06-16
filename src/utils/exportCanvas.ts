/** PNG / SVG / JSON / .mcv exports + clipboard image + project import. */
import rough from 'roughjs/bin/rough';
import type { CanvasElement, Theme } from '../types';
import { CANVAS_BG_DARK, CANVAS_BG_LIGHT } from '../constants';
import { getElementsBounds } from './geometry';
import { renderElement, type DrawableCache } from '../features/drawing/renderElement';
import { renderElementSVG } from '../features/drawing/renderElementSVG';

const EXPORT_PADDING = 40;
const MAX_PIXELS = 64_000_000;

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function downloadFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Pre-decode all image elements so drawImage never misses during export. */
async function loadImages(elements: CanvasElement[]): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  await Promise.all(
    elements
      .filter((el) => el.type === 'image' && el.imageData)
      .map(
        (el) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              map.set(el.id, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = el.imageData!;
          })
      )
  );
  return map;
}

async function renderToCanvas(elements: CanvasElement[], theme: Theme): Promise<HTMLCanvasElement | null> {
  const bounds = getElementsBounds(elements);
  if (!bounds) return null;

  const w = bounds.width + EXPORT_PADDING * 2;
  const h = bounds.height + EXPORT_PADDING * 2;
  let scale = 2;
  if (w * h * scale * scale > MAX_PIXELS) {
    scale = Math.max(0.25, Math.sqrt(MAX_PIXELS / (w * h)));
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = theme === 'dark' ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-bounds.x + EXPORT_PADDING, -bounds.y + EXPORT_PADDING);

  const images = await loadImages(elements);
  const rc = rough.canvas(canvas);
  const gen = rough.generator();
  const cache: DrawableCache = new Map();
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    renderElement(ctx, rc, gen, el, {
      theme,
      cache,
      getImage: (e) => images.get(e.id) ?? null,
    });
  }
  return canvas;
}

export async function exportAsPNG(elements: CanvasElement[], theme: Theme): Promise<void> {
  const canvas = await renderToCanvas(elements, theme);
  if (!canvas) return;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) downloadFile(`canvas-${timestamp()}.png`, blob);
      resolve();
    }, 'image/png');
  });
}

export async function copyAsImage(elements: CanvasElement[], theme: Theme): Promise<boolean> {
  const canvas = await renderToCanvas(elements, theme);
  if (!canvas) return false;
  try {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

export function exportAsSVG(elements: CanvasElement[], theme: Theme): void {
  const bounds = getElementsBounds(elements);
  if (!bounds) return;
  const w = bounds.width + EXPORT_PADDING * 2;
  const h = bounds.height + EXPORT_PADDING * 2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(Math.round(w)));
  svg.setAttribute('height', String(Math.round(h)));
  svg.setAttribute('viewBox', `0 0 ${Math.round(w)} ${Math.round(h)}`);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', theme === 'dark' ? CANVAS_BG_DARK : CANVAS_BG_LIGHT);
  svg.appendChild(bg);

  const root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  root.setAttribute('transform', `translate(${-bounds.x + EXPORT_PADDING}, ${-bounds.y + EXPORT_PADDING})`);
  svg.appendChild(root);

  const rs = rough.svg(svg);
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) root.appendChild(renderElementSVG(rs, el, theme));

  const text = new XMLSerializer().serializeToString(svg);
  downloadFile(`canvas-${timestamp()}.svg`, new Blob([text], { type: 'image/svg+xml' }));
}

export function exportAsJSON(elements: CanvasElement[]): void {
  const payload = JSON.stringify({ version: 1, elements }, null, 2);
  downloadFile(`canvas-${timestamp()}.json`, new Blob([payload], { type: 'application/json' }));
}

export function exportProject(
  elements: CanvasElement[],
  canvasState: { offsetX: number; offsetY: number; zoom: number; theme: Theme; showGrid: boolean }
): void {
  const payload = JSON.stringify({ version: 2, elements, canvasState }, null, 2);
  downloadFile(`canvas-project-${timestamp()}.mcv`, new Blob([payload], { type: 'application/json' }));
}
