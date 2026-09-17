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
 */
export const SWITCH_PX = 900;

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
    pageTitleSize: '20px',
    /** A table row. Dense enough to see twenty at once. */
    rowHeight: '40px',
    rowPaddingY: '10px',
    rowPaddingX: '12px',
    /** The page's own outer padding. */
    pagePadding: '24px',
    /** The dark left rail. */
    railWidth: '232px',
    railCollapsedWidth: '64px',
    topBarHeight: '56px',
    /** The right-hand context column. Insights live here, beside the work. */
    contextWidth: '320px',
    /** A pointer needs far less than a thumb. */
    tapTarget: '32px',
    maxContentWidth: '1600px',
  },
  phone: {
    /** Held in one hand, outdoors, in daylight, while doing something else. */
    bodySize: '15px',
    metaSize: '13px',
    pageTitleSize: '22px',
    /** A card, not a row. Actions visible without opening anything. */
    rowHeight: 'auto',
    rowPaddingY: '14px',
    rowPaddingX: '16px',
    pagePadding: '16px',
    /** No rail. A top bar and a bottom tab bar. */
    topBarHeight: '52px',
    tabBarHeight: '60px',
    /** The thumb. Never smaller, whatever the design looks like at rest. */
    tapTarget: '44px',
    /** The bottom third of the screen, where a thumb reaches comfortably. */
    thumbZone: '33vh',
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
    desktop: 'a persistent dark rail, collapsible, with counts and favourites',
    phone: 'a five-item bottom tab bar; everything else lives under More',
  },
  aQueue: {
    desktop: 'a dense table; 40px rows; expand in place; bulk select; sticky header',
    phone: 'cards; the two actions that matter are on the card; no bulk anything',
  },
  metrics: {
    desktop: 'one horizontal strip across the top, hairline dividers, no per-tile borders',
    phone: 'a 2×2 block in a single card',
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
