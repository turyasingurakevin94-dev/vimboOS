/**
 * Invoices — one reckoning, read by two ledgers and a dialog.
 *
 * The handoff is explicit about the rule this module exists to enforce:
 * *"Any figure shown in both the ledger and the dialog must come from one
 * reckoning."* A row that says `40,000 still due` and a dialog that says
 * `Balance due 40,000` are not two calculations that happen to agree — they
 * are one calculation, read twice. The old app had them as two, and they
 * drifted whenever a payment was voided.
 *
 * ## Money in and money out are one piece of money
 *
 * The screen drops the Sales / Purchases toggle, and this module is why it
 * can: a sale and the purchases raised to fill it are linked, so selecting
 * either side can name exactly what the other side does not touch. That is
 * `linkedTo` — the whole of the dimming behaviour, as data.
 *
 * ## What can fail to derive
 *
 * An invoice with no terms recorded has no due date, so **whether it is late
 * cannot be derived** — and "not late" would be a claim, not an absence. It
 * comes back `unavailable`, and the ledger has to say so rather than render
 * a reassuring `Open`.
 */

import { known, partial, unavailable, type Derived } from './derived.js';
import * as Money from './money.js';
import type { Money as Amount } from './money.js';

const DAY = 86_400_000;

export interface Payment {
  readonly id: string;
  readonly on: Date;
  readonly amount: Amount;
  /** How it arrived: `Cash`, `Mobile money`, `Bank transfer`. */
  readonly method: string;
  /** Which account it landed in — `Cash · shop till`. The dialog names both. */
  readonly account: string;
  readonly takenBy: string;
}

/** Why a document is struck through rather than simply gone. */
export interface Voided {
  readonly replacedBy: string | null;
  readonly on: Date;
}

export interface SalesInvoice {
  readonly kind: 'sale';
  readonly doc: string;
  readonly customer: string;
  readonly total: Amount;
  readonly issued: Date;
  /** `null` when no terms were recorded — not "due now". */
  readonly dueOn: Date | null;
  readonly payments: readonly Payment[];
  readonly voided?: Voided;
}

export interface PurchaseInvoice {
  readonly kind: 'purchase';
  readonly doc: string;
  readonly supplier: string;
  readonly total: Amount;
  readonly paid: Amount;
  readonly dueOn: Date | null;
  /**
   * The sale this was raised to fill, if it was raised for one. `null` is
   * the shop buying stock on its own account — the ledger writes that as
   * "stock, no invoice" rather than leaving the cell blank, because blank
   * reads as missing data.
   */
  readonly forSale: string | null;
  readonly voided?: Voided;
}

export type Invoice = SalesInvoice | PurchaseInvoice;

/* -------------------------------------------------------------------------- */
/*  One invoice                                                               */
/* -------------------------------------------------------------------------- */

/** What has actually arrived against a sale. */
export const receivedSoFar = (inv: SalesInvoice): Amount =>
  Money.add(...inv.payments.map((p) => p.amount));

/** What is still owed. Never negative: an overpayment is not a debt owed back. */
export const balanceDue = (inv: SalesInvoice): Amount =>
  Money.max(Money.ZERO, Money.subtract(inv.total, receivedSoFar(inv)));

/** What is still owed on a purchase. */
export const stillToPay = (p: PurchaseInvoice): Amount =>
  Money.max(Money.ZERO, Money.subtract(p.total, p.paid));

/**
 * The share of an invoice that has been paid off, as the whole number the
 * progress bar and its caption both use.
 *
 * An invoice for nothing is not 0% paid and not 100% paid — there is no
 * share of nothing — so it comes back `partial` at zero with the reason.
 */
export function paidOffShare(inv: SalesInvoice): Derived<number> {
  if (Money.isZero(inv.total)) {
    return partial(0, 'an invoice for nothing', 'no total to take a share of');
  }
  return known(Math.round((receivedSoFar(inv) / inv.total) * 100), 'received over invoiced');
}

