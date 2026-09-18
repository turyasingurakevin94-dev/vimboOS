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

import { known, map, match, partial, unavailable, type Derived } from './derived.js';
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
 * Which side the money actually came off — which `purchasePriceAtQty` knows
 * and does not say.
 *
 * The fallback is the point. Half this shop's catalogue is carton-only,
 * with a wholesale rate and no retail anything, so a quantity under the
 * pack still gets a price — out of the WHOLESALE column. Anything that then
 * asks the RETAIL markup rule about it is asking about a column the money
 * did not come from, and a product carrying a perfectly good rule for the
 * tier it is really sold at is reported as having none.
 *
 * Kept beside `purchasePriceAtQty`, in the same words, so the two cannot
 * drift into disagreeing about which column they mean.
 */
export function sideBought(row: PriceRow, qty: number): Side | null {
  const natural = sideAtQty(row.packQty, qty);
  const other: Side = natural === 'wholesale' ? 'retail' : 'wholesale';
  if (tieredUnitPrice(row, qty, natural) !== null) return natural;
  return tieredUnitPrice(row, qty, other) !== null ? other : null;
}

/**
 * Which side a line is actually SOLD at, in order of how hard the evidence
 * is.
 *
 * 1. The column the money came out of, where there is a supplier row to
 *    read it off. That is a fact about the money, not a guess.
 * 2. The side the shop has a RULE for, where only one side has one. This is
 *    what a carton-only catalogue looks like from the shelf, where there
 *    are no columns to read: the shop set a wholesale markup and left
 *    retail empty, and that IS the shop saying which side it sells at. On
 *    these books 311 of 485 things are exactly that.
 * 3. The quantity against the pack, as ever.
 *
 * Never a guess between two real answers: with rules on both sides and no
 * row to read, the quantity decides.
 */
export function sideSold(
  row: PriceRow | null,
  qty: number,
  packQty: number,
  markups: Markups,
  offTheShelf: boolean,
): Side {
  const natural = sideAtQty(packQty, qty);
  const other: Side = natural === 'wholesale' ? 'retail' : 'wholesale';

  const fromRow = row === null ? null : sideBought(row, qty);
  if (fromRow !== null) return fromRow;

  const hasNatural = markupFor(markups, natural, offTheShelf) !== null;
  const hasOther = markupFor(markups, other, offTheShelf) !== null;
  return !hasNatural && hasOther ? other : natural;
}

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

/* -------------------------------------------------------------------------- *
 * What to charge for it
 * -------------------------------------------------------------------------- */

/** How a markup is written: an amount added, or a share of the cost. */
export type MarkupKind = 'fixed' | 'percent';

/** Where the rule that priced this came from. Said on screen, never guessed. */
export type MarkupFrom = 'variant' | 'product' | 'shop' | 'variant-stock' | 'product-stock';

export interface Markup {
  readonly kind: MarkupKind;
  readonly value: number;
  readonly from: MarkupFrom;
}

/**
 * The four rules that can price a line, already resolved.
 *
 * Resolved where the product row and its variant are both in hand, rather
 * than looked up again per keystroke: a variant's own rule beats the
 * product's, which beats the shop's default, and the shelf has its own pair
 * that falls through to the other two. Four lookups with three fallbacks
 * each is exactly the sort of thing that gets half-remembered at the call
 * site.
 */
export interface Markups {
  readonly wholesale: Markup | null;
  readonly retail: Markup | null;
  /** What the counter charges for something already on the shelf. */
  readonly stockWholesale: Markup | null;
  readonly stockRetail: Markup | null;
}

export const NO_MARKUPS: Markups = {
  wholesale: null,
  retail: null,
  stockWholesale: null,
  stockRetail: null,
};

/**
 * What to charge, from what it cost.
 *
 * **A fixed wholesale markup is an amount added to the PACK price**, not to
 * the unit price — wholesale is bought and sold by the pack, so `+10,000` on
 * a 300,000 carton is 310,000 a carton, which is 15,500 a dozen and not
 * 310,000 a dozen. A percent scales the same either way, so only `fixed`
 * needs the conversion.
 *
 * `unavailable` where no rule applies: the shop has not said what it charges
 * for this, and inventing a figure to fill the box is how a price nobody
 * agreed ends up on a quote.
 */
export function suggestedSell(
  cost: number,
  markup: Markup | null,
  side: Side,
  packQty: number,
): Derived<number> {
  if (markup === null) {
    return unavailable('no markup rule is set for this, so nothing says what to charge');
  }

  const basis = `${markup.kind === 'fixed' ? `+${markup.value}` : `+${markup.value}%`} on ${cost}`;

  if (markup.kind === 'fixed') {
    const perUnit = side === 'wholesale' && packQty > 0 ? markup.value / packQty : markup.value;
    return known(cost + perUnit, basis);
  }

  return known(cost * (1 + markup.value / 100), basis);
}

/** Which of the four rules prices this line. */
export const markupFor = (
  markups: Markups,
  side: Side,
  offTheShelf: boolean,
): Markup | null =>
  offTheShelf
    ? (side === 'wholesale' ? markups.stockWholesale : markups.stockRetail)
    : (side === 'wholesale' ? markups.wholesale : markups.retail);

