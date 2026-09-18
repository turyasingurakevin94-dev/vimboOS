/**
 * The board, off rows shaped like the shop's real ones.
 *
 * Every field on a card but the stage comes out of `payload` — a jsonb blob
 * another application has been writing for years — so this is where the
 * reading can be wrong. The rows below carry the keys production actually
 * holds: `stageEnteredAt` in epoch milliseconds, `pickingStatus`,
 * `assignedWorkerId`, `assignedDeliveryId`, `pickShortfallAckAt`.
 */

import { describe, expect, it } from 'vitest';
import { Money, OWN_SHELF, match, moveFor, nextStage } from '@ow/domain';
import { assembleBoard, toTrackedOrder, tripFrom } from './tracking.js';

const row = (over: Record<string, unknown> = {}): unknown => ({
  id: 365,
  client_name: 'A99 Trade Center',
  date: '2026-09-15',
  status: 'preparing',
  invoiced: false,
  voided: false,
  payload: {
    client: { name: 'A99 Trade Center', phone: '0753572332' },
    stageEnteredAt: 1_789_684_911_260,
    items: [{ qty: 4, sellPrice: 27_500, productName: 'Iron sheets G28' }],
  },
  ...over,
});

const one = (over: Record<string, unknown> = {}) => toTrackedOrder(row(over), false).order;

