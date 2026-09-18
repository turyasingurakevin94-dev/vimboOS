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
 * Taken from the design FILES, not the document's token table, and it is the
 * union of what they draw — not of what either lists. The document stops at
 * `15 16 19 26 28`; Today draws 16.5 and 18, Quote draws 17, 20 and 27, and
 * neither draws 26 or 28, so neither is here. A size nothing draws is a size
 * nothing checks.
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
  '10': '10px',
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
  '17': '17px',
  '18': '18px',
  '19': '19px',
  '20': '20px',
  '22': '22px',
  '24': '24px',
  '27': '27px',
} as const;

export const leading = {
  /**
   * A big figure, set solid. §2 of the design system gives 1.1 for exactly
   * this and the Order-tracking dock draws its four tiles at it: a 22px
   * figure on a 1.2 line sits a pixel low under its own label.
   */
  figure: 1.1,
  /** Figures and tight headings. */
  tight: 1.2,
  /** Titles. */
  title: 1.35,
  /** Prose. */
  prose: 1.55,
  /**
   * Prose in a card that is competing for height — a lane rule, the sentence
   * a step back costs, the reason an order is in the queue. The frame draws
   * 1.4 on the lane rule and 1.45 on the two sentences; at eleven pixels that
   * is half a pixel apart, and the design system names no step between
   * `title` and `prose` for either, so they take one value.
   */
  dense: 1.45,
} as const;

export const tracking = {
  /** Every figure. */
  figure: '-0.02em',
  /**
   * A display figure — 22px and up, where the design system drops the
   * weight to 500 and tightens the tracking a step further. The dock's four
   * tiles are the first place in this app to need it.
   */
  display: '-0.03em',
  /** Headings. */
  heading: '-0.02em',
  /** A smaller heading. */
  headingSoft: '-0.01em',
  /** Labels at 600. */
  label: '0.03em',
  /** A table's column heading: 10px, 600, uppercase, and wider than a label
   * because at ten pixels the letters close up. */
  column: '0.07em',
  /**
   * The label above a figure and over a lane, at 11px — §2 of the design
   * system gives this one 0.09em and the Order-tracking frame draws it on
   * every dock tile and every lane head. `label` is the Today handoff's 0.03em
   * and is a different element; rounding one to the other would close up
   * eleven-pixel capitals that were spaced on purpose.
   */
  figureLabel: '0.09em',
  /** The phone dock's label, at 9.5px — a hair wider again. */
  dock: '0.08em',
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
