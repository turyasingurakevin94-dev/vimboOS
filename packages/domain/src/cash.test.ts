/**
 * The two bugs this module inherits a fix for are the first two cases here.
 * They are not hypothetical: both shipped in the app that is running the
 * shop, and both were found by somebody noticing a figure was wrong.
 */

import { describe, expect, it } from 'vitest';
import * as Money from './money.js';
import {
  ACCOUNTS,
  BURN_WINDOW_DAYS,
  anchorFor,
  balanceOf,
  cashOnHand,
  isUnclassified,
  monthlyBurn,
  monthsOfCover,
  type CashDay,
  type CashTxn,
} from './cash.js';

const txn = (o: Omit<Partial<CashTxn>, 'amount'> & { on: string; amount: number }): CashTxn => ({
  id: `t-${o.on}-${o.amount}`,
  account: 'cash',
  type: 'receipt',
  category: null,
  ...o,
  amount: Money.money(o.amount),
});

const opened = (on: string, amounts: Record<string, number>): CashDay => ({
  on,
  opening: amounts,
  actual: null,
  openingSet: true,
});

const counted = (on: string, amounts: Record<string, number>): CashDay => ({
  on,
  opening: null,
  actual: amounts,
  openingSet: false,
});

describe('a position, not a movement', () => {
  it('carries the opening balance — the drawer bug', () => {
    // A book opened with 1,000,000 that then takes 100,000 and pays 30,000
    // holds 1,070,000. Summing the txns alone reports 70,000, which is what
    // the old app did.
    const days = [opened('2026-09-01', { cash: 1_000_000 })];
    const txns = [
      txn({ on: '2026-09-01', amount: 100_000, type: 'receipt' }),
      txn({ on: '2026-09-01', amount: 30_000, type: 'payment' }),
    ];

    const held = balanceOf('cash', '2026-09-04', txns, days);

    expect(held.status).toBe('known');
    expect(held.status !== 'unavailable' && held.value).toBe(1_070_000);
  });

  it('says a bare movement total is not the position', () => {
    // No opening and no count anywhere. The figure is real and it is not an
    // answer to "how much is in the drawer", so it must not claim to be.
    const held = balanceOf('cash', '2026-09-04', [txn({ on: '2026-09-02', amount: 70_000 })], []);

    expect(held.status).toBe('partial');
    expect(held.status === 'partial' && held.missing).toMatch(/no opening balance or count/);
  });

  it('anchors on a count from an earlier day, exclusive of that day', () => {
    const days = [counted('2026-09-03', { cash: 500_000 })];
    const txns = [
      // On the counted day itself — already inside the counted figure.
      txn({ on: '2026-09-03', amount: 900_000 }),
      txn({ on: '2026-09-04', amount: 20_000 }),
    ];

    const held = balanceOf('cash', '2026-09-05', txns, days);

    expect(held.status !== 'unavailable' && held.value).toBe(520_000);
  });

  it('anchors on a set opening, inclusive of that day', () => {
    const days = [opened('2026-09-03', { cash: 500_000 })];
    const txns = [txn({ on: '2026-09-03', amount: 20_000 })];

    const held = balanceOf('cash', '2026-09-03', txns, days);

    expect(held.status !== 'unavailable' && held.value).toBe(520_000);
  });

  it('never anchors on the day being asked about', () => {
    // Today's count is a correction, not the position. Anchoring on it
    // would also make the reconciliation compare a number with itself.
    const days = [counted('2026-09-05', { cash: 999_999 })];

    const anchor = anchorFor('cash', '2026-09-05', days);

    expect(anchor).toBeNull();
  });

  it('prefers the most recent anchor when there are several', () => {
    const days = [
      opened('2026-09-01', { cash: 100_000 }),
      counted('2026-09-03', { cash: 400_000 }),
    ];

    const anchor = anchorFor('cash', '2026-09-06', days);

    expect(anchor?.from).toBe('2026-09-03');
    expect(anchor?.kind).toBe('count');
  });
});

describe('a row that is neither in nor out', () => {
  it('is not netted to nothing', () => {
    expect(isUnclassified(txn({ on: '2026-09-02', amount: 1, type: 'transfer' }))).toBe(true);
  });

  it('makes the balance partial and says how many', () => {
    const days = [opened('2026-09-01', { cash: 10_000 })];
    const txns = [txn({ on: '2026-09-02', amount: 5_000, type: 'mystery' })];

    const held = balanceOf('cash', '2026-09-03', txns, days);

    expect(held.status).toBe('partial');
    expect(held.status === 'partial' && held.missing).toMatch(/1 movements are neither/);
  });
});