describe('an order as a card', () => {
  it('reads the shop’s own stage word without translating it', () => {
    // `saved_quotes.status` already holds the lane names the domain uses. A
    // mapping layer here would be a lane nobody can name.
    expect(one()?.stage).toBe('preparing');
    expect(one({ status: 'awaiting_goods' })?.stage).toBe('awaiting_goods');
  });

  it('leaves an order off the board rather than putting it in the wrong lane', () => {
    const { order, why } = toTrackedOrder(row({ status: 'on_hold_maybe' }), false);

    // A card in the wrong lane is worse than one missing from the board:
    // somebody would work it.
    expect(order).toBeNull();
    expect(why).toContain('is not a lane');
  });

  it('ages the card from when it entered the lane, in epoch milliseconds', () => {
    // The one field in this payload that is not a date string. Falling back
    // to the order's own date would show a card that moved this morning as
    // three weeks old, so a missing one is null.
    expect(one()?.since).toEqual(new Date(1_789_684_911_260));
    expect(one({ payload: { items: [] } })?.since).toBeNull();
  });

  /**
   * A charge holds `value` and a `type`, never an `amount` — and this test
   * asserted the invented shape, so the board's worth silently dropped
   * every charge on this shop's orders while the test stayed green.
   */
  it('values the goods and what was charged to move them', () => {
    const order = one({
      payload: {
        stageEnteredAt: 1,
        items: [{ qty: 4, sellPrice: 27_500 }],
        charges: [
          { id: 1, cost: null, type: 'fixed', label: 'Transport', value: 50_000, service: 'Transport' },
        ],
      },
    });

    expect(order?.value).toMatchObject({ status: 'known', value: Money.money(160_000) });
  });

  it('takes a percent charge off the goods on the order', () => {
    const order = one({
      payload: {
        stageEnteredAt: 1,
        items: [{ qty: 4, sellPrice: 27_500 }],
        charges: [
          { id: 1, cost: null, type: 'percent', label: 'Urgent', value: 5, service: null },
        ],
      },
    });

    expect(order?.value).toMatchObject({ status: 'known', value: Money.money(115_500) });
  });

  it('says a line has no price rather than valuing it at nothing', () => {
    const order = one({
      payload: { stageEnteredAt: 1, items: [{ qty: 4, sellPrice: 27_500 }, { qty: 2 }] },
    });

    expect(order?.value.status).toBe('partial');
  });

  it('counts a short pick, and calls it settled only once acknowledged', () => {
    const short = { stageEnteredAt: 1, items: [{ qty: 10, pickedQty: 6, sellPrice: 1 }] };

    // Noticing a short pick is not deciding about it.
    expect(one({ payload: short })?.shortPick).toEqual({ asked: 10, found: 6, settled: false });
    expect(
      one({ payload: { ...short, pickShortfallAckAt: 1_789_000_000_000 } })?.shortPick?.settled,
    ).toBe(true);
  });

  it('finds nothing short when the pick found everything', () => {
    expect(one({ payload: { stageEnteredAt: 1, items: [{ qty: 4, pickedQty: 4 }] } })?.shortPick)
      .toBeNull();
  });

  it('counts bought-in lines and the ones checked in', () => {
    const order = one({
      payload: {
        stageEnteredAt: 1,
        items: [
          { qty: 1, supplierId: 'S1', supplierName: 'Kampala Steel', receivedQty: 1 },
          { qty: 1, supplierId: 'S2', supplierName: 'Tororo', receivedQty: 0 },
          { qty: 1 },
        ],
      },
    });

    expect(order?.lines).toBe(3);
    expect(order?.toBuy).toBe(2);
    expect(order?.checkedIn).toBe(1);
  });

  it('marks a supplier answered once, for the order and not per line', () => {
    const order = one({
      payload: {
        stageEnteredAt: 1,
        supplierConfirms: { S1: { at: 1 } },
        items: [
          { qty: 1, supplierId: 'S1', supplierName: 'Kampala Steel' },
          { qty: 1, supplierId: 'S2', supplierName: 'Tororo' },
        ],
      },
    });

    expect(order?.suppliers).toEqual([
      { name: 'Kampala Steel', answered: true },
      { name: 'Tororo', answered: false },
    ]);
  });

  /**
   * Order #370: two Bow Saw Blades taken off our own shelf, and nothing
   * else on it. `__stock__` is written into `supplierId` exactly like a
   * supplier's id, so every count here took our own store for a supplier —
   * and the card read `Cannot move yet — Our stock has not answered`.
   */
  it('never asks our own shelf to answer, and never counts it as bought in', () => {
    const shelf = one({
      status: 'draft',
      payload: {
        stageEnteredAt: 1,
        items: [
          { qty: 2, sellPrice: 10_800, supplierId: '__stock__', supplierName: 'Our stock' },
        ],
      },
    });

    expect(shelf?.suppliers).toEqual([]);
    expect(shelf?.toBuy).toBe(0);
    // Nothing to wait for, so nothing holds it: it moves, and it skips
    // Buying, which has nothing to unlock it either.
    expect(shelf && moveFor(shelf).control).toBe('chevron');
    expect(shelf && nextStage(shelf)).toBe('preparing');
  });

  it('waits on the supplier lines of a mixed order, and only those', () => {
    const mixed = one({
      status: 'draft',
      payload: {
        stageEnteredAt: 1,
        items: [
          { qty: 2, supplierId: OWN_SHELF, supplierName: 'Our stock' },
          { qty: 1, supplierId: 'S012', supplierName: 'Shafik Katwe' },
        ],
      },
    });

    expect(mixed?.suppliers).toEqual([{ name: 'Shafik Katwe', answered: false }]);
    expect(mixed?.toBuy).toBe(1);
    expect(mixed && moveFor(mixed).why).toBe('Cannot move yet — Shafik Katwe has not answered');
  });

  it('carries the picker, the run and the invoice number', () => {
    const order = toTrackedOrder(
      row({
        invoiced: true,
        payload: {
          stageEnteredAt: 1,
          items: [{ qty: 1, sellPrice: 1 }],
          pickingStatus: 'done',
          assignedWorkerId: 'W3',
          assignedDeliveryId: 'ST047',
        },
      }),
      true,
    ).order;

    expect(order?.packed).toBe(true);
    expect(order?.picker).toBe('W3');
    expect(order?.run).toBe('ST047');
    expect(order?.invoice).toBe('INV-0365');
  });

  it('names a counter sale rather than leaving the card nameless', () => {
    expect(one({ client_name: null, payload: { stageEnteredAt: 1, items: [] } })?.customer).toBe(
      'Counter sale',
    );
  });
});

