/**
 * What the board promises.
 *
 * The handoff's own "before you say it is done" list is eight questions, and
 * six of them are questions about the mechanism rather than about pixels.
 * They are the tests below, in the handoff's order, because a rule nobody
 * checks is a rule that lasts until the next busy afternoon.
 */

import { describe, expect, it } from 'vitest';
import {
  INVOICING_DOES,
  STAGE_LIMIT_HOURS,
  UNDOING_INVOICE_DOES,
  QUEUE_EMPTY,
  ageLabel,
  ageTone,
  asksFor,
  invoiced,
  lineCheckedIn,
  loaded,
  moveOn,
  nextInvoiceNumber,
  nextStage,
  notInvoiced,
  onBoard,
  settledShort,
  steppedBack,
  supplierAnswered,
  dockBasis,
  handedOverAt,
  heldByPick,
  laneRule,
  laneWindow,
  markFor,
  meter,
  meterFor,
  moveFor,
  readTracking,
  stepBack,
  steps,
  type ShortPick,
  type TrackedOrder,
  type Trip,
} from './tracking.js';
import { Money, known, unavailable, type Derived, type Stage } from './index.js';

const NOW = new Date('2026-09-15T08:00:00Z');
const ago = (hours: number): Date => new Date(NOW.getTime() - hours * 3_600_000);

const card = (over: Partial<TrackedOrder> = {}): TrackedOrder => ({
  reference: '#341',
  customer: 'Ssekitoleko Hardware',
  place: 'Kisenyi',
  lines: 6,
  toBuy: 0,
  checkedIn: 0,
  stage: 'draft',
  since: ago(3),
  value: known(Money.money(1_240_000), 'order total'),
  suppliers: [],
  shortPick: null,
  packed: false,
  picker: null,
  run: null,
  invoice: null,
  ...over,
});

const trip: Trip = {
  route: 'Industrial Area, then Ndeeba',
  stops: 2,
  carry: known(Money.money(2_180_000), 'carried today'),
  runs: 2,
  overdue: 0,
};

const unsettled: ShortPick = { asked: 8, found: 6, settled: false };

/* -------------------------------------------------------------------------- */

describe('1. a chevron means nothing is owed, and only that', () => {
  it('locks a Taken order while any supplier is silent', () => {
    const waiting = card({
      suppliers: [
        { name: 'Haidery Hardware', answered: true },
        { name: 'Mulongo Hardware', answered: false },
      ],
    });
    expect(moveFor(waiting).control).toBe('lock');
  });

  it('moves a Taken order by the chevron once every supplier has answered', () => {
    const done = card({ suppliers: [{ name: 'Karddia', answered: true }] });
    expect(moveFor(done).control).toBe('chevron');
  });

  it('gives a chevron to a Taken order with nothing bought in — there is nobody to wait on', () => {
    expect(moveFor(card({ suppliers: [], toBuy: 0 })).control).toBe('chevron');
  });

  it('locks Buying until the last line is in, then hands it the chevron', () => {
    const part = card({ stage: 'awaiting_goods', toBuy: 9, checkedIn: 4 });
    const all = card({ stage: 'awaiting_goods', toBuy: 9, checkedIn: 9 });
    expect(moveFor(part).control).toBe('lock');
    expect(moveFor(all).control).toBe('chevron');
  });
});

