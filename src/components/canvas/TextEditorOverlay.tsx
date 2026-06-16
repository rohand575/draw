/**
 * Inline text editor — a DOM textarea positioned over the canvas at the
 * element's world position. Handles live resize, wrap containers, markdown
 * bullet helpers, code syntax-highlight overlay, and find-in-text highlights.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { CanvasElement } from '../../types';
import { CODE_BG, CODE_FONT, HAND_FONT } from '../../constants';
import { useElementStore } from '../../store/elementStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useFindStore } from '../../store/findStore';
import { buildCodeHighlightHtml, CODE_THEME_DARK } from '../../utils/codeDetection';
import { getMeasureCtx, wrapTextToLines } from '../../utils/textWrap';
import { CODE_PADDING } from '../../features/drawing/renderElement';

interface Props {
  element: CanvasElement;
  wrapContainerId: string | null;
  caretIndex: number | null;
  onCommit: () => void;
}

export function TextEditorOverlay({ element, wrapContainerId, caretIndex, onCommit }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const offsetX = useCanvasStore((s) => s.offsetX);
  const offsetY = useCanvasStore((s) => s.offsetY);
  const zoom = useCanvasStore((s) => s.zoom);
  const theme = useCanvasStore((s) => s.theme);
  const find = useFindStore();

  const fontSize = element.fontSize ?? 20;
  const isCode = !!element.isCode;
  const lineHeight = fontSize * (isCode ? 1.5 : 1.3);
  const fontFamily = isCode ? CODE_FONT : HAND_FONT;
  const font = `${fontSize}px ${fontFamily}`;

  // Focus + caret placement once on mount.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const idx = caretIndex ?? ta.value.length;
    ta.setSelectionRange(idx, idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Live-resize the element (and wrap container) as the user types. */
  const applyText = (text: string) => {
    const store = useElementStore.getState();
    const ctx = getMeasureCtx();
    ctx.font = font;

    if (isCode) {
      const lines = text.split('\n');
      let maxW = 0;
      for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
      store.updateElement(element.id, {
        text,
        width: Math.max(160, maxW + CODE_PADDING * 2 + 24),
        height: lines.length * lineHeight + CODE_PADDING * 2,
      });
      return;
    }

    if (element.textWrap && wrapContainerId) {
      const lines = wrapTextToLines(text, Math.max(8, element.width), font);
      const height = lines.length * lineHeight;
      store.updateElement(element.id, { text, height });
      // Auto-extend the container downward when text grows past its bottom.
      const container = store.elements.find((el) => el.id === wrapContainerId);
      if (container) {
        const needed = element.y + height + 8 - container.y;
        if (needed > container.height) {
          store.updateElement(wrapContainerId, { height: needed });
        }
      }
      return;
    }

    const lines = text.split('\n');
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
    store.updateElement(element.id, {
      text,
      width: Math.max(fontSize / 2, maxW),
      height: lines.length * lineHeight,
    });

    // Pan left if the text would extend past the right edge of the window.
    const rightScreen = (element.x + maxW + offsetX) * zoom;
    if (rightScreen > window.innerWidth - 48) {
      const overflow = (rightScreen - (window.innerWidth - 48)) / zoom;
      useCanvasStore.getState().setOffset(offsetX - overflow, offsetY);
    }
  };

  /** Markdown bullet-list helpers + Escape + Ctrl+F. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      ta.blur();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopPropagation();
      useFindStore.getState().open('text');
      return;
    }
    if (isCode && e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart, selectionEnd, value } = ta;
      ta.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
      ta.setSelectionRange(selectionStart + 2, selectionStart + 2);
      applyText(ta.value);
      return;
    }
    if (isCode) return;

    const { selectionStart, value } = ta;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const lineEnd = value.indexOf('\n', selectionStart);
    const line = value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const bullet = line.match(/^(\s*)- /);

    if (e.key === 'Enter' && !e.shiftKey && bullet) {
      e.preventDefault();
      const content = line.slice(bullet[0].length);
      if (content.trim() === '') {
        // Empty bullet → remove the marker and exit the list.
        const next = value.slice(0, lineStart) + value.slice(selectionStart);
        ta.value = next;
        ta.setSelectionRange(lineStart, lineStart);
      } else {
        const insert = `\n${bullet[1]}- `;
        const next = value.slice(0, selectionStart) + insert + value.slice(selectionStart);
        ta.value = next;
        ta.setSelectionRange(selectionStart + insert.length, selectionStart + insert.length);
      }
      applyText(ta.value);
      return;
    }
    if (e.key === 'Tab' && bullet) {
      e.preventDefault();
      if (e.shiftKey) {
        if (bullet[1].length >= 2) {
          const next = value.slice(0, lineStart) + value.slice(lineStart + 2);
          ta.value = next;
          ta.setSelectionRange(Math.max(lineStart, selectionStart - 2), Math.max(lineStart, selectionStart - 2));
        }
      } else {
        const next = `${value.slice(0, lineStart)}  ${value.slice(lineStart)}`;
        ta.value = next;
        ta.setSelectionRange(selectionStart + 2, selectionStart + 2);
      }
      applyText(ta.value);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault(); // keep focus in the editor
    }
  };

  // Screen-space placement.
  const left = (element.x + offsetX) * zoom;
  const top = (element.y + offsetY) * zoom;
  const width = isCode || element.textWrap ? element.width * zoom : Math.max(40, element.width * zoom + 24);
  const height = element.height * zoom;

  // Text-mode find highlights inside this editor.
  const findHtml = useMemo(() => {
    if (!isCode) return null;
    const matches =
      find.isOpen && find.mode === 'text' && find.query
        ? find.textMatches.map((m, i) => ({ ...m, active: i === find.activeIndex }))
        : undefined;
    return buildCodeHighlightHtml(element.text ?? '', element.codeLanguage ?? 'code', CODE_THEME_DARK, matches);
  }, [isCode, element.text, element.codeLanguage, find.isOpen, find.mode, find.query, find.textMatches, find.activeIndex]);

  // Plain-text find overlay (transparent text, highlight backgrounds only).
  const plainFindNodes = useMemo(() => {
    if (isCode || !find.isOpen || find.mode !== 'text' || !find.query || find.textMatches.length === 0) return null;
    const text = element.text ?? '';
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    find.textMatches.forEach((m, i) => {
      if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
      nodes.push(
        <mark
          key={i}
          style={{
            background: i === find.activeIndex ? 'rgba(250,204,21,0.6)' : 'rgba(252,232,170,0.45)',
            color: 'transparent',
            borderRadius: 2,
          }}
        >
          {text.slice(m.start, m.end)}
        </mark>
      );
      cursor = m.end;
    });
    nodes.push(text.slice(cursor));
    return nodes;
  }, [isCode, element.text, find.isOpen, find.mode, find.query, find.textMatches, find.activeIndex]);

  // Keep highlight overlay scroll-synced with the textarea.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    const hl = highlightRef.current;
    if (ta && hl) {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
    }
  });

  const sharedTextStyle: React.CSSProperties = {
    fontFamily,
    fontSize: fontSize * zoom,
    lineHeight: `${lineHeight * zoom}px`,
    whiteSpace: 'pre',
    wordBreak: 'normal',
    overflowWrap: element.textWrap ? 'break-word' : 'normal',
    letterSpacing: 'normal',
    tabSize: 4,
  };
  if (element.textWrap) sharedTextStyle.whiteSpace = 'pre-wrap';

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: Math.max(width, 24),
        minHeight: Math.max(height, lineHeight * zoom),
        zIndex: 30,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {isCode && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: CODE_BG,
            borderRadius: 10 * zoom,
            boxShadow: '0 0 0 1.5px rgba(99,102,241,0.6)',
          }}
        />
      )}
      {isCode && findHtml !== null && (
        <div
          ref={highlightRef}
          aria-hidden
          style={{
            ...sharedTextStyle,
            position: 'absolute',
            inset: 0,
            padding: CODE_PADDING * zoom,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: findHtml }}
        />
      )}
      {!isCode && plainFindNodes && (
        <div
          aria-hidden
          style={{
            ...sharedTextStyle,
            position: 'absolute',
            inset: 0,
            paddingTop: lineHeight * 0.08 * zoom,
            color: 'transparent',
            pointerEvents: 'none',
          }}
        >
          {plainFindNodes}
        </div>
      )}
      <textarea
        ref={textareaRef}
        data-canvas-text-editor="true"
        defaultValue={element.text ?? ''}
        spellCheck={false}
        onInput={(e) => applyText(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        onBlur={onCommit}
        style={{
          ...sharedTextStyle,
          position: 'relative',
          width: '100%',
          height: Math.max(height, lineHeight * zoom) + (isCode ? CODE_PADDING * 2 * zoom : 0),
          padding: isCode ? CODE_PADDING * zoom : 0,
          paddingTop: isCode ? CODE_PADDING * zoom : lineHeight * 0.08 * zoom,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          color: isCode ? 'transparent' : element.strokeColor,
          caretColor: isCode ? '#ffffff' : theme === 'dark' ? '#ffffff' : '#1e1e1e',
          display: 'block',
        }}
      />
    </div>
  );
}
