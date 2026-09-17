/**
 * The palette.
 *
 * These are the owner's values. §2 of `.claude/skills/ow-design/DESIGN-SYSTEM.md`
 * is the authority, and where that document and a reference file disagree the
 * FILE wins — the document says so itself. Both are quoted below wherever
 * they differ, so nobody has to re-derive it.
 *
 * It is a **card idiom**: a warm paper ground, white cards, and a tint per
 * kind of money. Five meaning families rather than three — bad, caution,
 * good, informational, and "studied" (the violet the Manager's own
 * reasoning wears).
 *
 * ## The accent is three colours, not one
 *
 * This is the rule that is not negotiable, and the reason the names look
 * fussy:
 *
 * - `accent` **#ef4b39** is a FILL, an ICON and a 3px left border. It
 *   measures 3.66:1 on white — below the floor in BOTH directions, so it can
 *   be neither text on light nor a ground under white text.
 * - `accentBtn` **#c2311f** is the filled button. White on it is 5.6:1.
 * - `accentInk` **#b2301f** is accent-coloured TYPE: an open document
 *   number, an overdue figure, the phone's active tab label.
 *
 * An earlier version of this file had one `accentInk` doing the second and
 * third jobs at #c2311f. That was not wrong, but it was one name for two
 * jobs, and this app has already shipped the failure at the other end of
 * that road once — amber ink on an amber fill.
 *
 * ## The ink scale
 *
 * Four numbered steps, the document's own, plus two the reference files draw
 * and it does not name. They are ordered, and the order is the whole point:
 * a label is never darker than the prose it labels.
 */

