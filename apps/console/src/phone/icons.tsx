/**
 * The phone tab bar's marks.
 *
 * Each has a stroked and a FILLED form, and the active tab is the filled
 * one. That is deliberate and not decoration: a shape change reads at a
 * glance where a colour change alone does not — in sunlight, at arm's
 * length, and for the roughly 1 in 12 men who cannot separate the two
 * colours you were relying on.
 *
 * These are the shop's own marks, not a borrowed set. A sunrise for Today,
 * a price tag for Sell, a note with a coin for Money, a stack of sheets for
 * Stock.
 */

import type { ReactElement } from 'react';

export type TabIcon = 'today' | 'sell' | 'money' | 'stock' | 'more';

const STROKED: Record<TabIcon, ReactElement> = {
  today: (
    <>
      <path d="M3 18h18M6.5 18a5.5 5.5 0 1 1 11 0" />
      <path d="M12 3v3M4.8 7.8l2 2M19.2 7.8l-2 2" />
    </>
  ),
  sell: (
    <>
      <path d="M11.6 3.6 20 12l-8 8-8.4-8.4V3.6z" />
      <circle cx="7.6" cy="7.6" r="1.4" />
    </>
  ),
  money: (
    <>
      <path d="M5 4.5h11l3 3V21H5z" />
      <circle cx="12" cy="13" r="3" />
      <path d="M12 11.4v3.2M10.8 13h2.4" />
    </>
  ),
  stock: (
    <>
      <path d="M3 8.5 12 4l9 4.5-9 4.5z" />
      <path d="M3 13l9 4.5L21 13" />
      <path d="M3 17l9 4.5L21 17" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </>
  ),
};

const FILLED: Record<TabIcon, ReactElement> = {
  today: (
    <>
      <path d="M12 2.6v3.2M4.1 7.1l2.2 2.2M19.9 7.1l-2.2 2.2" strokeWidth={1.9} />
      <path d="M6.5 18a5.5 5.5 0 1 1 11 0z" fill="currentColor" stroke="none" />
      <path d="M2.8 18.6h18.4" strokeWidth={1.9} />
    </>
  ),
  sell: (
    <>
      <path d="M11.6 3.6 20 12l-8 8-8.4-8.4V3.6z" fill="currentColor" stroke="none" />
      <circle cx="7.6" cy="7.6" r="1.5" fill="var(--ow-color-paper)" stroke="none" />
    </>
  ),
  money: (
    <>
      <path d="M5 4.5h11l3 3V21H5z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r="3.1" fill="var(--ow-color-paper)" stroke="none" />
      <path d="M12 11.3v3.4M10.6 13h2.8" stroke="currentColor" strokeWidth={1.4} />
    </>
  ),
  stock: (
    <>
      <path d="M3 8.5 12 4l9 4.5-9 4.5z" fill="currentColor" stroke="none" />
      <path d="M3 13l9 4.5L21 13M3 17l9 4.5L21 17" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.9" fill="currentColor" stroke="none" />
    </>
  ),
};

export function TabMark({
  name,
  active,
}: {
  readonly name: TabIcon;
  readonly active: boolean;
}): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {active ? FILLED[name] : STROKED[name]}
    </svg>
  );
}

/** The one non-tab mark the phone design needs. */
export function ChevronRight(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  );
}
