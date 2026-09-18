/**
 * Customers — one record, one balance, one reckoning.
 *
 * ## The cut this module exists to make
 *
 * The old app had a Customers screen and a Debtors screen. A debtor is a
 * customer with a balance — the same record, sorted differently — and the
 * code said so: `renderCustomers()` and `renderDebtorsList()` had to be
 * called together after every void and every payment, and the morning one of
 * them was missed the two screens disagreed about the same debt.
 *
 * So there is no debtors list here, and there is no second balance. There is
 * a customer, the invoices raised against them, and everything else on the
 * screen derived from those: the rail badge, the strip, the groups, the
 * panel and the drift check all read this file.
 *
 * ## Two questions, not one
 *
 * A row on this screen answers **how much** and **whether it comes back**.
 * The amount is the first; {@link howTheyPay} is the second, and it is the
 * reason the screen exists — 2,640,000 owed by someone who always pays is a
 * different morning from 2,410,000 owed by someone who has stopped
 * answering.
 *
 * The bar and the sentence under it are two different facts about the same
 * records, not one ratio drawn twice: the bar is **the share of money** that
 * arrived on time, late and very late, and the sentence counts **invoices**.
 * A single late 5,900,000 and a single late 40,000 are the same count and
 * very different news, which is why the bar is weighted by value.
 *
 * ## What can fail to derive
 *
 * An account with no credit limit recorded is not an account with a limit of
 * zero, and "0 over the limit" would be a claim the books never made. It
 * comes back `unavailable`, and the panel says so.
 */

import { known, match, unavailable, type Derived } from './derived.js';
import * as Money from './money.js';
import type { Money as Amount } from './money.js';

const DAY = 86_400_000;

/** Bought nothing in this long, and the account is a phone call, not a chase. */
export const QUIET_DAYS = 90;

/** "Settle inside 7 days, every time" — the strip's fourth card. */
export const PROMPT_DAYS = 7;

/** Past this far beyond its due date, a debt is not late any more. It is cold. */
export const VERY_LATE_DAYS = 30;

/**
 * More than a fortnight past due and the age reads in bad ink rather than
 * caution. A day past due is a reminder; a fortnight is a decision.
 */
export const HARD_PAST_DUE_DAYS = 14;

/* -------------------------------------------------------------------------- */
/*  The records                                                               */
/* -------------------------------------------------------------------------- */

export interface CustomerInvoice {
  readonly doc: string;
  readonly issued: Date;
  readonly total: Amount;
  /** `null` when no terms were recorded — not "due now". */
  readonly dueOn: Date | null;
  /** What has arrived against it. */
  readonly received: Amount;
  /** When money last arrived against it, settled or not. */
  readonly lastPaidOn: Date | null;
  /** When the LAST shilling arrived, or `null` while anything is still out. */
  readonly settledOn: Date | null;
  /** How many separate payments arrived. Two or more is "pays in pieces". */
  readonly instalments: number;
}

/** What they buy, from the sales analytics derivation. */
export interface ProductShare {
  /** As the row reads it: "Cement 50kg". */
  readonly product: string;
  /** As a sentence reads it: "cement". A row names a line; prose names a thing. */
  readonly shortName: string;
  /** Share of what this customer spends, 0–100. */
  readonly shareOfSpend: number;
  /** What the shop kept on it, as a percentage of the price, 0–100. */
  readonly margin: number;
}

export interface MonthBought {
  /** `May`, `Jun` — the label the bar carries. */
  readonly month: string;
  readonly spent: Amount;
}

export interface Customer {
  readonly id: string;
  readonly name: string;
  readonly since: Date;
  /** Whose name the shop knows the account by — "Wasswa's account". */
  readonly heldBy: string | null;
  readonly phone: string;
  readonly area: string;
  /** `null` when no limit has been agreed for this account. */
  readonly creditLimit: Amount | null;
  readonly invoices: readonly CustomerInvoice[];
  /** What they have said they would pay, and when. Newest order is not
   *  assumed — {@link promisesOf} sorts. */
  readonly promises: readonly Promised[];
  /** Money in against the account, from `customer_debt_log`. A promise
   *  naming a figure is kept by payments inside its own window. */
  readonly payments: readonly DebtPayment[];
  /** Chases sent against the debt that is open now. */
  readonly chasesSent: number;
  readonly chasesAnswered: number;
  /**
   * What the ledger says this account's balance is.
   *
   * It exists to be COMPARED with the invoices, not to be displayed: it is
   * the other side of {@link ledgerAgrees}. The drift check Debtors used to
   * own lives on the customer panel now, where it can be seen.
   */
  readonly ledgerBalance: Amount;
  /** Money held back under a contract until the job is signed off. */
  readonly retentionHeld: boolean;
  /** What the shop kept on them over twelve months, and on what revenue. */
  readonly keptTwelveMonths: Amount | null;
  readonly soldTwelveMonths: Amount | null;
  readonly buys: readonly ProductShare[];
  /** Oldest month first. The panel draws five. */
  readonly monthly: readonly MonthBought[];
}

