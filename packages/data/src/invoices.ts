/**
 * Reading the Invoices register from the real books.
 *
 * Three tables, one shop, one round trip each — not the old app's "load the
 * entire database into memory and diff it on every save". A screen asks for
 * what it needs and gets that.
 *
 * ## Why customers come too
 *
 * `saved_quotes` has no due date. Terms live in `customers.terms_days`, so
 * whether an invoice is late is a fact about the CUSTOMER, and an invoice
 * read without one has no derivable lateness at all. Fetching the two
 * separately and joining here is deliberate: PostgREST could embed them, but
 * the embed is a left join that silently yields `null` for a customer the
 * reader cannot see through RLS, which is indistinguishable from a customer
 * with no terms. Two queries make the difference visible.
 *
 * ## What a failure looks like
 *
 * Never an empty list. An RLS refusal, a dropped connection and a shop with
 * no invoices all produce `[]` from PostgREST, and only one of those means
 * "nothing is owed". Every read here returns `Derived`, so a screen has to
 * handle the difference before it can draw a figure.
 */

import {
  known,
  unavailable,
  type Derived,
  type PurchaseInvoice,
  type SalesInvoice,
} from '@ow/domain';
import { current } from './client.js';
import { readText } from './boundary.js';
import {
  toPurchaseInvoice,
  toSalesInvoice,
  type CustomerTerms,
  type PurchaseInvoiceRow,
  type SavedQuoteRow,
} from './savedQuotes.js';

export interface Ledgers {
  readonly sales: readonly SalesInvoice[];
  readonly purchases: readonly PurchaseInvoice[];
  /**
   * Rows that were read but could not be fully understood, in words.
   *
   * Not a log — a screen shows this. An invoice whose lines will not parse
   * still appears in the ledger with what IS known, and the count of what
   * could not be read is the honest footnote under a total.
   */
  readonly unreadable: readonly string[];
}

/**
 * How far back the register's RANGE cells look. The page header says
 * "Last 30 days", and that is the only thing it governs.
 *
 * It used to be the query's floor, so it governed everything — including
 * what is owed, which is not a flow. See {@link readLedgers}.
 */
export const RANGE_DAYS = 30;

/**
 * The register, for one shop — all of it, with no date floor.
 *
 * **A debt is a position, not a flow.** This query floored both tables at
 * thirty days, so every figure on the screen was scoped to a month —
 * including what is owed, which is the one figure on it that must not be.
 * On the shop's own books that hid **1,090,000 across two invoices**, and
 * they were the two OLDEST: the band read `owed to us 5,324,000 · oldest 25
 * days` where the truth is 6,414,000 and forty-two days, and Customers
 * reading the same debt unwindowed said 6,414,000 beside it. Two screens,
 * one shop, two answers.
 *
 * Worse than the gap is the `oldest 25 days`: money older than the window
 * cannot be the oldest thing in it, so the figure most worth chasing is
 * exactly the one the window removes. `agents.ts` had already written the
 * rule down — *"looking at last month does not make this month's unpaid
 * goods stop being unpaid"* — and this screen was breaking it.
 *
 * `readBand` scopes its own RANGE cells. There is no floor here because
 * there is no question here that has one.
 *
 * `shopId` is passed rather than inferred. RLS would scope the query anyway,
 * but a query that relies on the policy to pick the shop is a query that
 * returns a different answer when someone belongs to two — and the schema
 * allows that.
 */
