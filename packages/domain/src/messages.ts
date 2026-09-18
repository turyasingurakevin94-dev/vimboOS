/**
 * Messages — one desk for everything the shop says to someone.
 *
 * Two rail rows become one: **WhatsApp** was the box you write a message in,
 * **Follow-ups** was the list of people owed one, and neither is usable
 * without the other. What replaces them is not a screen with two tabs but a
 * register with lenses, and the lenses are the whole of this module.
 *
 * ## The two rankings are opposites, and that is the point
 *
 * **Money** ranks on what is at stake, and waiting makes a message MORE
 * urgent — the debt is still there tomorrow. **Telling** ranks on *Good
 * until*, and waiting makes a message WORTHLESS — goods somebody asked for
 * are news for a day, a delivery is news until the van arrives, a price cut
 * is news only while the price holds. A single "urgency" would have to pick
 * one of those and be wrong about the other half of the desk, so there are
 * two comparators and each says which way time runs in it.
 *
 * ## Nothing sends itself
 *
 * The app cannot see WhatsApp. Every send is an owner tap, and after the
 * hand-off the owner stamps whether it left; nothing is recorded until they
 * do. So a {@link SentStamp} carries `went`, and a stamp that says it did not
 * go leaves the message still owed. That constraint is not a limitation being
 * apologised for — it is where the record comes from.
 *
 * ## What can fail to derive
 *
 * Cover on a product nothing has sold cannot be derived: dividing a shelf by
 * a rate of zero is not "infinite days of cover", it is a question with no
 * answer, and the row says **no sales** rather than a reassuring figure. The
 * same is true of what a reason was worth after it stopped being true — two
 * of the three expired reasons carried a figure and one did not, so the total
 * is `partial` and says so.
 */

import { known, map, partial, sumDerived, unavailable, type Derived } from './derived.js';
import * as Money from './money.js';
import type { Money as Amount } from './money.js';

const DAY = 86_400_000;

/* -------------------------------------------------------------------------- */
/*  The rules, as numbers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * After how long without a word someone counts as gone quiet.
 *
 * A setting, not a law — it sits on a button in the card header, beside the
 * list it changes, because a number that changes who is in a list belongs
 * next to that list and not above the figures as the screen's first question.
 */
export const QUIET_AFTER_DAYS = 14;

/**
 * Three posts a day, and the reason is on the screen: a fourth post in a day
 * halved the replies. The posts start competing with each other.
 */
export const DAILY_POST_CAP = 3;

/**
 * A reason that quietly stopped being true is kept for a week.
 *
 * A queue that silently drops what it failed to do teaches nothing. Two of
 * the three the shop last missed were worth 390,000, and the only way anyone
 * learns that is if they are still on the screen.
 */
export const EXPIRED_KEPT_DAYS = 7;

/** Chats stay on the desk for thirty days, and the list says so. */
export const CHATS_KEPT_DAYS = 30;

/** The linking square, and the typed code beside it. A new one is free. */
export const LINK_CODE_SECONDS = 60;

/**
 * Below a week of cover, a post would sell what the shop cannot deliver.
 *
 * A post lands for about that long — the replies to one arrive over days, not
 * minutes — so a shelf that cannot carry a week cannot carry the post.
 */
export const COVER_FLOOR_DAYS = 7;

export const LENSES = ['money', 'telling', 'posting', 'inbox'] as const;
export type Lens = (typeof LENSES)[number];

/** Which meaning family a chip on this desk wears. */
export type Tone = 'bad' | 'caution' | 'good' | 'info' | 'studied' | 'neutral';

/* -------------------------------------------------------------------------- */
/*  Days                                                                      */
/* -------------------------------------------------------------------------- */

const midnight = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Whole days between two dates, counted by the calendar and not by the clock.
 *
 * "Good until today" has to mean today for every hour of it. Counting on
 * elapsed milliseconds makes a reason expire at two in the afternoon because
 * it was entered at two the previous afternoon, which is not what anybody
 * means by a day.
 */
export const daysBetween = (from: Date, to: Date): number =>
  Math.round((midnight(to) - midnight(from)) / DAY);

/* -------------------------------------------------------------------------- */
/*  Holding someone                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The reason is the point of a hold, so it is offered as four words rather
 * than a blank box — a blank box gets left blank, and a hold with no reason
 * is indistinguishable from someone being forgotten.
 */
