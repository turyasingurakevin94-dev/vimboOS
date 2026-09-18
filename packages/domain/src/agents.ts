/**
 * Sales agents — one reckoning for what they sold, what you kept, what they
 * owe, and the supplier's commission passing through.
 *
 * ## How the money actually moves
 *
 * An agent **buys the goods from the shop** and sells them on at his own
 * price. `agent-submit-order` computes `sellPrice: priced.floorPrice`
 * server-side — that is what the shop is owed — and carries `agentSellPrice`
 * separately as the agent's own price to his client. **The shop never
 * collects from his clients**, so what he charges them is not the shop's
 * record to keep, and no figure on this screen is it.
 *
 * The only other money between shop and agent is **commission**: a
 * supplier-funded promotion bonus, `bonusCommission`, snapshotted onto the
 * order line at submit and paid only on items in the agent's cluster. It is
 * the supplier's money passing through. It never touches what he owes.
 *
 * ## The two claims this module makes, and enforces
 *
 * 1. **What an agent owes is the SHOP price on the orders he has taken.**
 *    {@link owes} reads `shopPrice`, and there is no other price in it.
 * 2. **Commission is earned, not computed.** {@link commission} READS
 *    `bonusCommission` off the line. It never recomputes the rule, because
 *    the agent's own app already shows him that figure and a second
 *    implementation is how a bonus shown as earned becomes a bonus the
 *    payout will not pay. {@link commission} instead compares the two and
 *    hands back the comparison, which is what the cut Commissions screen
 *    existed to make.
 *
 * ## The cut this module carries
 *
 * Commissions was a screen. It read the same order rows this one does and
 * summed one field off them; the reconciliation it existed for is
 * {@link commission}'s `agrees`, which the agent panel shows as a chip. The
 * month-by-month table is gone and its three figures are on the panel.
 */

import { known, match, partial, unavailable, type Derived } from './derived.js';
import { inWords, monthLabel } from './customers.js';
import * as Money from './money.js';
import type { Money as Amount } from './money.js';

/* -------------------------------------------------------------------------- */
/*  The rules the shop has set                                                */
/* -------------------------------------------------------------------------- */

/**
 * `preset_agent_cluster_wait_days`. An item added to an agent's cluster earns
 * nothing until it has sat there this long — so it earns **from its eighth
 * day**, which is how the screen says it.
 */
export const CLUSTER_WAIT_DAYS = 7;

/** What the shop keeps at its own counter. The agent margin is read against it. */
export const COUNTER_MARGIN_PERCENT = 24;

/** How many agents a settled group draws before the rest roll into one row. */
export const SHOWN_BEFORE_ROLLUP = 3;

/* -------------------------------------------------------------------------- */
/*  The records                                                               */
/* -------------------------------------------------------------------------- */

/** How an agent takes goods: pays first, or settles later. */
export type Terms = 'prepay' | 'credit';

/** The period lens. It changes every figure on the screen, including the panel. */
export type Period = 'month' | 'last' | 'year';

export interface AgentOrder {
  /** `ORD-0388`. */
  readonly doc: string;
  /** When the order was taken — which month it is counted in. */
  readonly taken: Date;
  /** `null` while the goods are still out. A bonus counts once it is completed. */
  readonly delivered: Date | null;
  /** Where it went. The row reads `28 Aug · Ndeeba`. */
  readonly where: string;
  /**
   * `sellPrice` — `priced.floorPrice`, computed server-side. **This is what
   * the agent owes the shop**, and the only price this screen shows.
   */
  readonly shopPrice: Amount;
  /** What the goods cost the shop. `shopPrice - cost` is what the shop kept. */
  readonly cost: Amount;
  /**
   * `agentSellPrice` — what he charged his own client.
   *
   * It is carried because the line carries it, and it is **never rendered**:
   * the shop does not collect from his clients, so it is not the shop's
   * record to show. The only thing read off it is {@link sellsAtShopPrice},
   * which is a fact about him, not a figure of his. A test in the console
   * asserts that no frame on this screen prints it.
   */
  readonly hisPrice: Amount | null;
  /**
   * What is still owed to the shop on this order.
   *
   * Zero on an order he paid for at pickup, which is not the same thing as
   * a settled one: it stays in the settlement list until the settlement that
   * closes the cycle is recorded, and the list shows it at zero rather than
   * hiding it. The frame draws exactly that — three ticked orders carrying
   * the whole debt, and three more at nothing.
   */
  readonly outstanding: Amount;
  /** Whether a recorded settlement has already closed this order off. */
  readonly settled: boolean;
  /** `bonusCommission`, snapshotted at submit. The supplier's money. */
  readonly bonus: Amount;
  /** A voided order is not sold, not owed and never earns a bonus. */
  readonly voided: boolean;
}

