/**
 * The demo desk derives to exactly what the frames draw.
 *
 * Every figure on the Messages screen is computed from these rows, so this
 * file is where "the mockup is the design" becomes something that fails. If
 * somebody adds a person to the Sent group, the register's count moves and
 * this notices; if somebody types a total into `demo-messages.ts`, the two
 * readings disagree and this notices that too.
 *
 * Where a figure differs from the frame it is written down with the reason,
 * because the handoff spans four turns and its own numbers disagree — see the
 * head of `demo-messages.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  Money,
  coverDays,
  goodUntilLabel,
  inbox,
  keepShare,
  lensCounts,
  moneyDesk,
  paidShare,
  postingDesk,
  ridingOnIt,
  tellingDesk,
} from '@ow/domain';
import { DEMO_TODAY } from './demo-invoices.js';
import { demoDesk } from './demo-messages.js';

const desk = demoDesk();
const now = DEMO_TODAY;

describe('the lens chips, from one reckoning', () => {
  it('counts what each lens holds, and draws no Inbox while unlinked', () => {
    expect(lensCounts(desk, now)).toEqual([
      { lens: 'money', count: 1, wants: true, tone: 'bad' },
      { lens: 'telling', count: 3, wants: true, tone: 'info' },
      { lens: 'posting', count: 14, wants: false, tone: 'neutral' },
    ]);
  });

  it('adds the Inbox the moment the number is linked, and moves nothing else', () => {
    const linked = { ...desk, link: { ...desk.link, linked: true } };
    expect(lensCounts(linked, now).map((c) => [c.lens, c.count])).toEqual([
      ['money', 1],
      ['telling', 3],
      ['posting', 14],
      ['inbox', 4],
    ]);
  });
});

describe('the Money lens — frame 2a', () => {
  const money = moneyDesk(desk.owed, now);

  it('owes exactly one person a word this morning', () => {
    expect(money.toMessage.map((r) => r.name)).toEqual(['Sample Customer']);
  });

  it('has 21 sent and waiting, and nobody held', () => {
    expect(money.sentWaiting).toHaveLength(21);
    expect(money.held).toEqual([]);
  });

  it('names the three the register draws, in the order it draws them', () => {
    expect(money.sentWaiting.slice(0, 3).map((r) => r.name)).toEqual([
      'Nakawa Traders',
      'Ken Lubega',
      'Innocent Busingye',
    ]);
  });

  it('derives the tile: 1 · 350,000 riding on it · 15 days past your terms', () => {
    const riding = ridingOnIt(desk.owed, now);
    expect(riding.count).toBe(1);
    expect(Money.format(riding.amount)).toBe('350,000');
    expect(riding.pastTerms).toMatchObject({ status: 'known', value: 15 });
  });

  it('derives 31% of chases paid, from 57 of 184', () => {
    expect(paidShare(desk.chaseRecord)).toMatchObject({ status: 'known', value: 31 });
  });

  /**
   * The frame says "oldest 11 days". It is `daysBetween` over the same chase
   * history the phone's draft screen lists, whose most recent entry the frame
   * itself dates 2 Sep — thirteen days before the day every handoff is drawn
   * on. The drawn dates are kept and the derived figure follows them.
   */
  it('says the oldest thing waiting is 13 days, from the chase dates it draws', () => {
    expect(money.oldestWaitingDays).toMatchObject({ status: 'known', value: 13 });
  });
});

describe('the Telling lens — frame 4a', () => {
  const tell = tellingDesk(desk.telling, now);

  it('has three reasons to speak, soonest to go stale first', () => {
    expect(tell.speak.map((t) => t.name)).toEqual([
      'Okello Fred',
      'Kato Construction',
      'Ssendawula Sam',
    ]);
  });

  it('ranks them on Good until, not on what they are worth', () => {
    expect(tell.speak.map((t) => goodUntilLabel(t, now))).toEqual([
      'today',
      'today',
      '3 days',
    ]);
  });

  it('counts two that have to be said today', () => {
    expect(tell.sayToday).toBe(2);
  });

  it('puts the price on a product outside the three, under its own route', () => {
    expect(tell.betterPosted.map((t) => t.name)).toEqual(['Nakawa Traders']);
  });

  it('keeps three expired reasons, and says two of them were worth 390,000', () => {
    expect(tell.expired).toHaveLength(3);
    expect(tell.expiredWorth).toMatchObject({ status: 'partial' });
    expect(tell.expiredWorth.status !== 'unavailable' && Money.format(tell.expiredWorth.value)).toBe(
      '390,000',
    );
  });
});

describe('the Posting lens — frame 1c', () => {
  const post = postingDesk(desk.posts, desk.signalRecords);

  it('nominates 14 and holds 31 back', () => {
    expect(post.queue).toHaveLength(14);
    expect(post.held).toHaveLength(31);
  });

  it('has picked two of three, leaving one place and rolling twelve over', () => {
    expect(post.picked.map((p) => p.product)).toEqual([
      'Iron sheets G28',
      'PVC conduit 20mm',
    ]);
    expect(post.placesLeft).toBe(1);
    expect(post.rollsOver).toBe(12);
  });

  it('orders the queue exactly as the frame draws it', () => {
    expect(post.queue.slice(0, 5).map((p) => p.product)).toEqual([
      'Iron sheets G28',
      'PVC conduit 20mm',
      'Ridge caps',
      'Rain gutters 3m',
      'Binding wire 20kg',
    ]);
  });

  it('derives the cover column, including the one it cannot', () => {
    const cover = post.queue.slice(0, 5).map((p) => {
      const d = coverDays(p);
      return d.status === 'unavailable' ? 'no sales' : d.value;
    });
    expect(cover).toEqual([21, 'no sales', 34, 47, 62]);
  });

  it('derives the "you keep" column, including the one that is at cost', () => {
    const keep = post.queue.slice(0, 5).map((p) => {
      const k = keepShare(p);
      return k.status === 'unavailable' ? '—' : k.value;
    });
    expect(keep).toEqual([26, 0, 31, 29, 38]);
  });

  it('holds cement back first, because it has the least cover of the 31', () => {
    const worst = [...post.held].sort((a, b) => {
      const l = coverDays(a);
      const r = coverDays(b);
      return (l.status === 'unavailable' ? 99 : l.value) - (r.status === 'unavailable' ? 99 : r.value);
    })[0];
    expect(worst?.product).toBe('Cement 50kg');
  });
});

describe('the Inbox lens — frame 5a', () => {
  it('does not exist while the number is unlinked', () => {
    expect(inbox(desk.chats, desk.link, now)).toBeNull();
  });

  it('is four chats, newest first, once it does', () => {
    const chats = inbox(desk.chats, { ...desk.link, linked: true }, now);
    expect(chats?.map((c) => c.name)).toEqual([
      'Nakawa Traders',
      'Kato Construction Ltd',
      'Mariam Kigozi',
      'Kampala Steel',
    ]);
  });

  it('carries what each chat is about, so a reply can be written without leaving', () => {
    const kinds = desk.chats.map((c) => c.about.kind);
    expect(kinds).toEqual(['invoice', 'order', 'none', 'supplier']);
  });
});
