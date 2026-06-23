/** Autosave debouncing + lifecycle flush + cloud-sync lifecycle. */
import { useEffect, useRef } from 'react';
import { AUTOSAVE_DEBOUNCE_MS } from '../constants';
import { useCanvasStore } from '../store/canvasStore';
import { useDocumentStore, isApplyingDocument } from '../store/documentStore';
import { useElementStore } from '../store/elementStore';
import { useAuthStore } from '../store/authStore';
import {
  setAfterSyncHandler,
  onSignIn,
  onSignOut,
  fullSync,
  flush as cloudFlush,
} from '../utils/cloudSync';

export function usePersistence() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      void useDocumentStore.getState().init();

      // Cloud sync: let the engine refresh the document list after a merge,
      // then start auth (an existing session triggers a sign-in sync below).
      setAfterSyncHandler((reapply) => useDocumentStore.getState().refreshAfterSync(reapply));
      useAuthStore.getState().init();
    }

    const scheduleSave = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void useDocumentStore.getState().saveCurrentCanvas();
      }, AUTOSAVE_DEBOUNCE_MS);
    };

    const unsubElements = useElementStore.subscribe((state, prev) => {
      // Skip changes caused by loading a document (open/create/remote pull) —
      // those aren't user edits and must not be saved/pushed back.
      if (isApplyingDocument()) return;
      if (state.elements !== prev.elements) scheduleSave();
    });
    const unsubCanvas = useCanvasStore.subscribe((state, prev) => {
      if (isApplyingDocument()) return;
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

    // Run a full merge on sign-in; stop syncing on sign-out.
    let prevUserId = useAuthStore.getState().user?.id ?? null;
    const unsubAuth = useAuthStore.subscribe((state) => {
      const uid = state.user?.id ?? null;
      if (uid === prevUserId) return;
      prevUserId = uid;
      if (uid) void onSignIn();
      else onSignOut();
    });

    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void useDocumentStore.getState().saveCurrentCanvas();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush(); // persist locally...
        void cloudFlush(); // ...and push anything queued before the tab hides
      } else {
        void fullSync(false); // refocus → pull changes from other devices
      }
    };
    const onOnline = () => void cloudFlush(); // reconnect → drain the offline queue

    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      unsubElements();
      unsubCanvas();
      unsubAuth();
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
