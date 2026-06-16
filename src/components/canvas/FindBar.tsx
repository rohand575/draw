/** Ctrl+F find bar — canvas mode (all elements) and text mode (inline editor). */
import { useEffect, useRef } from 'react';
import type { FindMatch } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useFindStore } from '../../store/findStore';
import { useToolStore } from '../../store/toolStore';
import { getElementBounds } from '../../utils/geometry';

/** Registry so the find bar can reach the active inline text editor. */
export const textEditorRegistry: { textarea: HTMLTextAreaElement | null } = { textarea: null };

function collectCanvasMatches(query: string): FindMatch[] {
  const q = query.toLowerCase();
  if (!q) return [];
  const out: FindMatch[] = [];
  for (const el of useElementStore.getState().elements) {
    if (!el.text) continue;
    const hay = el.text.toLowerCase();
    let idx = hay.indexOf(q);
    while (idx !== -1) {
      out.push({ elementId: el.id, start: idx, end: idx + q.length });
      idx = hay.indexOf(q, idx + Math.max(1, q.length));
    }
  }
  return out;
}

function collectTextMatches(query: string): { start: number; end: number }[] {
  const ta = textEditorRegistry.textarea ?? document.querySelector<HTMLTextAreaElement>('[data-canvas-text-editor]');
  const q = query.toLowerCase();
  if (!ta || !q) return [];
  const hay = ta.value.toLowerCase();
  const out: { start: number; end: number }[] = [];
  let idx = hay.indexOf(q);
  while (idx !== -1) {
    out.push({ start: idx, end: idx + q.length });
    idx = hay.indexOf(q, idx + Math.max(1, q.length));
  }
  return out;
}

export function FindBar() {
  const find = useFindStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Recompute matches when the query (or mode) changes.
  useEffect(() => {
    if (!find.isOpen) return;
    if (find.mode === 'canvas') {
      find.setMatches(collectCanvasMatches(find.query));
    } else {
      find.setTextMatches(collectTextMatches(find.query));
    }
    find.setActiveIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find.query, find.mode, find.isOpen]);

  // React to the active match: select + pan (canvas) or select range (text).
  useEffect(() => {
    if (!find.isOpen) return;
    if (find.mode === 'canvas') {
      const match = find.matches[find.activeIndex];
      if (!match) return;
      const el = useElementStore.getState().elements.find((x) => x.id === match.elementId);
      if (!el) return;
      useToolStore.getState().setSelectedIds([el.id]);
      const b = getElementBounds(el);
      const { zoom } = useCanvasStore.getState();
      useCanvasStore
        .getState()
        .setOffset(window.innerWidth / (2 * zoom) - (b.x + b.width / 2), window.innerHeight / (2 * zoom) - (b.y + b.height / 2));
    } else {
      const match = find.textMatches[find.activeIndex];
      const ta = textEditorRegistry.textarea;
      if (match && ta) {
        ta.setSelectionRange(match.start, match.end);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find.activeIndex, find.matches, find.textMatches, find.isOpen]);

  useEffect(() => {
    if (find.isOpen) inputRef.current?.focus();
  }, [find.isOpen]);

  if (!find.isOpen) return null;

  const total = find.mode === 'canvas' ? find.matches.length : find.textMatches.length;
  const counter = find.query ? (total > 0 ? `${find.activeIndex + 1} of ${total}` : 'No results') : '';

  return (
    <div className="panel animate-in fixed top-4 right-4 z-50 flex items-center gap-1 px-2 py-1.5">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1 shrink-0 opacity-50">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        value={find.query}
        onChange={(e) => find.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) find.prev();
            else find.next();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            find.close();
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            e.currentTarget.select();
          }
          e.stopPropagation();
        }}
        placeholder={find.mode === 'canvas' ? 'Find on canvas…' : 'Find in text…'}
        className="w-44 bg-transparent px-1.5 py-1 text-[13px] outline-none placeholder:text-black/35 dark:placeholder:text-white/35"
        aria-label="Find"
      />
      <span className={`min-w-14 px-1 text-right text-[11px] tabular-nums ${total === 0 && find.query ? 'text-red-500' : 'opacity-50'}`}>
        {counter}
      </span>
      <button
        type="button"
        className="ui-btn h-7 w-7"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => find.prev()}
        aria-label="Previous match"
        title="Previous (Shift+Enter)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg>
      </button>
      <button
        type="button"
        className="ui-btn h-7 w-7"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => find.next()}
        aria-label="Next match"
        title="Next (Enter)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <button
        type="button"
        className="ui-btn h-7 w-7"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => find.close()}
        aria-label="Close find bar"
        title="Close (Esc)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
