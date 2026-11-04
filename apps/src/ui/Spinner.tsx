import { cn } from './cn.ts';

/** Indeterminate busy indicator. Decorative: pair it with visible text or aria-busy. */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80', className)}
      style={{ width: size, height: size }}
    />
  );
}
