/**
 * Raising an order: the part of it that needs no database.
 *
 * The row shape, what is refused before an invoice number is spent, and the
 * second press. Everything else in `quotes.ts` is one `.insert()` and the
 * shared id issuer, both of which are proved against the real books rather
 * than here.
 */

import { describe, expect, it } from 'vitest';
import { PAYLOAD_KEYS, lineIds, type QuoteLineWrite } from './savedQuotes.js';
import { quoteRow, whyNotSaveable, type NewQuote } from './quotes.js';

const NOW = new Date('2026-09-18T09:30:00.000Z');

const line = (over: Partial<QuoteLineWrite> = {}): QuoteLineWrite => ({
  lineId: 1,
  productId: 'P424',
  variantIdx: null,
  productName: 'Butterfly Hinges',
  unit: 'Pc',
  packUnit: '',
  packQty: 0,
  qtyIn: 'unit',
  qty: 1,
  supplierId: 'S072',
  supplierName: 'Maria Building Materials',
  price: 10_000,
  sellPrice: 12_000,
  ...over,
});

const order = (over: Partial<NewQuote> = {}): NewQuote => ({
  client: { name: 'Adinan', phone: '0702301512' },
  customerId: 'C019',
  items: [line()],
  charges: [],
  ...over,
});

describe('an order as a row', () => {
  it('waits in Draft, because raising an order is not agreeing it', () => {
    const row = quoteRow('shop', 3331, order(), NOW);

    expect(row.status).toBe('draft');
    expect(row.invoiced).toBe(false);
    expect(row.voided).toBe(false);
    expect(row.amount_paid).toBe(0);
    expect(row.date).toBe('2026-09-18');
  });

  /**
   * The board reads the column and the quote screen reads the payload.
   * Writing one and not the other is how they start disagreeing about
   * whose order it is.
   */
  it('names the client in the column and in the payload, from one place', () => {
    const row = quoteRow('shop', 3331, order(), NOW);
    const client = row.payload.client as { name: string; phone: string };

    expect(row.client_name).toBe('Adinan');
    expect(row.client_phone).toBe('0702301512');
    expect(client.name).toBe('Adinan');
    expect(client.phone).toBe('0702301512');
  });

  it('leaves a missing phone null in the column rather than empty', () => {
    const row = quoteRow('shop', 1, order({ client: { name: 'Counter', phone: '' } }), NOW);
    expect(row.client_phone).toBeNull();
  });

  it('carries the lines and the charges through untouched', () => {
    const row = quoteRow(
      'shop',
      1,
      order({ items: [line(), line({ lineId: 2 })], charges: [{ name: 'Delivery', amount: 30_000 }] }),
      NOW,
    );

    expect((row.payload.items as readonly QuoteLineWrite[]).map((i) => i.lineId)).toEqual(
      lineIds(2),
    );
    expect(row.payload.charges).toEqual([{ name: 'Delivery', amount: 30_000 }]);
  });

  it('writes a payload of nothing but keys the old app names', () => {
    const row = quoteRow('shop', 1, order(), NOW);
    for (const key of Object.keys(row.payload)) expect(PAYLOAD_KEYS).toContain(key);
  });
});

describe('what is refused before an invoice number is spent', () => {
  /**
   * The old app's own rule, at the same point in its save: a save the shop
   * backs out of must cost nothing. An id issued for an order that is then
   * refused is a gap in the invoice sequence, on paper, for ever.
   */
  it('refuses an order with nothing on it', () => {
    expect(whyNotSaveable(order({ items: [] }))).toBe('Add at least one item before saving.');
  });

  it('refuses an order for nobody', () => {
    expect(whyNotSaveable(order({ client: { name: '  ', phone: '' } }))).toBe(
      'Say who the order is for before saving.',
    );
  });

  it('names the line that is wrong, rather than saying the order is', () => {
    expect(whyNotSaveable(order({ items: [line({ qty: 0 })] }))).toBe(
      'Butterfly Hinges has no quantity.',
    );
    expect(whyNotSaveable(order({ items: [line({ sellPrice: Number.NaN })] }))).toBe(
      'Butterfly Hinges has no price.',
    );
    expect(whyNotSaveable(order({ items: [line({ price: Number.NaN })] }))).toBe(
      'Butterfly Hinges has no buying price.',
    );
  });

  /**
   * The old app prices a line per BASE unit and divides a per-carton figure
   * back down by the pack size, so a carton of twelve at 25,000 stores
   * 2083.333… Fractions are in these books by design, and refusing them
   * here would refuse orders the shop takes every day.
   */
  it('takes a fractional price, because a pack size put it there', () => {
    expect(whyNotSaveable(order({ items: [line({ sellPrice: 25_000 / 12 })] }))).toBeNull();
  });

  it('lets a whole and priced order through', () => {
    expect(whyNotSaveable(order())).toBeNull();
  });
});
