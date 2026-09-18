/**
 * The one place this app is allowed to be a writer, typed once.
 *
 * `client.ts` calls `createClient` without generated `Database` types, so
 * PostgREST's builders resolve every table to `never` and every RPC argument
 * to `undefined`. That is harmless for the `.select()` every reader makes and
 * impossible to write through. Rather than loosen the shared client for every
 * reader, the shape of the calls a writer needs is declared here and asserted
 * at this one boundary — so what is being claimed about the client is
 * readable in one place instead of restated in every file that writes.
 *
 * It was restated once, in `promises.ts`, and the second writer would have
 * copied it. Two declarations of what the client really is are two places to
 * be wrong about it.
 *
 * **Nothing here writes.** It issues ids and declares types; the `.insert()`
 * itself stays in the file that has argued for it, which is what
 * `read-only.test.ts` is watching.
 */

import { current } from './client.js';

/** What PostgREST says when it will not do something. */
export interface Refusal {
  readonly message: string;
  readonly code: string;
}

export interface Writer {
  rpc(
    fn: string,
    args: Readonly<Record<string, unknown>>,
  ): PromiseLike<{ readonly data: unknown; readonly error: Refusal | null }>;
  from(table: string): {
    insert(row: Readonly<Record<string, unknown>>): PromiseLike<{
      readonly error: Refusal | null;
    }>;
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

export const writer = (): Writer => current().sb as unknown as Writer;

/** Saved, or the reason it was not — in words a person can act on. */
export type Written =
  | { readonly ok: true; readonly id: number }
  | { readonly ok: false; readonly why: string };

/**
 * Whether a refusal is row-level security rather than anything else.
 *
 * `42501` is `insufficient_privilege`. PostgREST does not always carry the
 * code through, so the message is checked too — and the difference matters
 * to the person reading it: "you are not allowed to do that" is something
 * they can act on, and "the database said no" is not.
 */
export const isRefusedByPolicy = (error: Refusal): boolean =>
  error.code === '42501' || /row-level security/i.test(error.message);

/**
 * The highest id in a one-row answer — the part of an id floor that can be
 * wrong without a database to prove it.
 *
 * `bigint` comes back from PostgREST as a JSON number or a string depending
 * on its size, and anything unparseable floors at 0 rather than at `NaN`,
 * which the RPC would reject as a bad jsonb value — turning a safety margin
 * into a failed write.
 */
export function topId(rows: readonly { readonly id: unknown }[] | null): number {
  const top = Number(rows?.[0]?.id);
  return Number.isInteger(top) && top > 0 ? top : 0;
}

/**
 * The highest id already on disk for this shop in one table, or 0.
 *
 * This is the FLOOR for a counter, not an id. `next_row_id_blocks` does
 * `greatest(last_issued, floor) + n`, so a floor can only ever push the
 * shared sequence forward — it can never hand back an id the table already
 * holds, and it never reuses one. That is the old app's own `rowIdFloor`,
 * for the same reason.
 *
 * It matters because `entity_id_counters` has **RLS on with no policies at
 * all** (migration 0032: "nothing may read or write these rows"), so no
 * client can check whether a counter is level with its table. It is
 * unverifiable by construction. If one were ever behind — a row inserted by
 * hand in the SQL editor, a counter reset, a half-applied migration — an
 * unfloored call would issue an id that already exists and the insert would
 * die on the primary key.
 *
 * A read that fails floors at 0, which is the RPC's own default: the counter
 * is still the authority and is almost certainly correct. The floor is the
 * belt, not the trousers.
 */
export async function idFloor(table: string, shopId: string): Promise<number> {
  const { data, error } = await writer()
    .from(table)
    .select('id')
    .eq('shop_id', shopId)
    .order('id', { ascending: false })
    .limit(1);

  return error !== null ? 0 : topId(data);
}

/**
 * One id, issued now.
 *
 * `p_count: 1` rather than the old app's block of ten, and for two separate
 * reasons that happen to agree. A block is what lets that app hand out ids
 * from synchronous code mid-loop, and nothing here is synchronous. And for
 * `row:saved_quote` a block would be wrong even there: the id becomes the
 * `INV-` number on the shop's paperwork, so an id reserved and not used
 * shows up as a skipped invoice number. The old app throws rather than let
 * that kind reach its block allocator at all.
 *
 * `what` is the thing being saved, in the words of the person who pressed
 * the button: it is the subject of every sentence this can fail with.
 */
export async function issueRowId(
  shopId: string,
  kind: string,
  floor: number,
  what: string,
): Promise<Written> {
  const { data, error } = await writer().rpc('next_row_id_blocks', {
    p_shop_id: shopId,
    p_kinds: [kind],
    p_count: 1,
    p_floors: { [kind]: floor },
  });

  if (error !== null) {
    return { ok: false, why: `${what} was not saved — no id could be issued (${error.message}).` };
  }

  const id = Number((data as Record<string, unknown> | null)?.[kind]);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, why: `${what} was not saved — the database issued no id for it.` };
  }

  return { ok: true, id };
}