/** A line of stock, as this agent sells it. */
export interface LineShare {
  /** As a row reads it: `Cement 50kg`. */
  readonly line: string;
  /** As a sentence reads it: `cement`. A row names a line; prose names a thing. */
  readonly shortName: string;
  /** Share of his orders, 0–100. */
  readonly shareOfOrders: number;
  /** What the shop kept on it, as a percentage of the shop price, 0–100. */
  readonly margin: number;
}

/** One bar of the five-month series. Oldest first. */
export interface MonthOrders {
  /** `May`, `Jun` — the label under the bar. */
  readonly month: string;
  readonly orders: number;
}

/**
 * What the supplier's payout says it will pay this agent for a month.
 *
 * This is the OTHER side of the reconciliation, and the reason it is a
 * record rather than a calculation: if the app computed it, comparing it
 * with the screen would be comparing a figure with itself.
 */
export interface Payout {
  /** `2026-09`, the month the payout is for. */
  readonly month: string;
  readonly amount: Amount;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly since: Date;
  /** `Ndeeba` — the round he sells on. */
  readonly round: string;
  readonly terms: Terms;
  /** `null` on prepay, and on credit that has no ceiling agreed. */
  readonly ceiling: Amount | null;
  /** Whether new orders in his name are refused at the counter. */
  readonly onHold: boolean;
  readonly orders: readonly AgentOrder[];
  /**
   * The supplier's bonus scheme, where anything records one.
   *
   * `Derived` because the shop's own books do not record it at all — there
   * is no cluster, no membership and no funding supplier anywhere in
   * `agents` or in a quote's payload. Held as four plain numbers, an agent
   * off those books reads `On 0 of 0 items` and names no supplier, which is
   * a sentence about a bonus scheme invented out of nothing.
   */
  readonly cluster: Derived<Cluster>;
  readonly payouts: readonly Payout[];
  readonly lines: readonly LineShare[];
}

/** An agent's cluster: which of the things he sells earn the bonus, and whose. */
export interface Cluster {
  /** How many items he sells. */
  readonly items: number;
  /** How many of them are in the cluster. */
  readonly clusterItems: number;
  /** Cluster items added inside {@link CLUSTER_WAIT_DAYS} — they earn nothing yet. */
  readonly addedThisWeek: number;
  /** Which supplier funds the bonus. */
  readonly from: string;
}

/** What the rest of the shop sold, so the agent channel can state its share. */
export interface Counter {
  /** Everything the shop sold in the span, agents included. */
  readonly sold: Amount;
  /**
   * What the counter itself keeps, as a percentage.
   *
   * `Derived` because a month the shop sold nothing in has no margin, and a
   * screen that reads it as 0% says the counter gave its goods away. The
   * agent's own margin is read against this figure, so a wrong zero here is
   * a wrong sentence about every agent on the page.
   */
  readonly keptPercent: Derived<number>;
}

/** One sale the shop made, as the channel's share is worked out from it. */
export interface Sale {
  readonly on: Date;
  /** What the client was charged. */
  readonly billed: Amount;
  /** What those goods cost the shop. */
  readonly cost: Amount;
  /** Whether it was taken through an agent. */
  readonly throughAgent: boolean;
}

