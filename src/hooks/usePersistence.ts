/** Autosave debouncing + lifecycle flush. */
import { useEffect, useRef } from 'react';
import { AUTOSAVE_DEBOUNCE_MS } from '../constants';
import { useCanvasStore } from '../store/canvasStore';
import { useDocumentStore } from '../store/documentStore';
import { useElementStore } from '../store/elementStore';

export function usePersistence() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      void useDocumentStore.getState().init();
    }

    const scheduleSave = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void useDocumentStore.getState().saveCurrentCanvas();
      }, AUTOSAVE_DEBOUNCE_MS);
    };

    const unsubElements = useElementStore.subscribe((state, prev) => {
      if (state.elements !== prev.elements) scheduleSave();
    });
    const unsubCanvas = useCanvasStore.subscribe((state, prev) => {
      if (
        state.offsetX !== prev.offsetX ||
        state.offsetY !== prev.offsetY ||
        state.zoom !== prev.zoom ||
        state.theme !== prev.theme ||
        state.showGrid !== prev.showGrid
      ) {
        scheduleSave();
      }
    });

    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void useDocumentStore.getState().saveCurrentCanvas();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unsubElements();
      unsubCanvas();
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