/* -------------------------------------------------------------------------- *
 * Choosing one: everything the picker has to say about a thing at a quantity
 * -------------------------------------------------------------------------- */

/** Anything that can be put on a quote, with everything known about it. */
export interface Choosable {
  readonly name: string;
  readonly prices: readonly PriceRow[];
  readonly lots: readonly Lot[];
  readonly counted: number;
  readonly markups: Markups;
}

/** One place the goods could come from, and what it would cost from there. */
export interface Source {
  /** A supplier id, or {@link OWN_SHELF}. */
  readonly id: string;
  readonly name: string;
  /** What one unit costs from here, at this quantity. */
  readonly at: Derived<number>;
  /** The pack this source sells in. */
  readonly packUnit: string;
  readonly packQty: number;
  readonly unit: string;
  /** How many are here right now, where that is knowable. */
  readonly have: number | null;
  /** Cheapest of the suppliers at this quantity. The shelf is never "best". */
  readonly best: boolean;
  /** Whose goods these are, where they are not the shop's. */
  readonly consignedTo: string | null;
}

/** What the picker draws once a thing has been chosen. */
export interface Choice {
  readonly sources: readonly Source[];
  /** The one picked at rest: the shelf where there is stock, else cheapest. */
  readonly restsOn: string | null;
  /** How many are on the shelf, whoever's they are. */
  readonly onShelf: number;
  /** Suppliers who have run out, and since when. Said, not silently dropped. */
  readonly runOut: readonly { readonly name: string; readonly since: string | null }[];
  /** True when nobody has it — a different sentence from "the cheapest is out". */
  readonly nobodyHasIt: boolean;
}

/**
 * Everything the picker needs about one thing at one quantity.
 *
 * The shelf is a source like any other, and it rests there when there is
 * stock — that is how a sale off the shelf should be recorded, and the
 * ranking only decides who to BUY from when there is nothing to sell.
 *
 * Suppliers who have run out are named rather than dropped. The picker used
 * to simply not list them, so "the cheapest supplier is out of stock" and
 * "nobody has this at all" looked identical: an empty space where a price
 * should be.
 */
export function choose(thing: Choosable, qty: number): Choice {
  const ranked = rankedAtQty(thing.prices, qty);
  const shelf = onShelf(thing.lots);
  const cost = shelfCost(thing.lots);
  const context = ranked[0] ?? thing.prices[0] ?? null;

  const sources: Source[] = [];

  if (shelf > 0 || cost.status === 'known') {
    const holders = consigned(thing.lots);
    sources.push({
      id: OWN_SHELF,
      name: 'Our stock',
      at: cost,
      packUnit: context?.packUnit ?? '',
      packQty: context?.packQty ?? 0,
      unit: context?.unit ?? '',
      have: shelf,
      best: false,
      // The card called every shelf line OUR STOCK and priced it "bought
      // at", which is a purchase that never happened when a consignor left
      // the goods and is still owed for them.
      consignedTo: holders[0] ?? null,
    });
  }

  ranked.forEach((row, at) => {
    sources.push({
      id: row.supplierId,
      name: row.supplierName,
      at:
        row.at === null
          ? unavailable(`nothing on file says what ${row.supplierName} charges`)
          : known(row.at, `${row.supplierName}, ${qty} at a time`),
      packUnit: row.packUnit,
      packQty: row.packQty,
      unit: row.unit,
      have: null,
      best: at === 0 && row.at !== null,
      consignedTo: null,
    });
  });

  const runOut = thing.prices
    .filter((r) => r.outOfStock)
    .map((r) => ({ name: r.supplierName, since: r.outOfStockSince }));

  return {
    sources,
    restsOn: shelf > 0 ? OWN_SHELF : (ranked[0]?.supplierId ?? null),
    onShelf: shelf,
    runOut,
    nobodyHasIt: shelf === 0 && ranked.length === 0,
  };
}

/** The source the picker is resting on, or the first that can price it. */
export const sourceOf = (choice: Choice, id: string | null): Source | null =>
  choice.sources.find((s) => s.id === id) ?? choice.sources[0] ?? null;

/**
 * What to charge for one of them, off the source that is chosen.
 *
 * The side is decided from that source's own row where it has one, so a
 * carton-only supplier prices out of the column the money came from — and
 * the shelf, which has no row, falls back to the rule the shop set.
 */
export function priceFrom(thing: Choosable, source: Source, qty: number): Derived<number> {
  const offTheShelf = source.id === OWN_SHELF;
  const row = thing.prices.find((r) => r.supplierId === source.id) ?? null;
  const side = sideSold(row, qty, source.packQty, thing.markups, offTheShelf);
  const markup = markupFor(thing.markups, side, offTheShelf);

  return match(source.at, {
    known: (cost) => suggestedSell(cost, markup, side, source.packQty),
    partial: (cost) =>
      map(suggestedSell(cost, markup, side, source.packQty), (at) => at),
    unavailable: (why) => unavailable<number>(`no price can be worked out — ${why}`),
  });
}
