/**
 * The demonstration agents are checked against the frames, figure by figure.
 *
 * Not because the demo data matters — it will be a Supabase query soon — but
 * because these assertions are the *frames themselves*, written down. When
 * the query lands, this file says exactly what the screen is supposed to
 * add up to, and the reckoning that produces it is the same one the screen
 * reads. A figure that stops matching here stopped matching the design.
 */

import { describe, expect, it } from 'vitest';
import {
  Money,
  behind,
  commission,
  cycle,
  groups,
  kept,
  keptReads,
  monthlySeries,
  orderCount,
  owes,
  position,
  sellsAtShopPrice,
  shopBilled,
  spanFor,
  unsettled,
  waterfall,
} from '@ow/domain';
import { DEMO_TODAY } from './demo-invoices.js';
import { demoAgents, demoCounter } from './demo-agents.js';

const agents = demoAgents();
const span = spanFor('month', DEMO_TODAY);
const counter = demoCounter();
const byId = (id: string) => {
  const found = agents.find((a) => a.id === id);
  if (found === undefined) throw new Error(`no agent ${id}`);
  return found;
};

const fig = (amount: Money.Money): string => Money.format(amount);

describe('the strip, frame 1a', () => {
  const strip = position(agents, span, counter);

  it('sold 18,420,000 through agents, on 63 orders', () => {
    expect(fig(strip.sold)).toBe('18,420,000');
    expect(strip.orders).toBe(63);
  });

  it('kept 2,310,000 of it — 12.5%, against the counter’s 24%', () => {
    expect(fig(strip.kept)).toBe('2,310,000');
    expect(strip.keptPercent.status).toBe('known');
    expect(strip.keptPercent.status === 'known' ? strip.keptPercent.value : 0).toBe(12.5);
    expect(counter.keptPercent).toBe(24);
  });

  it('earned 1,860,000 of supplier commission', () => {
    expect(fig(strip.commission)).toBe('1,860,000');
  });

  it('is owed 1,940,000, with two agents behind', () => {
    expect(fig(strip.owed)).toBe('1,940,000');
    expect(strip.behind).toBe(2);
  });

  it('is 31% of everything the shop sold', () => {
    expect(strip.share.status === 'known' ? strip.share.value : 0).toBe(31);
  });

  it('is fourteen active agents', () => {
    expect(agents.length).toBe(14);
  });
});

describe('the rows, frame 1a', () => {
  it.each([
    ['wasswa', '5,640,000', '712,000', '1,420,000', 21, '12.6%'],
    ['joan', '1,860,000', '204,000', '520,000', 8, '11.0%'],
    ['derrick', '6,120,000', '908,000', '0', 17, '14.8%'],
    ['annet', '2,740,000', '301,000', '0', 9, '11.0%'],
    ['moses', '1,190,000', '142,000', '0', 5, '11.9%'],
  ])('%s: billed %s, kept %s, owes %s', (id, billed, keptFig, owed, orders, pct) => {
    const agent = byId(id);
    expect(fig(shopBilled(agent, span))).toBe(billed);
    expect(fig(kept(agent, span))).toBe(keptFig);
    expect(fig(owes(agent))).toBe(owed);
    expect(orderCount(agent, span)).toBe(orders);
    expect(keptReads(agent, span)).toBe(pct);
  });

  it('puts the two who owe in one group and the twelve settled in the other', () => {
    const [late, settled] = groups(agents, span);
    expect(late?.agents.length).toBe(2);
    expect(settled?.agents.length).toBe(12);
    expect(late?.agents.map((a) => a.name)).toEqual(['Wasswa Mugisha', 'Joan Nabbosa']);
  });

  it('rolls the nine smallest into one row, and says what they did', () => {
    const rolled = groups(agents, span)[1]?.rolled;
    expect(rolled?.agents).toBe(9);
    expect(fig(rolled?.billed ?? Money.ZERO)).toBe('870,000');
    expect(fig(rolled?.kept ?? Money.ZERO)).toBe('43,000');
    // Three, not the frame's eight: 21 + 8 + 17 + 9 + 5 is 60 of the strip's 63.
    expect(rolled?.orders).toBe(3);
  });

  it('marks Moses as selling at the shop price, and nobody else', () => {
    expect(agents.filter(sellsAtShopPrice).map((a) => a.id)).toEqual(['moses']);
  });

  it('makes Derrick the top seller — he is billed the most', () => {
    const top = [...agents].sort((a, b) => Money.compare(shopBilled(b, span), shopBilled(a, span)))[0];
    expect(top?.id).toBe('derrick');
  });
});

