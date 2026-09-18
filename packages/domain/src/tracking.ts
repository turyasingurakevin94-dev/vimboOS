/**
 * The stage board's mechanism — how an order crosses from Taken to Invoiced.
 *
 * `orders.ts` holds what a stage IS. This holds what a card DOES, which is a
 * different question and the one the Order-tracking handoff answers:
 *
 * > **The card is a name, a figure and one control. The control IS the
 * > movement, and its shape says what is possible. No sentences explain it.**
 *
 * So the whole of it lives here, not in either design: a chevron, a padlock,
 * a van, a document and a green tick are five answers to "can this move, and
 * what would move it", and the answer must be the same on a 1680px board and
 * in one hand in a yard. Two designs reading one mechanism is the only way
 * they can never disagree about whether an order is stuck.
 *
 * It is also where the handoff's last rule is kept honest:
 *
 * > **Every figure shown twice — the dock tile, the lane header, the card —
 * > must come from one reckoning.**
 *
 * `readBoard` below is that reckoning. `Live`, `To invoice`, the lane counts,
 * the phone's header strip and the `1 of 18 invoiced` line are all fields of
 * one returned object, so there is no second place for them to drift in.
 */

import {
  Money,
  STAGE,
  STAGES,
  hoursWaiting,
  sumDerived,
  type Derived,
  type Stage,
} from './index.js';

/* -------------------------------------------------------------------------- *
 * What is on the board
 * -------------------------------------------------------------------------- */

/** A supplier the order was sent to, and whether they have come back. */
export interface SupplierAsk {
  readonly name: string;
  readonly answered: boolean;
}

/**
 * A pick that came up short: the quantity asked for against the quantity
 * actually found on the shelf.
 *
 * `settled` is the whole point of the type. A short pick is not a problem
 * until somebody has to decide about it, and it is not resolved by being
 * noticed — the order is amended or the full quantity is confirmed out. Until
 * one of those happens the order cannot be loaded, because loading it would
 * bill a customer for goods nobody put on the lorry.
 */
export interface ShortPick {
  readonly asked: number;
  readonly found: number;
  readonly settled: boolean;
}

export interface TrackedOrder {
  /** The number the shop says out loud: `#341`. */
  readonly reference: string;
  readonly customer: string;
  /** Where it is going. Half of why a run is planned the way it is. */
  readonly place: string;
  readonly lines: number;
  /** Lines that have to be bought in before they can be picked. */
  readonly toBuy: number;
  /** Bought-in lines checked in. The Buying meter counts these. */
  readonly checkedIn: number;
  readonly stage: Stage;
  /** When it entered its current stage. Null when the books do not say. */
  readonly since: Date | null;
  readonly value: Derived<Money.Money>;
  readonly suppliers: readonly SupplierAsk[];
  /** Null when the pick found everything, or has not started. */
  readonly shortPick: ShortPick | null;
  readonly packed: boolean;
  /** Who is picking it. Dropped by a step back out of Preparing or Out. */
  readonly picker: string | null;
  /** The run it is out on, and who is driving — `Run 1 · Kizito`. */
  readonly run: string | null;
  /** `INV-0412` once it is invoiced. Null is the whole of "not invoiced". */
  readonly invoice: string | null;
}

/* -------------------------------------------------------------------------- *
 * The limit, and the tone that comes off it
 * -------------------------------------------------------------------------- */

/**
 * How long an order may sit in a lane before sitting still is a question.
 *
 * Presets › Order Tracking owns these; this is the shipped default, and it is
 * what the handoff's board draws. It is deliberately NOT `PATIENCE_HOURS`
 * from `orders.ts` — that table is the decision queue's notion of "somebody
 * should be chased", which is a judgement about people. This is the board's
 * notion of "this card should have moved by now", which is a judgement about
 * work in progress, and the handoff's own frame sets it at twelve hours in
 * every live lane. Delivered is a day because a delivered order sits on the
 * board for a day by design.
 *
 * A card turns amber at HALF the limit and coral past it. One rule, two
 * marks, and the dock's `Past stage limit` counts exactly the coral ones —
 * which is the whole of "one reckoning" for this figure.
 */
export const STAGE_LIMIT_HOURS: Readonly<Record<Stage, number>> = {
  draft: 12,
  awaiting_goods: 12,
  preparing: 12,
  pending_delivery: 12,
  completed: 24,
};

export type AgeTone = 'quiet' | 'closing' | 'past';

export function ageTone(order: TrackedOrder, now: Date): AgeTone {
  const hours = hoursWaiting(order, now);
  if (hours === null) return 'quiet';
  const limit = STAGE_LIMIT_HOURS[order.stage];
  if (hours > limit) return 'past';
  return hours > limit / 2 ? 'closing' : 'quiet';
}

