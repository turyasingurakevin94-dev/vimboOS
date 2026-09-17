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

/* -------------------------------------------------------------------------- *
 * jsonb
 * -------------------------------------------------------------------------- */

/**
 * `saved_quotes.payload` holds `items[]` and `payments[]` and is, in the
 * schema's own words, "not normalized yet". It has been written by several
 * versions of the old app, so a row can be any shape that code ever
 * produced.
 *
 * Reading it is therefore a parse, not a cast. `as Payload` would compile
 * and then hand a screen `undefined.length` in front of a customer.
 */
export interface OrderLine {
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: Derived<MoneyAmount>;
}

export interface ParsedPayload {
  readonly lines: readonly OrderLine[];
  /**
   * Lines that could not be read, in words.
   *
   * Named rather than dropped: an order whose total is computed from four of
   * its five lines is `partial`, and this is what it says is missing.
   */
  readonly unreadable: readonly string[];
}

export function readPayload(value: unknown, basis: string): ParsedPayload {
  if (value === null || typeof value !== 'object') {
    return { lines: [], unreadable: ['the order has no items recorded'] };
  }

  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items)) {
    return { lines: [], unreadable: ['the order has no items recorded'] };
  }

  const lines: OrderLine[] = [];
  const unreadable: string[] = [];

  items.forEach((raw, i) => {
    if (raw === null || typeof raw !== 'object') {
      unreadable.push(`line ${i + 1} is not readable`);
      return;
    }
    const row = raw as Record<string, unknown>;
    const name = readText(row.name) ?? `line ${i + 1}`;

    const qtyRaw = row.qty ?? row.quantity;
    const quantity = typeof qtyRaw === 'number' ? qtyRaw : Number(qtyRaw);
    if (!Number.isFinite(quantity)) {
      unreadable.push(`${name} has no quantity`);
      return;
    }

    lines.push({
      name,
      quantity,
      unitPrice: readMoney(row.price ?? row.unitPrice, `${name} price`, basis),
    });
  });

  return { lines, unreadable };
}
