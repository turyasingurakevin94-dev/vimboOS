/**
 * A quote being built.
 *
 * Per the Quote handoff, a quote is no longer a thing that lives in a list of
 * its own: **Save quote hands it to Order tracking at the stage `taken`.**
 * What is modelled here is therefore the *building* of it — the lines, and
 * the four figures that stand at the foot of every surface that shows one.
 *
 * ## The four figures, in this order, everywhere
 *
 * `Client pays` · `Costs you` · `You keep` · the per-cent kept. The dock on
 * the desktop, the phone dock, the shop-side sheet and the item picker's foot
 * all show the same four in the same order, and the handoff is explicit that
 * this is not a coincidence to be optimised away.
 *
 * ## Cost is a derivation, and it can fail
 *
 * "Costs you" is **the last price you actually paid, not the registry** —
 * which means an item nobody has bought yet has no cost, and the total over
 * a quote containing one is `partial`: real, but not the whole column. A
 * charge line is different: it genuinely costs nothing, which is a known
 * zero, and its whole amount is kept. Conflating the two is how `total || 0`
 * happens.
 */

import {
  known,
  partial,
  unavailable,
  sumDerived,
  map,
  type Derived,
} from './derived.js';
import * as Money from './money.js';
import type { Money as Amount } from './money.js';
import { asId, type CustomerId, type SupplierId, type VariantId } from './ids.js';

/** One line of the quote the client can see. */
export interface ItemLine {
  readonly kind: 'item';
  readonly id: VariantId;
  readonly name: string;
  /** The unit this line is priced in: `Ctn`, `Bdl`, `Pcs`. */
  readonly unit: string;
  readonly qty: number;
  readonly priceEach: Amount;
  /**
   * What the shelf holds, in BASE units — never in the line's own.
   *
   * A line quoted as 1 Ctn of 100 against 8 pieces on the shelf read
   * `0 in stock`, which is true about cartons and hides the eight. The
   * count is the shop's, the unit is the line's, and converting the count
   * to the unit is how the eight disappeared. {@link shortOf} does the
   * comparison instead, in base units, where both sides mean the same thing.
   */
  readonly inStock: number;
  /** The shop's side. Both of these are hidden from the client. */
  readonly buyFrom: string;
  readonly supplierId?: SupplierId;
  /**
   * The last price actually paid — not the registry price, and not always
   * knowable. An item bought for the first time on this quote has none.
   */
  readonly buyAt: Derived<Amount>;
  /** A cheaper supplier, when one exists. Drawn on the line, in caution ink. */
  readonly cheaperElsewhere?: {
    readonly supplier: string;
    readonly saves: Amount;
  };
  /**
   * What the line has to carry to be written down, and none of it is drawn.
   *
   * A quote on screen is a document about to become a row, and the row's
   * shape is the old app's. Held on the line rather than looked up again at
   * save time: the catalogue can change between choosing a thing and saving
   * the order — a price edited in another window, a variant renumbered —
   * and a line that re-derived its own product at the last moment would
   * quietly save something the person never chose.
   */
  readonly source: LineSource;
}

/** Where a line came from, in the terms the books record it in. */
export interface LineSource {
  readonly productId: string;
  /** Null for a simple product; the variant's position otherwise. */
  readonly variantIdx: number | null;
  /** The supplier it is bought from, or `__stock__` off the shop's shelf. */
  readonly supplierId: string;
  readonly packUnit: string;
  /** How many base units in a pack. 0 where the supplier sells no pack. */
  readonly packQty: number;
  /** Whether the quantity was counted in packs or in the base unit. */
  readonly countedIn: 'unit' | 'pack';
}

