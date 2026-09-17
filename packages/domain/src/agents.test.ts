/**
 * The rules, tested away from any data the screen happens to hold.
 *
 * Three of these are the handoff's own claims, and they are the ones worth
 * breaking a build over: the owed figure is the shop price, commission is
 * read rather than recomputed, and a figure that cannot be derived is not
 * zero.
 */

import { describe, expect, it } from 'vitest';
import {
  CLUSTER_WAIT_DAYS,
  HOLD_WORDS,
  behind,
  clusterReads,
  commission,
  creditReads,
  cycle,
  everythingOwed,
  groups,
  keptPercent,
  keptReads,
  leftOwing,
  millions,
  owes,
  position,
  settlementReads,
  settlementTotal,
  spanFor,
  waitingReads,
  waterfall,
  type Agent,
  type AgentOrder,
  type Counter,
} from './agents.js';
import * as Money from './money.js';

const NOW = new Date(Date.UTC(2026, 8, 15));
const m = Money.money;
const span = spanFor('month', NOW);

const order = (o: Partial<AgentOrder> & { readonly doc: string }): AgentOrder => ({
  taken: new Date(Date.UTC(2026, 8, 4)),
  delivered: new Date(Date.UTC(2026, 8, 5)),
  where: 'Ndeeba',
  shopPrice: m(400_000),
  cost: m(350_000),
  hisPrice: m(480_000),
  outstanding: Money.ZERO,
  settled: true,
  bonus: Money.ZERO,
  voided: false,
  ...o,
});

const agent = (o: Partial<Agent> = {}): Agent => ({
  id: 'a',
  name: 'Wasswa Mugisha',
  since: new Date(Date.UTC(2025, 0, 14)),
  round: 'Ndeeba',
  terms: 'credit',
  ceiling: m(2_000_000),
  onHold: false,
  items: 21,
  clusterItems: 14,
  clusterAddedThisWeek: 3,
  bonusFrom: 'Hima Cement',
  payouts: [],
  lines: [],
  orders: [],
  ...o,
});

describe('what an agent owes is the shop price', () => {
  const him = agent({
    orders: [
      order({ doc: 'A', shopPrice: m(400_000), hisPrice: m(900_000), outstanding: m(400_000), settled: false }),
      order({ doc: 'B', shopPrice: m(300_000), hisPrice: m(700_000), outstanding: m(300_000), settled: false }),
    ],
  });

  it('adds the shop price, never what he charged his clients', () => {
    expect(owes(him)).toBe(700_000);
  });

  it('counts an order he paid for at pickup as part of the cycle, at nothing', () => {
    const withPickup = agent({
      orders: [...him.orders, order({ doc: 'C', outstanding: Money.ZERO, settled: false })],
    });
    expect(cycle(withPickup).length).toBe(3);
    expect(owes(withPickup)).toBe(700_000);
  });

  it('leaves a voided order out of the debt entirely', () => {
    const voided = agent({
      orders: [...him.orders, order({ doc: 'D', outstanding: m(50_000), settled: false, voided: true })],
    });
    expect(owes(voided)).toBe(700_000);
  });

  it('does not owe anything on goods that have not gone out', () => {
    const outForDelivery = agent({
      orders: [order({ doc: 'E', delivered: null, outstanding: m(80_000), settled: false })],
    });
    expect(owes(outForDelivery)).toBe(0);
    expect(behind(outForDelivery)).toBe(false);
  });

  it('takes only the ticked orders, and says what is left', () => {
    expect(settlementTotal(him, new Set(['A']))).toBe(400_000);
    expect(leftOwing(him, new Set(['A']))).toBe(300_000);
    expect(settlementReads(him, new Set(['A']))).toContain('300,000 is left owing');
    expect(settlementReads(him, everythingOwed(him))).toContain('Nothing is left owing');
  });

  it('hands a hold the cycle it refuses against, and the words he will read', () => {
    expect(cycle(him).length).toBe(2);
    expect(HOLD_WORDS).toBe('New orders are on hold until your account is settled. Call the shop.');
  });
});

