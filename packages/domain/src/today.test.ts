/**
 * The strip's job is to compose other screens' reckonings, so most of what
 * is worth testing here is that it did not quietly grow one of its own —
 * and that a cell the books cannot answer says so instead of reading zero.
 */

import { describe, expect, it } from 'vitest';
import * as Money from './money.js';
import { known, unavailable } from './derived.js';
import { agingBands, read as readBook, totalOwed, type Customer } from './customers.js';
import type { PurchaseInvoice } from './invoices.js';
import type { CashPosition } from './cash.js';
import {
  DUE_SOON_DAYS,
  MARGIN_DAYS,
  readStrip,
  wantsYou,
  type MarginInput,
  type StockInput,
  type StripInputs,
} from './today.js';

const NOW = new Date('2026-09-15T07:42:00Z');
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 86_400_000);
const inDays = (n: number): Date => new Date(NOW.getTime() + n * 86_400_000);

const customer = (
  id: string,
  owes: readonly { total: number; received: number; age: number }[],
): Customer => ({
  id,
  name: `Account ${id}`,
  since: daysAgo(900),
  heldBy: null,
  phone: '0772481330',
  area: 'Nakawa',
  creditLimit: null,
  invoices: owes.map((o, i) => ({
    doc: `INV-${id}-${i}`,
    issued: daysAgo(o.age),
    total: Money.money(o.total),
    dueOn: null,
    received: Money.money(o.received),
    lastPaidOn: o.received > 0 ? daysAgo(o.age - 1) : null,
    settledOn: o.received >= o.total ? daysAgo(o.age - 1) : null,
    instalments: o.received > 0 ? 1 : 0,
  })),
  chasesSent: 0,
  chasesAnswered: 0,
  ledgerBalance: Money.money(owes.reduce((s, o) => s + (o.total - o.received), 0)),
  retentionHeld: false,
  keptTwelveMonths: null,
  soldTwelveMonths: null,
  buys: [],
  monthly: [],
});

const purchase = (o: {
  doc: string;
  supplier: string;
  total: number;
  paid: number;
  dueOn: Date | null;
}): PurchaseInvoice => ({
  kind: 'purchase',
  doc: o.doc,
  supplier: o.supplier,
  total: Money.money(o.total),
  paid: Money.money(o.paid),
  dueOn: o.dueOn,
  forSale: null,
});

const noCash: CashPosition = {
  byAccount: [],
  total: known(Money.money(8_420_000), 'three accounts'),
  accountsInUse: 2,
  misfiled: [],
};

const noStock: StockInput = {
  held: unavailable('stock lots carry no cost'),
  dead: unavailable('nothing records when a line last sold'),
  deadLines: 0,
};

const flatMargin: MarginInput = {
  kept: Money.money(4_380_000),
  sold: Money.money(23_500_000),
  linesWithoutCost: 0,
  linesCounted: 40,
};

const inputs = (over: Partial<StripInputs> = {}): StripInputs => ({
  cash: noCash,
  burn: known(Money.money(3_500_000), 'burn'),
  customers: [],
  purchases: [],
  margin: flatMargin,
  stock: noStock,
  ...over,
});

describe('what is owed to the shop is the register’s own total', () => {
  it('is the same number the Customers screen and the rail badge read', () => {
    const customers = [
      customer('a', [{ total: 2_000_000, received: 0, age: 70 }]),
      customer('b', [{ total: 1_000_000, received: 400_000, age: 10 }]),
    ];

    const strip = readStrip(inputs({ customers }), NOW);
    const book = readBook(customers, NOW);

    expect(strip.owedToYou.total.status !== 'unavailable' && strip.owedToYou.total.value).toBe(
      totalOwed(book.owing),
    );
    expect(strip.owedToYou.customers).toBe(book.owing.length);
    expect(strip.owedToYou.aging).toEqual(agingBands(book.owing, NOW));
  });

  it('calls out what has been owed past sixty days', () => {
    const customers = [customer('a', [{ total: 2_000_000, received: 0, age: 74 }])];

    const strip = readStrip(inputs({ customers }), NOW);

    expect(strip.owedToYou.overSixty.status !== 'unavailable' && strip.owedToYou.overSixty.value)
      .toBe(2_000_000);
  });
});

