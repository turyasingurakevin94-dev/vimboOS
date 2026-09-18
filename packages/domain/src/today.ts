/**
 * Today — the position strip, as one reckoning.
 *
 * Five cells, and **not one of them is this screen's own arithmetic**. Cash
 * is the Cash Book's, what is owed is the Customers register's, what is
 * owed out is the Invoices band's. The design system states the rule the
 * other way round — *"give a screen a second reckoning of a figure another
 * screen already computes"* is an anti-pattern — and Today is the screen
 * most likely to break it, because it is the screen that shows everything.
 *
 * So this module composes; it does not re-derive. Where a figure genuinely
 * has no owner yet — the margin over a week, the value on the shelf — the
 * reckoning is written here once and the screen that eventually owns it
 * reads THIS.
 *
 * ## Every cell can fail, and says so
 *
 * The handoff draws five confident figures. The books are not always able
 * to produce five. A shop whose stock lots have never been costed has no
 * derivable shelf value, and `41,300,000` would be an invention. Each cell
 * is `Derived`, and the screen has to handle `unavailable` before it can
 * draw — which is the difference between this app and the one that wrote
 * `total || 0`.
 */

import { known, partial, unavailable, type Derived } from './derived.js';
import * as Money from './money.js';
import type { Money as Amount } from './money.js';
import type { CashPosition } from './cash.js';
import { monthsOfCover } from './cash.js';
import {
  agingBands,
  read as readBook,
  totalOwed,
  type AgingBand,
  type Customer,
} from './customers.js';
import { stillToPay, type PurchaseInvoice, type SalesInvoice } from './invoices.js';

const DAY = 86_400_000;

/** The window the margin cell measures. The handoff's own "· 7 days". */
export const MARGIN_DAYS = 7;

/** Days without a sale before a line on the shelf is called dead. */
export const DEAD_STOCK_DAYS = 120;

/** What is owed out inside this many days counts as "due this week". */
export const DUE_SOON_DAYS = 7;

/** The band the second cell's basis line calls out. */
export const OLD_DEBT_DAYS = 60;

/**
 * What the shop sold and what it kept over a window, counted off the raw
 * order lines rather than off invoices.
 *
 * An invoice is what the client was charged and carries no buy price, so
 * margin cannot come from `SalesInvoice`. It comes from `payload.items`,
 * where `sellPrice` is what the client pays and `price` is what the shop
 * paid — the two the old app blurred, and the reason `readLines` refuses to
 * look at `price` at all.
 */
export interface MarginInput {
  readonly kept: Amount;
  readonly sold: Amount;
  /** Lines counted into `sold` whose buying price was never recorded. */
  readonly linesWithoutCost: number;
  readonly linesCounted: number;
}

/** What the shelf is worth, and how much of it has stopped moving. */
export interface StockInput {
  readonly shelf: Shelf;
  readonly dead: Derived<Amount>;
  readonly deadLines: number;
}

/**
 * One lot, as `stock_lots` stores it.
 *
 * `consign` is the supplier who still OWNS these units — goods held to be
 * paid for as they sell. Null is the shop's own stock.
 */
export interface StockLot {
  readonly qty: number | null;
  readonly cost: number | null;
  readonly consign: string | null;
}

/** One shelf line: what is on it now, and the lots behind it. */
export interface ShelfLine {
  readonly key: string;
  /** `stock.qty` — what is actually on the shelf, not what was ever bought. */
  readonly onShelf: number;
  readonly lots: readonly StockLot[];
}

export interface Shelf {
  /** What the shop's own units are worth, at what it paid. */
  readonly ours: Derived<Amount>;
  /** What a consignor's units on the same shelf are worth. Never in `ours`. */
  readonly heldForOthers: Derived<Amount>;
  /** Lines with something on them. The strip's "lines on the shelf". */
  readonly linesOnShelf: number;
  /** Units the shop owns that no lot accounts for, so cannot be valued. */
  readonly uncostedUnits: number;
}

