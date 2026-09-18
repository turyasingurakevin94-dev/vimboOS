/**
 * Writing down that somebody promised a date.
 *
 * ## The first write
 *
 * Every other module here reads. This one inserts, and it is first for a
 * reason: `payment_promises` is **append-only by design** (migration 0089 —
 * *"the row is never rewritten — a changed mind is a SECOND promise"*), so
 * it is the one table where this app cannot overwrite something the old app
 * wrote. Nothing is recomputed from it, no total is rebuilt from its keys,
 * and deleting a bad row is the documented correction. A promise landing
 * here cannot make a figure on the shop's own screen wrong; at worst it adds
 * a row the owner then removes.
 *
 * ## The id is issued by the database, never guessed
 *
 * `payment_promises.id` is a plain `bigint`, not an identity column, and the
 * primary key is `(shop_id, id)`. The id comes from `entity_id_counters` via
 * the `next_row_id_blocks` RPC (migration 0034), which takes a row lock so
 * concurrent callers serialise.
 *
 * **This matters more here than anywhere else in this app: the old app is
 * still running the shop and issues ids from the same counter.** `max(id) +
 * 1` would read a number the old app has already reserved and not yet
 * written, and the two apps would collide on the primary key — or, if the
 * old app got there second, its own insert would fail in the middle of
 * somebody recording a payment.
 *
 * So a failed allocation **refuses the write**. The old app falls back to a
 * local counter, because a shop must be able to take money with the network
 * down; this app is a reader that writes one optional row, and a guessed id
 * is the one outcome worse than "not saved".
 *
 * ## Dates are UTC, like every other date in these books
 *
 * `made_on` and `promised_on` are `date` columns, and every day-string in
 * both apps is `toISOString().slice(0, 10)` — the old app's `todayISO()` is
 * UTC and its `daysSinceDate()` parses back as UTC *deliberately*, with the
 * comment saying why. Uganda is UTC+3, so for the first three hours of a
 * local day the UTC day is the one before. That is a known, corpus-wide
 * convention, and a promise written in local days would compare wrongly
 * against every dated row beside it. One table does not get its own
 * timezone.
 */

import type { PromiseRecord } from '@ow/domain';
import {
  idFloor,
  isRefusedByPolicy,
  issueRowId,
  writer,
  type Written,
} from './writer.js';

/** The counter these ids are issued from. Seeded for every shop by 0089. */
export const PROMISE_ID_KIND = 'row:payment_promise';

/** What `payment_promises` is given. Column names, spelled once. */
export interface PromiseRow extends Readonly<Record<string, unknown>> {
  readonly shop_id: string;
  readonly id: number;
  readonly customer_id: string;
  readonly promised_on: string;
  readonly made_on: string;
  readonly amount: number | null;
  readonly note: string | null;
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * A checked promise, as a row — the part of this file that can be wrong.
 *
 * Column names, the two date formats and the null amount are all here, and
 * none of them need a database to test. `amount` is passed through as the
 * integer of shillings `Money` already is; the column is `numeric` and
 * carries `check (amount is null or amount > 0)`, which `draftPromise` is
 * what guarantees.
 */
export const promiseRow = (
  shopId: string,
  customerId: string,
  id: number,
  record: PromiseRecord,
): PromiseRow => ({
  shop_id: shopId,
  id,
  customer_id: customerId,
  promised_on: isoDay(record.promisedOn),
  made_on: isoDay(record.madeOn),
  amount: record.amount,
  note: record.note,
});

/**
 * The floor for this shop's promise counter.
 *
 * **On this shop it turned out to be miles ahead, not behind.** The first
 * real write took id 3331 against a table holding one row, id 1. The old app
 * reserves a block of ten for every block kind on every load — including
 * this one, used or not — so roughly 333 loads have advanced the counter
 * with nothing claiming the ids. That is the documented cost of block
 * allocation ("the cost is gaps, which for an internal surrogate key is
 * free"), and it means the floor changed nothing here: `greatest(3330, 1) +
 * 1` is 3331 either way.
 *
 * It stays, because it is one cheap select that can only ever push the
 * sequence forward, and because "the counter happens to be ahead on the one
 * shop we looked at" is not a guarantee about the next one.
 */
const issueId = async (shopId: string): Promise<Written> =>
  issueRowId(
    shopId,
    PROMISE_ID_KIND,
    await idFloor('payment_promises', shopId),
    'The promise',
  );

/**
 * Write down what they said.
 *
 * `shopId` is passed rather than inferred, as everywhere else here: RLS
 * would scope the insert anyway, but the schema lets somebody belong to two
 * shops and a write that lets the policy pick one is a write that lands in
 * the wrong books.
 */
export async function recordPromise(
  shopId: string,
  customerId: string,
  record: PromiseRecord,
): Promise<Written> {
  const issued = await issueId(shopId);
  if (!issued.ok) return issued;

  const { error } = await writer()
    .from('payment_promises')
    .insert(promiseRow(shopId, customerId, issued.id, record));

  // Two refusals worth telling apart, because only one of them is the
  // person's to fix. 0089 restricts INSERT to `is_shop_admin`, so an
  // assistant recording what a customer told them is denied by policy and
  // needs the owner — not a retry, and not a bug to report.
  if (error !== null) {
    const denied = isRefusedByPolicy(error);
    return {
      ok: false,
      why: denied
        ? 'Only the owner can record a promise on this shop’s books. Nothing was saved.'
        : `The promise was not saved (${error.message}).`,
    };
  }

  return { ok: true, id: issued.id };
}
