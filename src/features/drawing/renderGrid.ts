/** Dot-grid background. */
import { GRID_SIZE } from '../../constants';
import type { Theme } from '../../types';

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
  theme: Theme
) {
  const scaledGrid = GRID_SIZE * zoom;
  if (scaledGrid < 2) return;

  const worldLeft = -offsetX;
  const worldTop = -offsetY;
  const worldRight = worldLeft + width / zoom;
  const worldBottom = worldTop + height / zoom;

  const startX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;

  const radius = Math.max(1, zoom * 1.5) / zoom / 2;
  ctx.save();
  ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  for (let x = startX; x <= worldRight; x += GRID_SIZE) {
    for (let y = startY; y <= worldBottom; y += GRID_SIZE) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}