/**
 * `21h 08m`. An em-dash where the books do not say when it arrived.
 *
 * Rounded to the whole minute BEFORE it is split into hours and minutes.
 * Flooring each separately reads a stored 21.1333… as `21h 07m`, because a
 * timestamp a whole number of minutes old is only ever approximately one
 * after a round trip through milliseconds — and an age that is a minute
 * light every time is the kind of wrong nobody reports and everybody
 * distrusts.
 */
export function ageLabel(order: TrackedOrder, now: Date): string {
  const hours = hoursWaiting(order, now);
  if (hours === null) return '—';

  // Past two days the minutes stop meaning anything and the hours stop
  // being readable: the shop's own board carries an order that has sat in
  // Buying since August, and it read `965h 07m`. Nobody converts that. The
  // limit every lane is judged against is in hours, so hours are what a card
  // inside the first two days says; after that the only useful question is
  // how many days, and the card says that instead.
  if (hours >= LONG_WAIT_HOURS) {
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }

  const minutes = Math.round(hours * 60);
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)}h ${rest < 10 ? '0' : ''}${rest}m`;
}

/** Where an age stops being told in hours and starts being told in days. */
export const LONG_WAIT_HOURS = 48;

/* -------------------------------------------------------------------------- *
 * The one control
 * -------------------------------------------------------------------------- */

/**
 * The five shapes a card's control can take.
 *
 * - `chevron` — it can move; pressing it moves it.
 * - `lock`    — something is still owed; it cannot move yet, and `why` names it.
 * - `van`     — loading is the move. There is no forward arrow out of Preparing.
 * - `doc`     — invoice it.
 * - `tick`    — invoiced, and the way to undo it.
 */
export type Control = 'chevron' | 'lock' | 'van' | 'doc' | 'tick';

export interface Move {
  readonly control: Control;
  /** The control's `title`. A padlock that does not say what is owed is a
   * shrug, so every lock's reason names the thing, and who, where there is
   * a who. */
  readonly why: string;
}

/** Suppliers on this order that have not answered yet. */
export const unanswered = (order: TrackedOrder): readonly SupplierAsk[] =>
  order.suppliers.filter((s) => !s.answered);

/** A short pick nobody has settled. It is the whole of Preparing's lock. */
export const heldByPick = (order: TrackedOrder): boolean =>
  order.shortPick !== null && !order.shortPick.settled;

/**
 * What the one control on this card is, and why.
 *
 * Read the lanes downwards: each is "the condition, then the move", and the
 * condition always comes first. An order with nothing bought in has no wait
 * in Taken — there is nobody to answer — so it moves by the chevron.
 */
export function moveFor(order: TrackedOrder): Move {
  switch (order.stage) {
    case 'draft': {
      const waiting = unanswered(order);
      if (waiting.length === 0) return { control: 'chevron', why: 'Move it on' };
      return {
        control: 'lock',
        why: `Cannot move yet — ${waiting.map((s) => s.name).join(', ')} ${
          waiting.length === 1 ? 'has' : 'have'
        } not answered`,
      };
    }
    case 'awaiting_goods': {
      const inNow = order.checkedIn;
      if (inNow >= order.toBuy && order.toBuy > 0) {
        return { control: 'chevron', why: 'Move it on' };
      }
      return {
        control: 'lock',
        why: `Cannot move yet — ${inNow} of ${order.toBuy} lines are in`,
      };
    }
    case 'preparing':
      if (heldByPick(order)) {
        const short = order.shortPick;
        return {
          control: 'lock',
          why: `Cannot move yet — a short pick is not settled${
            short === null ? '' : `: ${short.found} found of ${short.asked} asked`
          }`,
        };
      }
      return { control: 'van', why: 'Say who is carrying it, then Loaded' };
    case 'pending_delivery':
      return { control: 'chevron', why: 'Move it on' };
    case 'completed':
      return order.invoice === null
        ? { control: 'doc', why: 'Invoice it' }
        : { control: 'tick', why: `Invoiced ${order.invoice} — tap to undo` };
  }
}

/* -------------------------------------------------------------------------- *
 * The dot meter, and the two words beside it
 * -------------------------------------------------------------------------- */

export type Segment = 'full' | 'part' | 'empty';

/**
 * Up to six 8 × 4px segments — grey while partial, **green when full.**
 *
 * It replaces the sentence that used to say "4 of 9 items in". Six is the
 * cap because seven segments at eight pixels is a progress bar, and a
 * progress bar is a second expression of a ratio the card already states.
 */
export function meter(done: number, total: number): readonly Segment[] {
  if (total <= 0) return [];
  const n = Math.min(total, 6);
  const filled = Math.round((done / total) * n);
  const complete = filled === n;
  return Array.from({ length: n }, (_, i) =>
    i < filled ? (complete ? 'full' : 'part') : 'empty',
  );
}

/** The meter a card draws — only where there is something to count. */
export const meterFor = (order: TrackedOrder): readonly Segment[] =>
  order.stage === 'awaiting_goods' ? meter(order.checkedIn, order.toBuy) : [];

export type MarkTone = 'waiting' | 'done' | 'quiet';

export interface Mark {
  /** At most two words, and a supplier's name counts as one of them. */
  readonly text: string;
  readonly tone: MarkTone;
}

/**
 * The two words beside the meter, in the ink of their meaning.
 *
 * Null is a real answer and the commonest one: a card with nothing to say
 * says nothing rather than filling the line with `in progress`.
 */
export function markFor(order: TrackedOrder): Mark | null {
  switch (order.stage) {
    case 'draft': {
      const waiting = unanswered(order);
      if (waiting.length > 0) {
        return { text: `waiting: ${waiting[0]?.name ?? ''}`, tone: 'waiting' };
      }
      return order.suppliers.length > 0 ? { text: 'confirmed', tone: 'done' } : null;
    }
    case 'awaiting_goods':
      return order.toBuy > 0 && order.checkedIn >= order.toBuy
        ? { text: 'all in', tone: 'done' }
        : null;
    case 'preparing': {
      const short = order.shortPick;
      if (short !== null && !short.settled) {
        return { text: `short ${short.asked - short.found}`, tone: 'waiting' };
      }
      return order.packed ? { text: 'packed', tone: 'quiet' } : null;
    }
    case 'pending_delivery':
      return order.run === null ? null : { text: order.run, tone: 'quiet' };
    case 'completed':
      return order.invoice === null ? null : { text: 'invoiced', tone: 'done' };
  }
}

/* -------------------------------------------------------------------------- *
 * Stepping back
 * -------------------------------------------------------------------------- */

export interface StepBack {
  readonly from: string;
  readonly to: string;
  /** One sentence of what it costs, said BEFORE it happens. */
  readonly cost: string;
}

/**
 * What stepping this order back would cost.
 *
 * Null for Taken, which has nowhere behind it. Every other lane says the
 * same two things in the same order: what is dropped, and what is NOT
 * touched — because the question the owner actually has is "will this
 * un-bill someone", and the answer is always no.
 */
export function stepBack(stage: Stage): StepBack | null {
  const back: Readonly<Partial<Record<Stage, { readonly to: Stage; readonly cost: string }>>> = {
    awaiting_goods: {
      to: 'draft',
      cost: 'The order goes back to the suppliers it was sent to. Lines already checked in stay checked in.',
    },
    preparing: {
      to: 'awaiting_goods',
      cost: 'The picker is dropped and the pick starts again. Nothing billed is touched.',
    },
    pending_delivery: {
      to: 'preparing',
      cost: 'It comes off the run and the pick starts again. Nothing billed is touched.',
    },
    completed: {
      to: 'pending_delivery',
      cost: 'It goes back on the run as undelivered. An invoice already raised is not touched.',
    },
  };
  const step = back[stage];
  if (step === undefined) return null;
  return { from: STAGE[stage].name, to: STAGE[step.to].name, cost: step.cost };
}

/* -------------------------------------------------------------------------- *
 * Invoicing, and undoing it
 * -------------------------------------------------------------------------- */

/**
 * The four things invoicing does, said before it acts.
 *
 * They are listed rather than summarised because three of the four happen
 * somewhere the owner is not looking: the shelf, the supplier's ledger and
 * the customer's account all move on one press. The old app did all four
 * silently and the first anyone knew of the third was a purchase invoice
 * they had not raised.
 */
export const INVOICING_DOES: readonly string[] = [
  'Stock comes off the shelf, line by line.',
  'Pack-size leftovers go back on.',
  'One purchase invoice per supplier used.',
  'The unpaid rest goes to the customer’s account.',
];

/** The tick reverses all four, and the Cash Book entries with them. */
export const UNDOING_INVOICE_DOES: readonly string[] = [
  'Stock goes back on the shelf, line by line.',
  'Pack-size leftovers come off again.',
  'The purchase invoices it raised are withdrawn.',
  'The customer’s account and the Cash Book entries are reversed.',
];

/** How long an invoiced order stays on the board before it is only Invoices. */
export const INVOICED_STAY_HOURS = 24;

/* -------------------------------------------------------------------------- *
 * The reckoning
 * -------------------------------------------------------------------------- */

export interface LaneReading {
  readonly stage: Stage;
  /** `Taken`. */
  readonly name: string;
  /** What the phone's header strip calls it, where that is shorter. */
  readonly short: string;
  readonly orders: readonly TrackedOrder[];
  readonly count: number;
  /** Four words: what moves an order out of this lane. */
  readonly rule: string;
  /** Cards in this lane whose control is a padlock. */
  readonly locked: number;
  /** Cards past their stage limit. */
  readonly past: number;
  /** What the lane is worth, in the lane's own terms. Never summed across. */
  readonly worth: Derived<Money.Money>;
  /** What to say when the lane is empty. */
  readonly empty: string;
}

export interface Trip {
  /** `Industrial Area, then Ndeeba`. */
  readonly route: string;
  readonly stops: number;
  /** The cash the buyer carries. The dock's `Cash to buy in` IS this. */
  readonly carry: Derived<Money.Money>;
  readonly runs: number;
  readonly overdue: number;
}

export interface BoardTotals {
  /** Every order on the board, in every lane. */
  readonly live: number;
  readonly cashToBuyIn: Derived<Money.Money>;
  readonly pastStageLimit: number;
  readonly toInvoice: number;
  readonly invoiced: number;
  readonly delivered: number;
}

export interface BoardTracking {
  readonly lanes: readonly LaneReading[];
  readonly totals: BoardTotals;
  readonly trip: Trip;
}

/**
 * The lane rules, in four words, as the lane header says them.
 *
 * Delivered's is a figure and so cannot be a constant: `1 of 18 invoiced`
 * has to come off the same lane it heads, or the board states a ratio that
 * nothing computed.
 */
export function laneRule(stage: Stage, orders: readonly TrackedOrder[]): string {
  switch (stage) {
    case 'draft':
      return 'Unlocks when the supplier answers.';
    case 'awaiting_goods':
      return 'Unlocks on the last line in.';
    case 'preparing':
      return 'Loading is the move.';
    case 'pending_delivery':
      return 'Closes on delivery.';
    case 'completed': {
      const done = orders.filter((o) => o.invoice !== null).length;
      return `${done} of ${orders.length} invoiced.`;
    }
  }
}

/** The lane names the phone's five-step header strip uses. */
const SHORT: Readonly<Record<Stage, string>> = {
  draft: 'Taken',
  awaiting_goods: 'Buying',
  preparing: 'Prep',
  pending_delivery: 'Out',
  completed: 'Done',
};

/**
 * The board's own population: everything given to it, less the invoiced work
 * it has finished with.
 *
 * `INVOICED_STAY_HOURS` was declared, documented and never applied, which
 * cost nothing on the example books — every delivery there is hours old —
 * and on the shop's own books put a month of finished orders in Delivered.
 * The lane read 153 where it is drawn for a day of handovers, and
 * `Past stage limit` read 152 of 156, which is a tile saying "everything",
 * which is a tile saying nothing.
 *
 * Only an INVOICED and DELIVERED order leaves. An unbilled handover stays
 * however old it is, because it is still money nobody has charged for; and
 * an order still in Preparing stays even where the books have flagged it
 * invoiced, because the work is in the lane, not in the flag. A card whose
 * books do not say when it arrived also stays: dropping work because the
 * age is unknown is hiding it.
 */
export function onBoard(
  orders: readonly TrackedOrder[],
  now: Date,
): readonly TrackedOrder[] {
  return orders.filter((o) => {
    if (o.stage !== 'completed' || o.invoice === null) return true;
    const hours = hoursWaiting(o, now);
    return hours === null || hours <= INVOICED_STAY_HOURS;
  });
}

/**
 * The board, read once.
 *
 * Both designs call this and render nothing that is not in what it returns.
 * That is the rule that stops the phone's header strip and the desktop's
 * lane headers from ever showing different counts for the same lane.
 */
export function readTracking(
  orders: readonly TrackedOrder[],
  trip: Trip,
  now: Date,
): BoardTracking {
  const on = onBoard(orders, now);

  const lanes = STAGES.map((stage): LaneReading => {
    const inLane = on.filter((o) => o.stage === stage);
    return {
      stage,
      name: STAGE[stage].name,
      short: SHORT[stage],
      orders: inLane,
      count: inLane.length,
      rule: laneRule(stage, inLane),
      locked: inLane.filter((o) => moveFor(o).control === 'lock').length,
      past: inLane.filter((o) => ageTone(o, now) === 'past').length,
      worth: sumDerived(
        inLane.map((o) => o.value),
        `${inLane.length} ${inLane.length === 1 ? 'order' : 'orders'} ${STAGE[stage].money}`,
        (a, b) => Money.add(a, b),
        Money.ZERO,
      ),
      empty: STAGE[stage].empty,
    };
  });

  const delivered = on.filter((o) => o.stage === 'completed');

  return {
    lanes,
    trip,
    totals: {
      live: on.length,
      // The cash to buy in IS what the buyer carries today. One figure, read
      // by the dock tile and by the trip line under it — they sat beside each
      // other in the frame saying 2,180,000 twice, and two sources for one
      // number beside itself is how they start disagreeing.
      cashToBuyIn: trip.carry,
      pastStageLimit: on.filter((o) => ageTone(o, now) === 'past').length,
      toInvoice: delivered.filter((o) => o.invoice === null).length,
      invoiced: delivered.filter((o) => o.invoice !== null).length,
      delivered: delivered.length,
    },
  };
}

/* -------------------------------------------------------------------------- *
 * Waiting on you
 * -------------------------------------------------------------------------- */

/**
 * One decision, with the next marked and two peeked behind it.
 *
 * A list of twenty decisions is a reason to make none of them. The dock
 * points at a card; it does not print a second copy of it, which is why an
 * `Ask` carries the order's reference rather than its whole row.
 */
export interface Ask {
  readonly reference: string;
  readonly customer: string;
  readonly place: string;
  readonly value: Derived<Money.Money>;
  readonly age: string;
  readonly hours: number;
  readonly tone: AgeTone;
  /** Which rule put it here. The screen groups and tests assert on this. */
  readonly reason: AskRule;
  /** Why it is in the queue, said the way the shop would say it. */
  readonly why: string;
  /** The one control. Says what will happen, never `Submit`. */
  readonly act: AskAct;
  /** A second door, only where one honestly exists. */
  readonly instead: AskAct | null;
}

/**
 * What an ask's control does.
 *
 * `door` is the screen it opens. `null` means the act is the card's own
 * control on this board — the queue points at the card rather than growing
 * a second way to do the same thing. A label with nowhere to go and nothing
 * to press is not in this type at all, which is the point: the queue used to
 * carry `instead` strings like `Hold` whose button only served the next ask,
 * and a button that does nothing teaches that the board does nothing.
 */
export interface AskAct {
  readonly label: string;
  readonly door: string | null;
}

/**
 * The six things that put an order in front of the owner.
 *
 * Each one is a decision nobody else in the shop can make, and each is read
 * off the order itself. There is no seventh for "it is taking a while":
 * being slow is what the card's coral age says, and a queue that repeats it
 * is a second reckoning of the board.
 */
export type AskRule =
  | 'supplier-silent'
  | 'nothing-in'
  | 'lane-cannot-unlock'
  | 'short-pick'
  | 'nobody-moved-it'
  | 'not-invoiced';

/** `Shafik Katwe and Roto Industry`. Two names, not `2 suppliers`. */
const namesOf = (list: readonly string[]): string =>
  list.length <= 1
    ? (list[0] ?? '')
    : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1] ?? ''}`;