describe('commission is read, never recomputed', () => {
  const him = agent({
    orders: [
      order({ doc: 'A', bonus: m(100_000) }),
      order({ doc: 'B', bonus: m(48_000) }),
      order({ doc: 'C', bonus: m(36_000), delivered: null }),
      order({ doc: 'D' }),
    ],
    payouts: [{ month: '2026-09', amount: m(148_000) }],
  });

  it('counts a bonus once the order is completed, and not before', () => {
    const c = commission(him, span);
    expect(c.earned).toBe(148_000);
    expect(c.earnedOn.length).toBe(2);
    expect(c.notYetCounted).toBe(36_000);
    expect(waitingReads(c)).toContain('36,000 sits on one order still out for delivery');
  });

  it('agrees with the payout when the two figures match', () => {
    const c = commission(him, span);
    expect(c.agrees.status === 'known' && c.agrees.value).toBe(true);
  });

  it('disagrees loudly rather than quietly when they do not', () => {
    const drifted = commission(
      agent({ ...him, payouts: [{ month: '2026-09', amount: m(120_000) }] }),
      span,
    );
    expect(drifted.agrees.status === 'known' && drifted.agrees.value).toBe(false);
  });

  it('cannot claim against a payout that has not been published — and says so', () => {
    const c = commission(agent({ ...him, payouts: [] }), span);
    expect(c.claimable.status).toBe('unavailable');
    expect(c.agrees.status).toBe('unavailable');
    // The earned figure still stands: it is the order rows, which exist.
    expect(c.earned).toBe(148_000);
  });

  it('states the cluster rule before it states a figure', () => {
    expect(clusterReads(him)).toBe(
      'On 14 of his 21 items — a cluster item earns only from its 8th day, and three of his were added this week.',
    );
    expect(CLUSTER_WAIT_DAYS).toBe(7);
  });
});

describe('absence is not zero', () => {
  it('has no margin for an agent who sold nothing, rather than 0%', () => {
    const quiet = agent({ orders: [] });
    expect(keptPercent(quiet, span).status).toBe('unavailable');
    expect(keptReads(quiet, span)).toBe('—');
  });

  it('has no share of a shop that sold nothing', () => {
    const counter: Counter = { sold: Money.ZERO, keptPercent: 24 };
    expect(position([agent()], span, counter).share.status).toBe('unavailable');
  });
});

describe('the lens', () => {
  it('selects the month, the month before it, and the year', () => {
    expect(spanFor('month', NOW).names).toBe('September');
    expect(spanFor('last', NOW).names).toBe('August');
    expect(spanFor('year', NOW).names).toBe('2026');
    expect(spanFor('month', NOW).key).toBe('2026-09');
  });

  it('rolls December back into the year before it', () => {
    const january = new Date(Date.UTC(2026, 0, 9));
    expect(spanFor('last', january).names).toBe('December');
    expect(spanFor('last', january).key).toBe('2025-12');
  });
});

describe('the list', () => {
  const late = agent({ id: 'late', orders: [order({ doc: 'L', outstanding: m(500_000), settled: false })] });
  const clear = (id: string, price: number): Agent =>
    agent({ id, terms: 'prepay', orders: [order({ doc: id, shopPrice: m(price), cost: m(price / 2) })] });
  const all = [late, clear('b', 900_000), clear('c', 800_000), clear('d', 700_000), clear('e', 10_000)];

  it('puts the ones who owe first, and never rolls them up', () => {
    const [behindGroup] = groups(all, span);
    expect(behindGroup?.agents.map((a) => a.id)).toEqual(['late']);
    expect(behindGroup?.rolled).toBeNull();
  });

  it('draws three of the settled and rolls the rest into one row', () => {
    const settled = groups(all, span)[1];
    expect(settled?.shown.map((a) => a.id)).toEqual(['b', 'c', 'd']);
    expect(settled?.rolled?.agents).toBe(1);
    expect(settled?.rolled?.billed).toBe(10_000);
  });

  it('rolls up nothing when there is nothing to roll up', () => {
    expect(groups([late, clear('b', 900_000)], span)[1]?.rolled).toBeNull();
  });
});

describe('the drawings', () => {
  it('scales the waterfall against the cost, and rules the total off at full width', () => {
    const him = agent({
      orders: [order({ doc: 'A', shopPrice: m(5_640_000), cost: m(4_928_000) })],
    });
    const wf = waterfall(him, span);
    expect(wf.costWidth).toBe(70);
    expect(wf.keptWidth).toBe(10.1);
    expect(wf.billed).toBe(5_640_000);
  });

  it('abbreviates a figure in exactly one place, and to two decimals', () => {
    expect(millions(m(18_420_000))).toBe('18.42');
    expect(millions(m(1_940_000))).toBe('1.94');
  });

  it('argues for prepay with the shop’s own record', () => {
    const all = [agent({ id: 'x', orders: [order({ doc: 'X', outstanding: m(1), settled: false })] }), agent({ id: 'y', terms: 'prepay' })];
    expect(creditReads(all)).toContain('1 of your 2 are behind on it');
  });
});
