/**
 * Money.
 *
 * The shop trades in Ugandan shillings. UGX has no subunit in practice —
 * nobody prices in cents — so a figure is a whole number of shillings and
 * anything else is a bug. That is the entire reason this type exists: the
 * old app held money in plain `number`, and a plain number accepts
 * `total / 3` without complaint, which is how a split of 1,000 across three
 * orders became three lots of 333.333333 and a penny that belonged to
 * nobody.
 *
 * `Money` is a branded integer. You cannot make one by accident, you cannot
 * do arithmetic on it with `+`, and every operation that could produce a
 * fraction is forced to say what it does with the remainder.
 */

declare const MoneyBrand: unique symbol;

/** A whole number of Ugandan shillings. Construct with {@link money}. */
export type Money = number & { readonly [MoneyBrand]: 'UGX' };

export const ZERO = 0 as Money;

/** Thrown when a figure cannot be represented exactly. Never swallowed. */
export class MoneyError extends Error {
  override readonly name = 'MoneyError';
}

/**
 * Build a Money from a whole number of shillings.
 * Throws on a fraction rather than rounding: a caller that wants rounding
 * has to choose a direction, in the open, at the point it matters.
 */
export function money(shillings: number): Money {
  if (!Number.isFinite(shillings)) {
    throw new MoneyError(`not a finite figure: ${shillings}`);
  }
  if (!Number.isInteger(shillings)) {
    throw new MoneyError(
      `${shillings} is not a whole shilling — round it deliberately with roundDown/roundUp/roundTo`,
    );
  }
  if (!Number.isSafeInteger(shillings)) {
    throw new MoneyError(`${shillings} is past the safe integer range`);
  }
  return shillings as Money;
}

/** Round a possibly-fractional figure toward zero. */
export const roundDown = (shillings: number): Money => money(Math.trunc(shillings));

/** Round a possibly-fractional figure away from zero. */
export const roundUp = (shillings: number): Money =>
  money(shillings < 0 ? -Math.ceil(-shillings) : Math.ceil(shillings));

/** Round to the nearest `step` shillings — for price lists that end in 00. */
export function roundTo(amount: Money, step: number): Money {
  if (!Number.isInteger(step) || step <= 0) {
    throw new MoneyError(`step must be a positive whole number, got ${step}`);
  }
  return money(Math.round(amount / step) * step);
}

/* ---------------------------------- arithmetic --------------------------- */

export const add = (...amounts: readonly Money[]): Money =>
  money(amounts.reduce<number>((a, b) => a + b, 0));

export const subtract = (a: Money, b: Money): Money => money(a - b);

export const negate = (a: Money): Money => subtract(ZERO, a);

export const abs = (a: Money): Money => money(Math.abs(a));

/**
 * Multiply by a count. The count may be fractional — 2.5 metres of pipe is a
 * real line on a real invoice — so the caller says how to land on a shilling.
 */
export function times(
  amount: Money,
  quantity: number,
  rounding: Rounding = 'nearest',
): Money {
  if (!Number.isFinite(quantity)) {
    throw new MoneyError(`quantity must be finite, got ${quantity}`);
  }
  return applyRounding(amount * quantity, rounding);
}

/** Take a percentage. `percent(money(1000), 12.5)` is 125. */
export const percent = (
  amount: Money,
  pct: number,
  rounding: Rounding = 'nearest',
): Money => applyRounding((amount * pct) / 100, rounding);

export type Rounding = 'nearest' | 'down' | 'up';

function applyRounding(value: number, rounding: Rounding): Money {
  switch (rounding) {
    case 'nearest':
      return money(Math.round(value));
    case 'down':
      return roundDown(value);
    case 'up':
      return roundUp(value);
  }
}

/**
 * Split an amount into `parts` shares that sum **exactly** back to it.
 *
 * The remainder is handed out one shilling at a time from the front rather
 * than rounded away, so `allocate(money(1000), 3)` is `[334, 333, 333]` and
 * not three 333s with a shilling missing. Any screen that divides money —
 * a delivery cost across the orders on a run, a payment across invoices —
 * goes through here.
 */
export function allocate(amount: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new MoneyError(`parts must be a positive whole number, got ${parts}`);
  }
  const sign = amount < 0 ? -1 : 1;
  const total = Math.abs(amount);
  const base = Math.floor(total / parts);
  let remainder = total - base * parts;

  return Array.from({ length: parts }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return money(sign * (base + extra));
  });
}

/**
 * Split an amount in proportion to `weights`, summing exactly back to it.
 * Used for costs that are not shared equally — a run's fuel across orders
 * by value, a bulk discount across lines.
 */
export function allocateBy(amount: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) {
    throw new MoneyError('allocateBy needs at least one weight');
  }
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new MoneyError('weights must be finite and non-negative');
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return allocate(amount, weights.length);

  const shares = weights.map((w) => Math.floor((amount * w) / totalWeight));
  let remainder = amount - shares.reduce((a, b) => a + b, 0);

  // Hand the remainder to the largest weights first — the shilling belongs
  // where the most value is, not wherever the array happened to start.
  const order = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w)
    .map(({ i }) => i);

  const step = remainder < 0 ? -1 : 1;
  for (const i of order) {
    if (remainder === 0) break;
    shares[i] = (shares[i] ?? 0) + step;
    remainder -= step;
  }
  return shares.map(money);
}

/* ---------------------------------- reading ------------------------------ */

export const isZero = (a: Money): boolean => a === 0;
export const isNegative = (a: Money): boolean => a < 0;
export const compare = (a: Money, b: Money): number => a - b;
export const max = (...a: readonly Money[]): Money => money(Math.max(...a));
export const min = (...a: readonly Money[]): Money => money(Math.min(...a));

/**
 * Format for display: grouped thousands, no decimals, no currency word.
 *
 * The unit is not baked in because the design system puts the figure and its
 * unit in a fixed relationship that the *component* owns — see the money
 * component in @ow/design. A figure that carries its own "UGX" cannot be
 * right-aligned in a column with the others.
 */
export const format = (amount: Money): string =>
  new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(amount);

/** Compact form for tight chrome only — never for a figure being acted on. */
export function formatCompact(amount: Money): string {
  const n = Math.abs(amount);
  if (n < 1_000) return format(amount);
  if (n < 1_000_000) return `${trim(amount / 1_000)}k`;
  return `${trim(amount / 1_000_000)}m`;
}

const trim = (n: number): string =>
  (Math.round(n * 10) / 10).toFixed(Math.abs(n) < 10 ? 1 : 0);

/**
 * Read a figure a person typed. Accepts the separators people actually use
 * ("1,240,000", "1 240 000") and refuses anything else rather than guessing —
 * a silently misread price is a wrong price.
 */
export function parse(input: string): Money | null {
  const cleaned = input.trim().replace(/[\s,]/g, '');
  if (cleaned === '' || !/^-?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? money(n) : null;
}
