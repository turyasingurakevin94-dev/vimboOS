/**
 * The Manager's moves — what to do today, ranked.
 *
 * Ported from the old app's `mgrQueueRowHTML` and the `manager_notes` rows
 * behind it (migration 0081). A meeting writes a plan; each move is a row
 * with a title, the reasoning, what it is worth, and a door to the screen
 * where it gets done.
 *
 * ## Nothing here is a state
 *
 * 0081 says it outright: *"OUTCOMES ARE NEVER STORED HERE: what happened to
 * each move is derived from the books at render time … so the account the
 * Manager gives of itself cannot be flattered by anything it wrote."* The
 * row's own `status` records only whether somebody marked it done or set it
 * aside. Whether the chase was actually paid is the customer ledger's
 * answer, and porting that derivation is a separate job — see
 * {@link ManagerMove.outcomeUnported}.
 *
 * ## A figure is a size, not a warning
 *
 * The old app has a scar comment about this worth being rendered in its
 * bad-news crimson, switched on by the figure merely EXISTING — so a move
 * worth 3,330,000 to GAIN drew in the same red as a debt about to go bad,
 * and a move worth nothing drew in calm ink. Exactly backwards. What a move
 * is worth is how big it is; {@link ManagerMove.isGain} says which
 * direction, and a move with no figure on it says so rather than showing a
 * nought.
 */

import { known, unavailable, type Derived } from './derived.js';
import * as Money from './money.js';
import type { Money as Amount } from './money.js';

/**
 * What the figure on a move MEANS.
 *
 * The old app's `MANAGER_WORTH_BASES`, and its wording. The Today handoff
 * uses different words for three of them — "Tied up", "Margin a month",
 * "Sales at risk" — and two of those change the claim rather than shorten
 * it: `loss_avoided` is a gain the shop keeps, where "sales at risk" is an
 * exposure it might lose. The figure is the same either way, so the label
 * that describes it truthfully wins and the difference is raised for design.
 */
export const WORTH_BASES = {
  cash_freed: 'cash tied up',
  profit_30d: 'profit in 30 days',
  loss_avoided: 'loss avoided',
  cost_saved: 'cost saved',
} as const;

export type WorthBasis = keyof typeof WORTH_BASES;

export const isWorthBasis = (v: string): v is WorthBasis => v in WORTH_BASES;

/**
 * Which of them is money the shop GAINS, as opposed to money it has
 * exposed.
 *
 * Freed cash and avoided loss are sizes of something already at stake;
 * profit and saved cost are money arriving. Only the second pair takes the
 * `+` and the good-news ink, which is why this is a set and not a guess at
 * whether the number is positive.
 */
const GAINS = new Set<WorthBasis>(['profit_30d', 'cost_saved']);

/** Which lever a move pulls. The old app's `MANAGER_LEVERS`, unchanged. */
export const LEVERS = ['collect', 'sell', 'buy', 'price', 'cost', 'system'] as const;
export type Lever = (typeof LEVERS)[number];
export const isLever = (v: string): v is Lever => (LEVERS as readonly string[]).includes(v);

/** Where a move gets done. The old app's `MANAGER_DOORS`. */
export const DOORS = {
  chase: { screen: 'messages', label: 'Open the money queue' },
  buy: { screen: 'buying', label: 'Open What to buy' },
  prices: { screen: 'pricing', label: 'Open the Price registry' },
  'prices-watch': { screen: 'pricing', label: 'Open Supplier prices' },
  consignment: { screen: 'consignment', label: 'Open Consignment' },
  orders: { screen: 'orders', label: 'Open Order tracking' },
  invoices: { screen: 'invoices', label: 'Open Invoices' },
  debtors: { screen: 'customers', label: 'Open Debtors' },
  creditors: { screen: 'suppliers', label: 'Open Creditors' },
  followups: { screen: 'messages', label: 'Open Follow-ups' },
  inventory: { screen: 'inventory', label: 'Open Inventory' },
  statements: { screen: 'statements', label: 'Open Statements' },
  whatsapp: { screen: 'messages', label: 'Open WhatsApp' },
  sourcing: { screen: 'sourcing', label: 'Open Sourcing' },
  cashbook: { screen: 'cashbook', label: 'Open the Cash book' },
  payroll: { screen: 'payroll', label: 'Open Payroll & rent' },
  presets: { screen: 'shop', label: 'Open The shop' },
} as const satisfies Record<string, { readonly screen: string; readonly label: string }>;

export type DoorId = keyof typeof DOORS;
export const isDoorId = (v: string): v is DoorId => v in DOORS;

export interface Door {
  readonly id: DoorId;
  readonly screen: string;
  readonly label: string;
}

