/**
 * The rules, at their edges.
 *
 * `demo-customers.test.ts` holds this screen against its frame. This holds
 * the module against the cases a frame cannot draw: an account that has
 * overpaid, one with no credit limit agreed, one whose ledger has drifted,
 * one that has never bought anything. Every one of them is a place the old
 * app would have rendered a confident zero.
 */

import { describe, expect, it } from 'vitest';
import * as Money from './money.js';
import {
  agingBands,
  askTheseFirst,
  balance,
  boughtMonthly,
  boughtOver,
  byAsk,
  draftPromise,
  hasBrokenPromise,
  howTheyPay,
  howTheyPayShort,
  initials,
  inWords,
  isBlocked,
  latestPromise,
  ledgerAgrees,
  marginPercent,
  marginReading,
  oldestDebtDays,
  overLimitBy,
  owedOn,
  payBands,
  paysWithoutChasing,
  PROMISE_NOTE_MAX,
  promisesBroken,
  promiseState,
  quietReading,
  read,
  rowNote,
  standing,
  totalOwed,
  type Customer,
  type CustomerInvoice,
  type Promised,
  type PromiseRecord,
} from './customers.js';

const m = Money.money;
const NOW = new Date('2026-09-15T07:42:00Z');
const DAY = 86_400_000;
const day = (offset: number): Date => new Date(NOW.getTime() + offset * DAY);

const invoice = (over: Partial<CustomerInvoice> = {}): CustomerInvoice => ({
  doc: 'INV-0001',
  issued: day(-10),
  total: m(100_000),
  dueOn: day(4),
  received: Money.ZERO,
  lastPaidOn: null,
  settledOn: null,
  instalments: 0,
  ...over,
});

const customer = (over: Partial<Customer> = {}): Customer => ({
  id: 'c-1',
  promises: [],
  payments: [],
  name: 'Test Trader',
  since: day(-400),
  heldBy: null,
  phone: '0700 000 000',
  area: 'Kampala',
  creditLimit: m(1_000_000),
  invoices: [invoice()],
  chasesSent: 0,
  chasesAnswered: 0,
  ledgerBalance: m(100_000),
  retentionHeld: false,
  keptTwelveMonths: null,
  soldTwelveMonths: null,
  buys: [],
  monthly: [],
  ...over,
});

describe('a balance is never negative', () => {
  it('treats an overpayment as settled, not as a debt owed back', () => {
    // Money coming back the other way is a refund, and a refund is not a
    // negative debt. A list that summed one would under-state what is owed.
    const over = customer({
      invoices: [invoice({ total: m(100_000), received: m(140_000) })],
    });
    expect(Money.isZero(balance(over))).toBe(true);
    expect(Money.isZero(owedOn(over.invoices[0] ?? invoice()))).toBe(true);
  });

  it('sums a balance over every invoice, settled ones included', () => {
    const c = customer({
      invoices: [
        invoice({ doc: 'A', total: m(500_000), received: m(200_000) }),
        invoice({ doc: 'B', total: m(300_000), received: m(300_000), settledOn: day(-2) }),
      ],
    });
    expect(Money.format(balance(c))).toBe('300,000');
  });
});

describe('what cannot be derived says so', () => {
  it('has no oldest debt when nothing is owed — and that is not zero days', () => {
    const settled = customer({
      invoices: [invoice({ received: m(100_000), settledOn: day(-1) })],
    });
    const age = oldestDebtDays(settled, NOW);
    expect(age.status).toBe('unavailable');
    if (age.status === 'unavailable') expect(age.reason).toContain('owes nothing');
  });

  it('cannot say how far over a limit an account with no limit is', () => {
    // No limit agreed is not a limit of zero, and "100,000 over the limit"
    // would be a claim the books never made.
    const noLimit = customer({ creditLimit: null });
    expect(overLimitBy(noLimit).status).toBe('unavailable');
    expect(isBlocked(noLimit)).toBe(false);
  });

  it('cannot derive a margin without both a cost and a revenue', () => {
    expect(marginPercent(customer()).status).toBe('unavailable');
    expect(
      marginPercent(customer({ keptTwelveMonths: m(100), soldTwelveMonths: m(0) })).status,
    ).toBe('unavailable');
    expect(
      marginPercent(customer({ keptTwelveMonths: m(180_000), soldTwelveMonths: m(1_000_000) })),
    ).toMatchObject({ status: 'known', value: 18 });
  });

  it('cannot read a trend from fewer than three months', () => {
    expect(quietReading(customer(), NOW).status).toBe('unavailable');
  });
});

