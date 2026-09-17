import { describe, expect, it } from 'vitest';
import {
  Money,
  balanceDue,
  canSaveEdit,
  linesTotal,
  lowestEditableTotal,
  paidOffShare,
  readBand,
  settledByDay,
  state,
} from '@ow/domain';
import { DEMO_TODAY, demoPurchaseInvoices, demoSalesInvoices } from './demo-invoices.js';

/**
 * The band in frame 1b is not four numbers the design picked — it is one
 * reckoning over the ledgers beneath it, and the frame's arithmetic is
 * exact. This asserts the demo data DERIVES to it, so the screen can never
 * show a band that disagrees with its own rows.
 */
describe('the demo ledgers derive frame 1b’s band', () => {
  const sales = demoSalesInvoices();
  const purchases = demoPurchaseInvoices();
  const band = readBand(sales, purchases, DEMO_TODAY);

  it('owes us 6,614,000 across 18 open invoices, oldest 29 days', () => {
    expect(band.owedToUs).toBe(6_614_000);
    expect(band.openSales).toBe(18);
    expect(band.oldestDays).toMatchObject({ value: 29 });
  });

  it('owes suppliers 3,104,300 across 9 purchase invoices, 2 due today', () => {
    expect(band.weOweSuppliers).toBe(3_104_300);
    expect(band.unpaidPurchases).toBe(9);
    expect(band.dueToday).toBe(2);
  });

  it('nets +3,509,700', () => {
    expect(band.netPosition).toBe(3_509_700);
  });

  it('covers 159 invoices worth 90,417,995, 93% received', () => {
    expect(band.rangeCount).toBe(159);
    expect(band.rangeInvoiced).toBe(90_417_995);
    expect(band.rangeReceivedShare).toMatchObject({ value: 93 });
  });

  it('is internally consistent: invoiced less received IS what is owed', () => {
    // The check that makes the other four more than a coincidence.
    expect(band.rangeInvoiced - 83_803_995).toBe(band.owedToUs);
  });
});

describe('the six rows frame 1b draws', () => {
  const sales = demoSalesInvoices();
  const find = (doc: string): ReturnType<typeof demoSalesInvoices>[number] => {
    const hit = sales.find((s) => s.doc === doc);
    if (hit === undefined) throw new Error(`${doc} is not in the demo data`);
    return hit;
  };

  it.each([
    ['INV-0175', 165_000, 65],
    ['INV-0209', 40_000, 95],
    ['INV-0218', 140_000, 71],
    ['INV-0230', 70_000, 96],
    ['INV-0287', 5_000, 99],
    ['INV-0363', 310_000, 0],
  ])('%s is %i still due at %i%% paid off', (doc, due, share) => {
    expect(balanceDue(find(doc))).toBe(due);
    expect(paidOffShare(find(doc))).toMatchObject({ value: share });
  });

  it('has the two oldest past their terms and the newest merely open', () => {
    expect(state(find('INV-0175'), DEMO_TODAY)).toMatchObject({ value: 'late' });
    expect(state(find('INV-0209'), DEMO_TODAY)).toMatchObject({ value: 'late' });
    expect(state(find('INV-0363'), DEMO_TODAY)).toMatchObject({ value: 'open' });
  });
});

describe('the settled tail reads like trading, not like a generator', () => {
  const days = settledByDay(demoSalesInvoices());

  it('still sums to the shilling', () => {
    // The point of `allocateBy`: vary the invoices, keep the total exact.
    expect(Money.add(...days.map((d) => d.collected))).toBe(77_043_995);
    expect(days.reduce((n, d) => n + d.count, 0)).toBe(141);
  });

  it('does not draw the same day six times', () => {
    // The first version spread 141 invoices with `i % 27`, so the phone's
    // settled group showed "6 invoices · 3,278,468" over and over. Demo data
    // that is obviously generated stops the screen being judged on its
    // design.
    expect(new Set(days.map((d) => d.count)).size).toBeGreaterThan(3);
    expect(new Set(days.map((d) => d.collected)).size).toBe(days.length);
  });

  it('is newest first', () => {
    const times = days.map((d) => d.on.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe('every invoice\u2019s lines come to its total', () => {
  /**
   * Edit invoice reads the LINES; the ledger and the dialog read the TOTAL.
   * A screen where those two disagree is the defect this module exists to
   * prevent, and it would appear as an invoice that changes value the moment
   * someone opens it to look.
   */
  it.each(demoSalesInvoices().map((s) => [s.doc, s] as const))('%s', (_doc, inv) => {
    expect(linesTotal(inv.lines)).toBe(inv.total);
  });

  it('draws frame 2c\u2019s three lines on the invoice 2c draws them on', () => {
    const inv = demoSalesInvoices().find((s) => s.doc === 'INV-0209');
    expect(inv?.lines.map((l) => (l.kind === 'item' ? [l.qty, l.priceEach] : l.amount))).toEqual([
      [20, 14_500],
      [15, 29_000],
      15_000,
    ]);
    expect(inv && linesTotal(inv.lines)).toBe(740_000);
  });

  it('will not let INV-0209 be edited below the 700,000 already received', () => {
    const inv = demoSalesInvoices().find((s) => s.doc === 'INV-0209');
    if (inv === undefined) throw new Error('INV-0209 is not in the demo data');
    expect(lowestEditableTotal(inv)).toBe(700_000);
    expect(canSaveEdit(inv, inv.lines)).toEqual({ ok: true });

    const gutted = inv.lines.filter((l) => l.kind === 'charge');
    const refused = canSaveEdit(inv, gutted);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.why).toContain('700,000 is already received');

    expect(canSaveEdit(inv, []).ok).toBe(false);
  });
});
