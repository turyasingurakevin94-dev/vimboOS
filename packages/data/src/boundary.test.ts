import { describe, expect, it } from 'vitest';
import { readDate, readMoney, readText } from './boundary.js';
import type { Unavailable } from '@ow/domain';

const why = (d: { status: string }): string => (d as Unavailable).reason;

describe('readMoney — a row that cannot be read is reported, never rounded', () => {
  it('reads the string PostgREST actually sends for a numeric column', () => {
    // numeric is sent as a string so JSON.parse cannot lose precision on it.
    expect(readMoney('1240000', 'debt', 'b')).toMatchObject({
      status: 'known',
      value: 1_240_000,
    });
  });

  it('drops a zero fraction, which is the column scale and not data', () => {
    expect(readMoney('1240000.00', 'debt', 'b')).toMatchObject({
      status: 'known',
      value: 1_240_000,
    });
    expect(readMoney('0.0', 'debt', 'b')).toMatchObject({ status: 'known', value: 0 });
  });

  it('refuses a real fraction by name — it is data this app cannot hold', () => {
    const d = readMoney('1240000.50', 'debt', 'b');
    expect(d.status).toBe('unavailable');
    expect(why(d)).toContain('debt');
    expect(why(d)).toContain('not a whole shilling');
  });

  it('reads a plain number column too', () => {
    expect(readMoney(4500, 'amount', 'b')).toMatchObject({ status: 'known', value: 4500 });
    expect(readMoney(-500, 'amount', 'b')).toMatchObject({ status: 'known', value: -500 });
  });

  it('distinguishes an unset column from a zero', () => {
    // The bug this whole file exists to stop: `Number(row.debt) || 0`.
    expect(readMoney(null, 'debt', 'b').status).toBe('unavailable');
    expect(readMoney(undefined, 'debt', 'b').status).toBe('unavailable');
    expect(readMoney('0', 'debt', 'b')).toMatchObject({ status: 'known', value: 0 });
  });

  it('refuses junk rather than coercing it', () => {
    const junk: readonly [string, unknown][] = [
      ['empty', ''],
      ['blank', '  '],
      ['letters', 'abc'],
      ['exponent', '1e6'],
      ['grouped', '1,240,000'],
      ['hex', '0x10'],
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['an object', {}],
      ['an array', []],
    ];
    for (const [label, value] of junk) {
      expect(readMoney(value, 'debt', 'b').status, label).toBe('unavailable');
    }
  });

  it('refuses a figure past exact counting', () => {
    const d = readMoney('99999999999999999999', 'debt', 'b');
    expect(d.status).toBe('unavailable');
    expect(why(d)).toContain('exactly');
  });

  it('names the field, so the screen can say which row is wrong', () => {
    expect(why(readMoney(null, 'customers.debt', 'b'))).toContain('customers.debt');
  });
});

describe('readText', () => {
  it('returns null for absent or blank, never an empty string', () => {
    expect(readText(null)).toBeNull();
    expect(readText('')).toBeNull();
    expect(readText('   ')).toBeNull();
    expect(readText(42)).toBeNull();
    expect(readText('  Kato Construction Ltd ')).toBe('Kato Construction Ltd');
  });
});

describe('readDate', () => {
  it('reads a date and a timestamptz', () => {
    expect(readDate('2026-09-17')?.getUTCFullYear()).toBe(2026);
    expect(readDate('2026-09-17T14:20:00Z')?.getUTCHours()).toBe(14);
  });

  it('returns null rather than an Invalid Date', () => {
    // "Invalid Date" is a string that renders, and it has shipped in more
    // apps than anyone admits.
    expect(readDate('not a date')).toBeNull();
    expect(readDate(null)).toBeNull();
  });
});
