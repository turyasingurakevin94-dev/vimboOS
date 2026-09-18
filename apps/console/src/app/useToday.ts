/**
 * Today, from whichever books are open.
 *
 * Returns the whole read rather than the strip, because what Today could
 * not derive is as much a fact about the morning as the five cells that
 * did. `unreadable` is what the footnote under the strip says, and
 * `openMoves` is why the sub-line and the rail badge cannot disagree —
 * they are one number read twice.
 */

import { demoToday, readToday, type TodayBooks } from '@ow/data';
import { useBook, type Loaded } from './useBook.js';

export type TodayState = Loaded<TodayBooks>;

export const useToday = (): TodayState => useBook('today', readToday, demoToday);
