/**
 * The row a promise becomes.
 *
 * `recordPromise` is an RPC, an insert and two error checks. `promiseRow` is
 * where this file can be wrong — the column names, the two date formats and
 * the null amount — and none of it needs a network.
 *
 * The shape below is `payment_promises` as migration 0089 declares it, and
 * the dates are the corpus convention: `toISOString().slice(0, 10)`, which
 * the old app's `todayISO()` is and its `daysSinceDate()` parses back as,
 * deliberately and with the comment saying why.
 */

import { describe, expect, it } from 'vitest';
import { Money } from '@ow/domain';
import { promiseRow, PROMISE_ID_KIND } from './promises.js';

const SHOP = 'e8d8beaf-8c2f-4734-bf55-4c206d117037';

const record = {
  promisedOn: new Date('2026-09-25T00:00:00Z'),
  madeOn: new Date('2026-09-18T06:42:00Z'),
  amount: Money.money(1_000_000),
  note: 'said at the yard',
};

describe('a promise as a row', () => {
  it('fills every column the table requires, and no others', () => {
    expect(promiseRow(SHOP, '41', 7, record)).toEqual({
      shop_id: SHOP,
      id: 7,
      customer_id: '41',
      promised_on: '2026-09-25',
      made_on: '2026-09-18',
      amount: 1_000_000,
      note: 'said at the yard',
    });
  });

  it('writes no figure when none was named, which is what the column checks for', () => {
    // `check (amount is null or amount > 0)` — a zero here loses the row.
    const row = promiseRow(SHOP, '41', 8, { ...record, amount: null, note: null });

    expect(row.amount).toBeNull();
    expect(row.note).toBeNull();
  });

  it('dates the day in UTC, as every other dated row in these books is', () => {
    // Kampala is UTC+3, so half past midnight local is the evening before in
    // UTC. That IS the convention here: `promiseState` compares these dates
    // against `customer_debt_log.date`, which the old app writes the same
    // way, and a promise dated in local days would sort against them wrongly
    // for the first three hours of every day.
    const justAfterLocalMidnight = new Date('2026-09-17T21:30:00Z');

    expect(promiseRow(SHOP, '41', 9, { ...record, madeOn: justAfterLocalMidnight }).made_on).toBe(
      '2026-09-17',
    );
  });

  it('carries the id it was issued rather than inventing one', () => {
    // The whole hazard: the old app issues ids from the same counter and is
    // still running the shop, so this id has to be the one the database
    // handed over.
    expect(promiseRow(SHOP, '41', 4_291, record).id).toBe(4_291);
  });

  it('asks the counter for the kind 0089 seeded', () => {
    // The RPC rejects anything not matching `^row:[a-z_]+$`, and a kind with
    // no counter row would silently start its own sequence at 1 — straight
    // onto ids the old app has already written.
    expect(PROMISE_ID_KIND).toBe('row:payment_promise');
  });
});
