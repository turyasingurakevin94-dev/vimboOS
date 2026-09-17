/**
 * The order board.
 *
 * The shop is a fulfilment centre, not a shopfront that happens to hold
 * stock: goods bought for an order come IN first and are picked from the
 * shop afterwards. That is why "Buying" is a stage of its own and not a
 * detail of "Preparing" — before it existed, a worker could accept a pick
 * for goods still sitting in a supplier's shop across town.
 *
 * The five stages, their order, and the sentence that says what moves an
 * order out of each one are domain knowledge, not presentation. Both designs
 * read them from here, which is why the phone and the desktop can never
 * disagree about what a lane means.
 *
 * The ids are the values in `saved_quotes.status`. They are kept exactly as
 * the database spells them — a friendlier name here would be one mapping
 * table away from a silent mis-file.
 */

import { Money, combine, known, sumDerived, unavailable, type Derived } from './index.js';

export const STAGES = [
  'draft',
  'awaiting_goods',
  'preparing',
  'pending_delivery',
  'completed',
] as const;

export type Stage = (typeof STAGES)[number];

export interface StageSpec {
  /** 1–5. The owner thinks in steps, and the step is half the meaning. */
  readonly step: number;
  /** What the lane is called. Short — it is a column head, not a sentence. */
  readonly name: string;
  /**
   * What moves an order out of this lane, and whose act that is.
   *
   * These five sentences are the whole contract of the board. Said on the
   * lane itself rather than hidden in a help bubble, because the question
   * "why is this still here" is the one the owner actually has.
   */
  readonly rule: string;
  /**
   * What this lane's money IS — and it is not the same in any two lanes.
   * Money quoted is not money owed, and neither is money on a lorry. A
   * board that totals all five into one figure is stating something false.
   */
  readonly money: string;
  /** What would put an order here. An empty lane must still say something. */
  readonly empty: string;
}

export const STAGE: Readonly<Record<Stage, StageSpec>> = {
  draft: {
    step: 1,
    name: 'Taken',
    rule: 'Suppliers answer, then it moves itself.',
    money: 'quoted',
    empty: 'Nothing taken. A saved quote lands here.',
  },
  awaiting_goods: {
    step: 2,
    name: 'Buying',
    rule: 'Moves on when the last line is checked in.',
    money: 'on order',
    empty: 'Nothing being bought. An order arrives when every supplier on it has confirmed.',
  },
  preparing: {
    step: 3,
    name: 'Preparing',
    rule: 'You pack it, then mark it out.',
    money: 'to pack',
    empty: 'Nothing preparing. Orders arrive here when the last line is checked in.',
  },
  pending_delivery: {
    step: 4,
    name: 'Out',
    rule: 'The run closes it on delivery.',
    money: 'on the road',
    empty: 'Nothing out. Mark a packed order out on a run.',
  },
  completed: {
    step: 5,
    name: 'Delivered',
    rule: 'Today only; older sit in Money.',
    money: 'delivered today',
    empty: 'Nothing delivered today. A run closes an order into this lane.',
  },
};

/**
 * Whose act moves an order on.
 *
 * The board's honesty depends on this. Three of the five lanes wait on
 * somebody who is not the owner, and an order sitting in one of those is not
 * the owner being slow — so the board must not nag about it. Only `owner`
 * lanes produce a decision in the dock.
 */
export const WAITS_ON: Readonly<Record<Stage, 'owner' | 'supplier' | 'worker' | 'driver'>> =
  {
    draft: 'supplier',
    awaiting_goods: 'supplier',
    preparing: 'worker',
    pending_delivery: 'driver',
    completed: 'owner',
  };

/**
 * How long an order may sit in a stage before it is worth a look, in hours.
 *
 * Not a deadline — a shop has no SLA. It is the point past which sitting
 * still stops being normal and starts being a question, and it differs by
 * lane because the acts differ: a pick takes an afternoon, a supplier in
 * Kikuubo takes a day.
 */
export const PATIENCE_HOURS: Readonly<Record<Stage, number>> = {
  draft: 24,
  awaiting_goods: 48,
  preparing: 8,
  pending_delivery: 24,
  completed: 24,
};

/* -------------------------------------------------------------------------- */

