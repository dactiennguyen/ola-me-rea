import type { ReactNode } from 'react';
import { Icon, type IconName } from '../components/Icon.tsx';
import { cn } from './cn.ts';

type NoticeTone = 'info' | 'ok' | 'warn' | 'bad';
const NOTICE: Record<NoticeTone, { box: string; icon: IconName; iconColor: string }> = {
  info: { box: 'bg-info-bg text-soft', icon: 'info', iconColor: 'text-info' },
  ok: { box: 'bg-ok-bg text-ok-text', icon: 'circleCheck', iconColor: 'text-ok' },
  warn: { box: 'bg-warn-bg text-warn-text', icon: 'alert', iconColor: 'text-warn' },
  bad: { box: 'bg-bad-bg text-bad-text', icon: 'circleX', iconColor: 'text-bad' },
};

/** Inline message that stays (unlike a toast): results, blocking reasons, errors. */
export function Notice({ tone = 'info', icon, children, className }: {
  tone?: NoticeTone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  const t = NOTICE[tone];
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cn('flex items-start gap-2 rounded-md px-3 py-2 text-sm leading-normal', t.box, className)}>
      <Icon name={icon ?? t.icon} size={15} className={cn('mt-0.5', t.iconColor)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** What to show instead of an empty list: what it is and what to do next. */
export function EmptyState({ icon = 'inbox', title, children, action, compact = false, className }: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 text-center text-muted', compact ? 'px-3 py-6' : 'px-4 py-10', className)}>
      <span className="grid size-11 place-items-center rounded-lg bg-raised text-soft"><Icon name={icon} size={20} /></span>
      <p className="text-base font-semibold text-strong">{title}</p>
      {children && <p className="max-w-72 text-sm leading-normal">{children}</p>}
      {action}
    </div>
  );
}

const BAR = { accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' } as const;

export function ProgressBar({ value, max, tone = 'accent', label, className }: {
  value: number;
  max: number;
  tone?: keyof typeof BAR;
  /** Accessible name, e.g. "Tiến độ gửi". */
  label: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={cn('h-1.5 overflow-hidden rounded-full bg-raised', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-300 ease-out', BAR[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Small uppercase label above a group of content. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-xs font-bold uppercase tracking-wide text-muted', className)}>{children}</span>;
}
