/**
 * The two-designs law.
 *
 * **The desktop is a dense work console. The phone is its own application.
 * The switch between them is a switch between two designs, not a reflow of
 * one.**
 *
 * This is the rule the owner set, in their own words: *"wanting to fit both
 * on phone and desktop have made you design a very boring desktop app… let
 * it be slightly dense and professional."* A layout that serves both serves
 * neither. The desktop gets the density of something you sit in front of for
 * hours; the phone gets thumb-sized targets and one thing at a time, in a
 * yard, in daylight, one-handed.
 *
 * In this codebase that is not a convention. `apps/console/src/desktop` and
 * `apps/console/src/phone` are separate component trees that share the
 * domain and the data layer and nothing else, the switch happens once at the
 * root, and a lint rule forbids either from importing the other. You cannot
 * accidentally write a responsive compromise, because there is no file that
 * both designs render from.
 *
 * Tablet and laptop belong to the DESKTOP design — they are a mouse, a
 * keyboard and a wide screen, which is what that design is for. There is no
 * third design and no in-between.
 */

export const DESIGNS = ['desktop', 'phone'] as const;
export type Design = (typeof DESIGNS)[number];

/**
 * The switch point.
 *
 * Below this the phone design renders; at or above it, the desktop design.
 * One number, one place. It is not a breakpoint in a stylesheet — nothing
 * reflows at it, a different application renders.
 *
 * 820, from the Today handoff, which inherits it from the previous design
 * system. It had been 900 here; the handoff is the design and it says 820.
 */
export const SWITCH_PX = 820;

/** Which design a viewport width gets. The only place this is decided. */
export const designFor = (viewportWidth: number): Design =>
  viewportWidth >= SWITCH_PX ? 'desktop' : 'phone';

/** The media query the root switch listens to. */
export const DESKTOP_QUERY = `(min-width: ${SWITCH_PX}px)`;

/**
 * What each design is made of.
 *
 * These are not two columns of the same table that happen to differ. They
 * are the specifications of two products. Read the one you are building and
 * ignore the other.
 */
export const metrics = {
  desktop: {
    /** Sat in front of, for hours, with a mouse and a keyboard. */
    bodySize: '13px',
    metaSize: '11px',
    pageTitleSize: '24px',
    /** A watch row. */
    rowPaddingY: '12px',
    rowPaddingX: '14px',
    /** The scrolling body's own padding: 20 top, 22 sides, 24 bottom. */
    pagePaddingTop: '20px',
    pagePaddingX: '22px',
    pagePaddingBottom: '24px',
    /** The dark left rail. */
    railWidth: '236px',
    topBarHeight: '58px',
    /** The right-hand insight rail. */
    insightRailWidth: '326px',
    /** A pointer needs far less than a thumb. */
    tapTarget: '34px',
    /** The design is drawn at this width. */
    drawnAt: '1440px',
  },
  phone: {
    /** Held in one hand, outdoors, in daylight, while doing something else. */
    bodySize: '13px',
    metaSize: '11px',
    pageTitleSize: '14px',
    /** Compact by explicit request: the same content, less air. */
    rowPaddingY: '8px',
    rowPaddingX: '11px',
    pagePadding: '10px',
    /** No rail. A navy header carrying a figure strip, and a tab bar. */
    headerHeight: '120px',
    tabBarHeight: '56px',
    /** The thumb. A floor, never a target. */
    tapTarget: '44px',
    /** The design is drawn at this width. */
    drawnAt: '390px',
  },
} as const;

/**
 * How each design does the same job differently.
 *
 * This table is the argument for the law. Every row is one job the app has
 * to do, and the two answers are not variations of each other — they are
 * different designs, and neither would be improved by meeting in the middle.
 */
export const HOW_EACH_DESIGN_WORKS = {
  navigation: {
    desktop: 'a 236px dark rail carrying the complete destination map, in sections',
    phone: 'a 56px tab bar of five; the More sheet is generated from the rail',
  },
  aQueue: {
    desktop: 'numbered move cards, then the watch beneath as denser rows',
    phone: 'compact move cards; the worth as an inline chip, not a block',
  },
  metrics: {
    desktop: 'five tinted cards across the top, each with its basis line',
    phone: 'one 4-across figure strip inside the navy header, abbreviated',
  },
  context: {
    desktop: 'a 320px right-hand column, always visible beside the work',
    phone: 'below the work, or behind a sheet — never beside it',
  },
  anAction: {
    desktop: 'a button in the page header, plus a keyboard shortcut',
    phone: 'a full-width button in the thumb zone',
  },
  detail: {
    desktop: 'a slide-over panel; the list stays on screen behind it',
    phone: 'a full screen push; the list is gone until you come back',
  },
  editing: {
    desktop: 'inline in the table — click the cell, type, tab to the next',
    phone: 'a dedicated form screen; inline editing in a card is a mis-tap waiting to happen',
  },
} as const satisfies Record<string, Record<Design, string>>;
