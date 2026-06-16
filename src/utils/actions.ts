/** Imperative app actions shared by keyboard shortcuts, context menu, and toolbars. */
import type { CanvasElement } from '../types';
import { useCanvasStore } from '../store/canvasStore';
import { useElementStore } from '../store/elementStore';
import { useToolStore } from '../store/toolStore';
import { historyActions } from '../hooks/useHistory';
import { getElementsBounds } from './geometry';

const els = () => useElementStore.getState();
const tools = () => useToolStore.getState();

export function getSelectedElements(): CanvasElement[] {
  const idSet = new Set(tools().selectedIds);
  return els().elements.filter((el) => idSet.has(el.id));
}

export function deleteSelection(): void {
  const removable = getSelectedElements().filter((el) => !el.locked);
  if (removable.length === 0) return;
  historyActions.saveSnapshot();
  els().removeElements(removable.map((el) => el.id));
  tools().clearSelection();
}

export function duplicateSelection(): void {
  const ids = tools().selectedIds;
  if (ids.length === 0) return;
  historyActions.saveSnapshot();
  const clones = els().duplicateElements(ids, 20, 20);
  tools().setSelectedIds(clones.map((c) => c.id));
}

export function selectAll(): void {
  tools().setActiveTool('select');
  tools().setSelectedIds(els().elements.map((el) => el.id));
}

export function groupSelection(): void {
  const ids = tools().selectedIds;
  if (ids.length < 2) return;
  historyActions.saveSnapshot();
  els().groupElements(ids);
}

export function ungroupSelection(): void {
  const selected = getSelectedElements();
  const groupIds = new Set(selected.map((el) => el.groupId).filter(Boolean));
  if (groupIds.size === 0) return;
  historyActions.saveSnapshot();
  const memberIds = els()
    .elements.filter((el) => el.groupId && groupIds.has(el.groupId))
    .map((el) => el.id);
  els().ungroupElements(memberIds);
}

export function toggleLockSelection(): void {
  const selected = getSelectedElements();
  if (selected.length === 0) return;
  historyActions.saveSnapshot();
  const anyUnlocked = selected.some((el) => !el.locked);
  els().lockElements(selected.map((el) => el.id), anyUnlocked);
  if (anyUnlocked) tools().clearSelection();
}

export function zoomToFit(): void {
  const bounds = getElementsBounds(els().elements);
  if (!bounds) return;
  useCanvasStore.getState().zoomToBounds(bounds, window.innerWidth, window.innerHeight, 60);
}

export function zoomToSelection(): void {
  const selected = getSelectedElements();
  if (selected.length === 0) return;
  const bounds = getElementsBounds(selected);
  if (!bounds) return;
  useCanvasStore.getState().zoomToBounds(bounds, window.innerWidth, window.innerHeight, 60);
}

/** Viewport center in world coordinates. */
export function getViewportCenterWorld(): { x: number; y: number } {
  const { offsetX, offsetY, zoom } = useCanvasStore.getState();
  return {
    x: window.innerWidth / (2 * zoom) - offsetX,
    y: window.innerHeight / (2 * zoom) - offsetY,
  };
}

// ---------------------------------------------------------------------------
// Style application with debounced snapshots (800 ms coalescing)
// ---------------------------------------------------------------------------

let lastStyleSnapshotAt = 0;

/** Apply a style patch to the current selection, coalescing undo snapshots. */
export function applyStyleToSelection(patch: Partial<CanvasElement>, coalesceMs = 800): void {
  const selected = getSelectedElements().filter((el) => !el.locked);
  if (selected.length === 0) return;
  const now = Date.now();
  if (now - lastStyleSnapshotAt > coalesceMs) {
    historyActions.saveSnapshot();
  }
  lastStyleSnapshotAt = now;
  const patches = new Map<string, Partial<CanvasElement>>();
  for (const el of selected) patches.set(el.id, patch);
  els().updateElements(patches);
}

/** Force the next style change to take a fresh snapshot. */
export function resetStyleSnapshotCoalescing(): void {
  lastStyleSnapshotAt = 0;
}

// ---------------------------------------------------------------------------
// Arrow-key nudges with 600 ms snapshot coalescing
// ---------------------------------------------------------------------------

let lastNudgeAt = 0;

export function nudgeSelection(dx: number, dy: number): void {
  const movable = getSelectedElements().filter((el) => !el.locked);
  if (movable.length === 0) return;
  const now = Date.now();
  if (now - lastNudgeAt > 600) historyActions.saveSnapshot();
  lastNudgeAt = now;

  const patches = new Map<string, Partial<CanvasElement>>();
  for (const el of movable) patches.set(el.id, { x: el.x + dx, y: el.y + dy });
  els().updateElements(patches);
  els().updateConnectorBindings(movable.map((el) => el.id));
}

// ---------------------------------------------------------------------------
// Z-order (single selection)
// ---------------------------------------------------------------------------

export function bringForward(): void {
  const ids = tools().selectedIds;
  if (ids.length !== 1) return;
  historyActions.saveSnapshot();
  els().bringForward(ids[0]);
}

export function sendBackward(): void {
  const ids = tools().selectedIds;
  if (ids.length !== 1) return;
  historyActions.saveSnapshot();
  els().sendBackward(ids[0]);
}

export function bringToFront(): void {
  const ids = tools().selectedIds;
  if (ids.length === 0) return;
  historyActions.saveSnapshot();
  for (const id of ids) els().bringToFront(id);
}

export function sendToBack(): void {
  const ids = tools().selectedIds;
  if (ids.length === 0) return;
  historyActions.saveSnapshot();
  for (const id of ids) els().sendToBack(id);
}

export function clearCanvas(): void {
  if (els().elements.length === 0) return;
  historyActions.saveSnapshot();
  els().clearAll();
  tools().clearSelection();
}
