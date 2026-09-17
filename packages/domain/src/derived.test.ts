import { describe, expect, it } from 'vitest';
import * as D from './derived.js';

describe('the three states', () => {
  it('distinguishes a derived zero from an absent figure', () => {
    const zero = D.known(0, '14 invoices, Jan–Mar');
    const absent = D.unavailable<number>('no supplier price on file');

    expect(D.hasValue(zero)).toBe(true);
    expect(D.hasValue(absent)).toBe(false);
    // The bug this type exists to stop: absence read as zero.
    expect(D.valueOr(absent, 0)).toBe(0);
    expect(zero.value).toBe(0);
  });

  it('forces every render to handle all three', () => {
    const render = (d: D.Derived<number>): string =>
      D.match(d, {
        known: (v, basis) => `${v} (${basis})`,
        partial: (v, _b, missing) => `${v} — ${missing}`,
        unavailable: (reason) => `no figure: ${reason}`,
      });

    expect(render(D.known(12, 'books'))).toBe('12 (books)');
    expect(render(D.partial(12, 'books', '2 of 7 unpriced'))).toBe(
      '12 — 2 of 7 unpriced',
    );
    expect(render(D.unavailable('no cost on file'))).toBe(
      'no figure: no cost on file',
    );
  });
});

describe('map', () => {
  it('carries status and basis through a transform', () => {
    expect(D.map(D.known(2, 'b'), (n) => n * 10)).toEqual(D.known(20, 'b'));
    expect(D.map(D.partial(2, 'b', 'm'), (n) => n * 10)).toEqual(
      D.partial(20, 'b', 'm'),
    );
    expect(D.map(D.unavailable('r'), (n: number) => n * 10)).toEqual(
      D.unavailable('r'),
    );
  });
});

describe('combine — doubt is contagious', () => {
  it('is known only when every input is', () => {
    const margin = D.combine(
      [D.known(1000, 'sale'), D.known(700, 'cost')] as const,
      'sale less cost',
      (sale, cost) => sale - cost,
    );
    expect(margin).toEqual(D.known(300, 'sale less cost'));
  });

  it('is partial when any input is', () => {
    const margin = D.combine(
      [D.known(1000, 'sale'), D.partial(700, 'cost', '1 of 3 lots unpriced')] as const,
      'sale less cost',
      (sale, cost) => sale - cost,
    );
    expect(margin.status).toBe('partial');
    expect(margin).toMatchObject({ value: 300, missing: '1 of 3 lots unpriced' });
  });

  it('cannot be derived at all when an input is missing', () => {
    // The dashboard reporting a confident profit off a cost it never had.
    const margin = D.combine(
      [D.known(1000, 'sale'), D.unavailable('no cost on file')] as const,
      'sale less cost',
      (sale, cost) => sale - cost,
    );
    expect(margin).toEqual(D.unavailable('no cost on file'));
  });
});

describe('sumDerived — named rather than dropped', () => {
  const add = (a: number, b: number): number => a + b;
  const sum = (rows: D.Derived<number>[]): D.Derived<number> =>
    D.sumDerived(rows, 'column', add, 0);

  it('sums a clean column', () => {
    expect(sum([D.known(1, 'a'), D.known(2, 'a')])).toEqual(D.known(3, 'column'));
  });

  it('an empty column is a derived zero, not an absence', () => {
    expect(sum([])).toEqual(D.known(0, 'column'));
  });

  it('a column with gaps totals what it has, and says how many', () => {
    const total = sum([
      D.known(10, 'a'),
      D.unavailable('no price'),
      D.known(5, 'a'),
    ]);
    expect(total.status).toBe('partial');
    expect(total).toMatchObject({ value: 15 });
    expect((total as D.Partial_<number>).missing).toContain('2 of 3 rows');
    expect((total as D.Partial_<number>).missing).toContain('no price');
  });

  it('carries a partial row through into the total', () => {
    const total = sum([D.known(10, 'a'), D.partial(5, 'a', 'estimated')]);
    expect(total.status).toBe('partial');
    expect(total).toMatchObject({ value: 15 });
  });

  it('is unavailable when nothing at all could be derived', () => {
    const total = sum([D.unavailable('no price'), D.unavailable('no price')]);
    expect(total.status).toBe('unavailable');
    expect((total as D.Unavailable).reason).toContain('none of the 2 rows');
  });

  it('does not repeat the same reason once per row', () => {
    const total = sum([
      D.known(1, 'a'),
      D.unavailable('no price'),
      D.unavailable('no price'),
    ]);
    const missing = (total as D.Partial_<number>).missing;
    expect(missing.match(/no price/g)).toHaveLength(1);
  });
});