describe('2. every padlock says what is owed, and names who where there is a who', () => {
  it('names the silent suppliers', () => {
    const waiting = card({
      suppliers: [
        { name: 'Mulongo Hardware', answered: false },
        { name: 'Bbosa Steel', answered: false },
      ],
    });
    expect(moveFor(waiting).why).toBe(
      'Cannot move yet — Mulongo Hardware, Bbosa Steel have not answered',
    );
  });

  it('counts the lines still out', () => {
    expect(moveFor(card({ stage: 'awaiting_goods', toBuy: 9, checkedIn: 4 })).why).toBe(
      'Cannot move yet — 4 of 9 lines are in',
    );
  });

  it('says what the pick came up short of', () => {
    expect(moveFor(card({ stage: 'preparing', shortPick: unsettled })).why).toBe(
      'Cannot move yet — a short pick is not settled: 6 found of 8 asked',
    );
  });

  it('has no padlock anywhere that says nothing', () => {
    const locks = [
      card({ suppliers: [{ name: 'Karddia', answered: false }] }),
      card({ stage: 'awaiting_goods', toBuy: 3, checkedIn: 1 }),
      card({ stage: 'preparing', shortPick: unsettled }),
    ].map(moveFor);
    for (const lock of locks) {
      expect(lock.control).toBe('lock');
      expect(lock.why.length).toBeGreaterThan('Cannot move yet — '.length);
    }
  });
});

describe('3. the way out of Preparing is the van, never an arrow', () => {
  it('is a van once the pick is settled', () => {
    expect(moveFor(card({ stage: 'preparing', packed: true })).control).toBe('van');
  });

  it('is a van whether or not it has been packed — packing is not the move', () => {
    expect(moveFor(card({ stage: 'preparing', packed: false })).control).toBe('van');
  });

  it('is never a chevron', () => {
    const settled: ShortPick = { asked: 8, found: 8, settled: true };
    for (const pick of [null, settled, unsettled]) {
      expect(moveFor(card({ stage: 'preparing', shortPick: pick })).control).not.toBe(
        'chevron',
      );
    }
  });

  it('holds it while a short pick is unsettled, and lets go when it is settled', () => {
    expect(heldByPick(card({ shortPick: unsettled }))).toBe(true);
    expect(heldByPick(card({ shortPick: { asked: 8, found: 6, settled: true } }))).toBe(false);
    expect(heldByPick(card({ shortPick: null }))).toBe(false);
  });
});

describe('4. the three invoicing figures are one figure', () => {
  const board = readTracking(
    [
      card({ reference: '#312', stage: 'completed', invoice: 'INV-0412', since: ago(3) }),
      ...Array.from({ length: 17 }, (_, i) =>
        card({ reference: `#${400 + i}`, stage: 'completed', since: ago(i / 4) }),
      ),
    ],
    trip,
    NOW,
  );

  it('says the same thing on the dock tile, the lane header and the card', () => {
    const lane = board.lanes.find((l) => l.stage === 'completed');
    expect(board.totals.toInvoice).toBe(17);
    expect(lane?.rule).toBe('1 of 18 invoiced.');
    expect(board.totals.invoiced + board.totals.toInvoice).toBe(board.totals.delivered);
  });

  it('swaps the card control on the one that is invoiced', () => {
    expect(moveFor(card({ stage: 'completed', invoice: null })).control).toBe('doc');
    expect(moveFor(card({ stage: 'completed', invoice: 'INV-0412' })).control).toBe('tick');
  });

  it('states what invoicing does before it acts, and what undoing it does', () => {
    expect(INVOICING_DOES).toHaveLength(4);
    expect(UNDOING_INVOICE_DOES).toHaveLength(4);
    // The undo has to reach further than the do: the Cash Book entries the
    // invoice raised are the fifth thing, and the frame says so.
    expect(UNDOING_INVOICE_DOES.join(' ')).toMatch(/Cash Book/);
  });
});

describe('5. a step back names what it costs before it happens', () => {
  it.each<[Stage, string, string]>([
    ['awaiting_goods', 'Buying', 'Taken'],
    ['preparing', 'Preparing', 'Buying'],
    ['pending_delivery', 'Out', 'Preparing'],
    ['completed', 'Delivered', 'Out'],
  ])('%s steps back from %s to %s, and says the cost', (stage, from, to) => {
    const step = stepBack(stage);
    expect(step?.from).toBe(from);
    expect(step?.to).toBe(to);
    expect(step?.cost).toMatch(/\.$/);
  });

  it('has nowhere to send Taken', () => {
    expect(stepBack('draft')).toBeNull();
  });

  it('promises that nothing billed is touched, everywhere that is true', () => {
    expect(stepBack('preparing')?.cost).toBe(
      'The picker is dropped and the pick starts again. Nothing billed is touched.',
    );
  });
});

