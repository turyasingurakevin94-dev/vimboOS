import { describe, expect, it } from 'vitest';
import * as Money from './money.js';
import {
  afterDeleting,
  groupLedger,
  settledByDay,
  attentionRank,
  balanceDue,
  byAttention,
  daysOld,
  linkedTo,
  lowestEditableTotal,
  paidOffShare,
  readBand,
  receivedSoFar,
  receivingClears,
  state,
  stillToPay,
  type Payment,
  type PurchaseInvoice,
  type SalesInvoice,
} from './invoices.js';

const m = Money.money;
const NOW = new Date('2026-09-17T09:00:00Z');
const daysBefore = (n: number): Date => new Date(NOW.getTime() - n * 86_400_000);

const pay = (id: string, amount: number, over: Partial<Payment> = {}): Payment => ({
  id,
  on: daysBefore(2),
  amount: m(amount),
  method: 'Cash',
  account: 'Cash · shop till',
  takenBy: 'Kevin',
  ...over,
});

const sale = (over: Partial<SalesInvoice> = {}): SalesInvoice => {
  const total = over.total ?? m(100_000);
  return {
    kind: 'sale',
    doc: 'INV-0001',
    customer: 'Ken Bwaise',
    total,
    lines: [{ kind: 'item', id: 'l1', name: 'Goods', qty: 1, priceEach: total }],
    issued: daysBefore(3),
    dueOn: daysBefore(-11),
    payments: [],
    ...over,
  };
};

const purchase = (over: Partial<PurchaseInvoice> = {}): PurchaseInvoice => ({
  kind: 'purchase',
  doc: 'PINV-0001',
  supplier: 'Karddia Hardware',
  total: m(100_000),
  paid: Money.ZERO,
  dueOn: null,
  forSale: null,
  ...over,
});

/**
 * Frame 1b's left ledger, to the shilling. Unlike the Quote handoff, every
 * figure in this one reconciles — these tests are what keeps that true.
 */
const LEDGER: readonly SalesInvoice[] = [
  sale({
    doc: 'INV-0175',
    total: m(465_000),
    issued: daysBefore(29),
    dueOn: daysBefore(15),
    payments: [pay('a', 300_000)],
  }),
  sale({
    doc: 'INV-0209',
    total: m(740_000),
    issued: daysBefore(21),
    dueOn: daysBefore(7),
    payments: [pay('b', 700_000)],
  }),
  sale({
    doc: 'INV-0218',
    total: m(485_000),
    issued: daysBefore(21),
    payments: [pay('c', 345_000)],
  }),
  sale({
    doc: 'INV-0230',
    customer: 'Joan JEZONA',
    total: m(1_770_000),
    issued: daysBefore(20),
    payments: [pay('d', 1_700_000)],
  }),
  sale({ doc: 'INV-0287', customer: 'Shadia', total: m(615_000), issued: daysBefore(12), payments: [pay('e', 610_000)] }),
  sale({ doc: 'INV-0363', customer: 'Innocent', total: m(310_000), issued: NOW, payments: [] }),
];

describe('one invoice', () => {
  it('reads back every paid-off share the ledger draws', () => {
    // 465,000 invoiced against 165,000 still due is 65% — and the row says 65%.
    expect(LEDGER.map((s) => paidOffShare(s))).toMatchObject([
      { value: 65 },
      { value: 95 },
      { value: 71 },
      { value: 96 },
      { value: 99 },
      { value: 0 },
    ]);
  });

  it('reads back every balance the ledger draws', () => {
    expect(LEDGER.map(balanceDue)).toEqual([165_000, 40_000, 140_000, 70_000, 5_000, 310_000]);
  });

  it('never owes money back on an overpayment', () => {
    // Taking more than the balance is not designed yet, but a NEGATIVE
    // balance would be a debt the shop owes the customer, and the ledger
    // would render it as one.
    const over = sale({ total: m(100_000), payments: [pay('x', 130_000)] });
    expect(balanceDue(over)).toBe(0);
    expect(receivedSoFar(over)).toBe(130_000);
  });

  it('has no share of an invoice for nothing, and does not say zero per cent', () => {
    const empty = sale({ total: Money.ZERO });
    expect(paidOffShare(empty)).toMatchObject({ status: 'partial', value: 0 });
  });

  it('counts the days the row shows', () => {
    expect(daysOld(LEDGER[0]!, NOW)).toBe(29);
    expect(daysOld(LEDGER[5]!, NOW)).toBe(0);
  });
});

