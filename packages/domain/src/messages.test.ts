/**
 * What these tests hold is the pair of opposite rankings, and the three
 * places this desk is allowed to say it does not know.
 *
 * The rankings are the whole design: on Money, waiting makes a message more
 * urgent; on Telling it makes it worthless. A single comparator would be
 * wrong about half the desk, and nothing but a test stops the two drifting
 * into one "urgency" the next time somebody tidies up.
 */

import { describe, expect, it } from 'vitest';
import {
  signalRecordReads,
  COVER_FLOOR_DAYS,
  DAILY_POST_CAP,
  EXPIRED_KEPT_DAYS,
  LINK_CODE_SECONDS,
  Money,
  byGoodUntil,
  byStake,
  codeAlive,
  coverDays,
  dropped,
  goneQuiet,
  goodUntilLabel,
  heldBack,
  holdLifted,
  inbox,
  isExpired,
  keepShare,
  lensCounts,
  moneyDesk,
  paidShare,
  pastTermsDays,
  postingDesk,
  ridingOnIt,
  signalShare,
  stateOf,
  tellingDesk,
  waitedDays,
  type Chat,
  type Desk,
  type Link,
  type Owed,
  type Post,
  type SignalRecord,
  type Telling,
} from './index.js';

const NOW = new Date('2026-09-15T07:42:00');
const day = (offset: number): Date => new Date(NOW.getTime() + offset * 86_400_000);
const m = Money.money;

const owed = (over: Partial<Owed> & Pick<Owed, 'id'>): Owed => ({
  name: 'Someone',
  initials: 'SO',
  tone: 'neutral',
  phone: '0700 000 000',
  place: null,
  about: 'owes money',
  atStake: m(100_000),
  invoice: null,
  oldestDays: 10,
  dueOn: day(-10),
  lastWord: null,
  chases: 0,
  everPaid: false,
  history: [],
  draft: 'Hello',
  hold: null,
  stamp: null,
  replied: false,
  ...over,
});

const telling = (over: Partial<Telling> & Pick<Telling, 'id'>): Telling => ({
  name: 'Someone',
  initials: 'SO',
  tone: 'info',
  kind: 'asked-for',
  what: 'the gutters you asked for are in',
  whyThem: 'asked twice',
  whyTone: 'info',
  goodUntil: { kind: 'day', on: NOW },
  route: 'tell',
  routeNote: null,
  worth: null,
  stoppedBeingTrue: null,
  draft: null,
  ...over,
});

const post = (over: Partial<Post> & Pick<Post, 'id'>): Post => ({
  product: 'Something',
  why: 'because',
  signal: 'price-cut',
  onHand: 100,
  soldPerDay: 5,
  sellPrice: m(10_000),
  costPrice: m(5_000),
  strength: 1,
  picked: false,
  card: null,
  ...over,
});

describe('the Money lens — waiting makes a message MORE urgent', () => {
  it('ranks on what is at stake, not on the date', () => {
    const small = owed({ id: 'small', atStake: m(30_000), lastWord: day(-40) });
    const big = owed({ id: 'big', atStake: m(2_410_000), lastWord: day(-2) });
    expect([small, big].sort(byStake(NOW)).map((r) => r.id)).toEqual(['big', 'small']);
  });

  it('breaks a tie with the longer wait, never the shorter', () => {
    const fresh = owed({ id: 'fresh', lastWord: day(-1) });
    const stale = owed({ id: 'stale', lastWord: day(-30) });
    expect([fresh, stale].sort(byStake(NOW)).map((r) => r.id)).toEqual(['stale', 'fresh']);
  });

  it('counts a first ask as having waited since the balance fell due', () => {
    expect(waitedDays(owed({ id: 'x', lastWord: null, oldestDays: 15 }), NOW)).toBe(15);
  });

  it('says how far past the terms a balance has run, and admits when it cannot', () => {
    expect(pastTermsDays(owed({ id: 'x', dueOn: day(-15) }), NOW)).toMatchObject({
      status: 'known',
      value: 15,
    });
    expect(pastTermsDays(owed({ id: 'x', dueOn: null }), NOW).status).toBe('unavailable');
  });

  it('adds up only what is still to be sent, because that is what is riding on it', () => {
    const rows = [
      owed({ id: 'draft', atStake: m(350_000) }),
      owed({ id: 'sent', atStake: m(900_000), stamp: { on: day(-3), by: 'Kevin', went: true } }),
    ];
    const riding = ridingOnIt(rows, NOW);
    expect(riding.count).toBe(1);
    expect(riding.amount).toBe(m(350_000));
  });
});