describe('what the shop owes out', () => {
  it('counts suppliers, not invoices', () => {
    const purchases = [
      purchase({ doc: 'PINV-1', supplier: 'Kampala Steel', total: 900_000, paid: 0, dueOn: inDays(3) }),
      purchase({ doc: 'PINV-2', supplier: 'Kampala Steel', total: 400_000, paid: 0, dueOn: inDays(3) }),
      purchase({ doc: 'PINV-3', supplier: 'Tororo Cement', total: 300_000, paid: 0, dueOn: inDays(20) }),
    ];

    const strip = readStrip(inputs({ purchases }), NOW);

    expect(strip.youOwe.suppliers).toBe(2);
    expect(strip.youOwe.total.status !== 'unavailable' && strip.youOwe.total.value).toBe(1_600_000);
  });

  it('only counts what falls inside the week', () => {
    const purchases = [
      purchase({ doc: 'PINV-1', supplier: 'A', total: 500_000, paid: 0, dueOn: inDays(DUE_SOON_DAYS - 1) }),
      purchase({ doc: 'PINV-2', supplier: 'B', total: 900_000, paid: 0, dueOn: inDays(DUE_SOON_DAYS + 5) }),
    ];

    const strip = readStrip(inputs({ purchases }), NOW);

    expect(strip.youOwe.dueThisWeek.status !== 'unavailable' && strip.youOwe.dueThisWeek.value)
      .toBe(500_000);
  });

  it('will not call a purchase with no due date "not due this week"', () => {
    const purchases = [
      purchase({ doc: 'PINV-1', supplier: 'A', total: 500_000, paid: 0, dueOn: null }),
    ];

    const strip = readStrip(inputs({ purchases }), NOW);

    expect(strip.youOwe.dueThisWeek.status).toBe('partial');
    expect(
      strip.youOwe.dueThisWeek.status === 'partial' && strip.youOwe.dueThisWeek.missing,
    ).toMatch(/1 have no due date/);
  });

  it('ignores a purchase that is already settled', () => {
    const purchases = [
      purchase({ doc: 'PINV-1', supplier: 'A', total: 500_000, paid: 500_000, dueOn: inDays(2) }),
    ];

    const strip = readStrip(inputs({ purchases }), NOW);

    expect(strip.youOwe.suppliers).toBe(0);
  });
});

describe('the margin over the week', () => {
  it('is a whole tenth of a per-cent of what was sold', () => {
    const strip = readStrip(inputs(), NOW);

    // 4,380,000 kept on 23,500,000 sold
    expect(strip.margin.percent.status !== 'unavailable' && strip.margin.percent.value).toBe(18.6);
  });

  it('is partial when a line has no buying price, and says which way it is wrong', () => {
    const margin: MarginInput = { ...flatMargin, linesWithoutCost: 3, linesCounted: 40 };

    const strip = readStrip(inputs({ margin }), NOW);

    expect(strip.margin.percent.status).toBe('partial');
    expect(strip.margin.percent.status === 'partial' && strip.margin.percent.missing).toMatch(
      /3 of 40 lines have no buying price, so the real margin is higher/,
    );
  });

  it('cannot be derived when nothing was sold — it is not 0%', () => {
    const margin: MarginInput = {
      kept: Money.ZERO,
      sold: Money.ZERO,
      linesWithoutCost: 0,
      linesCounted: 0,
    };

    const strip = readStrip(inputs({ margin }), NOW);

    expect(strip.margin.percent.status).toBe('unavailable');
    expect(strip.margin.percent.status === 'unavailable' && strip.margin.percent.reason).toMatch(
      new RegExp(`${MARGIN_DAYS} days`),
    );
  });
});

describe('the shelf', () => {
  it('says it cannot be valued rather than reading zero', () => {
    const strip = readStrip(inputs(), NOW);

    expect(strip.stock.held.status).toBe('unavailable');
    expect(strip.stock.dead.status).toBe('unavailable');
  });
});

describe('how many things want you', () => {
  it('is the open moves plus the flags that fired', () => {
    // Nothing owed, nothing owed out, a healthy margin, no shelf reading:
    // no flag can fire, so the count is the moves alone.
    expect(wantsYou(readStrip(inputs(), NOW), 3)).toBe(3);
  });

  it('counts a debt past sixty days', () => {
    const customers = [customer('a', [{ total: 2_000_000, received: 0, age: 74 }])];

    expect(wantsYou(readStrip(inputs({ customers }), NOW), 0)).toBe(1);
  });

  it('counts a margin that has gone to nothing', () => {
    const margin: MarginInput = {
      kept: Money.ZERO,
      sold: Money.money(1_000_000),
      linesWithoutCost: 0,
      linesCounted: 4,
    };

    expect(wantsYou(readStrip(inputs({ margin }), NOW), 0)).toBe(1);
  });
});
