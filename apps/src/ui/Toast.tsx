import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../components/Icon.tsx';
import { cn } from './cn.ts';
import { IconButton } from './IconButton.tsx';

export type ToastTone = 'ok' | 'warn' | 'bad' | 'info';
export interface ToastInput {
  tone?: ToastTone;
  message: ReactNode;
  /** ms before it hides itself; default 4 s (7 s for errors). */
  duration?: number;
}
interface ToastItem { id: number; tone: ToastTone; message: ReactNode }

const STYLE: Record<ToastTone, { border: string; icon: IconName; color: string }> = {
  ok: { border: 'border-l-ok', icon: 'circleCheck', color: 'text-ok' },
  warn: { border: 'border-l-warn', icon: 'alert', color: 'text-warn' },
  bad: { border: 'border-l-bad', icon: 'circleX', color: 'text-bad' },
  info: { border: 'border-l-info', icon: 'info', color: 'text-info' },
};
const MAX_VISIBLE = 4;

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);
let nextId = 0;

/** Short-lived feedback in the bottom-right corner (saved, exported, failed…). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems(list => list.filter(t => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const show = useCallback(({ tone = 'info', message, duration }: ToastInput) => {
    const id = ++nextId;
    setItems(list => [...list.slice(-(MAX_VISIBLE - 1)), { id, tone, message }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration ?? (tone === 'bad' ? 7000 : 4000)));
  }, [dismiss]);

  useEffect(() => () => { for (const timer of timers.current.values()) clearTimeout(timer); }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        <div role="region" aria-label="Thông báo" className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
          {items.map(t => {
            const s = STYLE[t.tone];
            return (
              <div
                key={t.id}
                role={t.tone === 'bad' ? 'alert' : 'status'}
                className={cn(
                  'pointer-events-auto flex items-start gap-2.5 rounded-md border border-l-[3px] border-line-strong bg-raised py-2.5 pl-3 pr-1.5',
                  'text-sm leading-normal text-fg shadow-pop animate-[pop-in_180ms_ease-out]', s.border,
                )}
              >
                <Icon name={s.icon} size={16} className={cn('mt-0.5', s.color)} />
                <div className="min-w-0 flex-1 break-words pt-px">{t.message}</div>
                <IconButton icon="x" label="Đóng thông báo" size="sm" variant="ghost" onClick={() => dismiss(t.id)} />
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast outside ToastProvider');
  return show;
}
