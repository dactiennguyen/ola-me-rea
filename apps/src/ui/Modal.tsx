import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn.ts';
import { IconButton } from './IconButton.tsx';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog over the app. Focus moves inside on open, Tab stays inside, Escape or
 * a click on the backdrop closes, and focus returns to the opener afterwards.
 */
export function Modal({ title, description, onClose, children, footer, size = 'md' }: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Action buttons, right-aligned at the bottom. */
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Latest onClose without re-running the focus effect when the parent re-renders.
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    (focusables()[0] ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const list = focusables();
      const first = list[0];
      const last = list.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus(); };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-overlay p-6 animate-[fade-in_180ms_ease-out]"
      onMouseDown={e => { if (e.target === e.currentTarget) close.current(); }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'flex max-h-[86vh] w-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-modal outline-none',
          'animate-[pop-in_180ms_ease-out]', { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-3xl' }[size],
        )}
      >
        <header className="flex items-start gap-2 border-b border-line px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          <IconButton icon="x" label="Đóng" variant="ghost" onClick={() => close.current()} />
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
