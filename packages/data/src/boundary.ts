/**
 * The boundary.
 *
 * Everything in `@ow/domain` is guaranteed: a `Money` is a whole number of
 * shillings, a `Derived` knows whether it can be trusted. None of that is
 * true of a row coming off the wire. `customers.debt` is a Postgres
 * `numeric`, which PostgREST hands over as a **string** to avoid the
 * precision loss `JSON.parse` would cause — and `saved_quotes.payload` is
 * untyped `jsonb` that the old app wrote by hand for years.
 *
 * So this file is the only place in the application allowed to turn
 * `unknown` into a domain type, and it is the reason the guarantees hold
 * anywhere else. Every function here either produces a value the domain
 * vouches for, or says in words why it could not.
 *
 * The rule it exists to enforce: **a row that cannot be read is reported,
 * never rounded, and never silently zero.** The old app's `Number(row.debt)
 * || 0` turned a malformed figure and a genuinely-owed nothing into the same
 * screen.
 */

import {
  Money,
  known,
  unavailable,
  type Derived,
  type MoneyAmount,
} from '@ow/domain';

/**
 * Read a Postgres `numeric` money column.
 *
 * Accepts the string PostgREST actually sends, and the number it sends for
 * an `int`/`float8` column. Refuses anything that is not a whole shilling,
 * by name, so the screen can say which row is wrong instead of showing a
 * figure that is quietly 0.6 shillings out.
 */
export function readMoney(
  value: unknown,
  field: string,
  basis: string,
): Derived<MoneyAmount> {
  if (value === null || value === undefined) {
    return unavailable(`${field} is not set`);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return unavailable(`${field} is not a number`);
    if (!Number.isInteger(value)) {
      return unavailable(`${field} is ${value}, not a whole shilling`);
    }
    return known(Money.money(value), basis);
  }

  if (typeof value !== 'string') {
    return unavailable(`${field} came back as ${typeof value}, not a figure`);
  }

  const trimmed = value.trim();
  if (trimmed === '') return unavailable(`${field} is empty`);

  // Postgres renders numeric(12,2) as "1240000.00". A zero fraction is the
  // column's scale, not a real sub-shilling amount, so it is safe to drop —
  // but a NON-zero fraction is real data this app cannot represent, and
  // saying so is the whole point.
  const match = /^(-?\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (match === null) {
    return unavailable(`${field} is "${value}", which is not a figure`);
  }

  const [, whole, fraction] = match;
  if (fraction !== undefined && /[1-9]/.test(fraction)) {
    return unavailable(`${field} is ${trimmed}, not a whole shilling`);
  }

  const n = Number(whole);
  if (!Number.isSafeInteger(n)) {
    return unavailable(`${field} is ${trimmed}, past what can be counted exactly`);
  }

  return known(Money.money(n), basis);
}

/** Read a column that must be a non-empty string. */
export function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Read a `date` or `timestamptz` column.
 * Returns null rather than an Invalid Date, which renders as the literal
 * string "Invalid Date" and has shipped in more apps than anyone admits.
 */
export function readDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const readBool = (value: unknown): boolean => value === true;

/**
 * `saved_quotes.payload` used to be read here, from a guessed shape. It is
 * read in `savedQuotes.ts` now, from the old app's own writer — the guess
 * had the wrong keys and would have shown the shop's BUYING price as what
 * the customer was charged.
 */