export const color = {
  /* ------------------------------ ground + ink ---------------------------- */
  /** The app ground. Warm paper, not a cool grey. */
  bg: '#f6f5f2',
  /** The edge outside the frame, and the mockup board itself. */
  canvasEdge: '#e8e7e2',
  /** Cards. */
  surface: '#ffffff',
  /** Inner tiles inside a card. */
  surface2: '#f7f6f3',
  /** Card borders. */
  hairline: '#ecebe6',
  /** Rules inside a card — lighter than a card border. */
  rule: '#f0eeea',
  /** The trough of a segmented control, and a lens at hover. */
  track: '#f0eeea',
  /** The one strong rule under a page header. Heavier than a card border. */
  divider: '#dcdad4',
  /** Borders of buttons, selects and search fields sitting on the ground. */
  controlEdge: '#cdc9c0',
  /** Inputs. */
  field: '#f4f3f0',
  fieldEdge: '#e2e0da',
  /** A hovered row. */
  rowHover: '#faf9f6',
  /**
   * The banded row in a long line table. It is a hair lighter than
   * `rowHover` on purpose — the two are the same property on the same
   * element in two states, so they may not collapse into one value.
   */
  rowAlt: '#fbfaf8',

  /** Body text and every figure. */
  ink: '#1b2233',
  /** The Manager's reasoning sentences — prose that is still being read. */
  inkProse: '#40465a',
  /** Secondary prose. 5.72:1 on the worst ground it lands on. */
  ink2: '#535d70',
  /** Labels, meta and basis lines. 4.71:1 on the worst ground it lands on. */
  ink3: '#5f6a7d',
  /** Icon-only chrome and disabled figures. 3.12:1 — **never text.** */
  ink4: '#8a939c',
  /** Carets, dotted underlines, an em-dash standing in for a missing figure. */
  inkFaint: '#b6bdca',

  /* --------------------------------- chrome ------------------------------- */
  /** The rail, the phone header, and dark buttons. */
  navy: '#17223c',
  navyHover: '#243354',
  /**
   * Four muted inks on navy, brightest first. The document lists a different
   * four (#c7cfd8 / #b9c2d6 / #a8b2c7 / #8b96ad); `Rail.dc.html`, which it
   * calls the authority on navigation, draws these. The file wins.
   */
  railInkStrong: '#c3cad9',
  railInk: '#b9c2d6',
  railInk2: '#a8b2c7',
  railHead: '#7d89a5',
  /** A label on the phone header's debt cell — pale red on the navy tint. */
  railInkBad: '#f8cdc6',
  /** A label on the phone header's margin cell — pale green on the tint. */
  railInkGood: '#b9e6d3',

  /* --------------------------------- accent ------------------------------- */
  /** The one thing to do next, as a FILL, an ICON or a left border. */
  accent: '#ef4b39',
  /** The filled primary button. White on it is 5.6:1. */
  accentBtn: '#c2311f',
  /** That button, pressed. */
  accentBtnHover: '#a5291a',
  /** Accent-coloured TYPE. Same value as `badInk`, and that is deliberate. */
  accentInk: '#b2301f',

  /* ------------------ meaning: bad / caution / good / studied -------------- */
  badFill: '#fff1ec',
  badChip: '#ffe1dc',
  /** A lighter bad chip, for the debt card's icon. Carries a glyph, not text. */
  badChipSoft: '#ffdfd5',
  badEdge: '#fadbd1',
  badInk: '#b2301f',
  /** Meta under a name on a bad tint — warm, so it belongs to the family. */
  badMeta: '#7a4436',

  warnFill: '#fff3d9',
  warnChip: '#ffeccd',
  warnEdge: '#f6e2b8',
  warnInk: '#96600f',
  warnMeta: '#6b5a33',

  goodFill: '#ecf8f2',
  /** The deep green chip. Only `goodInkStrong` clears the floor on it. */
  goodChip: '#cfeadd',
  /** The green tint that carries `goodInk` as text — an order chip, a %. */
  goodChipLight: '#e2f5ec',
  goodEdge: '#bfe5d4',
  /** A softer green edge: the Today margin card. */
  goodEdgeSoft: '#d3ebe0',
  goodInk: '#0f7a56',
  /** For text on `goodChip`, where `goodInk` is only 4.18:1. */
  goodInkStrong: '#0b5e42',
  /** Ink for captions sitting ON the green panel. 7.58:1 on `goodFill`. */
  goodPanelInk: '#39544b',

  infoFill: '#eef4ff',
  infoChip: '#eaf1ff',
  infoEdge: '#dce8fb',
  infoInk: '#1d5bb8',

  /** "Studied": the Manager's own reasoning, and the value bars. */
  studyFill: '#f4f1ff',
  studyChip: '#e5dffd',
  studyEdge: '#e3ddfb',
  studyInk: '#5b46d6',
  /** A move that waits on another move: the studied violet, gone quiet. */
  studyMuted: '#c7c3de',

  neutralChip: '#f2f0ec',
  neutralInk: '#5f6a7d',

  /* ----------------------------- the Today cards -------------------------- */
  /** The five-up strip's own tints, where they are not a meaning family. */
  cashFill: '#eef4ff',
  cashChip: '#d7e6ff',

  /* ------------------------------- rail chips ----------------------------- */
  sellChip: '#ffe3d6',
  sellChipInk: '#8f3009',
  buyChip: '#e6e3ff',
  buyChipInk: '#4230a8',
  catalogueChip: '#d9f2e6',
  catalogueChipInk: '#0b5e42',
  moneyChip: '#d7e8ff',
  moneyChipInk: '#164a96',
  insightChip: '#ffdfe9',
  insightChipInk: '#8a2450',
  setupChip: '#f0eeea',
  setupChipInk: '#5f6a7d',

  /* --------------------------------- ramps -------------------------------- */
  /** Aging: 0–14 days · 15–30 · 30+. The oldest wears the accent, as a bar. */
  agingFresh: '#c7d3e8',
  agingMiddle: '#f0a98f',
  agingOldest: '#ef4b39',

  /** White, as an ink on a filled accent, navy or state colour. */
  onFill: '#ffffff',
} as const;

export type ColorToken = keyof typeof color;

/** Twelve-step green, for the sold-by-week bars. Deepens left to right. */
export const greenRamp = [
  '#c3e2d3',
  '#a9d7c2',
  '#71bfa0',
  '#3f9f7c',
  '#1a8f66',
  '#0f7a56',
] as const;

/** Violet, for the value bars under "where the profit came from". */
export const violetRamp = ['#5b46d6', '#7a68e0', '#9a8ceb', '#bcb2f2'] as const;

