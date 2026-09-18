/**
 * Today, from the real books.
 *
 * ## This module reads; it does not reckon
 *
 * `packages/domain/src/today.ts` holds the strip's arithmetic, and its own
 * header says why: Today is the screen most likely to grow a second reading
 * of a figure another screen already owns. So the split here is strict. This
 * file turns rows into the inputs that reckoning names, and calls it. Where
 * a figure has an owner elsewhere, the owner's own reader is called —
 * `readRegister` for what is owed to the shop, `toPurchaseInvoice` for what
 * is owed out — rather than a second query shaped to this screen.
 *
 * ## Why the payables are not `readLedgers`
 *
 * The Invoices register is deliberately **"Last 30 days"** — that is in its
 * page header. What the shop owes is not a 30-day window; a supplier
 * invoice from March that has never been paid is still owed. So the
 * purchases are read here with no date floor, and the `stillToPay`
 * reckoning from the Invoices band is reused over the wider set. Today's
 * "you owe" can therefore be larger than the Invoices register's total, and
 * both are right about their own question.
 *
 * ## What this file will not pretend to know
 *
 * The value of dead stock comes back `unavailable`, on purpose. The shop's
 * own Inventory screen values it at FIFO unit cost with a
 * replacement-price fallback (`getFIFOUnitCost`, then `rankedPriceRows`),
 * which is a different reckoning from the shelf's weighted average and is
 * not ported yet. Valuing it here at the shelf's average would put a
 * confident figure on screen that disagrees with the one the owner already
 * reads, and picking zero would be the `total || 0` bug this app exists to
 * end. The COUNT of dead lines needs no cost at all, so that is derived and
 * given.
 */

import {
  cashOnHand,
  DEAD_STOCK_DAYS,
  dayOf,
  known,
  MARGIN_DAYS,
  profitByProduct,
  rankMoves,
  SOLD_WEEKS,
  soldByWeek,
  watch,
  yesterday,
  Money,
  monthlyBurn,
  readStrip,
  shelfValue,
  unavailable,
  wantsYou,
  type CashDay,
  type CashTxn,
  type Customer,
  type Derived,
  type MarginInput,
  type PurchaseInvoice,
  type ManagerMove,
  type MoveRecord,
  type ProfitByProduct,
  type ShelfLine,
  type SoldByWeek,
  type SoldLine,
  type Watch,
  type Yesterday,
  type StockLot,
  type TodayStrip,
} from '@ow/domain';
import { readDate, readMoney, readText } from './boundary.js';
import { current } from './client.js';
import { readRegister } from './customers.js';
import {
  toPurchaseInvoice,
  toSalesInvoice,
  type PurchaseInvoiceRow,
  type SavedQuoteRow,
} from './savedQuotes.js';

const DAY = 86_400_000;

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

const num = (v: unknown): number | null => {
  // `typeof null` is 'object', so the object test excludes null too. A blank
  // string is excluded because `Number('')` is 0, and a missing cost read as
  // zero is the understatement this whole app exists to stop.
  const n = Number(v);
  return typeof v !== 'object' && v !== '' && Number.isFinite(n) ? n : null;
};

export interface TodayBooks {
  readonly strip: TodayStrip;
  /**
   * The moves still open, ranked. The handoff's sub-heading says "three
   * moves from last night's reading" and draws eight; this shop has 39
   * open. The owner has decided Today shows more than three — a named
   * deviation from the mockup, flagged for design, not done quietly.
   */
  readonly moves: readonly ManagerMove[];
  /** The twelve week bars and the sentence under them, as one reckoning. */
  readonly sold: SoldByWeek;
  /** Which lines the last month's profit came from. */
  readonly profit: ProfitByProduct;
  /** The four tiles: what the shop did on the last full day. */
  readonly yesterday: Yesterday;
  /** The readings the books made on their own, and the ones they could not. */
  readonly watch: Watch;
  /** Manager moves still open. The mockup draws three; the shop has 39. */
  readonly openMoves: number;
  /** The page's sub-line and the rail badge, as one number. */
  readonly wantsYou: number;
  /**
   * The day this was read, so the screen's date is a fact and not the
   * frozen string both designs currently hard-code.
   */
  readonly asOf: Date;
  /** Everything that could not be read, in words a screen can show. */
  readonly unreadable: readonly string[];
}

/* ------------------------------- the cash -------------------------------- */