/**
 * What one shelf line is worth — ported from the old app's
 * `shelfValueForKey`, which is the ONE reading its Inventory screen and its
 * balance sheet both take.
 *
 * The naive reading — sum `qty × cost` over the lots — is wrong, and the
 * real books prove it. Run against production on 2026-09-18 this reckoning
 * returns **11,186,018, to the shilling, the figure the shop's own Inventory
 * screen shows**; the naive sum over the same rows returns 16,952,518, which
 * overstates the shelf by 5,766,500. Lots are a purchase ledger. They record
 * what was bought, including units long since sold. What is on the shelf is
 * `stock.qty`, and the lots only say what a unit of it cost.
 *
 * The overstatement grows as the shop trades, so it is dated rather than
 * quoted as a constant — an earlier session recorded it as 15,634,018.
 *
 * So: take what is on the shelf, remove the consignor's units, and price the
 * remainder at the weighted average of the costed owned lots — capped at the
 * quantity those lots actually account for. A shelf holding more than the
 * lots explain has a surplus with no cost behind it, and that surplus is
 * counted in units and NOT valued at zero.
 */
export function shelfLineValue(line: ShelfLine): {
  readonly ours: number;
  readonly theirs: number;
  readonly uncostedUnits: number;
} {
  const consigned = line.lots.filter((l) => l.consign !== null);
  const consignedQty = consigned.reduce((n, l) => n + (l.qty ?? 0), 0);
  const theirs = consigned.reduce((n, l) => n + (l.qty ?? 0) * (l.cost ?? 0), 0);

  const ownedQty = Math.max(0, line.onShelf - consignedQty);
  if (ownedQty <= 0) return { ours: 0, theirs, uncostedUnits: 0 };

  const costed = line.lots.filter((l) => l.consign === null && l.cost !== null);
  const costedQty = costed.reduce((n, l) => n + (l.qty ?? 0), 0);
  if (costedQty <= 0) return { ours: 0, theirs, uncostedUnits: ownedQty };

  const costedValue = costed.reduce((n, l) => n + (l.qty ?? 0) * (l.cost ?? 0), 0);
  const unitCost = costedValue / costedQty;
  const priced = Math.min(ownedQty, costedQty);

  return {
    ours: priced * unitCost,
    theirs,
    uncostedUnits: ownedQty > costedQty ? ownedQty - costedQty : 0,
  };
}

/**
 * The whole shelf.
 *
 * A line with nothing on it is skipped, as the old app skips it — 79 of this
 * shop's 130 stock rows have an empty shelf, and valuing them would add 79
 * noughts to a figure that is about what is there. (Production, 2026-09-18:
 * 130 rows, 51 standing, 81 lots behind them.)
 *
 * The rounding happens ONCE, on the total. A weighted unit cost is
 * fractional by nature, and rounding each line before adding them would
 * drift from the figure the shop already reads on its own screen — which is
 * the figure this now matches exactly.
 */
export function shelfValue(lines: readonly ShelfLine[]): Shelf {
  const standing = lines.filter((l) => l.onShelf > 0);

  let ours = 0;
  let theirs = 0;
  let uncostedUnits = 0;
  for (const line of standing) {
    const v = shelfLineValue(line);
    ours += v.ours;
    theirs += v.theirs;
    uncostedUnits += v.uncostedUnits;
  }

  const basis = `across ${standing.length} lines, at what you paid`;
  const held = Money.money(Math.round(ours));

  return {
    ours:
      uncostedUnits === 0
        ? known(held, basis)
        : partial(
            held,
            basis,
            `${Math.round(uncostedUnits)} units have no cost behind them`,
          ),
    heldForOthers:
      theirs === 0
        ? known(Money.ZERO, 'nothing is held on consignment')
        : known(
            Money.money(Math.round(theirs)),
            `${standing.filter((l) => l.lots.some((x) => x.consign !== null)).length} lines on consignment`,
          ),
    linesOnShelf: standing.length,
    uncostedUnits: Math.round(uncostedUnits),
  };
}

