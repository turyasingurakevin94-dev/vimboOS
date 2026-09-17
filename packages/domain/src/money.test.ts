import { describe, expect, it } from 'vitest';
import * as M from './money.js';

const m = M.money;

describe('money()', () => {
  it('takes whole shillings', () => {
    expect(m(1_240_000)).toBe(1_240_000);
    expect(m(0)).toBe(0);
    expect(m(-500)).toBe(-500);
  });

  it('refuses a fraction rather than rounding behind the caller', () => {
    expect(() => m(333.33)).toThrow(M.MoneyError);
    expect(() => m(1000 / 3)).toThrow(/not a whole shilling/);
  });

  it('refuses NaN and Infinity, which is how a bad divide arrives', () => {
    expect(() => m(NaN)).toThrow(M.MoneyError);
    expect(() => m(Infinity)).toThrow(M.MoneyError);
  });

  it('refuses figures past the safe integer range', () => {
    expect(() => m(Number.MAX_SAFE_INTEGER + 2)).toThrow(/safe integer/);
  });
});

describe('rounding', () => {
  it('rounds toward and away from zero, symmetrically for negatives', () => {
    expect(M.roundDown(333.9)).toBe(333);
    expect(M.roundUp(333.1)).toBe(334);
    expect(M.roundDown(-333.9)).toBe(-333);
    expect(M.roundUp(-333.1)).toBe(-334);
  });

  it('rounds to a step, for price lists that end in 00', () => {
    expect(M.roundTo(m(12_345), 100)).toBe(12_300);
    expect(M.roundTo(m(12_355), 100)).toBe(12_400);
    expect(() => M.roundTo(m(100), 0)).toThrow(M.MoneyError);
  });
});

describe('arithmetic', () => {
  it('adds and subtracts', () => {
    expect(M.add(m(1000), m(240), m(7))).toBe(1247);
    expect(M.subtract(m(1000), m(1240))).toBe(-240);
    expect(M.add()).toBe(0);
  });

  it('multiplies by a fractional quantity, saying how it lands', () => {
    // 2.5 metres of pipe at 4,999 a metre.
    expect(M.times(m(4_999), 2.5)).toBe(12_498); // 12497.5 → nearest
    expect(M.times(m(4_999), 2.5, 'down')).toBe(12_497);
    expect(M.times(m(4_999), 2.5, 'up')).toBe(12_498);
  });

  it('takes a percentage', () => {
    expect(M.percent(m(1_000_000), 12.5)).toBe(125_000);
    expect(M.percent(m(999), 10, 'up')).toBe(100);
    expect(M.percent(m(999), 10, 'down')).toBe(99);
  });
});

describe('allocate — the shilling is never lost', () => {
  it('splits evenly when it can', () => {
    expect(M.allocate(m(900), 3)).toEqual([300, 300, 300]);
  });

  it('hands out the remainder instead of rounding it away', () => {
    expect(M.allocate(m(1000), 3)).toEqual([334, 333, 333]);
    expect(M.allocate(m(1000), 3).reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('keeps the sum exact for negatives too', () => {
    const parts = M.allocate(m(-1000), 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-1000);
  });

  it('holds for every split of every total up to a point', () => {
    for (let total = 0; total < 200; total++) {
      for (let parts = 1; parts <= 7; parts++) {
        const sum = M.allocate(m(total), parts).reduce((a, b) => a + b, 0);
        expect(sum).toBe(total);
      }
    }
  });

  it('refuses a nonsense part count', () => {
    expect(() => M.allocate(m(100), 0)).toThrow(M.MoneyError);
    expect(() => M.allocate(m(100), 2.5)).toThrow(M.MoneyError);
  });
});

describe('allocateBy — proportional, and still exact', () => {
  it('splits by weight', () => {
    expect(M.allocateBy(m(1000), [1, 1, 2])).toEqual([250, 250, 500]);
  });

  it('gives the odd shilling to the largest weight', () => {
    const parts = M.allocateBy(m(1000), [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('sums exactly across awkward weights', () => {
    const weights = [3, 7, 11, 1];
    for (let total = 0; total < 300; total++) {
      const sum = M.allocateBy(m(total), weights).reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
    }
  });

  it('falls back to an even split when every weight is zero', () => {
    expect(M.allocateBy(m(900), [0, 0, 0])).toEqual([300, 300, 300]);
  });

  it('refuses no weights, or a negative one', () => {
    expect(() => M.allocateBy(m(100), [])).toThrow(M.MoneyError);
    expect(() => M.allocateBy(m(100), [1, -1])).toThrow(M.MoneyError);
  });
});

describe('format', () => {
  it('groups thousands and carries no unit of its own', () => {
    expect(M.format(m(1_240_000))).toBe('1,240,000');
    expect(M.format(m(0))).toBe('0');
    expect(M.format(m(-5_000))).toBe('-5,000');
  });

  it('compacts only for chrome', () => {
    expect(M.formatCompact(m(999))).toBe('999');
    expect(M.formatCompact(m(12_400))).toBe('12k');
    expect(M.formatCompact(m(1_240_000))).toBe('1.2m');
  });
});

describe('parse — a misread price is a wrong price', () => {
  it('takes the separators people actually type', () => {
    expect(M.parse('1,240,000')).toBe(1_240_000);
    expect(M.parse('1 240 000')).toBe(1_240_000);
    expect(M.parse('  4999 ')).toBe(4999);
    expect(M.parse('-500')).toBe(-500);
  });

  it('refuses rather than guessing', () => {
    expect(M.parse('')).toBeNull();
    expect(M.parse('12.50')).toBeNull();
    expect(M.parse('UGX 1000')).toBeNull();
    expect(M.parse('1e6')).toBeNull();
    expect(M.parse('abc')).toBeNull();
  });
});
