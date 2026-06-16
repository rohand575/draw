/** Contextual style bar — colors, stroke, fill, roughness, opacity, edges, font. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CanvasElement, FillStyle, StrokeStyle } from '../../types';
import {
  COLOR_PALETTE,
  EDGE_ROUNDNESS_OPTIONS,
  FONT_SIZES,
  ROUGHNESS_LABELS,
  ROUGHNESS_LEVELS,
  UI_STROKE_WIDTHS,
} from '../../constants';
import { useToolStore } from '../../store/toolStore';
import { useElementStore } from '../../store/elementStore';
import { applyStyleToSelection } from '../../utils/actions';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { AlignBar } from './AlignBar';

function Popover({ open, onClose, children, anchorClass }: { open: boolean; onClose: () => void; children: ReactNode; anchorClass?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className={`panel animate-in absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 p-2 ${anchorClass ?? ''}`}>
      {children}
    </div>
  );
}

function Swatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  const isTransparent = color === 'transparent';
  return (
    <button
      type="button"
      aria-label={isTransparent ? 'Transparent' : color}
      onClick={onClick}
      className={`h-6.5 w-6.5 rounded-md transition-transform hover:scale-110 active:scale-95 ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-900' : 'ring-1 ring-black/10 dark:ring-white/15'
      }`}
      style={
        isTransparent
          ? {
              backgroundImage:
                'linear-gradient(45deg,#d4d4d8 25%,transparent 25%,transparent 75%,#d4d4d8 75%),linear-gradient(45deg,#d4d4d8 25%,#fff 25%,#fff 75%,#d4d4d8 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0,4px 4px',
            }
          : { background: color }
      }
    />
  );
}

function Seg<T extends string | number>({
  options,
  value,
  onChange,
  render,
  label,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-black/[0.045] p-0.5 dark:bg-white/[0.06]" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
          className={`flex h-7 min-w-7 items-center justify-center rounded-[7px] px-1 text-[12px] transition-all ${
            value === opt
              ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-300'
              : 'opacity-55 hover:opacity-90'
          }`}
        >
          {render(opt)}
        </button>
      ))}
    </div>
  );
}

const SHAPE_TYPES = new Set(['rectangle', 'diamond', 'ellipse']);
const STROKE_TYPES = new Set(['rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'freehand']);

export function StylePanel() {
  const tool = useToolStore();
  const selectedIds = useToolStore((s) => s.selectedIds);
  const elements = useElementStore((s) => s.elements);
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  const selected: CanvasElement[] = elements.filter((el) => selectedIds.includes(el.id));
  const selTypes = new Set(selected.map((el) => el.type));

  const drawingTool = tool.activeTool !== 'select' && tool.activeTool !== 'hand';
  const visible = drawingTool || selected.length > 0;
  if (!visible) return null;

  const relevant = (kinds: Set<string>, toolMatch: (t: string) => boolean) =>
    (drawingTool && toolMatch(tool.activeTool)) || selected.some((el) => kinds.has(el.type));

  const showFill = relevant(SHAPE_TYPES, (t) => SHAPE_TYPES.has(t));
  const showStroke = relevant(STROKE_TYPES, (t) => STROKE_TYPES.has(t) || t === 'frame');
  const showEdges = relevant(new Set(['rectangle']), (t) => t === 'rectangle');
  const showFont = tool.activeTool === 'text' || selTypes.has('text');
  const showRough = showStroke;

  const set = <K extends keyof CanvasElement>(field: K, value: CanvasElement[K], toolSetter: () => void) => {
    toolSetter();
    applyStyleToSelection({ [field]: value } as Partial<CanvasElement>);
  };

  const strokeDot = (w: number) => (
    <span className="flex h-4 w-5 items-center justify-center">
      <span className="w-4 rounded-full bg-current" style={{ height: Math.max(1.5, w) }} />
    </span>
  );

  const strokeStyleIcon = (s: StrokeStyle) => (
    <svg width="20" height="10" viewBox="0 0 20 10">
      <line
        x1="2"
        y1="5"
        x2="18"
        y2="5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={s === 'dashed' ? '4 3' : s === 'dotted' ? '0.5 3.5' : undefined}
      />
    </svg>
  );

  const fillStyleIcon = (s: FillStyle) => (
    <svg width="16" height="14" viewBox="0 0 16 14">
      <rect x="1.5" y="1.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none" />
      {s === 'solid' && <rect x="3" y="3" width="10" height="8" rx="1" fill="currentColor" opacity="0.7" />}
      {s !== 'solid' && (
        <g stroke="currentColor" strokeWidth="1">
          <path d="M3 10.5 L 10.5 3M5.5 11.5 L 13 4" />
          {s === 'cross-hatch' && <path d="M13 10.5 L 5.5 3M10.5 11.5 L 3 4" />}
        </g>
      )}
    </svg>
  );

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2">
      <div className="panel flex flex-wrap items-center gap-2.5 px-3 py-2">
        {/* Stroke color */}
        <div className="relative">
          <Tooltip label="Stroke" shortcut="1–8">
            <button
              type="button"
              aria-label="Stroke color"
              onClick={() => setOpenPopover(openPopover === 'stroke' ? null : 'stroke')}
              className="flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-black/10 transition-transform hover:scale-105 dark:ring-white/15"
            >
              <span className="h-4.5 w-4.5 rounded-[5px]" style={{ background: tool.strokeColor }} />
            </button>
          </Tooltip>
          <Popover open={openPopover === 'stroke'} onClose={() => setOpenPopover(null)}>
            <div className="grid grid-cols-4 gap-1.5">
              {COLOR_PALETTE.filter((c) => c !== 'transparent').map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  selected={tool.strokeColor === c}
                  onClick={() => set('strokeColor', c, () => tool.setStrokeColor(c))}
                />
              ))}
            </div>
          </Popover>
        </div>

        {/* Fill color */}
        {showFill && (
          <div className="relative">
            <Tooltip label="Fill" shortcut="Alt+1–8">
              <button
                type="button"
                aria-label="Fill color"
                onClick={() => setOpenPopover(openPopover === 'fill' ? null : 'fill')}
                className="flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-black/10 transition-transform hover:scale-105 dark:ring-white/15"
              >
                <span
                  className="h-4.5 w-4.5 rounded-[5px] ring-1 ring-black/10 dark:ring-white/10"
                  style={
                    tool.fillColor === 'transparent'
                      ? {
                          backgroundImage:
                            'linear-gradient(45deg,#d4d4d8 25%,transparent 25%,transparent 75%,#d4d4d8 75%),linear-gradient(45deg,#d4d4d8 25%,#fff 25%,#fff 75%,#d4d4d8 75%)',
                          backgroundSize: '7px 7px',
                          backgroundPosition: '0 0,3.5px 3.5px',
                        }
                      : { background: tool.fillColor }
                  }
                />
              </button>
            </Tooltip>
            <Popover open={openPopover === 'fill'} onClose={() => setOpenPopover(null)}>
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_PALETTE.map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    selected={tool.fillColor === c}
                    onClick={() => set('fillColor', c, () => tool.setFillColor(c))}
                  />
                ))}
              </div>
            </Popover>
          </div>
        )}

        {showStroke && (
          <>
            <div className="toolbar-divider" />
            <Seg
              label="Stroke width"
              options={UI_STROKE_WIDTHS}
              value={UI_STROKE_WIDTHS.includes(tool.strokeWidth) ? tool.strokeWidth : UI_STROKE_WIDTHS[1]}
              onChange={(w) => set('strokeWidth', w, () => tool.setStrokeWidth(w))}
              render={strokeDot}
            />
            <Seg
              label="Stroke style"
              options={['solid', 'dashed', 'dotted'] as StrokeStyle[]}
              value={tool.strokeStyle}
              onChange={(s) => set('strokeStyle', s, () => tool.setStrokeStyle(s))}
              render={strokeStyleIcon}
            />
          </>
        )}

        {showFill && (
          <Seg
            label="Fill style"
            options={['solid', 'hachure', 'cross-hatch'] as FillStyle[]}
            value={tool.fillStyle}
            onChange={(s) => set('fillStyle', s, () => tool.setFillStyle(s))}
            render={fillStyleIcon}
          />
        )}

        {showEdges && (
          <Seg
            label="Corner radius"
            options={EDGE_ROUNDNESS_OPTIONS}
            value={EDGE_ROUNDNESS_OPTIONS.includes(tool.edgeRoundness) ? tool.edgeRoundness : 0}
            onChange={(r) => set('edgeRoundness', r, () => tool.setEdgeRoundness(r))}
            render={(r) => (
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path
                  d={`M2 12 V${r === 0 ? 2 : r === 8 ? 6 : 8} Q2 2 ${r === 0 ? 2 : r === 8 ? 6 : 8} 2 H12`}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            )}
          />
        )}

        {showRough && (
          <div className="relative">
            <Tooltip label="Sloppiness">
              <button
                type="button"
                aria-label="Roughness"
                onClick={() => setOpenPopover(openPopover === 'rough' ? null : 'rough')}
                className="ui-btn h-7 px-2 text-[12px] font-medium"
              >
                <svg width="20" height="12" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  {tool.roughness === 0 ? <path d="M2 6 H18" /> : tool.roughness === 1 ? <path d="M2 6.5 C 7 5, 13 7, 18 5.5" /> : <path d="M2 7 C 5 3.5, 9 9, 12 4.5 S 17 8, 18 5" />}
                </svg>
              </button>
            </Tooltip>
            <Popover open={openPopover === 'rough'} onClose={() => setOpenPopover(null)}>
              <div className="flex flex-col gap-0.5">
                {ROUGHNESS_LEVELS.map((r, i) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      set('roughness', r, () => tool.setRoughness(r));
                      setOpenPopover(null);
                    }}
                    className={`rounded-md px-3 py-1.5 text-left text-[12.5px] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07] ${
                      tool.roughness === r ? 'font-semibold text-indigo-500' : ''
                    }`}
                  >
                    {ROUGHNESS_LABELS[i]}
                  </button>
                ))}
              </div>
            </Popover>
          </div>
        )}

        {/* Opacity */}
        <div className="relative">
          <Tooltip label="Opacity">
            <button
              type="button"
              aria-label="Opacity"
              onClick={() => setOpenPopover(openPopover === 'opacity' ? null : 'opacity')}
              className="ui-btn h-7 px-2 text-[11.5px] font-semibold tabular-nums opacity-80"
            >
              {Math.round(tool.opacity * 100)}%
            </button>
          </Tooltip>
          <Popover open={openPopover === 'opacity'} onClose={() => setOpenPopover(null)} anchorClass="w-44 px-3 py-2.5">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={tool.opacity}
              aria-label="Opacity"
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                set('opacity', v, () => tool.setOpacity(v));
              }}
              className="w-full accent-indigo-500"
            />
          </Popover>
        </div>

        {/* Font size */}
        {showFont && (
          <div className="relative">
            <Tooltip label="Font size" shortcut="Ctrl+Shift+< >">
              <button
                type="button"
                aria-label="Font size"
                onClick={() => setOpenPopover(openPopover === 'font' ? null : 'font')}
                className="ui-btn h-7 gap-1 px-2 text-[12px] font-semibold tabular-nums"
              >
                <Icon name="text" size={12} />
                {tool.fontSize}
              </button>
            </Tooltip>
            <Popover open={openPopover === 'font'} onClose={() => setOpenPopover(null)} anchorClass="max-h-64 overflow-y-auto">
              <div className="flex flex-col gap-0.5">
                {FONT_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      set('fontSize', s, () => tool.setFontSize(s));
                      setOpenPopover(null);
                    }}
                    className={`rounded-md px-4 py-1 text-left text-[12.5px] tabular-nums transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07] ${
                      tool.fontSize === s ? 'font-semibold text-indigo-500' : ''
                    }`}
                  >
                    {s}px
                  </button>
                ))}
              </div>
            </Popover>
          </div>
        )}

        <div className="toolbar-divider" />

        {/* Keep-tool lock */}
        <Tooltip label={tool.lockToolMode ? 'Keep tool active after drawing' : 'Return to select after drawing'}>
          <button
            type="button"
            aria-pressed={tool.lockToolMode}
            aria-label="Lock tool"
            onClick={tool.toggleLockToolMode}
            className={`ui-btn h-7 w-7 ${tool.lockToolMode ? 'text-indigo-500' : 'opacity-45'}`}
          >
            <Icon name={tool.lockToolMode ? 'lock' : 'unlock'} size={14} />
          </button>
        </Tooltip>

        {selected.length >= 2 && (
          <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-500">
            {selected.length} selected
          </span>
        )}
      </div>

      <AlignBar />
    </div>
  );
}
