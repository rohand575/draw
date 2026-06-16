/** Bottom-right zoom pill: out / percentage (reset) / in / fit. */
import { useCanvasStore } from '../../store/canvasStore';
import { zoomToFit } from '../../utils/actions';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';

export function ZoomControls() {
  const zoom = useCanvasStore((s) => s.zoom);

  return (
    <div className="panel pointer-events-auto flex items-center gap-0.5 px-1 py-1">
      <Tooltip label="Zoom out" shortcut="Ctrl+-" side="top">
        <button
          type="button"
          aria-label="Zoom out"
          className="ui-btn h-7 w-7"
          onClick={() => useCanvasStore.getState().zoomOut(window.innerWidth / 2, window.innerHeight / 2)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg>
        </button>
      </Tooltip>
      <Tooltip label="Reset zoom" shortcut="Ctrl+0" side="top">
        <button
          type="button"
          aria-label="Reset zoom to 100%"
          className="ui-btn h-7 min-w-12 px-1 text-[11.5px] font-semibold tabular-nums"
          onClick={() => useCanvasStore.getState().resetView()}
        >
          {Math.round(zoom * 100)}%
        </button>
      </Tooltip>
      <Tooltip label="Zoom in" shortcut="Ctrl+=" side="top">
        <button
          type="button"
          aria-label="Zoom in"
          className="ui-btn h-7 w-7"
          onClick={() => useCanvasStore.getState().zoomIn(window.innerWidth / 2, window.innerHeight / 2)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </Tooltip>
      <Tooltip label="Zoom to fit" shortcut="Ctrl+1" side="top">
        <button type="button" aria-label="Zoom to fit" className="ui-btn h-7 w-7" onClick={zoomToFit}>
          <Icon name="fit" size={14} />
        </button>
      </Tooltip>
    </div>
  );
}
