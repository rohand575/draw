/** Word + character-level wrapping for text rendered on the canvas. */

let measureCtx: CanvasRenderingContext2D | null = null;

export function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement('canvas');
    measureCtx = c.getContext('2d')!;
  }
  return measureCtx;
}

export function measureTextWidth(text: string, font: string): number {
  const ctx = getMeasureCtx();
  ctx.font = font;
  return ctx.measureText(text).width;
}

/** Split a too-long word at character boundaries to fit maxWidth. */
function breakWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  const out: string[] = [];
  let current = '';
  for (const ch of word) {
    if (current && ctx.measureText(current + ch).width > maxWidth) {
      out.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Wrap `text` into lines that fit `maxWidth` using `font`.
 * Hard newlines are preserved; long words fall back to char-level breaking.
 */
export function wrapTextToLines(text: string, maxWidth: number, font: string): string[] {
  const ctx = getMeasureCtx();
  ctx.font = font;
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width > maxWidth) {
        const parts = breakWord(ctx, word, maxWidth);
        for (let i = 0; i < parts.length - 1; i++) lines.push(parts[i]);
        line = parts[parts.length - 1] ?? '';
      } else {
        line = word;
      }
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [''];
}

/** Widest line of unwrapped text. */
export function maxLineWidth(text: string, font: string): number {
  const ctx = getMeasureCtx();
  ctx.font = font;
  let max = 0;
  for (const line of text.split('\n')) {
    const w = ctx.measureText(line).width;
    if (w > max) max = w;
  }
  return max;
}