export const HOLD_REASONS = [
  { id: 'paying', label: 'Paying already' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'bad-time', label: 'Bad time to ask' },
  { id: 'other', label: 'Other' },
] as const;

export type HoldReasonId = (typeof HOLD_REASONS)[number]['id'];

export interface Hold {
  readonly reason: HoldReasonId;
  /** Free text under the reason. The promise already in the thread, usually. */
  readonly note: string | null;
  /**
   * When the hold lifts. `null` is a hold with no date — allowed, offered as
   * *No date*, and the one shape of hold that can hide someone forever, which
   * is why the default is the promise already in the thread instead.
   */
  readonly until: Date | null;
}

/** A hold expires. It is not deleted — the reason stays on the record. */
export const holdLifted = (hold: Hold, now: Date): boolean =>
  hold.until !== null && daysBetween(now, hold.until) <= 0;

export const holdLabel = (reason: HoldReasonId): string =>
  HOLD_REASONS.find((r) => r.id === reason)?.label ?? 'Other';

/* -------------------------------------------------------------------------- */
/*  Stamping a hand-off                                                       */
/* -------------------------------------------------------------------------- */

export interface SentStamp {
  readonly on: Date;
  readonly by: string;
  /**
   * Whether it actually left. The app handed the draft to WhatsApp and then
   * lost sight of it; this is the owner coming back and saying. `false` is a
   * real answer and leaves the message owed.
   */
  readonly went: boolean;
}

/* -------------------------------------------------------------------------- */
/*  The Money lens                                                            */
/* -------------------------------------------------------------------------- */

export type OwedState = 'draft' | 'sent' | 'held';

export interface ChaseAttempt {
  readonly on: Date;
  readonly what: string;
  readonly outcome: 'silent' | 'promised' | 'paid';
}

export interface Owed {
  readonly id: string;
  readonly name: string;
  /** Two letters, for the avatar. Drawn, never derived from a photo. */
  readonly initials: string;
  readonly tone: Tone;
  readonly phone: string;
  readonly place: string | null;
  /** What the message is about, in the shop's words. */
  readonly about: string;
  readonly atStake: Amount;
  /**
   * The invoice behind the balance, or `null` when there is none — a figure
   * carried onto the account from earlier. That is not a missing field: it
   * changes what the message can ask for, so the draft asks for the total and
   * offers to check it.
   */
  readonly invoice: string | null;
  /** The age of the oldest part of the balance. */
  readonly oldestDays: number;
  /** When it fell due. A balance carried onto an account is due on sight. */
  readonly dueOn: Date | null;
  /** The last time the shop said anything. `null` is a first ask. */
  readonly lastWord: Date | null;
  readonly chases: number;
  readonly everPaid: boolean;
  readonly history: readonly ChaseAttempt[];
  /** The box is what ships, so the draft is data and not a template id. */
  readonly draft: string;
  readonly hold: Hold | null;
  readonly stamp: SentStamp | null;
  /** Whether they have answered the last thing sent. */
  readonly replied: boolean;
}

/** How long this row has been waiting for a word. */
export const waitedDays = (row: Owed, now: Date): number =>
  row.lastWord === null ? row.oldestDays : daysBetween(row.lastWord, now);

/** How far past the shop's terms the balance has run. */
export const pastTermsDays = (row: Owed, now: Date): Derived<number> =>
  row.dueOn === null
    ? unavailable('no terms recorded on this account, so nothing is past them')
    : known(Math.max(0, daysBetween(row.dueOn, now)), 'today against the day it fell due');

export const stateOf = (row: Owed, now: Date): OwedState => {
  if (row.hold !== null && !holdLifted(row.hold, now)) return 'held';
  if (row.stamp !== null && row.stamp.went && !row.replied) return 'sent';
  return 'draft';
};

/** Has this one gone quiet — no word back for longer than the setting? */
export const goneQuiet = (row: Owed, now: Date, after = QUIET_AFTER_DAYS): boolean =>
  stateOf(row, now) === 'sent' && waitedDays(row, now) >= after;

/**
 * Most at stake first; among equals, the one that has waited longest.
 *
 * Both halves matter and the order between them is the design decision. What
 * is at stake leads because it is the money; waiting breaks the tie because
 * on this lens an unsent message gets more urgent every day, never less. A
 * comparator that led on the date would put a 30,000 balance from last month
 * above a 2,410,000 one from last week, which is the list the shop already
 * has and does not read.
 */