/** `cash_txns` rows, in the terms `cash.ts` reckons over. */
export function readCashTxns(rows: readonly unknown[], notes: string[]): readonly CashTxn[] {
  const out: CashTxn[] = [];

  for (const raw of rows) {
    const row = obj(raw);
    if (row === null) continue;

    const on = readText(row.date);
    const amount = readMoney(row.amount, 'amount', 'a cash movement');
    if (on === null) {
      notes.push(`a cash movement has no date, so it cannot be placed against a count`);
      continue;
    }
    // An unreadable amount is named rather than netted to nothing: a
    // movement worth an unknown sum still happened, and dropping it
    // silently is what makes a till disagree with its own history.
    if (amount.status === 'unavailable') {
      notes.push(`a cash movement on ${on} has no readable amount`);
      continue;
    }

    out.push({
      id: readText(row.id) ?? String(num(row.id) ?? ''),
      on,
      account: readText(row.account) ?? '',
      type: readText(row.type) ?? '',
      category: readText(row.category),
      amount: amount.value,
    });
  }

  return out;
}

/** `cash_days` rows — the openings set and the closes counted. */
export function readCashDays(rows: readonly unknown[]): readonly CashDay[] {
  const out: CashDay[] = [];

  for (const raw of rows) {
    const row = obj(raw);
    const on = row === null ? null : readText(row.date);
    if (row === null || on === null) continue;

    out.push({
      on,
      opening: obj(row.opening) as Readonly<Record<string, number>> | null,
      actual: obj(row.actual) as Readonly<Record<string, number>> | null,
      openingSet: row.opening_set === true,
    });
  }

  return out;
}

/* ------------------------------- the shelf ------------------------------- */

/**
 * `stock` joined to `stock_lots` by key.
 *
 * `stock.qty` is what stands on the shelf; the lots are a purchase ledger
 * that includes units long since sold, which is the whole reason
 * `shelfLineValue` exists. A lot whose key has no `stock` row is not
 * invented into a line — there is nothing on that shelf to value.
 */
export function readShelfLines(
  stock: readonly unknown[],
  lots: readonly unknown[],
): readonly ShelfLine[] {
  const byKey = new Map<string, StockLot[]>();

  for (const raw of lots) {
    const row = obj(raw);
    const key = row === null ? null : readText(row.key);
    if (row === null || key === null) continue;

    const list = byKey.get(key) ?? [];
    list.push({
      qty: num(row.qty),
      cost: num(row.cost),
      consign: readText(row.consign),
    });
    byKey.set(key, list);
  }

  const lines: ShelfLine[] = [];
  for (const raw of stock) {
    const row = obj(raw);
    const key = row === null ? null : readText(row.key);
    if (row === null || key === null) continue;

    lines.push({ key, onShelf: num(row.qty) ?? 0, lots: byKey.get(key) ?? [] });
  }

  return lines;
}

/**
 * How many lines on the shelf have stopped selling.
 *
 * A line that has NEVER sold is dead, which is the old app's reading too
 * (`dead: !(soldOn && soldOn >= cutoff)`) and the one that matters: nothing
 * has ever moved, so nothing is going to without a decision.
 *
 * `null` for the log means `stock_log` could not be read, and then this is
 * not "nothing is dead" — it is not knowable, and the caller says so.
 */
export function deadLines(
  lines: readonly ShelfLine[],
  saleLog: readonly unknown[] | null,
  quietDays: number,
  now: Date,
): number | null {
  if (saleLog === null) return null;

  const lastSale = new Map<string, string>();
  const today = isoDay(now);

  for (const raw of saleLog) {
    const row = obj(raw);
    if (row === null) continue;
    // A restock or a count is not a customer. Only a sale ends a quiet run.
    if (readText(row.type) !== 'sale') continue;

    const key = readText(row.key);
    const on = readText(row.date);
    if (key === null || on === null || on > today) continue;

    const was = lastSale.get(key);
    if (was === undefined || on > was) lastSale.set(key, on);
  }

  const cutoff = isoDay(new Date(now.getTime() - quietDays * DAY));

  return lines.filter((l) => {
    if (l.onShelf <= 0) return false;
    const sold = lastSale.get(l.key);
    return sold === undefined || sold < cutoff;
  }).length;
}

/* ------------------------------ the margin ------------------------------- */

