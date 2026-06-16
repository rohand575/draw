/** Top-right action cluster: history, edit ops, view prefs, files, help. */
import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useElementStore } from '../../store/elementStore';
import { useHistoryStore } from '../../store/historyStore';
import { useToolStore } from '../../store/toolStore';
import { historyActions } from '../../hooks/useHistory';
import { clearCanvas, deleteSelection } from '../../utils/actions';
import {
  copyAsImage,
  exportAsJSON,
  exportAsPNG,
  exportAsSVG,
  exportProject,
} from '../../utils/exportCanvas';
import { importProjectFile } from '../../utils/sanitizeElements';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

export function ActionBar() {
  const theme = useCanvasStore((s) => s.theme);
  const showGrid = useCanvasStore((s) => s.showGrid);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const hasSelection = useToolStore((s) => s.selectedIds.length > 0);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: PointerEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [exportOpen]);

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const existing = new Set(useElementStore.getState().elements.map((el) => el.id));
    const result = importProjectFile(text, existing);
    if (!result) {
      alert('Invalid project file');
      return;
    }
    historyActions.saveSnapshot();
    useElementStore.getState().setElements(result.elements);
    useToolStore.getState().clearSelection();
    if (result.canvasState) {
      const cs = useCanvasStore.getState();
      cs.loadState({
        offsetX: result.canvasState.offsetX,
        offsetY: result.canvasState.offsetY,
        zoom: result.canvasState.zoom,
      });
      if (result.canvasState.theme) cs.setTheme(result.canvasState.theme);
      if (typeof result.canvasState.showGrid === 'boolean' && cs.showGrid !== result.canvasState.showGrid) {
        cs.toggleGrid();
      }
    }
  };

  const exportItems = [
    {
      label: 'Export PNG',
      run: () => void exportAsPNG(useElementStore.getState().elements, useCanvasStore.getState().theme),
    },
    {
      label: 'Export SVG',
      run: () => exportAsSVG(useElementStore.getState().elements, useCanvasStore.getState().theme),
    },
    { label: 'Export JSON', run: () => exportAsJSON(useElementStore.getState().elements) },
    {
      label: 'Save project (.mcv)',
      run: () => {
        const cs = useCanvasStore.getState();
        exportProject(useElementStore.getState().elements, {
          offsetX: cs.offsetX,
          offsetY: cs.offsetY,
          zoom: cs.zoom,
          theme: cs.theme,
          showGrid: cs.showGrid,
        });
      },
    },
    {
      label: copied ? 'Copied!' : 'Copy as image',
      run: () => {
        void copyAsImage(useElementStore.getState().elements, useCanvasStore.getState().theme).then((ok) => {
          if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        });
      },
      keepOpen: true,
    },
  ];

  return (
    <div className="panel pointer-events-auto flex items-center gap-0.5 px-1.5 py-1">
      <IconButton label="Undo" shortcut="Ctrl+Z" disabled={!canUndo} onClick={historyActions.undo}>
        <Icon name="undo" size={16} />
      </IconButton>
      <IconButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={historyActions.redo}>
        <Icon name="redo" size={16} />
      </IconButton>

      <div className="toolbar-divider" />

      <IconButton label="Delete selection" shortcut="Del" disabled={!hasSelection} danger onClick={deleteSelection}>
        <Icon name="trash" size={16} />
      </IconButton>
      <IconButton
        label="Clear canvas"
        danger
        onClick={() => {
          if (confirm('Clear the entire canvas? You can undo with Ctrl+Z.')) clearCanvas();
        }}
      >
        <Icon name="broom" size={16} />
      </IconButton>

      <div className="toolbar-divider" />

      <IconButton label="Toggle grid" shortcut="G" active={showGrid} onClick={() => useCanvasStore.getState().toggleGrid()}>
        <Icon name="grid" size={16} />
      </IconButton>
      <IconButton label="Snap to grid" active={snapToGrid} onClick={() => useCanvasStore.getState().toggleSnapToGrid()}>
        <Icon name="magnet" size={16} />
      </IconButton>
      <IconButton label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={() => useCanvasStore.getState().toggleTheme()}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </IconButton>

      <div className="toolbar-divider" />

      <IconButton label="Open project (.mcv / .json)" onClick={() => fileRef.current?.click()}>
        <Icon name="folder" size={16} />
      </IconButton>
      <input
        ref={fileRef}
        type="file"
        accept=".mcv,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onImportFile(file);
          e.target.value = '';
        }}
      />

      <div ref={exportRef} className="relative">
        <IconButton label="Export" active={exportOpen} onClick={() => setExportOpen((v) => !v)}>
          <Icon name="export" size={16} />
        </IconButton>
        {exportOpen && (
          <div className="panel animate-in absolute top-full right-0 z-50 mt-2 min-w-44 py-1.5">
            {exportItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="block w-full px-3.5 py-1.5 text-left text-[13px] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
                onClick={() => {
                  item.run();
                  if (!item.keepOpen) setExportOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-divider" />

      <IconButton label="Keyboard shortcuts" shortcut="?" onClick={() => useCanvasStore.getState().toggleShortcuts()}>
        <Icon name="help" size={16} />
      </IconButton>
    </div>
  );
}