/**
 * The counter, for the span being looked at.
 *
 * `sold` is everything, agents included, because the channel's share is a
 * share of the whole shop. `keptPercent` is the counter's OWN margin, with
 * the agent orders taken out — the sentence it appears in is "the shop keeps
 * 12.5% here, against the counter's 24%", and a counter figure that included
 * the agents would be comparing the agents with themselves.
 */
export function counterFor(sales: readonly Sale[], span: Span): Counter {
  const inside = sales.filter((s) => s.on >= span.from && s.on < span.to);
  const sold = Money.add(...inside.map((s) => s.billed));

  const own = inside.filter((s) => !s.throughAgent);
  const billed = Money.add(...own.map((s) => s.billed));
  const cost = Money.add(...own.map((s) => s.cost));

  return {
    sold,
    keptPercent: Money.isZero(billed)
      ? unavailable<number>(
          `the counter sold nothing ${span.period === 'year' ? `in ${span.names}` : span.names === 'this month' ? 'this month' : `in ${span.names}`}, so it kept no percentage of anything`,
        )
      : known(
          Math.round(((billed - cost) / billed) * 100),
          `${Money.format(Money.money(billed - cost))} of ${Money.format(billed)} at the counter`,
        ),
  };
}

/* -------------------------------------------------------------------------- */
/*  The period lens                                                           */
/* -------------------------------------------------------------------------- */

export interface Span {
  readonly period: Period;
  /** Inclusive. */
  readonly from: Date;
  /** Exclusive — the instant the span ends. */
  readonly to: Date;
  /** `September`, `August`, `the year` — how a heading names it. */
  readonly names: string;
  /** `2026-09` for a month lens, `2026` for the year. Buckets a payout. */
  readonly key: string;
}

const utc = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m, d));

const pad = (n: number): string => String(n).padStart(2, '0');

const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** What the lens selects, from the day the shop is standing in. */
export function spanFor(period: Period, now: Date): Span {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  if (period === 'year') {
    return {
      period,
      from: utc(y, 0, 1),
      to: utc(y + 1, 0, 1),
      names: `${y}`,
      key: `${y}`,
    };
  }

  const month = period === 'month' ? m : m - 1;
  const from = utc(y, month, 1);
  const to = utc(y, month + 1, 1);
  return {
    period,
    from,
    to,
    names: FULL_MONTHS[from.getUTCMonth()] ?? '',
    key: `${from.getUTCFullYear()}-${pad(from.getUTCMonth() + 1)}`,
  };
}

/** Whether an order was taken inside the span. */
export const inSpan = (order: AgentOrder, span: Span): boolean =>
  order.taken >= span.from && order.taken < span.to;

/* -------------------------------------------------------------------------- */
/*  One agent                                                                 */
/* -------------------------------------------------------------------------- */

/** The orders a figure in the span is built from. A void is not a sale. */
export const counted = (agent: Agent, span: Span): readonly AgentOrder[] =>
  agent.orders.filter((o) => !o.voided && inSpan(o, span));

/** What the shop billed him in the span — `sellPrice`, and nothing else. */
export const shopBilled = (agent: Agent, span: Span): Amount =>
  Money.add(...counted(agent, span).map((o) => o.shopPrice));

/** What those goods cost the shop. */
export const shopCost = (agent: Agent, span: Span): Amount =>
  Money.add(...counted(agent, span).map((o) => o.cost));

/** What the shop kept: the shop price less the shop's own cost. */
export const kept = (agent: Agent, span: Span): Amount =>
  Money.subtract(shopBilled(agent, span), shopCost(agent, span));

/** How many orders he took in the span. */
export const orderCount = (agent: Agent, span: Span): number => counted(agent, span).length;

/**
 * What the shop kept, as a percentage of what it billed.
 *
 * Unavailable rather than zero when nothing was billed: an agent who sold
 * nothing this month has no margin, and `0%` is a claim the books did not
 * make.
 */