/** One `manager_notes` move row, read but not yet ranked. */
export interface MoveRecord {
  readonly id: string;
  /**
   * The meeting whose plan this move belongs to.
   *
   * {@link MoveRecord.after} is a position within ONE meeting's plan, and
   * this shop has 39 open moves across several meetings — so a dependency
   * resolved against the whole pile would point at a move from a different
   * week's plan entirely.
   */
  readonly meetingId: string | null;
  readonly title: string;
  readonly why: string;
  /** `null` when the meeting put no figure on it. Never zero. */
  readonly worth: Amount | null;
  readonly worthBasis: string | null;
  readonly lever: string | null;
  readonly unlocks: string | null;
  readonly door: string | null;
  /**
   * The move this one waits on, as a 0-based index into the meeting's own
   * plan in id order — which is why every reading has to sort by id first
   * and resolve this against ALL the meeting's moves, open or not.
   */
  readonly after: number | null;
  /** Whether somebody marked it done or set it aside. Not an outcome. */
  readonly settled: boolean;
}

export interface ManagerMove {
  readonly id: string;
  /** 1-based, within the moves still open. The card's "01 of 08". */
  readonly position: number;
  readonly of: number;
  readonly title: string;
  readonly why: string;
  /** `unavailable` when the meeting named no figure — never a nought. */
  readonly worth: Derived<Amount>;
  /** What the figure means, in words. Empty when there is no figure. */
  readonly worthLabel: string;
  readonly isGain: boolean;
  readonly unlocks: string | null;
  readonly lever: Lever | null;
  readonly door: Door | null;
  /**
   * The move that has to happen first, when it has not happened yet.
   *
   * `null` once the blocker is settled: a move whose dependency is done is
   * not waiting on anything, and saying it is would hold the owner off the
   * one thing they could get on with.
   *
   * Both the position and the title, because the card needs each in a
   * different place. §5's queue-card recipe asks for a terse `waits on 01`
   * chip — a full title there is 60 characters of chip and pushes the
   * figure off the line, which is what putting the title in it looked
   * like. The title belongs in the fold, where there is room to say which
   * thing has to happen first without making the owner count cards.
   */
  readonly waitsOn: { readonly position: number; readonly title: string } | null;
  /**
   * True always, for now, and it is a placeholder with a name.
   *
   * The old app derives each move's real outcome from the books — a chase
   * from the customer's own ledger, a restock from the stock log — and that
   * port is not done. Until it is, a card can say whether somebody marked
   * it done but not whether it WORKED, and a screen must not imply
   * otherwise.
   */
  readonly outcomeUnported: true;
}

const door = (id: string | null): Door | null => {
  if (id === null || !isDoorId(id)) return null;
  const found = DOORS[id];
  return { id, screen: found.screen, label: found.label };
};

/**
 * The open moves, in the order they depend on each other.
 *
 * `all` must be every move in id order, settled ones included, because
 * `after` indexes into a meeting's plan — filtering first would silently
 * repoint every dependency at whichever move rose into the vacated slot.
 *
 * Positions are numbered across the whole open queue, which is what the
 * card's "01 of 08" counts. Dependencies are resolved within a meeting.
 */
export function rankMoves(all: readonly MoveRecord[]): readonly ManagerMove[] {
  const open = all.filter((m) => !m.settled);
  const positionOf = new Map(open.map((m, i) => [m.id, i + 1]));

  const plans = new Map<string, MoveRecord[]>();
  for (const m of all) {
    const key = m.meetingId ?? `loose:${m.id}`;
    const plan = plans.get(key) ?? [];
    plan.push(m);
    plans.set(key, plan);
  }

  return open.map((m, i) => {
    const basis = m.worthBasis !== null && isWorthBasis(m.worthBasis) ? m.worthBasis : null;
    const hasFigure = m.worth !== null && !Money.isZero(m.worth);
    const plan = plans.get(m.meetingId ?? `loose:${m.id}`) ?? [];
    const blocker = m.after === null ? undefined : plan[m.after];

    return {
      id: m.id,
      position: i + 1,
      of: open.length,
      title: m.title,
      why: m.why,
      // `hasFigure` narrows `m.worth` off null on its own — TypeScript
      // infers the predicate from the const, so a second null check here is
      // dead code rather than belt and braces.
      worth: hasFigure
        ? known(m.worth, basis === null ? 'on this move' : WORTH_BASES[basis])
        : unavailable('the meeting put no figure on this one'),
      worthLabel: !hasFigure ? '' : basis === null ? 'on this move' : WORTH_BASES[basis],
      isGain: basis !== null && GAINS.has(basis),
      unlocks: m.unlocks,
      lever: m.lever !== null && isLever(m.lever) ? m.lever : null,
      door: door(m.door),
      waitsOn:
        blocker === undefined || blocker.settled || blocker.id === m.id
          ? null
          : { position: positionOf.get(blocker.id) ?? 0, title: blocker.title },
      outcomeUnported: true,
    };
  });
}