/** The one rule this order trips, or null. At most one — they are exclusive. */
function askFor(order: TrackedOrder, now: Date): Pick<Ask, 'reason' | 'why' | 'act' | 'instead'> | null {
  // Nothing enters the queue until the board itself says it is late. An
  // order three hours into Buying does not want the owner; it wants the
  // morning.
  //
  // This gate applies to invoicing too, and that was not the first draft.
  // Without it every handover of the day joined the queue the moment it
  // landed: on the example books, seventeen copies of one sentence in front
  // of the five decisions that were actually decisions. Billing the day's
  // deliveries is a job for the end of the day, and the Delivered lane's own
  // `Invoice` door already does it. What the queue is for is the handover
  // that was missed — past a day, still unbilled, still off nobody's books.
  if (ageTone(order, now) !== 'past') return null;

  if (order.stage === 'completed') {
    return order.invoice !== null
      ? null
      : {
          reason: 'not-invoiced',
          why: 'Handed over more than a day ago and still not invoiced — the stock is on the shelf and the customer owes nothing for it.',
          act: { label: 'Invoice it', door: null },
          instead: null,
        };
  }

  const move = moveFor(order);

  switch (order.stage) {
    case 'draft': {
      const silent = unanswered(order);
      if (silent.length === 0) break;
      return {
        reason: 'supplier-silent',
        why: `${namesOf(silent.map((s) => s.name))} ${
          silent.length === 1 ? 'has' : 'have'
        } not answered. Chase them or buy elsewhere.`,
        act: { label: 'Chase them', door: 'messages' },
        instead: { label: 'Other suppliers', door: 'suppliers' },
      };
    }
    case 'awaiting_goods': {
      if (move.control !== 'lock') break;
      // A lane whose rule is "unlocks on the last line in" holds an order
      // with no lines to buy for ever. Nothing but a person gets it out.
      if (order.toBuy === 0) {
        return {
          reason: 'lane-cannot-unlock',
          why: 'Nothing on this order is bought in, so Buying has nothing to unlock it. It has to be moved on by hand.',
          act: { label: 'Move it on', door: null },
          instead: null,
        };
      }
      return {
        reason: 'nothing-in',
        why: `${order.checkedIn} of ${order.toBuy} bought-in ${
          order.toBuy === 1 ? 'line is' : 'lines are'
        } in. Put the rest on a buying list or nobody buys them.`,
        act: { label: 'Buying list', door: 'sourcing' },
        instead: null,
      };
    }
    case 'preparing': {
      const short = order.shortPick;
      if (short === null || short.settled) break;
      return {
        reason: 'short-pick',
        why: `The pick found ${short.found} of ${short.asked}. Amend the order or confirm the full quantity out — until one of those, it cannot be loaded.`,
        act: { label: 'Settle the pick', door: null },
        instead: null,
      };
    }
    case 'pending_delivery':
      break;
  }

  // It can move, it is late, and nobody has moved it. The shortest ask on
  // the board and the one most often true.
  if (move.control === 'chevron') {
    return {
      reason: 'nobody-moved-it',
      why: 'Everything it was waiting for is done and it has not moved.',
      act: { label: 'Move it on', door: null },
      instead: null,
    };
  }

  // Loading is a warehouse job, not a decision, so a van is never an ask.
  return null;
}

