/**
 * One shape for "a screen asked the books a question".
 *
 * Every screen that reads real rows needs the same three-way answer, for the
 * same reason: PostgREST returns `[]` for *still fetching*, *refused* and
 * *this shop has none*, and only the last one is a screen worth drawing.
 * Written once here so the second screen cannot quietly collapse it to two.
 *
 * `today` travels with the data rather than being read at the point of use.
 * The demo books are pinned to a fixed date — every figure in every frame is
 * relative to it — and a screen that took `new Date()` for itself would date
 * the example rows from now and show a year-old order as today's.
 */

import { useQuery } from '@tanstack/react-query';
import { DEMO_TODAY } from '@ow/data';
import type { Derived } from '@ow/domain';
import { useBooks } from './Books.js';

export type Loaded<T> =
  | { readonly at: 'loading' }
  | { readonly at: 'failed'; readonly why: string }
  | {
      readonly at: 'ready';
      readonly data: T;
      readonly today: Date;
      /** True when these are the shop's own rows. Screens that open on a
       *  frame's picked row use it to open at rest on real books instead. */
      readonly live: boolean;
    };

export function useBook<T>(
  /** What is being read — the cache key, and the word in a failure. */
  name: string,
  /** The live read. Called only when live books are open. */
  read: (shopId: string, now: Date) => Promise<Derived<T>>,
  /** The same question, answered from the demo rows. */
  example: () => T,
): Loaded<T> {
  const books = useBooks();
  const live = books.from === 'live';

  const query = useQuery({
    queryKey: [name, live ? books.shopId : 'example'],
    enabled: live,
    queryFn: async () => {
      if (!live) throw new Error('unreachable: the example books need no query');
      return read(books.shopId, new Date());
    },
  });

  // The example books are synchronous and always readable. Returning them
  // without a loading state is not a shortcut — there is nothing to wait
  // for, and a spinner over data that is already here lies about the link.
  if (!live) return { at: 'ready', data: example(), today: DEMO_TODAY, live: false };

  if (query.isPending) return { at: 'loading' };
  if (query.isError) {
    return {
      at: 'failed',
      why: query.error instanceof Error ? query.error.message : `The ${name} could not be read.`,
    };
  }
  if (query.data.status === 'unavailable') return { at: 'failed', why: query.data.reason };

  return { at: 'ready', data: query.data.value, today: new Date(), live: true };
}