describe('the board', () => {
  it('leaves a cancelled order off it entirely, and says nothing about it', () => {
    // A cancelled order sitting in a lane is somebody's wasted morning.
    const board = assembleBoard([row(), row({ id: 9, voided: true })]);

    expect(board.orders).toHaveLength(1);
    expect(board.unreadable).toEqual([]);
  });

  it('names the ones it could not place', () => {
    const board = assembleBoard([row(), row({ id: 9, status: 'who_knows' })]);

    expect(board.orders).toHaveLength(1);
    expect(board.unreadable[0]).toContain('#9');
  });
});

describe('the trip behind the lanes', () => {
  const toFetch = (over: Record<string, unknown> = {}): unknown =>
    row({
      status: 'awaiting_goods',
      payload: {
        stageEnteredAt: 1_786_253_866_337,
        items: [
          { qty: 2, price: 45_000, supplierId: 'S094', supplierName: 'Roto Industry' },
          { qty: 1, price: 30_000, supplierId: 'S012', supplierName: 'Shafik Katwe' },
        ],
      },
      ...over,
    });

  it('carries the buying price of what is not in yet, and names the stops', () => {
    const trip = tripFrom([toFetch()]);

    expect(trip.stops).toBe(2);
    expect(trip.route).toBe('Roto Industry, then Shafik Katwe');
    expect(match(trip.carry, { known: (m) => m, partial: () => null, unavailable: () => null })).toEqual(
      Money.money(120_000),
    );
  });

  /**
   * This shop flags orders invoiced while they are still in Buying — #148
   * is one, and the dock read `Nothing to fetch · 0 stops · carry 0` beside
   * a card reading `0 of 2 bought-in lines are in`.
   */
  it('still fetches for an order the books have flagged invoiced', () => {
    expect(tripFrom([toFetch({ invoiced: true })]).stops).toBe(2);
  });

  it('fetches nothing for an order already handed over, or cancelled', () => {
    expect(tripFrom([toFetch({ status: 'completed' })]).stops).toBe(0);
    expect(tripFrom([toFetch({ voided: true })]).stops).toBe(0);
    expect(tripFrom([toFetch({ status: 'who_knows' })]).stops).toBe(0);
    expect(tripFrom([toFetch({ status: 'completed' })]).route).toBe('Nothing to fetch');
  });

  /** Our own store is not a stop, and the buyer carries no cash to it. */
  it('plans no stop at our own shelf', () => {
    const shelf = toFetch({
      payload: {
        stageEnteredAt: 1_786_253_866_337,
        items: [
          { qty: 2, price: 9_800, supplierId: OWN_SHELF, supplierName: 'Our stock' },
          { qty: 1, price: 30_000, supplierId: 'S012', supplierName: 'Shafik Katwe' },
        ],
      },
    });
    const trip = tripFrom([shelf]);

    expect(trip.stops).toBe(1);
    expect(trip.route).toBe('Shafik Katwe');
    expect(match(trip.carry, { known: (m) => m, partial: () => null, unavailable: () => null })).toEqual(
      Money.money(30_000),
    );
  });

  it('skips a line already received — it needs no stop and costs nothing', () => {
    const arrived = toFetch({
      payload: {
        stageEnteredAt: 1_786_253_866_337,
        items: [
          { qty: 2, price: 45_000, receivedQty: 2, supplierId: 'S094', supplierName: 'Roto' },
          { qty: 1, price: 30_000, supplierId: 'S012', supplierName: 'Shafik Katwe' },
        ],
      },
    });
    const trip = tripFrom([arrived]);

    expect(trip.stops).toBe(1);
    expect(match(trip.carry, { known: (m) => m, partial: () => null, unavailable: () => null })).toEqual(
      Money.money(30_000),
    );
  });

  it('says how many lines it is blind to rather than rounding them to nothing', () => {
    const blind = toFetch({
      payload: {
        stageEnteredAt: 1_786_253_866_337,
        items: [{ qty: 2, supplierId: 'S094', supplierName: 'Roto Industry' }],
      },
    });

    expect(
      match(tripFrom([blind]).carry, {
        known: () => 'known',
        partial: (_m, _b, gap) => gap,
        unavailable: () => 'unavailable',
      }),
    ).toBe('1 line has no buying price');
  });
});
