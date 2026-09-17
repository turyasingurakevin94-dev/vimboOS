import { describe, expect, it } from 'vitest';
import { readDate, readMoney, readPayload, readText } from './boundary.js';
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

describe('readPayload — the untyped jsonb the old app wrote for years', () => {
  it('reads a well-formed order', () => {
    const p = readPayload(
      { items: [{ name: 'Iron sheets', qty: 40, price: '12400' }] },
      'order',
    );
    expect(p.unreadable).toEqual([]);
    expect(p.lines).toHaveLength(1);
    expect(p.lines[0]).toMatchObject({ name: 'Iron sheets', quantity: 40 });
    expect(p.lines[0]?.unitPrice).toMatchObject({ status: 'known', value: 12_400 });
  });

  it('accepts both field spellings the old app used', () => {
    const p = readPayload(
      { items: [{ name: 'Cement', quantity: 120, unitPrice: 31000 }] },
      'order',
    );
    expect(p.lines[0]).toMatchObject({ quantity: 120 });
    expect(p.lines[0]?.unitPrice).toMatchObject({ status: 'known', value: 31_000 });
  });

  it('names what it could not read instead of dropping it', () => {
    const p = readPayload(
      {
        items: [
          { name: 'Iron sheets', qty: 40, price: '12400' },
          { name: 'Mystery item' }, // no quantity
          null,
        ],
      },
      'order',
    );
    expect(p.lines).toHaveLength(1);
    expect(p.unreadable).toHaveLength(2);
    expect(p.unreadable[0]).toContain('Mystery item');
    expect(p.unreadable[1]).toContain('line 3');
  });

  it('keeps a line whose price is unreadable, with the price unavailable', () => {
    // The line is real and belongs on the order. Only its price is missing,
    // and the total built from it will be partial rather than wrong.
    const p = readPayload({ items: [{ name: 'Nails', qty: 6, price: null }] }, 'order');
    expect(p.lines).toHaveLength(1);
    expect(p.lines[0]?.unitPrice.status).toBe('unavailable');
  });

  it('says so when there is nothing to read at all', () => {
    for (const junk of [null, undefined, {}, { items: 'nope' }, 'string']) {
      const p = readPayload(junk, 'order');
      expect(p.lines).toEqual([]);
      expect(p.unreadable).toHaveLength(1);
    }
  });
});
