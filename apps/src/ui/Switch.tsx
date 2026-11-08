import { cn } from './cn.ts';

/** On/off switch that takes effect at once (role="switch"). Show the state in words next to it. */
export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-ok' : 'bg-line-strong',
      )}
    >
      <span className={cn('absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform duration-150', checked && 'translate-x-5')} />
    </button>
  );
}
