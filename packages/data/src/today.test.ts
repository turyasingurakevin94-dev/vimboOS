/**
 * Today, off rows shaped like the shop's real ones.
 *
 * `readToday` is ten selects and an error check. What can be wrong is the
 * joining and the refusals: the shelf join by key, which stock_log rows end
 * a quiet run, that a charge never enters the margin, and that a table which
 * could not be read degrades the screen instead of sinking it.
 */

import { describe, expect, it } from 'vitest';
import { Money } from '@ow/domain';
import {
  assembleToday,
  deadLines,
  readCashDays,
  readCashTxns,
  readMarginLines,
  readShelfLines,
} from './today.js';

const NOW = new Date('2026-09-18T06:00:00Z');

describe('the shelf, joined by key', () => {
  it('values what stands on the shelf, not everything ever bought', () => {
    // The real books' own trap: two lots totalling 30 units bought, 10 left.
    const lines = readShelfLines(
      [{ key: 'p1', qty: 10 }],
      [
        { key: 'p1', qty: 20, cost: 1_000, consign: null },
        { key: 'p1', qty: 10, cost: 1_000, consign: null },
      ],
    );

    expect(lines).toEqual([
      {
        key: 'p1',
        onShelf: 10,
        lots: [
          { qty: 20, cost: 1_000, consign: null },
          { qty: 10, cost: 1_000, consign: null },
        ],
      },
    ]);
  });

  it('does not invent a line for lots whose shelf row has gone', () => {
    expect(readShelfLines([], [{ key: 'ghost', qty: 5, cost: 10, consign: null }])).toEqual([]);
  });

  it('keeps a missing cost missing rather than reading it as nothing', () => {
    const [line] = readShelfLines([{ key: 'p1', qty: 4 }], [{ key: 'p1', qty: 4, cost: null }]);

    expect(line?.lots[0]).toEqual({ qty: 4, cost: null, consign: null });
  });
});

describe('what has stopped selling', () => {
  const lines = readShelfLines(
    [
      { key: 'moves', qty: 5 },
      { key: 'quiet', qty: 5 },
      { key: 'never', qty: 5 },
      { key: 'empty', qty: 0 },
    ],
    [],
  );

  it('counts a line that has never sold as dead, and an empty shelf as neither', () => {
    const count = deadLines(
      lines,
      [
        { key: 'moves', type: 'sale', date: '2026-09-15' },
        { key: 'quiet', type: 'sale', date: '2026-01-02' },
      ],
      60,
      NOW,
    );

    // 'moves' sold this week; 'quiet' and 'never' are dead; 'empty' has
    // nothing on the shelf to be dead.
    expect(count).toBe(2);
  });

  it('does not let a restock or a count pass for a customer', () => {
    expect(
      deadLines(lines, [{ key: 'quiet', type: 'restock', date: '2026-09-17' }], 60, NOW),
    ).toBe(3);
  });

  it('says it cannot tell rather than saying nothing is dead', () => {
    expect(deadLines(lines, null, 60, NOW)).toBeNull();
  });
});

describe('the week’s margin', () => {
  const quote = (items: readonly unknown[], over: Record<string, unknown> = {}): unknown => ({
    id: 1,
    date: '2026-09-17',
    payload: { items, charges: [{ name: 'Transport', amount: 500_000, kind: 'charge' }] },
    ...over,
  });

  it('leaves a charge out of both sides, because it has no buying price', () => {
    // 10 × (12,000 − 10,000) kept on 10 × 12,000 sold. The 500,000 of
    // transport is revenue with no cost beside it; counting it as sold would
    // report it as pure margin.
    const m = readMarginLines([quote([{ qty: 10, sellPrice: 12_000, price: 10_000 }])]);

    expect(m.sold).toBe(Money.money(120_000));
    expect(m.kept).toBe(Money.money(20_000));
    expect(m.linesCounted).toBe(1);
    expect(m.linesWithoutCost).toBe(0);
  });

  it('counts a line with no buying price into what was sold and not what was kept', () => {
    const m = readMarginLines([quote([{ qty: 2, sellPrice: 5_000 }])]);

    expect(m.sold).toBe(Money.money(10_000));
    expect(m.kept).toBe(Money.ZERO);
    expect(m.linesWithoutCost).toBe(1);
  });

  it('ignores a voided sale', () => {
    const m = readMarginLines([quote([{ qty: 2, sellPrice: 5_000, price: 1_000 }], { voided: true })]);

    expect(m.linesCounted).toBe(0);
  });
});

describe('the cash rows', () => {
  it('names a movement it cannot read rather than netting it to nothing', () => {
    const notes: string[] = [];
    const txns = readCashTxns(
      [
        { id: 1, date: '2026-09-17', account: 'cash', type: 'receipt', amount: 40_000 },
        { id: 2, date: '2026-09-17', account: 'cash', type: 'receipt', amount: 'not a figure' },
        { id: 3, date: null, account: 'cash', type: 'receipt', amount: 10_000 },
      ],
      notes,
    );

    expect(txns).toHaveLength(1);
    expect(notes).toHaveLength(2);
  });

  it('reads an opening that was set apart from one that was not', () => {
    const days = readCashDays([
      { date: '2026-09-17', opening: { cash: 10 }, actual: null, opening_set: true },
      { date: '2026-09-16', opening: { cash: 10 }, actual: null, opening_set: false },
    ]);

    expect(days.map((d) => d.openingSet)).toEqual([true, false]);
  });
});

describe('assembling the screen', () => {
  const base = {
    customers: [],
    cashTxns: [],
    cashDays: [],
    purchases: [],
    sales: [],
    stock: [{ key: 'p1', qty: 4 }],
    lots: [{ key: 'p1', qty: 4, cost: 1_000, consign: null }],
    saleLog: [] as readonly unknown[] | null,
    moves: [] as readonly unknown[] | null,
    deadStockDays: 60 as number | null,
    now: NOW,
    notes: [] as readonly string[],
  };

  it('dates itself from the read rather than from a frozen string', () => {
    expect(assembleToday(base).asOf).toEqual(NOW);
  });

  it('will not put a figure on dead stock it cannot derive', () => {
    // The shop values dead stock at FIFO cost, which is not ported. A shelf
    // average here would disagree with the screen the owner already reads.
    expect(assembleToday(base).strip.stock.dead.status).toBe('unavailable');
  });

  it('counts the moves that are open, which is what the badge shows', () => {
    const books = assembleToday({ ...base, moves: [{ id: 1 }, { id: 2 }, { id: 3 }] });

    expect(books.openMoves).toBe(3);
    expect(books.wantsYou).toBeGreaterThanOrEqual(3);
  });

  it('says the moves are unknown rather than reporting none open', () => {
    const books = assembleToday({ ...base, moves: null });

    expect(books.openMoves).toBe(0);
    expect(books.unreadable).toContain('the manager’s moves could not be read');
  });

  it('admits when it had to assume how long a line stays quiet', () => {
    const books = assembleToday({ ...base, deadStockDays: null });

    expect(books.unreadable.some((u) => u.includes('has not set how long'))).toBe(true);
  });

  it('carries the shelf through to the strip', () => {
    expect(assembleToday(base).strip.stock.held).toMatchObject({
      status: 'known',
      value: Money.money(4_000),
    });
  });
});
