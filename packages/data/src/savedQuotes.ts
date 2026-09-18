/**
 * The `saved_quotes` contract — read off the old app's own code, not guessed.
 *
 * ## There is no invoices table
 *
 * A quote, an order and a sales invoice are the **same row**, told apart by
 * `status` and `invoiced`. Its lines and its payments live inside an untyped
 * `payload` jsonb that the schema itself calls "not normalized yet". So this
 * file is where an invoice comes from, and reading it is a parse, not a cast.
 *
 * ## THE PRESERVATION CONTRACT
 *
 * The old app's writer rebuilds `payload` from NAMED KEYS — a key it does
 * not name is stripped the moment anyone touches the order. Its own comments
 * record being bitten three times ("order 151's lesson, a third time").
 *
 * That is the single biggest hazard in running two apps on one database. It
 * is why `PAYLOAD_KEYS` below is an exhaustive list rather than prose, and
 * why a future write path must MERGE onto the row it read rather than
 * rebuild it. While this app is read-only the hazard is dormant; the list is
 * here so it is already written down when it stops being.
 *
 * ## What was wrong before this file existed
 *
 * `boundary.readPayload` was written from a plausible guess — `name`, `qty`,
 * `price` — and its tests pinned the guess. The real keys are `productName`
 * and `sellPrice`, and **`price` is the BUY price**. Against a real row it
 * would have labelled every line "line 1" and shown the shop's buying price
 * as what the customer pays.
 */

import {
  Money,
  known,
  unavailable,
  type Derived,
  type InvoiceLine,
  type MoneyAmount,
  type Payment,
  type PurchaseInvoice,
  type SalesInvoice,
} from '@ow/domain';
import { readDate, readMoney, readText } from './boundary.js';

/**
 * Every key the old app's writer names when it rebuilds `payload`
 * (`index.html`, the `savedQuotes` mapping in `rowsFromData`).
 *
 * A write from this app that does not carry all of these forward silently
 * deletes whatever it omits — including fields no screen here will ever
 * show, like `originWa` or `pickShortfallAckAt`. A test holds the list
 * against this comment so it cannot rot quietly.
 *
 * **Checked against the old app's source, 18 September 2026**, at
 * `turyasingurakevin94-dev/omni-ware@447c45f`: thirty keys, the same
 * thirty, in the same order. It was written from that mapping and it has
 * not drifted from it.
 */
export const PAYLOAD_KEYS = [
  'client',
  'items',
  'charges',
  'credit',
  'savedAt',
  'payments',
  'customerId',
  'debtCharged',
  'stageEnteredAt',
  'assignedWorkerId',
  'assignedDeliveryId',
  'pickingStatus',
  'pickCursor',
  'pickingAssignedAt',
  'workerAcceptedAt',
  'pickShortfallAckAt',
  'supplierConfirms',
  'stageLog',
  'announcedAt',
  'cancelledAt',
  'carrier',
  'pickingDoneAt',
  'originAgentId',
  'agentClientId',
  'deliveryMode',
  'deliveryAddress',
  'agentPaymentStatus',
  'originPortal',
  'originWa',
  'originWamid',
] as const;

/** A `saved_quotes` row as PostgREST hands it over. */
export interface SavedQuoteRow {
  readonly id: number;
  readonly client_name: unknown;
  readonly client_phone: unknown;
  readonly date: unknown;
  readonly status: unknown;
  readonly invoiced: unknown;
  readonly invoiced_at: unknown;
  readonly amount_paid: unknown;
  readonly voided: unknown;
  readonly payload: unknown;
}

/** A `purchase_invoices` row. Its `quote_id` IS the sale-to-purchase link. */
export interface PurchaseInvoiceRow {
  readonly id: number;
  readonly quote_id: unknown;
  readonly date: unknown;
  readonly payload: unknown;
}

/** What `customers` contributes: the terms that make lateness derivable. */
export interface CustomerTerms {
  readonly termsDays: number | null;
}

/** `INV-0175` — `'INV-' + String(id).padStart(4, '0')`, the old app's own. */
export const invoiceDoc = (id: number): string => `INV-${String(id).padStart(4, '0')}`;
export const purchaseDoc = (id: number): string => `PINV-${String(id).padStart(4, '0')}`;