/** How the row and its tag read. `voided` is a document, not a debt. */
export type InvoiceState = 'voided' | 'settled' | 'late' | 'part' | 'open';

/**
 * What state an invoice is in.
 *
 * `unavailable` when it is unsettled and carries no due date: whether it is
 * late is genuinely unknown, and answering `open` would be the app deciding
 * that no terms means no lateness.
 */
export function state(inv: SalesInvoice, now: Date): Derived<InvoiceState> {
  if (inv.voided !== undefined) return known('voided', 'the document was voided');
  if (Money.isZero(balanceDue(inv))) return known('settled', 'nothing is still due');
  if (inv.dueOn === null) {
    return unavailable(`${inv.doc} has no terms recorded, so lateness cannot be derived`);
  }
  if (now.getTime() > inv.dueOn.getTime()) return known('late', 'past its due date');
  if (!Money.isZero(receivedSoFar(inv))) return known('part', 'part paid, not yet due');
  return known('open', 'issued, nothing received, not yet due');
}

/** Whole days since the invoice was issued — the row's "· 29 days ·". */
export const daysOld = (inv: SalesInvoice, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - inv.issued.getTime()) / DAY));

/**
 * How much attention the money needs, worst first.
 *
 * The ledger groups by this and the handoff says so: overdue, then open,
 * then settled. An invoice whose state cannot be derived sorts with the
 * overdue — an unknown is not a reason to bury something.
 */
const ATTENTION: Readonly<Record<InvoiceState | 'unknown', number>> = {
  late: 0,
  unknown: 1,
  part: 2,
  open: 3,
  settled: 4,
  voided: 5,
};

export const attentionRank = (inv: SalesInvoice, now: Date): number => {
  const s = state(inv, now);
  return ATTENTION[s.status === 'unavailable' ? 'unknown' : s.value];
};

/** Worst first, then oldest first — the order the left ledger is drawn in. */
export const byAttention =
  (now: Date) =>
  (a: SalesInvoice, b: SalesInvoice): number =>
    attentionRank(a, now) - attentionRank(b, now) || a.issued.getTime() - b.issued.getTime();

/* -------------------------------------------------------------------------- */
/*  Receiving, and un-receiving                                               */
/* -------------------------------------------------------------------------- */

/** The dialog's line to the left of its button: "Receiving this clears the invoice". */
export const receivingClears = (inv: SalesInvoice, amount: Amount): boolean =>
  Money.compare(amount, balanceDue(inv)) >= 0;

/**
 * What deleting a payment does — the two facts frame 2b has to state before
 * it will let the trash icon through.
 *
 * `null` when the id is not a payment on this invoice, which is a bug rather
 * than a user error; the caller must not render a confirmation for it.
 */
export function afterDeleting(
  inv: SalesInvoice,
  paymentId: string,
): { readonly tillFallsBy: Amount; readonly balanceGoesBackTo: Amount } | null {
  const gone = inv.payments.find((p) => p.id === paymentId);
  if (gone === undefined) return null;
  const left = inv.payments.filter((p) => p.id !== paymentId);
  const received = Money.add(...left.map((p) => p.amount));
  return {
    tillFallsBy: gone.amount,
    balanceGoesBackTo: Money.max(Money.ZERO, Money.subtract(inv.total, received)),
  };
}

/**
 * The floor under Edit invoice (frame 2c): a total cannot be edited below
 * what has already been received, because the difference would be money the
 * shop is holding against nothing.
 */
export const lowestEditableTotal = (inv: SalesInvoice): Amount => receivedSoFar(inv);

/* -------------------------------------------------------------------------- */
/*  The balance band                                                          */
/* -------------------------------------------------------------------------- */

