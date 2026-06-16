import { describe, expect, it } from 'vitest';
import type { CanvasElement } from '../types';
import {
  computeAlignmentGuides,
  distToSegment,
  findNearestConnectionPoint,
  getConnectionPointAbsolute,
  getElementBounds,
  getElementsBounds,
  hitTestElement,
  normalizeBox,
  snapToGridValue,
} from './geometry';

const base = (over: Partial<CanvasElement>): CanvasElement => ({
  id: 'a',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  strokeColor: '#000',
  fillColor: 'transparent',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
  strokeStyle: 'solid',
  fillStyle: 'hachure',
  edgeRoundness: 0,
  rotation: 0,
  zIndex: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('normalizeBox', () => {
  it('flips negative width/height', () => {
    expect(normalizeBox(10, 10, -5, -8)).toEqual({ x: 5, y: 2, width: 5, height: 8 });
  });
});

describe('getElementBounds', () => {
  it('uses points for lines', () => {
    const el = base({ type: 'line', x: 10, y: 10, points: [{ x: 0, y: 0 }, { x: 30, y: -20 }] });
    expect(getElementBounds(el)).toEqual({ x: 10, y: -10, width: 30, height: 20 });
  });
  it('unions multiple elements', () => {
    const a = base({ x: 0, y: 0, width: 10, height: 10 });
    const b = base({ id: 'b', x: 20, y: 20, width: 10, height: 10 });
    expect(getElementsBounds([a, b])).toEqual({ x: 0, y: 0, width: 30, height: 30 });
  });
});

describe('hitTestElement', () => {
  it('never hits locked elements', () => {
    expect(hitTestElement(base({ locked: true, fillColor: '#fff' }), 50, 25)).toBe(false);
  });
  it('hits filled rectangles anywhere inside', () => {
    expect(hitTestElement(base({ fillColor: '#fff' }), 50, 25)).toBe(true);
  });
  it('hits stroke-only rectangles on the border only', () => {
    const el = base({});
    expect(hitTestElement(el, 50, 25)).toBe(false);
    expect(hitTestElement(el, 50, 1)).toBe(true);
  });
  it('hits lines near the segment', () => {
    const el = base({ type: 'line', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
    expect(hitTestElement(el, 50, 4)).toBe(true);
    expect(hitTestElement(el, 50, 30)).toBe(false);
  });
  it('checks elbow route segments, not the diagonal', () => {
    const el = base({
      type: 'arrow',
      connectorStyle: 'elbow',
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    });
    expect(hitTestElement(el, 50, 2)).toBe(true); // first horizontal leg
    expect(hitTestElement(el, 25, 25)).toBe(false); // diagonal midpoint
  });
});

describe('distToSegment', () => {
  it('measures perpendicular distance', () => {
    expect(distToSegment(5, 5, 0, 0, 10, 0)).toBe(5);
  });
  it('clamps to endpoints', () => {
    expect(distToSegment(-3, 4, 0, 0, 10, 0)).toBe(5);
  });
});

describe('connection points', () => {
  it('computes named points', () => {
    const el = base({});
    expect(getConnectionPointAbsolute(el, 'n')).toEqual({ x: 50, y: 0 });
    expect(getConnectionPointAbsolute(el, 'e')).toEqual({ x: 100, y: 25 });
    expect(getConnectionPointAbsolute(el, 'center')).toEqual({ x: 50, y: 25 });
  });
  it('snaps within range and skips locked/ineligible elements', () => {
    const rect = base({});
    const locked = base({ id: 'l', x: 200, y: 0, locked: true });
    const line = base({ id: 'ln', type: 'line', x: 300, y: 0, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
    expect(findNearestConnectionPoint(52, 3, [rect, locked, line])?.point).toBe('n');
    expect(findNearestConnectionPoint(205, 25, [locked])).toBeNull();
    expect(findNearestConnectionPoint(52, 300, [rect])).toBeNull();
  });
});

describe('alignment guides', () => {
  it('snaps to the smallest valid delta within threshold', () => {
    // moving edges/centers: [96, 111, 126]; static: [100, 125, 150]
    // candidates: +4 (left to left) and -1 (right to centerX); -1 wins.
    const staticEl = base({ x: 100, y: 100, width: 50, height: 50 });
    const moving = { x: 96, y: 200, width: 30, height: 30 };
    const result = computeAlignmentGuides(moving, [staticEl], 6);
    expect(result.dx).toBe(-1);
    expect(result.guides.some((g) => g.type === 'vertical' && g.position === 125)).toBe(true);
  });

  it('returns zero delta when nothing is within threshold', () => {
    const staticEl = base({ x: 500, y: 500, width: 50, height: 50 });
    const result = computeAlignmentGuides({ x: 0, y: 0, width: 30, height: 30 }, [staticEl], 6);
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
    expect(result.guides).toHaveLength(0);
  });
});

describe('snapToGridValue', () => {
  it('rounds to grid multiples', () => {
    expect(snapToGridValue(29, 20)).toBe(20);
    expect(snapToGridValue(31, 20)).toBe(40);
  });
});
