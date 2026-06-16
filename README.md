# Canvas

A local-first infinite canvas for drawing and diagramming with a hand-drawn aesthetic — rebuilt as a premium, modern application. Shapes, smart connectors, frames, syntax-highlighted code blocks, embeds, AI-assisted drawing, multi-canvas documents, and full offline support.

## Quick start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # typecheck + production bundle in dist/
npm run test       # vitest unit tests
npm run preview    # serve the production build
```

s
### Desktop (Windows)

```bash
npm run icon             # regenerate public/icon.png (committed)
npm run electron:build   # NSIS installer in release/
```

The desktop build ships a system tray icon, a global `Ctrl+Alt+C` show/hide shortcut, and hardened web preferences (sandbox, context isolation, locked navigation).

## Highlights

- **10 tools** — select, hand, frame, rectangle, diamond, ellipse, line, arrow, pencil, text — all on single-key shortcuts (`V H F R D O L A P T`).
- **Smart connectors** — arrows bind to shape connection points (n/s/e/w/center), stay attached through moves and resizes, route straight or elbow, and carry midpoint labels.
- **Code blocks** — paste code and it's auto-detected (JSON, JS, Python, SQL, CSS, HTML, shell) and rendered with syntax highlighting.
- **AI Draw / AI Diagram** — describe an illustration or paste a process; GPT-4o returns an SVG that converts to native, editable canvas shapes (bring your own OpenAI key, stored locally).
- **Multi-canvas** — unlimited documents in IndexedDB with 500 ms debounced autosave, per-canvas theme and grid, and a top-left switcher.
- **Local-first** — no accounts, no servers. PWA installable, fully offline via a service worker.
- **Performance** — dirty-flag render loop, viewport culling, off-thread rough.js drawable generation (Web Worker), per-element drawable cache, batched store commits, LRU image cache.
- **Export / import** — PNG (2× with pixel cap), SVG, JSON, `.mcv` project files, copy-as-image; sanitized clipboard and file imports.
- **Security** — URL allow-listing (`http/https/mailto`), sandboxed iframes (no `allow-same-origin` for untrusted hosts), strict CSP, hardened Electron shell.

Press `?` in the app for the complete shortcut reference.

## Architecture

```
src/
├── components/    # React chrome: canvas, toolbars, panels, dialogs, AI
├── features/      # pure rendering: elements (canvas + SVG), grid, selection
├── store/         # zustand stores split by domain (elements, viewport, tool,
│                  # history, documents, library, AI, find)
├── hooks/         # keyboard router, undo/redo bridge, autosave lifecycle
├── utils/         # geometry, factories, persistence, exports, sanitization,
│                  # code detection, AI service, clipboard
├── workers/       # rough.js drawable pre-generation off the main thread
├── types/         # shared TypeScript contracts
└── constants/     # defaults, palettes, sizes, keys
```

State flows one way: pointer events mutate stores → subscriptions set a dirty flag → a `requestAnimationFrame` loop repaints only when needed. History is full-snapshot based (50-entry cap) with first-movement snapshot timing and coalesced snapshots for sliders (800 ms) and arrow-key nudges (600 ms).