export function keptPercent(agent: Agent, span: Span): Derived<number> {
  const billed = shopBilled(agent, span);
  if (Money.isZero(billed)) {
    return unavailable(`${agent.name} was billed nothing in ${span.names}, so nothing was kept`);
  }
  const share = (kept(agent, span) / billed) * 100;
  return known(
    Math.round(share * 10) / 10,
    `${Money.format(kept(agent, span))} kept on ${Money.format(billed)} billed`,
  );
}

/** `12.6%`, or an em dash where the margin could not be derived. */
export const keptReads = (agent: Agent, span: Span): string =>
  match(keptPercent(agent, span), {
    known: (pct) => `${pct.toFixed(1)}%`,
    partial: (pct) => `${pct.toFixed(1)}%`,
    // Never a zero standing in for a figure the books did not produce.
    unavailable: () => '—',
  });

/**
 * The settlement cycle: the orders that have been delivered and not yet
 * closed off by a settlement.
 *
 * **Not span-scoped.** A debt is a position, not a flow — looking at last
 * month does not make this month's unpaid goods stop being unpaid, and a
 * settlement that only offered the current month's orders would leave the
 * two August orders that made him late unreachable.
 */
export const cycle = (agent: Agent): readonly AgentOrder[] =>
  agent.orders.filter((o) => !o.voided && o.delivered !== null && !o.settled);

/** The orders in the cycle that still carry money. */
export const unsettled = (agent: Agent): readonly AgentOrder[] =>
  cycle(agent).filter((o) => !Money.isZero(o.outstanding));

/**
 * What he owes the shop — the SHOP price on the orders he has taken.
 *
 * Never the price he charged his clients. He collects from them himself.
 */
export const owes = (agent: Agent): Amount =>
  Money.add(...cycle(agent).map((o) => o.outstanding));

/** Whether he is behind on settlement. Terms are not the question; money is. */
export const behind = (agent: Agent): boolean => !Money.isZero(owes(agent));

/**
 * Whether he sells the goods on at what the shop billed him.
 *
 * Read off `agentSellPrice`, which this screen never prints. The fact is the
 * shop's business — an agent adding nothing is an agent who will stop — and
 * the figure is his.
 */
export function sellsAtShopPrice(agent: Agent): boolean {
  const priced = agent.orders.filter((o) => !o.voided && o.hisPrice !== null);
  if (priced.length === 0) return false;
  return priced.every((o) => o.hisPrice === o.shopPrice);
}

/* -------------------------------------------------------------------------- */
/*  Commission — read, never recomputed                                       */
/* -------------------------------------------------------------------------- */

export interface Commission {
  /** `bonusCommission` on completed, unvoided orders in the span. */
  readonly earned: Amount;
  /** The completed orders that earned it — `on 9 completed orders`. */
  readonly earnedOn: readonly AgentOrder[];
  /** What the supplier's payout says it will pay for the same span. */
  readonly claimable: Derived<Amount>;
  /** Bonus sitting on orders that have not been completed yet. */
  readonly notYetCounted: Amount;
  /** The orders that money is waiting on. */
  readonly waitingOn: readonly AgentOrder[];
  /**
   * The reconciliation the cut Commissions screen existed to make: does what
   * this screen shows as earned agree with what the payout would pay?
   */
  readonly agrees: Derived<boolean>;
}

/**
 * The month's commission, both sides of it.
 *
 * A bonus counts once the order is **completed**; until then it is money the
 * supplier has promised and not yet owed, which is a different sentence from
 * zero and is shown as its own figure.
 */