export interface StripInputs {
  readonly cash: CashPosition;
  readonly burn: Derived<Amount>;
  readonly customers: readonly Customer[];
  readonly purchases: readonly PurchaseInvoice[];
  readonly margin: MarginInput;
  readonly stock: StockInput;
}

export interface CashCell {
  readonly held: Derived<Amount>;
  readonly accounts: number;
  readonly cover: Derived<number>;
  readonly misfiled: readonly string[];
}

export interface OwedToYouCell {
  readonly total: Derived<Amount>;
  readonly customers: number;
  readonly overSixty: Derived<Amount>;
  /** The four-segment bar. Shares are of money, and they sum to 100. */
  readonly aging: readonly AgingBand[];
}

export interface YouOweCell {
  readonly total: Derived<Amount>;
  readonly suppliers: number;
  readonly dueThisWeek: Derived<Amount>;
}

export interface MarginCell {
  readonly percent: Derived<number>;
  readonly kept: Amount;
  readonly sold: Amount;
}

export interface StockCell {
  readonly held: Derived<Amount>;
  readonly dead: Derived<Amount>;
  readonly deadLines: number;
  readonly heldForOthers: Derived<Amount>;
  readonly linesOnShelf: number;
}

export interface TodayStrip {
  readonly cash: CashCell;
  readonly owedToYou: OwedToYouCell;
  readonly youOwe: YouOweCell;
  readonly margin: MarginCell;
  readonly stock: StockCell;
}

/* ---------------------------------- cells --------------------------------- */

const cashCell = (cash: CashPosition, burn: Derived<Amount>): CashCell => ({
  held: cash.total,
  accounts: cash.accountsInUse,
  cover: monthsOfCover(cash.total, burn),
  misfiled: cash.misfiled,
});

/**
 * What is owed to the shop — the Customers register's own total.
 *
 * `read()` decides who is owing, `totalOwed` adds them up and `agingBands`
 * splits them. The rail badge, the Customers lens count and this figure are
 * therefore one number read three times, which is the only way they cannot
 * drift apart.
 */
function owedCell(customers: readonly Customer[], now: Date): OwedToYouCell {
  const book = readBook(customers, now);
  const bands = agingBands(book.owing, now);
  const total = totalOwed(book.owing);

  const oldest = bands.find((b) => b.from === OLD_DEBT_DAYS);

  return {
    total: known(total, `across ${book.owing.length} accounts`),
    customers: book.owing.length,
    overSixty:
      oldest === undefined
        ? unavailable(`no band starts at ${OLD_DEBT_DAYS} days`)
        : known(oldest.amount, `${oldest.share}% of what is owed`),
    aging: bands,
  };
}

/** What the shop owes out — the Invoices band's `stillToPay`, per purchase. */
function oweCell(purchases: readonly PurchaseInvoice[], now: Date): YouOweCell {
  const owing = purchases.filter((p) => !Money.isZero(stillToPay(p)));
  const total = Money.add(...owing.map(stillToPay));

  const soon = owing.filter(
    (p) => p.dueOn !== null && p.dueOn.getTime() - now.getTime() <= DUE_SOON_DAYS * DAY,
  );
  const withoutTerms = owing.filter((p) => p.dueOn === null);
  const dueSoon = Money.add(...soon.map(stillToPay));

  return {
    total: known(total, `on ${owing.length} purchase invoices`),
    suppliers: new Set(owing.map((p) => p.supplier)).size,
    // A purchase with no due date is not "not due this week" — nobody
    // recorded when it falls, and saying "due this week: 0" would be a
    // claim the books never made.
    dueThisWeek:
      withoutTerms.length === 0
        ? known(dueSoon, `${soon.length} of ${owing.length} fall inside ${DUE_SOON_DAYS} days`)
        : partial(
            dueSoon,
            `${soon.length} of ${owing.length} fall inside ${DUE_SOON_DAYS} days`,
            `${withoutTerms.length} have no due date recorded`,
          ),
  };
}