/**
 * The queue, read off the board it points at.
 *
 * It takes the whole `BoardTracking` rather than an array of orders so that
 * it cannot see a card the board has dropped. That is not caution: the
 * board's population and its queue sat in two different files reading two
 * different arrays, and the head of this screen printed `54 live · 20 need
 * you` where the twenty came from neither the fifty-four nor anything else.
 *
 * Longest waiting first, and at most one ask per order — a card that is both
 * late and unbilled is one decision, not two.
 */
export function asksFor(board: BoardTracking, now: Date): readonly Ask[] {
  const asks: Ask[] = [];

  for (const lane of board.lanes) {
    for (const order of lane.orders) {
      const rule = askFor(order, now);
      if (rule === null) continue;
      asks.push({
        reference: order.reference,
        customer: order.customer,
        place: order.place,
        value: order.value,
        age: ageLabel(order, now),
        hours: hoursWaiting(order, now) ?? 0,
        tone: ageTone(order, now),
        ...rule,
      });
    }
  }

  return asks.sort(byLongestWaiting);
}

/** What to say when nothing wants the owner. The queue's own empty state. */
export const QUEUE_EMPTY = 'Nothing on the board is waiting on you.';

/** The queue, longest waiting first. */
export const byLongestWaiting = (a: Ask, b: Ask): number => b.hours - a.hours;

