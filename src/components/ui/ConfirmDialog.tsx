/** Centered confirmation modal — replaces native confirm()/alert() with an
    in-app dialog that matches the panel aesthetic. Supports a destructive tone. */
import { useEffect, useRef } from 'react';
import { Icon, type IconName } from './Icon';

interface Props {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Hide the cancel button for alert-style notices with a single action. */
  hideCancel?: boolean;
  danger?: boolean;
  icon?: IconName;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  hideCancel,
  danger,
  icon,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="panel animate-in w-[400px] max-w-[calc(100vw-32px)] p-5">
        <div className="flex items-start gap-3.5">
          {icon && (
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                danger ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-500'
              }`}
            >
              <Icon name={icon} size={20} />
            </span>
          )}
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {description && <p className="mt-1 text-[12.5px] leading-relaxed opacity-55">{description}</p>}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          {!hideCancel && (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium opacity-60 transition-colors hover:bg-black/[0.05] hover:opacity-100 dark:hover:bg-white/[0.07]"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.97] ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-500 hover:bg-indigo-600'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
