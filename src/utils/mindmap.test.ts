import { describe, it, expect, beforeEach } from 'vitest';
import type { CanvasElement } from '../types';
import { useElementStore } from '../store/elementStore';
import { layoutMindMap } from './mindmap';
import { MINDMAP_HGAP, MINDMAP_VGAP } from '../constants';

/** Minimal node/edge factory for layout tests (sizes given explicitly). */
function node(id: string, parentId: string | undefined, width: number, height: number): CanvasElement {
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    width,
    height,
    text: id,
    fontSize: 20,
    strokeColor: '#000',
    fillColor: 'transparent',
    strokeWidth: 1,
    roughness: 0,
    opacity: 1,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    edgeRoundness: 0,
    rotation: 0,
    zIndex: 0,
    createdAt: id.charCodeAt(id.length - 1), // stable ordering by suffix
    updatedAt: 0,
    isMindMapNode: true,
    mindMapParentId: parentId,
  };
}

function edge(id: string, from: string, to: string): CanvasElement {
  return {
    id,
    type: 'line',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    strokeColor: '#000',
    fillColor: 'transparent',
    strokeWidth: 1,
    roughness: 0,
    opacity: 1,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    edgeRoundness: 0,
    rotation: 0,
    zIndex: 0,
    createdAt: 0,
    updatedAt: 0,
    startBinding: { elementId: from, point: 'e' },
    endBinding: { elementId: to, point: 'w' },
    isMindMapEdge: true,
  };
}

const byId = () => new Map(useElementStore.getState().elements.map((el) => [el.id, el]));

describe('layoutMindMap', () => {
  beforeEach(() => useElementStore.getState().clearAll());

  it('lays out a tidy left-to-right tree with the root anchored and centered', () => {
    // root(100x30) → A(80x30) → A1(60x30); root → B(80x30)
    useElementStore.getState().setElements([
      node('root', undefined, 100, 30),
      node('A', 'root', 80, 30),
      node('B', 'root', 80, 30),
      node('A1', 'A', 60, 30),
      edge('e1', 'root', 'A'),
      edge('e2', 'root', 'B'),
      edge('e3', 'A', 'A1'),
    ]);

    layoutMindMap('A1'); // pass a leaf — root is resolved internally

    const m = byId();
    const root = m.get('root')!;
    const A = m.get('A')!;
    const B = m.get('B')!;
    const A1 = m.get('A1')!;

    // Root stays anchored at its original position.
    expect(root.x).toBe(0);
    expect(root.y).toBe(0);

    // Depth → x: each level shifts by parent width + HGAP.
    expect(A.x).toBe(100 + MINDMAP_HGAP);
    expect(B.x).toBe(100 + MINDMAP_HGAP);
    expect(A1.x).toBe(A.x + 80 + MINDMAP_HGAP);

    // Siblings stack vertically with VGAP; parent centers between them.
    const centerY = (el: CanvasElement) => el.y + el.height / 2;
    expect(B.y - A.y).toBe(30 + MINDMAP_VGAP);
    expect(centerY(root)).toBeCloseTo((centerY(A) + centerY(B)) / 2, 5);
  });

  it('reroutes bound edges to the new node connection points', () => {
    useElementStore.getState().setElements([
      node('root', undefined, 100, 30),
      node('A', 'root', 80, 30),
      edge('e1', 'root', 'A'),
    ]);

    layoutMindMap('root');

    const m = byId();
    const root = m.get('root')!;
    const A = m.get('A')!;
    const e1 = m.get('e1')!;

    // Edge starts at root's east midpoint and ends at A's west midpoint.
    const startX = root.x + root.width;
    const startY = root.y + root.height / 2;
    const endX = A.x;
    const endY = A.y + A.height / 2;
    expect(e1.x).toBeCloseTo(startX, 5);
    expect(e1.y).toBeCloseTo(startY, 5);
    expect(e1.x + (e1.points?.[1].x ?? 0)).toBeCloseTo(endX, 5);
    expect(e1.y + (e1.points?.[1].y ?? 0)).toBeCloseTo(endY, 5);
  });
});