/* -------------------------------------------------------------------------- */

describe('the dot meter', () => {
  it('is grey while partial and green when full', () => {
    expect(meter(4, 9)).toEqual(['part', 'part', 'part', 'empty', 'empty', 'empty']);
    expect(meter(9, 9)).toEqual(Array.from({ length: 6 }, () => 'full'));
  });

  it('never draws more than six segments, whatever the line count', () => {
    expect(meter(3, 11)).toHaveLength(6);
    expect(meter(0, 40)).toHaveLength(6);
  });

  it('draws nothing where there is nothing to count', () => {
    expect(meter(0, 0)).toEqual([]);
  });
});

describe('the two words beside it', () => {
  it('names the supplier being waited on', () => {
    expect(markFor(card({ suppliers: [{ name: 'Bbosa Steel', answered: false }] }))).toEqual({
      text: 'waiting: Bbosa Steel',
      tone: 'waiting',
    });
  });

  it('counts what the pick is short by, not what it found', () => {
    expect(markFor(card({ stage: 'preparing', shortPick: unsettled }))?.text).toBe('short 2');
  });

  it('says nothing at all when there is nothing to say', () => {
    expect(markFor(card({ stage: 'preparing', packed: false }))).toBeNull();
    expect(markFor(card({ stage: 'awaiting_goods', toBuy: 9, checkedIn: 4 }))).toBeNull();
  });

  it('is never more than two words, a supplier name aside', () => {
    const marks = [
      markFor(card({ suppliers: [{ name: 'Karddia', answered: true }] })),
      markFor(card({ stage: 'awaiting_goods', toBuy: 3, checkedIn: 3 })),
      markFor(card({ stage: 'preparing', packed: true })),
      markFor(card({ stage: 'completed', invoice: 'INV-0412' })),
    ];
    for (const mark of marks) {
      expect(mark?.text.split(' ')).toHaveLength(mark?.text.startsWith('all') === true ? 2 : 1);
    }
  });
});

describe('age, and the tone that comes off the limit', () => {
  it('turns amber at half the limit and coral past it', () => {
    expect(ageTone(card({ since: ago(5) }), NOW)).toBe('quiet');
    expect(ageTone(card({ since: ago(7) }), NOW)).toBe('closing');
    expect(ageTone(card({ since: ago(13) }), NOW)).toBe('past');
  });

  it('is quiet — not past — when the books do not say when it arrived', () => {
    // Absence is not lateness, the same way absence is not zero.
    expect(ageTone(card({ since: null }), NOW)).toBe('quiet');
    expect(ageLabel(card({ since: null }), NOW)).toBe('—');
  });

  it('writes the age the way the shop says it', () => {
    expect(ageLabel(card({ since: ago(21 + 8 / 60) }), NOW)).toBe('21h 08m');
    expect(ageLabel(card({ since: ago(0.35) }), NOW)).toBe('0h 21m');
  });

  it('gives a delivered order a day on the board, not twelve hours', () => {
    expect(STAGE_LIMIT_HOURS.completed).toBe(24);
    expect(ageTone(card({ stage: 'completed', since: ago(13) }), NOW)).toBe('closing');
  });

  it('reads the handover time off the same moment the age comes from', () => {
    // 08:00Z is 11:00 in Kampala, so three hours and twenty minutes ago is 07:40.
    expect(handedOverAt(card({ since: ago(3 + 20 / 60) }))).toBe('07:40');
    expect(handedOverAt(card({ since: null }))).toBeNull();
  });
});

