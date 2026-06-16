/** ?-key modal listing every keyboard shortcut. */
import { useEffect } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { Icon } from './Icon';

interface Group {
  title: string;
  rows: [string, string][];
}

const GROUPS: Group[] = [
  {
    title: 'Tools',
    rows: [
      ['Select', 'V'],
      ['Hand (pan)', 'H'],
      ['Frame', 'F'],
      ['Rectangle', 'R'],
      ['Diamond', 'D'],
      ['Ellipse', 'O'],
      ['Line', 'L'],
      ['Arrow', 'A'],
      ['Pencil', 'P'],
      ['Text', 'T'],
    ],
  },
  {
    title: 'View',
    rows: [
      ['Pan canvas', 'Space+Drag / Right-drag'],
      ['Zoom', 'Ctrl+Scroll / Pinch'],
      ['Reset view', 'Ctrl+0'],
      ['Zoom to fit', 'Ctrl+1'],
      ['Zoom to selection', 'Ctrl+2'],
      ['Toggle grid', 'G'],
      ['Find', 'Ctrl+F'],
      ['Shortcuts', '?'],
    ],
  },
  {
    title: 'Edit',
    rows: [
      ['Undo', 'Ctrl+Z'],
      ['Redo', 'Ctrl+Shift+Z / Ctrl+Y'],
      ['Copy / Paste', 'Ctrl+C / Ctrl+V'],
      ['Duplicate', 'Ctrl+D'],
      ['Delete', 'Del / Backspace'],
      ['Select all', 'Ctrl+A'],
      ['Cycle selection', 'Tab / Shift+Tab'],
      ['Deselect / Select tool', 'Esc'],
    ],
  },
  {
    title: 'Style',
    rows: [
      ['Stroke color', '1–8'],
      ['Fill color', 'Alt+1–8'],
      ['Transparent fill', 'Alt+0'],
      ['Font size − / +', 'Ctrl+Shift+< / >'],
    ],
  },
  {
    title: 'Arrange',
    rows: [
      ['Bring forward / Send backward', 'Ctrl+] / Ctrl+['],
      ['Bring to front / Send to back', 'Ctrl+Shift+] / ['],
      ['Group / Ungroup', 'Ctrl+G / Ctrl+Shift+G'],
      ['Lock / Unlock', 'Ctrl+L'],
      ['Nudge 1px / 10px', 'Arrows / Shift+Arrows'],
      ['Duplicate-drag', 'Alt+Drag'],
    ],
  },
  {
    title: 'More',
    rows: [
      ['Open hyperlink', 'Ctrl+Click element'],
      ['Constrain endpoint to 45°', 'Shift+Drag endpoint'],
      ['Bullet list (in text)', '"- " then Enter / Tab'],
      ['Edit text / label / frame', 'Double-click'],
    ],
  },
];

export function ShortcutsDialog() {
  const open = useCanvasStore((s) => s.shortcutsOpen);
  const setOpen = useCanvasStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-6 backdrop-blur-[3px]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="panel animate-in flex max-h-[82vh] w-[760px] max-w-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4 dark:border-white/[0.07]">
          <div>
            <h2 className="text-[16px] font-semibold">Keyboard shortcuts</h2>
            <p className="mt-0.5 text-[12px] opacity-50">Everything is reachable without leaving the keyboard.</p>
          </div>
          <button type="button" className="ui-btn h-8 w-8" onClick={() => setOpen(false)} aria-label="Close shortcuts">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 overflow-y-auto px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-indigo-500 uppercase">{group.title}</h3>
              <dl>
                {group.rows.map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-[5px]">
                    <dt className="text-[12.5px] opacity-75">{label}</dt>
                    <dd className="shrink-0">
                      <kbd className="rounded-md bg-black/[0.05] px-1.5 py-0.5 font-sans text-[10.5px] font-medium whitespace-nowrap opacity-80 dark:bg-white/[0.08]">
                        {keys}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
