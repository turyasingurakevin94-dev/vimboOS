/**
 * The pricing rules, against the cases that made them what they are.
 *
 * Every one of these is a real thing that went wrong in the shop, recorded
 * in the old app's own comments beside the fix. They are the tests because
 * they are the only proof that the port kept the fix and not just the
 * shape.
 */

import { describe, expect, it } from 'vitest';
import {
  OWN_SHELF,
  consigned,
  costOfLine,
  find,
  onShelf,
  purchasePriceAtQty,
  rankedAtQty,
  shelfCost,
  sideAtQty,
  stockKey,
  tieredUnitPrice,
  tiersForSide,
  type Lot,
  type PriceRow,
} from './catalogue.js';
import { known } from './derived.js';

const row = (over: Partial<PriceRow> = {}): PriceRow => ({
  supplierId: 'S094',
  supplierName: 'Roto Industry',
  wholesale: 150_000,
  retail: null,
  unit: 'Ctn',
  packUnit: '',
  packQty: 1,
  tiers: [],
  outOfStock: false,
  outOfStockSince: null,
  on: '2026-08-08',
  supplierSku: null,
  ...over,
});

describe('where stock is kept', () => {
  it('keys a simple product by itself and a variant by its position', () => {
    expect(stockKey('P197', null)).toBe('P197');
    expect(stockKey('P073', 3)).toBe('P073::3');
  });
});

describe('which side of the book a quantity earns', () => {
  it('is wholesale from a full pack, and retail below it', () => {
    expect(sideAtQty(12, 12)).toBe('wholesale');
    expect(sideAtQty(12, 11)).toBe('retail');
    // No pack means no wholesale side to earn.
    expect(sideAtQty(0, 1_000)).toBe('retail');
  });

  /**
   * Nothing declares which side a tier belongs to; its own minQty does.
   * One shared list, split by the same pack line used everywhere else.
   */
  it('splits one tier list by the pack size, not by a label', () => {
    const tiered = row({
      packQty: 10,
      tiers: [
        { minQty: 1, price: 150_000 },
        { minQty: 10, price: 145_000 },
        { minQty: 50, price: 140_000 },
      ],
    });

    expect(tiersForSide(tiered, 'wholesale').map((t) => t.minQty)).toEqual([10, 50]);
    expect(tiersForSide(tiered, 'retail').map((t) => t.minQty)).toEqual([1]);
  });

  it('gives every tier to retail where the supplier sells no pack', () => {
    const flat = row({ packQty: 0, tiers: [{ minQty: 10, price: 9 }] });
    expect(tiersForSide(flat, 'retail')).toHaveLength(1);
    expect(tiersForSide(flat, 'wholesale')).toHaveLength(0);
  });
});

describe('what a row charges at a quantity', () => {
  const tiered = row({
    packQty: 10,
    wholesale: 150_000,
    retail: 160_000,
    tiers: [
      { minQty: 10, price: 145_000 },
      { minQty: 50, price: 140_000 },
    ],
  });

  it('takes the HIGHEST tier the quantity clears, not the first', () => {
    expect(tieredUnitPrice(tiered, 9, 'wholesale')).toBe(150_000);
    expect(tieredUnitPrice(tiered, 10, 'wholesale')).toBe(145_000);
    expect(tieredUnitPrice(tiered, 200, 'wholesale')).toBe(140_000);
  });

  it('falls back to the flat figure where no tier applies to that side', () => {
    expect(tieredUnitPrice(tiered, 200, 'retail')).toBe(160_000);
  });

  /**
   * Costing a single unit at the carton rate halved the recorded cost and
   * doubled the reported margin. The quantity decides the side.
   */
  it('does not charge a single unit at the carton rate', () => {
    const byCarton = row({ packQty: 12, wholesale: 15_000, retail: 30_000 });

    expect(purchasePriceAtQty(byCarton, 1)).toBe(30_000);
    expect(purchasePriceAtQty(byCarton, 12)).toBe(15_000);
  });

  it('falls back to the other side where the natural one has nothing on file', () => {
    const wholesaleOnly = row({ packQty: 12, wholesale: 15_000, retail: null });
    expect(purchasePriceAtQty(wholesaleOnly, 1)).toBe(15_000);
  });
});

describe('who to buy from', () => {
  /**
   * WISEUP Tape Measure 3M/Plastic. Annet Lak at 26,000 a dozen, retail
   * only; Shafik Katwe at 28,000, with a wholesale figure. Ranking on the
   * wholesale column put Annet Lak last for having no figure in it, and
   * accepting the default paid 2,000 a dozen over the odds.
   */
  it('ranks by what each would actually charge, not by the wholesale column', () => {
    const annet = row({ supplierId: 'S1', supplierName: 'Annet Lak', wholesale: null, retail: 26_000, packQty: 0 });
    const shafik = row({ supplierId: 'S2', supplierName: 'Shafik Katwe', wholesale: 28_000, retail: 30_000, packQty: 0 });

    expect(rankedAtQty([shafik, annet], 1).map((r) => r.supplierName)).toEqual([
      'Annet Lak',
      'Shafik Katwe',
    ]);
  });

  it('sorts a row nothing can price last — an unknown price is not a cheap one', () => {
    const blind = row({ supplierId: 'S3', supplierName: 'Nobody', wholesale: null, retail: null });
    const priced = row({ supplierId: 'S4', supplierName: 'Somebody', wholesale: 99_000, packQty: 0 });

    expect(rankedAtQty([blind, priced], 1).map((r) => r.supplierName)).toEqual([
      'Somebody',
      'Nobody',
    ]);
  });

  it('never recommends a supplier who has run out', () => {
    const out = row({ supplierId: 'S5', supplierName: 'Gone', wholesale: 1, outOfStock: true });
    const here = row({ supplierId: 'S6', supplierName: 'Here', wholesale: 100, packQty: 0 });

    expect(rankedAtQty([out, here], 1).map((r) => r.supplierName)).toEqual(['Here']);
  });
});