describe('the agent panel, frame 1a', () => {
  const wasswa = byId('wasswa');

  it('reads 4,928,000 of cost and 712,000 kept, up to 5,640,000 billed', () => {
    const wf = waterfall(wasswa, span);
    expect(fig(wf.cost)).toBe('4,928,000');
    expect(fig(wf.kept)).toBe('712,000');
    expect(fig(wf.billed)).toBe('5,640,000');
    // The frame's own bar widths: the cost fills seven tenths, and what was
    // kept is drawn against the cost rather than against the card.
    expect(wf.costWidth).toBe(70);
    expect(wf.keptWidth).toBe(10.1);
  });

  it('owes 1,420,000 on a cycle of six delivered orders, three of them open', () => {
    expect(fig(owes(wasswa))).toBe('1,420,000');
    expect(cycle(wasswa).length).toBe(6);
    expect(unsettled(wasswa).map((o) => [o.doc, fig(o.outstanding)])).toEqual([
      ['ORD-0388', '400,000'],
      ['ORD-0391', '300,000'],
      ['ORD-0402', '720,000'],
    ]);
  });

  it('shows 148,000 earned on nine completed orders, and 36,000 still out on two', () => {
    const c = commission(wasswa, span);
    expect(fig(c.earned)).toBe('148,000');
    expect(c.earnedOn.length).toBe(9);
    expect(fig(c.notYetCounted)).toBe('36,000');
    expect(c.waitingOn.length).toBe(2);
  });

  it('agrees with the payout, which is what the cut Commissions screen was for', () => {
    const c = commission(wasswa, span);
    expect(c.claimable.status === 'known' ? fig(c.claimable.value) : '—').toBe('148,000');
    expect(c.agrees.status === 'known' ? c.agrees.value : false).toBe(true);
  });

  it('counts five months of orders, ending on the twenty-one the row shows', () => {
    const series = monthlySeries(wasswa, DEMO_TODAY);
    expect(series.map((x) => x.orders)).toEqual([10, 13, 20, 17, 21]);
    expect(series.map((x) => x.month)).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep']);
    expect(series[series.length - 1]?.orders).toBe(orderCount(wasswa, span));
  });

  it('is the only agent on the screen who is both behind and on credit', () => {
    expect(agents.filter((a) => behind(a) && a.terms === 'credit').map((a) => a.id)).toEqual([
      'wasswa',
      'joan',
    ]);
  });
});

describe('the lens changes every figure', () => {
  it('reads August as its own month, not September’s', () => {
    const august = spanFor('last', DEMO_TODAY);
    const wasswa = byId('wasswa');
    expect(orderCount(wasswa, august)).toBe(17);
    expect(fig(shopBilled(wasswa, august))).toBe('4,900,000');
    expect(august.names).toBe('August');
  });

  it('leaves the debt alone, because a debt is a position and not a flow', () => {
    const wasswa = byId('wasswa');
    for (const period of ['month', 'last', 'year'] as const) {
      expect(fig(owes(wasswa)), period).toBe('1,420,000');
      expect(spanFor(period, DEMO_TODAY).period).toBe(period);
    }
  });

  it('sums the five months under the year lens', () => {
    const year = spanFor('year', DEMO_TODAY);
    const wasswa = byId('wasswa');
    expect(orderCount(wasswa, year)).toBe(81);
    expect(fig(shopBilled(wasswa, year))).toBe('21,840,000');
  });
});

describe('the agent’s own price never leaves the record', () => {
  it('is carried on the line, because the line carries it', () => {
    const order = byId('wasswa').orders[0];
    expect(order?.hisPrice).not.toBeNull();
  });

  it('is what says Moses adds nothing — and that is all it is used for', () => {
    const moses = byId('moses');
    expect(moses.orders.every((o) => o.hisPrice === o.shopPrice)).toBe(true);
    expect(sellsAtShopPrice(moses)).toBe(true);
  });
});
