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
import type { CashPosition, CashTxn } from './cash.js';
import {
  DUE_SOON_DAYS,
  MARGIN_DAYS,
  readStrip,
  shelfValue,
  wantsYou,
  type MarginInput,
  type StockInput,
  type ShelfLine,
  type StockLot,
  profitByProduct,
  soldByWeek,
  yesterday,
  type SoldLine,
  type StripInputs,
  weekStart,
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
  promises: [],
  payments: [],
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
  shelf: shelfValue([]),
  dead: unavailable('nothing here records when a line last sold'),
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
  const line = (key: string, onShelf: number, lots: readonly StockLot[]): ShelfLine => ({
    key,
    onShelf,
    lots,
  });

  it('values what is ON the shelf, not everything ever bought', () => {
    // The lots record two purchases of 10 at 1,000. Only 4 are still there.
    // Summing the lots says 20,000; the shelf is worth 4,000.
    const shelf = shelfValue([
      line('a', 4, [
        { qty: 10, cost: 1_000, consign: null },
        { qty: 10, cost: 1_000, consign: null },
      ]),
    ]);

    expect(shelf.ours.status !== 'unavailable' && shelf.ours.value).toBe(4_000);
  });

  it('prices at the weighted average of the costed lots', () => {
    // 10 bought at 1,000 and 10 at 2,000 is 1,500 a unit; 6 on the shelf.
    const shelf = shelfValue([
      line('a', 6, [
        { qty: 10, cost: 1_000, consign: null },
        { qty: 10, cost: 2_000, consign: null },
      ]),
    ]);

    expect(shelf.ours.status !== 'unavailable' && shelf.ours.value).toBe(9_000);
  });

  it('takes a consignor’s units out of what the shop owns', () => {
    // 10 on the shelf, 3 of them somebody else's. The shop owns 7.
    const shelf = shelfValue([
      line('a', 10, [
        { qty: 10, cost: 1_000, consign: null },
        { qty: 3, cost: 5_000, consign: 'Kampala Steel' },
      ]),
    ]);

    expect(shelf.ours.status !== 'unavailable' && shelf.ours.value).toBe(7_000);
    expect(shelf.heldForOthers.status !== 'unavailable' && shelf.heldForOthers.value).toBe(15_000);
  });

  it('counts a surplus the lots cannot explain, and does not value it at zero', () => {
    // 10 on the shelf, lots account for 4. Six units have no cost behind
    // them: valuing them at zero would understate the shelf silently.
    const shelf = shelfValue([line('a', 10, [{ qty: 4, cost: 1_000, consign: null }])]);

    expect(shelf.ours.status).toBe('partial');
    expect(shelf.ours.status === 'partial' && shelf.ours.value).toBe(4_000);
    expect(shelf.ours.status === 'partial' && shelf.ours.missing).toMatch(/6 units/);
    expect(shelf.uncostedUnits).toBe(6);
  });

  it('skips a line with an empty shelf', () => {
    // 434 of this shop's 485 lines have nothing on them.
    const shelf = shelfValue([
      line('a', 0, [{ qty: 10, cost: 1_000, consign: null }]),
      line('b', 2, [{ qty: 2, cost: 500, consign: null }]),
    ]);

    expect(shelf.linesOnShelf).toBe(1);
    expect(shelf.ours.status !== 'unavailable' && shelf.ours.value).toBe(1_000);
  });

  it('is worth nothing, knowably, when the shelf is entirely a consignor’s', () => {
    const shelf = shelfValue([
      line('a', 3, [{ qty: 3, cost: 5_000, consign: 'Kampala Steel' }]),
    ]);

    expect(shelf.ours.status).toBe('known');
    expect(shelf.ours.status !== 'unavailable' && shelf.ours.value).toBe(0);
  });

  it('rounds once on the total, not per line', () => {
    // A weighted unit cost is fractional by nature. Rounding each line
    // first drifts from the figure the shop reads on its own screen.
    // Each line's weighted unit cost is 3,001/3 = 1,000.333…, one unit on
    // the shelf. Three of them come to 3,001; rounding each line to 1,000
    // first would report 3,000 and quietly lose a shilling a line.
    const lots = [
      { qty: 2, cost: 1_000, consign: null },
      { qty: 1, cost: 1_001, consign: null },
    ];
    const shelf = shelfValue([line('a', 1, lots), line('b', 1, lots), line('c', 1, lots)]);

    expect(shelf.ours.status !== 'unavailable' && shelf.ours.value).toBe(3_001);
  });

  it('still says the dead-stock figure cannot be derived yet', () => {
    // Nothing fetched here records when a line last SOLD, and a restock or
    // a count is not a sale. Reading zero would say the shelf is all moving.
    expect(readStrip(inputs(), NOW).stock.dead.status).toBe('unavailable');
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

/**
 * Sold by week — and the handoff's own sentence, checked.
 *
 * The panel's prose reads "the last four weeks are the best run of the
 * twelve — 71, 68 and 82 against a 12-week median of 55". Three things are
 * wrong with that at once: it says four and names three, the numbers it
 * names are the bars' CSS heights rather than figures, and the median of
 * the array it is describing is not 55. All three are pinned below.
 */
describe('sold by week', () => {
  const MONDAY = new Date('2026-09-14T00:00:00Z');
  const WEEK = 7 * 86_400_000;

  /** One invoice in the week that opened `back` weeks before this one. */
  const sale = (back: number, total: number, voided = false): Parameters<typeof soldByWeek>[0][number] => ({
    issued: new Date(MONDAY.getTime() - back * WEEK + 2 * 86_400_000),
    total: Money.money(total),
    ...(voided ? { voided: { on: NOW, replacedBy: null } } : {}),
  });

  /** The handoff's own twelve numbers, oldest first, scaled to shillings. */
  const HANDOFF = [38, 44, 41, 52, 47, 58, 55, 63, 60, 71, 68, 82];
  const handoffWeeks = (): Parameters<typeof soldByWeek>[0] =>
    HANDOFF.map((n, i) => sale(HANDOFF.length - 1 - i, n * 1_000));

  it('opens each week on a Monday', () => {
    // Wednesday 16 September 2026 belongs to the week of Monday the 14th.
    expect(weekStart(new Date('2026-09-16T23:00:00Z'))).toEqual(MONDAY);
    // And a Sunday belongs to the week that opened six days earlier, not
    // to the one starting tomorrow.
    expect(weekStart(new Date('2026-09-20T12:00:00Z'))).toEqual(MONDAY);
  });

  it('puts the median of the handoff’s own array at 56,500, not 55,000', () => {
    const sold = soldByWeek(handoffWeeks(), NOW);

    // Twelve values, all non-zero, so the median is the mean of the 6th and
    // 7th of the sorted run: (55 + 58) / 2 = 56.5.
    expect(sold.median).toBe(Money.money(56_500));
    expect(sold.median).not.toBe(Money.money(55_000));
    expect(sold.tradedWeeks).toBe(12);
  });

  // The same fix `monthlyBurn` carries. A young shop's leading zeros are
  // weeks it did not exist, and averaging over them halves the median, so a
  // week barely above nothing reads as "above the median".
  it('takes the median over the weeks traded, not the weeks drawn', () => {
    const sold = soldByWeek([sale(2, 3_000_000), sale(1, 1_000_000), sale(0, 2_000_000)], NOW);

    expect(sold.tradedWeeks).toBe(3);
    // The median of 3m, 1m, 2m — not of those plus nine zeros, which would
    // have put it at zero and called every trading week a good one.
    expect(sold.median).toBe(Money.money(2_000_000));
    expect(sold.weeks).toHaveLength(12);
  });

  it('counts the run of above-median weeks rather than asserting four', () => {
    const sold = soldByWeek(handoffWeeks(), NOW);

    // The run that actually ends the twelve is FIVE weeks — 63, 60, 71, 68
    // and 82 all clear the 56.5 median, and the sixth back is 55, which
    // does not. So the handoff's sentence is wrong three ways over: it
    // claims four, the run is five, and it names three figures.
    expect(sold.runLength).toBe(5);
    expect(sold.bestIsLatest).toBe(true);
  });

  it('gives the tallest week a full bar and scales the rest to it', () => {
    const sold = soldByWeek(handoffWeeks(), NOW);
    const last = sold.weeks[sold.weeks.length - 1];

    expect(last?.share).toBe(100);
    // 38 against 82 is 46%, not the 38% the handoff's array uses as a
    // height — the array was never a share of anything.
    expect(sold.weeks[0]?.share).toBe(46);
  });

  it('does not let a cancelled invoice stand as a week’s trading', () => {
    const sold = soldByWeek([sale(0, 9_000_000, true), sale(0, 1_000_000)], NOW);
    const last = sold.weeks[sold.weeks.length - 1];

    expect(last?.sold).toBe(Money.money(1_000_000));
    expect(last?.invoices).toBe(1);
  });

  it('draws a week with no trading at zero rather than leaving it out', () => {
    const sold = soldByWeek([sale(0, 1_000_000)], NOW);

    // A zero week is a fact: nothing was sold. A missing bar would say the
    // shop did not exist.
    expect(sold.weeks).toHaveLength(12);
    expect(sold.weeks[0]?.sold).toBe(Money.ZERO);
    expect(sold.weeks[0]?.share).toBe(0);
  });

  it('has nothing to say about a shop that has sold nothing at all', () => {
    const sold = soldByWeek([], NOW);

    expect(sold.median).toBe(Money.ZERO);
    expect(sold.tradedWeeks).toBe(0);
    expect(sold.runLength).toBe(0);
    expect(sold.bestIsLatest).toBe(false);
  });
});

describe('where the profit came from', () => {
  const line = (over: Partial<SoldLine> = {}): SoldLine => ({
    on: daysAgo(3),
    name: 'Iron sheets G28',
    qty: 10,
    sell: Money.money(12_000),
    buy: Money.money(10_000),
    ...over,
  });

  it('ranks by what was kept, not by what was sold', () => {
    // Cement sells for more and keeps less. A panel headed "where the
    // profit came from" that ranked by revenue would put it first.
    const p = profitByProduct(
      [
        line({ name: 'Iron sheets G28', qty: 10, sell: Money.money(12_000), buy: Money.money(10_000) }),
        line({ name: 'Cement', qty: 10, sell: Money.money(30_000), buy: Money.money(29_500) }),
      ],
      NOW,
    );

    expect(p.lines.map((l) => l.name)).toEqual(['Iron sheets G28', 'Cement']);
    expect(p.lines[0]?.kept).toBe(Money.money(20_000));
    expect(p.lines[1]?.kept).toBe(Money.money(5_000));
  });

  it('scales the bars against the biggest line', () => {
    const p = profitByProduct(
      [
        line({ name: 'A', qty: 1, sell: Money.money(200), buy: Money.money(100) }),
        line({ name: 'B', qty: 1, sell: Money.money(150), buy: Money.money(100) }),
      ],
      NOW,
    );

    expect(p.lines.map((l) => l.share)).toEqual([100, 50]);
  });

  it('counts a line with no buying price into sold and not into kept', () => {
    const p = profitByProduct(
      [line({ qty: 1, sell: Money.money(1_000), buy: null }), line({ qty: 1, sell: Money.money(1_000) })],
      NOW,
    );

    // 2,000 sold, only the costed line's 200 kept — and it says so.
    expect(p.lines[0]?.sold).toBe(Money.money(2_000));
    expect(p.lines[0]?.margin.status).toBe('partial');
  });

  it('counts the lines it did not name rather than dropping them', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) =>
      line({ name, qty: 1, sell: Money.money(1_000 - i), buy: Money.ZERO }),
    );
    const p = profitByProduct(many, NOW);

    expect(p.lines).toHaveLength(4);
    expect(p.otherLines).toBe(2);
    expect(p.otherKept).toBe(Money.money(996 + 995));
  });

  it('leaves out what was sold before the window', () => {
    expect(profitByProduct([line({ on: daysAgo(45) })], NOW).lines).toHaveLength(0);
  });
});

