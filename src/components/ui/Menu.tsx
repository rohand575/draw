/** Floating dropdown menu — portaled to document.body so it never clips inside
    a scroll/overflow ancestor, with viewport clamping and flip-up fallback. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onSelect: () => void;
}

interface Props {
  /** Bounding rect of the trigger; the menu is positioned relative to it. */
  anchor: DOMRect;
  items: MenuItem[];
  onClose: () => void;
}

export function Menu({ anchor, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Measure after mount, then clamp to the viewport (flip up if it would overflow).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    let left = anchor.right - r.width;
    let top = anchor.bottom + gap;
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    if (top + r.height > window.innerHeight - 8) top = anchor.top - r.height - gap;
    top = Math.max(8, top);
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    // Any pointerdown outside the menu closes it (the menu stops propagation itself).
    const onDown = () => onClose();
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
      className="panel animate-in fixed z-[80] min-w-[184px] p-1.5"
      style={{
        left: pos?.left ?? anchor.right,
        top: pos?.top ?? anchor.bottom + 6,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] font-medium transition-colors ${
            item.danger ? 'text-red-500 hover:bg-red-500/10' : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
          }`}
        >
          {item.icon && <Icon name={item.icon} size={15} className={item.danger ? '' : 'opacity-60'} />}
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