describe('the ledger check is a real comparison', () => {
  it('agrees when the two sides agree', () => {
    expect(ledgerAgrees(customer())).toMatchObject({ status: 'known', value: true });
  });

  it('says how far apart the books are, not merely that they are', () => {
    // "Mismatch" is not actionable. "The books are 40,000 apart" is.
    const drifted = customer({ ledgerBalance: m(140_000) });
    const check = ledgerAgrees(drifted);
    expect(check).toMatchObject({ status: 'known', value: false });
    if (check.status === 'known') expect(check.basis).toContain('40,000 apart');
  });
});

describe('standing puts an account in exactly one group', () => {
  const quiet = customer({
    invoices: [invoice({ issued: day(-120), dueOn: day(-90) })],
  });

  it('calls an account quiet when it has bought nothing in 90 days', () => {
    expect(standing(quiet, NOW)).toBe('quiet');
  });

  it('keeps it quiet even though it owes — quiet beats owing', () => {
    // It is a phone call, not a chase. Chasing an account the shop has
    // already shut out collects nothing and costs the relationship.
    expect(Money.isZero(balance(quiet))).toBe(false);
    expect(standing(quiet, NOW)).not.toBe('past-due');
  });

  it('separates past due from still in time by the due date, not the age', () => {
    const old = customer({ invoices: [invoice({ issued: day(-65), dueOn: day(25) })] });
    expect(standing(old, NOW)).toBe('in-time');
    const late = customer({ invoices: [invoice({ issued: day(-40), dueOn: day(-10) })] });
    expect(standing(late, NOW)).toBe('past-due');
  });

  it('calls an account clear when it owes nothing and is still buying', () => {
    const clear = customer({
      invoices: [invoice({ received: m(100_000), settledOn: day(-3) })],
    });
    expect(standing(clear, NOW)).toBe('clear');
  });

  it('cannot call an invoice with no terms late — it says nothing instead', () => {
    const noTerms = customer({ invoices: [invoice({ dueOn: null })] });
    expect(standing(noTerms, NOW)).toBe('in-time');
  });
});

describe('how they pay', () => {
  const settledRun = (
    count: number,
    total: number,
    settleDays: number,
    instalments = 1,
  ): CustomerInvoice[] =>
    Money.allocate(m(total), count).map((amount, i) =>
      invoice({
        doc: `S-${i}`,
        issued: day(-100 - i * 10),
        dueOn: day(-100 - i * 10 + 30),
        total: amount,
        received: amount,
        settledOn: day(-100 - i * 10 + settleDays),
        lastPaidOn: day(-100 - i * 10 + settleDays),
        instalments,
      }),
    );

  it('weights the bar by money and the sentence by invoices', () => {
    // One late 900,000 among nine on-time 100,000s is 90% of the money and
    // one of ten invoices. Those are different facts, and the row shows both.
    const c = customer({
      invoices: [...settledRun(9, 900_000, 10), ...settledRun(1, 900_000, 50).map((x) => ({ ...x, doc: 'L' }))],
    });
    const bands = payBands(c);
    expect(bands.settled).toBe(10);
    expect(bands.lateCount).toBe(1);
    expect(bands.onTime + bands.late + bands.veryLate).toBe(100);
  });

  it('draws nothing rather than a good bar for an account with no history', () => {
    const fresh = customer();
    expect(payBands(fresh).settled).toBe(0);
    expect(howTheyPay(fresh, 'in-time')).toMatchObject({ value: 'no history yet' });
    expect(howTheyPayShort(fresh, 'in-time')).toMatchObject({ value: 'no history yet' });
  });

  it('reads instalments as a different problem from lateness', () => {
    const pieces = customer({ invoices: settledRun(6, 600_000, 10, 2) });
    expect(howTheyPay(pieces, 'in-time')).toMatchObject({ value: 'pays in pieces' });
    expect(howTheyPayShort(pieces, 'in-time')).toMatchObject({ value: 'in pieces' });
  });

  it('reads a clean, fast account as one that settles in days', () => {
    const fast = customer({ invoices: settledRun(5, 500_000, 3) });
    expect(howTheyPay(fast, 'in-time')).toMatchObject({ value: 'settles in 3 days' });
    expect(paysWithoutChasing(fast)).toBe(true);
  });

  it('reads a clean, slow account as one that pays on the date', () => {
    const onDate = customer({ invoices: settledRun(5, 500_000, 29) });
    expect(howTheyPay(onDate, 'in-time')).toMatchObject({ value: 'pays on the date' });
    // Clean, but not inside a week — so it is not one of the 86.
    expect(paysWithoutChasing(onDate)).toBe(false);
  });

  it('reads a quiet account in the past tense', () => {
    const wasGood = customer({ invoices: settledRun(5, 500_000, 10) });
    expect(howTheyPay(wasGood, 'quiet')).toMatchObject({ value: 'was reliable' });
  });

  it('says how many were late once anything has gone very late', () => {
    const bad = customer({
      invoices: [...settledRun(3, 300_000, 10), ...settledRun(2, 700_000, 70)],
    });
    const reading = howTheyPay(bad, 'past-due');
    expect(reading.status).toBe('known');
    if (reading.status === 'known') expect(reading.value).toMatch(/^late on \d+ of 5$/);
  });

  it('never leaves a bar without a sentence', () => {
    for (const where of ['past-due', 'in-time', 'quiet', 'clear'] as const) {
      for (const c of [customer(), customer({ invoices: settledRun(4, 400_000, 40) })]) {
        expect(howTheyPay(c, where).status).toBe('known');
        expect(howTheyPayShort(c, where).status).toBe('known');
      }
    }
  });
});