/** An order's stage, on a lane board. Per §2 of the design system. */
export const stageRamp = {
  taken: '#7f8aa3',
  buying: '#8f7fd6',
  preparing: '#e0a33a',
  out: '#5b8ad6',
  delivered: '#4d9c76',
} as const;

/**
 * Colours that may never carry text, with the measurement that says why.
 * A test asserts each is genuinely below the floor, so a future edit that
 * makes one "safe" has to come here and say so out loud.
 */
export const neverCarriesText: readonly {
  readonly token: ColorToken;
  readonly why: string;
}[] = [
  { token: 'accent', why: '3.66:1 on white — a fill and an icon, never a word' },
  { token: 'ink4', why: '3.12:1 on white — icon chrome and disabled figures' },
  { token: 'inkFaint', why: '1.89:1 on white — a caret, a dotted underline, an em-dash' },
  { token: 'hairline', why: 'a card border, not an ink' },
  { token: 'rule', why: 'an inner rule, not an ink' },
  { token: 'divider', why: 'the rule under a page header' },
  { token: 'controlEdge', why: 'the border of a button or a search field' },
  { token: 'fieldEdge', why: 'a field border, not an ink' },
  { token: 'canvasEdge', why: 'the edge outside the frame' },
  { token: 'agingFresh', why: 'a bar segment' },
  { token: 'agingMiddle', why: 'a bar segment' },
  { token: 'agingOldest', why: 'a bar segment' },
  { token: 'badEdge', why: 'a card border' },
  { token: 'warnEdge', why: 'a card border' },
  { token: 'goodEdge', why: 'a card border' },
  { token: 'goodEdgeSoft', why: 'a card border' },
  { token: 'infoEdge', why: 'a card border' },
  { token: 'studyEdge', why: 'a card border' },
  { token: 'cashChip', why: 'an icon chip ground; its glyph is not text' },
  { token: 'badChipSoft', why: 'an icon chip ground; its glyph is not text' },
  { token: 'studyMuted', why: 'the left border of a move that is waiting' },
];

/**
 * Every text pairing the design uses, as data — and the input to the
 * contrast test. A colour that appears in no pairing and no exemption is
 * a colour nothing checks, and a separate test fails for that.
 */