const obj = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const arr = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/**
 * An identifier out of the payload, whether it was written as a number or a
 * string.
 *
 * The old app writes `lineId: data.nextQuoteLineId++` and
 * `id: nextPaymentId(q)` — both NUMBERS. `readText` is right to reject a
 * number where prose is expected, and wrong here: dropping a payment's id
 * and falling back to its position means the delete confirm names one
 * payment and removes another the moment an earlier one is reversed. That is
 * precisely what the old app added `id` to prevent.
 */
const readId = (value: unknown): string | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : readText(value);

/** What could not be read, in words. Never dropped, never rounded to zero. */
export interface Unread {
  readonly unreadable: readonly string[];
}

/* -------------------------------------------------------------------------- */
/*  Lines                                                                     */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- *
 * Charges: one reader, because three of them were wrong the same way
 * -------------------------------------------------------------------------- */

/**
 * A charge out of a payload, as the books actually hold one.
 *
 * `{id, label, type, value, service, cost}` — **`value` and not `amount`**.
 * This app had three separate readers for it (the invoice register, the
 * order board's worth, an agent's order value) and all three looked for
 * `amount`, which the old app has never written. Every one of them silently
 * dropped every charge: on the shop's own books, seven invoices carrying a
 * 5,000 Transport were 5,000 light, and the shortfall ran straight into what
 * is owed and into every customer's balance.
 *
 * A percent is resolved against the GOODS and nothing else, so two percents
 * on one order come to the same total whichever was added first.
 */
export function chargeOf(
  raw: unknown,
  goods: number,
  at: number,
): { readonly name: string; readonly id: string; readonly amount: number; readonly basis: string } | null {
  const row = obj(raw);
  if (row === null) return null;

  // `label` is the frozen one the shop agreed to; `name` is what older rows
  // and other doors wrote.
  const name = readText(row.label) ?? readText(row.name) ?? `charge ${at + 1}`;
  const value = Number(row.value);
  if (!Number.isFinite(value)) return null;

  const percent = readText(row.type) === 'percent';
  return {
    id: readId(row.id) ?? `charge-${at + 1}`,
    name,
    // A charge is money the shop is owed, and a discount is not one.
    amount: value <= 0 ? 0 : percent ? Math.round((goods * value) / 100) : Math.round(value),
    basis: percent ? `${value}% of the goods` : 'charge',
  };
}

/** What every charge on a payload comes to, against the goods on it. */
export function chargesTotal(payload: unknown, goods: number): number {
  let total = 0;
  arr(obj(payload)?.charges).forEach((raw, at) => {
    total += chargeOf(raw, goods, at)?.amount ?? 0;
  });
  return total;
}

/**
 * The lines of a sale: its `items[]` and then its `charges[]`.
 *
 * An item is `{lineId, productId, variantIdx, productName, unit, packUnit,
 * packQty, qtyIn, qty, supplierId, supplierName, price, sellPrice}` — where
 * **`price` is what the shop paid and `sellPrice` is what the client pays**.
 * Confusing the two would understate every invoice by its own margin.
 */
export function readLines(payload: unknown, basis: string): Unread & {
  readonly lines: readonly InvoiceLine[];
} {
  const p = obj(payload);
  const lines: InvoiceLine[] = [];
  const unreadable: string[] = [];

  arr(p?.items).forEach((raw, i) => {
    const row = obj(raw);
    if (row === null) {
      unreadable.push(`item ${i + 1} is not readable`);
      return;
    }
    const name = readText(row.productName) ?? readText(row.name) ?? `item ${i + 1}`;
    const qty = Number(row.qty);
    if (!Number.isFinite(qty)) {
      unreadable.push(`${name} has no quantity`);
      return;
    }
    // `sellPrice` first, and `price` is NOT a fallback for it — falling back
    // would quietly bill the customer the shop's cost.
    const price = readMoney(row.sellPrice, `${name} sell price`, basis);
    if (price.status === 'unavailable') {
      unreadable.push(`${name} has no price the customer was charged`);
      return;
    }
    lines.push({
      kind: 'item',
      id: readId(row.lineId) ?? `item-${i + 1}`,
      name,
      qty,
      priceEach: price.value,
    });
  });

  // The goods, from the item lines just read — which is what a percent
  // charge is a percent of, and why charges are read after items.
  const goods = lines.reduce((n, l) => n + (l.kind === 'item' ? l.qty * l.priceEach : 0), 0);

  arr(p?.charges).forEach((raw, i) => {
    const charge = chargeOf(raw, goods, i);
    if (charge === null) {
      unreadable.push(`charge ${i + 1} on ${basis} has no figure`);
      return;
    }
    lines.push({
      kind: 'charge',
      id: charge.id,
      name: charge.name,
      basis: charge.basis,
      amount: Money.money(charge.amount),
    });
  });

  return { lines, unreadable };
}

