import { nanoid } from 'nanoid';
import type { CanvasElement, ElementType, StyleSettings } from '../types';
import {
  DEFAULT_EDGE_ROUNDNESS,
  DEFAULT_FILL_COLOR,
  DEFAULT_FILL_STYLE,
  DEFAULT_FONT_SIZE,
  DEFAULT_OPACITY,
  DEFAULT_ROUGHNESS,
  DEFAULT_STROKE_COLOR,
  DEFAULT_STROKE_STYLE,
  DEFAULT_STROKE_WIDTH,
} from '../constants';

/** Element factory — applies current style settings with sensible defaults. */
export function createElement(
  type: ElementType,
  x: number,
  y: number,
  style: Partial<StyleSettings> = {},
  zIndex = 0
): CanvasElement {
  const now = Date.now();
  const el: CanvasElement = {
    id: nanoid(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    strokeColor: style.strokeColor ?? DEFAULT_STROKE_COLOR,
    fillColor: style.fillColor ?? DEFAULT_FILL_COLOR,
    strokeWidth: style.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    roughness: style.roughness ?? DEFAULT_ROUGHNESS,
    opacity: style.opacity ?? DEFAULT_OPACITY,
    strokeStyle: style.strokeStyle ?? DEFAULT_STROKE_STYLE,
    fillStyle: style.fillStyle ?? DEFAULT_FILL_STYLE,
    edgeRoundness: style.edgeRoundness ?? DEFAULT_EDGE_ROUNDNESS,
    rotation: 0,
    zIndex,
    createdAt: now,
    updatedAt: now,
  };

  if (type === 'text') {
    el.fontSize = style.fontSize ?? DEFAULT_FONT_SIZE;
    el.text = '';
  }
  if (type === 'line' || type === 'arrow') {
    el.points = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
  }
  if (type === 'freehand') {
    el.points = [{ x: 0, y: 0 }];
  }
  if (type === 'frame') {
    el.fillColor = 'transparent';
    el.roughness = 0;
    el.frameName = 'Frame';
  }
  return el;
}
