import { describe, expect, it } from 'vitest';
import { Money, known, partial, unavailable, type Derived } from './index.js';
import {
  decisions,
  expectedCompletion,
  hoursOverdue,
  hoursWaiting,
  isOverdue,
  laneValue,
  margin,
  marginOf,
  readBoard,
  STAGE,
  STAGES,
  WAITS_ON,
  type Order,
  type Stage,
} from './orders.js';

const NOW = new Date('2026-09-17T14:00:00Z');
const hoursAgo = (h: number): Date => new Date(NOW.getTime() - h * 3_600_000);

const order = (over: Partial<Order> & { id: string; stage: Stage }): Order => ({
  reference: `OW-${over.id}`,
  customer: 'Kato Construction Ltd',
  summary: 'Cement ×120',
  since: hoursAgo(1),
  value: known(Money.money(1_000_000), 'order total'),
  cost: known(Money.money(700_000), 'supplier invoices'),
  unreadable: [],
  ...over,
});

describe('the five stages', () => {
  it('is a complete, ordered board', () => {
    expect(STAGES).toEqual([
      'draft',
      'awaiting_goods',
      'preparing',
      'pending_delivery',
      'completed',
    ]);
    expect(STAGES.map((s) => STAGE[s].step)).toEqual([1, 2, 3, 4, 5]);
  });

  it('gives every lane a rule, a money word and an empty sentence', () => {
    for (const s of STAGES) {
      expect(STAGE[s].rule, s).toMatch(/\.$/);
      expect(STAGE[s].money, s).toBeTruthy();
      expect(STAGE[s].empty, s).toBeTruthy();
    }
  });

  it('gives no two lanes the same word for their money', () => {
    // Money quoted is not money owed and neither is money on a lorry. If two
    // lanes shared a word, the board would be inviting a total across them.
    const words = STAGES.map((s) => STAGE[s].money);
    expect(new Set(words).size).toBe(words.length);
  });

  it('knows that three of the five lanes wait on somebody else', () => {
    const notOwner = STAGES.filter((s) => WAITS_ON[s] !== 'owner');
    expect(notOwner).toHaveLength(4);
    expect(WAITS_ON.awaiting_goods).toBe('supplier');
    expect(WAITS_ON.preparing).toBe('worker');
  });
});

describe('waiting and overdue', () => {
  it('reads how long an order has sat', () => {
    expect(hoursWaiting(order({ id: '1', stage: 'preparing', since: hoursAgo(5) }), NOW)).toBe(5);
  });

  it('is not overdue inside the lane’s patience', () => {
    // preparing is patient for 8 hours.
    expect(isOverdue(order({ id: '1', stage: 'preparing', since: hoursAgo(7) }), NOW)).toBe(false);
    expect(isOverdue(order({ id: '1', stage: 'preparing', since: hoursAgo(9) }), NOW)).toBe(true);
  });

  it('gives each lane its own patience — a pick is not a Kikuubo run', () => {
    const at30h = (stage: Stage): boolean =>
      isOverdue(order({ id: '1', stage, since: hoursAgo(30) }), NOW);
    expect(at30h('preparing')).toBe(true); // 8h
    expect(at30h('awaiting_goods')).toBe(false); // 48h
  });

  it('never calls an order with no date overdue', () => {
    // Unknown is not fine, and it is not late either. Treating unknown as
    // fine is the same mistake as treating absent as zero.
    const o = order({ id: '1', stage: 'preparing', since: null });
    expect(isOverdue(o, NOW)).toBe(false);
    expect(hoursWaiting(o, NOW)).toBeNull();
    expect(readBoard([o], NOW).unknownAge).toHaveLength(1);
  });
});