/* -------------------------------------------------------------------------- */
/*  One customer                                                              */
/* -------------------------------------------------------------------------- */

/** What is still owed on one invoice. Never negative. */
export const owedOn = (inv: CustomerInvoice): Amount =>
  Money.max(Money.ZERO, Money.subtract(inv.total, inv.received));

/** What the account owes, over every invoice raised against it. */
export const balance = (c: Customer): Amount =>
  Money.add(...c.invoices.map(owedOn));

export const owesAnything = (c: Customer): boolean => !Money.isZero(balance(c));

/** Invoices with something still out, oldest first. */
export const openInvoices = (c: Customer): readonly CustomerInvoice[] =>
  c.invoices
    .filter((inv) => !Money.isZero(owedOn(inv)))
    .sort((a, b) => a.issued.getTime() - b.issued.getTime());

const daysBetween = (from: Date, to: Date): number =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY));

/** Whole days since an invoice was raised. */
export const ageOf = (inv: CustomerInvoice, now: Date): number =>
  daysBetween(inv.issued, now);

/**
 * How old the oldest money on this account is.
 *
 * `unavailable` when nothing is owed — the answer is not zero days, it is
 * that there is no oldest debt to age.
 */
export function oldestDebtDays(c: Customer, now: Date): Derived<number> {
  const open = openInvoices(c);
  const oldest = open[0];
  if (oldest === undefined) {
    return unavailable(`${c.name} owes nothing, so there is no debt to age`);
  }
  return known(ageOf(oldest, now), `since ${oldest.doc} was raised`);
}

/** Whole days past an invoice's due date. Negative while it is still in time. */
export function daysPastDue(inv: CustomerInvoice, now: Date): number | null {
  if (inv.dueOn === null) return null;
  return Math.floor((now.getTime() - inv.dueOn.getTime()) / DAY);
}

export const isPastDue = (inv: CustomerInvoice, now: Date): boolean => {
  const over = daysPastDue(inv, now);
  return over !== null && over > 0 && !Money.isZero(owedOn(inv));
};

/**
 * What they have spent with the shop over a window.
 *
 * Derived from the invoices rather than carried as a field: a stored
 * two-year total is a second reckoning of the same money, and it is the one
 * that goes stale the morning an invoice is voided.
 */
export function boughtOver(c: Customer, now: Date, days = 730): Amount {
  const from = now.getTime() - days * DAY;
  return Money.add(
    ...c.invoices.filter((inv) => inv.issued.getTime() >= from).map((inv) => inv.total),
  );
}

/** The last day they bought anything, or `null` if they never have. */
export function lastBought(c: Customer): Date | null {
  let latest: Date | null = null;
  for (const inv of c.invoices) {
    if (latest === null || inv.issued.getTime() > latest.getTime()) latest = inv.issued;
  }
  return latest;
}

/**
 * Which of the four the account is in. Exactly one, and in this order.
 *
 * **Quiet wins over owing.** An account that has bought nothing in ninety
 * days is not a chase, whatever it owes — it is a phone call, and the screen
 * says `call` rather than a place in the ask order. Rashid owes 510,000 and
 * is in the quiet group for exactly that reason.
 */
export type Standing = 'past-due' | 'in-time' | 'quiet' | 'clear';

/**
 * What a customer said, on the day they said it.
 *
 * The chase message this shop sends ends "Please let us know when we can
 * expect payment", and `payment_promises` is where the answer goes. It is a
 * LEDGER, not a stamp: somebody who promises Friday, misses it, and promises
 * next Tuesday is telling you something a single field per customer cannot
 * hold, and the whole value is in the pattern.
 */
export interface Promised {
  readonly id: string;
  readonly promisedOn: Date;
  /** The day they said it. A promise made today about today is not late. */
  readonly madeOn: Date;
  /** `null` means THE BALANCE — most people do not name a figure. */
  readonly amount: Amount | null;
  readonly note: string | null;
}

/** Money that arrived against the account, from the debt ledger. */
export interface DebtPayment {
  readonly on: Date;
  readonly amount: Amount;
}

export type PromiseState = 'kept' | 'broken' | 'waiting';

const onOrBefore = (a: Date, b: Date): boolean => a.getTime() <= b.getTime();

/**
 * Kept, broken, or still waiting — **derived every time, never stored**.
 *
 * A stored verdict and a ledger that disagrees with it is the drift this
 * shop has already had to write a repair banner for once. Ported from the
 * old app's `promiseState`, including the rule that matters most on a
 * Monday morning: a promise for TODAY is still waiting. Nobody is called a
 * liar at nine on the day they named.
 */