describe('what state a row is in', () => {
  it.each([
    ['settled when nothing is due', sale({ payments: [pay('p', 100_000)] }), 'settled'],
    ['late when past due', sale({ dueOn: daysBefore(1) }), 'late'],
    ['part when something arrived and it is not yet due', sale({ payments: [pay('p', 40_000)] }), 'part'],
    ['open when nothing arrived and it is not yet due', sale({}), 'open'],
    ['voided before anything else', sale({ voided: { replacedBy: 'INV-0002', on: NOW } }), 'voided'],
  ])('is %s', (_why, inv, want) => {
    expect(state(inv, NOW)).toMatchObject({ value: want });
  });

  it('CANNOT say whether an invoice with no terms is late', () => {
    // "Not late" would be the app deciding that no terms means no lateness.
    // A settled one is still settled — that needs no due date.
    const noTerms = sale({ dueOn: null, payments: [pay('p', 40_000)] });
    const s = state(noTerms, NOW);
    expect(s.status).toBe('unavailable');
    expect(s.status === 'unavailable' && s.reason).toContain('no terms recorded');
    expect(state(sale({ dueOn: null, payments: [pay('p', 100_000)] }), NOW)).toMatchObject({
      value: 'settled',
    });
  });

  it('sorts an underivable row WITH the overdue, never below the open ones', () => {
    const unknown = sale({ doc: 'INV-?', dueOn: null, payments: [pay('p', 1)] });
    expect(attentionRank(unknown, NOW)).toBeLessThan(attentionRank(sale({}), NOW));

    const order = [sale({ doc: 'settled', payments: [pay('p', 100_000)] }), sale({ doc: 'open' }), unknown, sale({ doc: 'late', dueOn: daysBefore(1) })]
      .sort(byAttention(NOW))
      .map((s) => s.doc);
    expect(order).toEqual(['late', 'INV-?', 'open', 'settled']);
  });
});

describe('receiving, and un-receiving', () => {
  const inv = LEDGER[1]!; // INV-0209 — 740,000 invoiced, 700,000 received

  it('knows when the button clears the invoice', () => {
    expect(receivingClears(inv, m(40_000))).toBe(true);
    expect(receivingClears(inv, m(39_999))).toBe(false);
    expect(receivingClears(inv, m(50_000))).toBe(true);
  });

  it('states both facts the delete confirm has to show', () => {
    // Frame 2b asks once, and the question is what the till falls by AND
    // what the invoice goes back to. One without the other is not a question.
    expect(afterDeleting(inv, 'b')).toEqual({
      tillFallsBy: 700_000,
      balanceGoesBackTo: 740_000,
    });
  });

  it('refuses to describe deleting a payment that is not on this invoice', () => {
    expect(afterDeleting(inv, 'not-a-payment')).toBeNull();
  });

  it('will not let Edit invoice go below what is already received', () => {
    // Frame 2c's caution line: 700,000 is in, so the total cannot go under it.
    expect(lowestEditableTotal(inv)).toBe(700_000);
  });
});