/**
 * What each dock tile says under its figure.
 *
 * A basis is not decoration. `54` on its own is not readable and
 * `9 · 14 · 7 · 6 · 18 across the five lanes` is — §1 of the design system
 * makes that a law, and a tile without one is the law broken quietly. The
 * sentence is derived here rather than written on the tile, so it and the
 * figure above it cannot come from two different readings of the board.
 */
export interface DockBasis {
  readonly live: string;
  readonly cashToBuyIn: string;
  readonly pastStageLimit: string;
  readonly toInvoice: string;
}

export const dockBasis = (board: BoardTracking): DockBasis => ({
  live: `${board.lanes.map((l) => l.count).join(' · ')} across the five lanes`,
  cashToBuyIn: `${board.trip.stops} ${board.trip.stops === 1 ? 'stop' : 'stops'} on today’s trip`,
  pastStageLimit: `of ${board.totals.live} on the board, past a ${STAGE_LIMIT_HOURS.draft}h limit`,
  toInvoice: `${board.totals.invoiced} of ${board.totals.delivered} delivered ${
    board.totals.invoiced === 1 ? 'is' : 'are'
  } invoiced`,
});

/** Every lane, as the phone's header strip needs it: name, count, a dot. */
export interface Step {
  readonly stage: Stage;
  readonly label: string;
  readonly count: number;
  /** Amber when some of this lane needs chasing. */
  readonly chasing: boolean;
}

