import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Icon } from '../components/Icon.tsx';
import { cn } from './cn.ts';

interface ToggleChipProps extends Omit<ComponentPropsWithRef<'button'>, 'onChange'> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
}

/** On/off pill (aria-pressed). "On" shows a check, so it never relies on color alone. */
export function ToggleChip({ pressed, onPressedChange, children, className, type = 'button', ...rest }: ToggleChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        'inline-flex h-7 max-w-44 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium',
        'transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
        pressed
          ? 'border-accent bg-accent-soft font-semibold text-on-accent-soft'
          : 'border-line-strong text-soft hover:enabled:bg-raised hover:enabled:text-strong',
        className,
      )}
      {...rest}
    >
      {pressed && <Icon name="check" size={12} />}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Selected value with a remove button (e.g. a chosen room). */
export function Tag({ children, onRemove, removeLabel, disabled }: {
  children: ReactNode;
  onRemove: () => void;
  /** Accessible name of the remove button, e.g. "Bỏ phòng Hà Nội". */
  removeLabel: string;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex h-7 max-w-48 items-center gap-1 rounded-full border border-accent bg-accent-soft pl-2.5 pr-1 text-xs font-semibold text-on-accent-soft">
      <span className="truncate">{children}</span>
      <button
        type="button"
        aria-label={removeLabel}
        title={removeLabel}
        disabled={disabled}
        onClick={onRemove}
        className="grid size-5 shrink-0 place-items-center rounded-full hover:enabled:bg-accent/40 disabled:opacity-50"
      >
        <Icon name="x" size={12} />
      </button>
    </span>
  );
}