describe('the balance band', () => {
  it('nets what is owed against what is owed out', () => {
    const band = readBand(
      [sale({ doc: 'A', total: m(6_000_000) }), sale({ doc: 'B', total: m(614_000) })],
      [purchase({ doc: 'P1', total: m(3_104_300) })],
      NOW,
    );
    // The frame's own three figures: 6,614,000 − 3,104,300 = +3,509,700.
    expect(band.owedToUs).toBe(6_614_000);
    expect(band.weOweSuppliers).toBe(3_104_300);
    expect(band.netPosition).toBe(3_509_700);
    expect(band.openSales).toBe(2);
    expect(band.unpaidPurchases).toBe(1);
  });

  it('counts the range and the open set as DIFFERENT questions', () => {
    const band = readBand(
      [
        sale({ doc: 'settled', total: m(900_000), payments: [pay('p', 900_000)] }),
        sale({ doc: 'open', total: m(100_000) }),
      ],
      [],
      NOW,
    );
    expect(band.openSales).toBe(1); // only the unsettled one
    expect(band.owedToUs).toBe(100_000);
    expect(band.rangeCount).toBe(2); // everything issued in the range
    expect(band.rangeInvoiced).toBe(1_000_000);
    expect(band.rangeReceivedShare).toMatchObject({ value: 90 });
  });

  it('leaves a voided document out of both', () => {
    const band = readBand(
      [sale({ doc: 'V', total: m(500_000), voided: { replacedBy: 'INV-2', on: NOW } })],
      [purchase({ doc: 'PV', total: m(400_000), voided: { replacedBy: null, on: NOW } })],
      NOW,
    );
    expect(band.owedToUs).toBe(0);
    expect(band.weOweSuppliers).toBe(0);
    expect(band.rangeCount).toBe(0);
  });

  it('has no oldest when nothing is open, and does not say zero days', () => {
    expect(readBand([], [], NOW).oldestDays.status).toBe('unavailable');
    expect(readBand(LEDGER, [], NOW).oldestDays).toMatchObject({ value: 29 });
  });

  it('counts what falls due today, and a purchase with no date is not due today', () => {
    const band = readBand(
      [],
      [
        purchase({ doc: 'today', total: m(95_000), dueOn: NOW }),
        purchase({ doc: 'later', total: m(10_000), dueOn: daysBefore(-5) }),
        purchase({ doc: 'undated', total: m(10_000), dueOn: null }),
      ],
      NOW,
    );
    expect(band.dueToday).toBe(1);
    expect(band.unpaidPurchases).toBe(3);
  });

  it('treats a voided purchase as owing NOTHING, not as an unpaid balance', () => {
    // It was withdrawn, not forgotten. Showing its balance invites paying it
    // twice — the replacement is the one that is owed.
    const dead = purchase({ total: m(180_000), voided: { replacedBy: 'PINV-0256', on: NOW } });
    expect(stillToPay(dead)).toBe(0);
  });

  it('does not count a purchase that is already paid', () => {
    const band = readBand([], [purchase({ total: m(220_000), paid: m(220_000) })], NOW);
    expect(band.weOweSuppliers).toBe(0);
    expect(band.unpaidPurchases).toBe(0);
    expect(stillToPay(purchase({ total: m(220_000), paid: m(220_000) }))).toBe(0);
  });
});

describe('the link that lets the two ledgers dim each other', () => {
  const sales = [sale({ doc: 'INV-0175' }), sale({ doc: 'INV-0363' })];
  const purchases = [
    purchase({ doc: 'PINV-0099', forSale: 'INV-0175' }),
    purchase({ doc: 'PINV-0098', forSale: 'INV-0175' }),
    purchase({ doc: 'PINV-0301', forSale: 'INV-0363' }),
    purchase({ doc: 'PINV-0289', forSale: null }),
  ];

  it('lights a sale and every purchase raised for it', () => {
    expect([...linkedTo('INV-0175', sales, purchases)].sort()).toEqual([
      'INV-0175',
      'PINV-0098',
      'PINV-0099',
    ]);
  });

  it('lights the WHOLE piece of money from a purchase, not just the pair', () => {
    // Picking one purchase shows the sale it funds and that sale's other
    // purchases — otherwise the clerk sees half the cost of the thing.
    expect([...linkedTo('PINV-0098', sales, purchases)].sort()).toEqual([
      'INV-0175',
      'PINV-0098',
      'PINV-0099',
    ]);
  });

  it('lights only itself for stock bought on the shop’s own account', () => {
    expect([...linkedTo('PINV-0289', sales, purchases)]).toEqual(['PINV-0289']);
  });

  it('lights EVERYTHING when nothing is selected', () => {
    // The resting state is "no question asked yet", not "all dimmed".
    expect(linkedTo(null, sales, purchases).size).toBe(6);
    expect(linkedTo('not-a-doc', sales, purchases).size).toBe(6);
  });
});

