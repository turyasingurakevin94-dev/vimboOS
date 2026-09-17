/**
 * The desktop icon set.
 *
 * 24 viewBox, no fill, stroke 1.75, round caps and joins — the skill's
 * geometry, and it is what keeps sixteen marks looking like one family
 * rather than sixteen downloads.
 *
 * The marks mean something in *this* shop. "Owed to us" is a coin going into
 * a hand, not a generic dollar sign; "Sourcing" is a magnifier over a box,
 * because sourcing here means finding who has a thing nobody stocks.
 */

import type { ReactElement, SVGProps } from 'react';

export type IconName =
  | 'sunrise'
  | 'clipboard'
  | 'tag'
  | 'people'
  | 'route'
  | 'coin-in'
  | 'truck'
  | 'invoice'
  | 'search'
  | 'boxes'
  | 'sheets'
  | 'scales'
  | 'book'
  | 'wallet'
  | 'bank'
  | 'bell'
  | 'chevron-right';

const PATHS: Record<IconName, ReactElement> = {
  // The sun coming up over the yard: today's work, not a calendar.
  sunrise: (
    <>
      <path d="M3 18h18M6.5 18a5.5 5.5 0 1 1 11 0" />
      <path d="M12 3v3M4.8 7.8l2 2M19.2 7.8l-2 2" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M15 5.5h2.5A1.5 1.5 0 0 1 19 7v12.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5V7a1.5 1.5 0 0 1 1.5-1.5H9" />
      <path d="M8.5 12h7M8.5 16h4" />
    </>
  ),
  tag: (
    <>
      <path d="M11.6 3.6 20 12l-8 8-8.4-8.4V3.6z" />
      <circle cx="7.6" cy="7.6" r="1.4" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 14.4A5.5 5.5 0 0 1 20.5 20" />
    </>
  ),
  // An agent's round: a path with stops on it.
  route: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8.2 6H14a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h5.8" />
    </>
  ),
  // A coin dropping into an open hand: money owed, coming back in.
  'coin-in': (
    <>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M12 14.5v-2" />
      <path d="M4.5 16.5a3 3 0 0 1 3-1h9a3 3 0 0 1 3 1L18 20H6z" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7.5h10.5V16H3z" />
      <path d="M13.5 10.5h3.6l2.9 3V16h-6.5z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 3h12v18l-3-1.6-3 1.6-3-1.6L6 21z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </>
  ),
  // Finding who has a thing nobody stocks: a glass over a crate.
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 21 21" />
      <path d="M8.5 11h5M11 8.5v5" />
    </>
  ),
  boxes: (
    <>
      <path d="M3 9.5h8V17H3zM13 9.5h8V17h-8z" />
      <path d="M5.5 9.5V7h3v2.5M15.5 9.5V7h3v2.5" />
    </>
  ),
  // Iron sheets on a stack — the thing this shop actually sells.
  sheets: (
    <>
      <path d="M3 8.5 12 4l9 4.5-9 4.5z" />
      <path d="M3 13l9 4.5L21 13" />
      <path d="M3 17l9 4.5L21 17" />
    </>
  ),
  scales: (
    <>
      <path d="M12 4v16M7 20h10" />
      <path d="M12 7 5 9l2.5 4.5L12 7zM12 7l7 2-2.5 4.5L12 7z" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5h9A2.5 2.5 0 0 1 16.5 7v13H7.5A2.5 2.5 0 0 1 5 17.5z" />
      <path d="M16.5 7H19v13h-2.5" />
      <path d="M8.5 9h5" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5h14A1.5 1.5 0 0 1 19.5 9v8a1.5 1.5 0 0 1-1.5 1.5H4z" />
      <path d="M4 7.5v11" />
      <circle cx="15.5" cy="13" r="1.3" />
    </>
  ),
  bank: (
    <>
      <path d="M3.5 9.5 12 4.5l8.5 5" />
      <path d="M5.5 9.5V18M10 9.5V18M14 9.5V18M18.5 9.5V18" />
      <path d="M3.5 20.5h17" />
    </>
  ),
  bell: (
    <>
      <path d="M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4-1.5 5.5-1.5 5.5h14s-1.5-1.5-1.5-5.5A5.5 5.5 0 0 0 12 4z" />
      <path d="M10.2 18a2 2 0 0 0 3.6 0" />
    </>
  ),
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  readonly name: IconName;
}

export function Icon({ name, ...rest }: IconProps): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
