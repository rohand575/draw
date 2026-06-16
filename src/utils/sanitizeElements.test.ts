import { describe, expect, it } from 'vitest';
import { cloneElementsForPaste, importProjectFile, sanitizeElement, sanitizeElements } from './sanitizeElements';

const valid = {
  id: 'abc',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  strokeColor: '#1e1e1e',
  fillColor: 'transparent',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
  strokeStyle: 'solid',
  fillStyle: 'hachure',
  edgeRoundness: 0,
  zIndex: 1,
};

describe('sanitizeElement', () => {
  it('accepts valid elements', () => {
    expect(sanitizeElement(valid)?.id).toBe('abc');
  });
  it('drops elements missing id/type/coords', () => {
    expect(sanitizeElement({ ...valid, id: undefined })).toBeNull();
    expect(sanitizeElement({ ...valid, type: 'evil' })).toBeNull();
    expect(sanitizeElement({ ...valid, x: NaN })).toBeNull();
    expect(sanitizeElement(null)).toBeNull();
  });
  it('requires >=2 points for linear types', () => {
    expect(sanitizeElement({ ...valid, type: 'line', points: [{ x: 0, y: 0 }] })).toBeNull();
    expect(
      sanitizeElement({ ...valid, type: 'line', points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] })?.points
    ).toHaveLength(2);
  });
  it('clamps numeric ranges', () => {
    const el = sanitizeElement({ ...valid, strokeWidth: 999, opacity: 7, roughness: -2, fontSize: 9999, type: 'text', text: 'x' });
    expect(el?.strokeWidth).toBe(50);
    expect(el?.opacity).toBe(1);
    expect(el?.roughness).toBe(0);
    expect(el?.fontSize).toBe(400);
  });
  it('coerces invalid enums to defaults', () => {
    const el = sanitizeElement({ ...valid, strokeStyle: 'wavy', fillStyle: 'sparkly' });
    expect(el?.strokeStyle).toBe('solid');
    expect(el?.fillStyle).toBe('hachure');
  });
  it('strips unsafe hyperlinks and embeds', () => {
    const el = sanitizeElement({ ...valid, hyperlink: 'javascript:alert(1)', embedUrl: 'data:x' });
    expect(el?.hyperlink).toBeUndefined();
    expect(el?.embedUrl).toBeUndefined();
  });
});

describe('sanitizeElements', () => {
  it('regenerates colliding ids', () => {
    const out = sanitizeElements([valid, { ...valid }]);
    expect(out).toHaveLength(2);
    expect(out[0].id).not.toBe(out[1].id);
  });
  it('respects existing ids', () => {
    const out = sanitizeElements([valid], new Set(['abc']));
    expect(out[0].id).not.toBe('abc');
  });
});

describe('cloneElementsForPaste', () => {
  it('remaps bindings when both endpoints are pasted, clears otherwise', () => {
    const shape = sanitizeElement({ ...valid, id: 's1' })!;
    const arrow = sanitizeElement({
      ...valid,
      id: 'a1',
      type: 'arrow',
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      startBinding: { elementId: 's1', point: 'e' },
      endBinding: { elementId: 'missing', point: 'w' },
    })!;
    const [shapeClone, arrowClone] = cloneElementsForPaste([shape, arrow], 20, 20, 5);
    expect(arrowClone.startBinding?.elementId).toBe(shapeClone.id);
    expect(arrowClone.endBinding).toBeUndefined();
    expect(shapeClone.x).toBe(shape.x + 20);
    expect(shapeClone.zIndex).toBe(5);
  });
  it('remaps group ids consistently', () => {
    const a = sanitizeElement({ ...valid, id: 'g1', groupId: 'grp' })!;
    const b = sanitizeElement({ ...valid, id: 'g2', groupId: 'grp' })!;
    const [ca, cb] = cloneElementsForPaste([a, b], 0, 0, 0);
    expect(ca.groupId).toBeDefined();
    expect(ca.groupId).toBe(cb.groupId);
    expect(ca.groupId).not.toBe('grp');
  });
});

describe('importProjectFile', () => {
  it('parses elements and valid canvasState', () => {
    const out = importProjectFile(
      JSON.stringify({ version: 2, elements: [valid], canvasState: { offsetX: 1, offsetY: 2, zoom: 1.5, theme: 'dark', showGrid: false } })
    );
    expect(out?.elements).toHaveLength(1);
    expect(out?.canvasState).toMatchObject({ offsetX: 1, offsetY: 2, zoom: 1.5, theme: 'dark', showGrid: false });
  });
  it('drops corrupted canvasState but keeps elements', () => {
    const out = importProjectFile(JSON.stringify({ elements: [valid], canvasState: { offsetX: 'x', offsetY: 0, zoom: 0 } }));
    expect(out?.elements).toHaveLength(1);
    expect(out?.canvasState).toBeNull();
  });
  it('returns null for invalid JSON or shape', () => {
    expect(importProjectFile('not json')).toBeNull();
    expect(importProjectFile('{"version":1}')).toBeNull();
  });
});