export function commission(agent: Agent, span: Span): Commission {
  const live = counted(agent, span);
  const earnedOn = live.filter((o) => o.delivered !== null && !Money.isZero(o.bonus));
  const earned = Money.add(...earnedOn.map((o) => o.bonus));
  const waitingOn = live.filter((o) => o.delivered === null && !Money.isZero(o.bonus));
  const notYetCounted = Money.add(...waitingOn.map((o) => o.bonus));

  const payout = agent.payouts.find((p) => p.month === span.key);
  if (payout === undefined) {
    const why = `the ${span.names} payout has not been published, so nothing can be claimed against it`;
    return {
      earned,
      earnedOn,
      claimable: unavailable<Amount>(why),
      notYetCounted,
      waitingOn,
      agrees: unavailable<boolean>(why),
    };
  }

  return {
    earned,
    earnedOn,
    claimable: known(payout.amount, `what the ${span.names} payout will pay`),
    notYetCounted,
    waitingOn,
    agrees: known(
      payout.amount === earned,
      `${Money.format(earned)} shown as earned · ${Money.format(payout.amount)} on the payout`,
    ),
  };
}

/**
 * Which supplier funds his bonus, where anything records one.
 *
 * `null` where nothing does, and the difference matters at the one place it
 * is read: the claim form's *Claiming from*. A blank option in that list is
 * a claim addressed to nobody.
 */
export const bonusFrom = (agent: Agent): string | null =>
  match(agent.cluster, {
    known: (c) => c.from,
    partial: (c) => c.from,
    unavailable: () => null,
  });

/**
 * The cluster rule, in words, before any figure is shown.
 *
 * The order matters: a figure that is smaller than the agent expects is an
 * argument unless the rule that made it smaller is read first.
 */
export const clusterReads = (agent: Agent): Derived<string> =>
  match(agent.cluster, {
    known: (c) => {
      const wait = `a cluster item earns only from its ${ordinal(CLUSTER_WAIT_DAYS + 1)} day`;
      const added =
        c.addedThisWeek === 0
          ? ''
          : `, and ${inWords(c.addedThisWeek)} of his were added this week`;
      return known(`On ${c.clusterItems} of his ${c.items} items — ${wait}${added}.`, 'his cluster');
    },
    partial: (c, basis) =>
      partial(
        `On ${c.clusterItems} of his ${c.items} items — a cluster item earns only from its ${ordinal(
          CLUSTER_WAIT_DAYS + 1,
        )} day.`,
        basis,
        'part of the cluster is not recorded',
      ),
    unavailable: (why) => unavailable<string>(why),
  });

/** What the bonus that has not counted yet is waiting on. */
export const waitingReads = (c: Commission): string => {
  const n = c.waitingOn.length;
  if (n === 0) return 'Every bonus this month sits on an order that is completed.';
  return `${Money.format(c.notYetCounted)} sits on ${inWords(n)} ${
    n === 1 ? 'order' : 'orders'
  } still out for delivery. A bonus counts once the order is completed, and it is the supplier's money passing through, never the shop's.`;
};

const ordinal = (n: number): string => {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
};

/* -------------------------------------------------------------------------- */
/*  The channel                                                               */
/* -------------------------------------------------------------------------- */

export interface Position {
  readonly sold: Amount;
  readonly kept: Amount;
  readonly keptPercent: Derived<number>;
  readonly commission: Amount;
  readonly owed: Amount;
  readonly orders: number;
  readonly behind: number;
  /** The channel's share of everything the shop sold. */
  readonly share: Derived<number>;
}

/** The strip. Every figure on it is the sum of the same rows the list draws. */
export function position(
  agents: readonly Agent[],
  span: Span,
  counter: Counter,
): Position {
  const sold = Money.add(...agents.map((a) => shopBilled(a, span)));
  const keptTotal = Money.add(...agents.map((a) => kept(a, span)));
  const earned = Money.add(...agents.map((a) => commission(a, span).earned));

  return {
    sold,
    kept: keptTotal,
    keptPercent: Money.isZero(sold)
      ? unavailable<number>('nothing was sold through an agent, so nothing was kept')
      : known(
          Math.round((keptTotal / sold) * 1000) / 10,
          `${Money.format(keptTotal)} kept on ${Money.format(sold)} billed`,
        ),
    commission: earned,
    owed: Money.add(...agents.map(owes)),
    orders: agents.reduce((n, a) => n + orderCount(a, span), 0),
    behind: agents.filter(behind).length,
    share: Money.isZero(counter.sold)
      ? unavailable<number>('the shop sold nothing in this span, so there is no share to take')
      : known(
          Math.round((sold / counter.sold) * 100),
          `${Money.format(sold)} of ${Money.format(counter.sold)} sold`,
        ),
  };
}