describe('the lane rules', () => {
  it('are four words, and the fifth is a figure', () => {
    expect(laneRule('draft', [])).toBe('Unlocks when the supplier answers.');
    expect(laneRule('awaiting_goods', [])).toBe('Unlocks on the last line in.');
    expect(laneRule('preparing', [])).toBe('Loading is the move.');
    expect(laneRule('pending_delivery', [])).toBe('Closes on delivery.');
  });

  it('counts Delivered rather than describing it', () => {
    const lane = [
      card({ stage: 'completed', invoice: 'INV-0412' }),
      card({ stage: 'completed' }),
      card({ stage: 'completed' }),
    ];
    expect(laneRule('completed', lane)).toBe('1 of 3 invoiced.');
  });
});

describe('one reckoning', () => {
  const orders = [
    card({ reference: '#341', since: ago(21) }),
    card({ reference: '#348', since: ago(14) }),
    card({ reference: '#361', since: ago(9), suppliers: [{ name: 'Karddia', answered: false }] }),
    card({ reference: '#344', stage: 'awaiting_goods', toBuy: 9, checkedIn: 4, since: ago(17) }),
    card({ reference: '#345', stage: 'preparing', since: ago(5), packed: true }),
    card({ reference: '#328', stage: 'pending_delivery', since: ago(5), run: 'Run 1 · Kizito' }),
    card({ reference: '#312', stage: 'completed', since: ago(3), invoice: 'INV-0412' }),
    card({ reference: '#314', stage: 'completed', since: ago(2) }),
  ];
  const board = readTracking(orders, trip, NOW);

  it('counts every lane once, and the board is their sum', () => {
    expect(board.lanes.map((l) => l.count)).toEqual([3, 1, 1, 1, 2]);
    expect(board.totals.live).toBe(8);
    expect(board.lanes.reduce((n, l) => n + l.count, 0)).toBe(board.totals.live);
  });

  it('gives the phone strip the same counts the desktop lanes draw', () => {
    expect(steps(board).map((s) => s.count)).toEqual(board.lanes.map((l) => l.count));
    expect(steps(board).map((s) => s.label)).toEqual([
      'Taken',
      'Buying',
      'Prep',
      'Out',
      'Done',
    ]);
  });

  it('marks a lane for chasing exactly when it holds a padlock', () => {
    const [taken, buying, preparing] = steps(board);
    expect(taken?.chasing).toBe(true);
    expect(buying?.chasing).toBe(true);
    expect(preparing?.chasing).toBe(false);
  });

  it('reads the cash to buy in off the trip, because it is the trip', () => {
    expect(board.totals.cashToBuyIn).toBe(trip.carry);
  });

  it('counts past the stage limit once, for the whole board', () => {
    // #341 at 21h, #348 at 14h and #344 at 17h are past a 12h limit; the
    // 9h order is closing on it and the delivered pair have a day.
    expect(board.totals.pastStageLimit).toBe(3);
    expect(board.lanes.map((l) => l.past)).toEqual([2, 1, 0, 0, 0]);
  });

  it('never states a total for the board, because there is no such figure', () => {
    // Each lane is worth what that lane means. Summing quoted money, money
    // on order and money on a lorry would be a confident falsehood.
    expect(board.lanes.map((l) => l.worth.status)).toEqual(
      Array.from({ length: 5 }, () => 'known'),
    );
    expect(Object.keys(board.totals)).not.toContain('worth');
  });

  it('gives every dock tile a basis, in the board’s own numbers', () => {
    const basis = dockBasis(board);
    expect(basis.live).toBe('3 · 1 · 1 · 1 · 2 across the five lanes');
    expect(basis.toInvoice).toBe('1 of 2 delivered is invoiced');
    expect(basis.cashToBuyIn).toBe('2 stops on today’s trip');
    expect(basis.pastStageLimit).toBe('of 8 on the board, past a 12h limit');
  });

  it('is partial the moment one order cannot be read, and never zero', () => {
    const unreadable: Derived<Money.Money> = unavailable('the quote is still out');
    const withGap = readTracking([card({ value: unreadable }), card()], trip, NOW);
    expect(withGap.lanes[0]?.worth.status).toBe('partial');
  });
});

