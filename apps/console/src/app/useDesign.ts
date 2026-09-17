/**
 * The switch.
 *
 * This is the only place in the application that asks how wide the screen
 * is. Everything downstream of it is already inside one design or the other
 * and never needs to know the other exists.
 *
 * It listens to a media query rather than a resize event because a media
 * query fires once when the answer changes, not sixty times a second while
 * a window is dragged — and because the question being asked is genuinely
 * "which design", not "how many pixels".
 */

import { useSyncExternalStore } from 'react';
import { DESKTOP_QUERY, type Design } from '@ow/design/tokens';

const query = (): MediaQueryList | null =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? null
    : window.matchMedia(DESKTOP_QUERY);

/** No matchMedia (a server render, a test) — nothing to unsubscribe from. */
const NOTHING_TO_UNSUBSCRIBE = (): void => undefined;

const subscribe = (onChange: () => void): (() => void) => {
  const mq = query();
  if (mq === null) return NOTHING_TO_UNSUBSCRIBE;
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

const getSnapshot = (): Design => (query()?.matches === true ? 'desktop' : 'phone');

/**
 * Server render and the very first paint assume the desktop.
 *
 * Something has to be assumed before a viewport exists, and this is the one
 * place a wrong guess is cheap: it corrects on the first commit, before
 * anything is interactive. It is the desktop rather than the phone because
 * the console's own users are at a desk; a phone corrects once, immediately.
 */
const getServerSnapshot = (): Design => 'desktop';

/** Which design should render. Call this once, at the root. */
export const useDesign = (): Design =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
