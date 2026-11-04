import type { ReactNode } from 'react';
import { Icon, type IconName } from '../components/Icon.tsx';
import { cn } from './cn.ts';

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'accent' | 'info';

const TONE: Record<Tone, string> = {
  neutral: 'bg-raised text-soft',
  ok: 'bg-ok-bg text-ok-text',
  warn: 'bg-warn-bg text-warn-text',
  bad: 'bg-bad-bg text-bad-text',
  accent: 'bg-accent-soft text-on-accent-soft',
  info: 'bg-info-bg text-info',
};

/** Short status or count label. Give it a word, not only a color. */
export function Badge({ tone = 'neutral', icon, children, title, className }: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn('inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold tabular-nums', TONE[tone], className)}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

/** Colored dot for a status that is also written next to it. */
export function StatusDot({ tone, className }: { tone: Exclude<Tone, 'accent'>; className?: string }) {
  const color = { neutral: 'bg-line-strong', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-info' }[tone];
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-full', color, className)} />;
}
