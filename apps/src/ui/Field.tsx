import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cn } from './cn.ts';

/** Shared look of text-like controls (also used by Select/NumberInput/Textarea). */
export const controlClass = cn(
  'min-w-0 rounded-md border border-line bg-bg text-fg transition-colors duration-150',
  'placeholder:text-muted hover:enabled:border-line-strong focus-visible:border-accent focus-visible:outline-offset-0',
  'disabled:cursor-not-allowed disabled:opacity-55',
);

/**
 * A labeled control: label above, hint or error below. Renders a <label> so a
 * single input inside is labeled implicitly; use as="div" (role group) when
 * the field holds several controls (e.g. a select plus removable tags).
 */
export function Field({ label, hint, error, as = 'label', children, className }: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  as?: 'label' | 'div';
  children: ReactNode;
  className?: string;
}) {
  const Tag = as;
  return (
    <Tag className={cn('flex min-w-0 flex-col gap-1.5', className)} {...(as === 'div' ? { role: 'group' } : {})}>
      <span className="text-xs font-semibold text-soft">{label}</span>
      {children}
      {error ? <span className="text-xs text-bad">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </Tag>
  );
}

export function Input({ compact = false, className, ...rest }: ComponentPropsWithRef<'input'> & { compact?: boolean }) {
  return <input className={cn(controlClass, compact ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-sm', className)} {...rest} />;
}

export function Select({ compact = false, className, children, ...rest }: ComponentPropsWithRef<'select'> & { compact?: boolean }) {
  return (
    <select className={cn(controlClass, 'cursor-pointer', compact ? 'h-7 px-1.5 text-xs' : 'h-8 px-2 text-sm', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: ComponentPropsWithRef<'textarea'>) {
  return <textarea className={cn(controlClass, 'min-h-20 w-full resize-y px-3 py-2 text-base leading-normal', className)} {...rest} />;
}

/**
 * Number box with an optional unit after it ("3 trang", "1 giây"). What is
 * typed stays in the box as typed, so it can be cleared and retyped; the parent
 * gets the value kept within [min, max] on every key, and the box shows that
 * value on blur. With `emptyMeansZero` an empty box is 0 and 0 shows the placeholder.
 */
export function NumberInput({
  value, onChange, min = 0, max, step = 1, integer = true, unit, emptyMeansZero = false,
  placeholder, disabled, className, 'aria-label': ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  unit?: ReactNode;
  emptyMeansZero?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  /** The text being typed; null when the box is not being edited. */
  const [draft, setDraft] = useState<string | null>(null);

  const edit = (input: HTMLInputElement) => {
    const raw = input.value;
    setDraft(raw);
    if (raw === '') {
      // Also '' while unfinished ("1."): that must not count as cleared.
      if (emptyMeansZero && !input.validity.badInput) onChange(0);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const whole = integer ? Math.floor(n) : n;
    onChange(Math.max(min, max === undefined ? whole : Math.min(max, whole)));
  };

  const finish = (input: HTMLInputElement) => {
    if (draft === '' && !emptyMeansZero && !input.validity.badInput) onChange(min);
    setDraft(null);
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <input
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        className={cn(controlClass, 'h-8 w-16 px-2 text-sm tabular-nums', className)}
        value={draft ?? (emptyMeansZero && value === 0 ? '' : value)}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={e => edit(e.target)}
        onBlur={e => finish(e.target)}
      />
      {unit && <span>{unit}</span>}
    </span>
  );
}