/**
 * What was sold and what was kept over the window, off the order lines.
 *
 * **Items only, and `charges[]` deliberately left out.** A charge — transport,
 * cutting — is revenue with no buying price beside it, so counting it into
 * what was SOLD while nothing enters what it COST would report it as pure
 * margin and lift the figure by however much of the week's takings it was.
 * The old app's `orderBuyingPriority` does use the whole quote total, and is
 * right to: it is ranking which order to fund, where every shilling of
 * revenue counts. This cell answers "what share of what we sold did we
 * keep", which is a question about the goods.
 *
 * `sellPrice` is what the client pays and `price` is what the shop paid — the
 * two the old app blurred. A line with no `price` counts into `sold` and not
 * into `kept`, and is counted so the cell can come back `partial` rather
 * than quietly reporting the shop's best-ever margin on its worst-documented
 * line.
 */
export function readSoldLines(sales: readonly unknown[]): readonly SoldLine[] {
  const out: SoldLine[] = [];

  for (const rawQuote of sales) {
    const quote = obj(rawQuote);
    if (quote === null || quote.voided === true) continue;

    const on = readDate(quote.date);
    if (on === null) continue;

    for (const [i, rawItem] of arr(obj(quote.payload)?.items).entries()) {
      const item = obj(rawItem);
      if (item === null) continue;

      const qty = num(item.qty);
      const sell = num(item.sellPrice);
      if (qty === null || sell === null) continue;

      const buy = num(item.price);

      out.push({
        on,
        // The name the order carried. `productId` is the better key the day
        // every row has one — the same note the Invoices register makes
        // about matching a customer.
        name: readText(item.productName) ?? readText(item.name) ?? `item ${i + 1}`,
        qty,
        sell: Money.money(Math.round(sell)),
        buy: buy === null ? null : Money.money(Math.round(buy)),
      });
    }
  }

  return out;
}

/** The margin cell's four figures, over whichever lines it is given. */
export function readMarginLines(lines: readonly SoldLine[]): MarginInput {
  let sold = 0;
  let kept = 0;
  let linesWithoutCost = 0;

  for (const l of lines) {
    sold += l.qty * l.sell;
    if (l.buy === null) linesWithoutCost += 1;
    else kept += l.qty * (l.sell - l.buy);
  }

  return {
    kept: Money.money(Math.round(kept)),
    sold: Money.money(Math.round(sold)),
    linesWithoutCost,
    linesCounted: lines.length,
  };
}

/* ------------------------------- the moves ------------------------------- */

/**
 * `manager_notes` move rows, in the terms `manager.ts` ranks.
 *
 * The body is a jsonb blob written by a language model and stored as data,
 * never trusted as structure — the old app's own words. So every field is
 * read defensively and an unknown one becomes nothing rather than a label
 * the screen would print unchallenged.
 */
export function readMoves(rows: readonly unknown[], notes: string[]): readonly MoveRecord[] {
  const out: MoveRecord[] = [];

  for (const raw of rows) {
    const row = obj(raw);
    if (row === null) continue;

    const body = obj(row.body) ?? {};
    const title = readText(body.title);
    if (title === null) {
      notes.push('a manager move has no title, so there is nothing to show for it');
      continue;
    }

    const worth = num(body.worth);
    const after = num(body.after);

    out.push({
      id: String(num(row.id) ?? readText(row.id) ?? ''),
      meetingId: readText(row.meeting_id) ?? (num(row.meeting_id)?.toString() ?? null),
      title,
      why: readText(body.why) ?? '',
      worth: worth === null ? null : Money.money(Math.round(worth)),
      worthBasis: readText(body.worthBasis),
      lever: readText(body.lever),
      unlocks: readText(body.unlocks),
      door: readText(body.door),
      after: after === null || !Number.isInteger(after) || after < 0 ? null : after,
      // 'open' is the only unsettled state 0081 writes. Anything else —
      // done, declined, or a status this app has never heard of — is not
      // something to put in front of the owner as work outstanding.
      settled: readText(row.status) !== 'open',
    });
  }

  return out;
}

/* ------------------------------ assembling ------------------------------- */

