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
  NO_MARKUPS,
  OWN_SHELF,
  consigned,
  costOfLine,
  choose,
  find,
  markupFor,
  onShelf,
  purchasePriceAtQty,
  rankedAtQty,
  shelfCost,
  sideAtQty,
  sideBought,
  sideSold,
  sourceOf,
  priceFrom,
  suggestedSell,
  stockKey,
  tieredUnitPrice,
  tiersForSide,
  type Lot,
  type PriceRow,
} from './catalogue.js';
import { known, match, type Derived } from './derived.js';

/** A suggested price, or null where none could be worked out. */
const sell = (at: Derived<number>): number | null =>
  match(at, { known: (n) => n, partial: (n) => n, unavailable: () => null });

/** The sentence the picker prints under the price box. */
const basis = (at: Derived<number>): string | null =>
  match(at, { known: (_n, b) => b, partial: (_n, b) => b, unavailable: () => null });

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

describe('what to charge for it', () => {
  const cheap = row({ wholesale: 250_000, retail: null, packQty: 0 });

  /**
   * A fixed wholesale markup is an amount added to the PACK price, not to
   * the unit price — wholesale is bought and sold by the pack. `+10,000` on
   * a 300,000 carton is 310,000 a carton, which is 15,500 a dozen and not
   * 310,000 a dozen.
   */
  it('adds a fixed wholesale markup to the pack, not to the unit', () => {
    const rule = { kind: 'fixed' as const, value: 10_000, from: 'product' as const };

    expect(sell(suggestedSell(25_000, rule, 'wholesale', 20))).toBe(25_500);
    // No pack to convert through, so it applies directly.
    expect(sell(suggestedSell(25_000, rule, 'wholesale', 0))).toBe(35_000);
    // Retail never converts: it is not bought by the pack.
    expect(sell(suggestedSell(25_000, rule, 'retail', 20))).toBe(35_000);
  });

  it('scales a percent the same whichever way it is worked out', () => {
    const rule = { kind: 'percent' as const, value: 20, from: 'product' as const };
    expect(sell(suggestedSell(250_000, rule, 'wholesale', 100))).toBe(300_000);
    expect(sell(suggestedSell(250_000, rule, 'retail', 0))).toBe(300_000);
  });

  /**
   * The shop has not said what it charges for this. Filling the box with
   * the cost, or with nothing plus a guess, is how a price nobody agreed
   * ends up on a quote.
   */
  it('has no price rather than a made-up one where no rule is set', () => {
    expect(suggestedSell(250_000, null, 'retail', 0).status).toBe('unavailable');
  });

  /**
   * Bow Saw Blade — Bahco, off the shop's own books: 9,800 a blade, a
   * `+10,000` carton rule over a pack of ten, which is the 10,800 the price
   * box fills in. The hint under it used to read `+10000 on 9800` — the
   * rule's own figure, unformatted, describing a price ten times the one
   * beside it.
   */
  it('names the markup it applied, not the rule it came from', () => {
    const carton = { kind: 'fixed' as const, value: 10_000, from: 'product' as const };
    const applied = suggestedSell(9_800, carton, 'wholesale', 10);

    expect(sell(applied)).toBe(10_800);
    expect(basis(applied)).toBe('+1,000 on 9,800');

    // Nothing to convert through, so the rule's figure IS what was applied.
    expect(basis(suggestedSell(250_000, carton, 'wholesale', 0))).toBe('+10,000 on 250,000');
    // A percent is the same either way, and it is the rule that is quoted.
    const fifth = { kind: 'percent' as const, value: 20, from: 'product' as const };
    expect(basis(suggestedSell(250_000, fifth, 'retail', 0))).toBe('+20% on 250,000');
  });

  /** A basis a person can check: the two figures in it add to the price. */
  it('writes a basis whose arithmetic works out', () => {
    const rule = { kind: 'fixed' as const, value: 10_000, from: 'product' as const };
    const applied = suggestedSell(15_000, rule, 'wholesale', 20);
    const [added, on] = (basis(applied) ?? '').split(' on ');

    expect(Number((added ?? '').replace(/[+,]/g, '')) + Number((on ?? '').replace(/,/g, ''))).toBe(
      sell(applied),
    );
  });

  it('prices the shelf by the shelf rule and a bought-in line by the other', () => {
    const markups = {
      wholesale: { kind: 'percent' as const, value: 10, from: 'product' as const },
      retail: { kind: 'percent' as const, value: 40, from: 'product' as const },
      stockWholesale: { kind: 'percent' as const, value: 15, from: 'product-stock' as const },
      stockRetail: { kind: 'percent' as const, value: 50, from: 'product-stock' as const },
    };

    expect(markupFor(markups, 'retail', false)?.value).toBe(40);
    expect(markupFor(markups, 'retail', true)?.value).toBe(50);
    expect(markupFor(markups, 'wholesale', true)?.value).toBe(15);
  });

  /**
   * Half this shop's catalogue is carton-only — a wholesale rate and no
   * retail anything — so a quantity under the pack still gets a price, out
   * of the WHOLESALE column. Asking the retail markup rule about it is
   * asking about a column the money did not come from, and 311 of 485
   * things here carry a perfectly good wholesale rule that was being
   * reported as none.
   */
  it('sells off the column the money came out of', () => {
    const cartonOnly = row({ wholesale: 250_000, retail: null, packQty: 100 });

    // One unit: the natural side is retail, and retail has nothing.
    expect(sideBought(cartonOnly, 1)).toBe('wholesale');
    expect(sideSold(cartonOnly, 1, 100, NO_MARKUPS, false)).toBe('wholesale');
  });

  /**
   * Off the shelf there are no columns to read at all. The shop having set
   * a wholesale markup and left retail empty IS the shop saying which side
   * it sells at.
   */
  it('sells off the side the shop has a rule for, where there is no row', () => {
    const wholesaleOnly = {
      ...NO_MARKUPS,
      wholesale: { kind: 'fixed' as const, value: 15_000, from: 'product' as const },
      stockWholesale: { kind: 'fixed' as const, value: 15_000, from: 'product' as const },
    };

    expect(sideSold(null, 1, 100, wholesaleOnly, true)).toBe('wholesale');
    // And with rules on both sides, the quantity decides, exactly as ever.
    const both = {
      ...wholesaleOnly,
      retail: { kind: 'percent' as const, value: 40, from: 'product' as const },
      stockRetail: { kind: 'percent' as const, value: 40, from: 'product' as const },
    };
    expect(sideSold(null, 1, 100, both, true)).toBe('retail');
    expect(sideSold(null, 100, 100, both, true)).toBe('wholesale');
  });

  /**
   * The shop's own first line, off its own books: Soft Close Mulper — Half
   * Bend at 250,000 from Roto Industry with a `+15,000 fixed` rule, which
   * is the 265,000 the Quote mockup was drawn with.
   */
  it('reaches the figure the mockup was drawn with', () => {
    const rule = { kind: 'fixed' as const, value: 15_000, from: 'product' as const };
    const side = sideSold(cheap, 1, 0, { ...NO_MARKUPS, wholesale: rule }, false);

    expect(side).toBe('wholesale');
    expect(sell(suggestedSell(250_000, rule, side, 0))).toBe(265_000);
  });
});

