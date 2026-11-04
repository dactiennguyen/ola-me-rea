import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge must know the app's custom theme values, or it cannot tell
// that `shadow-pop` and `shadow-sm` conflict, for example. Colors need no entry:
// any unknown `text-*`/`bg-*` value is already treated as a color.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['pop', 'modal'],
    },
  },
});

/** Joins class names; later Tailwind utilities win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