export function promiseState(p: Promised, c: Customer, now: Date): PromiseState {
  // Owing nothing keeps any promise about paying, whatever the figures say
  // about which shilling settled which charge.
  if (!owesAnything(c)) return 'kept';

  if (p.amount !== null && !Money.isZero(p.amount)) {
    const paid = Money.add(
      ...c.payments
        .filter((x) => onOrBefore(p.madeOn, x.on) && onOrBefore(x.on, p.promisedOn))
        .map((x) => x.amount),
    );
    if (Money.compare(paid, p.amount) >= 0) return 'kept';
  }

  // No figure named means the balance, and nothing short of clearing it
  // keeps that promise — which the check above has already answered.
  return daysBetween(p.promisedOn, now) > 0 ? 'broken' : 'waiting';
}

/** Their promises, newest first — the order every reading of them wants. */
export const promisesOf = (c: Customer): readonly Promised[] =>
  [...c.promises].sort((a, b) => b.madeOn.getTime() - a.madeOn.getTime());

/** The word they gave most recently, and whether they have kept it. */
export function latestPromise(
  c: Customer,
  now: Date,
): { readonly promise: Promised; readonly state: PromiseState } | null {
  const [newest] = promisesOf(c);
  return newest === undefined ? null : { promise: newest, state: promiseState(newest, c, now) };
}

/** How many they have broken. One is a bad week; the third is the customer. */
export const promisesBroken = (c: Customer, now: Date): number =>
  promisesOf(c).filter((p) => promiseState(p, c, now) === 'broken').length;

/**
 * Whether the shop is owed money it was told it would have by now.
 *
 * This is what "past due" MEANS in this shop, and the real books are why.
 * Not one of the 120 accounts has `terms_days` recorded — the column exists
 * and nobody has ever filled it — so an invoice's `dueOn` is null on every
 * row, `isPastDue` is false on every row, and a lateness test built on
 * terms alone reports thirteen accounts owing 8,210,000 as all "in time".
 *
 * A broken promise is a date the CUSTOMER named, which is better evidence
 * than a term the shop never agreed with them.
 */
export const hasBrokenPromise = (c: Customer, now: Date): boolean =>
  promisesBroken(c, now) > 0;

/**
 * Why an account is on the list to ask.
 *
 * The screen's question is "who do I ask first", and on these books the old
 * answer could not reach anybody: ranking only the past-due accounts ranked
 * nobody, because nobody has terms and nobody has yet broken a promise. So
 * everyone who owes is ranked, and the reason each is there is what tells
 * them apart — which is more use than a group they all sit in anyway.
 */
export type AskReason = 'broke-word' | 'named-a-day' | 'never-asked';

export function askReason(c: Customer, now: Date): AskReason {
  if (hasBrokenPromise(c, now)) return 'broke-word';
  return latestPromise(c, now) === null ? 'never-asked' : 'named-a-day';
}

/** The fact beside the reason, in the shop's own words. */
export function askReads(c: Customer, now: Date): string {
  const latest = latestPromise(c, now);

  if (hasBrokenPromise(c, now)) {
    const n = promisesBroken(c, now);
    return n === 1 ? 'broke their word once' : `broke their word ${n} times`;
  }

  if (latest !== null) return `said ${dayAndMonth(latest.promise.promisedOn)}`;

  // Not "in time" — there is no time they agreed to. Nobody has asked them
  // for a day, which is a thing the owner can fix in one tap.
  return match(oldestDebtDays(c, now), {
    known: (d) => `owing ${d} days · no day named`,
    partial: (d) => `owing ${d} days · no day named`,
    unavailable: () => 'no day named',
  });
}

export function standing(c: Customer, now: Date): Standing {
  const last = lastBought(c);
  if (last !== null && daysBetween(last, now) >= QUIET_DAYS) return 'quiet';
  if (!owesAnything(c)) return 'clear';
  // Either kind of broken word puts an account on the list: a term the shop
  // agreed, or a day the customer named. On this shop's books only the
  // second ever fires, because no account has terms on file.
  const late = c.invoices.some((inv) => isPastDue(inv, now)) || hasBrokenPromise(c, now);
  return late ? 'past-due' : 'in-time';
}

/**
 * By how much the account is beyond its credit limit.
 *
 * `unavailable` when no limit has been agreed — an account with no limit is
 * not an account with a limit of zero, and the panel has to say which.
 */
export function overLimitBy(c: Customer): Derived<Amount> {
  if (c.creditLimit === null) {
    return unavailable(`no credit limit has been agreed for ${c.name}`);
  }
  const over = Money.subtract(balance(c), c.creditLimit);
  return known(
    Money.max(Money.ZERO, over),
    `${Money.format(balance(c))} owed against a limit of ${Money.format(c.creditLimit)}`,
  );
}

/** Over the limit blocks new credit sales at the till. Stated here, not inferred. */
export function isBlocked(c: Customer): boolean {
  const over = overLimitBy(c);
  return over.status !== 'unavailable' && !Money.isZero(over.value);
}

