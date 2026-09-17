/**
 * The palette.
 *
 * These are the owner's values, taken from the Today design handoff
 * (`design_handoff_dashboard_today`). They are not a starting point to
 * improve on — the mockup is the design (see §0.5 of the skill), so where
 * this file and a mockup disagree, this file moves.
 *
 * It is a **card idiom**: a warm paper ground, white cards, and a tint per
 * kind of money. Five meaning families rather than three — bad, caution,
 * good, informational, and "studied" (the violet the Manager's own
 * reasoning wears).
 *
 * ## The one rule that is not negotiable
 *
 * `accent` (#ef4b39) is a **fill and icon colour only**. It measures 3.66:1
 * against white, which is below the 4.5 floor in both directions: it cannot
 * be text on a light ground, and white cannot be text on it. Anything
 * carrying words uses `accentInk` (#c2311f, 5.6:1).
 *
 * The design file already does this correctly — every one of its four uses
 * of #ef4b39 is a brand square, a bar segment or an SVG, and its `.btn-p` is
 * #c2311f. The handoff's own prose slipped once and called the primary
 * button #ef4b39; the markup is right and the sentence was not. A test now
 * holds the rule so neither can slip again, which matters because this app
 * has already shipped exactly this failure once — amber ink on a red fill.
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
  /** Inputs. */
  field: '#f4f3f0',
  fieldEdge: '#e2e0da',
  /** Body text. */
  ink: '#1b2233',
  /** Labels, meta, secondary. 5.46:1 on white and ≥4.8:1 on every tint. */
  ink2: '#5f6a7d',
  /** Icon-only chrome — chevrons, dividers. **Never text.** */
  ink3: '#b6bdca',
  rowHover: '#faf9f6',

  /* --------------------------------- chrome ------------------------------- */
  /** The rail, the phone header, and dark buttons. */
  navy: '#17223c',
  navyHover: '#243354',
  railInk: '#b9c2d6',
  railInk2: '#a8b2c7',
  railHead: '#7d89a5',
  /** A label on the phone header's debt cell — pale red on the navy tint. */
  railInkBad: '#f8cdc6',
  /** A label on the phone header's margin cell — pale green on the tint. */
  railInkGood: '#b9e6d3',

  /* --------------------------------- accent ------------------------------- */
  /**
   * The one thing to do next — as a FILL or an ICON. Never text, and never
   * under text. 3.66:1 against white is below the floor both ways round.
   */
  accent: '#ef4b39',
  /** What the accent becomes when words are involved. 5.6:1 with white. */
  accentInk: '#c2311f',
  /** The pressed state of a filled `accentInk` button. */
  accentInkHover: '#a5291a',

  /* ------------------ meaning: bad / caution / good / studied -------------- */
  badFill: '#fff1ec',
  badChip: '#ffe1dc',
  /** A lighter bad chip, for the debt card's icon. Carries a glyph, not text. */
  badChipSoft: '#ffdfd5',
  badInk: '#b2301f',

  warnFill: '#fff3d9',
  warnChip: '#ffeccd',
  warnInk: '#96600f',

  goodFill: '#ecf8f2',
  goodChip: '#cfeadd',
  goodInk: '#0f7a56',
  /** For text on `goodChip`, where `goodInk` is only 4.18:1. */
  goodInkStrong: '#0b5e42',
  /** The green tint that carries `goodInk` as text — an order chip, a %. */
  goodChipLight: '#e2f5ec',
  /** Ink for captions sitting ON the green panel. 7.58:1 on `goodFill`. */
  goodPanelInk: '#39544b',

  infoFill: '#eef4ff',
  infoChip: '#eaf1ff',
  infoInk: '#1d5bb8',

  /** "Studied": the Manager's own reasoning, and the value bars. */
  studyFill: '#f4f1ff',
  studyChip: '#ece8ff',
  studyInk: '#5b46d6',
  /** A move that waits on another move: the studied violet, gone quiet. */
  studyMuted: '#c7c3de',

  neutralChip: '#f2f0ec',
  neutralInk: '#5f6a7d',

  /* --------------------------- card tints and edges ----------------------- */
  /** Metric card fills and their borders, per the five-up strip. */
  cashFill: '#eef4ff',
  cashEdge: '#dce8fb',
  cashChip: '#d7e6ff',
  debtEdge: '#fadbd1',
  owedEdge: '#ecebe6',
  owedChip: '#f0eeea',
  marginEdge: '#d3ebe0',
  stockEdge: '#e3ddfb',

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

  /* --------------------------------- ramps -------------------------------- */
  /** Aging: 0–30 days · 31–60 · 60+. The oldest wears the accent, as a bar. */
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
  { token: 'ink3', why: 'icon-only chrome: chevrons and dividers' },
  { token: 'hairline', why: 'a card border, not an ink' },
  { token: 'rule', why: 'an inner rule, not an ink' },
  { token: 'fieldEdge', why: 'a field border, not an ink' },
  { token: 'canvasEdge', why: 'the edge outside the frame' },
  { token: 'agingFresh', why: 'a bar segment' },
  { token: 'agingMiddle', why: 'a bar segment' },
  { token: 'agingOldest', why: 'a bar segment' },
  { token: 'cashEdge', why: 'a card border' },
  { token: 'debtEdge', why: 'a card border' },
  { token: 'owedEdge', why: 'a card border' },
  { token: 'marginEdge', why: 'a card border' },
  { token: 'stockEdge', why: 'a card border' },
  { token: 'cashChip', why: 'an icon chip ground; its glyph is not text' },
  { token: 'owedChip', why: 'an icon chip ground; its glyph is not text' },
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
  // Body and label ink, on every ground either lands on.
  { ink: 'ink', ground: 'surface', floor: 'body', note: 'body on a card' },
  { ink: 'ink', ground: 'bg', floor: 'body', note: 'body on the ground' },
  { ink: 'ink', ground: 'surface2', floor: 'body', note: 'body on an inner tile' },
  { ink: 'ink', ground: 'rowHover', floor: 'body', note: 'body on a hovered row' },
  { ink: 'ink', ground: 'field', floor: 'body', note: 'what you type in a field' },
  { ink: 'ink2', ground: 'surface', floor: 'body', note: 'label on a card' },
  { ink: 'ink2', ground: 'bg', floor: 'body', note: 'label on the ground' },
  { ink: 'ink2', ground: 'surface2', floor: 'body', note: 'label on an inner tile' },
  { ink: 'ink2', ground: 'rowHover', floor: 'body', note: 'label on a hovered row' },
  { ink: 'ink2', ground: 'field', floor: 'body', note: 'a field placeholder' },
  { ink: 'ink2', ground: 'cashFill', floor: 'body', note: 'basis on the cash card' },
  { ink: 'ink2', ground: 'badFill', floor: 'body', note: 'basis on the debt card' },
  { ink: 'ink2', ground: 'warnFill', floor: 'body', note: 'basis on a caution tint' },
  { ink: 'ink2', ground: 'goodFill', floor: 'body', note: 'basis on the margin card' },
  { ink: 'ink2', ground: 'studyFill', floor: 'body', note: 'basis on the stock card' },
  { ink: 'ink2', ground: 'infoFill', floor: 'body', note: 'basis on an info tint' },
  { ink: 'ink2', ground: 'neutralChip', floor: 'body', note: 'a neutral chip' },

  // The rail.
  { ink: 'railInk', ground: 'navy', floor: 'body', note: 'a rail row' },
  { ink: 'railInk2', ground: 'navy', floor: 'body', note: 'a rail count, the shop name' },
  { ink: 'railHead', ground: 'navy', floor: 'body', note: 'a rail section heading' },
  { ink: 'railInkBad', ground: 'navy', floor: 'body', note: 'the debt cell label' },
  { ink: 'railInkGood', ground: 'navy', floor: 'body', note: 'the margin cell label' },
  { ink: 'onFill', ground: 'navy', floor: 'body', note: 'the active rail row, dark buttons' },
  { ink: 'onFill', ground: 'navyHover', floor: 'body', note: 'a dark button, hovered' },

  // The accent, only ever as ink-on-light or white-on-accentInk.
  { ink: 'accentInk', ground: 'surface', floor: 'body', note: 'accent text on a card' },
  { ink: 'accentInk', ground: 'bg', floor: 'body', note: 'accent text on the ground' },
  { ink: 'onFill', ground: 'accentInk', floor: 'body', note: 'the primary button' },
  { ink: 'onFill', ground: 'accentInkHover', floor: 'body', note: 'the primary button, pressed' },

  // Meaning families: ink on its own fill, its chip, white and the ground.
  { ink: 'badInk', ground: 'badFill', floor: 'body', note: 'bad figure on its tint' },
  { ink: 'badInk', ground: 'badChip', floor: 'body', note: 'a bad chip' },
  { ink: 'badInk', ground: 'surface', floor: 'body', note: 'a bad figure on a card' },
  { ink: 'badInk', ground: 'bg', floor: 'body', note: 'a bad figure on the ground' },
  { ink: 'onFill', ground: 'badInk', floor: 'body', note: 'the Today badge' },

  { ink: 'warnInk', ground: 'warnFill', floor: 'body', note: 'caution figure on its tint' },
  { ink: 'warnInk', ground: 'warnChip', floor: 'body', note: 'a caution chip' },
  { ink: 'warnInk', ground: 'surface', floor: 'body', note: 'a caution figure on a card' },
  { ink: 'warnInk', ground: 'bg', floor: 'body', note: 'a caution figure on the ground' },

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

  // The focus ring, as a control boundary.
  { ink: 'accentInk', ground: 'surface', floor: 'ui', note: 'the focus ring' },
];

/** Two names for one value, on purpose. Anything else is a duplicate. */
export const intentionalAliases: readonly (readonly [ColorToken, ColorToken])[] = [
  // The active rail row and dark buttons take the same white as a card.
  ['onFill', 'surface'],
  // "Neutral ink" and "label ink" are the same grey doing two jobs; the
  // names stay separate so a chip and a caption can move independently.
  ['neutralInk', 'ink2'],
  // The oldest aging segment IS the accent — that is the point of it.
  ['agingOldest', 'accent'],
  // An owed card is a plain white card; its border is the ordinary hairline.
  ['owedEdge', 'hairline'],
  ['owedChip', 'rule'],
  // The Catalogue section chip wears the deep green, which is the same ink
  // that carries text on `goodChip`. One value, two jobs, both green.
  ['catalogueChipInk', 'goodInkStrong'],
  // Cash IS the informational family — the card's tint is that tint, and
  // naming it twice lets the card move without disturbing every info chip.
  ['cashFill', 'infoFill'],
];