/* -------------------------------------------------------------------------- */
/*  Payments                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The payments on a sale.
 *
 * The current shape is `{date, amount, note, cashTxnId, method, id}`. Rows
 * written by older versions carry only the first four — the old app's own
 * comment says `method` and `id` were added because "a receipt that says how
 * the money arrived settles an argument months later". Both shapes are read;
 * a payment with no `id` gets one from its index, which is stable for as
 * long as the list is, and that is what the delete confirm needs.
 */
export function readPayments(payload: unknown, basis: string): Unread & {
  readonly payments: readonly Payment[];
} {
  const p = obj(payload);
  const payments: Payment[] = [];
  const unreadable: string[] = [];

  arr(p?.payments).forEach((raw, i) => {
    const row = obj(raw);
    if (row === null) {
      unreadable.push(`payment ${i + 1} is not readable`);
      return;
    }
    const amount = readMoney(row.amount, `payment ${i + 1}`, basis);
    const on = readDate(row.date);
    if (amount.status === 'unavailable') {
      unreadable.push(`payment ${i + 1} has no readable amount`);
      return;
    }
    if (on === null) {
      unreadable.push(`payment ${i + 1} has no date`);
      return;
    }
    const method = readText(row.method) ?? 'Cash';
    payments.push({
      id: readId(row.id) ?? `p${i + 1}`,
      on,
      amount: amount.value,
      // `method` holds the ACCOUNT the money went into ("Cash · shop till"),
      // which is what the dialog's *Received into* asks for; the method is
      // its first part.
      method: method.split(' · ')[0] ?? method,
      account: method,
      takenBy: readText(row.takenBy) ?? 'the shop',
    });
  });

  return { payments, unreadable };
}

/* -------------------------------------------------------------------------- */
/*  Rows into the domain                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A `saved_quotes` row as a sales invoice.
 *
 * **`dueOn` comes from the CUSTOMER, not the row.** There is no due date on
 * `saved_quotes`; terms live in `customers.terms_days`, and a customer with
 * none has no derivable lateness. That is not a gap to paper over — it is
 * exactly the `unavailable` state the ledger already draws as "No terms",
 * and it will be the real answer for every customer who has never been given
 * any.
 *
 * `total` is the sum of the lines rather than a stored column, because there
 * is no stored column: the old app computes `savedQuoteTotal(q)` the same
 * way. `amount_paid` IS stored, and the payments should add up to it — when
 * they do not, that is said rather than silently preferred one way.
 */
export function toSalesInvoice(
  row: SavedQuoteRow,
  customer: CustomerTerms,
  basis = `saved_quotes #${row.id}`,
): Unread & { readonly invoice: SalesInvoice } {
  const { lines, unreadable: badLines } = readLines(row.payload, basis);
  const { payments, unreadable: badPayments } = readPayments(row.payload, basis);
  const unreadable = [...badLines, ...badPayments];

  const issued = readDate(row.date);
  const total = Money.add(...lines.map((l) => (l.kind === 'charge' ? l.amount : Money.times(l.priceEach, l.qty))));

  const stored = readMoney(row.amount_paid, 'amount paid', basis);
  const counted = Money.add(...payments.map((p) => p.amount));
  if (stored.status !== 'unavailable' && stored.value !== counted) {
    unreadable.push(
      `amount_paid says ${Money.format(stored.value)} but the payments come to ${Money.format(counted)}`,
    );
  }

  const when = issued ?? new Date(0);
  return {
    invoice: {
      kind: 'sale',
      doc: invoiceDoc(row.id),
      customer: readText(row.client_name) ?? 'no name recorded',
      total,
      lines,
      issued: when,
      dueOn:
        customer.termsDays === null || issued === null
          ? null
          : new Date(issued.getTime() + customer.termsDays * 86_400_000),
      payments,
      ...(row.voided === true
        ? { voided: { replacedBy: null, on: readDate(row.invoiced_at) ?? when } }
        : {}),
    },
    unreadable: issued === null ? [...unreadable, 'the invoice has no date'] : unreadable,
  };
}

