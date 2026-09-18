/**
 * Reading the register off rows shaped like the shop's real ones.
 *
 * `readLedgers` is three `.select()` calls and an error check; `assemble` is
 * where this file can be wrong. The join is by CUSTOMER NAME, the terms that
 * decide lateness live on a different table from the invoice, and a row that
 * will not parse has to survive into the ledger carrying a note rather than
 * vanishing from a total. All three are pinned here.
 *
 * Every row below is shaped after `index.html`'s own writers, the same
 * source `savedQuotes.ts` was read off.
 */

import { describe, expect, it } from 'vitest';
import { balanceDue, state } from '@ow/domain';
import { assemble } from './invoices.js';

const KEN = {
  id: 175,
  client_name: 'Ken Bwaise',
  client_phone: '0772481330',
  date: '2026-08-17',
  status: 'invoiced',
  invoiced: true,
  invoiced_at: '2026-08-17',
  amount_paid: '300000',
  voided: false,
  payload: {
    client: { name: 'Ken Bwaise', phone: '0772481330' },
    items: [{ lineId: 12, productName: 'Cement — Tororo', qty: 10, price: 38_000, sellPrice: 44_500 }],
    charges: [{ id: 'c1', name: 'Transport', kind: 'charge', amount: 20_000 }],
    payments: [{ date: '2026-08-19', amount: 300_000, method: 'Cash · shop till', id: 1 }],
  },
};

/** The same customer as `KEN`, spelled the way a second row spells it. */
const SHADIA = {
  ...KEN,
  id: 287,
  client_name: 'Shadia',
  amount_paid: '0',
  payload: {
    ...KEN.payload,
    client: { name: 'Shadia' },
    payments: [],
  },
};

const PINV = {
  id: 98,
  quote_id: 175,
  date: '2026-08-20',
  payload: { supplierName: 'Mukwano Steel', items: [{ qty: 2, price: 47_500 }], amountPaid: 0 },
};

describe('the join that decides whether an invoice can be late', () => {
  it('takes terms from the customer row matching the invoice’s name', () => {
    const { sales } = assemble({
      sales: [KEN],
      purchases: [],
      customers: [{ id: 'cust-ken', name: 'Ken Bwaise', terms_days: 30 }],
    });

    expect(sales).toHaveLength(1);
    expect(sales[0]?.dueOn?.toISOString().slice(0, 10)).toBe('2026-09-16');
    expect(state(sales[0]!, new Date('2026-09-17')).status).toBe('known');
  });

  it('leaves lateness UNDERIVABLE when no customer row matches', () => {
    // The common real case, not a hypothetical: `saved_quotes` carries a
    // typed-in name, and a walk-in who was never added to `customers` has no
    // terms at all. "Open" would be the app answering a question it cannot.
    const { sales } = assemble({
      sales: [KEN],
      purchases: [],
      customers: [{ id: 'cust-other', name: 'Joan JEZONA', terms_days: 14 }],
    });

    expect(sales[0]?.dueOn).toBeNull();
    expect(state(sales[0]!, new Date('2026-09-17')).status).toBe('unavailable');
  });

  it('treats a customer with no terms the same as no customer at all', () => {
    const { sales } = assemble({
      sales: [KEN],
      purchases: [],
      customers: [{ id: 'cust-ken', name: 'Ken Bwaise', terms_days: null }],
    });

    expect(sales[0]?.dueOn).toBeNull();
  });

  it('matches each invoice to its OWN customer, not the first one read', () => {
    const { sales } = assemble({
      sales: [KEN, SHADIA],
      purchases: [],
      customers: [
        { id: 'cust-ken', name: 'Ken Bwaise', terms_days: 30 },
        { id: 'cust-shadia', name: 'Shadia', terms_days: 7 },
      ],
    });

    expect(sales[0]?.dueOn?.toISOString().slice(0, 10)).toBe('2026-09-16');
    expect(sales[1]?.dueOn?.toISOString().slice(0, 10)).toBe('2026-08-24');
  });

  it('ignores a customer row whose name will not read', () => {
    const { sales } = assemble({
      sales: [KEN],
      purchases: [],
      customers: [{ id: 'x', name: null, terms_days: 30 }, { id: 'y', terms_days: 30 }],
    });

    expect(sales[0]?.dueOn).toBeNull();
  });
});

describe('what the ledger owes, from rows', () => {
  it('derives the same balance the old app’s invoiceBalanceDue does', () => {
    const { sales } = assemble({ sales: [KEN], purchases: [], customers: [] });
    // 10 × 44,500 + 20,000 transport = 465,000, less 300,000 received.
    expect(sales[0]?.total).toBe(465_000);
    expect(balanceDue(sales[0]!)).toBe(165_000);
  });

  it('carries purchases through with the link the facing ledgers rest on', () => {
    const { purchases } = assemble({ sales: [KEN], purchases: [PINV], customers: [] });
    expect(purchases[0]?.doc).toBe('PINV-0098');
    expect(purchases[0]?.forSale).toBe('INV-0175');
  });

  it('is empty, and says nothing is wrong, for a shop with no invoices', () => {
    expect(assemble({ sales: [], purchases: [], customers: [] })).toEqual({
      sales: [],
      purchases: [],
      unreadable: [],
    });
  });
});

describe('a row that will not fully parse', () => {
  const BROKEN = {
    ...KEN,
    id: 301,
    payload: {
      ...KEN.payload,
      items: [{ lineId: 12, productName: 'Cement — Tororo', qty: 10, price: 38_000 }],
    },
  };

  it('still appears in the ledger, with the trouble NAMED against its doc', () => {
    // Dropping it would take its debt off the total silently, which is the
    // one failure mode a register of debts must not have.
    const { sales, unreadable } = assemble({ sales: [BROKEN], purchases: [], customers: [] });

    expect(sales).toHaveLength(1);
    expect(sales[0]?.doc).toBe('INV-0301');
    expect(unreadable).toHaveLength(1);
    expect(unreadable[0]).toMatch(/^INV-0301: /);
  });

  it('does not let one bad row hide a good one', () => {
    const { sales, unreadable } = assemble({
      sales: [BROKEN, KEN],
      purchases: [],
      customers: [],
    });

    expect(sales.map((x) => x.doc)).toEqual(['INV-0301', 'INV-0175']);
    expect(unreadable.every((u) => u.startsWith('INV-0301: '))).toBe(true);
  });
});

describe('when the customers table cannot be read', () => {
  // Terms arrived in migration 0096. A database that has not run it answers
  // that query with an error, and RLS on `customers` can refuse on its own.
  it('still draws the ledger, and says why nothing can be called late', () => {
    const { sales, unreadable } = assemble({
      sales: [KEN],
      purchases: [PINV],
      customers: [],
      termsUnreadable: 'customer terms could not be read (permission denied)',
    });

    expect(sales).toHaveLength(1);
    expect(balanceDue(sales[0]!)).toBe(165_000);
    expect(sales[0]?.dueOn).toBeNull();
    expect(unreadable[0]).toMatch(/terms could not be read/);
  });

  it('says nothing extra when they read fine', () => {
    const { unreadable } = assemble({
      sales: [KEN],
      purchases: [],
      customers: [{ id: 'c', name: 'Ken Bwaise', terms_days: 30 }],
      termsUnreadable: null,
    });
    expect(unreadable).toEqual([]);
  });
});