export const steps = (board: BoardTracking): readonly Step[] =>
  board.lanes.map((l) => ({
    stage: l.stage,
    label: l.short,
    count: l.count,
    chasing: l.locked > 0,
  }));

/** A whole board with nothing on it. Screenshot this one. */
export const BOARD_EMPTY = 'No orders on the board. A saved quote lands in Taken.';

/** The legend in the page head — four glyphs, four words. */
export const LEGEND: readonly { readonly control: Control; readonly label: string }[] = [
  { control: 'chevron', label: 'can move' },
  { control: 'lock', label: 'still owed' },
  { control: 'van', label: 'load it' },
  { control: 'doc', label: 'invoice' },
];

/* -------------------------------------------------------------------------- *
 * Reading a lane: the order of the cards, and the window on them
 * -------------------------------------------------------------------------- */

/** Kampala is UTC+3 all year. No table, no ICU, no daylight saving. */
const KAMPALA_MINUTES = 180;

const twoDigits = (n: number): string => `${n < 10 ? '0' : ''}${n}`;

/**
 * When an order was handed over, as the shop says it: `07:40`.
 *
 * Derived from the moment it entered the lane rather than stored beside it.
 * A stored time is a second reckoning of the same fact, and the two disagree
 * the first time a clock is wrong — the frame this board is built from has an
 * order delivered at 11:05 that is also twelve minutes old at 11:00.
 */
