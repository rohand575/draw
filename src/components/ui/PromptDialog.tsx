/** Minimal centered prompt dialog (embed URL, hyperlink, frame name, labels). */
import { useEffect, useRef, useState } from 'react';

interface Props {
  title: string;
  description?: string;
  placeholder?: string;
  initialValue: string;
  confirmLabel?: string;
  removable?: boolean;
  onConfirm: (value: string) => void;
  onRemove?: () => void;
  onCancel: () => void;
}

export function PromptDialog({
  title,
  description,
  placeholder,
  initialValue,
  confirmLabel = 'Save',
  removable,
  onConfirm,
  onRemove,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

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
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[12.5px] leading-relaxed opacity-55">{description}</p>}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') onConfirm(value);
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={placeholder}
          className="mt-3.5 w-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-[13.5px] outline-none transition-colors focus:border-indigo-400 focus:bg-transparent dark:border-white/10 dark:bg-white/[0.04] dark:focus:border-indigo-500"
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          {removable && onRemove && (
            <button
              type="button"
              className="mr-auto rounded-lg px-3 py-1.5 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-500/10"
              onClick={onRemove}
            >
              Remove
            </button>
          )}
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium opacity-60 transition-colors hover:bg-black/[0.05] hover:opacity-100 dark:hover:bg-white/[0.07]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-indigo-500 px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-indigo-600 active:scale-[0.97]"
            onClick={() => onConfirm(value)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