describe('stamping a hand-off', () => {
  it('leaves the message owed when the owner says it did not go', () => {
    const row = owed({ id: 'x', stamp: { on: day(0), by: 'Kevin', went: false } });
    expect(stateOf(row, NOW)).toBe('draft');
  });

  it('moves it to waiting when the owner says it went', () => {
    const row = owed({ id: 'x', stamp: { on: day(0), by: 'Kevin', went: true } });
    expect(stateOf(row, NOW)).toBe('sent');
  });

  it('brings it back the moment they reply', () => {
    const row = owed({
      id: 'x',
      replied: true,
      stamp: { on: day(-2), by: 'Kevin', went: true },
    });
    expect(stateOf(row, NOW)).toBe('draft');
  });

  it('calls someone quiet only after the setting, and the setting can move', () => {
    const row = owed({ id: 'x', lastWord: day(-14), stamp: { on: day(-14), by: 'K', went: true } });
    expect(goneQuiet(row, NOW)).toBe(true);
    expect(goneQuiet(row, NOW, 21)).toBe(false);
  });
});

describe('holding someone', () => {
  const hold = { reason: 'paying', note: 'Promised 1,000,000 on Friday', until: day(3) } as const;

  it('takes them out of the list of people owed a word, and not out of the list', () => {
    const rows = [owed({ id: 'held', hold }), owed({ id: 'open' })];
    const desk = moneyDesk(rows, NOW);
    expect(desk.toMessage.map((r) => r.id)).toEqual(['open']);
    expect(desk.held.map((r) => r.id)).toEqual(['held']);
  });

  it('expires instead of hiding someone forever', () => {
    expect(holdLifted(hold, NOW)).toBe(false);
    expect(holdLifted(hold, day(3))).toBe(true);
    expect(holdLifted({ ...hold, until: null }, day(400))).toBe(false);
  });

  it('gives the person back once the hold lifts, with the reason still on them', () => {
    const row = owed({ id: 'held', hold });
    expect(stateOf(row, NOW)).toBe('held');
    expect(stateOf(row, day(4))).toBe('draft');
    expect(row.hold?.note).toBe('Promised 1,000,000 on Friday');
  });
});