export function handedOverAt(order: TrackedOrder): string | null {
  if (order.since === null) return null;
  const local = new Date(order.since.getTime() + KAMPALA_MINUTES * 60_000);
  return `${twoDigits(local.getUTCHours())}:${twoDigits(local.getUTCMinutes())}`;
}

export interface LaneWindow {
  /** The cards the lane draws, oldest at the top. */
  readonly shown: readonly TrackedOrder[];
  /** How many were cut. A truncated list always says how many. */
  readonly behind: number;
  /** `+12 earlier today`, or null when nothing was cut. */
  readonly more: string | null;
}

/**
 * How many of today's deliveries the BOARD keeps, whatever a design draws.
 *
 * Delivered is the one lane with two cuts in it, and they are different
 * questions. The board's cut is "how much of today is still worth looking
 * at" — the recent end, because the morning's deliveries have been dealt
 * with — and it is the same six on a 1680px console and in one hand. The
 * design's cut is how many of those six fit, which is `size`.
 */
export const DELIVERED_WINDOW = 6;

/**
 * The cards a lane draws, and the count it owes for the ones it does not.
 *
 * **Oldest at the top**, which is the board's rule and the reason a lane
 * reads as a queue rather than a pile. It holds inside the Delivered window
 * too: the board takes the recent end of the day and then draws it oldest
 * first, so the lane never changes direction under the eye.
 */
export function laneWindow(lane: LaneReading, now: Date, size: number): LaneWindow {
  const oldestFirst = (a: TrackedOrder, b: TrackedOrder): number =>
    (hoursWaiting(b, now) ?? 0) - (hoursWaiting(a, now) ?? 0);

  const ordered = [...lane.orders].sort(oldestFirst);
  const pool =
    lane.stage === 'completed'
      ? ordered.slice(-Math.max(size, DELIVERED_WINDOW))
      : ordered;
  const shown = pool.slice(0, size);
  const behind = lane.count - shown.length;

  return {
    shown,
    behind,
    more:
      behind === 0
        ? null
        : `+${behind} ${lane.stage === 'completed' ? 'earlier today' : 'more'}`,
  };
}

/* -------------------------------------------------------------------------- *
 * The moves themselves
 * -------------------------------------------------------------------------- */

/**
 * Where the chevron sends an order.
 *
 * Taken with nothing bought in skips Buying altogether — there is nothing to
 * buy, so a lane whose rule is "unlocks on the last line in" would hold it
 * for ever waiting on a line that does not exist. Preparing has no forward
 * chevron at all: `loaded` is its only way out, which is why this returns
 * null for it rather than pretending.
 */
export function nextStage(order: TrackedOrder): Stage | null {
  switch (order.stage) {
    case 'draft':
      return order.toBuy > 0 ? 'awaiting_goods' : 'preparing';
    case 'awaiting_goods':
      return 'preparing';
    case 'preparing':
      return null;
    case 'pending_delivery':
      return 'completed';
    case 'completed':
      return null;
  }
}

/** Move an order on, stamping the moment it entered its new lane. */
export function moveOn(order: TrackedOrder, now: Date): TrackedOrder {
  const to = nextStage(order);
  if (to === null || moveFor(order).control === 'lock') return order;
  return { ...order, stage: to, since: now };
}

/**
 * Loading is Preparing's move: who carries it, and then it is out.
 *
 * The run is not optional. An order out with nobody named on it is the
 * question "where is Kato's cement" with no answer, which is the state the
 * Out lane exists to make impossible.
 */
