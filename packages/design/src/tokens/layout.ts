/**
 * Space, radius, elevation — from the Today handoff.
 *
 * The space scale is every integer from 2 to 16, then the even numbers to
 * 24. It is not a 4px grid, and an earlier version of this system enforced
 * one; the design uses 3, 5, 7, 9, 11, 13 and 15 freely and the mockup is
 * the design, so the grid rule is replaced by an allowlist. That is stricter
 * anyway — a grid would have allowed 28.
 *
 * 15 is here because the design file's section heading is `padding:15px 10px
 * 4px`; the README's scale omits it. The markup wins.
 */

export const space = {
  /** A hairline nudge — the 1px that separates two rail rows. */
  1: '1px',
  2: '2px',
  3: '3px',
  4: '4px',
  5: '5px',
  6: '6px',
  7: '7px',
  8: '8px',
  9: '9px',
  10: '10px',
  11: '11px',
  12: '12px',
  13: '13px',
  14: '14px',
  15: '15px',
  16: '16px',
  18: '18px',
  20: '20px',
  22: '22px',
  24: '24px',
  /** The gap between the cells of the Order-tracking dock. */
  26: '26px',
  /** The gutter of the mockup board, and a dialog's outer padding. */
  30: '30px',
} as const;

/** Each radius names what wears it, because that is how it stays consistent. */
export const radius = {
  /**
   * A meter segment: 8 × 4px, with its corners just taken off. Square would
   * read as a tick in a scale; anything rounder would read as a pill, and
   * the six of them in a row are neither — they are a count.
   */
  meterSeg: '1px',
  /**
   * A bar inside a row, 9px tall — the waterfall on the agent panel. At this
   * height anything rounder is a lozenge; this is a bar with its corners
   * taken off.
   */
  barWaterfall: '2px',
  /**
   * A bar in a small inline series — the five months on the customer panel.
   * Not `barTop`: the shortest of those bars is 5px tall, and a 4px radius on
   * a 5px bar is a lozenge rather than a bar.
   */
  barSmall: '3px',
  /** The tail corner of a chat bubble — the one corner that is not a corner. */
  bubbleTail: '3px',
  /** The top of a bar in a chart. Flat foot, rounded head. */
  barTop: '4px',
  /** A tick box at 15px square, which is how Messages draws one. */
  checkbox: '4px',
  /**
   * A 20px tile holding a 12px mark: the four-glyph legend in the
   * Order-tracking page head. A hair rounder than a bar and a hair squarer
   * than a section chip, because it is read as a specimen of a control
   * rather than as a control or a label.
   *
   * The same five pixels as `checkboxLarge`, and a separate name for the
   * same reason `barSmall` and `bubbleTail` are both three: a radius is
   * named after what wears it, and a legend specimen and a tick box are not
   * one part that happens to be drawn twice.
   */
  glyph: '5px',
  /**
   * A tick box that is bigger, and rounder with it: the phone's 17px box,
   * and the 16px one the Agents settlement table draws on both designs.
   *
   * It was `checkboxPhone` until Agents arrived drawing the same 5px on a
   * desktop dialog. The name says what wears it — a larger box — because a
   * name that says which DESIGN wears it stops being true the moment the
   * other design draws the same thing.
   */
  checkboxLarge: '5px',
  /** A square chip — the rail's section abbreviations. */
  chipSquare: '6px',
  /** An inner segment: a ghost number field, a dashed placeholder square,
   * and the phone's small brand mark. */
  segment: '7px',
  /** An icon chip. */
  iconChip: '8px',
  /** A button, and a rail row. */
  button: '9px',
  /** A field. */
  field: '10px',
  /** An inner tile inside a card. */
  tile: '11px',
  /** A bordered block inside a card: a selectable option row, a notice. */
  block: '12px',
  /** A card. */
  card: '14px',
  /** A dialog panel, sitting inside the 18px frame. */
  sheet: '16px',
  /** The frame the whole app sits in. */
  frame: '18px',
  pill: '999px',
} as const;

export const elevation = {
  /** A card. Barely there, and that is the point. */
  card: '0 1px 2px rgba(23, 34, 60, 0.05)',
  /**
   * A white pill lifted off a tinted trough — the active lens, and only it.
   * A hair stronger than `card`, because a card is lifted off white paper
   * and this is lifted off a ground that is already darker than it.
   */
  lens: '0 1px 2px rgba(23, 34, 60, 0.08)',
  /** Something genuinely floating: a menu, the phone sheet, a toast. */
  floating: '0 18px 40px rgba(23, 34, 60, 0.16)',
  /**
   * A sheet rising from the bottom of the phone. It throws its shadow UP,
   * onto the screen it covers — the same light, from the other side.
   */
  sheet: '0 -10px 30px rgba(23, 34, 60, 0.22)',
} as const;

/** Chrome dimensions, named. */
export const chrome = {
  railWidth: '236px',
  topBarHeight: '58px',
  insightRailWidth: '326px',
  phoneTabBarHeight: '56px',
  /** The phone header, including its figure strip. */
  phoneHeaderHeight: '120px',
  /** The phone's minimum tap target, and it is a floor not a target. */
  tap: '44px',
} as const;

/** The scrim behind a sheet. */
export const scrim = 'rgba(23, 34, 60, 0.45)';

/**
 * The focus ring. 2px accent at 2px offset, on every interactive element —
 * never the browser default, and never removed. It is the whole of keyboard
 * navigation for someone who lives in this app all day.
 */
export const focusRing = {
  width: '2px',
  offset: '2px',
} as const;

export const motion = {
  instant: '80ms',
  fast: '140ms',
  base: '200ms',
  enter: '260ms',
  ease: 'cubic-bezier(0.2, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
} as const;

/** Named, because a hand-picked 9999 is how a toast ends up under a dialog. */
export const layer = {
  base: 0,
  sticky: 10,
  rail: 20,
  dropdown: 30,
  scrim: 40,
  modal: 50,
  toast: 60,
} as const;