/**
 * Transport, credit terms, a discount. It has an amount and no cost, so the
 * shop keeps all of it — which is why the shop-side sheet writes "all" in its
 * keep column rather than a per-cent.
 *
 * **It carries the RULE, not the shillings.** A percent frozen at the moment
 * it was tapped goes stale on the next line added, and the document would
 * then print `5%` beside a figure that is five per cent of nothing on it. It
 * also settles compounding without needing a rule about ordering: every
 * percent resolves against the GOODS, so two of them come to the same total
 * whichever was tapped first.
 *
 * **The label is frozen, which is the opposite rule for the opposite
 * reason.** An invoice is a record of what was agreed, so renaming a service
 * next month must not rewrite what a customer was charged for last month.
 */
export interface ChargeLine {
  readonly kind: 'charge';
  readonly id: string;
  /** The label, as it was when this was agreed. Never re-read from the preset. */
  readonly name: string;
  /** What kind of charge, in the words the line shows: `charge`, `+3% on 30 days`. */
  readonly basis: string;
  readonly rule: ChargeRule;
  /** Which of the shop's services it came from, where it came from one. */
  readonly service: string | null;
  /**
   * What the charge cost the SHOP, where that has been paid out.
   *
   * A delivery costs what the driver was handed, and that is a payment
   * rather than a figure somebody typed — `null` until it leaves the till.
   * Null is not zero: a fee nobody has paid out on yet is a fee whose margin
   * is not yet known, and the dock says so.
   */
  readonly cost: Amount | null;
}

/** A charge, as the shop agreed it: a flat figure, or a share of the goods. */
export interface ChargeRule {
  readonly type: 'fixed' | 'percent';
  readonly value: number;
}

export type QuoteLine = ItemLine | ChargeLine;

export interface Client {
  readonly id: CustomerId;
  readonly name: string;
  readonly phone: string;
  /** How many orders this client has placed, ever. */
  readonly orders: number;
  /** What they owe right now. Zero is good news and the strip says so in green. */
  readonly owesNow: Amount;
  readonly lastOrder: { readonly total: Amount; readonly when: string } | null;
}

export interface Quote {
  readonly client: Client;
  readonly date: string;
  readonly lines: readonly QuoteLine[];
}

/* -------------------------------------------------------------------------- */
/*  What a line is worth                                                      */
/* -------------------------------------------------------------------------- */

/** The goods, and only the goods — what a percent charge is a percent OF. */
export const goodsTotal = (lines: readonly QuoteLine[]): Amount =>
  Money.add(...lines.filter((l): l is ItemLine => l.kind === 'item').map(itemTotal));

/** What the client pays for one item line. What was typed, times how many. */
export const itemTotal = (line: ItemLine): Amount => Money.times(line.priceEach, line.qty);

/**
 * What a charge comes to, against the goods it is charged on.
 *
 * Whole shillings: a fee is a figure somebody says out loud. A value of zero
 * or less comes to nothing — a charge is money the shop is owed, and a
 * discount is not one.
 */
export function chargeAmount(line: ChargeLine, goods: Amount): Amount {
  if (line.rule.value <= 0) return Money.ZERO;
  return line.rule.type === 'percent'
    ? Money.money(Math.round((goods * line.rule.value) / 100))
    : Money.money(Math.round(line.rule.value));
}

/**
 * What the client pays for this line.
 *
 * A charge needs the goods to be a percent of, so it is given them. Passing
 * the whole document rather than a total means no caller can hand it a
 * figure that already had a charge in it.
 */
export const lineTotal = (line: QuoteLine, lines: readonly QuoteLine[] = []): Amount =>
  line.kind === 'charge' ? chargeAmount(line, goodsTotal(lines)) : itemTotal(line);

/**
 * What this line costs the shop.
 *
 * An item costs the last price paid times the quantity, and where that price
 * was never recorded the cost of the line cannot be derived at all.
 *
 * **A charge is not a known zero.** It was, and it is the difference between
 * a 5,000 delivery on a 7,050 order reading `you keep 5,150` and reading
 * `you keep at most 5,150`. What a charge costs the shop is a PAYMENT, not a
 * figure somebody typed — a delivery costs what the driver was handed, and
 * that money leaves the till later, against `cost` and `costTxnId` on the
 * charge. At the moment of quoting it is not known, and a dock that treats
 * it as nothing reports the whole fee as margin.
 *
 * A charge the shop has recorded a cost for is costed at it. One it has not
 * is `partial` at zero, which says "this much at most" — the figure is real
 * money and it is not the whole column.
 */
