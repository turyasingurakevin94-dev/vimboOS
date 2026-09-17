/**
 * Space, radius, elevation.
 *
 * A 4px grid stepping in 8s. The reference system asks for an 8px grid, and
 * 8 is the working step here — 4, 6 and 2 exist for the inside of a chip and
 * the gap between a figure and its unit, where 8 is simply too much.
 */

export const space = {
  0: '0',
  1: '2px',
  2: '4px',
  3: '6px',
  4: '8px',
  5: '12px',
  6: '16px',
  7: '20px',
  8: '24px',
  9: '32px',
  10: '40px',
  11: '48px',
  12: '64px',
} as const;

export const radius = {
  /** Chips, badges, small tags. */
  sm: '6px',
  /** Buttons, fields, nav rows. */
  md: '8px',
  /** Cards, panels. */
  lg: '12px',
  /** Modals, slide-overs. */
  xl: '16px',
  pill: '999px',
} as const;

/**
 * Elevation. Three steps, and each one names what genuinely floats at it.
 *
 * Soft and low: the reference system asks for soft shadows and hover
 * elevation, and this is that — but a shadow here is depth, never
 * decoration. A card that sits flat on the canvas is a hairline and a
 * whisper of shadow, not a drop shadow. Anything heavier reads as a dialog
 * and makes the page feel like a pile of paper.
 */
export const elevation = {
  /** A card resting on the canvas. Pairs with a hairline border, not instead of it. */
  rest: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
  /** A card under the pointer, and a sticky table header over scrolled rows. */
  raised: '0 2px 4px rgba(16, 24, 40, 0.05), 0 4px 12px rgba(16, 24, 40, 0.08)',
  /** A menu, a combobox list, a toast — things genuinely above the page. */
  float: '0 8px 16px rgba(16, 24, 40, 0.08), 0 16px 32px rgba(16, 24, 40, 0.10)',
  /** A modal or slide-over, over a scrim. */
  modal: '0 16px 32px rgba(16, 24, 40, 0.12), 0 32px 64px rgba(16, 24, 40, 0.16)',
} as const;

/** The scrim behind a modal. */
export const scrim = 'rgba(16, 24, 40, 0.45)';

/**
 * The focus ring. One ring, everywhere, and it is never removed — it is the
 * whole of keyboard navigation for someone who works in this app all day.
 */
export const focusRing = {
  width: '2px',
  offset: '2px',
} as const;

/** Motion. Short enough to feel instant, long enough to be followed. */
export const motion = {
  instant: '80ms',
  fast: '140ms',
  base: '200ms',
  /** Slide-overs and modals entering. */
  enter: '260ms',
  ease: 'cubic-bezier(0.2, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
} as const;

/**
 * The z-index scale. Named, because a hand-picked 9999 is how a toast ends
 * up under the thing it is reporting on.
 */
export const layer = {
  base: 0,
  sticky: 10,
  rail: 20,
  dropdown: 30,
  scrim: 40,
  modal: 50,
  toast: 60,
} as const;