describe('yesterday', () => {
  const YESTERDAY = '2026-09-14';

  const invoice = (over: Record<string, unknown> = {}): Parameters<typeof yesterday>[0][number] => ({
    issued: new Date(`${YESTERDAY}T09:00:00Z`),
    total: Money.money(1_000_000),
    payments: [],
    ...over,
  });

  const cash = (type: string, amount: number, on = YESTERDAY): CashTxn => ({
    id: `${type}-${amount}`,
    on,
    account: 'cash',
    type,
    category: null,
    amount: Money.money(amount),
  });

  it('counts what was invoiced, what arrived and what left', () => {
    const y = yesterday(
      [invoice()],
      [cash('receipt', 700_000), cash('payment', 250_000), cash('receipt', 40_000, '2026-09-13')],
      NOW,
    );

    expect(y.on.toISOString().slice(0, 10)).toBe(YESTERDAY);
    expect(y.sold).toBe(Money.money(1_000_000));
    expect(y.collected).toBe(Money.money(700_000));
    expect(y.paidOut).toBe(Money.money(250_000));
  });

  // Cover asks how long the shop can keep running, where stock is cash
  // changing shape. This tile asks what left the till, where it did.
  it('counts stock purchases into what was paid out, unlike the burn', () => {
    const stock = { ...cash('payment', 9_000_000), category: 'Stock Purchase' };

    expect(yesterday([], [stock], NOW).paidOut).toBe(Money.money(9_000_000));
  });

  it('adds only the part of an invoice that was not settled on the day', () => {
    const paid = invoice({
      payments: [{ on: new Date(`${YESTERDAY}T10:00:00Z`), amount: Money.money(400_000) }],
    });

    expect(yesterday([paid], [], NOW).newDebt).toBe(Money.money(600_000));
  });

  it('adds nothing for an invoice paid in full at the counter', () => {
    const paid = invoice({
      payments: [{ on: new Date(`${YESTERDAY}T10:00:00Z`), amount: Money.money(1_000_000) }],
    });

    expect(yesterday([paid], [], NOW).newDebt).toBe(Money.ZERO);
  });

  it('ignores a cancelled invoice entirely', () => {
    const void_ = invoice({ voided: { on: NOW, replacedBy: null } });

    expect(yesterday([void_], [], NOW).sold).toBe(Money.ZERO);
    expect(yesterday([void_], [], NOW).newDebt).toBe(Money.ZERO);
  });
});