export interface Order {
  readonly id: string;
  readonly reference: string;
  readonly customer: string;
  readonly summary: string;
  readonly stage: Stage;
  /** When it entered its current stage. Null when the books do not say. */
  readonly since: Date | null;
  readonly value: Derived<Money.Money>;
  /** Cost of the goods, where the supplier invoices are in. */
  readonly cost: Derived<Money.Money>;
  /** Anything the row could not read, in words. Named rather than dropped. */
  readonly unreadable: readonly string[];
}

/**
 * How far past its lane's patience an order is, in hours. Negative while it
 * is still inside it, null when the books do not say when it arrived.
 *
 * This is the single measure of "worst", and both the dock and the
 * bottleneck rank by it. They used to rank differently — the dock by the
 * order rows happened to arrive in, the bottleneck by a count with ties
 * broken by lane order — so the board could name Buying as the hold-up
 * while the dock served an order from Preparing. Two readings of the same
 * board that disagree is worse than either one alone.
 */
export function hoursOverdue(order: Order, now: Date): number | null {
  const hours = hoursWaiting(order, now);
  return hours === null ? null : hours - PATIENCE_HOURS[order.stage];
}

/** Hours an order has sat in its current stage, or null if unknown. */
export function hoursWaiting(order: Order, now: Date): number | null {
  if (order.since === null) return null;
  return (now.getTime() - order.since.getTime()) / 3_600_000;
}

/**
 * An order that has sat longer than its lane's patience.
 *
 * An order with no `since` is NOT overdue — it is unknown, and treating
 * unknown as fine is the same mistake as treating absent as zero. It shows
 * up in `unknownAge` instead, so the board can say so.
 */
export function isOverdue(order: Order, now: Date): boolean {
  const hours = hoursWaiting(order, now);
  return hours !== null && hours > PATIENCE_HOURS[order.stage];
}

export interface BoardReading {
  readonly byStage: Readonly<Record<Stage, readonly Order[]>>;
  /** The lane holding things up, with why. Null when nothing is stuck. */
  readonly bottleneck: { readonly stage: Stage; readonly overdue: number } | null;
  readonly overdue: readonly Order[];
  /** Orders whose age cannot be read. Reported, never counted as fine. */
  readonly unknownAge: readonly Order[];
}

export function readBoard(orders: readonly Order[], now: Date): BoardReading {
  const byStage = Object.fromEntries(
    STAGES.map((s) => [s, orders.filter((o) => o.stage === s)]),
  ) as Record<Stage, Order[]>;

  const overdue = orders.filter((o) => isOverdue(o, now));
  const unknownAge = orders.filter((o) => o.since === null);

  /**
   * The bottleneck is the lane with the most overdue orders — not the lane
   * with the most orders. A full "Preparing" lane on a busy morning is the
   * shop working; one order stuck there since yesterday is the shop stopped.
   */
  let bottleneck: BoardReading['bottleneck'] = null;
  let worstInBottleneck = -Infinity;
  for (const stage of STAGES) {
    const late = byStage[stage].filter((o) => isOverdue(o, now));
    if (late.length === 0) continue;
    // Ties on count go to the lane holding the single worst order, which is
    // the one the dock is about to serve.
    const worst = Math.max(...late.map((o) => hoursOverdue(o, now) ?? 0));
    const better =
      bottleneck === null ||
      late.length > bottleneck.overdue ||
      (late.length === bottleneck.overdue && worst > worstInBottleneck);
    if (better) {
      bottleneck = { stage, overdue: late.length };
      worstInBottleneck = worst;
    }
  }

  return {
    byStage,
    bottleneck,
    // Worst first, by the same measure the bottleneck uses.
    overdue: [...overdue].sort((a, b) => (hoursOverdue(b, now) ?? 0) - (hoursOverdue(a, now) ?? 0)),
    unknownAge,
  };
}

/**
 * What a lane is worth, in that lane's own terms.
 *
 * Deliberately per-lane and never summed across the board: money quoted is
 * not money owed and neither is money on a lorry. A single "board total"
 * would be a figure that means nothing, stated confidently.
 */
export const laneValue = (
  orders: readonly Order[],
  stage: Stage,
): Derived<Money.Money> =>
  sumDerived(
    orders.map((o) => o.value),
    `${orders.length} ${orders.length === 1 ? 'order' : 'orders'} ${STAGE[stage].money}`,
    (a, b) => Money.add(a, b),
    Money.ZERO,
  );

