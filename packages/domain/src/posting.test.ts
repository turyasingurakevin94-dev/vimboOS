/**
 * What is worth telling the group about.
 *
 * Every threshold here is the shop's own — `deadStockDays`,
 * `targetMarginPct`, the `clearance` map — so these tests are about the
 * reading and never about a number chosen in the code. On this shop the
 * three derivable signals come to 42 nominations out of 396 things it can
 * say anything about: 26 margin, 15 idle, 1 cut.
 */

import { describe, expect, it } from 'vitest';
import { NOT_DERIVED, keptOnShelf, nominate, nominations, perDay, type Nominee, type PostingRules } from './posting.js';
import { NO_MARKUPS, type Lot, type PriceRow } from './catalogue.js';
import * as Money from './money.js';

const NOW = new Date('2026-09-18T09:00:00Z');

const rules = (over: Partial<PostingRules> = {}): PostingRules => ({
  deadAfterDays: 60,
  targetMarginPercent: 10,
  cuts: new Map(),
  ...over,
});

const price = (over: Partial<PriceRow> = {}): PriceRow => ({
  supplierId: 'S094',
  supplierName: 'Roto Industry',
  wholesale: null,
  retail: 10_000,
  unit: 'Pc',
  packUnit: '',
  packQty: 0,
  tiers: [],
  outOfStock: false,
  outOfStockSince: null,
  on: '2026-09-02',
  supplierSku: null,
  ...over,
});

const thing = (over: Partial<Nominee> = {}): Nominee => ({
  key: 'P044::1',
  code: 'HALFBEND',
  name: 'Soft Close Mulper — Half Bend',
  unit: 'Pc',
  prices: [price()],
  lots: [{ qty: 10, cost: 6_000, consign: null }] as readonly Lot[],
  counted: 10,
  markups: {
    ...NO_MARKUPS,
    retail: { kind: 'percent', value: 50, from: 'product' },
    stockRetail: { kind: 'percent', value: 50, from: 'product' },
  },
  soldInWindow: 0,
  windowDays: 60,
  ...over,
});

describe('how fast it moves', () => {
  it('is nothing a day when nothing sold — not a small number', () => {
    expect(perDay(0, 60)).toBe(0);
    expect(perDay(60, 60)).toBe(1);
    // No window is no rate, rather than a division by nothing.
    expect(perDay(10, 0)).toBe(0);
  });
});

describe('what the shop keeps on one off the shelf', () => {
  it('reads the price against what that stock cost', () => {
    // 6,000 on the shelf, +50% retail, so 9,000 — and a third of it kept.
    expect(keptOnShelf(thing())).toMatchObject({ status: 'known', value: 33 });
  });

  /**
   * A cost that is only an estimate of what replacing the thing would take
   * is not what it cost, and a margin read off it is a margin about a
   * purchase that never happened.
   */
  it('has no margin where the cost is not settled', () => {
    expect(keptOnShelf(thing({ lots: [{ qty: 10, cost: null, consign: null }] })).status).toBe(
      'unavailable',
    );
    expect(keptOnShelf(thing({ lots: [] })).status).toBe('unavailable');
  });

  it('has no margin where nothing says what to charge', () => {
    expect(keptOnShelf(thing({ markups: NO_MARKUPS })).status).toBe('unavailable');
  });
});

