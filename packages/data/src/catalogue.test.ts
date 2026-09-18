/**
 * The catalogue, off rows shaped like the shop's real ones.
 *
 * Verified whole against production on 18 September 2026: 138 products,
 * 495 price rows, 130 shelf counts, 81 lots and 50 suppliers assemble into
 * **485 things to sell, nothing unreadable**, 396 of them priced and 58 on
 * the shelf — every one of those 58 with a cost on file.
 */

import { describe, expect, it } from 'vitest';
import { onShelf, rankedAtQty, shelfCost, stockKey } from '@ow/domain';
import { assembleCatalogue, variantIndex, variantLabel } from './catalogue.js';

const product = (over: Record<string, unknown> = {}): unknown => ({
  id: 'P044',
  name: 'Soft Close Mulper',
  category: 'Furniture',
  subcategory: 'Mulper Hinges',
  notes: '',
  image: 'https://example/p044.jpg',
  variants: [
    { sku: 'FLAT', combo: { 'Mulper Type': 'Flat' }, image: null },
    { sku: 'HALFBEND', combo: { 'Mulper Type': 'Half Bend' }, image: null },
  ],
  ...over,
});

const price = (over: Record<string, unknown> = {}): unknown => ({
  product_id: 'P044',
  supplier_id: 'S094',
  variant_idx: '1',
  wholesale: 150_000,
  retail: null,
  date: '2026-08-08',
  unit: 'Ctn',
  pack_unit: '',
  pack_qty: 1,
  tiers: [{ minQty: 1, price: 150_000 }],
  out_of_stock: false,
  out_of_stock_since: null,
  ...over,
});

const suppliers = [{ id: 'S094', name: 'Roto Industry' }];

const build = (
  products: readonly unknown[] = [product()],
  prices: readonly unknown[] = [price()],
  stock: readonly unknown[] = [],
  lots: readonly unknown[] = [],
) => assembleCatalogue(products, prices, stock, lots, suppliers);

describe('one thing per thing that can go on a line', () => {
  it('gives a simple product one entry, and a variable one per variant', () => {
    const simple = build([product({ variants: [] })], []);
    expect(simple.sellables.map((s) => s.name)).toEqual(['Soft Close Mulper']);

    expect(build().sellables.map((s) => s.name)).toEqual([
      'Soft Close Mulper — Flat',
      'Soft Close Mulper — Half Bend',
    ]);
  });

  it('codes a variant by its sku, and falls back to a position', () => {
    const noSku = build([product({ variants: [{ combo: { Size: '3M' } }] })], []);

    expect(build().sellables.map((s) => s.code)).toEqual(['FLAT', 'HALFBEND']);
    expect(noSku.sellables[0]?.code).toBe('P044-1');
  });

  it('names a variant from the attribute values the shop set', () => {
    expect(variantLabel({ Size: '3M', Material: 'Plastic' })).toBe('3M · Plastic');
    expect(variantLabel(null)).toBe('');
  });

  it('names what it could not read, and leaves it out', () => {
    const cat = build([product(), product({ id: 'P9', name: null }), product({ id: null })], []);

    expect(cat.sellables).toHaveLength(2);
    expect(cat.unreadable).toEqual(['P9 has no name', 'a product has no id']);
  });

  it('gives a variant its own picture, and the product’s where it has none', () => {
    const cat = build([
      product({ variants: [{ sku: 'A', combo: {}, image: 'own.jpg' }, { sku: 'B', combo: {} }] }),
    ], []);

    expect(cat.sellables.map((s) => s.image)).toEqual(['own.jpg', 'https://example/p044.jpg']);
  });
});

describe('a price finding its variant', () => {
  /**
   * `prices.variant_idx` is a TEXT column holding `"1"`, and a product's
   * variants are positions in an array. Compared as a number to a string it
   * matches nothing, and a product with three suppliers then reads as
   * unpriced — which the picker shows as "no price on file" and somebody
   * quotes from memory.
   */
  it('matches a text variant index to the variant at that position', () => {
    const cat = build();

    expect(cat.sellables[0]?.prices).toHaveLength(0);
    expect(cat.sellables[1]?.prices.map((p) => p.supplierName)).toEqual(['Roto Industry']);
  });

  it('reads an index however the books wrote it', () => {
    expect(variantIndex('1')).toBe(1);
    expect(variantIndex(1)).toBe(1);
    expect(variantIndex('0')).toBe(0);
    expect(variantIndex(null)).toBeNull();
    expect(variantIndex('')).toBeNull();
    expect(variantIndex('first')).toBeNull();
  });

  it('gives a simple product’s prices to the product itself', () => {
    const cat = build([product({ variants: [] })], [price({ variant_idx: null })]);
    expect(cat.sellables[0]?.prices).toHaveLength(1);
  });

  it('names the supplier, and falls back to the id where nothing names it', () => {
    const cat = assembleCatalogue([product()], [price({ supplier_id: 'S999' })], [], [], suppliers);
    expect(cat.sellables[1]?.prices[0]?.supplierName).toBe('S999');
  });

  it('carries the tiers, the pack and whether they have run out', () => {
    const cat = build(
      [product()],
      [price({ pack_qty: 100, tiers: [{ minQty: 100, price: 2_500 }], out_of_stock: true, out_of_stock_since: '2026-09-01' })],
    );
    const row = cat.sellables[1]?.prices[0];

    expect(row?.packQty).toBe(100);
    expect(row?.tiers).toEqual([{ minQty: 100, price: 2_500 }]);
    expect(row?.outOfStock).toBe(true);
    expect(row?.outOfStockSince).toBe('2026-09-01');
    // And so it is not somewhere to buy from.
    expect(rankedAtQty(cat.sellables[1]?.prices ?? [], 1)).toEqual([]);
  });

  it('drops a tier with no minQty rather than treating it as from one', () => {
    const cat = build([product()], [price({ tiers: [{ price: 9 }, { minQty: 5, price: 8 }] })]);
    expect(cat.sellables[1]?.prices[0]?.tiers).toEqual([{ minQty: 5, price: 8 }]);
  });
});

describe('the shelf', () => {
  it('meets its count and its lots under the same key', () => {
    const cat = build(
      [product()],
      [],
      [{ key: stockKey('P044', 1), qty: 8 }],
      [
        { key: stockKey('P044', 1), qty: 8, cost: 900, consign: null },
        { key: stockKey('P044', 0), qty: 3, cost: null, consign: 'S094' },
      ],
    );

    expect(cat.sellables[1]?.counted).toBe(8);
    expect(onShelf(cat.sellables[1]?.lots ?? [])).toBe(8);
    expect(shelfCost(cat.sellables[1]?.lots ?? []).status).toBe('known');
    // The other variant has goods it cannot cost, and they are somebody
    // else's goods at that.
    expect(shelfCost(cat.sellables[0]?.lots ?? []).status).toBe('unavailable');
    expect(cat.sellables[0]?.lots[0]?.consign).toBe('S094');
  });

  it('counts nothing rather than guessing where the shelf is silent', () => {
    const cat = build();
    expect(cat.sellables[0]?.counted).toBe(0);
    expect(cat.sellables[0]?.lots).toEqual([]);
  });
});