export const legalPairings: readonly {
  readonly ink: ColorToken;
  readonly ground: ColorToken;
  readonly floor: 'body' | 'large' | 'ui';
  readonly note: string;
}[] = [
  // Body ink, on every ground it lands on.
  { ink: 'ink', ground: 'surface', floor: 'body', note: 'body on a card' },
  { ink: 'ink', ground: 'bg', floor: 'body', note: 'body on the ground' },
  { ink: 'ink', ground: 'surface2', floor: 'body', note: 'body on an inner tile' },
  { ink: 'ink', ground: 'rowHover', floor: 'body', note: 'body on a hovered row' },
  { ink: 'ink', ground: 'rowAlt', floor: 'body', note: 'body on a banded row' },
  { ink: 'ink', ground: 'track', floor: 'body', note: 'the label of a hovered lens' },
  { ink: 'ink', ground: 'field', floor: 'body', note: 'what you type in a field' },

  // The reasoning sentence.
  { ink: 'inkProse', ground: 'surface', floor: 'body', note: 'a reasoning line on a card' },
  { ink: 'inkProse', ground: 'bg', floor: 'body', note: 'a reasoning line on the ground' },
  { ink: 'inkProse', ground: 'surface2', floor: 'body', note: 'a reasoning line on a tile' },
  { ink: 'inkProse', ground: 'studyFill', floor: 'body', note: 'a reasoning line on the violet' },

  // Secondary prose.
  { ink: 'ink2', ground: 'surface', floor: 'body', note: 'secondary prose on a card' },
  { ink: 'ink2', ground: 'bg', floor: 'body', note: 'secondary prose on the ground' },
  { ink: 'ink2', ground: 'surface2', floor: 'body', note: 'secondary prose on a tile' },
  { ink: 'ink2', ground: 'rowAlt', floor: 'body', note: 'secondary prose on a banded row' },
  { ink: 'ink2', ground: 'field', floor: 'body', note: 'a field placeholder' },

  // Labels, meta and basis lines — the widest-travelling ink in the app.
  { ink: 'ink3', ground: 'surface', floor: 'body', note: 'a label on a card' },
  { ink: 'ink3', ground: 'bg', floor: 'body', note: 'a label on the ground' },
  { ink: 'ink3', ground: 'surface2', floor: 'body', note: 'a label on an inner tile' },
  { ink: 'ink3', ground: 'rowHover', floor: 'body', note: 'a label on a hovered row' },
  { ink: 'ink3', ground: 'rowAlt', floor: 'body', note: 'a label on a banded row' },
  { ink: 'ink3', ground: 'track', floor: 'body', note: 'a lens at rest' },
  { ink: 'ink3', ground: 'field', floor: 'body', note: 'a field label' },
  { ink: 'ink3', ground: 'cashFill', floor: 'body', note: 'basis on the cash card' },
  { ink: 'ink3', ground: 'badFill', floor: 'body', note: 'basis on the debt card' },
  { ink: 'ink3', ground: 'warnFill', floor: 'body', note: 'basis on a caution tint' },
  { ink: 'ink3', ground: 'goodFill', floor: 'body', note: 'basis on the margin card' },
  { ink: 'ink3', ground: 'studyFill', floor: 'body', note: 'basis on the stock card' },
  { ink: 'ink3', ground: 'infoFill', floor: 'body', note: 'basis on an info tint' },
  { ink: 'ink3', ground: 'neutralChip', floor: 'body', note: 'a neutral chip' },

  // The rail and the phone header.
  { ink: 'railInkStrong', ground: 'navy', floor: 'body', note: 'a back chevron, a header sub-line' },
  { ink: 'railInk', ground: 'navy', floor: 'body', note: 'a rail row' },
  { ink: 'railInk2', ground: 'navy', floor: 'body', note: 'a rail count, the shop name' },
  { ink: 'railHead', ground: 'navy', floor: 'body', note: 'a rail section heading' },
  { ink: 'railInkBad', ground: 'navy', floor: 'body', note: 'the debt cell label' },
  { ink: 'railInkGood', ground: 'navy', floor: 'body', note: 'the margin cell label' },
  { ink: 'onFill', ground: 'navy', floor: 'body', note: 'the active rail row, dark buttons' },
  { ink: 'onFill', ground: 'navyHover', floor: 'body', note: 'a dark button, hovered' },

  // The accent, only ever as ink-on-light or white-on-accentBtn.
  { ink: 'accentInk', ground: 'surface', floor: 'body', note: 'an open document number' },
  { ink: 'accentInk', ground: 'bg', floor: 'body', note: 'accent text on the ground' },
  { ink: 'accentInk', ground: 'badChip', floor: 'body', note: "the phone's active tab label" },
  { ink: 'onFill', ground: 'accentBtn', floor: 'body', note: 'the primary button' },
  { ink: 'onFill', ground: 'accentBtnHover', floor: 'body', note: 'the primary button, pressed' },

  // Meaning families: ink on its own fill, its chip, white and the ground.
  { ink: 'badInk', ground: 'badFill', floor: 'body', note: 'bad figure on its tint' },
  { ink: 'badInk', ground: 'badChip', floor: 'body', note: 'a bad chip' },
  { ink: 'badInk', ground: 'surface', floor: 'body', note: 'a bad figure on a card' },
  { ink: 'badInk', ground: 'bg', floor: 'body', note: 'a bad figure on the ground' },
  { ink: 'badMeta', ground: 'badFill', floor: 'body', note: 'meta under a name on a bad tint' },
  { ink: 'onFill', ground: 'badInk', floor: 'body', note: 'the Today badge' },

  { ink: 'warnInk', ground: 'warnFill', floor: 'body', note: 'caution figure on its tint' },
  { ink: 'warnInk', ground: 'warnChip', floor: 'body', note: 'a caution chip' },
  { ink: 'warnInk', ground: 'surface', floor: 'body', note: 'a caution figure on a card' },
  { ink: 'warnInk', ground: 'bg', floor: 'body', note: 'a caution figure on the ground' },
  { ink: 'warnMeta', ground: 'warnFill', floor: 'body', note: 'meta under a name on a caution tint' },

  { ink: 'goodInk', ground: 'goodFill', floor: 'body', note: 'good figure on its tint' },
  { ink: 'goodInk', ground: 'goodChipLight', floor: 'body', note: 'a good chip' },
  { ink: 'goodInk', ground: 'surface', floor: 'body', note: 'a gain on a card' },
  { ink: 'goodInk', ground: 'bg', floor: 'body', note: 'a gain on the ground' },
  { ink: 'goodInkStrong', ground: 'goodChip', floor: 'body', note: 'text on the deep green chip' },
  { ink: 'goodPanelInk', ground: 'goodFill', floor: 'body', note: 'a caption on the green panel' },

  { ink: 'infoInk', ground: 'infoFill', floor: 'body', note: 'info figure on its tint' },
  { ink: 'infoInk', ground: 'infoChip', floor: 'body', note: 'an info chip' },
  { ink: 'infoInk', ground: 'surface', floor: 'body', note: 'info text on a card' },
  { ink: 'infoInk', ground: 'cashFill', floor: 'body', note: 'the cash figure' },

  { ink: 'studyInk', ground: 'studyFill', floor: 'body', note: 'the stock figure' },
  { ink: 'studyInk', ground: 'studyChip', floor: 'body', note: 'the Manager mark' },
  { ink: 'studyInk', ground: 'surface', floor: 'body', note: 'studied text on a card' },

  { ink: 'neutralInk', ground: 'neutralChip', floor: 'body', note: 'a neutral chip' },
  { ink: 'neutralInk', ground: 'surface', floor: 'body', note: 'neutral meta on a card' },

  // The rail's section chips.
  { ink: 'sellChipInk', ground: 'sellChip', floor: 'body', note: 'the Sell chip' },
  { ink: 'buyChipInk', ground: 'buyChip', floor: 'body', note: 'the Buy chip' },
  { ink: 'catalogueChipInk', ground: 'catalogueChip', floor: 'body', note: 'the Catalogue chip' },
  { ink: 'moneyChipInk', ground: 'moneyChip', floor: 'body', note: 'the Money chip' },
  { ink: 'insightChipInk', ground: 'insightChip', floor: 'body', note: 'the Insight chip' },
  { ink: 'setupChipInk', ground: 'setupChip', floor: 'body', note: 'the Setup chip' },

  // The focus ring, as a control boundary.
  { ink: 'accentBtn', ground: 'surface', floor: 'ui', note: 'the focus ring' },
];