describe('what is on the shelf, and what it cost', () => {
  const lot = (over: Partial<Lot> = {}): Lot => ({ qty: 50, cost: 900, consign: null, ...over });

  it('costs a unit at the oldest lot that records one', () => {
    const cost = shelfCost([lot({ qty: 0, cost: 100 }), lot({ cost: 900 }), lot({ cost: 950 })]);
    expect(cost.status === 'known' ? cost.value : null).toBe(900);
  });

  /**
   * Selling off the shelf with no cost on file recorded zero, which reads
   * as pure profit — and a margin computed from it is wrong in the
   * direction that makes somebody sell at a loss and feel good about it.
   */
  it('has no cost rather than a cost of nothing', () => {
    expect(shelfCost([lot({ cost: null })]).status).toBe('unavailable');
    expect(shelfCost([]).status).toBe('unavailable');
  });

  it('says which of the two it is', () => {
    const empty = shelfCost([]);
    const blind = shelfCost([lot({ cost: null })]);

    expect(empty.status === 'unavailable' ? empty.reason : '').toBe('nothing is on the shelf');
    expect(blind.status === 'unavailable' ? blind.reason : '').toContain('has a cost recorded');
  });

  it('counts what is there and names whose it is', () => {
    const lots = [lot({ qty: 10 }), lot({ qty: 5, consign: 'S094' }), lot({ qty: 0 })];

    expect(onShelf(lots)).toBe(15);
    expect(consigned(lots)).toEqual(['S094']);
  });
});

describe('what a line costs the shop', () => {
  const cheapest = rankedAtQty(
    [row({ supplierId: 'S1', supplierName: 'Roto', wholesale: 12_000, packQty: 0 })],
    1,
  );

  it('costs a shelf line at what that stock cost', () => {
    const cost = costOfLine(OWN_SHELF, cheapest, 1, known(900, 'the oldest lot'));
    expect(cost.status === 'known' ? cost.value : null).toBe(900);
  });

  /**
   * A shelf line with no cost on file is priced at what putting the unit
   * back would take — and says so, because that is an estimate of a
   * replacement, not a record of a purchase.
   */
  it('estimates a costless shelf line, and calls it an estimate', () => {
    const cost = costOfLine(OWN_SHELF, cheapest, 1, shelfCost([]));

    expect(cost.status).toBe('partial');
    expect(cost.status === 'partial' ? cost.value : null).toBe(12_000);
    expect(cost.status === 'partial' ? cost.missing : '').toContain('replacing it would cost');
  });

  it('costs a bought-in line at what that supplier charges for that quantity', () => {
    const cost = costOfLine('S1', cheapest, 1, shelfCost([]));
    expect(cost.status === 'known' ? cost.value : null).toBe(12_000);
  });

  it('has no cost for a supplier nothing on file prices', () => {
    const blind = rankedAtQty(
      [row({ supplierId: 'S9', supplierName: 'Nobody', wholesale: null, retail: null })],
      1,
    );
    expect(costOfLine('S9', blind, 1, shelfCost([])).status).toBe('unavailable');
  });
});

describe('finding it', () => {
  const thing = (name: string, code: string, findBy = ''): {
    readonly name: string;
    readonly code: string;
    readonly findBy: string;
  } => ({ name, code, findBy: `${name} ${code} ${findBy}`.toLowerCase() });

  const shelf = [
    thing('Soft Close Mulper — Flat', 'FLAT', 'Furniture Mulper Hinges P044'),
    thing('Wheelbarrow 90L', 'P101', 'the heavy duty barrow, comes on Kadde’s van'),
    thing('Black Plug 13A', 'CP-25H', 'Electrical'),
    thing('Plug Top Black', 'P202', 'Electrical'),
  ];

  /**
   * Split on whitespace so both words must be there, in any order — which
   * is how somebody types when a customer is telling them what they want.
   */
  it('wants every word, and does not care about their order', () => {
    expect(find(shelf, 'black plug').map((t) => t.code)).toEqual(['CP-25H', 'P202']);
    expect(find(shelf, 'plug black').map((t) => t.code)).toEqual(['CP-25H', 'P202']);
    expect(find(shelf, 'black mulper')).toEqual([]);
  });

  /**
   * The short description and the notes are the two fields that exist to
   * hold the words nobody thinks to put in a name. A search that cannot see
   * them says "no matching products" about something the shop is holding.
   */
  it('finds it by what somebody would call it, not only by its name', () => {
    expect(find(shelf, 'heavy duty').map((t) => t.code)).toEqual(['P101']);
    expect(find(shelf, 'kadde').map((t) => t.code)).toEqual(['P101']);
  });

  /** A code is written down precisely so it can be typed back in. */
  it('finds it by the supplier’s own code', () => {
    expect(find(shelf, 'cp-25h').map((t) => t.name)).toEqual(['Black Plug 13A']);
  });

  it('puts a name match above a note that merely mentions it', () => {
    const mentions = [
      thing('Hinge Screws', 'P300', 'use with the mulper'),
      thing('Mulper Bracket', 'P301', ''),
    ];
    expect(find(mentions, 'mulper').map((t) => t.code)).toEqual(['P301', 'P300']);
  });

  it('opens on everything, because browsing is how you look without a word', () => {
    expect(find(shelf, '')).toHaveLength(4);
    expect(find(shelf, '   ')).toHaveLength(4);
  });

  it('is not case sensitive about anything', () => {
    expect(find(shelf, 'SOFT CLOSE').map((t) => t.code)).toEqual(['FLAT']);
  });
});
