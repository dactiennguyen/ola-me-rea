import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react';
import { Icon } from '../components/Icon.tsx';
import { cn } from './cn.ts';

interface ToggleChipProps extends Omit<ComponentPropsWithRef<'button'>, 'onChange' | 'color'> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  /**
   * Identity color (a CSS color, e.g. the account's avatar color). Shown as a
   * dot, and tints the chip while it is on. Without it the chip is neutral.
   */
  color?: string;
  children: ReactNode;
}

/** On/off pill (aria-pressed). "On" shows a check, so it never relies on color alone. */
export function ToggleChip({ pressed, onPressedChange, color, children, className, style, type = 'button', ...rest }: ToggleChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      style={color ? ({ '--chip': color, ...style } as CSSProperties) : style}
      className={cn(
        'inline-flex h-7 max-w-44 shrink-0 items-center gap-1.5 rounded-full border text-xs font-medium',
        'transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
        color ? 'pl-1 pr-2.5' : 'px-2.5',
        pressed
          ? color
            ? 'border-(--chip) bg-(--chip)/30 font-semibold text-strong'
            : 'border-strong/60 bg-hover font-semibold text-strong'
          : 'border-line-strong text-soft hover:enabled:bg-raised hover:enabled:text-strong',
        className,
      )}
      {...rest}
    >
      {color ? (
        // Colored dot that turns into a check when on.
        <span aria-hidden="true" className={cn('grid size-5 shrink-0 place-items-center rounded-full bg-(--chip) text-white', !pressed && 'scale-60')}>
          {pressed && <Icon name="check" size={12} />}
        </span>
      ) : pressed && <Icon name="check" size={12} />}
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
    <span className="inline-flex h-7 max-w-48 items-center gap-1 rounded-full border border-line-strong bg-raised pl-2.5 pr-1 text-xs font-semibold text-strong">
      <span className="truncate">{children}</span>
      <button
        type="button"
        aria-label={removeLabel}
        title={removeLabel}
        disabled={disabled}
        onClick={onRemove}
        className="grid size-5 shrink-0 place-items-center rounded-full text-muted hover:enabled:bg-hover hover:enabled:text-strong disabled:opacity-50"
      >
        <Icon name="x" size={12} />
      </button>
    </span>
  );
}
