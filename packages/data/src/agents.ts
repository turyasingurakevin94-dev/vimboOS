/**
 * Sales agents, from the real books.
 *
 * ## What the books hold, and what they do not
 *
 * `agents` is a real table on this shop — id, name, phone, `payment_term`,
 * `location`, `unavailable`, `retired_at` — and `saved_quotes.agent_id` is
 * the attribution. That is the whole of it. Everything else the Agents
 * frames draw is a scheme the old app never recorded:
 *
 * | The frame draws | The books hold |
 * | --- | --- |
 * | his cluster, and which supplier funds it | nothing |
 * | `bonusCommission` per order | nothing |
 * | the supplier's monthly payout | nothing |
 * | a credit ceiling | nothing |
 * | a settlement that closes a cycle off | nothing |
 *
 * None of those are read as zero. The cluster is a `Derived` and says so;
 * the payout list is empty, which `commission` already turns into a
 * `claimable` that cannot be derived; and {@link AgentBooks.notRecorded}
 * names all of it in words, once, for the screen to state rather than the
 * screen inventing an empty scheme to draw.
 *
 * ## On this shop, today
 *
 * Two agents, and **no order has ever been attributed to either**: every one
 * of the 181 saved quotes has `agent_id` null, and no payload mentions an
 * agent anywhere. So the screen is empty, and that is the finding — it had
 * been showing 18,420,000 through a channel this shop has never used.
 */

import {
  Money,
  known,
  unavailable,
  type Agent,
  type AgentOrder,
  type Derived,
  type LineShare,
  type Sale,
  type Terms,
} from '@ow/domain';
import { readText } from './boundary.js';
import { current } from './client.js';

export interface AgentBooks {
  readonly agents: readonly Agent[];
  /** Every sale the shop made, for the channel's share of it. */
  readonly sales: readonly Sale[];
  /** What these frames draw that the books do not record, in words. */
  readonly notRecorded: readonly string[];
  /** Rows that were read and could not be understood. */
  readonly unreadable: readonly string[];
}

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

const num = (v: unknown): number | null => {
  const n = Number(v);
  return typeof v !== 'object' && v !== '' && Number.isFinite(n) ? n : null;
};

const day = (v: unknown): Date | null => {
  const text = readText(v);
  if (text === null) return null;
  const at = new Date(text);
  return Number.isNaN(at.getTime()) ? null : at;
};

/**
 * What a quote billed, and what those goods cost the shop.
 *
 * `sellPrice` is what the client was charged and `price` what the shop paid,
 * per line, plus whatever was charged to move it. A line missing either is
 * counted at nothing and named in the tally, because an order valued short
 * is an agent billed short.
 */
function moneyOf(payload: Record<string, unknown>): {
  readonly billed: Money.Money;
  readonly cost: Money.Money;
  readonly blind: number;
} {
  let billed = 0;
  let cost = 0;
  let blind = 0;

  for (const raw of arr(payload.items)) {
    const item = obj(raw);
    if (item === null) continue;
    const qty = num(item.qty);
    const sell = num(item.sellPrice);
    const paid = num(item.price);
    if (qty === null || sell === null || paid === null) {
      blind += 1;
      continue;
    }
    billed += qty * sell;
    cost += qty * paid;
  }

  for (const raw of arr(payload.charges)) {
    const amount = num(obj(raw)?.amount);
    if (amount !== null) billed += amount;
  }

  return { billed: Money.money(Math.round(billed)), cost: Money.money(Math.round(cost)), blind };
}

/** The lines he sells, as a share of his own orders and what each keeps. */
export function linesOf(orders: readonly { readonly payload: Record<string, unknown> }[]): readonly LineShare[] {
  const seen = new Map<string, { orders: number; billed: number; cost: number }>();

  for (const order of orders) {
    const named = new Set<string>();
    for (const raw of arr(order.payload.items)) {
      const item = obj(raw);
      const name = item === null ? null : readText(item.productName);
      if (item === null || name === null) continue;

      const at = seen.get(name) ?? { orders: 0, billed: 0, cost: 0 };
      const qty = num(item.qty) ?? 0;
      at.billed += qty * (num(item.sellPrice) ?? 0);
      at.cost += qty * (num(item.price) ?? 0);
      if (!named.has(name)) {
        at.orders += 1;
        named.add(name);
      }
      seen.set(name, at);
    }
  }

  if (orders.length === 0) return [];

  return [...seen].map(([line, at]) => ({
    line,
    // A row names a line; prose names a thing. `Cement 50kg` becomes
    // `cement`, which is the first word of the line and lower case.
    shortName: (line.split(' ')[0] ?? line).toLowerCase(),
    shareOfOrders: Math.round((at.orders / orders.length) * 100),
    margin: at.billed === 0 ? 0 : Math.round(((at.billed - at.cost) / at.billed) * 100),
  }));
}

/** `prepay` unless the books say otherwise. Anything unrecognised is prepay. */
const termsOf = (v: unknown): Terms => (readText(v) === 'credit' ? 'credit' : 'prepay');

