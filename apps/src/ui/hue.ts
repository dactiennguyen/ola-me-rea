// Category colors: tell parts of a screen apart (the 4 steps, their counts).
// Not a status: success/warning/error keep ok/warn/bad. Violet (accent) stays
// for the main action, so each area gets its own hue instead.
// Class strings are written out in full so Tailwind can find them.

export type Hue = 'accent' | 'sky' | 'teal' | 'orange' | 'pink';

/** Tinted pill: badges, step numbers not yet done. */
export const HUE_SOFT: Record<Hue, string> = {
  accent: 'bg-accent-soft text-on-accent-soft',
  sky: 'bg-sky-soft text-sky-text',
  teal: 'bg-teal-soft text-teal-text',
  orange: 'bg-orange-soft text-orange-text',
  pink: 'bg-pink-soft text-pink-text',
};

/** Solid fill: a completed step. */
export const HUE_SOLID: Record<Hue, string> = {
  accent: 'bg-accent text-on-accent',
  sky: 'bg-sky text-bg',
  teal: 'bg-teal text-bg',
  orange: 'bg-orange text-bg',
  pink: 'bg-pink text-bg',
};

/** Native checkbox / radio fill. */
export const HUE_CHECK: Record<Hue, string> = {
  accent: 'accent-accent',
  sky: 'accent-sky',
  teal: 'accent-teal',
  orange: 'accent-orange',
  pink: 'accent-pink',
};

/** Text and icons on the page background. */
export const HUE_TEXT: Record<Hue, string> = {
  accent: 'text-accent-text',
  sky: 'text-sky-text',
  teal: 'text-teal-text',
  orange: 'text-orange-text',
  pink: 'text-pink-text',
};
