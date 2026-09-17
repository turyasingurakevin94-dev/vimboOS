/**
 * The Invoices register, from whichever books are open.
 *
 * The three-way answer and the reason for it live in `useBook`; this names
 * the question and where the example rows come from.
 */

import { demoPurchaseInvoices, demoSalesInvoices, readLedgers, type Ledgers } from '@ow/data';
import { useBook, type Loaded } from './useBook.js';

export type LedgerState = Loaded<Ledgers>;

const example = (): Ledgers => ({
  sales: demoSalesInvoices(),
  purchases: demoPurchaseInvoices(),
  unreadable: [],
});

export const useLedgers = (): LedgerState => useBook('ledgers', readLedgers, example);
