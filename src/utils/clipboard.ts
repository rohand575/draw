/** Clipboard integration: copy selection, paste images / canvas JSON / text-or-code. */
import { nanoid } from 'nanoid';
import type { CanvasElement } from '../types';
import { CODE_FONT, HAND_FONT, IMAGE_PASTE_MAX_DIM } from '../constants';
import { useElementStore } from '../store/elementStore';
import { useToolStore } from '../store/toolStore';
import { useHistoryStore } from '../store/historyStore';
import { cloneElementsForPaste, sanitizeElements } from './sanitizeElements';
import { detectCode } from './codeDetection';
import { maxLineWidth } from './textWrap';

const CLIPBOARD_TYPE = 'canvas-clipboard';

export function copySelectionToClipboard(): void {
  const { elements } = useElementStore.getState();
  const { selectedIds } = useToolStore.getState();
  if (selectedIds.length === 0) return;
  const idSet = new Set(selectedIds);
  const selection = elements.filter((el) => idSet.has(el.id));
  const payload = JSON.stringify({ type: CLIPBOARD_TYPE, elements: selection });
  navigator.clipboard?.writeText(payload).catch(() => undefined);
}

function pushSnapshot() {
  useHistoryStore.getState().pushState(useElementStore.getState().elements);
}

function selectNew(els: CanvasElement[]) {
  useToolStore.getState().setSelectedIds(els.map((e) => e.id));
  useToolStore.getState().setActiveTool('select');
}

/** Decode + downscale a pasted image blob, then place it at the viewport center. */
export async function pasteImageBlob(blob: Blob, centerX: number, centerY: number): Promise<boolean> {
  const dataUrl = await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
  if (!dataUrl) return false;

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
  if (!img) return false;

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  let finalData = dataUrl;

  if (Math.max(w, h) > IMAGE_PASTE_MAX_DIM) {
    const scale = IMAGE_PASTE_MAX_DIM / Math.max(w, h);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, cw, ch);
      finalData = canvas.toDataURL('image/png');
      w = cw;
      h = ch;
    }
  }

  pushSnapshot();
  const now = Date.now();
  const z = useElementStore.getState().getMaxZIndex() + 1;
  const el: CanvasElement = {
    id: nanoid(),
    type: 'image',
    x: centerX - w / 2,
    y: centerY - h / 2,
    width: w,
    height: h,
    imageData: finalData,
    strokeColor: 'transparent',
    fillColor: 'transparent',
    strokeWidth: 1,
    roughness: 0,
    opacity: 1,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    edgeRoundness: 0,
    rotation: 0,
    zIndex: z,
    createdAt: now,
    updatedAt: now,
  };
  useElementStore.getState().addElement(el);
  selectNew([el]);
  return true;
}

/** Plain text → code block (when detected) or hand-written text element. */
export function pasteTextOrCode(text: string, centerX: number, centerY: number): void {
  const trimmed = text.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  if (!trimmed) return;

  const detected = detectCode(trimmed);
  const now = Date.now();
  const z = useElementStore.getState().getMaxZIndex() + 1;
  const style = useToolStore.getState().getStyle();

  let el: CanvasElement;
  if (detected) {
    const fontSize = 14;
    const lines = trimmed.split('\n');
    const width = Math.max(160, maxLineWidth(trimmed, `${fontSize}px ${CODE_FONT}`) + 32 + 24);
    const height = lines.length * fontSize * 1.5 + 32;
    el = {
      id: nanoid(),
      type: 'text',
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      text: trimmed,
      fontSize,
      isCode: true,
      codeLanguage: detected.language,
      strokeColor: '#cdd6f4',
      fillColor: 'transparent',
      strokeWidth: 1,
      roughness: 0,
      opacity: 1,
      strokeStyle: 'solid',
      fillStyle: 'solid',
      edgeRoundness: 0,
      rotation: 0,
      zIndex: z,
      createdAt: now,
      updatedAt: now,
    };
  } else {
    const fontSize = 20;
    const lines = trimmed.split('\n');
    const width = Math.max(20, maxLineWidth(trimmed, `${fontSize}px ${HAND_FONT}`));
    const height = lines.length * fontSize * 1.3;
    el = {
      id: nanoid(),
      type: 'text',
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      text: trimmed,
      fontSize,
      strokeColor: style.strokeColor,
      fillColor: 'transparent',
      strokeWidth: style.strokeWidth,
      roughness: style.roughness,
      opacity: style.opacity,
      strokeStyle: 'solid',
      fillStyle: 'solid',
      edgeRoundness: 0,
      rotation: 0,
      zIndex: z,
      createdAt: now,
      updatedAt: now,
    };
  }

  pushSnapshot();
  useElementStore.getState().addElement(el);
  selectNew([el]);
}

function pasteCanvasJSON(parsed: { elements: unknown }): boolean {
  const { elements } = useElementStore.getState();
  const existingIds = new Set(elements.map((e) => e.id));
  const sanitized = sanitizeElements(parsed.elements, existingIds);
  if (sanitized.length === 0) return false;
  const startZ = useElementStore.getState().getMaxZIndex() + 1;
  const clones = cloneElementsForPaste(sanitized, 20, 20, startZ);
  pushSnapshot();
  useElementStore.getState().addElements(clones);
  selectNew(clones);
  return true;
}

/**
 * Paste pipeline: image item → canvas-clipboard JSON → plain text/code.
 * (centerX, centerY) is the viewport center in world coordinates.
 */
export async function pasteFromClipboard(centerX: number, centerY: number): Promise<void> {
  // 1) Rich clipboard read (images).
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        if (await pasteImageBlob(blob, centerX, centerY)) return;
      }
    }
  } catch {
    // Permission denied / unsupported — fall through to text.
  }

  // 2) Text path.
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch {
    return;
  }
  if (!text) return;

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.type === CLIPBOARD_TYPE && Array.isArray(parsed.elements)) {
      if (pasteCanvasJSON(parsed)) return;
      return;
    }
  } catch {
    /* not canvas JSON */
  }

  pasteTextOrCode(text, centerX, centerY);
}
