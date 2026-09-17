import { describe, expect, it } from 'vitest';
import { Money, balanceDue, lineAmount, linesTotal, receivedSoFar, state } from '@ow/domain';
import {
  PAYLOAD_KEYS,
  invoiceDoc,
  readLines,
  readPayments,
  toPurchaseInvoice,
  toSalesInvoice,
  type SavedQuoteRow,
} from './savedQuotes.js';

/**
 * A `saved_quotes` row exactly as the old app writes one.
 *
 * Copied from `index.html` — the `savedQuotes` mapping in `rowsFromData` and
 * the item/payment builders — not invented. Everything in this file is
 * anchored to that code, because the whole point of the contract is that it
 * describes what is actually in the database rather than what would be
 * convenient.
 */
const REAL_ROW: SavedQuoteRow = {
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
    items: [
      {
        lineId: 12,
        productId: 'p-cement',
        variantIdx: 0,
        productName: 'Cement — Tororo',
        unit: 'Bag',
        packUnit: '',
        packQty: 0,
        qtyIn: 'unit',
        qty: 10,
        supplierId: 's-1',
        supplierName: 'Karddia Hardware',
        price: 38_000, // what the SHOP paid
        sellPrice: 44_500, // what the CLIENT pays
      },
    ],
    charges: [{ id: 'c1', name: 'Transport', kind: 'charge', amount: 20_000 }],
    credit: null,
    payments: [
      { date: '2026-08-19', amount: 300_000, note: '', cashTxnId: 901, method: 'Cash · shop till', id: 1 },
    ],
    customerId: 'cust-ken',
    debtCharged: 165_000,
  },
};

describe('the payload keys the old app names', () => {
  /**
   * The old app rebuilds `payload` from named keys, so a key it names and we
   * do not is stripped the first time this app writes. Its own comments call
   * that "order 151's lesson, a third time".
   */
  it('is the whole list, including the ones no screen here will ever show', () => {
    expect(PAYLOAD_KEYS).toContain('items');
    expect(PAYLOAD_KEYS).toContain('payments');
    // The three that were lost and re-added, one at a time, in production.
    expect(PAYLOAD_KEYS).toContain('originPortal');
    expect(PAYLOAD_KEYS).toContain('originWa');
    expect(PAYLOAD_KEYS).toContain('pickShortfallAckAt');
    expect(new Set(PAYLOAD_KEYS).size).toBe(PAYLOAD_KEYS.length);
    expect(PAYLOAD_KEYS.length).toBe(30);
  });
});

describe('reading the lines of a real row', () => {
  it('bills the customer sellPrice, NEVER price', () => {
    // `price` is the buying price. Reading it as the line price would
    // understate this invoice by its own margin — 380,000 instead of 445,000.
    const { lines, unreadable } = readLines(REAL_ROW.payload, 'test');
    expect(unreadable).toEqual([]);
    expect(lines[0]).toMatchObject({ kind: 'item', name: 'Cement — Tororo', qty: 10 });
    expect(lines[0]?.kind === 'item' && lines[0].priceEach).toBe(44_500);
    expect(lineAmount(lines[0]!)).toBe(445_000);
  });

  it('reads charges after items, as their own kind of line', () => {
    const { lines } = readLines(REAL_ROW.payload, 'test');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ kind: 'charge', name: 'Transport', amount: 20_000 });
    expect(linesTotal(lines)).toBe(465_000);
  });

  it('refuses a line with no customer price rather than falling back to cost', () => {
    const { lines, unreadable } = readLines(
      { items: [{ productName: 'Nails', qty: 4, price: 9_000 }] },
      'test',
    );
    expect(lines).toEqual([]);
    expect(unreadable).toEqual(['Nails has no price the customer was charged']);
  });

  it('names an unreadable line instead of dropping it', () => {
    const { lines, unreadable } = readLines(
      { items: [{ productName: 'Hinges', sellPrice: 5_000 }, null] },
      'test',
    );
    expect(lines).toEqual([]);
    expect(unreadable).toEqual(['Hinges has no quantity', 'item 2 is not readable']);
  });
});