describe('the aging bands', () => {
  const owing = (ageDays: number, amount: number, id: string): Customer =>
    customer({
      id,
      invoices: [invoice({ doc: id, issued: day(-ageDays), dueOn: day(-ageDays + 30), total: m(amount) })],
      ledgerBalance: m(amount),
    });

  it('sum back to the total they are a share of', () => {
    // A bar whose segments do not add up to the figure above it is a bar
    // that is quietly rounding money away.
    const book = [owing(80, 1_000_000, 'a'), owing(50, 2_000_000, 'b'), owing(35, 3_000_000, 'c'), owing(4, 4_000_000, 'd')];
    const bands = agingBands(book, NOW);
    expect(Money.add(...bands.map((b) => b.amount))).toBe(totalOwed(book));
    expect(bands.map((b) => Money.format(b.amount))).toEqual([
      '1,000,000',
      '2,000,000',
      '3,000,000',
      '4,000,000',
    ]);
  });

  it('name each band by the oldest debt in it', () => {
    const bands = agingBands([owing(80, 1_000_000, 'a'), owing(71, 500_000, 'b')], NOW);
    expect(bands[0]?.reads).toBe('80d');
  });

  it('fall back to the band floor when a band is empty', () => {
    const bands = agingBands([owing(4, 4_000_000, 'd')], NOW);
    expect(bands.map((b) => b.reads)).toEqual(['60d', '45d', '30d', 'under 30d']);
    expect(bands.map((b) => b.share)).toEqual([0, 0, 0, 100]);
  });

  it('come back all zero for an empty book rather than dividing by nothing', () => {
    expect(agingBands([], NOW).map((b) => b.share)).toEqual([0, 0, 0, 0]);
  });
});

describe('the ask order', () => {
  const late = (id: string, amount: number, ageDays: number, limit: number | null): Customer =>
    customer({
      id,
      name: id,
      creditLimit: limit === null ? null : m(limit),
      invoices: [invoice({ doc: id, issued: day(-ageDays), dueOn: day(-ageDays + 30), total: m(amount) })],
      ledgerBalance: m(amount),
    });

  it('puts a blocked account first, whatever the arithmetic says', () => {
    const blocked = late('blocked', 2_000_000, 40, 1_000_000);
    const bigger = late('bigger', 9_000_000, 80, null);
    expect([bigger, blocked].sort(byAsk(NOW)).map((c) => c.id)).toEqual(['blocked', 'bigger']);
  });

  it('then ranks by shillings times days, not by either alone', () => {
    const oldSmall = late('old-small', 1_000_000, 90, null);
    const newBig = late('new-big', 4_000_000, 40, null);
    // Biggest: new-big. Oldest: old-small. Costing the most: new-big at
    // 160m shilling-days against 90m.
    expect([oldSmall, newBig].sort(byAsk(NOW)).map((c) => c.id)).toEqual(['new-big', 'old-small']);
  });

  it('asks everyone who owes, worst first — not only the past due', () => {
    // This assertion used to read "asks only accounts that are actually past
    // due", and returned ['due'] alone. It stopped being true on purpose.
    //
    // Past due needs a date to be past, and on the shop's real books there
    // is none: no account has `terms_days`, and only one has ever named a
    // day. Ranking the past-due alone therefore ranked NOBODY, and the
    // screen answered "who do I ask first" with an empty list while thirteen
    // accounts owed 8,210,000 — and told the owner "Nothing is owed by any
    // of the 120" while it did so.
    //
    // So the ask order covers everyone who owes, and `askReason` carries
    // what used to be expressed by membership: broke their word, named a
    // day, or was never asked for one.
    const notDue = customer({ id: 'in-time', invoices: [invoice({ total: m(9_000_000) })] });
    const due = late('due', 1_000_000, 40, null);
    const three = askTheseFirst(read([notDue, due], NOW), NOW);

    // The bigger, younger debt outranks the smaller older one on
    // shilling-days, and both are asked.
    expect(three.customers.map((c) => c.id)).toEqual(['in-time', 'due']);
    expect(three.share).toBe(100);
  });
});