/* -------------------------------------------------------------------------- */
/*  The list                                                                  */
/* -------------------------------------------------------------------------- */

export interface Rollup {
  /** How many agents are inside it. */
  readonly agents: number;
  readonly billed: Amount;
  readonly kept: Amount;
  readonly orders: number;
}

export interface Group {
  readonly id: 'behind' | 'settled';
  readonly name: string;
  readonly agents: readonly Agent[];
  /** What the band says on the right. */
  readonly reads: string;
  /** The agents drawn as rows. */
  readonly shown: readonly Agent[];
  /** The rest, as one row — `null` when nothing was rolled up. */
  readonly rolled: Rollup | null;
}

/**
 * Two groups, and the smallest of the settled ones roll into one row.
 *
 * Nine agents who sold three orders between them are one fact, not nine
 * rows, and the row says how many were rolled up so nothing disappears
 * quietly. The group that needs the owner — behind on settlement — never
 * rolls up at all.
 */
export function groups(agents: readonly Agent[], span: Span): readonly Group[] {
  const isBehind = agents.filter(behind).sort((a, b) => Money.compare(owes(b), owes(a)));
  const settled = agents
    .filter((a) => !behind(a))
    .sort((a, b) => Money.compare(shopBilled(b, span), shopBilled(a, span)));

  const shown = settled.slice(0, SHOWN_BEFORE_ROLLUP);
  const rest = settled.slice(SHOWN_BEFORE_ROLLUP);

  return [
    {
      id: 'behind',
      name: 'Behind on settlement',
      agents: isBehind,
      reads: `${Money.format(Money.add(...isBehind.map(owes)))} owed`,
      shown: isBehind,
      rolled: null,
    },
    {
      id: 'settled',
      name: 'Settled up',
      agents: settled,
      reads: 'prepay or paid on delivery',
      shown,
      rolled:
        rest.length === 0
          ? null
          : {
              agents: rest.length,
              billed: Money.add(...rest.map((a) => shopBilled(a, span))),
              kept: Money.add(...rest.map((a) => kept(a, span))),
              orders: rest.reduce((n, a) => n + orderCount(a, span), 0),
            },
    },
  ];
}

/** `2 agents`, `12 agents` — a band's own count. */
export const bandCount = (group: Group): string =>
  `${group.agents.length} ${group.agents.length === 1 ? 'agent' : 'agents'}`;

/** `nine more agents`. */
export const rollupName = (rolled: Rollup): string =>
  `${inWords(rolled.agents)} more ${rolled.agents === 1 ? 'agent' : 'agents'}`;

/** `3 orders between them this month`. */
export function rollupReads(rolled: Rollup, span: Span): string {
  const when =
    span.period === 'month' ? 'this month' : span.period === 'last' ? 'last month' : `in ${span.names}`;
  const n = rolled.orders;
  return `${n} ${n === 1 ? 'order' : 'orders'} between them ${when}`;
}

/**
 * `18.42` — millions to two places, for the phone header strip.
 *
 * **The one place in either design a figure is abbreviated.** It lives here
 * rather than in the phone screen so that the rule, and its single
 * exception, are stated where every other money rule is.
 */
export const millions = (amount: Amount): string => (amount / 1_000_000).toFixed(2);

/* -------------------------------------------------------------------------- */
/*  What a row says about an agent                                            */
/* -------------------------------------------------------------------------- */

export type AgentMarkTone = 'info' | 'warn';

export interface AgentMark {
  readonly pill: string;
  readonly tone: AgentMarkTone;
}