/**
 * A `purchase_invoices` row as a purchase.
 *
 * `quote_id` is the link the whole facing-ledger design rests on: it is what
 * makes "the purchases raised to fill this sale" a fact rather than a guess.
 */
export function toPurchaseInvoice(
  row: PurchaseInvoiceRow,
  basis = `purchase_invoices #${row.id}`,
): Unread & { readonly purchase: PurchaseInvoice } {
  const p = obj(row.payload);
  const unreadable: string[] = [];

  const lines = arr(p?.items);
  const total = lines.reduce<MoneyAmount>((sum, raw) => {
    const item = obj(raw);
    if (item === null) return sum;
    const qty = Number(item.qty);
    const price = readMoney(item.price, 'buying price', basis);
    if (!Number.isFinite(qty) || price.status === 'unavailable') {
      unreadable.push(`a line of ${purchaseDoc(row.id)} has no readable cost`);
      return sum;
    }
    return Money.add(sum, Money.times(price.value, qty));
  }, Money.ZERO);

  const paid = readMoney(p?.amountPaid, 'amount paid', basis);
  const quoteId = typeof row.quote_id === 'number' ? row.quote_id : null;

  return {
    purchase: {
      kind: 'purchase',
      doc: purchaseDoc(row.id),
      supplier: readText(p?.supplierName) ?? 'no supplier recorded',
      total,
      paid: paid.status === 'unavailable' ? Money.ZERO : paid.value,
      dueOn: readDate(p?.dueDate),
      forSale: quoteId === null ? null : invoiceDoc(quoteId),
      ...(p?.voided === true ? { voided: { replacedBy: null, on: new Date(0) } } : {}),
    },
    unreadable: paid.status === 'unavailable' ? [...unreadable, 'the amount paid is not readable'] : unreadable,
  };
}

/**
 * What a payment costs beyond the invoice — kept here because the write path
 * will need it and the reading of it belongs with the rest of the contract.
 *
 * Receiving money in the old app does FOUR things, not one: it writes a
 * `cash_txns` row, pushes onto `payload.payments`, adds to `amount_paid`,
 * and re-syncs the customer's debt. A write path here that does only the
 * second would leave the till, the invoice and the debtors list disagreeing.
 */
export const RECEIVING_ALSO_WRITES = [
  'cash_txns — the till row addCashReceipt() creates, whose id the payment keeps',
  'saved_quotes.amount_paid — the stored total the payments must agree with',
  "the customer's debt — syncInvoiceDebtCharge() applies only the difference",
] as const;

/** A derivation that could not be made, in the shape screens already read. */
export const asDerived = <T>(value: T, unread: readonly string[], basis: string): Derived<T> =>
  unread.length === 0 ? known(value, basis) : unavailable(unread.join('; '));

/* -------------------------------------------------------------------------- *
 * Writing one: the contract, read off the old app rather than guessed
 * -------------------------------------------------------------------------- */

/**
 * The counter a new order's id comes from, and it is a **dense** one.
 *
 * `ROW_ID_KINDS.savedQuote` in the old app carries `dense: true`, and its
 * comment says why: a `saved_quotes.id` IS the `INV-` number the shop
 * quotes to a customer, so an id reserved in a block of ten and then not
 * used shows up on paper as a skipped invoice number. One id, fetched at
 * the moment of creation, `p_count: 1` — never a block. The old app throws
 * rather than let a dense kind reach its block allocator at all.
 *
 * `next_row_id_blocks` sets `last_issued = greatest(last_issued, floor) + n`
 * and hands back `last_issued - n + 1`, so passing a floor of the highest
 * id we can see keeps the counter ahead of the table even where the two
 * have drifted apart.
 */
export const QUOTE_ID_KIND = 'row:saved_quote';

/**
 * Why a new order may be written from here and an existing one may not.
 *
 * An INSERT has no prior payload, so there is nothing to preserve and the
 * preservation contract above cannot be broken by one. An UPDATE is a
 * different act entirely: the old app rebuilds the whole payload from the
 * thirty named keys, and a partial write from this side would strip
 * whatever it did not know to put back — which is `order 151's lesson, a
 * third time`, in that file's own words.
 *
 * So: this app may raise an order. It may not edit one, and it may not
 * move one, until a merge that reads the row first is argued for on its
 * own terms.
 */
