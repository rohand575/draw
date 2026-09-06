/**
 * Mind map engine: hierarchical tree of text nodes joined by auto-managed
 * connector edges. Nodes are `text` elements flagged `isMindMapNode` and linked
 * via `mindMapParentId`; edges are arrowhead-free `line` elements bound
 * parent-east → child-west. A tidy left-to-right layout reflows the whole tree
 * on every structural change, reusing the store's connector-binding reroute.
 */
import { nanoid } from 'nanoid';
import type { CanvasElement } from '../types';
import {
  HAND_FONT,
  MINDMAP_DEFAULT_LABEL,
  MINDMAP_FONT_SIZE,
  MINDMAP_HGAP,
  MINDMAP_VGAP,
} from '../constants';
import { useElementStore } from '../store/elementStore';
import { historyActions } from '../hooks/useHistory';
import { maxLineWidth } from './textWrap';

/** Measured bounds of a single-node label at a given font size. */
export function measureLabel(text: string, fontSize: number): { width: number; height: number } {
  const font = `${fontSize}px ${HAND_FONT}`;
  const sample = text.length > 0 ? text : ' ';
  const width = Math.max(20, maxLineWidth(sample, font));
  const height = sample.split('\n').length * fontSize * 1.3;
  return { width, height };
}

function nodeWidth(el: CanvasElement): number {
  return Math.max(20, el.width);
}
function nodeHeight(el: CanvasElement): number {
  return Math.max(el.height || 0, (el.fontSize ?? MINDMAP_FONT_SIZE) * 1.3);
}

/** Children of `id`, ordered top-to-bottom by creation time (stable). */
function childrenOf(elements: CanvasElement[], id: string): CanvasElement[] {
  return elements
    .filter((el) => el.mindMapParentId === id)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** Walk up parent links to the tree root; returns the root's id (or `id`). */
export function rootIdOf(elements: CanvasElement[], id: string): string {
  const byId = new Map(elements.map((el) => [el.id, el]));
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && current.mindMapParentId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.mindMapParentId);
    if (!parent) break;
    current = parent;
  }
  return current?.id ?? id;
}

/** All node ids in the subtree rooted at `id`, including `id` itself. */
function subtreeIds(elements: CanvasElement[], id: string): string[] {
  const out: string[] = [];
  const walk = (nodeId: string) => {
    out.push(nodeId);
    for (const child of childrenOf(elements, nodeId)) walk(child.id);
  };
  walk(id);
  return out;
}

/**
 * Reflow the tree containing `anyNodeId`: resolve its root, assign a tidy
 * left-to-right layout, then reroute the bound edges. The root stays anchored
 * at its current position. Accepts any node in the tree and always reads fresh
 * store state, so callers may pass a just-added/just-removed node's id.
 */
export function layoutMindMap(anyNodeId: string): void {
  const store = useElementStore.getState();
  const elements = store.elements;
  const rootId = rootIdOf(elements, anyNodeId);
  const byId = new Map(elements.map((el) => [el.id, el]));
  const root = byId.get(rootId);
  if (!root) return;

  const heightMemo = new Map<string, number>();
  const heightOf = (id: string): number => {
    const cached = heightMemo.get(id);
    if (cached !== undefined) return cached;
    const el = byId.get(id)!;
    const kids = childrenOf(elements, id);
    let h: number;
    if (kids.length === 0) {
      h = nodeHeight(el);
    } else {
      let total = 0;
      for (const c of kids) total += heightOf(c.id);
      total += MINDMAP_VGAP * (kids.length - 1);
      h = Math.max(nodeHeight(el), total);
    }
    heightMemo.set(id, h);
    return h;
  };

  const patches = new Map<string, Partial<CanvasElement>>();
  const place = (id: string, left: number, top: number) => {
    const el = byId.get(id)!;
    const h = heightOf(id);
    const own = nodeHeight(el);
    patches.set(id, { x: left, y: top + (h - own) / 2 });

    const kids = childrenOf(elements, id);
    if (kids.length === 0) return;
    let total = 0;
    for (const c of kids) total += heightOf(c.id);
    total += MINDMAP_VGAP * (kids.length - 1);
    const childLeft = left + nodeWidth(el) + MINDMAP_HGAP;
    let cursor = top + (h - total) / 2;
    for (const c of kids) {
      place(c.id, childLeft, cursor);
      cursor += heightOf(c.id) + MINDMAP_VGAP;
    }
  };

  const rootH = heightOf(rootId);
  const rootOwn = nodeHeight(root);
  place(rootId, root.x, root.y - (rootH - rootOwn) / 2);

  store.updateElements(patches);
  store.updateConnectorBindings([...patches.keys()]);
}