/** Rows in, Today out — with no client anywhere near it. */
export function assembleToday(rows: {
  readonly customers: readonly Customer[];
  readonly cashTxns: readonly unknown[];
  readonly cashDays: readonly unknown[];
  readonly purchases: readonly unknown[];
  /**
   * Invoiced sales over the twelve weeks the panel draws.
   *
   * One read, two readings. The margin cell wants the last seven days and
   * the bars want twelve weeks, and `saved_quotes` is a big table on a slow
   * link — so the wider window is fetched once and the margin narrows it
   * here rather than asking the database the same question twice.
   */
  readonly sales: readonly unknown[];
  readonly stock: readonly unknown[];
  readonly lots: readonly unknown[];
  /** `null` when `stock_log` could not be read at all. */
  readonly saleLog: readonly unknown[] | null;
  /**
   * Every move row, settled ones included and in id order.
   *
   * Not just the open ones: `after` is a position within a meeting's own
   * plan, so a list with the settled moves removed repoints every
   * dependency at whatever rose into the vacated slot. `null` when
   * `manager_notes` could not be read at all.
   */
  readonly moves: readonly unknown[] | null;
  /** The shop's own `presets.deadStockDays`, or `null` if unset. */
  readonly deadStockDays: number | null;
  readonly now: Date;
  /** Degradations the reader already named. */
  readonly notes: readonly string[];
}): TodayBooks {
  const unreadable = [...rows.notes];

  const txns = readCashTxns(rows.cashTxns, unreadable);
  const days = readCashDays(rows.cashDays);

  const purchases: PurchaseInvoice[] = [];
  for (const raw of rows.purchases) {
    const { purchase, unreadable: bad } = toPurchaseInvoice(raw as PurchaseInvoiceRow);
    purchases.push(purchase);
    unreadable.push(...bad.map((b) => `${purchase.doc}: ${b}`));
  }

  const soldLines = readSoldLines(rows.sales);
  // Whole days. `SoldLine.on` is a calendar day at midnight, so comparing it
  // against an instant dropped the oldest day of the window as soon as the
  // clock passed midnight — the margin drifted through the morning without
  // a single sale changing.
  const marginFrom = dayOf(rows.now).getTime() - (MARGIN_DAYS - 1) * DAY;
  const marginLines = soldLines.filter((l) => l.on.getTime() >= marginFrom);

  const sales = [];
  for (const raw of rows.sales) {
    const { invoice, unreadable: bad } = toSalesInvoice(raw as SavedQuoteRow, { termsDays: null });
    sales.push(invoice);
    unreadable.push(...bad.map((b) => `${invoice.doc}: ${b}`));
  }

  const lines = readShelfLines(rows.stock, rows.lots);
  const shelf = shelfValue(lines);

  // The shop's own setting is the authority, not this app's constant. The
  // old app reads `presets.deadStockDays ?? 60`; the domain's own
  // DEAD_STOCK_DAYS is 120, which is nobody's actual figure, so it is the
  // last resort and the screen is told when it was used.
  const quietDays = rows.deadStockDays ?? DEAD_STOCK_DAYS;
  if (rows.deadStockDays === null) {
    unreadable.push(
      `this shop has not set how long a line stays quiet before it is called dead, so ${DEAD_STOCK_DAYS} days is assumed`,
    );
  }

  const deadCount = deadLines(lines, rows.saleLog, quietDays, rows.now);
  if (deadCount === null) {
    unreadable.push('the stock history could not be read, so no line can be called dead');
  }

  const moves = rows.moves === null ? null : rankMoves(readMoves(rows.moves, unreadable));
  if (moves === null) {
    unreadable.push('the manager’s moves could not be read');
  }

  const cash = cashOnHand(isoDay(rows.now), txns, days);
  const deadValue = unavailable(
    'dead stock is valued at FIFO cost in the shop’s own books, and that reckoning is not ported yet',
  );

  const strip = readStrip(
    {
      cash,
      burn: monthlyBurn(rows.now, txns),
      customers: rows.customers,
      purchases,
      margin: readMarginLines(marginLines),
      stock: {
        shelf,
        // Named, not guessed. See the header.
        dead: deadValue,
        deadLines: deadCount ?? 0,
      },
    },
    rows.now,
  );

  const openMoves = moves?.length ?? 0;

  return {
    strip,
    sold: soldByWeek(sales, rows.now),
    profit: profitByProduct(soldLines, rows.now),
    yesterday: yesterday(sales, txns, rows.now),
    watch: watch(
      {
        customers: rows.customers,
        cash,
        deadLines: deadCount ?? 0,
        deadValue,
        quietDays,
      },
      rows.now,
    ),
    moves: moves ?? [],
    openMoves,
    wantsYou: wantsYou(strip, openMoves),
    asOf: rows.now,
    unreadable,
  };
}

