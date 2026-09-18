/**
 * Raising an order: the part of it that needs no database.
 *
 * The row shape, what is refused before an invoice number is spent, and the
 * second press. Everything else in `quotes.ts` is one `.insert()` and the
 * shared id issuer, both of which are proved against the real books rather
 * than here.
 */

import { describe, expect, it } from 'vitest';
import { Money, OWN_SHELF, asId, known, unavailable, type ItemLine } from '@ow/domain';
import { PAYLOAD_KEYS, lineIds, type QuoteLineWrite } from './savedQuotes.js';
import {
  boughtInLines,
  quoteRow,
  stageOf,
  whyNotSaveable,
  writeLine,
  writeQuote,
  type NewQuote,
} from './quotes.js';

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
   * The shop's own shelf is not a supplier and cannot answer a message.
   *
   * Order #370 — two Bow Saw Blades off our own stock, ten on the shelf —
   * was raised into Draft and sat there behind `Cannot move yet — Our stock
   * has not answered`: a padlock nothing that will ever happen can open.
   */
  it('sends an order filled off our own shelf straight to Preparing', () => {
    const shelf = order({ items: [line({ supplierId: OWN_SHELF, supplierName: 'Our stock' })] });

    expect(boughtInLines(shelf)).toEqual([]);
    expect(stageOf(shelf)).toBe('preparing');
    expect(quoteRow('shop', 370, shelf, NOW).status).toBe('preparing');
  });

  it('holds an order in Draft for the supplier lines on it, and only those', () => {
    const mixed = order({
      items: [
        line({ lineId: 1, supplierId: OWN_SHELF, supplierName: 'Our stock' }),
        line({ lineId: 2, supplierId: 'S072', supplierName: 'Maria Building Materials' }),
      ],
    });

    expect(boughtInLines(mixed).map((i) => i.supplierName)).toEqual(['Maria Building Materials']);
    expect(stageOf(mixed)).toBe('draft');
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
      order({
        items: [line(), line({ lineId: 2 })],
        charges: [
          { id: 1, label: 'Transport', type: 'fixed', value: 5_000, service: 'Transport', cost: null },
        ],
      }),
      NOW,
    );

    expect((row.payload.items as readonly QuoteLineWrite[]).map((i) => i.lineId)).toEqual(
      lineIds(2),
    );
    expect(row.payload.charges).toEqual([
      { id: 1, label: 'Transport', type: 'fixed', value: 5_000, service: 'Transport', cost: null },
    ]);
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

describe('a quote on screen, as lines in the books', () => {
  const item = (over: Partial<ItemLine> = {}): ItemLine => ({
    kind: 'item',
    id: asId('v1'),
    name: 'Soft Close Mulper — Half Bend',
    unit: 'Pc',
    qty: 2,
    priceEach: Money.money(2_500),
    inStock: 8,
    buyFrom: 'Roto Industry',
    buyAt: known(Money.money(2_000), 'the last invoice'),
    source: {
      productId: 'P044',
      variantIdx: 1,
      supplierId: 'S094',
      packUnit: '',
      packQty: 0,
      countedIn: 'unit',
    },
    ...over,
  });

  it('writes the buy price and the sell price the way round the books hold them', () => {
    const written = writeLine(item(), 1);

    expect(written.price).toBe(2_000);
    expect(written.sellPrice).toBe(2_500);
    expect(written.productId).toBe('P044');
    expect(written.variantIdx).toBe(1);
    expect(written.supplierId).toBe('S094');
  });

  /**
   * The unit the rep chose is the unit the screen speaks, but the books
   * count in base units. A quantity typed as 1 Ctn was once met with a
   * price box counting per Pair, so the box said 2,400 under a card saying
   * 240,000/Ctn and the line arrived on the quote as 10 Pair.
   */
  it('counts a pack in base units, price included', () => {
    const byCarton = item({
      qty: 1,
      priceEach: Money.money(240_000),
      buyAt: known(Money.money(200_000), 'the carton'),
      source: {
        productId: 'P044',
        variantIdx: null,
        supplierId: 'S094',
        packUnit: 'Ctn',
        packQty: 100,
        countedIn: 'pack',
      },
    });
    const written = writeLine(byCarton, 1);

    expect(written.qty).toBe(100);
    expect(written.sellPrice).toBe(2_400);
    expect(written.price).toBe(2_000);
    expect(written.qtyIn).toBe('pack');
    expect(written.packQty).toBe(100);
  });

  /**
   * Zero is what the old app writes for a shelf line with no cost on file,
   * and a margin read off it is wrong where everybody can see. A guessed
   * cost is wrong where nobody checks.
   */
  it('writes no buy price rather than a guessed one', () => {
    expect(writeLine(item({ buyAt: unavailable('nothing on the shelf has a cost') }), 1).price).toBe(
      0,
    );
  });

  it('numbers the lines of the order and keeps the charges beside them', () => {
    const written = writeQuote(
      {
        date: '18 Sep 2026',
        client: {
          id: asId('c1'),
          name: 'Adinan',
          phone: '0702301512',
          orders: 3,
          owesNow: Money.ZERO,
          lastOrder: null,
        },
        lines: [
          item(),
          {
            kind: 'charge',
            id: 'ch1',
            name: 'Transport',
            basis: 'charge',
            rule: { type: 'fixed', value: 5_000 },
            service: 'Transport',
            cost: null,
          },
          item({ id: asId('v2'), name: 'Normal Mulper — Flat' }),
        ],
      },
      'C019',
    );

    expect(written.items.map((i) => i.lineId)).toEqual([1, 2]);
    expect(written.items.map((i) => i.productName)).toEqual([
      'Soft Close Mulper — Half Bend',
      'Normal Mulper — Flat',
    ]);
    /**
     * The rule, not the shillings. `chargeAmount` in the old app reads
     * `Number(ch.value) || 0`, so a charge written as `{name, amount}` comes
     * to nothing on the customer's invoice — quietly, and only there.
     */
    expect(written.charges).toEqual([
      { id: 1, label: 'Transport', type: 'fixed', value: 5_000, service: 'Transport', cost: null },
    ]);
    expect(written.client).toEqual({ name: 'Adinan', phone: '0702301512' });
    expect(written.customerId).toBe('C019');
  });
});
