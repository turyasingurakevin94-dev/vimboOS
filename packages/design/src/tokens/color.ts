/**
 * The palette. These values are the whole of it.
 *
 * **The one structural decision worth knowing:** the accent is cool and the
 * states are warm. The old system had a red accent sitting beside a crimson
 * "bad" and an amber "caution" — three warm colours doing three different
 * jobs, so a red thing on screen might mean *do this next* or *this is
 * broken* and the only way to tell was to read it. Here blue means "the one
 * action" and nothing else, and warm means "something about this figure".
 * They can never be confused because they are not the same temperature.
 *
 * Every pairing the system permits clears WCAG 4.5:1; the weakest is 5.11.
 * `tokens.test.ts` computes them all, so a value that breaks it cannot land.
 */

export const color = {
  /* -------------------------------- surfaces ----------------------------- */
  /** The workspace ground. Everything sits on this. */
  canvas: '#F7F9FB',
  /** Cards, panels, table bodies. */
  paper: '#FFFFFF',
  /** Row hover. A tint, not a border change. */
  paperHover: '#FBFCFD',
  /** Subtle fill: a progress track, a disabled field, a code block. */
  fill: '#F0F3F7',

  /* ------------------------------ navigation ----------------------------- */
  /** The dark left rail. Deep and cool, so the workspace beside it reads warm-white. */
  nav: '#0F1521',
  /** A raised surface inside the rail — a search box, a grouped section. */
  navRaised: '#1A2231',
  navText: '#C3CCDC',
  navMuted: '#8E9BB4',
  navSection: '#7A88A3',
  /**
   * The row you are on is INVERTED — white ground, nav ink. Never an accent
   * fill: the rail is on screen on every page, so an accent there
   * permanently spends the one accent of the screen on a row you are
   * already standing on.
   */
  navActiveGround: '#FFFFFF',
  navActiveInk: '#0F1521',

  /* --------------------------------- ink --------------------------------- */
  /** Body text, headings, figures. */
  ink: '#111827',
  /** Strong secondary — a sub-heading, a de-emphasised row. */
  ink2: '#374151',
  /** Captions, meta, labels, the basis line under a figure. Safe on canvas. */
  ink3: '#5D6B7E',
  /**
   * Disabled only. Below the contrast floor on purpose: it must never be the
   * only carrier of meaning, which is exactly what "disabled" means.
   */
  inkDisabled: '#98A2B3',

  /* -------------------------------- lines -------------------------------- */
  /** Card borders, table outer edges, field borders. */
  line: '#DFE4EC',
  /** Row dividers inside a table. Lighter, so a dense table is not a grid. */
  lineSoft: '#EDF0F5',

  /**
   * The ink that sits ON a filled accent or state colour — a primary button,
   * a badge, the knockout inside a filled icon.
   *
   * It is the same white as `paper`, and it is named separately because it is
   * a different job: `paper` is a surface, this is an ink. When a dark theme
   * arrives, `paper` moves and this one does not.
   */
  onFill: '#FFFFFF',

  /* -------------------------------- accent ------------------------------- */
  /** THE action. Once per screen. See the accent rule in the skill. */
  accent: '#1D4ED8',
  accentDeep: '#1A43B8',
  accentTint: '#EEF3FE',

  /* -------------------------------- states ------------------------------- */
  /** Genuinely good: ahead of target, paid, in stock, a gain. */
  good: '#146B34',
  goodTint: '#EAF6EF',
  /** Caution: due soon, running low, needs a look. */
  warn: '#8F4E08',
  warnTint: '#FCF2E4',
  /** Genuinely bad: overdue, out of stock, a loss. Also destructive actions. */
  bad: '#B01818',
  badTint: '#FCEBEB',
} as const;

export type ColorToken = keyof typeof color;

/**
 * Two names for one value, on purpose.
 *
 * The inverted active rail row is not "white and dark blue" — it is *the
 * paper colour* carrying *the rail colour*, which is what makes it read as
 * the page reaching into the rail. Naming it separately means a later change
 * to the rail colour moves the active row with it, instead of leaving a row
 * that used to match. Anything not listed here is a duplicate, and the test
 * says so.
 */
export const intentionalAliases: readonly (readonly [ColorToken, ColorToken])[] = [
  ['navActiveGround', 'paper'],
  ['navActiveInk', 'nav'],
  ['onFill', 'paper'],
];