describe('reading payments, current shape and legacy', () => {
  it('reads the account out of `method`, because that is what it holds', () => {
    const { payments } = readPayments(REAL_ROW.payload, 'test');
    expect(payments[0]).toMatchObject({
      id: '1',
      amount: 300_000,
      method: 'Cash',
      account: 'Cash · shop till',
    });
  });

  it('keeps a NUMERIC id, because that is what the old app writes', () => {
    // `id: nextPaymentId(q)` is a number, and `readText` rejects numbers —
    // correctly, for prose. Falling back to the position would make the
    // delete confirm name one payment and remove another the moment an
    // earlier one is reversed, which is the exact failure `id` was added to
    // prevent.
    const { payments } = readPayments({ payments: [{ date: '2026-01-01', amount: 5, id: 7 }] }, 't');
    expect(payments[0]?.id).toBe('7');
  });

  it('reads a payment written before `method` and `id` existed', () => {
    // The old app added both later: "a receipt that says how the money
    // arrived settles an argument months later". Rows from before are still
    // in the database and still have to be readable.
    const { payments, unreadable } = readPayments(
      { payments: [{ date: '2025-11-02', amount: 40_000, note: 'part', cashTxnId: 12 }] },
      'test',
    );
    expect(unreadable).toEqual([]);
    expect(payments[0]).toMatchObject({ id: 'p1', amount: 40_000, method: 'Cash' });
  });

  it('will not invent a date or an amount', () => {
    const { payments, unreadable } = readPayments(
      { payments: [{ amount: 1_000 }, { date: '2026-01-01' }] },
      'test',
    );
    expect(payments).toEqual([]);
    expect(unreadable).toEqual([
      'payment 1 has no date',
      'payment 2 has no readable amount',
    ]);
  });
});

describe('a row becomes the invoice the ledger draws', () => {
  it('numbers it the way the old app does', () => {
    expect(invoiceDoc(175)).toBe('INV-0175');
    expect(invoiceDoc(9)).toBe('INV-0009');
  });

  it('derives the same figures the Invoices register shows', () => {
    const { invoice, unreadable } = toSalesInvoice(REAL_ROW, { termsDays: 30 });
    expect(unreadable).toEqual([]);
    expect(invoice.doc).toBe('INV-0175');
    expect(invoice.customer).toBe('Ken Bwaise');
    expect(invoice.total).toBe(465_000);
    expect(receivedSoFar(invoice)).toBe(300_000);
    expect(balanceDue(invoice)).toBe(165_000);
  });

  it('takes the due date from the CUSTOMER, because the row has none', () => {
    const withTerms = toSalesInvoice(REAL_ROW, { termsDays: 30 }).invoice;
    expect(withTerms.dueOn?.toISOString().slice(0, 10)).toBe('2026-09-16');

    // A customer who has never been given terms has no derivable lateness,
    // and the ledger says "No terms" rather than guessing "Open".
    const none = toSalesInvoice(REAL_ROW, { termsDays: null }).invoice;
    expect(none.dueOn).toBeNull();
    expect(state(none, new Date('2026-09-17')).status).toBe('unavailable');
  });

  it('SAYS SO when amount_paid and the payments disagree', () => {
    // Two stored facts about the same money. Preferring one silently is how
    // a ledger and a dialog drift apart, which is the thing the reckoning
    // rule exists to stop.
    const drifted = { ...REAL_ROW, amount_paid: '250000' };
    const { unreadable } = toSalesInvoice(drifted, { termsDays: 30 });
    expect(unreadable).toEqual([
      'amount_paid says 250,000 but the payments come to 300,000',
    ]);
  });

  it('carries a voided row through as voided', () => {
    const { invoice } = toSalesInvoice({ ...REAL_ROW, voided: true }, { termsDays: 30 });
    expect(invoice.voided).toBeDefined();
  });
});

describe('a purchase row, and the link the facing ledgers rest on', () => {
  it('links to the sale it was raised for', () => {
    const { purchase } = toPurchaseInvoice({
      id: 98,
      quote_id: 175,
      date: '2026-08-20',
      payload: {
        supplierName: 'Mukwano Steel',
        items: [{ qty: 2, price: 47_500 }],
        amountPaid: 0,
        dueDate: '2026-09-15',
      },
    });
    expect(purchase.doc).toBe('PINV-0098');
    expect(purchase.forSale).toBe('INV-0175');
    expect(purchase.total).toBe(95_000);
    expect(Money.subtract(purchase.total, purchase.paid)).toBe(95_000);
  });

  it('is stock bought on the shop’s own account when there is no quote_id', () => {
    const { purchase } = toPurchaseInvoice({
      id: 289,
      quote_id: null,
      date: '2026-09-06',
      payload: { supplierName: 'Nsambya Cement', items: [{ qty: 1, price: 1_120_000 }], amountPaid: 0 },
    });
    expect(purchase.forSale).toBeNull();
    expect(purchase.dueOn).toBeNull();
  });
});