/* -------------------------------------------------------------------------- */
/*  How they pay                                                              */
/* -------------------------------------------------------------------------- */

export interface PayBands {
  /** Share of settled money, 0–100, summing to 100 where there is any. */
  readonly onTime: number;
  readonly late: number;
  readonly veryLate: number;
  /** Invoices settled, and how many of them arrived after their due date. */
  readonly settled: number;
  readonly lateCount: number;
  readonly veryLateCount: number;
  /** Average whole days from raising an invoice to the last shilling. */
  readonly settlesInDays: number | null;
  /** Settled invoices that arrived in more than one payment. */
  readonly inPieces: number;
}

/**
 * The bar, as shares of money rather than counts of documents.
 *
 * A customer with twenty-three small invoices paid on the day and one large
 * one ninety days late is not a good payer, and a count-weighted bar would
 * draw them as one. The share of money that came back late is the fact the
 * owner is actually asking for.
 */
export function payBands(c: Customer): PayBands {
  const settled = c.invoices.filter((inv) => inv.settledOn !== null);

  let onTimeValue = 0;
  let lateValue = 0;
  let veryLateValue = 0;
  let lateCount = 0;
  let veryLateCount = 0;
  let totalDays = 0;
  let inPieces = 0;

  for (const inv of settled) {
    const settledOn = inv.settledOn;
    if (settledOn === null) continue;
    const over =
      inv.dueOn === null ? 0 : Math.floor((settledOn.getTime() - inv.dueOn.getTime()) / DAY);
    if (over > VERY_LATE_DAYS) {
      veryLateValue += inv.total;
      veryLateCount += 1;
      lateCount += 1;
    } else if (over > 0) {
      lateValue += inv.total;
      lateCount += 1;
    } else {
      onTimeValue += inv.total;
    }
    totalDays += daysBetween(inv.issued, settledOn);
    if (inv.instalments > 1) inPieces += 1;
  }

  const total = onTimeValue + lateValue + veryLateValue;
  const share = (part: number): number => (total === 0 ? 0 : Math.round((part / total) * 100));

  return {
    onTime: share(onTimeValue),
    late: share(lateValue),
    veryLate: share(veryLateValue),
    settled: settled.length,
    lateCount,
    veryLateCount,
    settlesInDays: settled.length === 0 ? null : Math.round(totalDays / settled.length),
    inPieces,
  };
}

/** A bar with nothing in it yet draws one grey band, not an empty trough. */
export const hasPayHistory = (bands: PayBands): boolean => bands.settled > 0;

/**
 * The sentence under the bar, from the same records the bar is drawn from.
 *
 * The order is the order the shop would say it in: what is unknown, then
 * what has stopped, then how the money arrives, then how late it is. Each
 * rule ends in a reading, so there is no case where the bar is drawn without
 * a sentence — a bar on its own is a shape, not a fact.
 */
export function howTheyPay(c: Customer, where: Standing): Derived<string> {
  const bands = payBands(c);

  if (bands.settled === 0) {
    return known('no history yet', 'nothing has been settled on this account');
  }

  const lateShare = bands.late + bands.veryLate;
  const basis = `${bands.settled} settled invoices, weighted by value`;

  if (where === 'quiet') {
    return known(lateShare <= 25 ? 'was reliable' : 'was slow to pay', basis);
  }
  if (bands.inPieces >= 2 && bands.inPieces * 3 >= bands.settled) {
    return known('pays in pieces', `${bands.inPieces} of ${bands.settled} arrived in instalments`);
  }
  if (lateShare < 15) {
    const days = bands.settlesInDays;
    if (days === null) return known('pays on the date', basis);
    return days <= 3
      ? known(`settles in ${days} days`, `${bands.settled} invoices, ${days} days on average`)
      : known('pays on the date', basis);
  }
  if (bands.veryLateCount === 0) {
    return known('slow but always pays', basis);
  }
  return known(
    `late on ${bands.lateCount} of ${bands.settled}`,
    `${bands.lateCount} of ${bands.settled} arrived after the due date`,
  );
}

/**
 * The same reading, in the width a phone row has.
 *
 * Not a truncation of {@link howTheyPay} — a shortened sentence is a
 * different sentence, and "slow but always pays" cut to fit would read
 * "slow but alwa…". Both come off the same records and the same rules, so
 * the two designs can never disagree about a customer; only about how many
 * words they have room for.
 */
