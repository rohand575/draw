import { beforeEach, describe, expect, it } from 'vitest';
import { useHistoryStore } from './historyStore';
import { MAX_HISTORY } from '../constants';
import type { CanvasElement } from '../types';

const el = (id: string): CanvasElement => ({
  id,
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
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
});

describe('historyStore', () => {
  beforeEach(() => useHistoryStore.getState().clear());

  it('push/undo/redo round-trips', () => {
    const s = useHistoryStore.getState();
    s.pushState([el('a')]);
    const current = [el('a'), el('b')];

    const undone = useHistoryStore.getState().undo(current);
    expect(undone?.map((e) => e.id)).toEqual(['a']);

    const redone = useHistoryStore.getState().redo(undone!);
    expect(redone?.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('clears future on new push', () => {
    const s = useHistoryStore.getState();
    s.pushState([el('a')]);
    useHistoryStore.getState().undo([el('a'), el('b')]);
    expect(useHistoryStore.getState().canRedo()).toBe(true);
    useHistoryStore.getState().pushState([el('c')]);
    expect(useHistoryStore.getState().canRedo()).toBe(false);
  });

  it('caps history at MAX_HISTORY entries', () => {
    for (let i = 0; i < MAX_HISTORY + 20; i++) {
      useHistoryStore.getState().pushState([el(`e${i}`)]);
    }
    expect(useHistoryStore.getState().past.length).toBe(MAX_HISTORY);
  });

  it('popState discards the latest snapshot without applying it', () => {
    const s = useHistoryStore.getState();
    s.pushState([el('a')]);
    s.pushState([el('b')]);
    useHistoryStore.getState().popState();
    const undone = useHistoryStore.getState().undo([]);
    expect(undone?.map((e) => e.id)).toEqual(['a']);
  });

  it('deep-copies snapshots (no aliasing)', () => {
    const source = [el('a')];
    useHistoryStore.getState().pushState(source);
    source[0].x = 999;
    const undone = useHistoryStore.getState().undo([]);
    expect(undone?.[0].x).toBe(0);
  });

  it('undo/redo return null when empty', () => {
    expect(useHistoryStore.getState().undo([])).toBeNull();
    expect(useHistoryStore.getState().redo([])).toBeNull();
  });
});
