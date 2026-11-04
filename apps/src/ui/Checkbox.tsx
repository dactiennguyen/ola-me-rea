import { useEffect, useRef, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cn } from './cn.ts';
import { HUE_CHECK, type Hue } from './hue.ts';

type NativeProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'checked' | 'onChange' | 'children'>;

/** Native checkbox (keyboard + screen readers for free), optionally labeled; supports the mixed state. */
export function Checkbox({ checked, onChange, indeterminate = false, hue = 'accent', children, disabled, className, ...rest }: NativeProps & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** "Some selected" (shown only while not checked). */
  indeterminate?: boolean;
  /** Fill color when checked, matching the area it sits in. */
  hue?: Hue;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  const box = (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={e => onChange(e.target.checked)}
      className={cn('size-4 shrink-0 cursor-pointer disabled:cursor-not-allowed', HUE_CHECK[hue])}
      {...rest}
    />
  );
  if (children === undefined) return box;
  return (
    <label className={cn('inline-flex min-h-7 cursor-pointer items-center gap-2 text-sm text-fg', disabled && 'cursor-not-allowed opacity-55', className)}>
      {box}
      <span className="min-w-0">{children}</span>
    </label>
  );
}
