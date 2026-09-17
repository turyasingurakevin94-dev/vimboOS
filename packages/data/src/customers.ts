/**
 * Reading the Customers register from the real books.
 *
 * ## Two tables, and one of them is the cross-check
 *
 * `customers` is thin — name, phone, location, a `debt` figure, and the
 * `terms_days`/`credit_limit` that migration 0096 added. Everything the
 * screen actually draws about how an account behaves comes from that
 * account's invoices, which live in `saved_quotes`.
 *
 * `customers.debt` is the exception, and it is not a display value. It is
 * the old app's running balance, maintained by hand on every save, and the
 * whole point of `ledgerAgrees` is to hold it up against what the invoices
 * add to. So it is read as `ledgerBalance` and compared, never shown as the
 * answer. A shop whose two numbers disagree needs to be told, not to be
 * shown whichever one the code happened to reach for.
 *
 * ## A year, not thirty days
 *
 * The register answers "how does this account behave", and behaviour is not
 * visible in a month: `monthly` draws five, and `keptTwelveMonths` says
 * twelve in its name. So this reads its own window and does not share the
 * Invoices register's.
 *
 * ## What the schema cannot answer, and is not invented
 *
 * `heldBy` ("Wasswa's account") and `retentionHeld` have no column and no
 * payload key in the old app. They read as absent rather than as false-ish
 * defaults that would quietly become claims. `chasesSent`/`chasesAnswered`
 * are counted from WhatsApp traffic where a conversation can be matched to
 * the account by number, and `chasesUnknown` says so when it cannot — a
 * zero here would read as "nobody has chased them", which is a different
 * and much more actionable statement than "the app cannot see".
 */

import {
  Money,
  type Customer,
  type CustomerInvoice,
  type Derived,
  type MonthBought,
  type ProductShare,
  type SalesInvoice,
  known,
  receivedSoFar,
  unavailable,
} from '@ow/domain';
import { current } from './client.js';
import { readMoney, readText } from './boundary.js';
import { toSalesInvoice, type CustomerTerms, type SavedQuoteRow } from './savedQuotes.js';

/** How far back the register looks. `keptTwelveMonths` is in the name. */
export const MONTHS_BACK = 12;

/** The five bars the panel draws, oldest first. */
export const MONTHS_DRAWN = 5;

export interface Register {
  readonly customers: readonly Customer[];
  /**
   * What was read but not understood, in words, against the row it came
   * from. The screen shows the count; dropping a row would take its debt
   * off the total without saying so.
   */
  readonly unreadable: readonly string[];
  /**
   * Accounts whose chase count could not be established, by id.
   *
   * Not folded into `unreadable`: a row with no readable lines is damaged,
   * and an account nobody has a WhatsApp thread for is ordinary.
   */
  readonly chasesUnknown: ReadonlySet<string>;
}

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A Ugandan number, reduced to the nine digits that identify the line.
 *
 * The same phone is written `0772481330` in `customers`, `256772481330` as
 * a WhatsApp id, and `+256 772 481330` by whoever typed it into a note.
 * Matching on the raw strings finds none of them, which would show every
 * account as never chased — the failure that looks exactly like data.
 */
