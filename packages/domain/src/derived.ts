/**
 * Derived, never invented.
 *
 * The house law is that every figure on screen comes from the books, and a
 * screen that cannot derive a number says so instead of showing one. In the
 * old app that law lived in a document, which meant it held right up until
 * someone wrote `total || 0` — and a missing supplier price silently became
 * a margin of 100%.
 *
 * Here it is a type. A figure is `known`, `partial` or `unavailable`, and
 * there is no way to read the value without having said what happens in the
 * other two cases. `0` is a figure the books produced. Absence is not zero.
 *
 * Every variant carries its **basis** — the one line that says where the
 * number came from ("14 invoices, Jan–Mar"). The design system renders it
 * under the figure, so a number on screen can always be interrogated.
 */

export type Derived<T> =
  | Known<T>
  | Partial_<T>
  | Unavailable;

export interface Known<T> {
  readonly status: 'known';
  readonly value: T;
  /** Where the figure came from. Shown under it. */
  readonly basis: string;
}

/**
 * A figure computed from data known to be incomplete. It is still the best
 * reading available and is worth showing — but it is never shown bare.
 * `missing` names what was left out, because "named rather than dropped".
 */
export interface Partial_<T> {
  readonly status: 'partial';
  readonly value: T;
  readonly basis: string;
  /** What could not be included, in words. "2 of 7 suppliers unpriced". */
  readonly missing: string;
}

export interface Unavailable {
  readonly status: 'unavailable';
  /** Why, in words a shop owner can act on. Never "error" or "N/A". */
  readonly reason: string;
}

/* --------------------------------- builders ------------------------------ */

export const known = <T>(value: T, basis: string): Known<T> => ({
  status: 'known',
  value,
  basis,
});

export const partial = <T>(
  value: T,
  basis: string,
  missing: string,
): Partial_<T> => ({ status: 'partial', value, basis, missing });

/**
 * The type parameter is what the figure *would* have been. It defaults to
 * `never`, which is assignable to anything, so an unannotated `unavailable`
 * still slots into any `Derived<T>`. Annotate it —
 * `unavailable<Money>('no cost on file')` — when it is the only input to a
 * {@link combine} and there is nothing else for the compiler to infer from.
 */
export const unavailable = <T = never>(reason: string): Derived<T> => ({
  status: 'unavailable',
  reason,
});

/* --------------------------------- reading ------------------------------- */

export const hasValue = <T>(d: Derived<T>): d is Known<T> | Partial_<T> =>
  d.status !== 'unavailable';

/**
 * Read the value, or fall back. Named this way on purpose: every call site
 * reads as a decision to substitute something the books did not produce, so
 * it is greppable in review. Prefer {@link match} in anything that renders.
 */
export const valueOr = <T>(d: Derived<T>, fallback: T): T =>
  hasValue(d) ? d.value : fallback;

/** Exhaustive read. This is what UI uses; the compiler enforces all three. */
export function match<T, R>(
  d: Derived<T>,
  on: {
    known: (value: T, basis: string) => R;
    partial: (value: T, basis: string, missing: string) => R;
    unavailable: (reason: string) => R;
  },
): R {
  switch (d.status) {
    case 'known':
      return on.known(d.value, d.basis);
    case 'partial':
      return on.partial(d.value, d.basis, d.missing);
    case 'unavailable':
      return on.unavailable(d.reason);
  }
}

/* -------------------------------- combining ------------------------------ */

/** Transform the value, carrying status and basis through untouched. */
export function map<T, R>(d: Derived<T>, f: (value: T) => R): Derived<R> {
  switch (d.status) {
    case 'known':
      return known(f(d.value), d.basis);
    case 'partial':
      return partial(f(d.value), d.basis, d.missing);
    case 'unavailable':
      return d;
  }
}

/**
 * Combine several figures into one.
 *
 * Doubt is contagious, and that is the point: a total built from a partial
 * input is itself partial, and a total missing an input cannot be derived at
 * all. This is the rule that stops a dashboard reporting a confident profit
 * off a cost it never had.
 */
export function combine<T extends readonly unknown[], R>(
  parts: { readonly [K in keyof T]: Derived<T[K]> },
  basis: string,
  f: (...values: T) => R,
): Derived<R> {
  const missing: string[] = [];
  const values: unknown[] = [];

  for (const part of parts as readonly Derived<unknown>[]) {
    if (part.status === 'unavailable') return unavailable(part.reason);
    if (part.status === 'partial') missing.push(part.missing);
    values.push(part.value);
  }

  const value = f(...(values as unknown as T));
  return missing.length > 0
    ? partial(value, basis, missing.join('; '))
    : known(value, basis);
}

/**
 * Sum a column that may have gaps.
 *
 * A total over rows where some rows could not be derived is `partial`, never
 * `known` — the figure is real but it is not the whole column, and the screen
 * has to say which. This is the single most common shape in the app: money
 * owed, stock on hand, margin by product.
 */
export function sumDerived<T>(
  rows: readonly Derived<T>[],
  basis: string,
  add: (a: T, b: T) => T,
  empty: T,
): Derived<T> {
  if (rows.length === 0) return known(empty, basis);

  let total = empty;
  let counted = 0;
  const gaps: string[] = [];

  for (const row of rows) {
    if (row.status === 'unavailable') {
      gaps.push(row.reason);
      continue;
    }
    total = add(total, row.value);
    counted += 1;
    if (row.status === 'partial') gaps.push(row.missing);
  }

  if (counted === 0) {
    return unavailable(
      `none of the ${rows.length} rows could be derived: ${unique(gaps).join('; ')}`,
    );
  }
  if (gaps.length === 0) return known(total, basis);

  return partial(
    total,
    basis,
    `${counted} of ${rows.length} rows — ${unique(gaps).join('; ')}`,
  );
}

const unique = (xs: readonly string[]): string[] => [...new Set(xs)];