describe('readBoard', () => {
  it('groups every order into its lane, and leaves no lane undefined', () => {
    const board = readBoard([order({ id: '1', stage: 'preparing' })], NOW);
    for (const s of STAGES) expect(board.byStage[s]).toBeDefined();
    expect(board.byStage.preparing).toHaveLength(1);
    expect(board.byStage.draft).toEqual([]);
  });

  it('finds no bottleneck when nothing is stuck', () => {
    const board = readBoard(
      [order({ id: '1', stage: 'preparing', since: hoursAgo(1) })],
      NOW,
    );
    expect(board.bottleneck).toBeNull();
  });

  it('names the lane with the most OVERDUE, not the most orders', () => {
    // A full Preparing lane on a busy morning is the shop working. One order
    // stuck since yesterday is the shop stopped.
    const board = readBoard(
      [
        order({ id: '1', stage: 'preparing', since: hoursAgo(1) }),
        order({ id: '2', stage: 'preparing', since: hoursAgo(1) }),
        order({ id: '3', stage: 'preparing', since: hoursAgo(1) }),
        order({ id: '4', stage: 'draft', since: hoursAgo(72) }),
      ],
      NOW,
    );
    expect(board.bottleneck).toEqual({ stage: 'draft', overdue: 1 });
  });
});

describe('laneValue — each lane in its own terms', () => {
  it('totals a lane and says what the total IS', () => {
    const v = laneValue(
      [order({ id: '1', stage: 'draft' }), order({ id: '2', stage: 'draft' })],
      'draft',
    );
    expect(v).toMatchObject({ status: 'known', value: 2_000_000 });
    expect(v).toMatchObject({ basis: '2 orders quoted' });
  });

  it('says "on the road" for the delivery lane, not "quoted"', () => {
    const v = laneValue([order({ id: '1', stage: 'pending_delivery' })], 'pending_delivery');
    expect(v).toMatchObject({ basis: '1 order on the road' });
  });

  it('is partial when a row cannot be read', () => {
    const v = laneValue(
      [
        order({ id: '1', stage: 'draft' }),
        order({ id: '2', stage: 'draft', value: unavailable<Money.Money>('awaiting quote') }),
      ],
      'draft',
    );
    expect(v.status).toBe('partial');
    expect(v).toMatchObject({ value: 1_000_000 });
  });

  it('an empty lane is a derived zero, not an absence', () => {
    expect(laneValue([], 'draft')).toMatchObject({ status: 'known', value: 0 });
  });
});

describe('margin — the figure the old app got most wrong', () => {
  it('is value less cost', () => {
    expect(margin(order({ id: '1', stage: 'completed' }))).toMatchObject({
      status: 'known',
      value: 300_000,
    });
  });

  it('cannot be derived when the supplier cost is missing', () => {
    // This is the bug: a missing cost read as zero reported a margin of 100%.
    const m = margin(
      order({
        id: '1',
        stage: 'completed',
        cost: unavailable<Money.Money>('no supplier invoice yet'),
      }),
    );
    expect(m.status).toBe('unavailable');
    expect(m).toMatchObject({ reason: 'no supplier invoice yet' });
  });

  it('is partial across the board the moment one cost is missing', () => {
    const m = marginOf([
      order({ id: '1', stage: 'completed' }),
      order({
        id: '2',
        stage: 'completed',
        cost: unavailable<Money.Money>('no supplier invoice yet'),
      }),
    ]);
    expect(m.status).toBe('partial');
    expect(m).toMatchObject({ value: 300_000 });
  });

  it('carries a partial cost through rather than quietly firming it up', () => {
    const m = margin(
      order({
        id: '1',
        stage: 'completed',
        cost: partial(Money.money(700_000), 'supplier invoices', '1 of 3 not in'),
      }),
    );
    expect(m.status).toBe('partial');
  });

  it('says so rather than reporting zero when there are no orders', () => {
    expect(marginOf([]).status).toBe('unavailable');
  });
});

