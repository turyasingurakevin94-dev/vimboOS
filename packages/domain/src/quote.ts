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
import type { CustomerId, SupplierId, VariantId } from './ids.js';

/** One line of the quote the client can see. */
export interface ItemLine {
  readonly kind: 'item';
  readonly id: VariantId;
  readonly name: string;
  /** The unit this line is priced in: `Ctn`, `Bdl`, `Pcs`. */
  readonly unit: string;
  readonly qty: number;
  readonly priceEach: Amount;
  /** What the shelf holds, in the line's own unit. */
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
}

/**
 * Transport, credit terms, a discount. It has an amount and no cost, so the
 * shop keeps all of it — which is why the shop-side sheet writes "all" in its
 * keep column rather than a per-cent.
 */
export interface ChargeLine {
  readonly kind: 'charge';
  readonly id: string;
  readonly name: string;
  /** What kind of charge, in the words the line shows: `charge`, `+3% on 30 days`. */
  readonly basis: string;
  readonly amount: Amount;
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

/** What the client pays for this line. Always knowable — it is what was typed. */
export const lineTotal = (line: QuoteLine): Amount =>
  line.kind === 'charge' ? line.amount : Money.times(line.priceEach, line.qty);

/**
 * What this line costs the shop.
 *
 * A charge costs nothing — a **known** zero, not a missing figure. An item
 * costs the last price paid times the quantity, and if that price was never
 * recorded the cost of the line cannot be derived at all.
 */
export const lineCost = (line: QuoteLine): Derived<Amount> =>
  line.kind === 'charge'
    ? known(Money.ZERO, 'a charge carries no cost')
    : map(line.buyAt, (at) => Money.times(at, line.qty));

/** What the shop keeps on this line. */
export const lineKeep = (line: QuoteLine): Derived<Amount> =>
  map(lineCost(line), (cost) => Money.subtract(lineTotal(line), cost));

/* -------------------------------------------------------------------------- */
/*  What the quote is worth                                                   */
/* -------------------------------------------------------------------------- */

/** The client's figure. Every line has one, so this is never in doubt. */
export const clientPays = (lines: readonly QuoteLine[]): Amount =>
  Money.add(...lines.map(lineTotal));

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
