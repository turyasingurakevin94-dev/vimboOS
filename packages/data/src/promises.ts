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
import { current } from './client.js';

/** The counter these ids are issued from. Seeded for every shop by 0089. */
export const PROMISE_ID_KIND = 'row:payment_promise';

/** What `payment_promises` is given. Column names, spelled once. */
export interface PromiseRow {
  readonly shop_id: string;
  readonly id: number;
  readonly customer_id: string;
  readonly promised_on: string;
  readonly made_on: string;
  readonly amount: number | null;
  readonly note: string | null;
}

/**
 * The two calls this module makes, spelled out.
 *
 * `client.ts` calls `createClient` without generated `Database` types, so
 * PostgREST's builders resolve every table to `never` and every RPC argument
 * to `undefined`. That is harmless for the `.select()` every other module
 * here makes and impossible to write through. Rather than loosen the shared
 * client for every reader, the shape of the two calls this file needs is
 * declared once and asserted at the boundary — so what is being claimed
 * about the client is readable in one place instead of spread over two call
 * sites.
 */
interface Refusal {
  readonly message: string;
  readonly code: string;
}

interface Writer {
  rpc(
    fn: string,
    args: Readonly<Record<string, unknown>>,
  ): PromiseLike<{ readonly data: unknown; readonly error: Refusal | null }>;
  from(table: string): {
    insert(row: PromiseRow): PromiseLike<{ readonly error: Refusal | null }>;
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        order(
          column: string,
          opts: { readonly ascending: boolean },
        ): {
          limit(n: number): PromiseLike<{
            readonly data: readonly { readonly id: unknown }[] | null;
            readonly error: Refusal | null;
          }>;
        };
      };
    };
  };
}

const writer = (): Writer => current().sb as unknown as Writer;

/** Saved, or the reason it was not — in words a person can act on. */
export type Written =
  | { readonly ok: true; readonly id: number }
  | { readonly ok: false; readonly why: string };

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
 * The highest promise id already on disk for this shop, or 0.
 *
 * This is the FLOOR for the counter, not the id. `next_row_id_blocks` does
 * `greatest(last_issued, floor) + n`, so a floor can only ever push the
 * shared sequence forward — it can never hand back an id the table already
 * holds, and it never reuses one. That is the old app's own `rowIdFloor`,
 * for the same reason.
 *
 * It matters because `entity_id_counters` has **RLS on with no policies at
 * all** (migration 0032: "nothing may read or write these rows"), so no
 * client can check whether the counter is level with the table. It is
 * unverifiable by construction. If it were ever behind — a row inserted by
 * hand in the SQL editor, a counter reset, a half-applied 0089 — an
 * unfloored call would issue an id that already exists and the insert would
 * die on the primary key. This shop holds promise id 1 today, so that is not
 * a hypothetical shape.
 *
 * A read that fails floors at 0, which is the RPC's own default: the counter
 * is still the authority and is almost certainly correct. The floor is the
 * belt, not the trousers.
 */
async function idFloor(shopId: string): Promise<number> {
  const { data, error } = await writer()
    .from('payment_promises')
    .select('id')
    .eq('shop_id', shopId)
    .order('id', { ascending: false })
    .limit(1);

  return error !== null ? 0 : topPromiseId(data);
}

/**
 * The highest id in a one-row answer — the part of the floor that can be
 * wrong without a database to prove it.
 *
 * `bigint` comes back from PostgREST as a JSON number or a string depending
 * on its size, and anything unparseable floors at 0 rather than at `NaN`,
 * which the RPC would reject as a bad jsonb value and turn a safety margin
 * into a failed write.
 */
export function topPromiseId(rows: readonly { readonly id: unknown }[] | null): number {
  const top = Number(rows?.[0]?.id);
  return Number.isInteger(top) && top > 0 ? top : 0;
}

/**
 * One id, issued now.
 *
 * `p_count: 1` rather than the old app's block of ten. A block is what lets
 * that app hand out ids from synchronous code mid-loop; nothing here is
 * synchronous, and a part-used block would advance the shared counter past
 * ids nobody claims.
 */
async function issueId(shopId: string): Promise<Written> {
  const { data, error } = await writer().rpc('next_row_id_blocks', {
    p_shop_id: shopId,
    p_kinds: [PROMISE_ID_KIND],
    p_count: 1,
    p_floors: { [PROMISE_ID_KIND]: await idFloor(shopId) },
  });

  if (error !== null) {
    return { ok: false, why: `The promise was not saved — no id could be issued (${error.message}).` };
  }

  const id = Number((data as Record<string, unknown> | null)?.[PROMISE_ID_KIND]);
  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      why: 'The promise was not saved — the database issued no id for it.',
    };
  }

  return { ok: true, id };
}

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
    const denied = error.code === '42501' || /row-level security/i.test(error.message);
    return {
      ok: false,
      why: denied
        ? 'Only the owner can record a promise on this shop’s books. Nothing was saved.'
        : `The promise was not saved (${error.message}).`,
    };
  }

  return { ok: true, id: issued.id };
}