export function howTheyPayShort(c: Customer, where: Standing): Derived<string> {
  const bands = payBands(c);

  if (bands.settled === 0) {
    return known('no history yet', 'nothing has been settled on this account');
  }

  const lateShare = bands.late + bands.veryLate;
  const basis = `${bands.settled} settled invoices, weighted by value`;

  if (where === 'quiet') {
    return known(lateShare <= 25 ? 'was reliable' : 'was slow', basis);
  }
  if (bands.inPieces >= 2 && bands.inPieces * 3 >= bands.settled) {
    return known('in pieces', `${bands.inPieces} of ${bands.settled} arrived in instalments`);
  }
  if (lateShare < 15) {
    const days = bands.settlesInDays;
    if (days === null || days > 3) return known('on the date', basis);
    return known(`settles in ${days}d`, `${bands.settled} invoices, ${days} days on average`);
  }
  if (bands.veryLateCount === 0) {
    return known('always pays', basis);
  }
  return known(
    `late ${bands.lateCount} of ${bands.settled}`,
    `${bands.lateCount} of ${bands.settled} arrived after the due date`,
  );
}

/** Settles inside a week, every time — the fourth strip card counts these. */
export function paysWithoutChasing(c: Customer): boolean {
  const bands = payBands(c);
  return (
    bands.settled > 0 &&
    bands.lateCount === 0 &&
    bands.settlesInDays !== null &&
    bands.settlesInDays <= PROMPT_DAYS
  );
}

/* -------------------------------------------------------------------------- */
/*  The drift check                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Does the ledger agree with the invoices?
 *
 * This is the check the Debtors screen used to run where nobody could see
 * it. It is on the customer panel now, beside the invoices it is checking,
 * and it says the amount of any disagreement rather than a bare cross —
 * "the books are 40,000 apart" is actionable and "mismatch" is not.
 */
export function ledgerAgrees(c: Customer): Derived<boolean> {
  const fromInvoices = balance(c);
  const drift = Money.subtract(c.ledgerBalance, fromInvoices);
  if (Money.isZero(drift)) {
    return known(
      true,
      `${Money.format(fromInvoices)} on ${openInvoices(c).length} open invoices`,
    );
  }
  return known(
    false,
    `the books are ${Money.format(Money.abs(drift))} apart — ${Money.format(fromInvoices)} on the invoices, ${Money.format(c.ledgerBalance)} in the ledger`,
  );
}

/* -------------------------------------------------------------------------- */
/*  The ask order                                                             */
/* -------------------------------------------------------------------------- */

export type AskOrder = 'ask' | 'largest' | 'oldest';

/**
 * The screen's own ranking: **blocked accounts first, then the oldest money,
 * largest first.**
 *
 * Two rules, both checkable by the person reading the row.
 *
 * *Blocked first*, because an account over its limit cannot buy anything
 * until it comes down. Chasing it collects money AND reopens a customer;
 * every other chase only collects money.
 *
 * *Then shillings times days*, which is what "oldest money, largest first"
 * means when you have to rank 2,410,000 that is 74 days old against
 * 3,330,000 that is 49. Neither figure wins on its own, and a shop asks for
 * the one that is costing it most, which is the product.
 *
 * The handoff's prose says "age, then amount", which would put Nakawa first;
 * frame 1a draws Mulongo first, and the frame is the design.
 */
export function askScore(c: Customer, now: Date): number {
  const days = oldestDebtDays(c, now);
  const age = days.status === 'unavailable' ? 0 : days.value;
  // Shilling-days. Not money — a score, and it is never shown.
  return Number(balance(c)) * age;
}

export function byAsk(now: Date): (a: Customer, b: Customer) => number {
  return (a, b) => {
    const blocked = Number(isBlocked(b)) - Number(isBlocked(a));
    if (blocked !== 0) return blocked;
    return askScore(b, now) - askScore(a, now);
  };
}

export function sortBy(
  order: AskOrder,
  now: Date,
): (a: Customer, b: Customer) => number {
  switch (order) {
    case 'ask':
      return byAsk(now);
    case 'largest':
      return (a, b) => Money.compare(balance(b), balance(a));
    case 'oldest':
      return (a, b) => {
        const age = (c: Customer): number => {
          const d = oldestDebtDays(c, now);
          return d.status === 'unavailable' ? -1 : d.value;
        };
        return age(b) - age(a);
      };
  }
}

/** How the card header names the order it is in. */
export const ORDER_READS: Record<AskOrder, string> = {
  ask: 'oldest money, largest first',
  largest: 'largest first',
  oldest: 'oldest first',
};

/* -------------------------------------------------------------------------- */
/*  The whole book                                                            */
/* -------------------------------------------------------------------------- */

export interface Book {
  readonly all: readonly Customer[];
  /** Accounts with a balance that are still buying — the Owing lens. */
  readonly owing: readonly Customer[];
  readonly pastDue: readonly Customer[];
  readonly inTime: readonly Customer[];
  readonly quiet: readonly Customer[];
  /** Owing accounts by WHY they are on the list to ask — three partitions
   *  of `owing`, so the groups and the ranking read one reckoning. */
  readonly brokeWord: readonly Customer[];
  readonly namedADay: readonly Customer[];
  readonly neverAsked: readonly Customer[];
}

