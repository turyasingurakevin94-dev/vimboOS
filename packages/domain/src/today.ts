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
import type { CashPosition, CashTxn } from './cash.js';
import { ACCOUNTS, isMoneyIn, isMoneyOut, monthsOfCover } from './cash.js';
import {
  agingBands,
  oldestDebtDays,
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

/* --------------------------- where profit came from ----------------------- */

/** The window the profit panel measures. Its own "Last 30 days". */
export const PROFIT_DAYS = 30;

/** How many lines the panel names before it starts counting the rest. */
export const PROFIT_LINES = 4;

/** One line off an order, in the terms profit is worked out from. */
export interface SoldLine {
  readonly on: Date;
  readonly name: string;
  readonly qty: number;
  /** What the client paid. `payload.items[].sellPrice`. */
  readonly sell: Amount;
  /** What the shop paid. `payload.items[].price`. `null` when unrecorded. */
  readonly buy: Amount | null;
}

export interface ProfitLine {
  readonly name: string;
  readonly kept: Amount;
  readonly sold: Amount;
  readonly margin: Derived<number>;
  /** Share of the biggest line's profit, 0–100 — the bar's width. */
  readonly share: number;
}

export interface ProfitByProduct {
  readonly lines: readonly ProfitLine[];
  /** Lines not named, and what they kept between them. */
  readonly otherLines: number;
  readonly otherKept: Amount;
}

/**
 * Which lines the month's profit actually came from.
 *
 * Grouped by the name the order carried, because that is the only key every
 * version of the payload has — `productId` exists on newer rows and is the
 * better key the day every row has one, exactly as the Invoices register
 * says about matching a customer.
 *
 * A line whose buying price was never recorded counts into what was SOLD
 * and not into what was KEPT, so its product's margin comes back `partial`
 * naming how many. Treating the missing cost as zero would report the
 * shop's best-ever margin on its worst-documented product — the bug
 * `Derived` exists to end, and the same rule the strip's margin cell takes.
 */
export function profitByProduct(
  lines: readonly SoldLine[],
  now: Date,
  days: number = PROFIT_DAYS,
  top: number = PROFIT_LINES,
): ProfitByProduct {
  const since = now.getTime() - days * DAY;
  const inWindow = lines.filter((l) => l.on.getTime() >= since);

  const byName = new Map<string, { kept: number; sold: number; blind: number; count: number }>();
  for (const l of inWindow) {
    const at = byName.get(l.name) ?? { kept: 0, sold: 0, blind: 0, count: 0 };
    at.sold += l.qty * l.sell;
    at.count += 1;
    if (l.buy === null) at.blind += 1;
    else at.kept += l.qty * (l.sell - l.buy);
    byName.set(l.name, at);
  }

  const ranked = [...byName.entries()]
    .map(([name, at]) => ({ name, ...at }))
    .sort((a, b) => b.kept - a.kept);

  const biggest = ranked[0]?.kept ?? 0;
  const named = ranked.slice(0, top);
  const rest = ranked.slice(top);

  return {
    lines: named.map((l) => {
      const pct = l.sold === 0 ? null : Math.round((l.kept / l.sold) * 100);
      const basis = `${Money.format(Money.money(Math.round(l.kept)))} kept on ${Money.format(Money.money(Math.round(l.sold)))} sold`;

      return {
        name: l.name,
        kept: Money.money(Math.round(l.kept)),
        sold: Money.money(Math.round(l.sold)),
        margin:
          pct === null
            ? unavailable('nothing was sold on this line, so there is no share to take')
            : l.blind === 0
              ? known(pct, basis)
              : partial(pct, basis, `${l.blind} of ${l.count} lines have no buying price`),
        share: biggest <= 0 ? 0 : Math.max(0, Math.round((l.kept / biggest) * 100)),
      };
    }),
    otherLines: rest.length,
    otherKept: Money.money(Math.round(rest.reduce((n, l) => n + l.kept, 0))),
  };
}

/* -------------------------------- yesterday ------------------------------- */

/** The four tiles: what the shop did on the last full day. */
export interface Yesterday {
  readonly on: Date;
  /** What was invoiced. */
  readonly sold: Amount;
  /** What actually arrived, across the tills. */
  readonly collected: Amount;
  /** Everything that left, stock included — this is not the burn. */
  readonly paidOut: Amount;
  /** What was invoiced and not settled on the day. */
  readonly newDebt: Amount;
}

/**
 * Yesterday, in four figures.
 *
 * **`paidOut` is every shilling that left, stock purchases included**, and
 * that is deliberately not the reckoning `monthlyBurn` uses. Cover asks how
 * long the shop can keep running, where buying stock is cash changing
 * shape; this tile asks what went out of the till yesterday, where it very
 * much did. Two questions, two answers, and the tile labels say which.
 *
 * `newDebt` is what was invoiced and not settled on the day, off the
 * invoices' own payments — not a second debt ledger. An invoice paid in
 * full at the counter adds nothing here, which is the point.
 */
export function yesterday(
  sales: readonly Pick<SalesInvoice, 'issued' | 'total' | 'payments' | 'voided'>[],
  txns: readonly CashTxn[],
  now: Date,
): Yesterday {
  const on = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY,
  );
  const day = on.toISOString().slice(0, 10);

  const raised = sales.filter(
    (s) => s.voided === undefined && s.issued.toISOString().slice(0, 10) === day,
  );
  const settled = (s: (typeof raised)[number]): Amount =>
    Money.add(...s.payments.filter((p) => p.on.toISOString().slice(0, 10) === day).map((p) => p.amount));

  const moved = txns.filter((t) => t.on === day);

  return {
    on,
    sold: Money.add(...raised.map((s) => s.total)),
    collected: Money.add(...moved.filter(isMoneyIn).map((t) => t.amount)),
    paidOut: Money.add(...moved.filter(isMoneyOut).map((t) => t.amount)),
    newDebt: Money.add(
      ...raised.map((s) => Money.max(Money.ZERO, Money.subtract(s.total, settled(s)))),
    ),
  };
}