describe('the Telling lens — waiting makes a message WORTHLESS', () => {
  it('ranks soonest to go stale first', () => {
    const today = telling({ id: 'today', goodUntil: { kind: 'day', on: NOW } });
    const later = telling({ id: 'later', goodUntil: { kind: 'day', on: day(3) } });
    expect([later, today].sort(byGoodUntil(NOW)).map((t) => t.id)).toEqual(['today', 'later']);
  });

  it('sorts "while it holds" last — it is the one thing waiting does not spend', () => {
    const holds = telling({ id: 'holds', goodUntil: { kind: 'while-it-holds' } });
    const later = telling({ id: 'later', goodUntil: { kind: 'day', on: day(3) } });
    expect([holds, later].sort(byGoodUntil(NOW)).map((t) => t.id)).toEqual(['later', 'holds']);
  });

  it('computes expiry rather than reading a flag', () => {
    expect(isExpired(telling({ id: 'x', goodUntil: { kind: 'day', on: day(-1) } }), NOW)).toBe(true);
    expect(isExpired(telling({ id: 'x', goodUntil: { kind: 'day', on: NOW } }), NOW)).toBe(false);
  });

  it('expires a reason the moment the fact under it changes, whatever the date said', () => {
    const t = telling({
      id: 'x',
      goodUntil: { kind: 'while-it-holds' },
      stoppedBeingTrue: { on: day(-2), because: 'the price went back up' },
    });
    expect(isExpired(t, NOW)).toBe(true);
  });

  it('labels the ranking column the way the shop reads it', () => {
    expect(goodUntilLabel(telling({ id: 'a', goodUntil: { kind: 'day', on: NOW } }), NOW)).toBe('today');
    expect(goodUntilLabel(telling({ id: 'b', goodUntil: { kind: 'day', on: day(1) } }), NOW)).toBe('tomorrow');
    expect(goodUntilLabel(telling({ id: 'c', goodUntil: { kind: 'day', on: day(3) } }), NOW)).toBe('3 days');
    expect(goodUntilLabel(telling({ id: 'd', goodUntil: { kind: 'while-it-holds' } }), NOW)).toBe('while it holds');
  });

  it('keeps what stopped being true for a week, then drops it', () => {
    const t = (ago: number): Telling =>
      telling({ id: 'x', stoppedBeingTrue: { on: day(-ago), because: 'price went up' } });
    expect(dropped(t(EXPIRED_KEPT_DAYS), NOW)).toBe(false);
    expect(dropped(t(EXPIRED_KEPT_DAYS + 1), NOW)).toBe(true);
  });

  it('holds a total over expired reasons PARTIAL when one of them carried no figure', () => {
    // The screen says "two of those three were worth 390,000". It can only
    // say that honestly because the third is absent rather than zero.
    const desk = tellingDesk(
      [
        telling({ id: '1', worth: m(250_000), stoppedBeingTrue: { on: day(-1), because: 'up' } }),
        telling({ id: '2', worth: m(140_000), stoppedBeingTrue: { on: day(-2), because: 'up' } }),
        telling({ id: '3', worth: null, stoppedBeingTrue: { on: day(-3), because: 'elsewhere' } }),
      ],
      NOW,
    );
    expect(desk.expired).toHaveLength(3);
    expect(desk.expiredWorth).toMatchObject({ status: 'partial', value: m(390_000) });
  });

  it('puts a fact about a product outside the three, under its own route', () => {
    const desk = tellingDesk(
      [telling({ id: 'tell' }), telling({ id: 'post', route: 'post' })],
      NOW,
    );
    expect(desk.speak.map((t) => t.id)).toEqual(['tell']);
    expect(desk.betterPosted.map((t) => t.id)).toEqual(['post']);
  });
});

