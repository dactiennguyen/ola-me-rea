import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from './cn.ts';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional count shown after the label (e.g. log filters). */
  count?: number;
  /** Text color class of the count (e.g. 'text-ok' for "Thành công"). */
  countClass?: string;
}

/** One-of-N choice (radio group). Arrow keys move the selection. */
export function Segmented<T extends string>({ value, onChange, options, label, size = 'md', disabled, className }: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** Accessible name of the group. */
  label: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}) {
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    if (next) onChange(next.value);
    const buttons = (event.currentTarget.parentElement?.querySelectorAll('button') ?? []) as NodeListOf<HTMLButtonElement>;
    buttons[(index + step + options.length) % options.length]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex shrink-0 overflow-hidden rounded-md border border-line-strong', className)}>
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={e => move(e, index)}
            className={cn(
              'inline-flex items-center gap-1.5 border-r border-line-strong transition-colors duration-150 last:border-r-0',
              'disabled:cursor-not-allowed disabled:opacity-55',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              // Selected = raised neutral surface + bold, not violet: violet is kept for the main action.
              on ? 'bg-hover font-semibold text-strong' : 'text-soft hover:enabled:bg-raised hover:enabled:text-strong',
            )}
          >
            {option.label}
            {option.count !== undefined && <span className={cn('tabular-nums', option.countClass ?? (on ? 'text-soft' : 'text-muted'))}>{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