export const byStake =
  (now: Date) =>
  (a: Owed, b: Owed): number => {
    const stake = Money.compare(b.atStake, a.atStake);
    return stake !== 0 ? stake : waitedDays(b, now) - waitedDays(a, now);
  };

export interface ChaseRecord {
  /** Messages sent in the window. The record is the register's Sent group. */
  readonly sent: number;
  /** How many of them were followed by money. */
  readonly paid: number;
  /** Mean days from the message to the money. */
  readonly daysToMoney: number;
  readonly overDays: number;
  /** Reply rate when the message asks for a date, and when it asks for the
   * amount alone. The draft asks for a date because of this pair. */
  readonly repliedAskingDate: number;
  readonly repliedAskingAmount: number;
}

export const paidShare = (r: ChaseRecord): Derived<number> =>
  r.sent === 0
    ? unavailable('nothing has been sent yet, so there is no share to take')
    : known(Math.round((r.paid / r.sent) * 100), `${r.paid} of ${r.sent} sent`);

export interface MoneyDesk {
  /** Who is owed a word today, ranked. */
  readonly toMessage: readonly Owed[];
  /** Sent, waiting on a reply. */
  readonly sentWaiting: readonly Owed[];
  /** Held, with the reason showing. They stay in the list, above it. */
  readonly held: readonly Owed[];
  /** What is riding on the messages not yet sent. */
  readonly riding: Amount;
  /** The oldest thing still waiting on a reply. */
  readonly oldestWaitingDays: Derived<number>;
  /** How many have gone quiet by the current setting. */
  readonly quiet: number;
  readonly quietAfterDays: number;
}

export function moneyDesk(
  rows: readonly Owed[],
  now: Date,
  quietAfterDays = QUIET_AFTER_DAYS,
): MoneyDesk {
  const held = rows.filter((r) => stateOf(r, now) === 'held');
  const sentWaiting = rows.filter((r) => stateOf(r, now) === 'sent');
  const toMessage = rows.filter((r) => stateOf(r, now) === 'draft').sort(byStake(now));

  const waits = sentWaiting.map((r) => waitedDays(r, now));

  return {
    toMessage,
    sentWaiting,
    held,
    riding: Money.add(...toMessage.map((r) => r.atStake)),
    oldestWaitingDays:
      waits.length === 0
        ? unavailable('nothing is waiting on a reply')
        : known(Math.max(...waits), `the oldest of ${waits.length} waiting`),
    quiet: sentWaiting.filter((r) => goneQuiet(r, now, quietAfterDays)).length,
    quietAfterDays,
  };
}

/* -------------------------------------------------------------------------- */
/*  The Telling lens                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The three kinds of fact worth telling a person by name, and they do not
 * rank against each other by what they might sell.
 *
 * A delivery landing this afternoon earns no order at all — it prevents a
 * phone call. Ranked on money it would always come last; ranked on how soon
 * it stops being true it is top, which is correct, because tomorrow it is
 * worth nothing.
 */
export type TellingKind = 'asked-for' | 'delivery' | 'price-move' | 'back-in-stock';

/** A fact about a product goes to Posting; a fact about a person is Telling. */
export type TellingRoute = 'tell' | 'post';

export type GoodUntil =
  | { readonly kind: 'day'; readonly on: Date }
  /** A price cut is news only while the price holds, and nobody knows when
   * it stops. Not a missing date — a different shape of one. */
  | { readonly kind: 'while-it-holds' };

export interface Telling {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly tone: Tone;
  readonly kind: TellingKind;
  /** What you would say, in one line. A fact from the books, not a greeting. */
  readonly what: string;
  readonly whyThem: string;
  readonly whyTone: Tone;
  readonly goodUntil: GoodUntil;
  readonly route: TellingRoute;
  /** Where it sits in the posting queue, when the route is a post. */
  readonly routeNote: string | null;
  /** What it was worth, where the books can say. */
  readonly worth: Amount | null;
  /**
   * Why it stopped being true, when something other than the calendar ended
   * it — the price went back up, they bought it elsewhere.
   */
  readonly stoppedBeingTrue: { readonly on: Date; readonly because: string } | null;
  readonly draft: string | null;
}

/**
 * Expiry is computed, never typed.
 *
 * Two ways a reason stops being worth saying: the day it was good until has
 * passed, or the fact underneath it changed. Neither is a flag somebody
 * remembers to set.
 */