describe('the whole position', () => {
  it('adds the three accounts and counts only those holding money', () => {
    const days = [opened('2026-09-01', { cash: 100_000, momo: 50_000, bank: 0 })];
    const position = cashOnHand('2026-09-02', [], days);

    expect(position.total.status !== 'unavailable' && position.total.value).toBe(150_000);
    expect(position.accountsInUse).toBe(2);
    expect(position.byAccount.map((a) => a.key)).toEqual(ACCOUNTS.map((a) => a.key));
  });

  it('surfaces a row filed under an account the shop does not have', () => {
    // 'MTN MoMo' as an account key was a real defect: every total filters on
    // an exact key, so the row was invisible everywhere while still showing
    // in the day's list, which is what made it look recorded.
    const position = cashOnHand(
      '2026-09-02',
      [txn({ on: '2026-09-02', amount: 10_000, account: 'MTN MoMo' })],
      [opened('2026-09-01', { cash: 0 })],
    );

    expect(position.misfiled).toEqual(['MTN MoMo']);
  });

  it('is partial overall when one account is only a movement', () => {
    const days = [opened('2026-09-01', { cash: 100_000 })];
    const txns = [txn({ on: '2026-09-02', amount: 7_000, account: 'momo' })];

    const position = cashOnHand('2026-09-03', txns, days);

    expect(position.total.status).toBe('partial');
  });
});

describe('the burn, and the cover it feeds', () => {
  it('divides by the history that exists, not a flat three months', () => {
    // The ten-day-old shop: 300,000 paid out over 10 days is 900,000 a
    // month, not 100,000. The old app reported 3.0 months of cover where
    // there were 0.3.
    const asOf = new Date('2026-09-10T00:00:00Z');
    const txns = [
      txn({ on: '2026-09-01', amount: 150_000, type: 'payment' }),
      txn({ on: '2026-09-10', amount: 150_000, type: 'payment' }),
    ];

    const burn = monthlyBurn(asOf, txns);

    expect(burn.status).toBe('known');
    // 300,000 over a 10-day span → 300,000 / (10/30) = 900,000
    expect(burn.status !== 'unavailable' && burn.value).toBe(900_000);
  });

  it('measures the span from the first movement, not the first payment', () => {
    // A shop that took money for three weeks before spending any has three
    // weeks of history. Dating from the first payment would shorten the
    // span and report an enormous burn.
    const asOf = new Date('2026-09-30T00:00:00Z');
    const txns = [
      txn({ on: '2026-09-01', amount: 500_000, type: 'receipt' }),
      txn({ on: '2026-09-30', amount: 300_000, type: 'payment' }),
    ];

    const burn = monthlyBurn(asOf, txns);

    // 30 days of history, not 1.
    expect(burn.status !== 'unavailable' && burn.value).toBe(300_000);
  });

  it('cannot derive a burn with nothing paid out', () => {
    const burn = monthlyBurn(new Date('2026-09-10T00:00:00Z'), [
      txn({ on: '2026-09-09', amount: 10_000, type: 'receipt' }),
    ]);

    expect(burn.status).toBe('unavailable');
    expect(burn.status === 'unavailable' && burn.reason).toMatch(/nothing was paid out/);
  });

  it('ignores movements older than the window', () => {
    const asOf = new Date('2026-09-30T00:00:00Z');
    const old = txn({ on: '2026-01-01', amount: 9_000_000, type: 'payment' });

    expect(monthlyBurn(asOf, [old]).status).toBe('unavailable');
    expect(BURN_WINDOW_DAYS).toBe(90);
  });

  it('gives no cover when nothing has been spent — not "forever"', () => {
    const cover = monthsOfCover(
      { status: 'known', value: Money.money(1_000_000), basis: 'held' },
      { status: 'known', value: Money.ZERO, basis: 'burn' },
    );

    expect(cover.status).toBe('unavailable');
  });

  it('carries doubt from either input into the cover', () => {
    const cover = monthsOfCover(
      { status: 'partial', value: Money.money(900_000), basis: 'held', missing: 'the bank' },
      { status: 'known', value: Money.money(300_000), basis: 'burn' },
    );

    expect(cover.status).toBe('partial');
    expect(cover.status === 'partial' && cover.value).toBe(3);
    expect(cover.status === 'partial' && cover.missing).toBe('the bank');
  });
});
