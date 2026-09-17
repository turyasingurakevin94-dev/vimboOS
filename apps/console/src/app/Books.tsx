/**
 * Where a screen's figures come from.
 *
 * Two sources, named rather than guessed at:
 *
 * - **live** — the shop's real books, through RLS, for the signed-in
 *   member's shop.
 * - **example** — the demo data every screen was built against, reached with
 *   `?demo=1`. Twenty-four of twenty-seven destinations still have no query,
 *   so this is how the work is reviewed.
 *
 * A screen asks `useBooks()` and gets one or the other. It never asks which
 * database it is talking to, and it never constructs a client.
 *
 * ## Why TanStack Query and not a `useEffect`
 *
 * CLAUDE.md names it, and the reason is in the brief: the person using this
 * is "often on a slow link". A retry policy, a cache that survives switching
 * screens, and a stale-while-revalidate read are the difference between a
 * yard with one bar and a spinner. A hand-rolled effect would be smaller and
 * would quietly not do any of that.
 */

import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@ow/data';

export type Books =
  | { readonly from: 'example' }
  | { readonly from: 'live'; readonly shopId: string; readonly session: Session };

const BooksContext = createContext<Books>({ from: 'example' });

export const useBooks = (): Books => useContext(BooksContext);

/**
 * One client for the application.
 *
 * `retry: 2` and a growing delay, because a failed read on a slow link is
 * usually the link. `staleTime` of a minute so moving between screens does
 * not re-fetch a register that has not changed — the old app's answer to
 * this was to hold the whole database in memory, which is the failure this
 * rewrite exists to undo, and no cache at all is the opposite mistake.
 */
const makeClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });

export function BooksProvider({
  session,
  children,
}: {
  /** `null` is example data — the demo route, or nobody signed in. */
  readonly session: Session | null;
  readonly children: ReactNode;
}): ReactElement {
  const client = useMemo(makeClient, []);
  const books = useMemo<Books>(
    () =>
      session?.shop == null
        ? { from: 'example' }
        : { from: 'live', shopId: session.shop.shopId, session },
    [session],
  );

  return (
    <QueryClientProvider client={client}>
      <BooksContext.Provider value={books}>{children}</BooksContext.Provider>
    </QueryClientProvider>
  );
}
