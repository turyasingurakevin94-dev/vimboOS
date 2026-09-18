/**
 * What the shop sells, what it costs and who has it — the rules, ported.
 *
 * Every function here is the old app's, by name and by behaviour, because
 * every one of them has a shop's money behind it. Its comments record what
 * each was wrong about before it was fixed, and those cases are the tests:
 *
 *  - ranking suppliers on the flat wholesale column called one supplier
 *    cheapest while ticking another. On WISEUP Tape Measure 3M/Plastic,
 *    Annet Lak at 26,000/dozen was ranked below Shafik Katwe at 28,000
 *    purely for having no wholesale figure, and accepting the default paid
 *    2,000/dozen over the odds;
 *  - costing a single unit at the carton rate halved the recorded cost and
 *    doubled the reported margin;
 *  - selling off the shelf with no cost on file recorded zero, which reads
 *    as pure profit.
 *
 * None of it is re-derived here. A second opinion about what a supplier
 * charges is two prices for one purchase.
 */

import { known, partial, unavailable, type Derived } from './derived.js';
import * as Money from './money.js';

/** Which side of the book a price comes off. */
export type Side = 'wholesale' | 'retail';

/** A volume break: from `minQty` up, the unit price is `price`. */
export interface Tier {
  readonly minQty: number;
  readonly price: number | null;
}

/**
 * One supplier's price for one product, as the shop recorded it.
 *
 * Prices are plain numbers rather than `Money` on purpose: the books hold
 * fractions here. A supplier quoting 25,000 a carton of twelve is 2083.333…
 * a unit, and rounding at this level would change what a client is billed.
 * The rounding happens once, where a line is written.
 */
export interface PriceRow {
  readonly supplierId: string;
  readonly supplierName: string;
  readonly wholesale: number | null;
  readonly retail: number | null;
  /** The base unit the figures count in: `Pc`, `Dozen`, `Ctn`. */
  readonly unit: string;
  readonly packUnit: string;
  /** How many base units in a pack. 0 where the supplier sells no pack. */
  readonly packQty: number;
  readonly tiers: readonly Tier[];
  readonly outOfStock: boolean;
  /** When they ran out, where the books say. */
  readonly outOfStockSince: string | null;
  /** When the price was recorded. */
  readonly on: string | null;
  /** The supplier's own code for it — `CP-25H` on the quote in your hand. */
  readonly supplierSku: string | null;
}

/** The key stock, its FIFO lots and its log are all held under. */
export const stockKey = (productId: string, variantIdx: number | null): string =>
  variantIdx === null ? productId : `${productId}::${variantIdx}`;

/**
 * Which tiers count toward a side.
 *
 * Nothing declares which side a tier belongs to; its own `minQty` does. A
 * tier counts as wholesale only if it needs at least a full pack to unlock
 * — the same quantity-against-pack-size line used everywhere else to decide
 * between the two.
 */
export const tiersForSide = (row: PriceRow, side: Side): readonly Tier[] =>
  row.tiers.filter((t) =>
    side === 'wholesale'
      ? row.packQty > 0 && t.minQty >= row.packQty
      : row.packQty === 0 || t.minQty < row.packQty,
  );

/**
 * What this row charges per unit at this quantity, on one side of the book.
 *
 * The flat figure, unless a tier's `minQty` is cleared — and then the
 * HIGHEST such tier, not the first one found.
 */
export function tieredUnitPrice(row: PriceRow, qty: number, side: Side): number | null {
  const base = row[side];
  const tiers = tiersForSide(row, side);
  if (tiers.length === 0) return base;

  let best = base;
  let bestMinQty = 0;
  for (const tier of tiers) {
    if (tier.price !== null && qty >= tier.minQty && tier.minQty >= bestMinQty) {
      best = tier.price;
      bestMinQty = tier.minQty;
    }
  }
  return best;
}

/** Which side a quantity naturally earns: a full pack or more is wholesale. */
export const sideAtQty = (packQty: number, qty: number): Side =>
  packQty > 0 && qty >= packQty ? 'wholesale' : 'retail';

/**
 * What buying this quantity from this row would actually cost per unit.
 *
 * Whichever side the quantity earns, falling back to the other side when
 * the natural one has nothing on file at all. Ranking on the flat wholesale
 * column instead is what put a supplier who is cheap by the carton above
 * one who is cheaper for the single unit being bought — and labelled them
 * cheapest while doing it.
 */
export function purchasePriceAtQty(row: PriceRow, qty: number): number | null {
  const natural = sideAtQty(row.packQty, qty);
  const other: Side = natural === 'wholesale' ? 'retail' : 'wholesale';
  return tieredUnitPrice(row, qty, natural) ?? tieredUnitPrice(row, qty, other);
}

/** A row that can be bought from: out of stock is not a place to buy. */
export const canBuyFrom = (row: PriceRow): boolean => !row.outOfStock;

/**
 * Cheapest first, at the quantity actually being bought.
 *
 * The same ranking the buying list and the shelf's purchase screen use, so
 * all three name the same supplier as cheapest. A row nothing can price
 * sorts last rather than first — an unknown price is not a cheap one.
 */
export function rankedAtQty(
  rows: readonly PriceRow[],
  qty: number,
): readonly (PriceRow & { readonly at: number | null })[] {
  return rows
    .filter(canBuyFrom)
    .map((r) => ({ ...r, at: purchasePriceAtQty(r, qty) }))
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
}