export const lineCost = (line: QuoteLine): Derived<Amount> =>
  line.kind === 'charge'
    ? line.cost === null
      ? partial(Money.ZERO, 'nothing has been paid out on it yet', `what ${line.name} costs the shop is not recorded until it is paid`)
      : known(line.cost, `what ${line.name} cost the shop`)
    : map(line.buyAt, (at) => Money.times(at, line.qty));

/** What the shop keeps on this line. */
export const lineKeep = (line: QuoteLine): Derived<Amount> =>
  map(lineCost(line), (cost) => Money.subtract(lineTotal(line), cost));

/* -------------------------------------------------------------------------- */
/*  What the quote is worth                                                   */
/* -------------------------------------------------------------------------- */

/** The client's figure. Every line has one, so this is never in doubt. */
export const clientPays = (lines: readonly QuoteLine[]): Amount => {
  const goods = goodsTotal(lines);
  return Money.add(
    goods,
    ...lines
      .filter((l): l is ChargeLine => l.kind === 'charge')
      .map((c) => chargeAmount(c, goods)),
  );
};

/**
 * The shop's figure.
 *
 * `partial` the moment one line's cost is missing: the number on screen is
 * real money, but it is not the whole column, and the dock has to be able to
 * say which lines are outside it.
 */
export const costsYou = (lines: readonly QuoteLine[]): Derived<Amount> =>
  sumDerived(
    lines.map(lineCost),
    'the last price actually paid on every line',
    (a, b) => Money.add(a, b),
    Money.ZERO,
  );

/** What is left. Doubt about the cost is doubt about the margin. */
export const youKeep = (lines: readonly QuoteLine[]): Derived<Amount> =>
  map(costsYou(lines), (cost) => Money.subtract(clientPays(lines), cost));

/**
 * The per-cent kept, rounded to a whole number because that is how the chip
 * is drawn. A quote that adds to nothing keeps nothing, and dividing by it
 * would say `NaN%`.
 */
export function keepPercent(lines: readonly QuoteLine[]): Derived<number> {
  const pays = clientPays(lines);
  if (Money.isZero(pays)) return partial(0, 'an empty quote', 'nothing to keep a share of');
  return map(youKeep(lines), (keep) => Math.round((keep / pays) * 100));
}

/** The per-cent kept on one line, for the table's last column. */
export const lineKeepPercent = (line: QuoteLine): Derived<number> => {
  const total = lineTotal(line);
  if (Money.isZero(total)) return partial(0, 'a line worth nothing', 'no share to take');
  return map(lineKeep(line), (keep) => Math.round((keep / total) * 100));
};

/**
 * How a kept share reads.
 *
 * Frame 4a draws 10% in green and 5% and 6% in amber, and the dock's 10% is
 * green too, so the boundary sits at ten. Nothing kept is not a small margin,
 * it is a line the shop is working for free, and it is drawn as bad.
 *
 * Frame 4e — the add-item list, next turn's work — draws a 10% row in amber
 * against 12% and 15% in green. Either its boundary is twelve or that row
 * means something else; it needs settling before 4e is built rather than
 * guessing here.
 */
export const keepTone = (percent: number): 'good' | 'warn' | 'bad' =>
  percent <= 0 ? 'bad' : percent < 10 ? 'warn' : 'good';

/* -------------------------------------------------------------------------- */
/*  What the shop still has to cover                                          */
/* -------------------------------------------------------------------------- */

export interface Shortfall {
  readonly line: ItemLine;
  /** How many the shelf is short. Above zero, or it is not a shortfall. */
  readonly short: number;
}

/** The lines the shelf cannot cover, in the order they appear on the quote. */
export const shortfalls = (lines: readonly QuoteLine[]): readonly Shortfall[] =>
  lines
    .filter((l): l is ItemLine => l.kind === 'item')
    .flatMap((line) =>
      line.qty > line.inStock ? [{ line, short: line.qty - line.inStock }] : [],
    );