/**
 * The margin over the window, as a whole per-cent.
 *
 * A line whose buying price was never recorded counts into what was SOLD
 * and not into what was KEPT — treating a missing cost as zero reports the
 * shop's best-ever margin on its worst-documented line, which is the exact
 * bug `Derived` was introduced to end. That biases the figure DOWN, so it
 * comes back `partial` naming how many lines did it, rather than `known`.
 */
function marginCell(m: MarginInput): MarginCell {
  if (m.linesCounted === 0) {
    return {
      percent: unavailable(`nothing was sold in the last ${MARGIN_DAYS} days`),
      kept: m.kept,
      sold: m.sold,
    };
  }
  if (Money.isZero(m.sold)) {
    return {
      percent: unavailable('nothing was sold, so there is no revenue to take a share of'),
      kept: m.kept,
      sold: m.sold,
    };
  }

  const pct = Math.round((m.kept / m.sold) * 1000) / 10;
  const basis = `${Money.format(m.kept)} kept on ${Money.format(m.sold)} sold`;

  return {
    percent:
      m.linesWithoutCost === 0
        ? known(pct, basis)
        : partial(
            pct,
            basis,
            `${m.linesWithoutCost} of ${m.linesCounted} lines have no buying price, so the real margin is higher`,
          ),
    kept: m.kept,
    sold: m.sold,
  };
}

const stockCell = (s: StockInput): StockCell => ({
  held: s.shelf.ours,
  dead: s.dead,
  deadLines: s.deadLines,
  heldForOthers: s.shelf.heldForOthers,
  linesOnShelf: s.shelf.linesOnShelf,
});

/** The whole strip, from what the books gave. */
export function readStrip(inputs: StripInputs, now: Date): TodayStrip {
  return {
    cash: cashCell(inputs.cash, inputs.burn),
    owedToYou: owedCell(inputs.customers, now),
    youOwe: oweCell(inputs.purchases, now),
    margin: marginCell(inputs.margin),
    stock: stockCell(inputs.stock),
  };
}

/**
 * How many things want the owner — the figure in the page's sub-line and
 * the rail's Today badge.
 *
 * One number, so the sentence and the badge cannot disagree. Drawn only
 * above zero, per the navigation law.
 */
export function wantsYou(strip: TodayStrip, openMoves: number): number {
  const flags = [
    strip.cash.cover.status !== 'unavailable' && strip.cash.cover.value < 1,
    strip.owedToYou.overSixty.status !== 'unavailable' &&
      !Money.isZero(strip.owedToYou.overSixty.value),
    strip.youOwe.dueThisWeek.status !== 'unavailable' &&
      !Money.isZero(strip.youOwe.dueThisWeek.value),
    strip.margin.percent.status !== 'unavailable' && strip.margin.percent.value <= 0,
    strip.stock.dead.status !== 'unavailable' && !Money.isZero(strip.stock.dead.value),
  ].filter(Boolean).length;

  return openMoves + flags;
}

/* ------------------------------ sold by week ------------------------------ */

/** How many weeks the panel draws. The handoff's own "best of 12". */
export const SOLD_WEEKS = 12;

/** One week of trading, oldest first. */
export interface SalesWeek {
  /** Midnight on the Monday the week opens, UTC like every date here. */
  readonly from: Date;
  readonly sold: Amount;
  readonly invoices: number;
  /** Share of the tallest week, 0–100 — what the bar's height is. */
  readonly share: number;
}