describe('the Posting lens', () => {
  it('cannot derive cover for a product nothing has sold, and says so', () => {
    expect(coverDays(post({ id: 'idle', soldPerDay: 0 })).status).toBe('unavailable');
  });

  it('divides the shelf by the rate it leaves at', () => {
    expect(coverDays(post({ id: 'x', onHand: 340, soldPerDay: 16 }))).toMatchObject({
      status: 'known',
      value: 21,
    });
  });

  it('ranks the held group by what is left on the shelf, thinnest first', () => {
    const posts = [
      post({ id: 'nearly', onHand: 36, soldPerDay: 6 }),
      post({ id: 'bare', onHand: 4, soldPerDay: 4 }),
    ];
    expect(postingDesk(posts, RECORDS).held.map((p) => p.id)).toEqual(['bare', 'nearly']);
  });

  it('holds back a shelf that cannot carry a week, and nothing else', () => {
    expect(heldBack(post({ id: 'thin', onHand: 36, soldPerDay: 12 }))).toBe(true);
    expect(heldBack(post({ id: 'fat', onHand: 340, soldPerDay: 16 }))).toBe(false);
  });

  it('does NOT hold back idle stock, because a missing cover is a full shelf', () => {
    // The trap: `cover < 7` on an unavailable figure read as zero would hold
    // back the one kind of product the queue exists to move.
    expect(heldBack(post({ id: 'idle', soldPerDay: 0 }))).toBe(false);
    expect(COVER_FLOOR_DAYS).toBe(7);
  });

  it('reads a product sold at cost as 0%, not as a missing margin', () => {
    expect(keepShare(post({ id: 'x', sellPrice: m(12_000), costPrice: m(12_000) }))).toMatchObject({
      status: 'known',
      value: 0,
    });
    expect(keepShare(post({ id: 'y', costPrice: null })).status).toBe('unavailable');
  });

  it('caps the day at three, and says how many places are left', () => {
    const posts = [
      post({ id: '1', picked: true }),
      post({ id: '2', picked: true }),
      post({ id: '3' }),
      post({ id: '4' }),
    ];
    const desk = postingDesk(posts, RECORDS);
    expect(desk.cap).toBe(DAILY_POST_CAP);
    expect(desk.placesLeft).toBe(1);
    expect(desk.rollsOver).toBe(2);
  });

  it('ranks the queue on the signal record, not on the price of the product', () => {
    const posts = [
      post({ id: 'idle', signal: 'idle-stock' }),
      post({ id: 'cut', signal: 'price-cut' }),
      post({ id: 'together', signal: 'goes-together' }),
    ];
    expect(postingDesk(posts, RECORDS).queue.map((p) => p.id)).toEqual([
      'cut',
      'together',
      'idle',
    ]);
  });

  it('separates two rows wearing the same chip by how strongly each shows it', () => {
    const posts = [
      post({ id: 'slight', signal: 'price-cut', strength: 0.2 }),
      post({ id: 'steep', signal: 'price-cut', strength: 1 }),
    ];
    expect(postingDesk(posts, RECORDS).queue.map((p) => p.id)).toEqual(['steep', 'slight']);
  });

  it('keeps what is already picked at the top, in the order it was picked', () => {
    // The numbers down the left are the day's three places, not a league
    // table. A pick that fell to fourth the moment a better nomination
    // arrived would make the day's plan unreadable.
    const posts = [
      post({ id: 'strong', signal: 'price-cut', strength: 1 }),
      post({ id: 'picked-weak', signal: 'idle-stock', strength: 0.1, picked: true }),
    ];
    expect(postingDesk(posts, RECORDS).queue.map((p) => p.id)).toEqual([
      'picked-weak',
      'strong',
    ]);
  });

  it('takes the share of a signal from its own record', () => {
    expect(signalShare({ signal: 'price-cut', moved: 6, of: 7 })).toMatchObject({
      status: 'known',
      value: 86,
    });
  });
});

const RECORDS: readonly SignalRecord[] = [
  { signal: 'price-cut', moved: 6, of: 7 },
  { signal: 'goes-together', moved: 4, of: 6 },
  { signal: 'season-starting', moved: 1, of: 2 },
  { signal: 'idle-stock', moved: 2, of: 8 },
  { signal: 'margin', moved: 1, of: 4 },
];

describe('the Inbox lens does not exist until the number is linked', () => {
  const chat = (id: string, ago: number): Chat => ({
    id,
    name: id,
    initials: 'XX',
    tone: 'neutral',
    phone: '0700',
    at: day(-ago),
    preview: 'hello',
    about: { kind: 'none', line: 'not a customer yet' },
    lines: [],
    promised: null,
  });

  const link = (linked: boolean): Link => ({ linked, code: 'MQ4K-7TD2', issuedAt: NOW });

  it('is absent, not empty — the difference is the whole argument', () => {
    expect(inbox([chat('a', 0)], link(false), NOW)).toBeNull();
  });

  it('appears the moment the number is linked, newest chat first', () => {
    const chats = inbox([chat('old', 2), chat('new', 0)], link(true), NOW);
    expect(chats?.map((c) => c.id)).toEqual(['new', 'old']);
  });

  it('keeps chats for thirty days', () => {
    expect(inbox([chat('stale', 31)], link(true), NOW)).toEqual([]);
    expect(inbox([chat('kept', 30)], link(true), NOW)).toHaveLength(1);
  });

  it('gives the linking code sixty seconds, and a new one is free', () => {
    const l = link(false);
    expect(codeAlive(l, NOW)).toBe(true);
    expect(codeAlive(l, new Date(NOW.getTime() + LINK_CODE_SECONDS * 1000))).toBe(false);
  });
});