export function loaded(order: TrackedOrder, run: string, now: Date): TrackedOrder {
  if (order.stage !== 'preparing' || heldByPick(order)) return order;
  return { ...order, stage: 'pending_delivery', run, since: now };
}

/**
 * Step it back one lane, paying what `stepBack` said it would cost.
 *
 * Out of Preparing or Out, the picker is dropped and the pick is reset —
 * both, and here rather than at the call site, because a step back that
 * kept the picker would leave a name against work nobody is doing. Back
 * into Taken the suppliers are asked again; the lines already checked in
 * stay checked in, which is the one thing the sentence promises.
 */
export function steppedBack(order: TrackedOrder, now: Date): TrackedOrder {
  const step: Readonly<Partial<Record<Stage, Stage>>> = {
    awaiting_goods: 'draft',
    preparing: 'awaiting_goods',
    pending_delivery: 'preparing',
    completed: 'pending_delivery',
  };
  const to = step[order.stage];
  if (to === undefined) return order;

  const dropsThePick = order.stage === 'preparing' || order.stage === 'pending_delivery';
  return {
    ...order,
    stage: to,
    since: now,
    picker: dropsThePick ? null : order.picker,
    shortPick: dropsThePick ? null : order.shortPick,
    packed: dropsThePick ? false : order.packed,
    run: order.stage === 'pending_delivery' ? null : order.run,
    suppliers:
      to === 'draft' ? order.suppliers.map((s) => ({ ...s, answered: false })) : order.suppliers,
  };
}

/**
 * A supplier comes back.
 *
 * Taken is the one lane that moves ITSELF — the handoff says so in those
 * words — so this does not merely flip a flag. When the one answering is the
 * last the order was waiting on, the order leaves Taken in the same act, and
 * the owner never has to press a chevron for a thing they did not decide.
 */
export function supplierAnswered(
  order: TrackedOrder,
  name: string,
  now: Date,
): TrackedOrder {
  if (order.stage !== 'draft') return order;
  const suppliers = order.suppliers.map((s) =>
    s.name === name ? { ...s, answered: true } : s,
  );
  const answeredAll = suppliers.every((s) => s.answered);
  const next: TrackedOrder = { ...order, suppliers };
  return answeredAll ? moveOn(next, now) : next;
}

/**
 * A bought-in line arrives and is checked in.
 *
 * Buying does NOT move itself: its rule is *"unlocks on the last line in"*,
 * and unlocking is not moving. The last line in turns the padlock into a
 * chevron and the owner presses it — because an order whose goods are all in
 * still has to be picked by somebody, and the board should not claim that
 * has started.
 */
export function lineCheckedIn(order: TrackedOrder): TrackedOrder {
  if (order.stage !== 'awaiting_goods' || order.checkedIn >= order.toBuy) return order;
  return { ...order, checkedIn: order.checkedIn + 1 };
}

/** Settling a short pick: confirm what was found, or send the pick back. */
export function settledShort(order: TrackedOrder, how: 'amend' | 'confirm'): TrackedOrder {
  const short = order.shortPick;
  if (short === null) return order;
  return how === 'amend'
    ? { ...order, shortPick: null, lines: Math.max(1, order.lines - (short.asked - short.found)) }
    : { ...order, shortPick: { ...short, settled: true } };
}

/** `INV-0413` — one past the highest the board is carrying. */
export function nextInvoiceNumber(orders: readonly TrackedOrder[]): string {
  const highest = orders.reduce((best, o) => {
    const n = Number.parseInt(o.invoice?.replace(/\D/g, '') ?? '', 10);
    return Number.isNaN(n) ? best : Math.max(best, n);
  }, 0);
  return `INV-${String(highest + 1).padStart(4, '0')}`;
}

export const invoiced = (order: TrackedOrder, number: string): TrackedOrder => ({
  ...order,
  invoice: number,
});

/** The tick's own act: everything invoicing did, undone. */
export const notInvoiced = (order: TrackedOrder): TrackedOrder => ({
  ...order,
  invoice: null,
});

/**
 * The runs already carrying orders today, in the order they were named.
 *
 * Loading asks who carries it, and the answer is almost always a run that
 * exists — a free-text driver field is how "Kizito", "kizito" and "Kiz" end
 * up as three runs nobody can reconcile at the end of the day.
 */
export function runsToday(orders: readonly TrackedOrder[]): readonly string[] {
  const seen: string[] = [];
  for (const order of orders) {
    if (order.run !== null && !seen.includes(order.run)) seen.push(order.run);
  }
  return seen;
}