/**
 * The one qualifying thing about this agent, or `null` for the plain round
 * and order count.
 *
 * Two pills would be two things to read, and the row already carries three
 * figures. `top seller` first because it is the rarer fact.
 */
export function agentMark(agent: Agent, all: readonly Agent[], span: Span): AgentMark | null {
  const best = [...all].sort((a, b) => Money.compare(shopBilled(b, span), shopBilled(a, span)))[0];
  if (best?.id === agent.id && orderCount(agent, span) > 0) {
    return { pill: 'top seller', tone: 'info' };
  }
  if (sellsAtShopPrice(agent)) return { pill: 'sells at the shop price', tone: 'warn' };
  return null;
}

/** `Ndeeba round · 21 orders`. */
export const agentNote = (agent: Agent, span: Span): string => {
  const n = orderCount(agent, span);
  return `${agent.round} round · ${n} ${n === 1 ? 'order' : 'orders'}`;
};

/** `21 orders · you kept 12.6%` — the phone's narrower line. */
export const agentNoteShort = (agent: Agent, span: Span): string => {
  const n = orderCount(agent, span);
  return `${n} ${n === 1 ? 'order' : 'orders'} · you kept ${keptReads(agent, span)}`;
};

/** `agent since Jan 2025 · sells on your credit`. */
export const agentSince = (agent: Agent): string =>
  `agent since ${monthLabel(agent.since)} ${agent.since.getUTCFullYear()} · ${
    agent.terms === 'credit' ? 'sells on your credit' : 'pays before the goods leave'
  }`;

/* -------------------------------------------------------------------------- */
/*  The waterfall                                                             */
/* -------------------------------------------------------------------------- */

export interface Waterfall {
  readonly cost: Amount;
  readonly kept: Amount;
  readonly billed: Amount;
  /** Bar widths, as percentages of the row. */
  readonly costWidth: number;
  readonly keptWidth: number;
}

/**
 * Your cost, then what you kept, then the total ruled off.
 *
 * The two component bars share one scale, on which the cost fills seven
 * tenths of the row — the frame's own proportion — so what the shop kept is
 * drawn against what the goods cost rather than against the width of a card.
 * The total's bar is the full width because it is a rule under a sum, not a
 * measurement.
 */
export function waterfall(agent: Agent, span: Span): Waterfall {
  const cost = shopCost(agent, span);
  const keptHere = kept(agent, span);
  const scale = 70;
  return {
    cost,
    kept: keptHere,
    billed: shopBilled(agent, span),
    costWidth: Money.isZero(cost) ? 0 : scale,
    keptWidth: Money.isZero(cost) ? 0 : Math.round((keptHere / cost) * scale * 10) / 10,
  };
}

/**
 * The five months behind the panel's bars, oldest first.
 *
 * Counted off the same order rows the list and the strip read, so the last
 * bar and the row's own order count cannot disagree — which is the whole
 * reason the series is not a field on the record.
 */
export function monthlySeries(agent: Agent, now: Date, months = 5): readonly MonthOrders[] {
  const out: MonthOrders[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const from = utc(now.getUTCFullYear(), now.getUTCMonth() - back, 1);
    const to = utc(from.getUTCFullYear(), from.getUTCMonth() + 1, 1);
    out.push({
      month: monthLabel(from),
      orders: agent.orders.filter((o) => !o.voided && o.taken >= from && o.taken < to).length,
    });
  }
  return out;
}

/** What the five bars say, and why the two lines are read together. */
export function ordersReads(agent: Agent, series: readonly MonthOrders[]): string {
  const first = series[0]?.orders ?? 0;
  const last = series[series.length - 1]?.orders ?? 0;
  const trend =
    last > first ? 'Selling more every month' : last < first ? 'Selling less every month' : 'Selling much the same every month';
  return behind(agent)
    ? `${trend} while settling slower each time. The two lines are worth reading together before extending more credit.`
    : `${trend}, and settling each round as it goes.`;
}

