/**
 * Writing down a promised date — the one write this app makes.
 *
 * Every other hook here reads. This one calls `recordPromise`, which inserts
 * into `payment_promises` and nothing else. The table is append-only by the
 * design of migration 0089, which is what makes it safe to turn on while the
 * old app is still running the shop — see the argument in
 * `packages/data/src/read-only.test.ts`.
 *
 * ## The example books refuse, and say why
 *
 * There is no database behind them, so there is nothing to write to. The
 * refusal is explicit rather than a silent success: a dialog that closes
 * with a tick over the demo rows would teach somebody that the button works
 * before it ever has.
 *
 * ## Every ending is named
 *
 * Four of them: idle, writing, written, refused. `refused` carries the
 * reason in the words the database used, because the commonest one is not a
 * bug — 0089 restricts INSERT to `is_shop_admin`, so an assistant recording
 * what a customer told them is turned away by policy and needs the owner.
 */

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { recordPromise, type Written } from '@ow/data';
import type { PromiseRecord } from '@ow/domain';
import { useBooks } from './Books.js';

export type Writing =
  | { readonly at: 'idle' }
  | { readonly at: 'writing' }
  | { readonly at: 'written'; readonly id: number }
  | { readonly at: 'refused'; readonly why: string };

export interface RecordPromise {
  readonly state: Writing;
  readonly write: (customerId: string, record: PromiseRecord) => void;
  readonly reset: () => void;
}

export function useRecordPromise(): RecordPromise {
  const books = useBooks();
  const cache = useQueryClient();
  const [state, setState] = useState<Writing>({ at: 'idle' });

  const write = useCallback(
    (customerId: string, record: PromiseRecord) => {
      if (books.from !== 'live') {
        setState({
          at: 'refused',
          why: 'These are the example books. Sign in to write to the shop’s own.',
        });
        return;
      }

      setState({ at: 'writing' });
      void recordPromise(books.shopId, customerId, record).then(
        (result: Written) => {
          setState(result.ok ? { at: 'written', id: result.id } : { at: 'refused', why: result.why });
          // Every screen that reads a promise is now out of date: the
          // Customers register decides who is past due from these rows, and
          // Today counts them. Re-read rather than patch a cache by hand —
          // a promise changes what `standing()` says about an account, and
          // guessing that here would be a second reckoning.
          if (result.ok) void cache.invalidateQueries();
        },
        (err: unknown) => {
          setState({
            at: 'refused',
            why: err instanceof Error ? err.message : 'The promise was not saved.',
          });
        },
      );
    },
    [books, cache],
  );

  return { state, write, reset: useCallback(() => setState({ at: 'idle' }), []) };
}
