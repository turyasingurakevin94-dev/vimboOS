/**
 * Agents, off rows shaped like the shop's real ones.
 *
 * The `agents` table is small and plain. Everything wrongable is on the
 * other side: which quote belongs to whom, what an order is worth, and the
 * five things these frames draw that the books hold nowhere at all.
 */

import { describe, expect, it } from 'vitest';
import { Money, clusterReads, counterFor, cycle, match, owes, spanFor } from '@ow/domain';
import { NOT_RECORDED, assembleAgents, linesOf, toAgentOrder } from './agents.js';

const NOW = new Date('2026-09-15T08:00:00Z');

const person = (over: Record<string, unknown> = {}): unknown => ({
  shop_id: 'shop',
  id: 'AG0005',
  name: 'Kevin Moses',
  phone: '0750016750',
  payment_term: 'prepay',
  location: 'Industrial Area',
  unavailable: false,
  retired_at: null,
  created_at: '2026-08-08T14:39:10.003435+00:00',
  ...over,
});

const quote = (over: Record<string, unknown> = {}): unknown => ({
  id: 365,
  date: '2026-09-15',
  status: 'completed',
  invoiced: false,
  voided: false,
  amount_paid: 0,
  agent_id: null,
  payload: {
    client: { name: 'A99 Trade Center', location: 'Kisenyi' },
    stageEnteredAt: 1_789_684_911_260,
    items: [{ qty: 4, sellPrice: 27_500, price: 20_000, productName: 'Iron sheets G28' }],
  },
  ...over,
});

const only = (rows: readonly unknown[], quotes: readonly unknown[] = []) =>
  assembleAgents(rows, quotes).agents[0];

describe('an agent, off the books', () => {
  it('reads his name, round, terms and when he started', () => {
    const him = only([person({ payment_term: 'credit' })]);

    expect(him?.name).toBe('Kevin Moses');
    expect(him?.round).toBe('Industrial Area');
    expect(him?.terms).toBe('credit');
    expect(him?.since.getUTCFullYear()).toBe(2026);
  });

  it('calls anything but credit prepay, rather than guessing at it', () => {
    expect(only([person({ payment_term: null })])?.terms).toBe('prepay');
    expect(only([person({ payment_term: 'weekly' })])?.terms).toBe('prepay');
  });

  it('holds him when the books say he is unavailable', () => {
    expect(only([person({ unavailable: true })])?.onHold).toBe(true);
    expect(only([person()])?.onHold).toBe(false);
  });

  it('leaves a retired agent off the list rather than on it at zero', () => {
    const books = assembleAgents([person(), person({ id: 'AG0001', retired_at: '2026-01-01' })], []);
    expect(books.agents.map((a) => a.id)).toEqual(['AG0005']);
  });

  it('names an agent it could not place, and leaves him off', () => {
    const books = assembleAgents([person({ id: null }), person({ id: 'AG0007', name: null })], []);
    expect(books.agents).toHaveLength(0);
    expect(books.unreadable).toHaveLength(2);
  });

  /**
   * The shop's own books hold no cluster, no bonus, no payout, no ceiling
   * and no settlement. Read as zeros, that screen states a whole supplier
   * scheme paying nothing.
   */
  it('says the cluster is not recorded rather than reading it as none', () => {
    const him = only([person()]);
    expect(him?.cluster.status).toBe('unavailable');
    expect(him === undefined ? '' : clusterReads(him).status).toBe('unavailable');
    expect(him?.payouts).toEqual([]);
    expect(him?.ceiling).toBeNull();
    expect(NOT_RECORDED).toHaveLength(5);
  });
});

