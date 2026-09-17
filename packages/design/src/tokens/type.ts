/**
 * Type.
 *
 * Two faces, four weights, one ramp. The old app reached 33 font sizes in
 * half-pixel steps, which is what happens when a size is chosen per screen
 * instead of picked off a ramp — and it is why some of its headings looked
 * muddy, because two of those weights were never loaded and the browser was
 * faking them.
 */

export const font = {
  /**
   * Interface. Inter is built for dense UI at small sizes and has the
   * numerals to match — it is doing the job the old app's Figtree did, with
   * better figures.
   */
  ui: "'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  /**
   * Every figure the shop could act on. A distinct face is the signal that
   * this is money, and tabular numerals are what make a column of it
   * readable at a glance — which is the only way a column of money is read.
   */
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/** Four weights. They are loaded; nothing else is. A fifth gets faked. */
export const weight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * The size ramp, named by pixel value.
 *
 * Both designs draw from one ramp — they just draw different sizes from it.
 * See `device.ts` for which sizes belong to which design; a phone that uses
 * the desktop's 13px body is the reflow this system exists to prevent.
 */
export const size = {
  11: '11px',
  12: '12px',
  13: '13px',
  14: '14px',
  15: '15px',
  16: '16px',
  18: '18px',
  20: '20px',
  24: '24px',
  30: '30px',
} as const;

export const leading = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
} as const;

export const tracking = {
  /** Figures. Slightly tightened so a long total does not sprawl. */
  figure: '-0.02em',
  /** Headings at 20px and up. */
  heading: '-0.01em',
  normal: '0',
  /** Small all-caps section labels, which need air to stay legible. */
  label: '0.04em',
} as const;

/**
 * The money style. Not a suggestion — the `<Figure>` component applies it,
 * and nothing else should be spelling these four declarations out.
 *
 * Tabular is the load-bearing one. A column of money that does not line up
 * on the decimal cannot be scanned, and scanning is the only way it is read.
 */
export const figureStyle = {
  fontFamily: font.mono,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: tracking.figure,
  fontWeight: weight.medium,
} as const;

/** Prose gets a measure. On a 1660px screen an unmeasured line runs ~180 characters. */
export const measure = '72ch';
