/**
 * Type, from the Today handoff.
 *
 * **IBM Plex Sans** for the interface and **IBM Plex Mono** for every figure.
 * This replaces Inter: the handoff names Plex Sans and the design file loads
 * it, and the mockup is the design.
 *
 * ## The ramp has half-steps, and that is deliberate
 *
 * An earlier version of this system banned half-pixel sizes outright,
 * because the old app had reached 33 font sizes in half-pixel increments and
 * that is genuinely a disease. But the cure was the wrong shape: the disease
 * was sizes chosen per screen with no list, not the existence of a .5.
 *
 * So the rule is an **allowlist**, which is stricter. These fifteen sizes are
 * the whole ramp. 13.5 is legal because it is on it; 12.75 is not, and
 * neither is 21 — being a whole number buys nothing.
 */

export const font = {
  ui: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  /**
   * Every figure the shop could act on. A distinct face is the signal that
   * this is money, and tabular numerals are what let a column of it be
   * scanned — which is the only way a column of money is read.
   */
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/** Plex Sans 400/500/600/700; Plex Mono 500/600. Nothing else is loaded. */
export const weight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * The size ramp, keyed by its pixel value: `size['13.5']`.
 *
 * Taken from the design FILE, not the README's token table: the file uses
 * 16 and 18 (a card title, and the worth figure on a move) and never uses
 * the 17 the prose lists. Where the two disagree the markup wins.
 *
 * **The key order here is not the ramp order, and cannot be.** JavaScript
 * hoists integer-like keys ('11', '12') ahead of the rest and sorts them
 * numerically, so `Object.keys` returns 11,12,13,… then 9.5,10.5,11.5,…
 * whatever order they are written in. Nothing depends on the order — the SET
 * is the contract — and the test sorts before it compares. Do not "fix" the
 * ordering by renaming the keys.
 */
export const size = {
  '9.5': '9.5px',
  '10.5': '10.5px',
  '11': '11px',
  '11.5': '11.5px',
  '12': '12px',
  '12.5': '12.5px',
  '13': '13px',
  '13.5': '13.5px',
  '14': '14px',
  '14.5': '14.5px',
  '15': '15px',
  '16': '16px',
  '16.5': '16.5px',
  '18': '18px',
  '22': '22px',
  '24': '24px',
} as const;

export const leading = {
  /** Figures and tight headings. */
  tight: 1.2,
  /** Titles. */
  title: 1.35,
  /** Prose. */
  prose: 1.55,
} as const;

export const tracking = {
  /** Every figure. */
  figure: '-0.02em',
  /** Headings. */
  heading: '-0.02em',
  /** A smaller heading. */
  headingSoft: '-0.01em',
  /** Labels at 600. */
  label: '0.03em',
  /** Section heads: 700, uppercase. */
  section: '0.12em',
  normal: '0',
} as const;

/**
 * The money style. `<Figure>` applies it and nothing else spells it out.
 * Tabular is the load-bearing declaration.
 */
export const figureStyle = {
  fontFamily: font.mono,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: tracking.figure,
  fontWeight: weight.semibold,
} as const;

/** Prose gets a measure. 74ch, per the handoff. */
export const measure = '74ch';