/**
 * The pairings the system permits, as data.
 *
 * This is not documentation — it is the input to the contrast test. Adding a
 * colour without adding its legal grounds here means the test never checks
 * it, so the list and the palette are kept in step by a test of their own.
 */
export const legalPairings: readonly {
  readonly ink: ColorToken;
  readonly ground: ColorToken;
  readonly floor: 'body' | 'large' | 'ui';
  readonly note: string;
}[] = [
  // Body ink on every surface it can land on.
  { ink: 'ink', ground: 'canvas', floor: 'body', note: 'body text on the ground' },
  { ink: 'ink', ground: 'paper', floor: 'body', note: 'body text on a card' },
  { ink: 'ink', ground: 'paperHover', floor: 'body', note: 'body text on a hovered row' },
  { ink: 'ink', ground: 'fill', floor: 'body', note: 'body text on a subtle fill' },
  { ink: 'ink2', ground: 'canvas', floor: 'body', note: 'secondary on the ground' },
  { ink: 'ink2', ground: 'paper', floor: 'body', note: 'secondary on a card' },
  { ink: 'ink3', ground: 'canvas', floor: 'body', note: 'meta on the ground' },
  { ink: 'ink3', ground: 'paper', floor: 'body', note: 'meta on a card' },
  { ink: 'ink3', ground: 'paperHover', floor: 'body', note: 'meta on a hovered row' },
  { ink: 'ink3', ground: 'fill', floor: 'body', note: 'meta on a subtle fill' },

  // The rail.
  { ink: 'navText', ground: 'nav', floor: 'body', note: 'rail item' },
  { ink: 'navText', ground: 'navRaised', floor: 'body', note: 'rail item, raised' },
  { ink: 'navMuted', ground: 'nav', floor: 'body', note: 'rail count / meta' },
  { ink: 'navSection', ground: 'nav', floor: 'body', note: 'rail section label' },
  { ink: 'navActiveInk', ground: 'navActiveGround', floor: 'body', note: 'the inverted active row' },

  // The accent, both ways round.
  { ink: 'onFill', ground: 'accent', floor: 'body', note: 'white on the accent button' },
  { ink: 'onFill', ground: 'accentDeep', floor: 'body', note: 'white on the pressed accent' },
  { ink: 'accent', ground: 'paper', floor: 'body', note: 'accent as a link on a card' },
  { ink: 'accent', ground: 'canvas', floor: 'body', note: 'accent as a link on the ground' },
  { ink: 'accent', ground: 'accentTint', floor: 'body', note: 'accent chip' },
  { ink: 'accent', ground: 'paper', floor: 'ui', note: 'the focus ring' },

  // States: ink on white, ink on the ground, ink on its own tint, white on fill.
  { ink: 'good', ground: 'paper', floor: 'body', note: 'a good figure on a card' },
  { ink: 'good', ground: 'canvas', floor: 'body', note: 'a good figure on the ground' },
  { ink: 'good', ground: 'goodTint', floor: 'body', note: 'good chip' },
  { ink: 'onFill', ground: 'good', floor: 'body', note: 'white on a good fill' },
  { ink: 'warn', ground: 'paper', floor: 'body', note: 'a caution figure on a card' },
  { ink: 'warn', ground: 'canvas', floor: 'body', note: 'a caution figure on the ground' },
  { ink: 'warn', ground: 'warnTint', floor: 'body', note: 'caution chip' },
  { ink: 'onFill', ground: 'warn', floor: 'body', note: 'white on a caution fill' },
  { ink: 'bad', ground: 'paper', floor: 'body', note: 'a bad figure on a card' },
  { ink: 'bad', ground: 'canvas', floor: 'body', note: 'a bad figure on the ground' },
  { ink: 'bad', ground: 'badTint', floor: 'body', note: 'bad chip' },
  { ink: 'onFill', ground: 'bad', floor: 'body', note: 'white on a destructive fill' },
];

/**
 * Colours that may never carry text, and why.
 * The test asserts each one is genuinely below the floor, so that a future
 * edit which makes one "safe" has to come here and say so deliberately.
 */
export const neverCarriesText: readonly {
  readonly token: ColorToken;
  readonly why: string;
}[] = [
  { token: 'inkDisabled', why: 'disabled state — meaning must not depend on it' },
  { token: 'line', why: 'a border, not an ink' },
  { token: 'lineSoft', why: 'a hairline, not an ink' },
];