export const expiredOn = (t: Telling): Date | null =>
  t.stoppedBeingTrue !== null ? t.stoppedBeingTrue.on : null;

export const isExpired = (t: Telling, now: Date): boolean =>
  t.stoppedBeingTrue !== null ||
  (t.goodUntil.kind === 'day' && daysBetween(now, t.goodUntil.on) < 0);

/** Days left before it stops being true. A price cut has no such number. */
export const goodUntilDays = (t: Telling, now: Date): Derived<number> =>
  t.goodUntil.kind === 'while-it-holds'
    ? unavailable('good only while the price holds, and nobody sets that date')
    : known(daysBetween(now, t.goodUntil.on), 'the day it stops being true, from today');

/** The word in the ranking column. This is what the Telling lens ranks on. */
export function goodUntilLabel(t: Telling, now: Date): string {
  if (isExpired(t, now)) return 'expired';
  if (t.goodUntil.kind === 'while-it-holds') return 'while it holds';
  const days = daysBetween(now, t.goodUntil.on);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `${days} days`;
}

/** Kept for a week after it expired, then dropped. */
export const dropped = (t: Telling, now: Date): boolean => {
  if (!isExpired(t, now)) return false;
  const on = expiredOn(t) ?? (t.goodUntil.kind === 'day' ? t.goodUntil.on : null);
  return on !== null && daysBetween(on, now) > EXPIRED_KEPT_DAYS;
};

/**
 * Soonest to go stale, first. A reason with no end date sorts last, because
 * "while it holds" is the one thing on this lens that waiting does not spend.
 */
export const byGoodUntil =
  (now: Date) =>
  (a: Telling, b: Telling): number => {
    const days = (t: Telling): number =>
      t.goodUntil.kind === 'while-it-holds'
        ? Number.MAX_SAFE_INTEGER
        : daysBetween(now, t.goodUntil.on);
    return days(a) - days(b);
  };

export interface TellingRecord {
  /** Told, and it ended in an order, over the window. */
  readonly led: number;
  readonly of: number;
  readonly bought: Amount;
  readonly withinDays: number;
  readonly overDays: number;
  /** How each kind of reason has done: told, and how many bought. */
  readonly byKind: ReadonlyMap<TellingKind, { readonly moved: number; readonly of: number }>;
}

export const kindShare = (
  record: TellingRecord,
  kind: TellingKind,
): Derived<number> => {
  const row = record.byKind.get(kind);
  if (row === undefined || row.of === 0) {
    return unavailable(`nothing of this kind has been told yet`);
  }
  return known(Math.round((row.moved / row.of) * 100), `${row.moved} of ${row.of} bought`);
};

/** The kind of reason that has worked best. The screen names it by hand. */
export function bestKind(record: TellingRecord): TellingKind | null {
  let best: TellingKind | null = null;
  let bestShare = -1;
  for (const [kind, row] of record.byKind) {
    if (row.of === 0) continue;
    const share = row.moved / row.of;
    if (share > bestShare) {
      bestShare = share;
      best = kind;
    }
  }
  return best;
}

export interface TellingDesk {
  /** The reasons to speak, soonest to go stale first. */
  readonly speak: readonly Telling[];
  /** Outside the three: a fact about a product, which the queue does better. */
  readonly betterPosted: readonly Telling[];
  /** What quietly stopped being true, kept for a week. */
  readonly expired: readonly Telling[];
  /** Say today or not at all. */
  readonly sayToday: number;
  /**
   * What the expired ones were worth. `partial` when one of them carried no
   * figure — which is the case, and the screen says "two of the three".
   */
  readonly expiredWorth: Derived<Amount>;
}

