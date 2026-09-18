/**
 * The demo book, held against frame 1a.
 *
 * Every figure the frame draws as TEXT is asserted here, because the whole
 * claim of this screen is that those figures are one reckoning read many
 * times: the rail badge, the lens count, the strip, the group bands, the
 * rows and the panel. If any of them could drift, the screen is the old
 * Customers-and-Debtors pair again with better spacing.
 *
 * Where a derived figure and the frame differ, the assertion holds the
 * DERIVED one and says why in its name. There are three, and they are argued
 * at the head of `demo-customers.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  Money,
  agingBands,
  askTheseFirst,
  balance,
  best,
  boughtOver,
  byAsk,
  howTheyPay,
  initials,
  ledgerAgrees,
  marginPercent,
  marginReading,
  oldestDebtDays,
  overLimit,
  payBands,
  paysWithoutChasing,
  qualifier,
  quietReading,
  read,
  rowNote,
  standing,
  totalOwed,
  type Customer,
} from '@ow/domain';
import { DEMO_SHOP_MARGIN, demoCustomers } from './demo-customers.js';
import { DEMO_TODAY } from './demo-invoices.js';

const now = DEMO_TODAY;
const all = demoCustomers();
const book = read(all, now);

const find = (name: string): Customer => {
  const c = all.find((x) => x.name === name);
  if (c === undefined) throw new Error(`no customer called ${name}`);
  return c;
};

const value = <T>(d: { status: string; value?: T }): T => {
  if (d.status === 'unavailable' || d.value === undefined) {
    throw new Error(`expected a derived value, got ${JSON.stringify(d)}`);
  }
  return d.value;
};

describe('the book is the size the frame says it is', () => {
  it('has 142 accounts', () => {
    expect(all.length).toBe(142);
  });

  it('splits into the four lenses the frame draws', () => {
    // Owing 11 · All 142 · Best 20 · Gone quiet 7.
    expect(book.owing.length).toBe(11);
    expect(book.pastDue.length).toBe(4);
    expect(book.inTime.length).toBe(7);
    expect(book.quiet.length).toBe(7);
    expect(best(all, now, 20).length).toBe(20);
  });

  it('puts a quiet account in the quiet group even when it owes', () => {
    // Rashid owes 510,000 and has bought nothing for 103 days. He is a phone
    // call, not a chase, and the ask order must not contain him.
    const rashid = find('Rashid Ssemakula');
    expect(standing(rashid, now)).toBe('quiet');
    expect(Money.format(balance(rashid))).toBe('510,000');
    expect(book.pastDue).not.toContain(rashid);
  });
});

describe('the position strip', () => {
  it('owes 23,650,000, which is the two owing groups and nothing else', () => {
    expect(Money.format(totalOwed(book.owing))).toBe('23,650,000');
    expect(Money.format(totalOwed(book.pastDue))).toBe('9,020,000');
    expect(Money.format(totalOwed(book.inTime))).toBe('14,630,000');
    expect(
      Money.add(totalOwed(book.pastDue), totalOwed(book.inTime)),
    ).toBe(totalOwed(book.owing));
  });

  it('ages the debt in four bands — 28/22/18/32, not the frame\'s 29/23/19/29', () => {
    // The four rows the frame itself draws under thirty days come to
    // 7,465,000 of 23,650,000, which is 31.6%. The drawn 29% is not reachable
    // without moving a figure the frame also writes out as text, so the bar
    // moves and the figures stay.
    const bands = agingBands(book.owing, now);
    expect(bands.map((b) => b.share)).toEqual([28, 22, 18, 32]);
    expect(bands.map((b) => Money.format(b.amount))).toEqual([
      '6,610,000',
      '5,245,000',
      '4,330,000',
      '7,465,000',
    ]);
    expect(Money.add(...bands.map((b) => b.amount))).toBe(totalOwed(book.owing));
  });

  it('names each band by the oldest debt in it', () => {
    // "31d" where the frame writes "30d": Kato's oldest invoice is 31 days
    // old and sits in that band, so 30 would be a caption naming nothing.
    expect(agingBands(book.owing, now).map((b) => b.reads)).toEqual([
      '74d',
      '49d',
      '31d',
      'under 30d',
    ]);
  });

  it('finds 42% of the debt with three of the 142', () => {
    // The frame draws 35% across Mulongo, Nakawa and Kato, and this read
    // 8,380,000 until the ask order stopped being limited to the past-due.
    //
    // It had to stop: on the shop's real books nobody is past due — no
    // account has terms recorded — so that reading ranked nobody at all and
    // the card read "Nothing is owed by any of the 120" over a real
    // 8,210,000. Ranking everyone who owes is what makes the card work on
    // any books.
    //
    // Kireka Builders is what changes here, and it is the right answer:
    // it owes more than Kato and has broken nothing, which is exactly the
    // account the old reading could not see. 42% of the debt with three of
    // the 142 is a sharper concentration than the frame drew, not a looser
    // one.
    const three = askTheseFirst(book, now);
    expect(Money.format(three.amount)).toBe('9,940,000');
    expect(three.share).toBe(42);
    expect(three.customers.map((c) => c.name)).toEqual([
      'Mulongo Hardware',
      'Kireka Builders',
      'Nakawa Traders',
    ]);
  });

  it('has two accounts beyond their limit, and states both', () => {
    const over = overLimit(all);
    expect(over.length).toBe(2);
    expect(
      over
        .map(
          (c) =>
            `${c.name.split(' ')[0] ?? ''} ${Money.formatMillions(balance(c), 2)} of ${Money.formatMillions(c.creditLimit ?? Money.ZERO, 2)}`,
        )
        .join(' · '),
    ).toBe('Mulongo 3.33m of 2.00m · Rashid 0.51m of 0.40m');
  });

  it('counts 86 accounts that settle inside a week, every time', () => {
    expect(all.filter(paysWithoutChasing).length).toBe(86);
  });
});

describe('the ask order', () => {
  it('is the frame\'s order: the blocked account, then shillings times days', () => {
    // The handoff's prose says "age, then amount", which would put Nakawa
    // first at 74 days. Frame 1a draws Mulongo first, and the frame is the
    // design — Mulongo is the one account that cannot buy again until it
    // pays, so chasing it reopens a customer as well as collecting.
    expect([...book.pastDue].sort(byAsk(now)).map((c) => c.name)).toEqual([
      'Mulongo Hardware',
      'Nakawa Traders',
      'Kato Construction Ltd',
      'Ken Bwaise',
    ]);
  });
});

describe('every row the frame draws', () => {
  const row = (name: string): string[] => {
    const c = find(name);
    const where = standing(c, now);
    const q = qualifier(c, book, now);
    return [
      initials(c.name),
      Money.format(balance(c)),
      `${value<number>(oldestDebtDays(c, now))}d`,
      value<string>(howTheyPay(c, where)),
      q === null ? rowNote(c, where, now) : `${q.pill} · ${q.fact ?? ''}`,
    ];
  };

  it.each([
    ['Mulongo Hardware', ['MH', '3,330,000', '49d', 'late on 4 of 10', "over limit · Wasswa's account"]],
    ['Nakawa Traders', ['NT', '2,410,000', '74d', 'late on 2 of 24', '5 chases · none answered']],
    ['Kato Construction Ltd', ['KC', '2,640,000', '31d', 'slow but always pays', 'biggest buyer · 38.4m over 2 years']],
    ['Ken Bwaise', ['KB', '640,000', '25d', 'pays in pieces', 'part paid · 520,000 in on 21 Aug']],
    ['Shadia Nakato', ['SN', '615,000', '1d', 'settles in 3 days', 'due 28 Sep · 2 invoices']],
    ['Innocent Busingye', ['IB', '310,000', '0d', 'no history yet', 'bought today · first time on credit']],
    ['Bugolobi Estates', ['BE', '5,900,000', '6d', 'pays on the date', 'due 4 Oct · retention held']],
    ['Rashid Ssemakula', ['RS', '510,000', '103d', 'was reliable', 'over limit · ']],
  ])('%s', (name, expected) => {
    expect(row(name)).toEqual(expected);
  });

  it('draws the pays bar from the same records as the sentence', () => {
    const bar = (name: string): string => {
      const b = payBands(find(name));
      return `${b.onTime}/${b.late}/${b.veryLate}`;
    };
    expect(bar('Mulongo Hardware')).toBe('34/26/40');
    expect(bar('Nakawa Traders')).toBe('84/8/8');
    expect(bar('Ken Bwaise')).toBe('60/30/10');
    expect(bar('Shadia Nakato')).toBe('94/6/0');
    expect(bar('Bugolobi Estates')).toBe('88/12/0');
    expect(bar('Rashid Ssemakula')).toBe('76/24/0');
    // 70/30, where the frame draws 70/24/6. "Slow but always pays" is only
    // true if nothing went very late, and the sentence is worth more than
    // the sliver: a 6% red band and a sentence saying it never happens is
    // the row disagreeing with itself.
    expect(bar('Kato Construction Ltd')).toBe('70/30/0');
  });

  it('has no history to draw for an account that has never settled anything', () => {
    const b = payBands(find('Innocent Busingye'));
    expect(b.settled).toBe(0);
  });
});

describe('the quiet group', () => {
  it('says what it bought before it went quiet', () => {
    expect(
      Money.formatMillions(Money.add(...book.quiet.map((c) => boughtOver(c, now)))),
    ).toBe('9.1m');
  });
});

describe('empty, one, and two hundred', () => {
  it('reads an empty book without inventing a figure', () => {
    // Nothing owed is not "0 owed to you across 4 bands". The strip's figure
    // is genuinely zero, the bands are genuinely empty, and the concentration
    // reading has nothing to concentrate — it says 0%, not NaN, which is what
    // dividing by an empty total would have produced.
    const none = read([], now);
    expect(none.owing.length).toBe(0);
    expect(Money.isZero(totalOwed(none.owing))).toBe(true);
    const bands = agingBands(none.owing, now);
    expect(bands.map((b) => b.share)).toEqual([0, 0, 0, 0]);
    expect(bands.map((b) => b.reads)).toEqual(['60d', '45d', '30d', 'under 30d']);
    expect(askTheseFirst(none, now).share).toBe(0);
  });

  it('reads a book where every account is settled', () => {
    const settled = all.filter((c) => Money.isZero(balance(c)));
    const book2 = read(settled, now);
    expect(book2.owing.length).toBe(0);
    expect(book2.all.length).toBeGreaterThan(100);
    // The Owing lens badge is zero, so the lens is not armed and not drawn.
    expect(Money.isZero(totalOwed(book2.owing))).toBe(true);
  });

  it('reads a book of one', () => {
    const one = read([find('Mulongo Hardware')], now);
    expect(one.owing.length).toBe(1);
    expect(agingBands(one.owing, now).map((b) => b.share)).toEqual([0, 100, 0, 0]);
    expect(askTheseFirst(one, now).share).toBe(100);
  });
});

describe('the customer panel', () => {
  const mulongo = find('Mulongo Hardware');

  it('agrees with the ledger', () => {
    const check = ledgerAgrees(mulongo);
    expect(value<boolean>(check)).toBe(true);
  });

  it('says what they bought, what it earned, and what would fix it', () => {
    expect(Money.format(boughtOver(mulongo, now))).toBe('12,400,000');
    expect(value<number>(marginPercent(mulongo))).toBe(18);
    // The frame says a 3% rise. Raising one product's price lifts the money
    // KEPT and the money SOLD together, so the rise needed is not the gap
    // divided by the share — at 62% of spend and a six-point gap it is 13%.
    // Under-stating it by ten points is the kind of advice that loses money.
    expect(value<string>(marginReading(mulongo, DEMO_SHOP_MARGIN))).toBe(
      'Cement is most of what they take and the thinnest thing you sell. A 13% rise on cement alone would put this account at the shop average.',
    );
  });

  it('works out why they went quiet rather than asserting it', () => {
    expect(value<string>(quietReading(mulongo, now))).toBe(
      'They stopped buying when the July invoice fell due, not before. The debt is the reason for the quiet, not a coincidence.',
    );
  });

  it('cannot derive a margin for an account with no cost on file', () => {
    const innocent = find('Innocent Busingye');
    expect(marginPercent(innocent).status).toBe('unavailable');
  });
});