describe('reading a name, a date and a rhythm', () => {
  it.each([
    ['Mulongo Hardware', 'MH'],
    ['Kato Construction Ltd', 'KC'],
    ['Ken Bwaise', 'KB'],
    ['Prince', 'P'],
    ['  spaced   out  ', 'SO'],
    ['', '?'],
  ])('%s is %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('counts the months before an account went quiet, not the last six', () => {
    // Measuring the calendar's last six months would call every quiet
    // account occasional, which is the opposite of what the row is saying.
    const monthly = customer({
      invoices: [0, 31, 62, 93, 124].map((ago, i) =>
        invoice({ doc: `M-${i}`, issued: day(-120 - ago), dueOn: day(-90 - ago) }),
      ),
    });
    expect(boughtMonthly(monthly)).toBe(true);
    expect(boughtMonthly(customer({ invoices: [] }))).toBe(false);
  });

  it('counts two years of buying from the invoices, not from a stored total', () => {
    const c = customer({
      invoices: [
        invoice({ doc: 'in', issued: day(-700), total: m(400_000) }),
        invoice({ doc: 'out', issued: day(-800), total: m(999_000) }),
      ],
    });
    expect(Money.format(boughtOver(c, NOW))).toBe('400,000');
  });

  it('names a quiet account by when it last bought and how it used to buy', () => {
    const quiet = customer({
      invoices: [invoice({ issued: day(-120), dueOn: day(-90) })],
    });
    expect(rowNote(quiet, 'quiet', NOW)).toMatch(/^last bought \d+ \w+ · was (monthly|occasional)$/);
  });

  it('spells a small count for prose and leaves a large one as a figure', () => {
    expect(inWords(3)).toBe('three');
    expect(inWords(0)).toBe('no');
    expect(inWords(42)).toBe('42');
  });
});

describe('the margin reading', () => {
  const buying = customer({
    keptTwelveMonths: m(1_800_000),
    soldTwelveMonths: m(10_000_000),
    buys: [
      { product: 'Cement 50kg', shortName: 'cement', shareOfSpend: 60, margin: 12 },
      { product: 'Iron sheets G28', shortName: 'iron sheets', shareOfSpend: 40, margin: 27 },
    ],
  });

  it('works the rise out rather than asserting one', () => {
    // Raising one product's price lifts what is KEPT and what is SOLD
    // together, so the answer is never the naive gap-over-share. At 60% of
    // spend and a six-point gap, (0.24 - 0.18) / (0.60 x 0.76) is 13%.
    const reading = marginReading(buying, 24);
    expect(reading.status).toBe('known');
    if (reading.status === 'known') {
      expect(reading.value).toBe(
        'Cement is most of what they take and the thinnest thing you sell. A 13% rise on cement alone would put this account at the shop average.',
      );
    }
  });

  it('does not tell the owner to raise a price on an account already above average', () => {
    const good = customer({
      keptTwelveMonths: m(3_000_000),
      soldTwelveMonths: m(10_000_000),
      buys: buying.buys,
    });
    const reading = marginReading(good, 24);
    expect(reading.status).toBe('known');
    if (reading.status === 'known') expect(reading.value).toContain('at or above the shop average');
  });

  it('says nothing at all when it has nothing to say it from', () => {
    expect(marginReading(customer(), 24).status).toBe('unavailable');
    expect(
      marginReading(
        customer({ keptTwelveMonths: m(1), soldTwelveMonths: m(10), buys: [] }),
        24,
      ).status,
    ).toBe('unavailable');
  });
});

