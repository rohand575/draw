/** Standard icon button with tooltip + a11y attributes. */
import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';

interface Props {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  onClick?: () => void;
  children: ReactNode;
}

export function IconButton({
  label,
  shortcut,
  active,
  disabled,
  danger,
  tooltipSide = 'bottom',
  onClick,
  children,
}: Props) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        aria-disabled={disabled}
        aria-keyshortcuts={shortcut}
        disabled={disabled}
        onClick={onClick}
        className={`ui-btn h-9 w-9 ${
          active
            ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30 hover:from-indigo-500 hover:to-indigo-600'
            : danger
              ? 'text-red-500 hover:bg-red-500/10'
              : ''
        } ${disabled ? 'pointer-events-none opacity-40' : ''}`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