export function tellingDesk(rows: readonly Telling[], now: Date): TellingDesk {
  const live = rows.filter((t) => !isExpired(t, now));
  const expired = rows.filter((t) => isExpired(t, now) && !dropped(t, now));

  return {
    speak: live.filter((t) => t.route === 'tell').sort(byGoodUntil(now)),
    betterPosted: live.filter((t) => t.route === 'post'),
    expired,
    sayToday: live.filter((t) => t.route === 'tell' && goodUntilLabel(t, now) === 'today')
      .length,
    expiredWorth: sumDerived(
      expired.map((t) =>
        t.worth === null
          ? unavailable<Amount>(`nothing on file for what ${t.name} was worth`)
          : known(t.worth, 'what the row was worth when it was live'),
      ),
      'the expired reasons, added up',
      (a, b) => Money.add(a, b),
      Money.ZERO,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/*  The Posting lens                                                          */
/* -------------------------------------------------------------------------- */

export const SIGNALS = [
  'price-cut',
  'idle-stock',
  'goes-together',
  'season-starting',
  'margin',
] as const;

export type Signal = (typeof SIGNALS)[number];

export interface PostCard {
  readonly spec: string;
  readonly price: Amount;
  /** The price it was, when the signal is a cut. */
  readonly wasPrice: Amount | null;
  readonly onHandSaid: string;
  readonly phone: string;
  readonly place: string;
  /** No photo means a price card is drawn instead, and the row says so. */
  readonly photo: boolean;
  /** The box is what ships. */
  readonly message: string;
}

export interface Post {
  readonly id: string;
  readonly product: string;
  /** Why it is here, in the books' own words. Every row says this. */
  readonly why: string;
  readonly signal: Signal;
  readonly onHand: number;
  /** Units a day, over the window. Zero is idle stock, not a small number. */
  readonly soldPerDay: number;
  readonly sellPrice: Amount;
  /** What the shop paid. `null` when no supplier price is on file. */
  readonly costPrice: Amount | null;
  /**
   * How strongly THIS row shows its signal, nought to one. An eight per cent
   * cut is a stronger price cut than a two per cent one, and two products
   * wearing the same chip are not the same nomination.
   */
  readonly strength: number;
  readonly picked: boolean;
  readonly card: PostCard | null;
}

/**
 * Days of cover: the shelf divided by the rate it leaves at.
 *
 * A product nothing has sold has no rate, and a shelf divided by zero is not
 * "forever" — it is a question with no answer. The row says **no sales**, and
 * because the answer is missing rather than small, idle stock is not held
 * back: there is plenty on the shelf, which is the whole reason it is here.
 */
export function coverDays(p: Post): Derived<number> {
  if (p.soldPerDay <= 0) {
    return unavailable('nothing has sold, so there is no rate to divide the shelf by');
  }
  return known(
    Math.round(p.onHand / p.soldPerDay),
    `${p.onHand} on the shelf over ${p.soldPerDay} a day`,
  );
}

/** What is left after the supplier price. Zero is *at cost*, and is a fact. */
export function keepShare(p: Post): Derived<number> {
  if (p.costPrice === null) return unavailable('no supplier price on file');
  if (Money.isZero(p.sellPrice)) {
    return partial(0, 'a product with no price', 'nothing to take a share of');
  }
  return known(
    Math.round(((p.sellPrice - p.costPrice) / p.sellPrice) * 100),
    'the price less what it cost',
  );
}

/**
 * Held back when the shelf cannot fill what a post would bring in.
 *
 * Only a cover that is KNOWN and short holds a product back. A cover that
 * could not be derived means nothing is selling, and a full shelf can fill
 * anything.
 */
export const heldBack = (p: Post): boolean => {
  const cover = coverDays(p);
  return cover.status !== 'unavailable' && cover.value < COVER_FLOOR_DAYS;
};

export interface SignalRecord {
  readonly signal: Signal;
  readonly moved: number;
  readonly of: number;
}

export const signalShare = (r: SignalRecord): Derived<number> =>
  r.of === 0
    ? unavailable('nothing with this signal has been posted yet')
    : known(Math.round((r.moved / r.of) * 100), `${r.moved} of ${r.of} posted`);

/**
 * What the record actually says, in a sentence.
 *
 * It was prose under the bars: *"Of 0 posts stamped in 30 days, a price cut
 * moved the line five times out of six. Idle stock almost never moves on a
 * post alone."* Two claims about a record with nothing in it, contradicting
 * the figure in their own first clause — and the bars above them, which do
 * read `signalShare` and were therefore all empty.
 *
 * Derived here so the sentence and the bars cannot drift, and so the
 * sentence a shop with no history reads is the one true thing there is to
 * say: nothing has been stamped, so nothing is known yet.
 */
export function signalRecordReads(
  records: readonly SignalRecord[],
  overDays: number,
): string {
  const stamped = records.filter((r) => r.of > 0);

  if (stamped.length === 0) {
    return `Nothing has been posted and stamped in ${overDays} days, so nothing here knows which signal sells yet. Say whether a post went out and what came of it, and this fills in.`;
  }

  const ranked = [...stamped].sort((a, b) => b.moved / b.of - a.moved / a.of);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const posts = stamped.reduce((n, r) => n + r.of, 0);
  const share = (r: SignalRecord): string => `${r.moved} of ${r.of}`;

  if (best === undefined) return '';
  if (worst === undefined || best === worst) {
    return `Of ${posts} posts stamped in ${overDays} days, ${best.signal.replace('-', ' ')} moved the line ${share(best)} times.`;
  }

  return `Of ${posts} posts stamped in ${overDays} days, ${best.signal.replace(
    '-',
    ' ',
  )} moved the line ${share(best)} times and ${worst.signal.replace('-', ' ')} ${share(worst)}.`;
}

export interface PostingDesk {
  /** Nominated, ranked by the signal, minus what the shelf cannot carry. */
  readonly queue: readonly Post[];
  readonly held: readonly Post[];
  readonly picked: readonly Post[];
  readonly cap: number;
  readonly placesLeft: number;
  /** What rolls to tomorrow if nothing else is picked today. */
  readonly rollsOver: number;
}

/**
 * What a nomination is worth today: the signal's own record, weighted by how
 * strongly this row shows it.
 *
 * Ranking on what a product is worth would put the widest margin first every
 * single day. Ranking on the signal alone would put every price cut above
 * every pairing, however slight the cut. The queue says "ranked by the
 * signal", and this is what that sentence has to mean to be usable.
 */
export function nominationScore(p: Post, records: readonly SignalRecord[]): Derived<number> {
  const record = records.find((r) => r.signal === p.signal);
  if (record === undefined) {
    return unavailable(`nothing with the ${p.signal} signal has been posted yet`);
  }
  return map(signalShare(record), (share) => (share / 100) * p.strength);
}

export function postingDesk(
  posts: readonly Post[],
  records: readonly SignalRecord[],
  cap = DAILY_POST_CAP,
): PostingDesk {
  const score = (p: Post): number => {
    const s = nominationScore(p, records);
    return s.status === 'unavailable' ? -1 : s.value;
  };

  /**
   * The held group is ranked by what is left on the shelf, thinnest first.
   *
   * They are all held for the same reason, so the only thing that separates
   * them is how close each is to being postable — and the shop reads the
   * group to know what to reorder, which is the thinnest shelf first.
   */
  const cover = (p: Post): number => {
    const d = coverDays(p);
    return d.status === 'unavailable' ? Number.MAX_SAFE_INTEGER : d.value;
  };
  const held = posts.filter(heldBack).sort((a, b) => cover(a) - cover(b));
  /**
   * What is already picked holds the top of the queue, in the order it was
   * picked. The numbers down the left are the day's three places, not a
   * league table — a pick that fell to fourth the moment a better nomination
   * arrived would make the day's plan unreadable.
   */
  const queue = posts
    .filter((p) => !heldBack(p))
    .sort((a, b) => Number(b.picked) - Number(a.picked) || score(b) - score(a));
  const picked = queue.filter((p) => p.picked);

  return {
    queue,
    held,
    picked,
    cap,
    placesLeft: Math.max(0, cap - picked.length),
    rollsOver: queue.length - picked.length,
  };
}

/* -------------------------------------------------------------------------- */
/*  The Inbox lens                                                            */
/* -------------------------------------------------------------------------- */

/**
 * What a chat is about, which is the thing that makes the Inbox a lens on
 * this desk rather than a chat app bolted to the side of it. A reply can be
 * written without leaving, because the invoice, the order, or the absence of
 * either is already on the row.
 */
export type ChatAbout =
  | { readonly kind: 'invoice'; readonly doc: string; readonly owes: Amount; readonly days: number }
  | { readonly kind: 'order'; readonly doc: string; readonly line: string }
  | { readonly kind: 'supplier'; readonly line: string }
  | { readonly kind: 'none'; readonly line: string };

export interface ChatLine {
  readonly from: 'them' | 'us';
  readonly text: string;
  readonly at: Date;
  readonly by: string | null;
}

export interface Chat {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly tone: Tone;
  readonly phone: string;
  readonly at: Date;
  readonly preview: string;
  readonly about: ChatAbout;
  readonly lines: readonly ChatLine[];
  /** A figure named in the thread that could be recorded as a promise. */
  readonly promised: Amount | null;
}

export const aboutMoney = (c: Chat): boolean => c.about.kind === 'invoice';

export interface Link {
  readonly linked: boolean;
  /** Short-lived, and a new one is free. */
  readonly code: string;
  readonly issuedAt: Date;
}

export const codeAlive = (link: Link, now: Date): boolean =>
  now.getTime() - link.issuedAt.getTime() < LINK_CODE_SECONDS * 1000;

/**
 * The Inbox does not exist while the number is unlinked.
 *
 * `null`, not an empty array — and the difference is the whole argument of
 * the third turn. An empty inbox is a screen saying "nothing to show" about a
 * connection nobody ever made, three times over. A lens that is absent says
 * the same thing once, in the place where it would appear.
 */
export const inbox = (chats: readonly Chat[], link: Link, now: Date): readonly Chat[] | null =>
  link.linked
    ? [...chats]
        .filter((c) => daysBetween(c.at, now) <= CHATS_KEPT_DAYS)
        .sort((a, b) => b.at.getTime() - a.at.getTime())
    : null;

/* -------------------------------------------------------------------------- */
/*  The desk                                                                  */
/* -------------------------------------------------------------------------- */

export interface Desk {
  readonly owed: readonly Owed[];
  readonly telling: readonly Telling[];
  readonly posts: readonly Post[];
  readonly chats: readonly Chat[];
  readonly link: Link;
  readonly chaseRecord: ChaseRecord;
  readonly tellingRecord: TellingRecord;
  readonly signalRecords: readonly SignalRecord[];
  /** Money the shop can read against posts it stamped. */
  readonly soldAfterPosts: { readonly amount: Amount; readonly posts: number; readonly withinDays: number };
}

export interface LensCount {
  readonly lens: Lens;
  readonly count: number;
  /** Whether the count means something WANTS you, which is a pill not a number. */
  readonly wants: boolean;
  readonly tone: Tone;
}

/**
 * The count under each lens, from one reckoning.
 *
 * Every figure on this desk is counted once and read everywhere — the lens
 * chip, the tile above the list and the panel beside it are three readings of
 * the same number, never three calculations that happen to agree. The Inbox
 * is absent rather than zero while the number is unlinked.
 */
export function lensCounts(desk: Desk, now: Date): readonly LensCount[] {
  const money = moneyDesk(desk.owed, now);
  const telling = tellingDesk(desk.telling, now);
  const posting = postingDesk(desk.posts, desk.signalRecords);
  const chats = inbox(desk.chats, desk.link, now);

  const counts: LensCount[] = [
    {
      lens: 'money',
      count: money.toMessage.length,
      wants: money.toMessage.length > 0,
      tone: money.toMessage.length > 0 ? 'bad' : 'neutral',
    },
    {
      lens: 'telling',
      count: telling.speak.length,
      wants: telling.sayToday > 0,
      tone: telling.speak.length > 0 ? 'info' : 'neutral',
    },
    // Posting is never a demand. Nobody is owed a post, and a pill that said
    // they were would be the screen inventing an obligation.
    { lens: 'posting', count: posting.queue.length, wants: false, tone: 'neutral' },
  ];

  if (chats !== null) {
    counts.push({
      lens: 'inbox',
      count: chats.length,
      wants: chats.length > 0,
      tone: chats.length > 0 ? 'bad' : 'neutral',
    });
  }

  return counts;
}

/** What the money lens's first tile says, as one reckoning. */
export interface RidingOnIt {
  readonly count: number;
  readonly amount: Amount;
  readonly pastTerms: Derived<number>;
}

export function ridingOnIt(rows: readonly Owed[], now: Date): RidingOnIt {
  const desk = moneyDesk(rows, now);
  return {
    count: desk.toMessage.length,
    amount: desk.riding,
    pastTerms: sumDerived(
      desk.toMessage.map((r) => pastTermsDays(r, now)),
      'the worst of what is waiting',
      (a, b) => Math.max(a, b),
      0,
    ),
  };
}

/** Money made after a post was stamped, as a share of the posts stamped. */
export const soldPerPost = (desk: Desk): Derived<Amount> =>
  desk.soldAfterPosts.posts === 0
    ? unavailable('no post has been stamped yet')
    : map(
        known(desk.soldAfterPosts.amount, `${desk.soldAfterPosts.posts} posts stamped`),
        (total) => Money.times(total, 1 / desk.soldAfterPosts.posts),
      );