describe('an order taken in his name', () => {
  it('belongs to the agent the row names, and to nobody else', () => {
    const books = assembleAgents(
      [person(), person({ id: 'AG0006', name: 'Henry Munene' })],
      [quote({ agent_id: 'AG0005' }), quote({ id: 366, agent_id: null })],
    );

    expect(books.agents.map((a) => a.orders.length)).toEqual([1, 0]);
  });

  it('values it at the shop price, and knows what the goods cost', () => {
    const { order } = toAgentOrder(quote());

    expect(order?.shopPrice).toBe(Money.money(110_000));
    expect(order?.cost).toBe(Money.money(80_000));
    // The old app records no second price, so what he charged his own client
    // is not known — never the shop price, which would assert he adds nothing.
    expect(order?.hisPrice).toBeNull();
  });

  it('counts what is still owed, and shows a paid order at zero', () => {
    expect(toAgentOrder(quote()).order?.outstanding).toBe(Money.money(110_000));
    expect(toAgentOrder(quote({ amount_paid: 110_000 })).order?.outstanding).toBe(Money.ZERO);
    // Over-paid is not owed backwards.
    expect(toAgentOrder(quote({ amount_paid: 200_000 })).order?.outstanding).toBe(Money.ZERO);
  });

  it('is delivered only once it has reached the completed lane', () => {
    expect(toAgentOrder(quote()).order?.delivered).not.toBeNull();
    expect(toAgentOrder(quote({ status: 'preparing' })).order?.delivered).toBeNull();
  });

  /**
   * An order paid for at pickup is not a settled one. It stays in the cycle,
   * at zero, until a settlement closes it off — and no settlement is
   * recorded anywhere on this shop, so nothing ever leaves by itself.
   */
  it('keeps a paid order in the cycle at zero, and owes nothing on it', () => {
    const him = only([person()], [quote({ agent_id: 'AG0005', amount_paid: 110_000 })]);

    expect(him === undefined ? -1 : cycle(him).length).toBe(1);
    expect(him === undefined ? null : owes(him)).toBe(Money.ZERO);
  });

  it('leaves an order with no date off, rather than counting it in no month', () => {
    expect(toAgentOrder(quote({ date: null })).order).toBeNull();
    expect(toAgentOrder(quote({ date: null })).why).toContain('#365');
  });
});

describe('the lines he sells', () => {
  it('shares his orders out by line, and reads what each keeps', () => {
    const lines = linesOf([
      { payload: { items: [{ qty: 4, sellPrice: 27_500, price: 20_000, productName: 'Iron sheets G28' }] } },
      { payload: { items: [{ qty: 1, sellPrice: 40_000, price: 30_000, productName: 'Cement 50kg' }] } },
    ]);

    expect(lines.map((l) => l.line).sort()).toEqual(['Cement 50kg', 'Iron sheets G28']);
    expect(lines.every((l) => l.shareOfOrders === 50)).toBe(true);
    // A row names a line; prose names a thing.
    expect(lines.map((l) => l.shortName).sort()).toEqual(['cement', 'iron']);
    expect(lines.find((l) => l.line === 'Cement 50kg')?.margin).toBe(25);
  });

  it('has no line mix for an agent who has sold nothing', () => {
    expect(linesOf([])).toEqual([]);
  });
});

describe('the counter behind the channel', () => {
  const span = spanFor('month', NOW);

  it('counts everything sold, and keeps the counter’s own margin separate', () => {
    const books = assembleAgents(
      [person()],
      [quote({ agent_id: 'AG0005' }), quote({ id: 366, agent_id: null })],
    );
    const counter = counterFor(books.sales, span);

    // Both orders are what the shop sold; only the second is the counter's.
    expect(counter.sold).toBe(Money.money(220_000));
    expect(
      match(counter.keptPercent, {
        known: (pct) => pct,
        partial: (pct) => pct,
        unavailable: () => null,
      }),
    ).toBe(27);
  });

  /**
   * A month the counter sold nothing in has no margin. Read as 0%, the
   * sentence every agent's margin sits in says the counter gave its goods
   * away.
   */
  it('has no margin for a counter that sold nothing, rather than 0%', () => {
    const books = assembleAgents([person()], [quote({ agent_id: 'AG0005' })]);
    expect(counterFor(books.sales, span).keptPercent.status).toBe('unavailable');
  });

  it('leaves a cancelled sale out of the shop’s total entirely', () => {
    const books = assembleAgents([], [quote({ voided: true })]);
    expect(books.sales).toHaveLength(0);
  });
});