/** The lines a cheaper supplier exists for, and what switching would save. */
export const cheaperElsewhere = (
  lines: readonly QuoteLine[],
): readonly { readonly line: ItemLine; readonly at: number }[] =>
  lines.flatMap((line, at) =>
    line.kind === 'item' && line.cheaperElsewhere !== undefined
      ? [{ line, at: at + 1 }]
      : [],
  );

/**
 * What switching every cheaper supplier would save, as one figure.
 *
 * `sumDerived` rather than a running total, because a saving the app cannot
 * work out has to make the answer say so rather than quietly make it smaller.
 */
export const totalSaving = (lines: readonly QuoteLine[]): Derived<Amount> =>
  sumDerived(
    cheaperElsewhere(lines).map(({ line }) =>
      line.cheaperElsewhere === undefined
        ? unavailable<Amount>(`no saving recorded on ${line.name}`)
        : known(Money.times(line.cheaperElsewhere.saves, line.qty), 'a quoted saving'),
    ),
    'every line with a cheaper supplier',
    (a, b) => Money.add(a, b),
    Money.ZERO,
  );

/* -------------------------------------------------------------------------- *
 * From the catalogue onto the quote, and off it into the books
 * -------------------------------------------------------------------------- */

/**
 * A quantity typed in packs is still a quantity in base units.
 *
 * The unit the rep chose is the unit the screen speaks, and everything is
 * still RESOLVED in the base unit — tiers, cost, the shelf. A quantity typed
 * as 1 Ctn was once met with a price box counting per Pair, so the box said
 * 2,400 under a card saying 240,000/Ctn and the line arrived on the quote as
 * 10 Pair.
 */
export const qtyInBaseUnits = (
  typed: number,
  countedIn: 'unit' | 'pack',
  packQty: number,
): number => (countedIn === 'pack' && packQty > 0 ? typed * packQty : typed);

/** How many base units one of the chosen unit is. The pack size, or one. */
export const perChosen = (countedIn: 'unit' | 'pack', packQty: number): number =>
  countedIn === 'pack' && packQty > 0 ? packQty : 1;

/** What this line asks for, in base units — whatever unit it is counted in. */
export const askedFor = (line: ItemLine): number =>
  qtyInBaseUnits(line.qty, line.source.countedIn, line.source.packQty);

/**
 * How many base units of this line the shelf cannot cover.
 *
 * Both sides in base units, because that is the only unit the shelf and the
 * line agree on. Comparing a quantity in cartons against a count in pieces
 * is how a shop with eight on the shelf was told it had none.
 */
export const shortOf = (line: ItemLine): number => Math.max(0, askedFor(line) - line.inStock);

/* -------------------------------------------------------------------------- *
 * Who the order is for
 * -------------------------------------------------------------------------- */

/**
 * A customer the books know, as the quote's own strip reads them.
 *
 * Derived rather than stored on the quote: the strip's `orders`, `owes now`
 * and `last order` are all facts about the account, and a quote holding its
 * own copy of them is a copy that is wrong the moment a payment lands.
 */
export function clientFrom(customer: {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly invoices: readonly {
    readonly issued: Date;
    readonly total: Amount;
  }[];
  readonly balance: Amount;
}): Client {
  // Newest by the day it was issued, not by where it sits in the array: the
  // register hands invoices back in whatever order the books held them.
  const newest = [...customer.invoices].sort(
    (a, b) => b.issued.getTime() - a.issued.getTime(),
  )[0];

  return {
    id: asId(customer.id),
    name: customer.name,
    phone: customer.phone,
    orders: customer.invoices.length,
    owesNow: customer.balance,
    lastOrder:
      newest === undefined
        ? null
        : { total: newest.total, when: `${newest.issued.getUTCDate()} ${MONTH[newest.issued.getUTCMonth()] ?? ''}` },
  };
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