/** A lot of stock on the shelf, oldest first, at what it cost. */
export interface Lot {
  readonly qty: number;
  readonly cost: number | null;
  /** The supplier it still belongs to, where it is somebody else's goods. */
  readonly consign: string | null;
}

/**
 * What a unit off the shelf cost, taken from the oldest lot that has one.
 *
 * `unavailable` rather than zero where nothing on the shelf records a cost.
 * Zero reads as pure profit — the exact defect the old app's own comment
 * names — and a margin computed from it is wrong in the direction that
 * makes somebody sell at a loss and feel good about it.
 */
export function shelfCost(lots: readonly Lot[]): Derived<number> {
  const priced = lots.find((l) => l.qty > 0 && l.cost !== null);
  if (priced?.cost !== undefined && priced.cost !== null) {
    return known(priced.cost, 'the oldest lot on the shelf');
  }

  const onShelf = lots.filter((l) => l.qty > 0);
  return unavailable(
    onShelf.length === 0
      ? 'nothing is on the shelf'
      : `${onShelf.length === 1 ? 'the lot on the shelf has' : `none of the ${onShelf.length} lots on the shelf have`} a cost recorded`,
  );
}

/** How much is on the shelf. */
export const onShelf = (lots: readonly Lot[]): number =>
  lots.reduce((n, l) => n + (l.qty > 0 ? l.qty : 0), 0);

/** Goods on the shelf that still belong to the supplier who left them. */
export const consigned = (lots: readonly Lot[]): readonly string[] => [
  ...new Set(
    lots.flatMap((l) => (l.qty > 0 && l.consign !== null ? [l.consign] : [])),
  ),
];

/* -------------------------------------------------------------------------- *
 * What a line costs the shop
 * -------------------------------------------------------------------------- */

/** The sentinel the old app uses for a line sold off the shop's own shelf. */
export const OWN_SHELF = '__stock__';

/**
 * What one quote line actually costs the shop.
 *
 * Named `costOfLine` and not `lineCost`: `quote.ts` already has a `lineCost`
 * that reads the cost off a line already built. This one works it out from
 * the catalogue, before there is a line at all.
 *
 * Off the shelf it is what the shelf cost; from a supplier it is what that
 * supplier charges AT THIS QUANTITY. Where a shelf line has no cost on file
 * the answer is the cheapest supplier's price — what it would take to put
 * the unit back — and it says so, because that is an estimate of a
 * replacement rather than a record of a purchase.
 */
export function costOfLine(
  supplierId: string,
  ranked: readonly (PriceRow & { readonly at: number | null })[],
  qty: number,
  shelf: Derived<number>,
): Derived<number> {
  if (supplierId === OWN_SHELF) {
    if (shelf.status === 'known') return known(shelf.value, 'what this stock cost');
    const cheapest = ranked[0];
    const back = cheapest === undefined ? null : cheapest.at;
    return back === null
      ? unavailable('nothing on the shelf has a cost, and no supplier prices it either')
      : partial(back, `${cheapest?.supplierName ?? 'a supplier'} would charge this`, 'this is what replacing it would cost, not what it cost');
  }

  const row = ranked.find((r) => r.supplierId === supplierId);
  const at = row === undefined ? null : row.at;
  return at === null
    ? unavailable(`nothing on file says what ${row?.supplierName ?? 'that supplier'} charges`)
    : known(at, `${row?.supplierName ?? 'the supplier'} at ${qty}`);
}

/**
 * The line cost as money, rounded once, at the point it is written down.
 *
 * Everything above is a plain number because the books hold fractions; this
 * is the one place a figure stops being arithmetic and becomes a shilling.
 */
export const asShillings = (amount: number): Money.Money => Money.roundDown(amount);

/* -------------------------------------------------------------------------- *
 * Finding it
 * -------------------------------------------------------------------------- */

/**
 * The words in a query, in any order.
 *
 * Split on whitespace so `black plug` finds anything whose text holds BOTH
 * `black` AND `plug`, rather than only the exact phrase. That is how
 * somebody types when a customer is telling them what they want.
 */
export const searchWords = (query: string): readonly string[] =>
  query.trim().toLowerCase().split(/\s+/).filter((w) => w !== '');

/** Anything that can be looked for: a line, and everything it answers to. */
export interface Findable {
  /** Everything a person might type to find it, lower case. */
  readonly findBy: string;
}

/** Every word, or it is not a match. */
export const matchesAll = (findBy: string, words: readonly string[]): boolean =>
  words.every((w) => findBy.includes(w));

/**
 * What a query finds, in the order the list should draw them.
 *
 * An empty query finds everything — the picker opens on the whole
 * catalogue, which is how somebody browses when they do not know the word.
 *
 * Ordered by where the match landed, because a person typing `mulper` means
 * the thing called Mulper and not the one whose notes mention one. A name
 * match comes first, then a code match, then everything else, and within
 * each the shop's own order is kept so the list does not reshuffle under
 * the eye on every keystroke.
 */
export function find<T extends Findable & { readonly name: string; readonly code: string }>(
  everything: readonly T[],
  query: string,
): readonly T[] {
  const words = searchWords(query);
  if (words.length === 0) return everything;

  const hit = everything.filter((it) => matchesAll(it.findBy, words));
  const rank = (it: T): number => {
    const name = it.name.toLowerCase();
    if (words.every((w) => name.includes(w))) return 0;
    const code = it.code.toLowerCase();
    if (words.every((w) => code.includes(w))) return 1;
    return 2;
  };

  return hit
    .map((it, at) => ({ it, at, rank: rank(it) }))
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .map(({ it }) => it);
}