/**
 * The lever, in one sentence: which line his round is made of, what that
 * does to the margin, and which line would move it.
 */
export function linesReads(agent: Agent, span: Span, counter: Counter): string {
  const byShare = [...agent.lines].sort((a, b) => b.shareOfOrders - a.shareOfOrders);
  const most = byShare[0];
  const best = [...agent.lines].sort((a, b) => b.margin - a.margin)[0];
  if (most === undefined || best === undefined) {
    return `No line mix has been worked out for ${agent.name} yet.`;
  }
  // The counter's own margin is what his sits under, so a span the counter
  // sold nothing in has nothing to sit under. The sentence stops at the
  // fact rather than finishing with a comparison it cannot make.
  const against = match(counter.keptPercent, {
    known: (percent) => `sits under the counter's ${percent}%`,
    partial: (percent) => `sits under the counter's ${percent}%`,
    unavailable: () => 'has no counter margin to sit under this time',
  });
  return `His round is mostly ${most.shortName}, which is why the ${keptReads(
    agent,
    span,
  )} the shop keeps here ${against}. Putting ${
    best.shortName
  } in his cluster would move it more than raising ${most.shortName} would.`;
}

/** The tallest bar is 46px; the rest are drawn against it. */
export const BAR_TALLEST = 46;

/** A month's bar height in pixels, against the busiest month in the series. */
export function barHeight(month: MonthOrders, series: readonly MonthOrders[]): number {
  const most = Math.max(...series.map((m) => m.orders), 0);
  if (most === 0) return 0;
  return Math.max(1, Math.round((month.orders / most) * BAR_TALLEST));
}

/** Which month of the series is the one being stood in. */
export const isLatest = (month: MonthOrders, series: readonly MonthOrders[]): boolean =>
  series[series.length - 1]?.month === month.month;

/* -------------------------------------------------------------------------- */
/*  Settling                                                                  */
/* -------------------------------------------------------------------------- */

/** What a settlement takes: the shop price on the orders ticked, and nothing else. */
export const settlementTotal = (agent: Agent, ticked: ReadonlySet<string>): Amount =>
  Money.add(...cycle(agent).filter((o) => ticked.has(o.doc)).map((o) => o.outstanding));

/** What would still be owed after taking it. */
export const leftOwing = (agent: Agent, ticked: ReadonlySet<string>): Amount =>
  Money.subtract(owes(agent), settlementTotal(agent, ticked));

/** Everything that still carries money, ticked. The settlement's own default. */
export const everythingOwed = (agent: Agent): ReadonlySet<string> =>
  new Set(unsettled(agent).map((o) => o.doc));

/**
 * The sentence under a settlement.
 *
 * It states both ends — what is being taken and what is left — because that
 * is the only way the owner can check it rather than believe it.
 */
export function settlementReads(agent: Agent, ticked: ReadonlySet<string>): string {
  const n = unsettled(agent).filter((o) => ticked.has(o.doc)).length;
  const left = leftOwing(agent, ticked);
  const which = `Takes the ${inWords(n)} ticked ${n === 1 ? 'order' : 'orders'} off what he owes.`;
  return Money.isZero(left)
    ? `${which} Nothing is left owing after this.`
    : `${which} ${Money.format(left)} is left owing after this.`;
}

/**
 * What the counter will tell him when his orders are held.
 *
 * This is a record — the words that will reach the agent — so it lives here.
 * The sentence the OWNER reads before deciding is not: each design writes
 * its own, because the desktop has room to add that he keeps seeing his
 * delivered orders in his app and the phone does not.
 */
export const HOLD_WORDS =
  'New orders are on hold until your account is settled. Call the shop.';

/** How many of the shop's agents are behind on the credit they were given. */
export const creditReads = (agents: readonly Agent[]): string => {
  const credit = agents.filter((a) => a.terms === 'credit');
  const late = credit.filter(behind).length;
  return `Goods leave first, settled later. Needs a ceiling, and ${late} of your ${agents.length} are behind on it.`;
};
