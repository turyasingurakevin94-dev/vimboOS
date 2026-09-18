/**
 * The order board, from whichever books are open.
 *
 * Returns the whole read, because the board's dock shows what could not be
 * placed as well as what could — an order at a stage this app does not know
 * is left off the lanes, and the count of those is a fact about the board.
 */

import { demoTrackedOrders, demoTrip, readBoard, type Board } from '@ow/data';
import { useBook, type Loaded } from './useBook.js';

export type BoardState = Loaded<Board>;

const example = (): Board => ({
  orders: demoTrackedOrders(),
  trip: demoTrip(),
  unreadable: [],
});

export const useBoard = (): BoardState => useBook('board', readBoard, example);
