import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// PWA service worker (skipped under file:// so Electron doesn't try).
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  if (import.meta.env.DEV) {
    // Evict any SW left over from a prior prod build on the same origin —
    // otherwise it keeps serving cached `index.html` and assets in dev.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      if (regs.length === 0) return;
      Promise.all(regs.map((r) => r.unregister()))
        .then(() => caches?.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))))
        .then(() => window.location.reload());
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    });
  }
}
