/**
 * The Customers register, from whichever books are open.
 *
 * `chasesUnknown` is why this returns the whole `Register` rather than a
 * list: how many times an account has been chased, and whether that number
 * is knowable at all, are two different facts, and a screen that only
 * received the list would have to show a zero for both.
 */

import { demoCustomers, readRegister, type Register } from '@ow/data';
import { useBook, type Loaded } from './useBook.js';

export type RegisterState = Loaded<Register>;

const example = (): Register => ({
  customers: demoCustomers(),
  unreadable: [],
  // The demo accounts carry their own chase counts, and every one of them
  // is a real number in the frame.
  chasesUnknown: new Set<string>(),
});

export const useRegister = (): RegisterState => useBook('customers', readRegister, example);