describe('the window a lane draws, and the count it owes for the rest', () => {
  const many = Array.from({ length: 9 }, (_, i) =>
    card({ reference: `#${340 + i}`, since: ago(21 - i * 2) }),
  );

  it('puts the oldest at the top and says how many were cut', () => {
    const board = readTracking(many, trip, NOW);
    const lane = board.lanes[0];
    if (lane === undefined) throw new Error('no lane');
    const win = laneWindow(lane, NOW, 4);
    expect(win.shown.map((o) => o.reference)).toEqual(['#340', '#341', '#342', '#343']);
    expect(win.behind).toBe(5);
    expect(win.more).toBe('+5 more');
  });

  it('takes Delivered from the recent end, then draws THAT oldest first', () => {
    // Two cuts, and they are different questions: the board keeps the six
    // most recent of today, and the design draws as many of those as fit.
    // Drawing the newest four instead would drop the card the lane is
    // actually about — the one that has just been invoiced.
    const board = readTracking(
      many.map((o) => ({ ...o, stage: 'completed' as const })),
      trip,
      NOW,
    );
    const lane = board.lanes[4];
    if (lane === undefined) throw new Error('no lane');
    expect(laneWindow(lane, NOW, 6).shown.map((o) => o.reference)).toEqual([
      '#343',
      '#344',
      '#345',
      '#346',
      '#347',
      '#348',
    ]);
    const win = laneWindow(lane, NOW, 4);
    expect(win.shown.map((o) => o.reference)).toEqual(['#343', '#344', '#345', '#346']);
    expect(win.more).toBe('+5 earlier today');
  });

  it('owes nothing when the whole lane fits', () => {
    const board = readTracking(many.slice(0, 3), trip, NOW);
    const lane = board.lanes[0];
    if (lane === undefined) throw new Error('no lane');
    expect(laneWindow(lane, NOW, 4).more).toBeNull();
  });
});

describe('an empty lane still says something', () => {
  it('names what would put an order there', () => {
    const board = readTracking([], trip, NOW);
    for (const lane of board.lanes) {
      expect(lane.count).toBe(0);
      expect(lane.empty.length).toBeGreaterThan(20);
    }
  });
});

/* -------------------------------------------------------------------------- */