/** One quote, as one of his orders — or null with a reason. */
export function toAgentOrder(raw: unknown): {
  readonly order: AgentOrder | null;
  readonly why: string | null;
} {
  const row = obj(raw);
  const id = row === null ? null : num(row.id);
  if (row === null || id === null) return { order: null, why: 'an order has no id' };

  const doc = `#${id}`;
  const taken = day(row.date);
  if (taken === null) return { order: null, why: `${doc} has no date, so it counts in no month` };

  const payload = obj(row.payload) ?? {};
  const { billed, cost } = moneyOf(payload);
  const paid = num(row.amount_paid) ?? 0;
  const entered = num(payload.stageEnteredAt);

  return {
    why: null,
    order: {
      doc,
      taken,
      // Delivered is the completed lane, and when it got there is the one
      // timestamp the payload keeps. Null while it is still out.
      delivered:
        readText(row.status) === 'completed' && entered !== null ? new Date(entered) : null,
      where: readText(obj(payload.client)?.location) ?? readText(obj(payload.client)?.place) ?? '',
      shopPrice: billed,
      cost,
      // What he charged his own client. The old app records no second price,
      // and null is what this type asks for when it is not known — never the
      // shop price, which would silently assert he adds nothing.
      hisPrice: null,
      outstanding: Money.money(Math.max(0, billed - Math.round(paid))),
      // No settlement is recorded anywhere, so nothing has closed a cycle.
      // An order paid for at pickup still shows, at zero, which is what the
      // settlement list is for.
      settled: false,
      // `bonusCommission` is not in any payload on this shop. Zero is the
      // arithmetic truth — no bonus was recorded, so none was earned — and
      // `notRecorded` says the scheme itself is missing, so the figure is
      // never read as "the supplier paid nothing".
      bonus: Money.ZERO,
      voided: row.voided === true,
    },
  };
}

/** One `agents` row plus the quotes attributed to it. */
function toAgent(
  raw: unknown,
  quotes: readonly unknown[],
): { readonly agent: Agent | null; readonly why: string | null } {
  const row = obj(raw);
  const id = row === null ? null : readText(row.id);
  const name = row === null ? null : readText(row.name);
  if (row === null || id === null) return { agent: null, why: 'an agent has no id' };
  if (name === null) return { agent: null, why: `agent ${id} has no name` };

  const his = quotes.filter((q) => readText(obj(q)?.agent_id) === id);
  const orders: AgentOrder[] = [];
  for (const q of his) {
    const { order } = toAgentOrder(q);
    if (order !== null) orders.push(order);
  }

  return {
    why: null,
    agent: {
      id,
      name,
      since: day(row.created_at) ?? new Date(0),
      round: readText(row.location) ?? '',
      terms: termsOf(row.payment_term),
      // No ceiling is recorded. Null is exactly what this field means when
      // none has been agreed, so nothing is invented here.
      ceiling: null,
      onHold: row.unavailable === true,
      orders,
      cluster: unavailable(
        'the books record no cluster for him — no membership, and no supplier funding one',
      ),
      payouts: [],
      lines: linesOf(his.map((q) => ({ payload: obj(obj(q)?.payload) ?? {} }))),
    },
  };
}

/** What every one of these frames draws that the books do not hold. */
export const NOT_RECORDED: readonly string[] = [
  'which items are in an agent’s cluster, and which supplier funds it',
  'the bonus on an order',
  'the supplier’s monthly payout, which the commission is claimed against',
  'a credit ceiling',
  'a settlement that closes a cycle off',
];

/** Rows in, agents out — with no client anywhere near it. */
export function assembleAgents(
  agentRows: readonly unknown[],
  quoteRows: readonly unknown[],
): AgentBooks {
  const agents: Agent[] = [];
  const unreadable: string[] = [];

  for (const raw of agentRows) {
    const row = obj(raw);
    // A retired agent is off the list, not on it at zero. He is not somebody
    // the shop is waiting on.
    if (row?.retired_at !== null && row?.retired_at !== undefined) continue;

    const { agent, why } = toAgent(raw, quoteRows);
    if (agent === null) {
      if (why !== null) unreadable.push(why);
      continue;
    }
    agents.push(agent);
  }

  const sales: Sale[] = [];
  for (const raw of quoteRows) {
    const row = obj(raw);
    if (row === null || row.voided === true) continue;
    const on = day(row.date);
    if (on === null) continue;
    const { billed, cost } = moneyOf(obj(row.payload) ?? {});
    sales.push({ on, billed, cost, throughAgent: readText(row.agent_id) !== null });
  }

  return { agents, sales, notRecorded: NOT_RECORDED, unreadable };
}

/** The agents, for one shop. */
export async function readAgents(shopId: string): Promise<Derived<AgentBooks>> {
  const { sb } = current();

  const people = await sb
    .from('agents')
    .select('id, name, phone, payment_term, location, unavailable, retired_at, created_at')
    .eq('shop_id', shopId)
    .order('id', { ascending: true });

  if (people.error !== null) return unavailable(`the agents: ${people.error.message}`);

  const quotes = await sb
    .from('saved_quotes')
    .select('id, date, status, invoiced, voided, amount_paid, agent_id, payload')
    .eq('shop_id', shopId);

  if (quotes.error !== null) return unavailable(`what the agents sold: ${quotes.error.message}`);

  const books = assembleAgents(people.data, quotes.data);
  const sold = books.agents.reduce((n, a) => n + a.orders.length, 0);

  return known(
    books,
    `${books.agents.length} ${books.agents.length === 1 ? 'agent' : 'agents'}, ${
      sold === 0 ? 'no order taken through one' : `${sold} orders between them`
    }`,
  );
}