describe('the three signals the books support', () => {
  /** A fact about a decision somebody took, not a reading of a trend. */
  it('names a price the shop has cut, and how long ago', () => {
    const cut = rules({
      cuts: new Map([['P044::1', { price: Money.money(4_500), setOn: new Date('2026-08-30T00:00:00Z') }]]),
    });
    const one = nominate(thing({ soldInWindow: 20 }), cut, NOW);

    expect(one?.post.signal).toBe('price-cut');
    expect(one?.post.sellPrice).toBe(4_500);
    expect(one?.post.why).toBe('cut to 4,500 from 9,000 · 19 days ago');
    // Half off, and the weight is how deep the cut is.
    expect(one?.weight).toBeCloseTo(0.5);
  });

  /**
   * Sixty days is the shop's own `deadStockDays`, not a number chosen here.
   */
  it('calls stock idle by the shop’s own definition of the word', () => {
    expect(nominate(thing(), rules(), NOW)?.post.signal).toBe('idle-stock');
    // A shorter window than the shop's own cannot answer the question.
    expect(nominate(thing({ windowDays: 30 }), rules(), NOW)).toBeNull();
    // And something that moved is not idle.
    expect(nominate(thing({ soldInWindow: 1 }), rules(), NOW)?.post.signal).not.toBe('idle-stock');
  });

  it('weighs idle stock by the money standing still, not the count', () => {
    const many = nominate(thing({ counted: 50, lots: [{ qty: 50, cost: 450, consign: null }] }), rules(), NOW);
    const few = nominate(thing({ counted: 10, lots: [{ qty: 10, cost: 6_000, consign: null }] }), rules(), NOW);

    // Fifty at 450 is 22,500; ten at 6,000 is 60,000.
    expect(many?.weight).toBe(22_500);
    expect(few?.weight).toBe(60_000);
    expect(few?.post.why).toContain('60,000 standing still');
  });

  it('pushes what keeps well over what the shop aims at', () => {
    const one = nominate(thing({ soldInWindow: 200 }), rules(), NOW);

    expect(one?.post.signal).toBe('margin');
    expect(one?.post.why).toContain('keeps 33% against the 10% you aim at');
    // 9,000 less 6,000, over 200 sold.
    expect(one?.weight).toBe(600_000);
  });

  it('says nothing about something that only just clears the target', () => {
    const thin = thing({
      soldInWindow: 200,
      markups: { ...NO_MARKUPS, retail: { kind: 'percent', value: 5, from: 'product' }, stockRetail: { kind: 'percent', value: 5, from: 'product' } },
    });
    // 6,000 +5% is 6,300, which keeps 5% — under the 10% aimed at.
    expect(nominate(thin, rules(), NOW)).toBeNull();
  });

  /** One message about one thing, however many reasons it has. */
  it('nominates a thing once, on the hardest evidence it has', () => {
    const both = thing({
      soldInWindow: 200,
      lots: [{ qty: 10, cost: 6_000, consign: null }],
    });
    const cut = rules({
      cuts: new Map([['P044::1', { price: Money.money(4_500), setOn: NOW }]]),
    });

    // It would qualify on margin too; the cut is the harder fact.
    expect(nominate(both, cut, NOW)?.post.signal).toBe('price-cut');
  });
});

describe('the chip ranks, rather than saturating', () => {
  /**
   * Scaled against a constant chosen in the code it saturated: on this shop
   * twenty-six margin rows all came out at 1 and the list fell back to
   * alphabetical — a screw selling ten beside a screw selling 262,
   * indistinguishable.
   */
  it('makes the strongest of each signal a 1 and the rest a share of it', () => {
    const posts = nominations(
      [
        thing({ key: 'a', name: 'Big earner', soldInWindow: 200 }),
        thing({ key: 'b', name: 'Small earner', soldInWindow: 50 }),
        thing({ key: 'c', name: 'Idle thing' }),
      ],
      rules(),
      NOW,
    );

    expect(posts.map((p) => p.product)).toEqual(['Big earner', 'Idle thing', 'Small earner']);
    expect(posts.map((p) => p.strength)).toEqual([1, 1, 0.25]);
  });

  it('keeps one order when two rows are equally strong', () => {
    const posts = nominations(
      [thing({ key: 'b', name: 'Zeta' }), thing({ key: 'a', name: 'Alpha' })],
      rules(),
      NOW,
    );
    expect(posts.map((p) => p.product)).toEqual(['Alpha', 'Zeta']);
  });
});

describe('the two it will not invent', () => {
  it('names them, and what each would take', () => {
    expect(NOT_DERIVED.map((n) => n.signal)).toEqual(['goes-together', 'season-starting']);
    expect(NOT_DERIVED[0]?.needs).toContain('leave together');
    expect(NOT_DERIVED[1]?.needs).toContain('seasonal');
  });
});