describe('the moves themselves', () => {
  const LATER = new Date(NOW.getTime() + 60_000);

  it('sends a Taken order with nothing bought in past Buying, not into it', () => {
    expect(nextStage(card({ toBuy: 0 }))).toBe('preparing');
    expect(nextStage(card({ toBuy: 4 }))).toBe('awaiting_goods');
  });

  it('gives Preparing no forward move at all — loading is the only way out', () => {
    expect(nextStage(card({ stage: 'preparing' }))).toBeNull();
    expect(moveOn(card({ stage: 'preparing', packed: true }), LATER).stage).toBe('preparing');
  });

  it('refuses to move a locked card, whatever presses it', () => {
    const locked = card({ suppliers: [{ name: 'Bbosa Steel', answered: false }] });
    expect(moveOn(locked, LATER)).toBe(locked);
  });

  it('stamps the moment an order enters its new lane, so its age starts again', () => {
    const moved = moveOn(card({ toBuy: 2, since: ago(20), suppliers: [] }), LATER);
    expect(moved.stage).toBe('awaiting_goods');
    expect(moved.since).toBe(LATER);
  });

  it('will not load an order whose short pick is unsettled', () => {
    const held = card({ stage: 'preparing', shortPick: unsettled });
    expect(loaded(held, 'Run 1 \u00b7 Kizito', LATER)).toBe(held);
  });

  it('names who carries it on the way out', () => {
    const out = loaded(card({ stage: 'preparing', packed: true }), 'Run 2 \u00b7 Opio', LATER);
    expect(out.stage).toBe('pending_delivery');
    expect(out.run).toBe('Run 2 \u00b7 Opio');
  });

  it('drops the picker and resets the pick when it steps back out of Preparing', () => {
    const back = steppedBack(
      card({ stage: 'preparing', picker: 'Alice', packed: true, shortPick: unsettled }),
      LATER,
    );
    expect(back.stage).toBe('awaiting_goods');
    expect(back.picker).toBeNull();
    expect(back.shortPick).toBeNull();
    expect(back.packed).toBe(false);
  });

  it('takes it off the run when it steps back out of Out', () => {
    const back = steppedBack(
      card({ stage: 'pending_delivery', run: 'Run 1 \u00b7 Kizito', picker: 'Musoke' }),
      LATER,
    );
    expect(back.stage).toBe('preparing');
    expect(back.run).toBeNull();
    expect(back.picker).toBeNull();
  });

  it('asks the suppliers again on the way back into Taken, and keeps what is checked in', () => {
    const back = steppedBack(
      card({
        stage: 'awaiting_goods',
        toBuy: 9,
        checkedIn: 4,
        suppliers: [{ name: 'Haidery', answered: true }],
      }),
      LATER,
    );
    expect(back.stage).toBe('draft');
    expect(back.checkedIn).toBe(4);
    expect(back.suppliers).toEqual([{ name: 'Haidery', answered: false }]);
    expect(moveFor(back).control).toBe('lock');
  });

  it('has nowhere to step Taken back to', () => {
    const first = card();
    expect(steppedBack(first, LATER)).toBe(first);
  });

  it('settles a short pick either by amending the order or by confirming it went out', () => {
    const held = card({ stage: 'preparing', lines: 8, shortPick: unsettled });
    expect(heldByPick(settledShort(held, 'confirm'))).toBe(false);
    expect(settledShort(held, 'confirm').shortPick?.settled).toBe(true);

    const amended = settledShort(held, 'amend');
    expect(amended.shortPick).toBeNull();
    expect(amended.lines).toBe(6);
    expect(moveFor(amended).control).toBe('van');
  });

  it('numbers an invoice one past the highest the board carries, and the tick undoes it', () => {
    const board = [card({ stage: 'completed', invoice: 'INV-0412' }), card()];
    expect(nextInvoiceNumber(board)).toBe('INV-0413');
    expect(nextInvoiceNumber([card()])).toBe('INV-0001');

    const done = invoiced(card({ stage: 'completed' }), 'INV-0413');
    expect(moveFor(done).control).toBe('tick');
    expect(moveFor(notInvoiced(done)).control).toBe('doc');
  });
});

