import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Icon, type IconName } from '../components/Icon.tsx';
import { cn } from './cn.ts';
import { Spinner } from './Spinner.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Roles, so every screen reads the same way:
 * - primary: THE main action of an area (one per area)
 * - secondary: other actions (default)
 * - ghost: outline, low emphasis next to a primary
 * - subtle: text-only, toolbars
 * - danger / danger-ghost: destructive (stop, delete)
 */
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border-accent bg-accent text-on-accent hover:enabled:border-accent-hover hover:enabled:bg-accent-hover',
  secondary: 'border-line-strong bg-raised text-strong hover:enabled:bg-hover',
  ghost: 'border-line-strong bg-transparent text-fg hover:enabled:bg-raised',
  subtle: 'border-transparent bg-transparent text-soft hover:enabled:bg-raised hover:enabled:text-strong',
  danger: 'border-danger bg-danger text-on-accent hover:enabled:border-danger-hover hover:enabled:bg-danger-hover',
  'danger-ghost': 'border-bad/45 bg-transparent text-bad hover:enabled:bg-bad-bg',
};

/** Heights follow the 3 control sizes: sm 28 · md 32 · lg 40. */
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1 px-2.5 text-xs',
  md: 'h-8 gap-1.5 px-3 text-sm',
  lg: 'h-10 gap-2 px-4 text-base',
};
const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 17 };

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon before the label. */
  icon?: IconName;
  /** Shows a spinner instead of the icon and blocks clicks. */
  loading?: boolean;
  /** Full width. */
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary', size = 'md', icon, loading = false, block = false,
  className, children, disabled, type = 'button', ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md border font-semibold',
        'transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant], SIZE[size], block && 'w-full', loading && 'cursor-progress', className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={ICON_SIZE[size] - 1} /> : icon && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
    </button>
  );
}