/**
 * What "past due" means on this shop's real books.
 *
 * Not one of its 120 accounts has `terms_days` recorded, so every invoice's
 * `dueOn` is null, `isPastDue` is false everywhere, and a lateness test
 * built on terms alone reports thirteen accounts owing 8,210,000 as all "in
 * time". The shop's own answer is `payment_promises`: a day the CUSTOMER
 * named, which is better evidence than a term nobody agreed with them.
 */
describe('a promise, kept or broken', () => {
  const promise = (over: Partial<Promised> = {}): Promised => ({
    id: 'p-1',
    promisedOn: day(-3),
    madeOn: day(-10),
    amount: null,
    note: null,
    ...over,
  });

  const owing = (over: Partial<Customer> = {}): Customer =>
    customer({
      invoices: [invoice({ doc: 'INV-1', total: m(400_000), received: Money.ZERO })],
      ...over,
    });

  it('is broken once the day they named has passed and the debt stands', () => {
    const p = promise({ promisedOn: day(-3) });
    const c = owing({ promises: [p] });

    expect(promiseState(p, c, NOW)).toBe('broken');
    expect(hasBrokenPromise(c, NOW)).toBe(true);
  });

  it('is still waiting on the day itself — nobody is a liar at nine in the morning', () => {
    const p = promise({ promisedOn: day(0) });
    const c = owing({ promises: [p] });

    expect(promiseState(p, c, NOW)).toBe('waiting');
    expect(hasBrokenPromise(c, NOW)).toBe(false);
  });

  it('is waiting while the day is still ahead', () => {
    const p = promise({ promisedOn: day(4) });
    const c = owing({ promises: [p] });

    expect(promiseState(p, c, NOW)).toBe('waiting');
  });

  it('is kept by owing nothing, whatever the figures say', () => {
    const p = promise({ promisedOn: day(-30) });
    const c = customer({
      invoices: [invoice({ doc: 'INV-1', total: m(400_000), received: m(400_000) })],
      promises: [p],
    });

    expect(promiseState(p, c, NOW)).toBe('kept');
  });

  it('is kept when a named figure arrived inside its own window', () => {
    const p = promise({ promisedOn: day(-3), madeOn: day(-10), amount: m(100_000) });
    const c = owing({ promises: [p], payments: [{ on: day(-5), amount: m(100_000) }] });

    expect(promiseState(p, c, NOW)).toBe('kept');
  });

  it('is not kept by money that arrived before they promised', () => {
    // A payment on the 1st is not the answer to a promise made on the 5th.
    const p = promise({ promisedOn: day(-3), madeOn: day(-10), amount: m(100_000) });
    const c = owing({ promises: [p], payments: [{ on: day(-20), amount: m(100_000) }] });

    expect(promiseState(p, c, NOW)).toBe('broken');
  });

  it('naming no figure means the balance, so a part payment does not keep it', () => {
    const p = promise({ promisedOn: day(-3), amount: null });
    const c = owing({ promises: [p], payments: [{ on: day(-5), amount: m(50_000) }] });

    expect(promiseState(p, c, NOW)).toBe('broken');
  });

  it('counts them — one is a bad week, the third is the customer', () => {
    const c = owing({
      promises: [
        promise({ id: 'p-1', promisedOn: day(-20), madeOn: day(-25) }),
        promise({ id: 'p-2', promisedOn: day(-10), madeOn: day(-15) }),
        promise({ id: 'p-3', promisedOn: day(4), madeOn: day(-1) }),
      ],
    });

    expect(promisesBroken(c, NOW)).toBe(2);
  });

  it('reads the newest word they gave, not the first', () => {
    const c = owing({
      promises: [
        promise({ id: 'old', promisedOn: day(-20), madeOn: day(-25) }),
        promise({ id: 'new', promisedOn: day(4), madeOn: day(-1) }),
      ],
    });

    expect(latestPromise(c, NOW)?.promise.id).toBe('new');
    expect(latestPromise(c, NOW)?.state).toBe('waiting');
  });

  it('has nothing to say about an account that has never promised', () => {
    expect(latestPromise(owing(), NOW)).toBeNull();
    expect(hasBrokenPromise(owing(), NOW)).toBe(false);
  });
});