/** Two names for one value, on purpose. Anything else is a duplicate. */
export const intentionalAliases: readonly (readonly [ColorToken, ColorToken])[] = [
  // The active rail row and dark buttons take the same white as a card.
  ['onFill', 'surface'],
  // "Neutral ink" and "label ink" are the same grey doing two jobs; the
  // names stay separate so a chip and a caption can move independently.
  ['neutralInk', 'ink3'],
  // The oldest aging segment IS the accent — that is the point of it.
  ['agingOldest', 'accent'],
  // Accent type and bad type are one colour. An overdue figure IS bad news,
  // and the design draws it once; two names because a future palette could
  // move "late" without moving "the next action".
  ['accentInk', 'badInk'],
  // The Catalogue section chip wears the deep green, which is the same ink
  // that carries text on `goodChip`. One value, two jobs, both green.
  ['catalogueChipInk', 'goodInkStrong'],
  // Cash IS the informational family — the card's tint is that tint, and
  // naming it twice lets the card move without disturbing every info chip.
  ['cashFill', 'infoFill'],
  // The Setup chip is the inert pair: the inner rule as a ground, the label
  // ink as its mark.
  ['setupChip', 'rule'],
  ['setupChipInk', 'ink3'],
  ['setupChipInk', 'neutralInk'],
  // A control's trough and an inner rule are the same value. They are never
  // adjacent and never compared, so one value serves both; the names stay
  // apart because one is a surface and one is a line.
  ['track', 'rule'],
];