describe('the decisions dock', () => {
  it('is empty when nothing needs the owner', () => {
    const orders = [order({ id: '1', stage: 'preparing', since: hoursAgo(1) })];
    expect(decisions(readBoard(orders, NOW), NOW)).toEqual([]);
  });

  it('does not nag about a lane that waits on somebody else, while it is on time', () => {
    // An order in Buying is waiting on a supplier in Kikuubo. A queue that
    // cries wolf stops being read.
    const orders = [order({ id: '1', stage: 'awaiting_goods', since: hoursAgo(12) })];
    expect(decisions(readBoard(orders, NOW), NOW)).toEqual([]);
  });

  it('asks the owner to CHASE when someone else’s lane goes overdue', () => {
    const orders = [order({ id: '1', stage: 'awaiting_goods', since: hoursAgo(72) })];
    const [d] = decisions(readBoard(orders, NOW), NOW);
    expect(d?.ask).toContain('Chase the supplier');
    expect(d?.act).toBe('Chase the supplier');
    expect(d?.because).toContain('3 days');
    expect(d?.urgency).toBe('bad');
  });

  it('reports an order whose age cannot be read instead of ignoring it', () => {
    const orders = [order({ id: '1', stage: 'preparing', since: null })];
    const [d] = decisions(readBoard(orders, NOW), NOW);
    expect(d?.ask).toContain('no date on it');
    expect(d?.urgency).toBe('warn');
  });

  it('asks for an invoice on what was delivered — it is not owed until then', () => {
    const orders = [order({ id: '1', stage: 'completed', since: hoursAgo(1) })];
    const [d] = decisions(readBoard(orders, NOW), NOW);
    expect(d?.act).toBe('Draft the invoice');
  });

  it('puts every bad decision before every caution', () => {
    const orders = [
      order({ id: '1', stage: 'completed', since: hoursAgo(1) }),
      order({ id: '2', stage: 'preparing', since: hoursAgo(40) }),
    ];
    const got = decisions(readBoard(orders, NOW), NOW);
    expect(got.map((d) => d.urgency)).toEqual(['bad', 'warn']);
  });

  it('gives every decision an ask, a reason and an act that says what happens', () => {
    const orders = [
      order({ id: '1', stage: 'preparing', since: hoursAgo(40) }),
      order({ id: '2', stage: 'completed', since: hoursAgo(1) }),
      order({ id: '3', stage: 'draft', since: null }),
    ];
    for (const d of decisions(readBoard(orders, NOW), NOW)) {
      expect(d.ask).toBeTruthy();
      expect(d.because).toBeTruthy();
      expect(d.act).toBeTruthy();
      expect(d.act.toLowerCase()).not.toBe('submit');
    }
  });
});

describe('expectedCompletion', () => {
  it('will not guess from too few orders', () => {
    expect(expectedCompletion([{ hours: 10 }, { hours: 12 }]).status).toBe('unavailable');
  });

  it('takes the median, so one three-week import does not move it', () => {
    const d: Derived<number> = expectedCompletion([
      { hours: 20 },
      { hours: 22 },
      { hours: 24 },
      { hours: 26 },
      { hours: 500 },
    ]);
    expect(d).toMatchObject({ status: 'known', value: 24 });
  });
});

describe('the dock and the bottleneck agree', () => {
  // They used to rank differently: the dock by whatever order the rows
  // arrived in, the bottleneck by a count with ties broken by lane order.
  // So the board could name Buying as the hold-up while the dock served an
  // order from Preparing. Two readings of one board that disagree is worse
  // than either alone.
  const orders = [
    // 41h in a lane patient for 8 — 33 hours over.
    order({ id: 'prep', stage: 'preparing', since: hoursAgo(41) }),
    // 73h in a lane patient for 48 — 25 hours over.
    order({ id: 'buy', stage: 'awaiting_goods', since: hoursAgo(73) }),
  ];

  it('serves the worst order first, not the first row', () => {
    const board = readBoard(orders, NOW);
    expect(board.overdue[0]?.id).toBe('prep');
  });

  it('names the lane that worst order is in', () => {
    const board = readBoard(orders, NOW);
    expect(board.bottleneck?.stage).toBe('preparing');
  });

  it('still prefers the lane holding MORE, before it looks at how bad', () => {
    const many = [
      order({ id: 'a', stage: 'awaiting_goods', since: hoursAgo(60) }),
      order({ id: 'b', stage: 'awaiting_goods', since: hoursAgo(60) }),
      order({ id: 'c', stage: 'preparing', since: hoursAgo(200) }),
    ];
    expect(readBoard(many, NOW).bottleneck).toEqual({
      stage: 'awaiting_goods',
      overdue: 2,
    });
  });

  it('measures overdue against the lane’s own patience', () => {
    expect(hoursOverdue(order({ id: '1', stage: 'preparing', since: hoursAgo(10) }), NOW)).toBe(2);
    expect(hoursOverdue(order({ id: '1', stage: 'awaiting_goods', since: hoursAgo(10) }), NOW)).toBe(-38);
    expect(hoursOverdue(order({ id: '1', stage: 'preparing', since: null }), NOW)).toBeNull();
  });
});
