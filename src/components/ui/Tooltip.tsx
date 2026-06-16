/** Hover/focus tooltip with optional keyboard-shortcut chip. */
import { useState, type ReactNode } from 'react';

interface Props {
  label: string;
  shortcut?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}

const sideClasses: Record<NonNullable<Props['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({ label, shortcut, side = 'bottom', children }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          role="tooltip"
          className={`animate-in pointer-events-none absolute z-[80] flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11.5px] font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900 ${sideClasses[side]}`}
        >
          {label}
          {shortcut && (
            <kbd className="rounded bg-white/15 px-1 py-px font-sans text-[10px] dark:bg-black/15">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
}