export function lineDigits(phone: string | null): string | null {
  if (phone === null) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * The register, for one shop, over one year.
 */
export async function readRegister(shopId: string, now: Date): Promise<Derived<Register>> {
  const { sb } = current();
  const since = new Date(now);
  since.setMonth(since.getMonth() - MONTHS_BACK);

  const [customersRes, salesRes, convosRes] = await Promise.all([
    sb
      .from('customers')
      .select('id, name, phone, location, notes, debt, terms_days, credit_limit')
      .eq('shop_id', shopId),
    sb
      .from('saved_quotes')
      .select(
        'id, client_name, client_phone, date, status, invoiced, invoiced_at, amount_paid, voided, payload',
      )
      .eq('shop_id', shopId)
      .eq('invoiced', true)
      .gte('date', isoDay(since))
      .order('date', { ascending: true }),
    // Chases. A left-behind table or an RLS refusal here is not fatal: the
    // register is about money, and `chasesUnknown` carries the difference.
    sb
      .from('wa_conversations')
      .select('id, wa_id, last_inbound_at, wa_messages(direction, sent_at)')
      .eq('shop_id', shopId),
  ]);

  // Without `customers` there is no register — every row on the screen IS a
  // customer, and inventing them from invoice names would silently merge
  // "Ken Bwaise" with "ken bwaise" and lose every account that has not
  // bought this year.
  if (customersRes.error !== null) {
    return unavailable(`customers: ${customersRes.error.message}`);
  }
  if (salesRes.error !== null) {
    return unavailable(`sales invoices: ${salesRes.error.message}`);
  }

  // No `?? []` on the first two: the checks above narrow them, and a
  // fallback there would be code that can never run pretending it can.
  const register = assembleRegister({
    customers: customersRes.data,
    sales: salesRes.data,
    conversations: convosRes.error === null ? convosRes.data : null,
    now,
  });

  return known(
    register,
    `${register.customers.length} accounts over ${MONTHS_BACK} months to ${isoDay(now)}`,
  );
}

/**
 * Rows in, register out — with no client anywhere near it.
 *
 * `conversations` is `null` when that table could not be read at all, which
 * is different from an empty list: the first means no account's chases are
 * known, the second means none have been chased.
 */
export function assembleRegister(rows: {
  readonly customers: readonly unknown[];
  readonly sales: readonly unknown[];
  readonly conversations: readonly unknown[] | null;
  readonly now: Date;
}): Register {
  const unreadable: string[] = [];

  /** Invoices by the customer NAME they were raised against. */
  const byName = new Map<string, SalesInvoice[]>();
  /** The raw payload beside each invoice, because margin needs the buy price. */
  const keptByName = new Map<string, { kept: number; sold: number }>();
  const sharesByName = new Map<string, Map<string, { spend: number; kept: number }>>();

  for (const raw of rows.sales) {
    const row = raw as SavedQuoteRow;
    const name = readText(row.client_name);
    if (name === null) continue;

    // Terms are applied per customer below; here the invoice only needs its
    // figures, so it is read with none and the due date filled in after.
    const noTerms: CustomerTerms = { termsDays: null };
    const { invoice, unreadable: bad } = toSalesInvoice(row, noTerms);
    if (invoice.voided !== undefined) continue;

    const list = byName.get(name) ?? [];
    list.push(invoice);
    byName.set(name, list);
    unreadable.push(...bad.map((b) => `${invoice.doc}: ${b}`));

    // The shop's side. `price` is what the SHOP paid and `sellPrice` what the
    // client pays — the pair that makes a margin, and the pair it is fatal to
    // confuse. `readLines` deliberately refuses to look at `price`, so this
    // reads the payload again rather than widening that contract.
    const keeping = keptByName.get(name) ?? { kept: 0, sold: 0 };
    const shares = sharesByName.get(name) ?? new Map<string, { spend: number; kept: number }>();
    for (const rawItem of arr(obj(row.payload)?.items)) {
      const item = obj(rawItem);
      if (item === null) continue;
      const qty = typeof item.qty === 'number' ? item.qty : null;
      const sell = readMoney(item.sellPrice, 'sellPrice', invoice.doc);
      const cost = readMoney(item.price, 'price', invoice.doc);
      if (qty === null || sell.status === 'unavailable') continue;

      const sold = sell.value * qty;
      keeping.sold += sold;
      // A line whose buying price was never recorded contributes to what was
      // SOLD and not to what was KEPT. Treating a missing cost as zero would
      // report the shop's best-ever margin on its worst-documented line.
      const kept = cost.status === 'unavailable' ? 0 : (sell.value - cost.value) * qty;
      keeping.kept += kept;

      const product = readText(item.productName);
      if (product !== null) {
        const prior = shares.get(product) ?? { spend: 0, kept: 0 };
        shares.set(product, { spend: prior.spend + sold, kept: prior.kept + kept });
      }
    }
    keptByName.set(name, keeping);
    sharesByName.set(name, shares);
  }

  const chases = countChases(rows.conversations);
  if (chases === null) {
    // Said once, against the register, because it is true of every account.
    // The per-account pill is only drawn when a count is above zero, so
    // without this line an unreadable table and a shop that has never
    // chased anybody look identical on screen.
    unreadable.push('WhatsApp threads could not be read, so no account can be shown as chased');
  }

  const customers: Customer[] = [];
  const chasesUnknown = new Set<string>();

  for (const raw of rows.customers) {
    const row = obj(raw);
    if (row === null) continue;
    const id = readText(row.id);
    const name = readText(row.name);
    if (id === null || name === null) continue;

    const phone = readText(row.phone) ?? '';
    const termsDays = typeof row.terms_days === 'number' ? row.terms_days : null;
    const mine = byName.get(name) ?? [];
    const invoices = mine.map((inv) => toCustomerInvoice(inv, termsDays));

    const ledger = readMoney(row.debt, 'debt', `customers.${id}`);
    if (ledger.status === 'unavailable') {
      unreadable.push(`${name}: ${ledger.reason}, so the ledger cannot be cross-checked`);
    }

    const limit = readMoney(row.credit_limit, 'credit_limit', `customers.${id}`);
    const keeping = keptByName.get(name);
    const key = lineDigits(phone);
    const chased = key === null ? undefined : chases?.get(key);
    if (chases === null || chased === undefined) chasesUnknown.add(id);

    customers.push({
      id,
      name,
      since: earliest(invoices) ?? rows.now,
      // No column and no payload key holds "whose name the shop knows this
      // account by". Absent, rather than guessed at from the name.
      heldBy: null,
      phone,
      area: readText(row.location) ?? '',
      creditLimit: limit.status === 'unavailable' ? null : limit.value,
      invoices,
      chasesSent: chased?.sent ?? 0,
      chasesAnswered: chased?.answered ?? 0,
      ledgerBalance: ledger.status === 'unavailable' ? Money.ZERO : ledger.value,
      // Retention is a contract term the old app never recorded.
      retentionHeld: false,
      keptTwelveMonths: keeping === undefined ? null : Money.money(Math.round(keeping.kept)),
      soldTwelveMonths: keeping === undefined ? null : Money.money(Math.round(keeping.sold)),
      buys: toShares(sharesByName.get(name)),
      monthly: toMonthly(invoices, rows.now),
    });
  }

  return { customers, unreadable, chasesUnknown };
}

/* -------------------------------------------------------------------------- */

function toCustomerInvoice(inv: SalesInvoice, termsDays: number | null): CustomerInvoice {
  const received = receivedSoFar(inv);
  const paidOn = inv.payments.map((p) => p.on).sort((a, b) => a.getTime() - b.getTime());
  const last = paidOn[paidOn.length - 1] ?? null;
  const settled = !Money.isZero(inv.total) && Money.compare(received, inv.total) >= 0;

  const dueOn =
    termsDays === null ? null : new Date(inv.issued.getTime() + termsDays * 86_400_000);

  return {
    doc: inv.doc,
    issued: inv.issued,
    total: inv.total,
    dueOn,
    received,
    lastPaidOn: last,
    // The date the LAST shilling arrived. Null while anything is still out,
    // which is why this is not simply "the newest payment".
    settledOn: settled ? last : null,
    instalments: inv.payments.length,
  };
}

const earliest = (invoices: readonly CustomerInvoice[]): Date | null =>
  invoices.reduce<Date | null>(
    (best, inv) => (best === null || inv.issued < best ? inv.issued : best),
    null,
  );

function toShares(spend: Map<string, { spend: number; kept: number }> | undefined): ProductShare[] {
  if (spend === undefined) return [];
  const total = [...spend.values()].reduce((sum, x) => sum + x.spend, 0);
  if (total <= 0) return [];

  return [...spend.entries()]
    .map(([product, x]) => ({
      product,
      // "Cement — Tororo" names a line; "cement" is what a sentence says.
      shortName: shortNameOf(product),
      shareOfSpend: Math.round((x.spend / total) * 100),
      margin: x.spend <= 0 ? 0 : Math.round((x.kept / x.spend) * 100),
    }))
    .sort((a, b) => b.shareOfSpend - a.shareOfSpend);
}

/** The first word of a product name, lowercased: "Cement — Tororo" → "cement". */
export const shortNameOf = (product: string): string =>
  (product.split(/[—–\-,(]/)[0] ?? product).trim().split(/\s+/)[0]?.toLowerCase() ?? product;

function toMonthly(invoices: readonly CustomerInvoice[], now: Date): MonthBought[] {
  const spent = new Map<string, number>();
  for (const inv of invoices) {
    const key = `${inv.issued.getFullYear()}-${inv.issued.getMonth()}`;
    spent.set(key, (spent.get(key) ?? 0) + inv.total);
  }

  // Every one of the last five months, including the ones with no order.
  // Skipping an empty month would draw four bars and a gap, and the gap
  // would read as "we have no record" rather than "they bought nothing".
  const out: MonthBought[] = [];
  for (let back = MONTHS_DRAWN - 1; back >= 0; back--) {
    const when = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = `${when.getFullYear()}-${when.getMonth()}`;
    out.push({
      month: MONTHS[when.getMonth()] ?? '',
      spent: Money.money(Math.round(spent.get(key) ?? 0)),
    });
  }
  return out;
}

/**
 * Chases, by the nine digits that identify a line.
 *
 * `null` when the table could not be read at all — every account's count is
 * then unknown, which the register says rather than showing zero.
 */
function countChases(
  conversations: readonly unknown[] | null,
): Map<string, { sent: number; answered: number }> | null {
  if (conversations === null) return null;

  const out = new Map<string, { sent: number; answered: number }>();
  for (const raw of conversations) {
    const convo = obj(raw);
    if (convo === null) continue;
    const key = lineDigits(readText(convo.wa_id));
    if (key === null) continue;

    let sent = 0;
    let answered = 0;
    for (const rawMsg of arr(convo.wa_messages)) {
      const msg = obj(rawMsg);
      if (msg === null) continue;
      if (msg.direction === 'out') sent += 1;
      // Answered counts the REPLIES, not the inbound messages: a customer
      // who writes first and is never written to has not answered anything.
      if (msg.direction === 'in' && sent > 0) answered += 1;
    }

    const prior = out.get(key) ?? { sent: 0, answered: 0 };
    out.set(key, { sent: prior.sent + sent, answered: prior.answered + answered });
  }
  return out;
}