export interface SoldByWeek {
  readonly weeks: readonly SalesWeek[];
  /**
   * The middle week of the ones the shop actually TRADED — see
   * {@link SoldByWeek.tradedWeeks}. An even count is the mean of the two
   * middle values and lands on a half, which is exactly the arithmetic the
   * handoff's prose got wrong about its own array.
   */
  readonly median: Amount;
  /**
   * How many weeks the shop has been trading, up to the window.
   *
   * The same fix `monthlyBurn` carries, for the same reason. A shop six
   * weeks old has six weeks of history, and taking a twelve-week median
   * across six weeks of zeros halves it — so a week barely above nothing
   * reads as "above the median" and the sentence flatters the shop. Counted
   * from the first week anything was sold, and named, so a panel over a
   * young shop says "6-week median" rather than claiming twelve.
   */
  readonly tradedWeeks: number;
  /** True when the newest week is the tallest of the twelve. */
  readonly bestIsLatest: boolean;
  /**
   * How many weeks the run of above-median weeks at the END extends to.
   *
   * The handoff says "the last four weeks are the best run of the twelve"
   * and then names three figures. Counted rather than asserted, so the
   * sentence and the bars cannot disagree again.
   */
  readonly runLength: number;
}

const WEEK = 7 * DAY;

/** Midnight UTC on the Monday of the week containing `d`. */
export function weekStart(d: Date): Date {
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  // getUTCDay is 0 on Sunday, and a shop's week opens on Monday.
  const weekday = new Date(midnight).getUTCDay();
  const backToMonday = weekday === 0 ? 6 : weekday - 1;
  return new Date(midnight - backToMonday * DAY);
}

/**
 * What was sold in each of the last twelve weeks.
 *
 * A voided invoice is not a sale. Counting one would let a week that was
 * raised and cancelled stand as the shop's best — and `voided` exists on
 * `SalesInvoice` precisely because the old app once totalled them.
 *
 * Weeks with no trading are present at zero, because a zero week IS a fact
 * the books produced: nothing was sold. That is different from the shop not
 * having existed, which a missing bar would imply and which the range says.
 */
export function soldByWeek(
  sales: readonly Pick<SalesInvoice, 'issued' | 'total' | 'voided'>[],
  now: Date,
  weeks: number = SOLD_WEEKS,
): SoldByWeek {
  const thisWeek = weekStart(now);
  const opens = Array.from(
    { length: weeks },
    (_, i) => new Date(thisWeek.getTime() - (weeks - 1 - i) * WEEK),
  );

  const live = sales.filter((s) => s.voided === undefined);
  const totals = opens.map((from) => {
    const to = from.getTime() + WEEK;
    const inWeek = live.filter(
      (s) => s.issued.getTime() >= from.getTime() && s.issued.getTime() < to,
    );
    return { from, sold: Money.add(...inWeek.map((s) => s.total)), invoices: inWeek.length };
  });

  const tallest = Math.max(...totals.map((w) => w.sold), 0);

  // From the first week anything was sold. A leading run of zeros is a shop
  // that did not exist yet, not a shop that sold nothing — and averaging
  // over it is the understatement `monthlyBurn` already had to fix once.
  const opened = totals.findIndex((w) => !Money.isZero(w.sold));
  const traded = opened === -1 ? [] : totals.slice(opened);

  const sorted = [...traded.map((w) => w.sold)].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1] ?? Money.ZERO;
  const upper = sorted[mid] ?? Money.ZERO;
  // Rounds half up, the one place a shilling can appear from nowhere — and
  // it is a median of money, not money itself, so it is allowed to.
  const median =
    sorted.length === 0
      ? Money.ZERO
      : sorted.length % 2 === 0
        ? Money.money(Math.round((lower + upper) / 2))
        : upper;

  let runLength = 0;
  for (let i = totals.length - 1; i >= 0; i -= 1) {
    const week = totals[i];
    if (week === undefined || Money.compare(week.sold, median) <= 0) break;
    runLength += 1;
  }

  const newest = totals[totals.length - 1];

  return {
    weeks: totals.map((w) => ({
      ...w,
      share: tallest === 0 ? 0 : Math.round((w.sold / tallest) * 100),
    })),
    median,
    tradedWeeks: traded.length,
    bestIsLatest: newest !== undefined && tallest > 0 && newest.sold === tallest,
    runLength,
  };
}