export function read(all: readonly Customer[], now: Date): Book {
  const pastDue = all.filter((c) => standing(c, now) === 'past-due');
  const inTime = all.filter((c) => standing(c, now) === 'in-time');
  const quiet = all.filter((c) => standing(c, now) === 'quiet');
  const owing = [...pastDue, ...inTime];
  return {
    all,
    owing,
    pastDue,
    inTime,
    quiet,
    brokeWord: owing.filter((c) => askReason(c, now) === 'broke-word'),
    namedADay: owing.filter((c) => askReason(c, now) === 'named-a-day'),
    neverAsked: owing.filter((c) => askReason(c, now) === 'never-asked'),
  };
}

export const totalOwed = (customers: readonly Customer[]): Amount =>
  Money.add(...customers.map(balance));

/**
 * What the rail badge counts: every account with a balance that is still
 * buying. One reckoning — the badge, the lens count and the list length are
 * this number read three times, never three counts that have to agree.
 */
export const owingBadge = (book: Book): number => book.owing.length;

/* --------------------------------- the strip ------------------------------ */

export interface AgingBand {
  /** Inclusive floor in days. The last band's floor is 0. */
  readonly from: number;
  readonly amount: Amount;
  /** Share of the debt, 0–100. */
  readonly share: number;
  /** What the caption under the bar reads. */
  readonly reads: string;
}

/**
 * The four bands of the strip's aging bar.
 *
 * The caption names the OLDEST debt in each band rather than the band's
 * floor, because "74d" is a fact about this morning's books and "60d+" is a
 * fact about the band definition. The last band is written "under 30d",
 * since naming its oldest would invite the eye to compare it with the three
 * to its left, which are all worse.
 */
export function agingBands(customers: readonly Customer[], now: Date): readonly AgingBand[] {
  const floors = [60, 45, 30, 0] as const;
  const buckets = floors.map(() => ({ amount: 0, oldest: 0 }));
  let total = 0;

  for (const c of customers) {
    for (const inv of openInvoices(c)) {
      const age = ageOf(inv, now);
      const i = floors.findIndex((floor) => age >= floor);
      const bucket = buckets[i];
      if (bucket === undefined) continue;
      bucket.amount += owedOn(inv);
      bucket.oldest = Math.max(bucket.oldest, age);
      total += owedOn(inv);
    }
  }

  return floors.map((from, i) => {
    const bucket = buckets[i] ?? { amount: 0, oldest: 0 };
    return {
      from,
      amount: Money.money(bucket.amount),
      share: total === 0 ? 0 : Math.round((bucket.amount / total) * 100),
      reads: from === 0 ? 'under 30d' : `${bucket.amount === 0 ? from : bucket.oldest}d`,
    };
  });
}

export interface ConcentrationRead {
  readonly amount: Amount;
  readonly customers: readonly Customer[];
  /** Share of the whole debt those customers hold, 0–100. */
  readonly share: number;
}

/**
 * What the top of the ask order is worth — "ask these three first".
 *
 * It ranks the PAST DUE group, not everyone owing. An account whose money is
 * not due yet is not someone you ask first; it is someone you do not ask.
 * The list's own rank chips come from the same call, which is why the strip
 * figure and the `1st` chip can never name different people.
 */
export function askTheseFirst(book: Book, now: Date, howMany = 3): ConcentrationRead {
  // `owing`, not `pastDue`. Reading the smaller list reported "Nothing is
  // owed by any of the 120" on a shop where thirteen accounts owed
  // 8,210,000, because none of them had terms on file to be past.
  const top = [...book.owing].sort(byAsk(now)).slice(0, howMany);
  const amount = totalOwed(top);
  const whole = totalOwed(book.owing);
  return {
    amount,
    customers: top,
    share: Money.isZero(whole) ? 0 : Math.round((amount / whole) * 100),
  };
}

/** Accounts over their agreed limit, worst first. */
export const overLimit = (customers: readonly Customer[]): readonly Customer[] =>
  customers
    .filter(isBlocked)
    .sort((a, b) => Money.compare(balance(b), balance(a)));

/** The best accounts: what they have bought over two years, largest first. */
export const best = (
  customers: readonly Customer[],
  now: Date,
  howMany: number,
): readonly Customer[] =>
  [...customers]
    .sort((a, b) => Money.compare(boughtOver(b, now), boughtOver(a, now)))
    .slice(0, howMany);

/** The one account that has bought the most of anyone. Wears "biggest buyer". */
export function biggestBuyer(customers: readonly Customer[], now: Date): Customer | null {
  return best(customers, now, 1)[0] ?? null;
}

/* ------------------------------ what they earn ---------------------------- */

/**
 * What the shop kept on this account, as a percentage.
 *
 * `unavailable` without both figures: a margin off a revenue with no cost
 * behind it is the exact bug `Derived` was written for — the old app showed
 * 100% whenever a supplier price was missing.
 */