export async function readLedgers(shopId: string): Promise<Derived<Ledgers>> {
  const { sb } = current();

  const [salesRes, purchasesRes, customersRes] = await Promise.all([
    sb
      .from('saved_quotes')
      .select('id, client_name, client_phone, date, status, invoiced, invoiced_at, amount_paid, voided, payload')
      .eq('shop_id', shopId)
      .eq('invoiced', true)
      .order('date', { ascending: false }),
    sb
      .from('purchase_invoices')
      .select('id, quote_id, date, payload')
      .eq('shop_id', shopId)
      .order('date', { ascending: false }),
    sb.from('customers').select('id, name, terms_days').eq('shop_id', shopId),
  ]);

  // A refusal is not an absence. Say which failed rather than drawing a shop
  // that has never traded.
  //
  // Only two of the three are fatal. Without sales or purchases there is no
  // ledger to draw and a figure would be invented. Without CUSTOMERS there
  // is a ledger — every invoice, every balance — and the one thing missing
  // is the terms that make lateness derivable, which the register already
  // knows how to say it does not have. Sinking the whole screen over it
  // would turn "I cannot tell you which of these are late" into "I cannot
  // tell you anything", and the second is a far worse answer to a shop
  // asking who owes it money.
  //
  // This is not hypothetical: `terms_days` arrived in migration 0096, so a
  // database that has not run it answers this query with an error, and RLS
  // on `customers` can refuse independently of `saved_quotes`.
  const fatal = [
    salesRes.error === null ? null : `sales invoices: ${salesRes.error.message}`,
    purchasesRes.error === null ? null : `purchase invoices: ${purchasesRes.error.message}`,
  ].filter((x): x is string => x !== null);

  if (fatal.length > 0) return unavailable(fatal.join('; '));

  const ledgers = assemble({
    sales: salesRes.data ?? [],
    purchases: purchasesRes.data ?? [],
    customers: customersRes.data ?? [],
    // Named against the ledger rather than logged, so the count under the
    // totals says it and nobody has to wonder why every row reads "No terms".
    termsUnreadable:
      customersRes.error === null
        ? null
        : `customer terms could not be read (${customersRes.error.message}), so no invoice here can be called late`,
  });

  return known(
    ledgers,
    `${ledgers.sales.length} sales and ${ledgers.purchases.length} purchase invoices, all of them`,
  );
}

/**
 * Rows in, ledgers out — with no client anywhere near it.
 *
 * The join, the terms lookup and the accumulation of what would not parse
 * are where this file can actually be wrong; three `.select()` calls are
 * not. Separating them is what lets the wrongable part be tested against
 * rows shaped like the shop's real ones, on a machine with no network.
 */
export function assemble(rows: {
  /** Why terms are missing for every row, when they are. */
  readonly termsUnreadable?: string | null;
  /**
   * Everything arrives as `unknown`, not as whatever shape the client's
   * generics guessed. PostgREST returns what the database HAS, which on a
   * shop trading since 2022 is not always what the current code writes —
   * that is the whole reason `readText` exists.
   */
  readonly sales: readonly unknown[];
  readonly purchases: readonly unknown[];
  readonly customers: readonly unknown[];
}): Ledgers {
  const terms = new Map<string, CustomerTerms>();
  for (const raw of rows.customers) {
    const row = raw as Record<string, unknown>;
    const name = readText(row.name);
    const days = typeof row.terms_days === 'number' ? row.terms_days : null;
    if (name !== null) terms.set(name, { termsDays: days });
  }

  const unreadable: string[] = [];
  if (rows.termsUnreadable != null) unreadable.push(rows.termsUnreadable);
  const sales: SalesInvoice[] = [];

  for (const raw of rows.sales) {
    const row = raw as SavedQuoteRow;
    const customer = readText(row.client_name);
    // Matched by name because that is the only link `saved_quotes` carries
    // to a customer row in every version of the payload. `customerId` exists
    // in newer rows and is the better key the day every row has one.
    const found = customer === null ? undefined : terms.get(customer);
    const { invoice, unreadable: bad } = toSalesInvoice(row, found ?? { termsDays: null });
    sales.push(invoice);
    unreadable.push(...bad.map((b) => `${invoice.doc}: ${b}`));
  }

  const purchases: PurchaseInvoice[] = [];
  for (const raw of rows.purchases) {
    const { purchase, unreadable: bad } = toPurchaseInvoice(raw as PurchaseInvoiceRow);
    purchases.push(purchase);
    unreadable.push(...bad.map((b) => `${purchase.doc}: ${b}`));
  }

  return { sales, purchases, unreadable };
}