/** Build a mind-map edge (arrowhead-free line) bound parent-east → child-west. */
function makeEdge(parent: CanvasElement, childId: string, zIndex: number): CanvasElement {
  const now = Date.now();
  return {
    id: nanoid(),
    type: 'line',
    x: parent.x,
    y: parent.y,
    width: 0,
    height: 0,
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    strokeColor: parent.strokeColor,
    fillColor: 'transparent',
    strokeWidth: Math.max(1, Math.min(parent.strokeWidth, 2)),
    roughness: 0,
    opacity: 1,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    edgeRoundness: 0,
    rotation: 0,
    zIndex,
    createdAt: now,
    updatedAt: now,
    startBinding: { elementId: parent.id, point: 'e' },
    endBinding: { elementId: childId, point: 'w' },
    connectorStyle: 'straight',
    isMindMapEdge: true,
  };
}

/**
 * Add a child node under `parentId` with a default label, plus its edge, then
 * reflow the tree. Returns the new node id (or null if the parent is gone).
 */
export function addMindMapChild(parentId: string): string | null {
  const store = useElementStore.getState();
  const parent = store.elements.find((el) => el.id === parentId);
  if (!parent) return null;

  historyActions.saveSnapshot();
  const now = Date.now();
  const fontSize = MINDMAP_FONT_SIZE;
  const { width, height } = measureLabel(MINDMAP_DEFAULT_LABEL, fontSize);
  const baseZ = store.getMaxZIndex();

  const childId = nanoid();
  const child: CanvasElement = {
    id: childId,
    type: 'text',
    x: parent.x + nodeWidth(parent) + MINDMAP_HGAP,
    y: parent.y,
    width,
    height,
    text: MINDMAP_DEFAULT_LABEL,
    fontSize,
    strokeColor: parent.strokeColor,
    fillColor: 'transparent',
    strokeWidth: parent.strokeWidth,
    roughness: 0,
    opacity: 1,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    edgeRoundness: 0,
    rotation: 0,
    zIndex: baseZ + 2,
    createdAt: now,
    updatedAt: now,
    isMindMapNode: true,
    mindMapParentId: parentId,
  };
  const edge = makeEdge(parent, childId, baseZ + 1);

  store.addElements([edge, child]);
  layoutMindMap(childId);
  return childId;
}

/**
 * Add a sibling of `nodeId` (i.e. a child of its parent). For a root node,
 * falls back to adding a child. Returns the new node id.
 */
export function addMindMapSibling(nodeId: string): string | null {
  const store = useElementStore.getState();
  const node = store.elements.find((el) => el.id === nodeId);
  if (!node) return null;
  return addMindMapChild(node.mindMapParentId ?? nodeId);
}

/**
 * Delete a node and its entire subtree (plus connected edges), then reflow the
 * remaining tree. Returns the parent id to reselect, or null when a root was
 * removed.
 */
export function deleteMindMapNode(nodeId: string): string | null {
  const store = useElementStore.getState();
  const node = store.elements.find((el) => el.id === nodeId);
  if (!node) return null;

  historyActions.saveSnapshot();
  const removed = new Set(subtreeIds(store.elements, nodeId));
  const edgeIds = store.elements
    .filter(
      (el) =>
        (el.type === 'line' || el.type === 'arrow') &&
        ((el.startBinding && removed.has(el.startBinding.elementId)) ||
          (el.endBinding && removed.has(el.endBinding.elementId)))
    )
    .map((el) => el.id);

  const parentId = node.mindMapParentId ?? null;
  store.removeElements([...removed, ...edgeIds]);
  if (parentId) layoutMindMap(parentId);
  return parentId;
}