describe('clearing a padlock', () => {
  const LATER = new Date(NOW.getTime() + 60_000);

  it('moves a Taken order ITSELF when the last supplier answers', () => {
    const waiting = card({
      toBuy: 2,
      suppliers: [
        { name: 'Haidery', answered: true },
        { name: 'Bbosa Steel', answered: false },
      ],
    });
    expect(moveFor(waiting).control).toBe('lock');

    const answered = supplierAnswered(waiting, 'Bbosa Steel', LATER);
    // It left Taken on its own — nobody pressed a chevron.
    expect(answered.stage).toBe('awaiting_goods');
    expect(answered.since).toBe(LATER);
  });

  it('stays put while anyone else is still owed, and says who', () => {
    const waiting = card({
      suppliers: [
        { name: 'Mulongo Hardware', answered: false },
        { name: 'Bbosa Steel', answered: false },
      ],
    });
    const one = supplierAnswered(waiting, 'Mulongo Hardware', LATER);
    expect(one.stage).toBe('draft');
    expect(moveFor(one).control).toBe('lock');
    expect(markFor(one)?.text).toBe('waiting: Bbosa Steel');
  });

  it('UNLOCKS Buying on the last line in, and does not move it', () => {
    let order = card({ stage: 'awaiting_goods', toBuy: 3, checkedIn: 1 });
    expect(meterFor(order)).toEqual(['part', 'empty', 'empty']);

    order = lineCheckedIn(order);
    expect(moveFor(order).control).toBe('lock');

    order = lineCheckedIn(order);
    // All in: a chevron, still in Buying. Goods arriving is not picking.
    expect(order.stage).toBe('awaiting_goods');
    expect(moveFor(order).control).toBe('chevron');
    expect(markFor(order)?.text).toBe('all in');
    expect(meterFor(order)).toEqual(['full', 'full', 'full']);
  });

  it('cannot check in more lines than the order has to buy', () => {
    const full = card({ stage: 'awaiting_goods', toBuy: 2, checkedIn: 2 });
    expect(lineCheckedIn(full)).toBe(full);
  });

  it('leaves a lane that has no supplier to answer alone', () => {
    const preparing = card({ stage: 'preparing' });
    expect(supplierAnswered(preparing, 'Anyone', LATER)).toBe(preparing);
    expect(lineCheckedIn(preparing)).toBe(preparing);
  });
});

/* -------------------------------------------------------------------------- */

describe('9. what the board keeps, and what it has finished with', () => {
  const board = (orders: readonly TrackedOrder[]) => readTracking(orders, trip, NOW);

  it('lets an invoiced delivery go after a day, and only an invoiced one', () => {
    const old = { stage: 'completed' as Stage, since: ago(30) };
    const billed = card({ reference: '#286', ...old, invoice: 'INV-0286' });
    const unbilled = card({ reference: '#288', ...old });

    expect(onBoard([billed, unbilled], NOW).map((o) => o.reference)).toEqual(['#288']);
  });

  it('keeps an invoiced delivery that is still inside the day', () => {
    const fresh = card({ stage: 'completed', since: ago(12), invoice: 'INV-0286' });
    expect(onBoard([fresh], NOW)).toHaveLength(1);
  });

  /**
   * The shop's own books carry orders flagged invoiced while they sit in
   * Preparing — #150 is one. The work is in the lane, not in the flag.
   */
  it('keeps an order still in a lane however its invoice flag reads', () => {
    const working = card({ stage: 'preparing', since: ago(900), invoice: 'INV-0150' });
    expect(onBoard([working], NOW)).toHaveLength(1);
  });

  it('keeps a delivery whose books do not say when it arrived', () => {
    const silent = card({ stage: 'completed', since: null, invoice: 'INV-0286' });
    expect(onBoard([silent], NOW)).toHaveLength(1);
  });

  /**
   * The bug this was written for: `INVOICED_STAY_HOURS` was declared,
   * documented and never applied, so a month of finished orders sat in
   * Delivered and `Past stage limit` read 152 of 156 on the real books.
   */
  it('counts only what it keeps, in every figure on the dock', () => {
    const gone = Array.from({ length: 20 }, (_, i) =>
      card({ reference: `#2${i}`, stage: 'completed', since: ago(200), invoice: `INV-02${i}` }),
    );
    const here = card({ reference: '#341', stage: 'draft', since: ago(30) });
    const read = board([...gone, here]);

    expect(read.totals.live).toBe(1);
    expect(read.totals.pastStageLimit).toBe(1);
    expect(read.totals.delivered).toBe(0);
    expect(read.lanes[4]?.count).toBe(0);
  });
});

