/**
 * Cash — what the shop is holding, by the Cash Book's own arithmetic.
 *
 * ## Position, not movement
 *
 * The obvious reading of `cash_txns` — sum the amounts — is the shop's net
 * MOVEMENT, not its position. The old app shipped that and a book opened
 * with 1,000,000 in the drawer reported 70,000 after a day's trading. Every
 * opening balance was missing, and the months-of-cover figure underneath it
 * divided that wrong number by the burn.
 *
 * The right reading is an ANCHOR plus every movement since: the last figure
 * somebody actually stood behind, then the txns after it. That is what
 * `balanceOf` does, and it is the Cash Book's definition rather than a
 * second one invented for a dashboard — so the two screens cannot disagree
 * about how much money there is.
 *
 * ## What counts as an anchor, and why today's count does not
 *
 * Two kinds, read backwards from the day in question:
 *
 * - a **counted close** on an earlier day — the money actually there that
 *   evening, so everything AFTER that day still applies (exclusive);
 * - a **set opening** — what the day started with, so that day's own
 *   movements still apply (inclusive).
 *
 * **Today's count is deliberately never an anchor.** An end-of-day count is
 * a correction, and this figure is asked at all hours. Anchoring on it would
 * also break the reconciliation that compares the books against the count:
 * fed the count, it would be comparing a number with itself and could never
 * fail.
 *
 * ## Absence is not zero, here most of all
 *
 * A shop with no anchor at all has no derivable position — only a movement
 * total, which is the bug above wearing a different hat. `balanceOf` says
 * `partial` in that case and names what is missing, so a screen can show the
 * movement while admitting it is not the position.
 */

import { known, partial, unavailable, type Derived } from './derived.js';
import * as Money from './money.js';
import type { Money as Amount } from './money.js';

/**
 * The three accounts, by the keys the database actually stores.
 *
 * Every cash total filters on an exact account key, so a row carrying
 * anything else is invisible to all of them — which is what once made a
 * misfiled row look recorded. `UNFILED` is how such a row is surfaced
 * instead of silently dropped.
 */
export const ACCOUNTS = [
  { key: 'cash', label: 'Cash' },
  { key: 'momo', label: 'Mobile Money' },
  { key: 'bank', label: 'Bank' },
] as const;

export type AccountKey = (typeof ACCOUNTS)[number]['key'];

export const isAccountKey = (v: string): v is AccountKey =>
  ACCOUNTS.some((a) => a.key === v);

/** A movement in or out of one account on one day. */
export interface CashTxn {
  readonly id: string;
  /** The day it is filed under. ISO `YYYY-MM-DD`, as the column stores it. */
  readonly on: string;
  /** The account key, or the raw string when it is not one of the three. */
  readonly account: string;
  /** `receipt` / `in` are money in; `payment` / `expense` / `out` are out. */
  readonly type: string;
  readonly category: string | null;
  readonly amount: Amount;
}

/** A day the owner opened or counted, from `cash_days`. */
export interface CashDay {
  readonly on: string;
  /** What each account started the day with, when the opening was set. */
  readonly opening: Readonly<Record<string, number>> | null;
  /** What was actually counted at the close. */
  readonly actual: Readonly<Record<string, number>> | null;
  readonly openingSet: boolean;
}

const MONEY_IN = new Set(['receipt', 'in']);
const MONEY_OUT = new Set(['payment', 'expense', 'out']);

export const isMoneyIn = (t: CashTxn): boolean => MONEY_IN.has(t.type);
export const isMoneyOut = (t: CashTxn): boolean => MONEY_OUT.has(t.type);

/**
 * A movement that is neither in nor out is not a rounding question — it is
 * a row this reckoning does not understand, and it must not be netted to
 * nothing. Callers surface it rather than dropping it.
 */
export const isUnclassified = (t: CashTxn): boolean => !isMoneyIn(t) && !isMoneyOut(t);

export interface Anchor {
  readonly value: Amount;
  readonly from: string;
  /** True for a set opening (that day's txns still count), false for a close. */
  readonly inclusive: boolean;
  readonly kind: 'opening' | 'count';
}