export function marginPercent(c: Customer): Derived<number> {
  const kept = c.keptTwelveMonths;
  const sold = c.soldTwelveMonths;
  if (kept === null || sold === null || Money.isZero(sold)) {
    return unavailable(`${c.name} has no twelve-month cost on file, so margin cannot be derived`);
  }
  return known(
    Math.round((kept / sold) * 100),
    `${Money.format(kept)} kept on ${Money.format(sold)} sold`,
  );
}

/**
 * The reading under the product table.
 *
 * It names the largest thing they take, says whether it is the thinnest, and
 * works out what it would take to bring the account to the shop average —
 * the whole point being that the biggest account is not automatically the
 * best one. The rise is derived rather than asserted: raising the price of
 * one product raises both the money kept AND the money sold, so it is not
 * simply the gap divided by the share.
 */
export function marginReading(c: Customer, shopAverage: number): Derived<string> {
  const mine = marginPercent(c);
  if (mine.status === 'unavailable') return unavailable(mine.reason);

  const biggest = [...c.buys].sort((a, b) => b.shareOfSpend - a.shareOfSpend)[0];
  if (biggest === undefined) {
    return unavailable(`nothing is recorded against what ${c.name} buys`);
  }
  const thinnest = [...c.buys].sort((a, b) => a.margin - b.margin)[0];
  const isThinnest = thinnest?.product === biggest.product;

  if (mine.value >= shopAverage) {
    return known(
      capitalise(
        `${biggest.shortName} is most of what they take, and this account already sits at or above the shop average.`,
      ),
      mine.basis,
    );
  }

  // Raising one product's price by `r` lifts kept by share·r and sold by the
  // same, so the share is on both sides of the fraction and the answer is
  // never the naive (gap / share).
  const share = biggest.shareOfSpend / 100;
  const target = shopAverage / 100;
  const current = mine.value / 100;
  if (share === 0 || target >= 1) {
    return unavailable(`${biggest.product} is no part of what ${c.name} spends`);
  }
  const rise = Math.round(((target - current) / (share * (1 - target))) * 100);

  const first = isThinnest
    ? `${biggest.shortName} is most of what they take and the thinnest thing you sell.`
    : `${biggest.shortName} is most of what they take.`;

  return known(
    `${capitalise(first)} A ${rise}% rise on ${biggest.shortName} alone would put this account at the shop average.`,
    `${mine.value}% against a shop average of ${shopAverage}%`,
  );
}

/* -------------------------------- the quiet ------------------------------- */

/**
 * Why they stopped buying, when the books can say.
 *
 * The screen's second insight, and it is derived rather than written: if
 * their buying fell away in the same month an invoice fell due, the debt is
 * the reason for the quiet and not a coincidence — which reads as a credit
 * block, not lost interest, and is a different conversation.
 */
export function isQuietMonth(c: Customer, month: MonthBought): boolean {
  const busiest = c.monthly.reduce<MonthBought | null>(
    (a, b) => (a === null || Money.compare(b.spent, a.spent) > 0 ? b : a),
    null,
  );
  if (busiest === null) return false;
  return Money.compare(Money.times(month.spent, 2), busiest.spent) < 0;
}

export function quietReading(c: Customer, now: Date): Derived<string> {
  const months = c.monthly;
  if (months.length < 3) {
    return unavailable(`${c.name} has too little buying history to read a trend`);
  }
  const busiest = months.reduce((a, b) => (Money.compare(b.spent, a.spent) > 0 ? b : a));
  // Under half their best month is not a slow month, it is a stop.
  const quiet = months.filter((m) => Money.compare(Money.times(m.spent, 2), busiest.spent) < 0);
  const firstQuiet = quiet[0];
  if (firstQuiet === undefined) {
    return known('They are still buying at their usual rate.', 'five months of buying');
  }

  const fellDue = c.invoices.find((inv) => {
    if (inv.dueOn === null) return false;
    return monthLabel(inv.dueOn) === firstQuiet.month && isPastDue(inv, now);
  });

  if (fellDue === undefined) {
    return known(
      `They have bought almost nothing since ${firstQuiet.month}, and no invoice fell due that month.`,
      'five months of buying against the open invoices',
    );
  }
  return known(
    `They stopped buying when the ${monthName(fellDue.issued)} invoice fell due, not before. The debt is the reason for the quiet, not a coincidence.`,
    `${fellDue.doc} fell due in ${firstQuiet.month}`,
  );
}

/* -------------------------------------------------------------------------- */
/*  What a row says about itself                                              */
/* -------------------------------------------------------------------------- */

/**
 * The pill and the fact beside it.
 *
 * One qualifier per row, and the order is the order the shop cares in:
 * blocked, then part paid, then their size, then how often you have asked.
 * A row carrying four pills is a row nobody reads.
 */
