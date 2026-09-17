/**
 * The Invoices register, from whichever books are open.
 *
 * Lives in `app/` beside `useDesign` because it is data, not design — both
 * trees read it and neither imports the other to do so.
 *
 * The return shape is deliberately three-way and not "data or null". A
 * screen must be able to tell **still loading** from **could not be read**
 * from **read, and there is nothing**, because PostgREST answers all three
 * with an empty array and only the last one means the shop has no invoices.
 */

import { useQuery } from '@tanstack/react-query';
import { readLedgers, demoPurchaseInvoices, demoSalesInvoices, DEMO_TODAY, type Ledgers } from '@ow/data';
import { useBooks } from './Books.js';

export type LedgerState =
  | { readonly at: 'loading' }
  | { readonly at: 'failed'; readonly why: string }
  | { readonly at: 'ready'; readonly ledgers: Ledgers; readonly today: Date; readonly live: boolean };

const example: Ledgers = {
  sales: demoSalesInvoices(),
  purchases: demoPurchaseInvoices(),
  unreadable: [],
};

export function useLedgers(): LedgerState {
  const books = useBooks();
  const live = books.from === 'live';

  const query = useQuery({
    queryKey: ['ledgers', live ? books.shopId : 'example'],
    enabled: live,
    queryFn: async () => {
      if (!live) throw new Error('unreachable: the example books need no query');
      return readLedgers(books.shopId, new Date());
    },
  });

  // The example books are synchronous and always readable. Returning them
  // without a loading state is not a shortcut — there is nothing to wait for,
  // and a spinner over data that is already here is a lie about the link.
  if (!live) return { at: 'ready', ledgers: example, today: DEMO_TODAY, live: false };

  if (query.isPending) return { at: 'loading' };
  if (query.isError) {
    return {
      at: 'failed',
      why: query.error instanceof Error ? query.error.message : 'The books could not be read.',
    };
  }
  if (query.data.status === 'unavailable') return { at: 'failed', why: query.data.reason };

  return { at: 'ready', ledgers: query.data.value, today: new Date(), live: true };
}