describe('one reckoning, read by every lens', () => {
  const desk: Desk = {
    owed: [owed({ id: 'one', atStake: m(350_000) })],
    telling: [
      telling({ id: 'a' }),
      telling({ id: 'b', goodUntil: { kind: 'day', on: day(3) } }),
      telling({ id: 'c', route: 'post', goodUntil: { kind: 'while-it-holds' } }),
    ],
    posts: [post({ id: 'p1' }), post({ id: 'p2', signal: 'idle-stock', soldPerDay: 0 })],
    chats: [],
    link: { linked: false, code: 'MQ4K-7TD2', issuedAt: NOW },
    chaseRecord: {
      sent: 184,
      paid: 57,
      daysToMoney: 4.2,
      overDays: 90,
      repliedAskingDate: 44,
      repliedAskingAmount: 19,
    },
    tellingRecord: {
      led: 14,
      of: 38,
      bought: m(2_340_000),
      withinDays: 7,
      overDays: 90,
      byKind: new Map([['asked-for', { moved: 5, of: 6 }]]),
    },
    signalRecords: RECORDS,
    soldAfterPosts: { amount: m(4_180_000), posts: 22, withinDays: 3 },
  };

  it('draws no Inbox chip at all while the number is unlinked', () => {
    expect(lensCounts(desk, NOW).map((c) => c.lens)).toEqual(['money', 'telling', 'posting']);
  });

  it('adds the Inbox chip the moment it is linked, and nothing else moves', () => {
    const linked = lensCounts({ ...desk, link: { ...desk.link, linked: true } }, NOW);
    expect(linked.map((c) => c.lens)).toEqual(['money', 'telling', 'posting', 'inbox']);
    expect(linked.find((c) => c.lens === 'money')?.count).toBe(1);
  });

  it('never lets Posting demand anything — nobody is owed a post', () => {
    const posting = lensCounts(desk, NOW).find((c) => c.lens === 'posting');
    expect(posting?.wants).toBe(false);
    // And the count is the queue, which excludes what the shelf cannot carry.
    expect(posting?.count).toBe(2);
  });

  it('counts the Money lens as what is still to send, which is what the tile says', () => {
    expect(lensCounts(desk, NOW).find((c) => c.lens === 'money')?.count).toBe(
      ridingOnIt(desk.owed, NOW).count,
    );
  });

  it('takes the chase record share from the record and not from a typed figure', () => {
    expect(paidShare(desk.chaseRecord)).toMatchObject({ status: 'known', value: 31 });
  });
});

describe('what the signal record says', () => {
  /**
   * It was prose: *"Of 0 posts stamped in 30 days, a price cut moved the
   * line five times out of six. Idle stock almost never moves on a post
   * alone."* Two claims about a record with nothing in it, contradicting the
   * `0` in their own first clause — and sitting under bars that did read the
   * record and were therefore all empty.
   */
  it('says nothing is known yet where nothing has been stamped', () => {
    const said = signalRecordReads(
      [
        { signal: 'price-cut', moved: 0, of: 0 },
        { signal: 'idle-stock', moved: 0, of: 0 },
      ],
      30,
    );

    expect(said).toContain('Nothing has been posted and stamped in 30 days');
    expect(said).not.toContain('five times');
    // And it says what would fill it in.
    expect(said).toContain('Say whether a post went out');
  });

  it('names the best and the worst once there is a record', () => {
    const said = signalRecordReads(
      [
        { signal: 'price-cut', moved: 5, of: 6 },
        { signal: 'idle-stock', moved: 1, of: 8 },
      ],
      30,
    );

    expect(said).toBe(
      'Of 14 posts stamped in 30 days, price cut moved the line 5 of 6 times and idle stock 1 of 8.',
    );
  });

  it('does not put one record against itself', () => {
    expect(signalRecordReads([{ signal: 'margin', moved: 2, of: 3 }], 30)).toBe(
      'Of 3 posts stamped in 30 days, margin moved the line 2 of 3 times.',
    );
  });

  /** A signal nothing has been posted under is not part of the record. */
  it('counts only what was actually stamped', () => {
    const said = signalRecordReads(
      [
        { signal: 'price-cut', moved: 5, of: 6 },
        { signal: 'season-starting', moved: 0, of: 0 },
      ],
      30,
    );
    expect(said).toBe('Of 6 posts stamped in 30 days, price cut moved the line 5 of 6 times.');
  });
});