/* --------------------------- what the books flagged ----------------------- */

/** One reading the books flagged. Arithmetic, never advice. */
export interface Flag {
  readonly id: string;
  readonly tone: 'bad' | 'caution' | 'info' | 'neutral';
  /** The headline, with the subject named. */
  readonly first: string;
  /**
   * Both ends of the comparison, so the row can be checked rather than
   * believed — the design system's own rule for a basis line.
   */
  readonly second: string;
  /** The figure, when there is one. Never a nought standing in for none. */
  readonly figure: Amount | null;
  /** A short verdict chip, when the row earns one. */
  readonly judgement: string | null;
}

export interface Watch {
  readonly flags: readonly Flag[];
  /**
   * Readings this panel is supposed to carry and cannot, each named.
   *
   * The handoff draws five rows and captions them "five of five shown".
   * Three of them need books this app does not read yet, and drawing three
   * rows under that caption would be a quieter lie than leaving the
   * sentences hard-coded. The panel says how many it could answer and what
   * it could not.
   */
  readonly notYet: readonly string[];
}

export interface WatchInputs {
  readonly customers: readonly Customer[];
  readonly cash: CashPosition;
  readonly deadLines: number;
  readonly deadValue: Derived<Amount>;
  /** How long a line stays quiet before it is called dead, per the shop. */
  readonly quietDays: number;
}

/**
 * The readings the books can make on their own.
 *
 * Every row here is arithmetic over rows this screen already read — none of
 * it is a second query, and none of it is advice. Advice is the Manager's,
 * and it is the list on the left.
 *
 * **A flag is not raised for a quiet fact.** No debtor, no broken word, no
 * misfiled row and no dead line each produce no row at all, rather than a
 * row reading zero — §7 forbids drawing a badge for zero and the same
 * reasoning holds here.
 */
export function watch(inputs: WatchInputs, now: Date): Watch {
  const book = readBook(inputs.customers, now);
  const flags: Flag[] = [];

  // The single oldest debt, named. An aging total says how much; this says
  // who, which is the one the owner can pick up a phone about.
  const aged = inputs.customers
    .map((c) => ({ c, age: oldestDebtDays(c, now) }))
    .filter((x): x is { c: Customer; age: Extract<Derived<number>, { status: 'known' }> } =>
      x.age.status === 'known',
    )
    .sort((a, b) => b.age.value - a.age.value);

  const oldest = aged[0];
  if (oldest !== undefined) {
    flags.push({
      id: 'oldest-debt',
      tone: 'bad',
      first: `${oldest.c.name} has owed ${oldest.age.value} days`,
      second: oldest.age.basis,
      figure: totalOwed([oldest.c]),
      judgement: null,
    });
  }

  // A broken promise is a date the CUSTOMER named and missed, which is why
  // it outranks an aging band as evidence.
  if (book.brokeWord.length > 0) {
    const broken = totalOwed(book.brokeWord);
    flags.push({
      id: 'broke-word',
      tone: 'bad',
      first: `${book.brokeWord.length} ${book.brokeWord.length === 1 ? 'account has' : 'accounts have'} broken their word`,
      second: `${Money.format(broken)} of the ${Money.format(totalOwed(book.owing))} owed, across ${book.owing.length} accounts`,
      figure: broken,
      judgement: null,
    });
  }

  // A row filed under an account the shop does not have is invisible to
  // every cash total — which is exactly what once made a movement look
  // recorded when nothing could see it.
  if (inputs.cash.misfiled.length > 0) {
    flags.push({
      id: 'misfiled-cash',
      tone: 'caution',
      first: `${inputs.cash.misfiled.length} cash ${inputs.cash.misfiled.length === 1 ? 'movement is' : 'movements are'} filed under no account you have`,
      second: `filed under ${inputs.cash.misfiled.join(', ')} · your accounts are ${ACCOUNTS.map((a) => a.label).join(', ')}`,
      figure: null,
      judgement: 'not in any total',
    });
  }

  if (inputs.deadLines > 0) {
    flags.push({
      id: 'dead-stock',
      tone: 'neutral',
      first: `${inputs.deadLines} ${inputs.deadLines === 1 ? 'line has' : 'lines have'} stopped selling`,
      // The basis, and only the basis. Why it cannot be valued is the
      // chip's job — spelling the whole reason out here ran the row to
      // three lines and said twice what one word already said.
      second: `nothing sold on them in ${inputs.quietDays} days`,
      figure: inputs.deadValue.status === 'unavailable' ? null : inputs.deadValue.value,
      judgement: inputs.deadValue.status === 'unavailable' ? 'not yet valued' : null,
    });
  }

  return {
    flags,
    // Named individually rather than counted, because each is a different
    // job and the owner is entitled to know which readings are missing
    // rather than that some number of them are.
    notYet: [
      'which lines run out within the week, and what refilling them costs',
      'which suppliers have raised their prices, and by how much',
      'which sales agents sell at a thinner margin than the rest',
    ],
  };
}
