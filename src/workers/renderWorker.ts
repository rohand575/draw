/**
 * Off-thread rough.js Drawable pre-generation.
 * Receives slim element payloads (no imageData), returns serializable
 * drawables keyed by element id + visual hash. The main thread merges
 * entries whose hash changed; cache misses still generate synchronously
 * on the main thread, so this worker is purely a pre-warmer.
 */
import rough from 'roughjs/bin/rough';
import type { CanvasElement } from '../types';
import { elementVisualHash, generateDrawables } from '../features/drawing/renderElement';

interface GenerateMessage {
  type: 'generate';
  elements: CanvasElement[];
}

interface ResultEntry {
  id: string;
  hash: string;
  drawables: unknown[];
}

const generator = rough.generator();

self.onmessage = (e: MessageEvent<GenerateMessage>) => {
  const msg = e.data;
  if (!msg || msg.type !== 'generate') return;
  const results: ResultEntry[] = [];
  for (const el of msg.elements) {
    try {
      const drawables = generateDrawables(generator, el);
      // Strip non-cloneable internals (e.g. randomizer instances).
      results.push({
        id: el.id,
        hash: elementVisualHash(el),
        drawables: JSON.parse(JSON.stringify(drawables)),
      });
    } catch {
      // Skip elements the generator can't handle.
    }
  }
  (self as unknown as Worker).postMessage({ type: 'drawables', results });
};
