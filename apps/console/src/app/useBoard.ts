/**
 * The order board, from whichever books are open.
 *
 * Returns the whole read, because the board's dock shows what could not be
 * placed as well as what could — an order at a stage this app does not know
 * is left off the lanes, and the count of those is a fact about the board.
 */

import { asksFor, readTracking } from '@ow/domain';
import { demoTrackedOrders, demoTrip, readBoard, type Board } from '@ow/data';
import { useBook, type Loaded } from './useBook.js';

export type BoardState = Loaded<Board>;

const example = (): Board => ({
  orders: demoTrackedOrders(),
  trip: demoTrip(),
  unreadable: [],
});

export const useBoard = (): BoardState => useBook('board', readBoard, example);

/**
 * How many decisions the board is holding for the owner.
 *
 * The rail's badge and the board's own queue are the same queue, so they are
 * read through the same two functions rather than counted twice. `useBook`
 * is keyed, so this reads the cache the screen already filled — it does not
 * ask the books again.
 *
 * `null`, never `0`, while the read is in flight: the rail draws no badge
 * for zero, and "nothing wants you" is the one thing it must not say while
 * it is still finding out.
 */
export const useNeedsYou = (): number | null => {
  const read = useBoard();
  return read.at === 'ready'
    ? asksFor(readTracking(read.data.orders, read.data.trip, read.today), read.today).length
    : null;
};