/* -------------------------------- reading -------------------------------- */

/**
 * Today, for one shop, as of one moment.
 *
 * `readRegister` is called rather than re-queried: what is owed to the shop
 * is the Customers register's figure, and two queries for it are two figures
 * that can drift. Its failure is fatal here, because the second cell of the
 * strip is built entirely from it.
 */
export async function readToday(shopId: string, now: Date): Promise<Derived<TodayBooks>> {
  const { sb } = current();
  // Twelve weeks, which is the wider of the two windows the sales feed.
  const salesFrom = isoDay(new Date(now.getTime() - SOLD_WEEKS * 7 * DAY));

  const [register, cashTxnsRes, cashDaysRes, purchasesRes, salesRes, stockRes, lotsRes, logRes, movesRes, settingsRes] =
    await Promise.all([
      readRegister(shopId, now),
      sb.from('cash_txns').select('id, date, account, type, category, amount').eq('shop_id', shopId),
      sb.from('cash_days').select('date, opening, actual, opening_set').eq('shop_id', shopId),
      // No date floor: see the header. What is owed is owed.
      sb.from('purchase_invoices').select('id, quote_id, date, payload').eq('shop_id', shopId),
      sb
        .from('saved_quotes')
        .select(
          'id, client_name, client_phone, date, status, invoiced, invoiced_at, amount_paid, voided, payload',
        )
        .eq('shop_id', shopId)
        .eq('invoiced', true)
        .gte('date', salesFrom),
      sb.from('stock').select('key, qty').eq('shop_id', shopId),
      sb.from('stock_lots').select('key, qty, cost, consign').eq('shop_id', shopId),
      // Only sales end a quiet run, so only sales are fetched.
      sb.from('stock_log').select('key, type, date').eq('shop_id', shopId).eq('type', 'sale'),
      // Every move, not only the open ones, and in id order — `after`
      // counts within a meeting's plan and a gap in the list moves it.
      sb
        .from('manager_notes')
        .select('id, meeting_id, kind, status, date, body')
        .eq('shop_id', shopId)
        .eq('kind', 'move')
        .order('id', { ascending: true }),
      sb.from('app_settings').select('presets').eq('shop_id', shopId).maybeSingle(),
    ]);

  // Four of these are the strip. Without them a cell would be invented
  // rather than reported, and the whole screen is the five cells.
  if (register.status === 'unavailable') return unavailable(`what is owed: ${register.reason}`);

  const fatal = [
    cashTxnsRes.error === null ? null : `cash movements: ${cashTxnsRes.error.message}`,
    cashDaysRes.error === null ? null : `the cash days: ${cashDaysRes.error.message}`,
    purchasesRes.error === null ? null : `purchase invoices: ${purchasesRes.error.message}`,
    salesRes.error === null ? null : `the last twelve weeks of sales: ${salesRes.error.message}`,
    stockRes.error === null ? null : `the shelf: ${stockRes.error.message}`,
    lotsRes.error === null ? null : `what the shelf cost: ${lotsRes.error.message}`,
  ].filter((x): x is string => x !== null);

  if (fatal.length > 0) return unavailable(fatal.join('; '));

  // The rest degrade. A shop whose stock history will not load still has a
  // cash position, a debtors total and a shelf; losing those three to it
  // would turn "I cannot say what is dead" into "I cannot say anything".
  const presets = obj(obj(settingsRes.data)?.presets);
  const deadStockDays = presets === null ? null : num(presets.deadStockDays);

  const books = assembleToday({
    customers: register.value.customers,
    cashTxns: cashTxnsRes.data ?? [],
    cashDays: cashDaysRes.data ?? [],
    purchases: purchasesRes.data ?? [],
    sales: salesRes.data ?? [],
    stock: stockRes.data ?? [],
    lots: lotsRes.data ?? [],
    saleLog: logRes.error === null ? logRes.data : null,
    moves: movesRes.error === null ? movesRes.data : null,
    deadStockDays,
    now,
    notes:
      settingsRes.error === null
        ? []
        : [`the shop’s own settings could not be read (${settingsRes.error.message})`],
  });

  return known(
    books,
    `${books.strip.stock.linesOnShelf} lines on the shelf and ${books.openMoves} moves open, as of ${isoDay(now)}`,
  );
}