describe('10. the queue is the board, read once', () => {
  const asks = (orders: readonly TrackedOrder[]) => asksFor(readTracking(orders, trip, NOW), NOW);

  it('says nothing wants you rather than nothing at all', () => {
    expect(asks([card({ since: ago(1) })])).toEqual([]);
    expect(QUEUE_EMPTY).toBe('Nothing on the board is waiting on you.');
  });

  it('waits for the board to call a card late before asking about it', () => {
    const silent = [{ name: 'Mulongo Hardware', answered: false }];
    expect(asks([card({ since: ago(3), suppliers: silent })])).toEqual([]);
    expect(asks([card({ since: ago(21), suppliers: silent })])).toHaveLength(1);
  });

  it('names the silent suppliers rather than counting them', () => {
    const late = card({
      since: ago(21),
      suppliers: [
        { name: 'Mulongo Hardware', answered: false },
        { name: 'Bbosa Steel', answered: true },
        { name: 'Karddia', answered: false },
      ],
    });
    expect(asks([late])[0]?.why).toBe(
      'Mulongo Hardware and Karddia have not answered. Chase them or buy elsewhere.',
    );
  });

  it('sends a buying question to the buying list and a move to the card', () => {
    const buying = card({ stage: 'awaiting_goods', since: ago(21), toBuy: 9, checkedIn: 4 });
    const ready = card({ stage: 'pending_delivery', since: ago(21) });

    expect(asks([buying])[0]?.act).toEqual({ label: 'Buying list', door: 'sourcing' });
    expect(asks([ready])[0]?.act).toEqual({ label: 'Move it on', door: null });
  });

  /**
   * Buying's rule is "unlocks on the last line in", and an order with no
   * line to buy waits for a line that does not exist. Only a person gets it
   * out, which is the whole definition of this queue.
   */
  it('catches the order its own lane can never unlock', () => {
    const stuck = card({ stage: 'awaiting_goods', since: ago(21), toBuy: 0, checkedIn: 0 });
    expect(asks([stuck])[0]?.reason).toBe('lane-cannot-unlock');
  });

  it('leaves loading alone — a van is a job, not a decision', () => {
    const toLoad = card({ stage: 'preparing', since: ago(21), shortPick: null });
    expect(asks([toLoad])).toEqual([]);
    expect(moveFor(toLoad).control).toBe('van');
  });

  it('asks about a short pick until somebody settles it', () => {
    const at = { stage: 'preparing' as Stage, since: ago(21) };
    expect(asks([card({ ...at, shortPick: unsettled })])[0]?.reason).toBe('short-pick');
    expect(asks([card({ ...at, shortPick: { ...unsettled, settled: true } })])).toEqual([]);
  });

  it('asks about a handover nobody billed, a day after the handover', () => {
    const at = { stage: 'completed' as Stage };
    expect(asks([card({ ...at, since: ago(10) })])).toEqual([]);
    expect(asks([card({ ...at, since: ago(30) })])[0]?.reason).toBe('not-invoiced');
  });

  it('asks once per order, longest waiting first', () => {
    const late = [
      card({ reference: '#344', stage: 'awaiting_goods', since: ago(17), toBuy: 9, checkedIn: 4 }),
      card({ reference: '#341', since: ago(21), suppliers: [{ name: 'Mulongo', answered: false }] }),
      card({ reference: '#357', stage: 'pending_delivery', since: ago(15) }),
    ];
    expect(asks(late).map((a) => a.reference)).toEqual(['#341', '#344', '#357']);
  });

  /**
   * The queue cannot see a card the board has let go, because it is handed
   * the board rather than the array behind it. The head of this screen used
   * to print `54 live · 20 need you` about two readings that had never been
   * compared.
   */
  it('cannot ask about a card the board has finished with', () => {
    const gone = card({ stage: 'completed', since: ago(200), invoice: 'INV-0286' });
    const unbilled = card({ reference: '#288', stage: 'completed', since: ago(200) });
    const read = readTracking([gone, unbilled], trip, NOW);

    expect(asksFor(read, NOW).map((a) => a.reference)).toEqual(['#288']);
  });
});