const readCell = (
  row: Readonly<Record<string, number>> | null,
  account: string,
): number | null => {
  if (row === null) return null;
  const v = row[account];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

/**
 * The last figure somebody stood behind for this account, on or before
 * `asOf` — a close on an earlier day, else an opening that was set.
 */
export function anchorFor(
  account: string,
  asOf: string,
  days: readonly CashDay[],
): Anchor | null {
  const upto = days.filter((d) => d.on <= asOf).sort((a, b) => (a.on < b.on ? 1 : -1));

  for (const day of upto) {
    // An earlier day's counted close outranks that same day's opening: it is
    // the later of the two facts about the account.
    if (day.on < asOf) {
      const counted = readCell(day.actual, account);
      if (counted !== null) {
        return { value: Money.money(Math.round(counted)), from: day.on, inclusive: false, kind: 'count' };
      }
    }
    if (day.openingSet) {
      const opening = readCell(day.opening, account);
      if (opening !== null) {
        return { value: Money.money(Math.round(opening)), from: day.on, inclusive: true, kind: 'opening' };
      }
    }
  }
  return null;
}

/** Every txn that applies on top of an anchor, in the anchor's own terms. */
export function movementsSince(
  account: string,
  asOf: string,
  anchor: Anchor | null,
  txns: readonly CashTxn[],
): readonly CashTxn[] {
  return txns.filter((t) => {
    if (t.account !== account || t.on === '' || t.on > asOf) return false;
    if (anchor === null) return true;
    return anchor.inclusive ? t.on >= anchor.from : t.on > anchor.from;
  });
}

/**
 * What one account holds on `asOf`.
 *
 * `partial` rather than `known` when there is no anchor: the figure returned
 * is the movement total, which is a real number about a real thing, and it
 * is NOT the position. Saying so is the whole point — the old app's bug was
 * presenting the first as the second.
 */
export function balanceOf(
  account: string,
  asOf: string,
  txns: readonly CashTxn[],
  days: readonly CashDay[],
): Derived<Amount> {
  const anchor = anchorFor(account, asOf, days);
  const applies = movementsSince(account, asOf, anchor, txns);

  const unclassified = applies.filter(isUnclassified);
  const moved = Money.add(
    ...applies
      .filter((t) => !isUnclassified(t))
      .map((t) => (isMoneyIn(t) ? t.amount : Money.negate(t.amount))),
  );

  const basis =
    anchor === null
      ? `${applies.length} movements, with no opening or count behind them`
      : `${anchor.kind === 'count' ? 'counted' : 'opened'} at ${Money.format(anchor.value)} on ${anchor.from}, then ${applies.length} movements`;

  if (unclassified.length > 0) {
    return partial(
      anchor === null ? moved : Money.add(anchor.value, moved),
      basis,
      `${unclassified.length} movements are neither money in nor money out`,
    );
  }

  if (anchor === null) {
    return partial(
      moved,
      basis,
      'no opening balance or count, so this is what moved rather than what is held',
    );
  }

  return known(Money.add(anchor.value, moved), basis);
}

export interface AccountBalance {
  readonly key: string;
  readonly label: string;
  readonly amount: Derived<Amount>;
}

export interface CashPosition {
  readonly byAccount: readonly AccountBalance[];
  readonly total: Derived<Amount>;
  /** Accounts carrying money, for the basis line — never a count of three. */
  readonly accountsInUse: number;
  /** Rows filed under an account key the shop does not have. */
  readonly misfiled: readonly string[];
}

/** What the shop holds, across the three accounts, on `asOf`. */
export function cashOnHand(
  asOf: string,
  txns: readonly CashTxn[],
  days: readonly CashDay[],
): CashPosition {
  const byAccount = ACCOUNTS.map((a) => ({
    key: a.key,
    label: a.label,
    amount: balanceOf(a.key, asOf, txns, days),
  }));

  const misfiled = [
    ...new Set(txns.filter((t) => !isAccountKey(t.account)).map((t) => t.account)),
  ].filter((a) => a !== '');

  const total = balancesTotal(byAccount);

  return {
    byAccount,
    total,
    accountsInUse: byAccount.filter((a) => {
      const v = a.amount;
      return v.status !== 'unavailable' && !Money.isZero(v.value);
    }).length,
    misfiled,
  };
}

/**
 * The three accounts added up, with doubt carried.
 *
 * One account whose position is only a movement makes the TOTAL only a
 * movement too. `combine` would say the same thing; this spells it out
 * because the basis line has to name which account it was.
 */
function balancesTotal(byAccount: readonly AccountBalance[]): Derived<Amount> {
  const bad = byAccount.filter((a) => a.amount.status === 'unavailable');
  if (bad.length === byAccount.length) {
    return unavailable('no account could be read');
  }

  const sum = Money.add(
    ...byAccount
      .filter((a) => a.amount.status !== 'unavailable')
      .map((a) => (a.amount.status === 'unavailable' ? Money.ZERO : a.amount.value)),
  );

  const shaky = byAccount.filter((a) => a.amount.status === 'partial');
  const basis = `${byAccount.length - bad.length} of ${byAccount.length} accounts`;

  if (bad.length > 0 || shaky.length > 0) {
    const names = [...bad, ...shaky].map((a) => a.label).join(', ');
    return partial(sum, basis, `${names} could not be fully read`);
  }
  return known(sum, basis);
}

/** How far back the burn is measured. The old app's window, kept. */
export const BURN_WINDOW_DAYS = 90;

/**
 * Buying stock, by the old app's own definition of it.
 *
 * Its `stockOut` bucket is exactly this pair, and its comment says why it
 * is named rather than defined by exclusion: *"that set also holds Loan
 * Repayment, which is financing, and folding it in here reported a
 * repayment as money spent on stock."* Matched on the exact category
 * strings the old app matches, so a row cannot be stock to one app and a
 * running cost to the other.
 */
export const STOCK_CATEGORIES: readonly string[] = ['Stock Purchase', 'Supplier Payment'];

/**
 * The shop's own money moving between the shop's own tills.
 *
 * Withdrawing 500,000 from the bank to put in the drawer spends nothing —
 * the shop has exactly what it had. The old app writes both legs under
 * `CASH_TRANSFER_CATEGORY` and puts it in `CASH_NOT_OPEX` and
 * `CASH_NOT_REVENUE` alike, so the pair cancels.
 */
export const TRANSFER_CATEGORIES: readonly string[] = ['Account Transfer'];

const STOCK = new Set(STOCK_CATEGORIES);
const TRANSFER = new Set(TRANSFER_CATEGORIES);

/** Money out that went on stock rather than on running the shop. */
export const isStockMoneyOut = (t: CashTxn): boolean =>
  isMoneyOut(t) && t.category !== null && STOCK.has(t.category);

/** A leg of a transfer: out of one till and into another of the shop's own. */
export const isOwnMoneyMoving = (t: CashTxn): boolean =>
  t.category !== null && TRANSFER.has(t.category);

const DAY = 86_400_000;

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * The average monthly cost of RUNNING the shop, over the history that
 * actually exists.
 *
 * ## Buying stock is not burn
 *
 * This is the fix the real books forced. Over 49 days this shop paid out
 * 84,276,386, of which **77,567,014 — 92% — was category `Stock
 * Purchase`**. Counted as burn, that put the cover at 0.2 months, six days,
 * with a warning on the owner's Today screen. Take the stock out and the
 * running cost is 3,979,207 a month, which against 10,474,426 of cash is
 * 2.6 months. Over the same window 108,271,245 came IN: the shop is cash
 * generative and was being told it had a week to live.
 *
 * Stock is not consumption, it is cash in another shape. It sits on the
 * shelf — valued at 11,186,018 in the cell two along — and comes back when
 * it sells. The old app's own income statement says exactly this about the
 * same rows: *"`Stock Purchase` — inventory. It becomes a cost when the
 * goods are SOLD, through COGS — counting the purchase as well would charge
 * for it twice."* Its `dashMonthlyBurn` nonetheless filters on `type` alone
 * and includes them, so the shop's dashboard has shown the alarming figure
 * all along. This is a deliberate, argued divergence from the old app,
 * approved by the owner — not a port.
 *
 * ## A transfer never left
 *
 * Also excluded, and this one is not a judgement call: the outgoing leg of
 * a bank-to-drawer transfer is not money the shop spent. The matching
 * receipt is counted as money in, so a transfer nets to nothing in the
 * POSITION while inflating the BURN by its own size. The old app puts
 * `Account Transfer` in `CASH_NOT_OPEX` for the same reason.
 *
 * ## What stays in, and why
 *
 * `CASH_NOT_OPEX` has seven entries; only three of them are dropped here.
 * Loan Repayment, Capital Withdrawal, Equipment purchase and Owner
 * Withdrawal are all excluded from the shop's INCOME STATEMENT, because
 * they are not costs of trading. They are not excluded here, because cover
 * is not a question about profit — it is a question about cash, and that
 * money has left the shop and is not coming back. A van, a loan payment
 * and the owner's own drawings all shorten the runway.
 *
 * ## The span, not the window
 *
 * Dividing a 90-day window by a flat three months is the other bug this
 * inherits a fix for: a shop ten days old had ten days of spending divided
 * by three months, understating the burn ninefold and overstating the cover
 * by the same — 3.0 months reported where there were 0.3. The window is
 * right; assuming it is full is what was wrong.
 */
export function monthlyBurn(asOf: Date, txns: readonly CashTxn[]): Derived<Amount> {
  const from = isoDay(new Date(asOf.getTime() - (BURN_WINDOW_DAYS - 1) * DAY));
  const to = isoDay(asOf);
  const inWindow = txns.filter((t) => t.on >= from && t.on <= to);

  if (inWindow.length === 0) {
    return unavailable(`nothing moved in or out in the last ${BURN_WINDOW_DAYS} days`);
  }

  const out = inWindow.filter(isMoneyOut);
  if (out.length === 0) {
    return unavailable(`nothing was paid out in the last ${BURN_WINDOW_DAYS} days`);
  }

  const running = out.filter((t) => !isStockMoneyOut(t) && !isOwnMoneyMoving(t));
  // A shop whose every payment in the window was stock has no running cost
  // to measure. That is not a burn of zero — a burn of zero would divide
  // into cover as "forever", which is the `total || 0` bug wearing a hat.
  if (running.length === 0) {
    return unavailable(
      `everything paid out in the last ${BURN_WINDOW_DAYS} days went on stock or moved between your own tills, so there is no running cost to measure`,
    );
  }

  const spent = Money.add(...running.map((t) => t.amount));
  const onStock = Money.add(...out.filter(isStockMoneyOut).map((t) => t.amount));

  // Measured from the first movement of any kind in the window, not the
  // first payment: a shop that took money for a week before spending any
  // has a week of history, and dating the span from the first payment
  // would shorten it to nothing and report an enormous burn.
  const firstSeen = inWindow.reduce((min, t) => (t.on < min ? t.on : min), to);
  const spanDays = Math.max(
    1,
    Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${firstSeen}T00:00:00Z`).getTime()) / DAY) + 1,
  );
  const months = Math.max(spanDays / 30, 1 / 30);

  // The basis names the stock it left out, because the figure changed
  // meaning and the design system renders this line under the number: an
  // owner who remembers paying out 84 million has to be able to see where
  // the other 77 went.
  const aside = Money.isZero(onStock) ? '' : `, apart from ${Money.format(onStock)} on stock`;

  return known(
    Money.roundDown(spent / months),
    `${Money.format(spent)} paid out over ${spanDays} days${aside}`,
  );
}

/**
 * How many months the cash would last at the current burn.
 *
 * Not a `Money`. A shop that has spent nothing has no derivable cover —
 * "forever" is not a number the books produced.
 */
export function monthsOfCover(held: Derived<Amount>, burn: Derived<Amount>): Derived<number> {
  if (held.status === 'unavailable') return unavailable(`cash on hand ${held.reason}`);
  if (burn.status === 'unavailable') return unavailable(`the burn ${burn.reason}`);
  if (Money.isZero(burn.value)) {
    return unavailable('nothing has been paid out, so there is no rate to divide by');
  }

  const months = Math.round((held.value / burn.value) * 10) / 10;
  const basis = `${Money.format(held.value)} held against ${Money.format(burn.value)} a month`;

  const shaky = held.status === 'partial' ? held : burn.status === 'partial' ? burn : null;
  return shaky === null ? known(months, basis) : partial(months, basis, shaky.missing);
}