describe('choosing one', () => {
  const lot = (over: Partial<Lot> = {}): Lot => ({ qty: 8, cost: 1_900, consign: null, ...over });

  const thing = (over: Partial<Parameters<typeof choose>[0]> = {}) => ({
    name: 'Soft Close Mulper — Half Bend',
    // The shape half this shop's catalogue is in: one supplier carton-only
    // with no retail figure at all, one selling loose.
    prices: [
      row({ supplierId: 'S094', supplierName: 'Roto Industry', wholesale: 2_300, retail: null, packQty: 100 }),
      row({ supplierId: 'S012', supplierName: 'Shafik Katwe', wholesale: null, retail: 2_600, packQty: 0 }),
    ],
    lots: [] as readonly Lot[],
    counted: 0,
    markups: { ...NO_MARKUPS, wholesale: { kind: 'fixed' as const, value: 15_000, from: 'product' as const } },
    ...over,
  });

  /**
   * That is how a sale off the shelf should be recorded. The ranking only
   * decides who to BUY from when there is nothing on the shelf to sell.
   */
  it('rests on the shelf where there is stock, and on the cheapest where there is not', () => {
    expect(choose(thing({ lots: [lot()] }), 1).restsOn).toBe(OWN_SHELF);
    // Roto is carton-only, so even one unit prices off its wholesale rate
    // — 2,300 against Shafik's 2,600 loose.
    expect(choose(thing(), 1).restsOn).toBe('S094');
    expect(choose(thing(), 100).restsOn).toBe('S094');
  });

  it('lists the shelf as a source, and never marks it best', () => {
    const c = choose(thing({ lots: [lot()] }), 1);

    expect(c.sources.map((x) => x.name)).toEqual(['Our stock', 'Roto Industry', 'Shafik Katwe']);
    expect(c.sources.find((x) => x.id === OWN_SHELF)?.best).toBe(false);
    expect(c.sources.filter((x) => x.best).map((x) => x.name)).toEqual(['Roto Industry']);
  });

  /**
   * The card called every shelf line OUR STOCK and priced it "bought at",
   * which is a purchase that never happened when a consignor left the goods
   * and is still owed for them.
   */
  it('says whose the goods on the shelf are', () => {
    const c = choose(thing({ lots: [lot({ consign: 'Roto Industry' })] }), 1);
    expect(c.sources[0]?.consignedTo).toBe('Roto Industry');
  });

  /**
   * "The cheapest supplier is out of stock" and "nobody has this at all"
   * looked identical once: an empty space where a price should be.
   */
  it('names who has run out, and says when nobody has it', () => {
    const someGone = thing({
      prices: [
        row({ supplierId: 'S094', supplierName: 'Roto Industry', retail: 2_300, outOfStock: true, outOfStockSince: '2026-09-04' }),
        row({ supplierId: 'S012', supplierName: 'Shafik Katwe', retail: 2_600, packQty: 0 }),
      ],
    });
    const allGone = thing({
      prices: [row({ supplierId: 'S094', supplierName: 'Roto Industry', retail: 2_300, outOfStock: true })],
    });

    expect(choose(someGone, 1).runOut).toEqual([{ name: 'Roto Industry', since: '2026-09-04' }]);
    expect(choose(someGone, 1).nobodyHasIt).toBe(false);
    expect(choose(allGone, 1).nobodyHasIt).toBe(true);
    // And with stock on the shelf, somebody does have it.
    expect(choose(thing({ prices: allGone.prices, lots: [lot()] }), 1).nobodyHasIt).toBe(false);
  });

  it('prices off the source that is chosen, by the column the money came from', () => {
    const c = choose(thing(), 1);
    const roto = sourceOf(c, 'S094');
    const shafik = sourceOf(c, 'S012');

    // Roto is carton-only, so one unit still prices off the WHOLESALE
    // column — and the wholesale rule is the one that applies, +15,000 on
    // a carton of 100, which is +150 a unit.
    expect(roto === null ? null : sell(priceFrom(thing(), roto, 1))).toBe(2_450);
    // Shafik has no pack and no wholesale figure, so retail — and the shop
    // set no retail rule, so there is nothing to charge.
    expect(shafik === null ? 'x' : priceFrom(thing(), shafik, 1).status).toBe('unavailable');
  });

  it('has no price at all where the source cannot be costed', () => {
    const blind = thing({ lots: [lot({ cost: null })] });
    const shelf = sourceOf(choose(blind, 1), OWN_SHELF);

    expect(shelf).not.toBeNull();
    expect(shelf === null ? '' : priceFrom(blind, shelf, 1).status).toBe('unavailable');
  });
});
