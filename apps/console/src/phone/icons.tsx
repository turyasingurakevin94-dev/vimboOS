/**
 * The phone's marks — Lucide geometry at stroke-width 2, per the handoff.
 *
 * The tab bar's five each have a stroked and a FILLED form, and the active
 * tab is the filled one inside a tinted pill. A shape change reads at a
 * glance where a colour change alone does not, in sunlight and for the
 * roughly 1 in 12 men who cannot separate the two colours you relied on.
 */

import type { ReactElement } from 'react';

export type TabIcon = 'today' | 'sell' | 'money' | 'manager' | 'more';

const STROKED: Record<TabIcon, ReactElement> = {
  today: (
    <>
      <path d="M12 2v8M4.93 10.93l1.41 1.41M2 18h2M20 18h2M17.66 12.34l1.41-1.41M22 22H2M8 6l4-4 4 4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </>
  ),
  sell: (
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  money: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  manager: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  more: <path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13" />,
};

const FILLED: Record<TabIcon, ReactElement> = {
  today: (
    <>
      <path d="M12 2v8M4.93 10.93l1.41 1.41M2 18h2M20 18h2M17.66 12.34l1.41-1.41" />
      <path d="M16 18a4 4 0 0 0-8 0z" fill="currentColor" stroke="none" />
      <path d="M22 22H2" />
    </>
  ),
  sell: (
    <>
      <path
        d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="7.5" cy="7.5" r="1.4" fill="var(--ow-color-bad-chip)" stroke="none" />
    </>
  ),
  money: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" fill="currentColor" stroke="none" />
      <path d="M2 10h20" stroke="var(--ow-color-bad-chip)" />
    </>
  ),
  manager: (
    <path
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      fill="currentColor"
      stroke="none"
    />
  ),
  more: (
    <>
      <circle cx="4" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M9 12h12M9 6h12M9 18h12" />
      <circle cx="4" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.6" fill="currentColor" stroke="none" />
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
      width={19}
      height={19}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {active ? FILLED[name] : STROKED[name]}
    </svg>
  );
}

/** Small marks the phone screens need outside the tab bar. */
export function Mark({
  d,
  size = 16,
}: {
  readonly d: string;
  readonly size?: number;
}): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

export const PATH = {
  search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16M21 21l-4.3-4.3',
  message: 'M7.9 20A9 9 0 1 0 4 16.1L2 22z',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  chevron: 'm9 18 6-6-6-6',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6v6l4 2',
  box: 'm7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  up: 'M16 7h6v6M22 7l-8.5 8.5-5-5L2 17',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  layers:
    'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
  /* The quote's own marks. */
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  down: 'M16 17h6v-6M22 17l-8.5-8.5-5 5L2 7',
  dots: 'M12 12h.01M19 12h.01M5 12h.01',
  chevronDown: 'm6 9 6 6 6-6',
  /* The Messages desk's own marks. */
  back: 'm15 18-6-6 6-6',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18m0-12 12 12',
  /** A square chat bubble. `message` is the round WhatsApp one. */
  bubble: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  bubbleDots: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 10h.01M12 10h.01M16 10h.01',
  /** The shop, as the phone header's brand mark. */
  shop: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-6h6v6',
  lock: 'M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM8 10V7a4 4 0 0 1 8 0v3',
  send: 'm3 11 18-5v12L3 13zM11.6 16.8a3 3 0 1 1-5.8-1.6',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  photo: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM21 15l-5-5L5 21',
  eyeOff: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7M2 2l20 20',
  arrowDown: 'M12 19V5m-7 7 7 7 7-7',
} as const;
