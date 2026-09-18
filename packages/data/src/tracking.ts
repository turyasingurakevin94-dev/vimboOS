/**
 * The order board, from the real books.
 *
 * ## The shop's own vocabulary, unchanged
 *
 * `saved_quotes.status` on this shop holds exactly `draft`,
 * `awaiting_goods`, `preparing`, `pending_delivery` and `completed` — which
 * is the domain's `Stage` type, word for word. There is no mapping layer
 * here and there should never be one: a lane the shop cannot name is a lane
 * nobody can move a card out of.
 *
 * A status the books hold that this app does not know is **not** forced into
 * the nearest lane. It is named in `unreadable` and the order is left off
 * the board, because a card in the wrong lane is worse than a card missing
 * from it — somebody would work it.
 *
 * ## Where the rest of a card lives
 *
 * Almost all of it is in `payload`, which is a jsonb blob the old app writes
 * and this app only reads:
 *
 * | on the card | in the row |
 * | --- | --- |
 * | when it entered the lane | `payload.stageEnteredAt`, epoch milliseconds |
 * | who is picking it | `payload.assignedWorkerId` |
 * | the run it is on | `payload.assignedDeliveryId` |
 * | packed | `payload.pickingStatus === 'done'` |
 * | short pick | `pickedQty` against `qty`, per item |
 * | bought-in lines | items carrying a `supplierId` |
 * | checked in | those whose `receivedQty` has arrived |
 */

import {
  known,
  Money,
  partial,
  STAGES,
  unavailable,
  type Derived,
  type Stage,
  type SupplierAsk,
  type TrackedOrder,
} from '@ow/domain';
import { readText } from './boundary.js';
import { invoiceDoc } from './savedQuotes.js';
import { current } from './client.js';

export interface Board {
  readonly orders: readonly TrackedOrder[];
  /** Rows that were read and could not be understood, in words. */
  readonly unreadable: readonly string[];
}

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

const num = (v: unknown): number | null => {
  const n = Number(v);
  return typeof v !== 'object' && v !== '' && Number.isFinite(n) ? n : null;
};

const isStage = (v: string): v is Stage => (STAGES as readonly string[]).includes(v);

/**
 * When the card entered its lane.
 *
 * `stageEnteredAt` is epoch milliseconds, not a date string — the one field
 * in this payload that is. `null` rather than the row's date when it is
 * missing: the board ages a card from when it ARRIVED in the lane, and
 * falling back to when the order was raised would show a card that moved
 * this morning as three weeks old.
 */
const enteredAt = (payload: Record<string, unknown>): Date | null => {
  const at = num(payload.stageEnteredAt);
  return at === null ? null : new Date(at);
};

/** What the order is worth: the goods, plus what was charged to move them. */
function valueOf(payload: Record<string, unknown>, doc: string): Derived<Money.Money> {
  let total = 0;
  let blind = 0;
  let counted = 0;

  for (const raw of arr(payload.items)) {
    const item = obj(raw);
    if (item === null) continue;
    counted += 1;

    const qty = num(item.qty);
    const sell = num(item.sellPrice);
    if (qty === null || sell === null) {
      blind += 1;
      continue;
    }
    total += qty * sell;
  }

  for (const raw of arr(payload.charges)) {
    const amount = num(obj(raw)?.amount);
    if (amount !== null) total += amount;
  }

  const money = Money.money(Math.round(total));
  const basis = `${counted} ${counted === 1 ? 'line' : 'lines'}`;

  if (counted === 0) return unavailable(`${doc} has no lines to value`);
  return blind === 0
    ? known(money, basis)
    : partial(money, basis, `${blind} of ${counted} lines have no price`);
}

/** The suppliers asked for this order, and whether they have answered. */
function suppliersOf(payload: Record<string, unknown>): readonly SupplierAsk[] {
  const confirms = obj(payload.supplierConfirms) ?? {};
  const names = new Map<string, boolean>();

  for (const raw of arr(payload.items)) {
    const item = obj(raw);
    const name = item === null ? null : readText(item.supplierName);
    if (item === null || name === null) continue;

    const id = readText(item.supplierId) ?? name;
    // Answered once, answered for the order: the confirmation is per
    // supplier, not per line, which is how the shop asks.
    names.set(name, (names.get(name) ?? false) || confirms[id] !== undefined);
  }

  return [...names].map(([name, answered]) => ({ name, answered }));
}

