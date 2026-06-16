/** Bottom-left auto-hiding minimap with click/drag re-centering. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { getElementBounds, getElementsBounds, getLineEndpoints } from '../../utils/geometry';

const W = 196;
const H = 120;
const PAD = 10;
const HIDE_DELAY = 1800;

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const scaleRef = useRef({ scale: 1, ox: 0, oy: 0 });
  const shownRef = useRef(false);

  const reveal = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY);
  }, []);

  const draw = useCallback(() => {
    rafRef.current = null;
    // Hidden minimap: skip the full re-sort + per-element redraw. Store changes
    // fire on every pointermove during a drag, but the minimap only reveals on
    // pan/zoom — and every reveal path schedules a fresh draw.
    if (!shownRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { elements } = useElementStore.getState();
    const { offsetX, offsetY, zoom, theme } = useCanvasStore.getState();
    const dark = theme === 'dark';
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== W * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Viewport world rect.
    const vw = window.innerWidth / zoom;
    const vh = window.innerHeight / zoom;
    const view = { x: -offsetX, y: -offsetY, width: vw, height: vh };

    const content = getElementsBounds(elements);
    const union = content
      ? {
          x: Math.min(content.x, view.x),
          y: Math.min(content.y, view.y),
          width: Math.max(content.x + content.width, view.x + view.width) - Math.min(content.x, view.x),
          height: Math.max(content.y + content.height, view.y + view.height) - Math.min(content.y, view.y),
        }
      : view;

    const scale = Math.min((W - PAD * 2) / Math.max(1, union.width), (H - PAD * 2) / Math.max(1, union.height));
    const ox = PAD + ((W - PAD * 2) - union.width * scale) / 2 - union.x * scale;
    const oy = PAD + ((H - PAD * 2) - union.height * scale) / 2 - union.y * scale;
    scaleRef.current = { scale, ox, oy };
    const tx = (x: number) => x * scale + ox;
    const ty = (y: number) => y * scale + oy;

    // Faint dot grid.
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    for (let gx = 14; gx < W; gx += 14) {
      for (let gy = 14; gy < H; gy += 14) {
        ctx.fillRect(gx, gy, 1, 1);
      }
    }

    // Viewport backdrop.
    ctx.fillStyle = dark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.08)';
    ctx.beginPath();
    ctx.roundRect(tx(view.x), ty(view.y), view.width * scale, view.height * scale, 3);
    ctx.fill();

    // Elements.
    for (const el of [...elements].sort((a, b) => a.zIndex - b.zIndex)) {
      const b = getElementBounds(el);
      const x = tx(b.x);
      const y = ty(b.y);
      const w = Math.max(1.5, b.width * scale);
      const h = Math.max(1.5, b.height * scale);
      const stroke = el.strokeColor === 'transparent' ? (dark ? '#777' : '#999') : el.strokeColor;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.globalAlpha = Math.max(0.35, el.opacity * 0.9);

      switch (el.type) {
        case 'ellipse':
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          if (el.fillColor !== 'transparent') {
            ctx.fillStyle = el.fillColor;
            ctx.globalAlpha = 0.25;
            ctx.fill();
            ctx.globalAlpha = Math.max(0.35, el.opacity * 0.9);
          }
          ctx.stroke();
          break;
        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w, y + h / 2);
          ctx.lineTo(x + w / 2, y + h);
          ctx.lineTo(x, y + h / 2);
          ctx.closePath();
          ctx.stroke();
          break;
        case 'line':
        case 'arrow': {
          const [s, e] = getLineEndpoints(el);
          ctx.beginPath();
          ctx.moveTo(tx(s.x), ty(s.y));
          ctx.lineTo(tx(e.x), ty(e.y));
          ctx.stroke();
          break;
        }
        case 'freehand': {
          const pts = el.points ?? [];
          if (pts.length > 1) {
            ctx.beginPath();
            ctx.moveTo(tx(el.x + pts[0].x), ty(el.y + pts[0].y));
            for (let i = 1; i < pts.length; i += 2) {
              ctx.lineTo(tx(el.x + pts[i].x), ty(el.y + pts[i].y));
            }
            ctx.stroke();
          }
          break;
        }
        default: {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 1.5);
          if (el.fillColor !== 'transparent') {
            ctx.fillStyle = el.fillColor;
            ctx.globalAlpha = 0.25;
            ctx.fill();
            ctx.globalAlpha = Math.max(0.35, el.opacity * 0.9);
          }
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // Viewport outline on top.
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(tx(view.x), ty(view.y), view.width * scale, view.height * scale, 3);
    ctx.stroke();
  }, []);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    scheduleDraw();
    const unsubEl = useElementStore.subscribe(scheduleDraw);
    const unsubCv = useCanvasStore.subscribe((s, prev) => {
      scheduleDraw();
      if (s.offsetX !== prev.offsetX || s.offsetY !== prev.offsetY || s.zoom !== prev.zoom) reveal();
    });
    return () => {
      unsubEl();
      unsubCv();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [scheduleDraw, reveal]);

  const recenter = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { scale, ox, oy } = scaleRef.current;
    const wx = (clientX - rect.left - ox) / scale;
    const wy = (clientY - rect.top - oy) / scale;
    const { zoom } = useCanvasStore.getState();
    useCanvasStore.getState().setOffset(window.innerWidth / (2 * zoom) - wx, window.innerHeight / (2 * zoom) - wy);
  };

  const shown = (visible || hovered) && !collapsed;

  // Draw once whenever the minimap transitions into view (hover reveal,
  // expand-from-collapsed), since draws are otherwise skipped while hidden.
  useEffect(() => {
    shownRef.current = shown;
    if (shown) scheduleDraw();
  }, [shown, scheduleDraw]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="panel ui-btn fixed bottom-4 left-4 z-40 h-8 w-8 opacity-60 hover:opacity-100"
        aria-label="Show minimap"
        title="Show minimap"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <rect x="13" y="9" width="5" height="4" rx="1" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-40 transition-opacity duration-300"
      style={{ opacity: shown ? 1 : 0, pointerEvents: shown ? 'auto' : 'none' }}
      onMouseEnter={() => {
        setHovered(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
      }}
      onMouseLeave={() => {
        setHovered(false);
        reveal();
      }}
    >
      <div className="panel group relative overflow-hidden p-1">
        <canvas
          ref={canvasRef}
          style={{ width: W, height: H, cursor: 'pointer', display: 'block', borderRadius: 10 }}
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            recenter(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) recenter(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          aria-label="Minimap"
        />
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="ui-btn absolute top-1.5 right-1.5 h-6 w-6 bg-white/80 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:bg-gray-800/80"
          aria-label="Hide minimap"
          title="Hide minimap"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
