/** OpenAI GPT-4o prompts + SVG extraction for AI Draw / AI Diagram. */
import type { CanvasElement } from '../types';
import { parseSVGToElements } from './svgToElements';

export type AIMode = 'draw' | 'diagram';

const DRAW_SYSTEM_PROMPT = `You are an expert SVG illustrator. The user describes something to draw; you return ONLY an SVG — no markdown, no explanation, no code fences.

Rules:
- Output exactly one <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"> ... </svg>.
- Use ONLY these primitives: rect, circle, ellipse, path, line, polyline, polygon, text, g.
- NO defs, use, gradients, filters, masks, transforms, or CSS classes. Inline fill/stroke attributes only.
- Compose 20–60 elements. Build recognizable forms from layered simple shapes.
- Use a cohesive, harmonious color palette (4–7 colors). Prefer filled shapes with subtle darker strokes.
- Add short text labels where they help comprehension.
- Keep all coordinates inside the viewBox with comfortable margins.`;

const DIAGRAM_SYSTEM_PROMPT = `You are an expert flowchart and infographic designer. The user gives content (a process, system, concept, or pasted notes); you return ONLY an SVG diagram — no markdown, no explanation, no code fences.

Rules:
- Output exactly one <svg viewBox="0 0 900 1400" xmlns="http://www.w3.org/2000/svg"> ... </svg>. Use less vertical space if the content is small.
- Use ONLY these primitives: rect, circle, ellipse, path, line, polyline, polygon, text, g.
- NO defs, markers, gradients, filters, transforms, or CSS classes. Inline attributes only.
- Shape conventions:
  - Process step: rounded rect (rx="10") with centered label.
  - Decision: diamond (polygon) with the question inside and labeled branch arrows.
  - Start/End: pill (rect with rx = half height).
  - Section headers: bold larger text with a thin underline rect.
  - Annotations: small italic gray text beside shapes.
- Draw arrows manually: a line/polyline for the shaft plus a small filled polygon triangle head (no marker elements).
- Layout top-to-bottom with generous spacing (≥60px between rows); align columns; never overlap text.
- Color palette: #6366f1 primary, #f1f5f9 light fill, #1e293b dark text, #e03131 warnings, #2f9e44 success, #f08c00 highlights. White or very light shape fills with colored strokes.
- Compose 40–100 elements. Every shape label must be legible (font-size ≥ 13).`;

export class AIDrawError extends Error {}

async function callOpenAI(prompt: string, apiKey: string, mode: AIMode): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: mode === 'draw' ? 8000 : 14000,
      messages: [
        { role: 'system', content: mode === 'draw' ? DRAW_SYSTEM_PROMPT : DIAGRAM_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message ?? '';
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new AIDrawError('Invalid API key. Check your OpenAI key and try again.');
    if (res.status === 429) throw new AIDrawError('Rate limited by OpenAI. Wait a moment and retry.');
    throw new AIDrawError(detail || `OpenAI request failed (${res.status}).`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new AIDrawError('No response from the model. Try again.');
  return content;
}

/**
 * Generate elements from a natural-language prompt.
 * Returned elements are centered at (centerX, centerY) with z-indexes from startZIndex.
 */
export async function generateDrawing(
  prompt: string,
  apiKey: string,
  centerX: number,
  centerY: number,
  startZIndex: number,
  mode: AIMode
): Promise<CanvasElement[]> {
  const content = await callOpenAI(prompt, apiKey, mode);
  const match = content.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) throw new AIDrawError('The model did not return an SVG. Try rephrasing your prompt.');

  const elements = parseSVGToElements(match[0], centerX, centerY, startZIndex);
  if (elements.length === 0) {
    throw new AIDrawError('Could not convert the generated SVG into shapes. Try a simpler prompt.');
  }
  return elements;
}