export interface BalanceBand {
  readonly owedToUs: Amount;
  readonly openSales: number;
  /** Days since the oldest unsettled sale was issued. */
  readonly oldestDays: Derived<number>;
  readonly weOweSuppliers: Amount;
  readonly unpaidPurchases: number;
  readonly dueToday: number;
  /** Owed to us minus what we owe. Positive is money coming in. */
  readonly netPosition: Amount;
  readonly rangeInvoiced: Amount;
  readonly rangeCount: number;
  /** The share of the range that has been received, as a whole per cent. */
  readonly rangeReceivedShare: Derived<number>;
}

const unsettled = (inv: SalesInvoice): boolean =>
  inv.voided === undefined && !Money.isZero(balanceDue(inv));

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * One reckoning for the band across the top of both ledgers.
 *
 * `sales` is everything in the chosen range; the open figures count only
 * what is genuinely unsettled, and the range figures count all of it. Those
 * are different questions and the band asks both, which is why they are
 * computed together rather than by two callers who might disagree.
 */
export function readBand(
  sales: readonly SalesInvoice[],
  purchases: readonly PurchaseInvoice[],
  now: Date,
): BalanceBand {
  const open = sales.filter(unsettled);
  const owedToUs = Money.add(...open.map(balanceDue));

  const owing = purchases.filter((p) => p.voided === undefined && !Money.isZero(stillToPay(p)));
  const weOweSuppliers = Money.add(...owing.map(stillToPay));

  const live = sales.filter((s) => s.voided === undefined);
  const rangeInvoiced = Money.add(...live.map((s) => s.total));
  const rangeReceived = Money.add(...live.map(receivedSoFar));

  const oldest = open.reduce<Date | null>(
    (worst, s) => (worst === null || s.issued < worst ? s.issued : worst),
    null,
  );

  return {
    owedToUs,
    openSales: open.length,
    oldestDays:
      oldest === null
        ? unavailable('nothing is open, so there is no oldest')
        : known(Math.max(0, Math.floor((now.getTime() - oldest.getTime()) / DAY)), 'the oldest open sale'),
    weOweSuppliers,
    unpaidPurchases: owing.length,
    dueToday: owing.filter((p) => p.dueOn !== null && sameDay(p.dueOn, now)).length,
    netPosition: Money.subtract(owedToUs, weOweSuppliers),
    rangeInvoiced,
    rangeCount: live.length,
    rangeReceivedShare: Money.isZero(rangeInvoiced)
      ? partial(0, 'nothing invoiced in this range', 'no total to take a share of')
      : known(Math.round((rangeReceived / rangeInvoiced) * 100), 'received over invoiced'),
  };
}

/* -------------------------------------------------------------------------- */
/*  The link between the two ledgers                                          */
/* -------------------------------------------------------------------------- */

/**
 * Which documents a selection touches — on both sides.
 *
 * This is the whole of the dimming behaviour: *"selecting a row on either
 * side keeps it and everything it touches at full strength and drops the
 * rest."* Returning the set rather than a per-row boolean means the two
 * ledgers cannot disagree about what is lit, which they would the moment
 * each decided for itself.
 *
 * Selecting nothing lights everything — the resting state is not "all
 * dimmed", it is "no question asked yet".
 */
export function linkedTo(
  selected: string | null,
  sales: readonly SalesInvoice[],
  purchases: readonly PurchaseInvoice[],
): ReadonlySet<string> {
  const all = new Set([...sales.map((s) => s.doc), ...purchases.map((p) => p.doc)]);
  if (selected === null || !all.has(selected)) return all;

  const lit = new Set<string>([selected]);
  const isSale = sales.some((s) => s.doc === selected);

  if (isSale) {
    for (const p of purchases) if (p.forSale === selected) lit.add(p.doc);
    return lit;
  }

  // A purchase lights the sale it was raised for, and that sale's other
  // purchases — the whole piece of money, not just the pair.
  const sale = purchases.find((p) => p.doc === selected)?.forSale ?? null;
  if (sale === null) return lit;
  lit.add(sale);
  for (const p of purchases) if (p.forSale === sale) lit.add(p.doc);
  return lit;
}