/**
 * One row, as a card — or `null` with a reason.
 *
 * The wrongable part of this file, and the reason it is separate from the
 * query: every field below comes out of a blob written by another
 * application over several years.
 */
export function toTrackedOrder(
  raw: unknown,
  invoiced: boolean,
): { readonly order: TrackedOrder | null; readonly why: string | null } {
  const row = obj(raw);
  const id = row === null ? null : num(row.id);
  if (row === null || id === null) return { order: null, why: 'an order has no id' };

  const doc = `#${id}`;
  const status = readText(row.status);
  if (status === null || !isStage(status)) {
    // Not forced into the nearest lane. Somebody would work it there.
    return { order: null, why: `${doc} is at "${status ?? 'no stage'}", which is not a lane` };
  }

  const payload = obj(row.payload) ?? {};
  const items = arr(payload.items).map(obj);

  const bought = items.filter((i) => i !== null && readText(i.supplierId) !== null);
  const checkedIn = bought.filter((i) => (num(i?.receivedQty) ?? 0) > 0);

  const asked = items.reduce((n, i) => n + (num(i?.qty) ?? 0), 0);
  const found = items.reduce((n, i) => n + (num(i?.pickedQty) ?? num(i?.qty) ?? 0), 0);

  const client = obj(payload.client);

  return {
    why: null,
    order: {
      reference: doc,
      customer: readText(row.client_name) ?? readText(client?.name) ?? 'Counter sale',
      place: readText(client?.place) ?? readText(client?.location) ?? '',
      lines: items.length,
      toBuy: bought.length,
      checkedIn: checkedIn.length,
      stage: status,
      since: enteredAt(payload),
      value: valueOf(payload, doc),
      suppliers: suppliersOf(payload),
      // A short pick is not a problem until somebody has to decide about it,
      // and noticing it is not deciding — `pickShortfallAckAt` is.
      shortPick:
        found >= asked
          ? null
          : { asked, found, settled: payload.pickShortfallAckAt !== undefined },
      packed: readText(payload.pickingStatus) === 'done',
      picker: readText(payload.assignedWorkerId),
      run: readText(payload.assignedDeliveryId),
      invoice: invoiced ? invoiceDoc(id) : null,
    },
  };
}

/** Rows in, board out — with no client anywhere near it. */
export function assembleBoard(rows: readonly unknown[]): Board {
  const orders: TrackedOrder[] = [];
  const unreadable: string[] = [];

  for (const raw of rows) {
    const row = obj(raw);
    // A voided order is not on the board at all: it was cancelled, and a
    // cancelled order in a lane is somebody's wasted morning.
    if (row?.voided === true) continue;

    const { order, why } = toTrackedOrder(raw, row?.invoiced === true);
    if (order === null) {
      if (why !== null) unreadable.push(why);
      continue;
    }
    orders.push(order);
  }

  return { orders, unreadable };
}

/** How far back the board looks for orders already finished. */
export const BOARD_DAYS = 30;

/**
 * The board, for one shop.
 *
 * Completed orders are fetched over a window and the rest without one: an
 * order still in a lane belongs on the board however long it has been there
 * — that is the whole point of a stage limit — while a finished one leaves
 * after a day by design and a month of them would bury the work.
 */
export async function readBoard(shopId: string, now: Date): Promise<Derived<Board>> {
  const { sb } = current();
  const since = new Date(now.getTime() - BOARD_DAYS * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await sb
    .from('saved_quotes')
    .select('id, client_name, date, status, invoiced, voided, payload')
    .eq('shop_id', shopId)
    .or(`status.neq.completed,date.gte.${since}`)
    .order('id', { ascending: false });

  if (error !== null) return unavailable(`the order board: ${error.message}`);

  const board = assembleBoard(data);
  return known(board, `${board.orders.length} orders on the board`);
}