/**
 * Margin on an order — the one figure the old app got most wrong.
 *
 * It is `unavailable` whenever the cost is, rather than reading a missing
 * supplier invoice as a cost of zero and reporting a margin of 100%. That
 * single bug is the reason `Derived` exists.
 */
export const margin = (order: Order): Derived<Money.Money> =>
  combine([order.value, order.cost] as const, 'value less cost', (value, cost) =>
    Money.subtract(value, cost),
  );

/** Margin across a set of orders, partial the moment any cost is missing. */
export const marginOf = (orders: readonly Order[]): Derived<Money.Money> => {
  if (orders.length === 0) {
    return unavailable('no orders to read a margin from');
  }
  return sumDerived(
    orders.map(margin),
    `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`,
    (a, b) => Money.add(a, b),
    Money.ZERO,
  );
};

/* -------------------------------------------------------------------------- *
 * The decisions dock
 * -------------------------------------------------------------------------- */

/**
 * A list of twenty decisions is not twenty decisions — it is a reason to
 * make none of them. The dock serves ONE at a time, most pressing first.
 */
export interface Decision {
  readonly orderId: string;
  /** What the owner is being asked to decide, in their own words. */
  readonly ask: string;
  /** Why it is being asked now. Always derivable from the board. */
  readonly because: string;
  /** The control's label — says what will happen, never "Submit". */
  readonly act: string;
  readonly urgency: 'bad' | 'warn';
}

/**
 * Decisions, most pressing first.
 *
 * Only lanes that wait on the OWNER produce one. An order sitting in
 * "Buying" is waiting on a supplier in Kikuubo; putting that in the owner's
 * queue would be the board nagging about something no tap of theirs can
 * fix, and a queue that cries wolf stops being read.
 *
 * The exception is an overdue order in someone else's lane: at that point
 * chasing them IS the owner's act, and the ask says so.
 */
export function decisions(board: BoardReading, now: Date): readonly Decision[] {
  const out: Decision[] = [];

  for (const order of board.overdue) {
    const spec = STAGE[order.stage];
    const waits = WAITS_ON[order.stage];
    const hours = hoursWaiting(order, now) ?? 0;
    const waited = hours >= 48 ? `${Math.floor(hours / 24)} days` : `${Math.round(hours)} hours`;

    out.push({
      orderId: order.id,
      ask:
        waits === 'owner'
          ? `${order.customer} — ${spec.rule.replace(/\.$/, '').toLowerCase()}`
          : `Chase the ${waits} on ${order.customer}`,
      because: `${waited} in ${spec.name}, past the ${PATIENCE_HOURS[order.stage]} this lane usually takes`,
      act: waits === 'owner' ? 'Do it now' : `Chase the ${waits}`,
      urgency: 'bad',
    });
  }

  for (const order of board.unknownAge) {
    out.push({
      orderId: order.id,
      ask: `${order.customer} has no date on it`,
      because: 'The books do not say when it reached this lane, so it cannot be chased on time',
      act: 'Open the order',
      urgency: 'warn',
    });
  }

  for (const order of [...board.byStage.completed].slice(0, 3)) {
    out.push({
      orderId: order.id,
      ask: `Invoice ${order.customer}`,
      because: 'Delivered today. It is not money owed until it is invoiced',
      act: 'Draft the invoice',
      urgency: 'warn',
    });
  }

  // Bad before caution, and stable within each — the dock must not reorder
  // itself under the owner's hand while they are reading it.
  return [...out.filter((d) => d.urgency === 'bad'), ...out.filter((d) => d.urgency === 'warn')];
}

/** Expected completion: how long orders have been taking, end to end. */
export const expectedCompletion = (
  recent: readonly { readonly hours: number }[],
): Derived<number> => {
  if (recent.length < 3) {
    return unavailable('not enough delivered orders yet to say how long one takes');
  }
  const hours = [...recent.map((r) => r.hours)].sort((a, b) => a - b);
  const mid = hours[Math.floor(hours.length / 2)];
  if (mid === undefined) return unavailable('no delivered orders to read');
  // The median, not the mean: one order that waited three weeks on a
  // special-order import should not move the number the owner plans by.
  return known(mid, `median of the last ${recent.length} delivered`);
};