describe('the three groups the phone ledger draws', () => {
  const now = NOW;
  const rows = [
    sale({ doc: 'late-1', total: m(270_000), dueOn: daysBefore(20), issued: daysBefore(34) }),
    sale({ doc: 'late-2', total: m(100_000), dueOn: daysBefore(1), payments: [pay('x', 10_000)] }),
    sale({ doc: 'part', total: m(740_000), payments: [pay('y', 700_000)] }),
    sale({ doc: 'open', total: m(310_000) }),
    sale({ doc: 'settled', total: m(500_000), payments: [pay('z', 500_000)] }),
    sale({ doc: 'gone', total: m(999_000), voided: { replacedBy: null, on: now } }),
  ];

  it('is three groups, and part-paid lives in Open', () => {
    expect(groupLedger(rows, now).map((g) => [g.label, g.count])).toEqual([
      ['Overdue', 2],
      ['Open', 2],
      ['Settled', 1],
    ]);
  });

  it('totals what is STILL DUE for the first two and what CAME IN for settled', () => {
    const [overdue, open, settled] = groupLedger(rows, now);
    expect(overdue?.total).toBe(270_000 + 90_000);
    expect(open?.total).toBe(40_000 + 310_000);
    // Not the balance — that is zero. The question a settled group answers
    // is how much came in.
    expect(settled?.total).toBe(500_000);
  });

  it('drops an empty group rather than heading an absence', () => {
    expect(groupLedger([sale({ doc: 'only-open' })], now).map((g) => g.label)).toEqual(['Open']);
    expect(groupLedger([], now)).toEqual([]);
  });

  it('puts an underivable row in Overdue, where the SORT also puts it', () => {
    // The two must not disagree about where a row is.
    const unknown = sale({ doc: 'no-terms', dueOn: null, payments: [pay('p', 1)] });
    const groups = groupLedger([unknown, sale({ doc: 'open' })], now);
    expect(groups[0]?.label).toBe('Overdue');
    expect(groups[0]?.invoices.map((i) => i.doc)).toEqual(['no-terms']);
  });
});

describe('settled invoices collapse to one row a day', () => {
  it('buckets by the day the invoice was FINISHED, newest first', () => {
    // Raised on different days, both finished on the same one.
    const rows = [
      sale({ doc: 'a', total: m(100_000), issued: daysBefore(9), payments: [pay('a1', 100_000, { on: daysBefore(3) })] }),
      sale({ doc: 'b', total: m(200_000), issued: daysBefore(4), payments: [pay('b1', 200_000, { on: daysBefore(3) })] }),
      sale({ doc: 'c', total: m(50_000), issued: daysBefore(8), payments: [pay('c1', 50_000, { on: daysBefore(1) })] }),
    ];
    expect(settledByDay(rows).map((d) => [d.count, d.collected])).toEqual([
      [1, 50_000],
      [2, 300_000],
    ]);
  });

  it('leaves out anything still owing, and anything voided', () => {
    const rows = [
      sale({ doc: 'owing', total: m(100_000), payments: [pay('p', 40_000)] }),
      sale({ doc: 'gone', total: m(100_000), payments: [pay('q', 100_000)], voided: { replacedBy: null, on: NOW } }),
    ];
    expect(settledByDay(rows)).toEqual([]);
  });

  it('gives no day row to a zero invoice that was never paid', () => {
    // Settled with no payment is written off or was never worth anything.
    // It is not money that came in on a day.
    expect(settledByDay([sale({ doc: 'nil', total: Money.ZERO, payments: [] })])).toEqual([]);
  });
});