describe('standing, on books with no terms recorded', () => {
  const noTerms = (over: Partial<Customer> = {}): Customer =>
    customer({
      invoices: [
        invoice({ doc: 'INV-1', total: m(400_000), received: Money.ZERO, dueOn: null }),
      ],
      ...over,
    });

  it('puts an account that broke its word on the past-due list', () => {
    const c = noTerms({
      promises: [{ id: 'p', promisedOn: day(-3), madeOn: day(-10), amount: null, note: null }],
    });

    expect(standing(c, NOW)).toBe('past-due');
    expect(read([c], NOW).pastDue).toHaveLength(1);
  });

  it('leaves an account still inside its word in time', () => {
    const c = noTerms({
      promises: [{ id: 'p', promisedOn: day(4), madeOn: day(-1), amount: null, note: null }],
    });

    expect(standing(c, NOW)).toBe('in-time');
  });

  it('still reads as in time when nobody has asked them for a day', () => {
    // Which is the honest answer: the shop has not agreed terms and they
    // have not named a day, so there is nothing they are late against.
    expect(standing(noTerms(), NOW)).toBe('in-time');
  });
});

/**
 * Writing one down, at its edges.
 *
 * `draftPromise` is the only thing between what somebody typed and a row in
 * the shop's books, so what it does with a figure of zero and a day already
 * gone is the whole of it. Both are ported decisions, not choices made here,
 * and both are pinned.
 */
describe('drafting a promise', () => {
  const words = (over: Partial<Parameters<typeof draftPromise>[0]> = {}): Parameters<
    typeof draftPromise
  >[0] => ({ promisedOn: day(3), amount: null, ...over });

  const accepted = (over: Partial<Parameters<typeof draftPromise>[0]> = {}): PromiseRecord => {
    const draft = draftPromise(words(over), NOW);
    if (!draft.ok) throw new Error(`expected a promise, got: ${draft.why}`);
    return draft.record;
  };

  it('refuses a promise with no day in it, in the shop’s own words', () => {
    const draft = draftPromise(words({ promisedOn: null }), NOW);

    expect(draft.ok).toBe(false);
    expect(draft.ok ? '' : draft.why).toBe('A promise needs the day they said.');
  });

  it('refuses a day that is not a day', () => {
    expect(draftPromise(words({ promisedOn: new Date('the 3rd') }), NOW).ok).toBe(false);
  });

  it('stamps the day it was said, not the day it names', () => {
    // The distinction promiseState turns on: money that arrived BEFORE the
    // promise was made never kept it.
    expect(accepted().madeOn).toEqual(NOW);
    expect(accepted().promisedOn).toEqual(day(3));
  });

  // `amount numeric check (amount is null or amount > 0)`. Zero is not a
  // figure somebody named, and sending it would break the constraint and
  // lose the row — so it is read as what it means.
  it.each([0, -50_000])('reads a figure of %i as no figure named', (n) => {
    expect(accepted({ amount: m(n) }).amount).toBeNull();
  });

  it('keeps a figure somebody did name', () => {
    expect(accepted({ amount: m(1_000_000) }).amount).toBe(m(1_000_000));
  });

  it('trims a note and drops an empty one rather than writing a blank', () => {
    expect(accepted({ note: '  said at the yard  ' }).note).toBe('said at the yard');
    expect(accepted({ note: '   ' }).note).toBeNull();
    expect(accepted().note).toBeNull();
  });

  it('cuts a note to the length the old app writes, so both apps show the same one', () => {
    const long = 'x'.repeat(PROMISE_NOTE_MAX + 40);

    expect(accepted({ note: long }).note).toHaveLength(PROMISE_NOTE_MAX);
  });

  // Deliberate, and the old app's behaviour: somebody who named yesterday
  // and missed it is a record worth having, and it is the fact
  // promisesBroken counts. The screen can ask whether it was a typo; the
  // books do not get to refuse the observation.
  it('accepts a day already gone, and it reads as broken straight away', () => {
    const record = accepted({ promisedOn: day(-2) });
    const c = customer({
      invoices: [invoice({ doc: 'INV-1', total: m(400_000), received: Money.ZERO, dueOn: null })],
      promises: [{ id: 'p', ...record }],
    });

    expect(promiseState({ id: 'p', ...record }, c, NOW)).toBe('broken');
    expect(promisesBroken(c, NOW)).toBe(1);
  });
});