export const WRITE_IS_INSERT_ONLY = true;

/**
 * A charge, in the exact shape the old app writes one.
 *
 * It carries the RULE — `type` and `value` — and not the shillings, because
 * a percent frozen at the moment it was tapped goes stale on the next line
 * added. `chargeAmount` in the old app reads `Number(ch.value) || 0`, so a
 * charge written as `{name, amount}` comes to **nothing** on its invoice —
 * quietly, and only on the customer's copy.
 *
 * `label` is the frozen one and `service` says which of the shop's services
 * it came from. `cost` is what the charge cost the SHOP, which is a payment
 * and not a figure somebody typed: null until one is recorded, and
 * `costTxnId` is the cash entry when it is. This app records neither, so
 * both stay absent rather than being asserted as zero.
 */
export interface ChargeWrite {
  readonly id: number;
  readonly label: string;
  readonly type: 'fixed' | 'percent';
  readonly value: number;
  readonly service: string | null;
  readonly cost: null;
}

/** A quote line, in the exact shape the old app's own item picker pushes. */
export interface QuoteLineWrite {
  readonly lineId: number;
  readonly productId: string | null;
  readonly variantIdx: number | null;
  readonly productName: string;
  readonly unit: string;
  readonly packUnit: string;
  readonly packQty: number | string;
  /** How it was counted when it was chosen: `unit` or `pack`. */
  readonly qtyIn: 'unit' | 'pack';
  readonly qty: number;
  /** `__stock__` is the old app's own sentinel for "off the shelf". */
  readonly supplierId: string;
  readonly supplierName: string;
  /** The BUY price. Never what the customer pays. */
  readonly price: number;
  readonly sellPrice: number;
}

/**
 * `lineId` is per-order, and starts at 1.
 *
 * The old app increments a `data.nextQuoteLineId` that looks global, and
 * `loadSavedQuote` renumbers every line from it on the way in — but the id
 * only identifies a row while it is being edited, and nothing outside that
 * screen looks a line up by it. Checked against all 290 lines on this
 * shop: they run 1 to 9, and the same id is on 138 different orders. A new
 * order numbers its own lines.
 */
export const lineIds = (count: number): readonly number[] =>
  Array.from({ length: count }, (_, i) => i + 1);

/**
 * The payload of an order nobody has worked yet.
 *
 * Every one of the thirty keys, at the value `buildQuoteRecord` gives a
 * brand-new record — which is what makes this safe to hand the old app. A
 * key left out here is not "left alone"; it is absent, and the old app's
 * reader spreads the payload back whole and would find nothing there.
 *
 * The five `origin*`/agent fields are `undefined` rather than null on a
 * normal order, exactly as the old app leaves them: it writes
 * `originAgentId: q.originAgentId` off a record that never had one, and
 * `JSON.stringify` drops the key. Writing an explicit null instead would
 * be this app asserting "this order came from nowhere", where absent says
 * "this order is not one of those".
 */
export function newQuotePayload(input: {
  readonly client: { readonly name: string; readonly phone: string };
  readonly items: readonly QuoteLineWrite[];
  readonly charges: readonly ChargeWrite[];
  readonly customerId: string | null;
  readonly now: Date;
}): Record<string, unknown> {
  return {
    client: { name: input.client.name, phone: input.client.phone },
    items: input.items,
    charges: input.charges,
    credit: null,
    savedAt: input.now.toISOString(),
    payments: [],
    customerId: input.customerId,
    debtCharged: 0,
    // When the order entered its lane. Only a stage move ever advances it,
    // and a new order enters Draft the moment it is raised.
    stageEnteredAt: input.now.getTime(),
    assignedWorkerId: null,
    assignedDeliveryId: null,
    pickingStatus: null,
    pickCursor: 0,
    pickingAssignedAt: null,
    workerAcceptedAt: null,
    pickShortfallAckAt: null,
    supplierConfirms: null,
    stageLog: null,
    announcedAt: null,
    cancelledAt: null,
    carrier: null,
    pickingDoneAt: null,
  };
}