export type QualifierTone = 'warn' | 'info' | 'neutral';

export interface Qualifier {
  readonly pill: string;
  readonly tone: QualifierTone;
  /** The short fact beside it, or `null` when the pill says it all. */
  readonly fact: string | null;
}

export function qualifier(c: Customer, book: Book, now: Date): Qualifier | null {
  const open = openInvoices(c);

  if (isBlocked(c)) {
    return { pill: 'over limit', tone: 'warn', fact: c.heldBy };
  }

  const partPaid = open.find((inv) => !Money.isZero(inv.received));
  if (partPaid !== undefined) {
    return {
      pill: 'part paid',
      tone: 'warn',
      fact: `${Money.format(partPaid.received)} in on ${dayAndMonth(partPaid.lastPaidOn ?? partPaid.issued)}`,
    };
  }

  if (biggestBuyer(book.all, now)?.id === c.id) {
    return {
      pill: 'biggest buyer',
      tone: 'info',
      fact: `${Money.formatMillions(boughtOver(c, now))} over 2 years`,
    };
  }

  if (c.chasesSent > 0) {
    return {
      pill: `${c.chasesSent} chases`,
      tone: 'neutral',
      fact: c.chasesAnswered === 0 ? 'none answered' : `${c.chasesAnswered} answered`,
    };
  }

  return null;
}

/**
 * The plain line under a name that carries no pill: when the next money is
 * due, or — for an account that has gone quiet — when they last bought and
 * what rhythm they had before.
 */
export function rowNote(c: Customer, where: Standing, now: Date): string {
  const open = openInvoices(c);

  if (where === 'quiet') {
    const last = lastBought(c);
    const rhythm = boughtMonthly(c) ? 'was monthly' : 'was occasional';
    return last === null ? rhythm : `last bought ${dayAndMonth(last)} · ${rhythm}`;
  }

  if (c.retentionHeld) {
    const due = nextDue(open);
    return due === null ? 'retention held' : `due ${dayAndMonth(due)} · retention held`;
  }

  const only = open[0];
  if (c.invoices.length === 1 && open.length === 1 && only !== undefined) {
    const bought = ageOf(only, now) === 0 ? 'bought today' : `bought ${dayAndMonth(only.issued)}`;
    return `${bought} · first time on credit`;
  }

  const due = nextDue(open);
  const count = `${open.length} ${open.length === 1 ? 'invoice' : 'invoices'}`;
  return due === null ? count : `due ${dayAndMonth(due)} · ${count}`;
}

/**
 * Did they buy in most months, before they stopped?
 *
 * Read over the six months ending at their LAST purchase, not the last six
 * months of the calendar — a quiet account bought nothing in either of the
 * two most recent, and measuring there would call every quiet account
 * occasional, which is the opposite of what the row is saying.
 */
export function boughtMonthly(c: Customer): boolean {
  const last = lastBought(c);
  if (last === null) return false;
  const from = last.getTime() - 6 * 30 * DAY;
  const months = new Set(
    c.invoices
      .filter((inv) => inv.issued.getTime() >= from && inv.issued.getTime() <= last.getTime())
      .map((inv) => `${inv.issued.getUTCFullYear()}-${inv.issued.getUTCMonth()}`),
  );
  return months.size >= 4;
}

function nextDue(open: readonly CustomerInvoice[]): Date | null {
  let soonest: Date | null = null;
  for (const inv of open) {
    if (inv.dueOn === null) continue;
    if (soonest === null || inv.dueOn.getTime() < soonest.getTime()) soonest = inv.dueOn;
  }
  return soonest;
}

/* -------------------------------------------------------------------------- */
/*  Reading a name and a date                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A small count, in words, for a sentence.
 *
 * "35% sits with three accounts" is prose and reads as prose; "35% sits with
 * 3 accounts" reads as a table that lost its column. The figure face is for
 * figures you act on, and this is not one — the money beside it is.
 */
const SMALL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export const inWords = (n: number): string => SMALL[n] ?? String(n);

const capitalise = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;

/** "Mulongo Hardware" is MH, "Kato Construction Ltd" is KC. Two, never three. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 0);
  const first = words[0]?.[0] ?? '?';
  const second = words[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase();
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export const monthLabel = (d: Date): string => MONTHS[d.getUTCMonth()] ?? '';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** A month in prose. Chrome abbreviates; a sentence does not. */
export const monthName = (d: Date): string => MONTH_NAMES[d.getUTCMonth()] ?? '';

/** "25 Aug". Never 2026-08-25 in a row a human reads. */
export const dayAndMonth = (d: Date): string =>
  `${d.getUTCDate()} ${monthLabel(d)}`;

/** "customer since Mar 2024". */
export const sinceReads = (d: Date): string =>
  `${monthLabel(d)} ${d.getUTCFullYear()}`;
