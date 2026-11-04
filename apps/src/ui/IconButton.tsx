import type { ComponentPropsWithRef } from 'react';
import { Icon, type IconName } from '../components/Icon.tsx';
import { cn } from './cn.ts';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: IconName;
  /** Required: an icon-only button needs an accessible name (also the tooltip). */
  label: string;
  size?: 'sm' | 'md';
  /** outline (default) · ghost (no border, toolbars) · danger (red on hover) */
  variant?: 'outline' | 'ghost' | 'danger';
  /** Pressed/selected look (e.g. an open panel). */
  active?: boolean;
}

const VARIANT = {
  outline: 'border-line hover:enabled:border-line-strong',
  ghost: 'border-transparent',
  danger: 'border-transparent hover:enabled:bg-bad-bg hover:enabled:text-bad',
} as const;

export function IconButton({
  icon, label, size = 'md', variant = 'outline', active = false, className, type = 'button', title, ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      aria-pressed={active || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border bg-transparent text-soft',
        'transition-colors duration-150 ease-out hover:enabled:bg-raised hover:enabled:text-strong',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'size-7' : 'size-8',
        VARIANT[variant],
        active && 'border-transparent bg-accent-soft text-on-accent-soft',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
}
