/** Root layout — canvas, floating chrome, dialogs, global hooks. */
import { useCanvasStore } from './store/canvasStore';
import { useElementStore } from './store/elementStore';
import { useDocumentStore } from './store/documentStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePersistence } from './hooks/usePersistence';
import { Canvas } from './components/canvas/Canvas';
import { FindBar } from './components/canvas/FindBar';
import { MiniMap } from './components/canvas/MiniMap';
import { ToolSelector } from './components/toolbar/ToolSelector';
import { StylePanel } from './components/toolbar/StylePanel';
import { ActionBar } from './components/toolbar/ActionBar';
import { ZoomControls } from './components/toolbar/ZoomControls';
import { CanvasSwitcher } from './components/sidebar/CanvasSwitcher';
import { AccountButton } from './components/auth/AccountButton';
import { AuthDialog } from './components/auth/AuthDialog';
import { ShapeLibrary } from './components/ui/ShapeLibrary';
import { ShortcutsDialog } from './components/ui/ShortcutsDialog';
import { AIDrawPanel } from './components/ai/AIDrawPanel';

function EmptyState() {
  const isEmpty = useElementStore((s) => s.elements.length === 0);
  const isLoading = useDocumentStore((s) => s.isLoading);
  if (!isEmpty || isLoading) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="animate-in -mt-10 text-center select-none">
        <p className="text-[15px] font-medium opacity-45">Start drawing</p>
        <p className="mt-1.5 text-[12.5px] opacity-35">
          Pick a tool on the left, or press{' '}
          <kbd className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-sans text-[11px] dark:bg-white/[0.09]">R</kbd> for a
          rectangle ·{' '}
          <kbd className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-sans text-[11px] dark:bg-white/[0.09]">?</kbd> for
          shortcuts
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const theme = useCanvasStore((s) => s.theme);
  useKeyboardShortcuts();
  usePersistence();

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="fixed inset-0 overflow-hidden bg-[#fafafa] font-sans text-gray-800 antialiased dark:bg-[#15151b] dark:text-gray-100">
        <Canvas />
        <EmptyState />

        {/* Floating chrome */}
        <div className="pointer-events-none absolute inset-x-0 top-4 z-50 flex items-start gap-3 px-4">
          <div className="flex shrink-0 flex-col items-start gap-2.5">
            <CanvasSwitcher />
            <AccountButton />
          </div>
          <div className="flex min-w-0 flex-1 justify-center">
            <StylePanel />
          </div>
          <div className="shrink-0">
            <ActionBar />
          </div>
        </div>

        <div className="pointer-events-none absolute top-1/2 left-4 z-40 -translate-y-1/2">
          <ToolSelector />
        </div>

        <div className="pointer-events-none absolute right-4 bottom-4 z-40">
          <ZoomControls />
        </div>

        <MiniMap />
        <ShapeLibrary />
        <AIDrawPanel />
        <FindBar />
        <ShortcutsDialog />
        <AuthDialog />
      </div>
    </div>
  );
}
