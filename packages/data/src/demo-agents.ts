/**
 * Demonstration agents, in the shape the live query will return.
 *
 * Every figure the Agents frames draw is **generated, not typed in**: the
 * strip's 18,420,000 is the sum of the rows, the rows are the sums of their
 * orders, the panel's waterfall is the same orders again, and the five bars
 * count them by month. Nothing here can say one thing in the strip and
 * another in the panel, because there is only one place the numbers exist.
 *
 * The frame's own figures, and where each comes from:
 *
 * | Frame says | Built from |
 * | --- | --- |
 * | Sold through agents 18,420,000 · 63 orders | the six rows below, summed |
 * | You kept 2,310,000 · 12.5% | shop price less shop cost, over the same rows |
 * | Commission earned 1,860,000 | `bonus` on completed September orders |
 * | Owed to the shop 1,940,000 · 2 agents behind | what is outstanding in each cycle |
 * | Wasswa 5,640,000 · 712,000 · 1,420,000 | his twenty-one September orders |
 * | Commission, September 148,000 · 36,000 | nine completed, two still out |
 *
 * **One figure is not the frame's.** The `+9` roll-up reads *three* orders
 * between the nine smallest agents, where the frame drew eight. The frame's
 * own counts — 21, 8, 17, 9 on the rows and 63 in the strip — leave three,
 * and a strip that disagrees with the rows under it is the exact drift this
 * rewrite exists to end. The roll-up row is the cheapest place to take the
 * difference, and it is named here rather than smoothed over.
 */

import {
  Money,
  type Agent,
  type AgentOrder,
  type Counter,
  type LineShare,
  type Payout,
} from '@ow/domain';
import { DEMO_TODAY } from './demo-invoices.js';

const m = Money.money;

/** September 2026 is the month the console is standing in. */
const YEAR = DEMO_TODAY.getUTCFullYear();
const SEP = DEMO_TODAY.getUTCMonth();

const on = (monthsBack: number, day: number): Date =>
  new Date(Date.UTC(YEAR, SEP - monthsBack, day));

const doc = (n: number): string => `ORD-${String(n).padStart(4, '0')}`;

/**
 * Each agent's orders are numbered in a block of their own, because a
 * document number is the shop's and two agents cannot both have taken
 * ORD-0388. Wasswa's block is the low one: his are the numbers the
 * settlement frame draws.
 */
const BLOCK = { wasswa: 0, joan: 1_000, derrick: 2_000, annet: 3_000, moses: 4_000, small: 5_000 };

/* -------------------------------------------------------------------------- */
/*  One month of one agent's orders                                           */
/* -------------------------------------------------------------------------- */

interface Run {
  /** The first document number in the run. */
  readonly from: number;
  readonly count: number;
  /** Months back from September. */
  readonly back: number;
  /** The shop price over the whole run, and what those goods cost the shop. */
  readonly billed: number;
  readonly cost: number;
  readonly where: string;
  /** The supplier's bonus over the whole run, spread across its orders. */
  readonly bonus?: number;
  /** How many of the run's orders carry that bonus. The rest are off-cluster. */
  readonly bonusOn?: number;
  /** Still out for delivery — no bonus counts until it is completed. */
  readonly stillOut?: boolean;
  /** In the settlement cycle: delivered, and not closed off yet. */
  readonly open?: boolean;
  /** Delivered, in the cycle, but already paid for at pickup. */
  readonly paidAtPickup?: boolean;
  /** He sells these on at exactly what the shop billed him. */
  readonly atShopPrice?: boolean;
  /** The first day of the month the run's orders are spread over. */
  readonly firstDay?: number;
  /** Or the exact days, when the frame names a range: `9–14 Sep`. */
  readonly days?: readonly number[];
}

/**
 * A run of orders whose shop prices and costs sum, to the shilling, to the
 * totals given. `allocate` hands out the remainder a shilling at a time, so
 * a row's figure is never a rounding away from the strip's.
 */
function run(r: Run): readonly AgentOrder[] {
  const prices = Money.allocate(m(r.billed), r.count);
  const costs = Money.allocate(m(r.cost), r.count);
  const bonusOn = r.bonusOn ?? r.count;
  const bonuses = Money.allocate(m(r.bonus ?? 0), bonusOn);
  const firstDay = r.firstDay ?? 1;

  return prices.map((price, i) => {
    const taken = on(r.back, r.days?.[i] ?? firstDay + i);
    const cost = costs[i] ?? Money.ZERO;
    const open = r.open === true;
    const pickup = r.paidAtPickup === true;
    return {
      doc: doc(r.from + i),
      taken,
      delivered: r.stillOut === true ? null : taken,
      where: r.where,
      shopPrice: price,
      cost,
      // Carried, never rendered. The only thing read off it is whether he is
      // selling at the shop price, which is a fact about him, not a figure.
      hisPrice: r.atShopPrice === true ? price : Money.roundTo(Money.times(price, 1.18), 1_000),
      outstanding: open ? price : Money.ZERO,
      settled: !(open || pickup),
      bonus: i < bonusOn ? (bonuses[i] ?? Money.ZERO) : Money.ZERO,
      voided: false,
    };
  });
}

const line = (
  lineName: string,
  shortName: string,
  shareOfOrders: number,
  margin: number,
): LineShare => ({ line: lineName, shortName, shareOfOrders, margin });

const payout = (back: number, amount: number): Payout => {
  const month = on(back, 1);
  return {
    month: `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`,
    amount: m(amount),
  };
};

/* -------------------------------------------------------------------------- */
/*  Wasswa Mugisha — the agent the frames pick                                */
/* -------------------------------------------------------------------------- */

/**
 * September: twenty-one orders, 5,640,000 billed, 4,928,000 of cost.
 *
 *  · fifteen settled in his last settlement, on the 8th;
 *  · ORD-0402, delivered on the 4th and still owed for;
 *  · three delivered on the 9th–14th that he paid for at pickup — in the
 *    cycle, at nothing, which is what the settlement table draws dimmed;
 *  · two still out for delivery, carrying the 36,000 that has not counted.
 */
const wasswaSeptember: readonly AgentOrder[] = [
  ...run({
    from: BLOCK.wasswa + 366,
    count: 15,
    back: 0,
    billed: 3_400_000,
    cost: 2_963_000,
    where: 'Ndeeba',
    bonus: 82_000,
    bonusOn: 5,
  }),
  ...run({
    from: BLOCK.wasswa + 402,
    count: 1,
    back: 0,
    billed: 720_000,
    cost: 630_000,
    where: 'Ndeeba',
    bonus: 18_000,
    open: true,
    firstDay: 4,
  }),
  ...run({
    from: BLOCK.wasswa + 407,
    count: 3,
    back: 0,
    billed: 900_000,
    cost: 790_000,
    where: 'Ndeeba',
    bonus: 48_000,
    paidAtPickup: true,
    days: [9, 11, 14],
  }),
  ...run({
    from: BLOCK.wasswa + 414,
    count: 2,
    back: 0,
    billed: 620_000,
    cost: 545_000,
    where: 'Ndeeba',
    bonus: 36_000,
    stillOut: true,
    firstDay: 13,
  }),
];

/** August: the two orders that made him late, and a settled remainder. */
const wasswaAugust: readonly AgentOrder[] = [
  ...run({
    from: BLOCK.wasswa + 350,
    count: 15,
    back: 1,
    billed: 4_200_000,
    cost: 3_700_000,
    where: 'Ndeeba',
    bonus: 131_000,
    bonusOn: 6,
  }),
  ...run({
    from: BLOCK.wasswa + 388,
    count: 1,
    back: 1,
    billed: 400_000,
    cost: 349_000,
    where: 'Ndeeba',
    bonus: 9_000,
    open: true,
    firstDay: 28,
  }),
  ...run({
    from: BLOCK.wasswa + 391,
    count: 1,
    back: 1,
    billed: 300_000,
    cost: 262_000,
    where: 'Ndeeba',
    bonus: 7_000,
    open: true,
    firstDay: 30,
  }),
];

const wasswa: Agent = {
  id: 'wasswa',
  name: 'Wasswa Mugisha',
  since: new Date(Date.UTC(2025, 0, 14)),
  round: 'Ndeeba',
  terms: 'credit',
  ceiling: m(2_000_000),
  onHold: false,
  items: 21,
  clusterItems: 14,
  clusterAddedThisWeek: 3,
  bonusFrom: 'Hima Cement',
  payouts: [payout(0, 148_000), payout(1, 147_000)],
  lines: [
    line('Cement 50kg', 'cement', 58, 11),
    line('Iron sheets G28', 'iron sheets', 22, 26),
    line('Nails, wire, fittings', 'fittings', 20, 31),
  ],
  orders: [
    ...run({ from: BLOCK.wasswa + 200, count: 10, back: 4, billed: 2_600_000, cost: 2_310_000, where: 'Ndeeba', bonus: 61_000, bonusOn: 4 }),
    ...run({ from: BLOCK.wasswa + 240, count: 13, back: 3, billed: 3_400_000, cost: 3_010_000, where: 'Ndeeba', bonus: 88_000, bonusOn: 5 }),
    ...run({ from: BLOCK.wasswa + 300, count: 20, back: 2, billed: 5_300_000, cost: 4_660_000, where: 'Ndeeba', bonus: 140_000, bonusOn: 8 }),
    ...wasswaAugust,
    ...wasswaSeptember,
  ],
};

/* -------------------------------------------------------------------------- */
/*  The other thirteen                                                        */
/* -------------------------------------------------------------------------- */

const joan: Agent = {
  id: 'joan',
  name: 'Joan Nabbosa',
  since: new Date(Date.UTC(2025, 4, 6)),
  round: 'Kireka',
  terms: 'credit',
  ceiling: m(1_200_000),
  onHold: false,
  items: 12,
  clusterItems: 7,
  clusterAddedThisWeek: 0,
  bonusFrom: 'Hima Cement',
  payouts: [payout(0, 249_000), payout(1, 204_000)],
  lines: [
    line('Cement 50kg', 'cement', 61, 10),
    line('Roofing nails', 'nails', 24, 22),
    line('Binding wire', 'wire', 15, 27),
  ],
  orders: [
    ...run({ from: BLOCK.joan + 210, count: 5, back: 4, billed: 1_050_000, cost: 940_000, where: 'Kireka', bonus: 38_000, bonusOn: 3 }),
    ...run({ from: BLOCK.joan + 250, count: 6, back: 3, billed: 1_320_000, cost: 1_180_000, where: 'Kireka', bonus: 52_000, bonusOn: 3 }),
    ...run({ from: BLOCK.joan + 310, count: 7, back: 2, billed: 1_610_000, cost: 1_432_000, where: 'Kireka', bonus: 66_000, bonusOn: 4 }),
    ...run({ from: BLOCK.joan + 360, count: 7, back: 1, billed: 1_700_000, cost: 1_510_000, where: 'Kireka', bonus: 71_000, bonusOn: 4 }),
    ...run({ from: BLOCK.joan + 396, count: 6, back: 0, billed: 1_340_000, cost: 1_193_000, where: 'Kireka', bonus: 249_000, bonusOn: 4 }),
    // The two that have not been settled: 520,000, and why she is behind.
    ...run({ from: BLOCK.joan + 404, count: 2, back: 0, billed: 520_000, cost: 463_000, where: 'Kireka', open: true, firstDay: 7 }),
  ],
};

const derrick: Agent = {
  id: 'derrick',
  name: 'Derrick Kayongo',
  since: new Date(Date.UTC(2024, 8, 2)),
  round: 'Nansana',
  terms: 'prepay',
  ceiling: null,
  onHold: false,
  items: 26,
  clusterItems: 19,
  clusterAddedThisWeek: 1,
  bonusFrom: 'Roofings Group',
  payouts: [payout(0, 820_000), payout(1, 690_000)],
  lines: [
    line('Iron sheets G28', 'iron sheets', 44, 21),
    line('Cement 50kg', 'cement', 33, 12),
    line('Timber', 'timber', 23, 29),
  ],
  orders: [
    ...run({ from: BLOCK.derrick + 215, count: 11, back: 4, billed: 3_900_000, cost: 3_350_000, where: 'Nansana', bonus: 410_000, bonusOn: 7 }),
    ...run({ from: BLOCK.derrick + 255, count: 13, back: 3, billed: 4_600_000, cost: 3_950_000, where: 'Nansana', bonus: 505_000, bonusOn: 8 }),
    ...run({ from: BLOCK.derrick + 315, count: 15, back: 2, billed: 5_400_000, cost: 4_630_000, where: 'Nansana', bonus: 610_000, bonusOn: 9 }),
    ...run({ from: BLOCK.derrick + 365, count: 16, back: 1, billed: 5_800_000, cost: 4_940_000, where: 'Nansana', bonus: 705_000, bonusOn: 10 }),
    ...run({ from: BLOCK.derrick + 398, count: 17, back: 0, billed: 6_120_000, cost: 5_212_000, where: 'Nansana', bonus: 820_000, bonusOn: 11 }),
  ],
};

const annet: Agent = {
  id: 'annet',
  name: 'Annet Ssenabulya',
  since: new Date(Date.UTC(2025, 2, 19)),
  round: 'Mukono',
  terms: 'prepay',
  ceiling: null,
  onHold: false,
  items: 15,
  clusterItems: 9,
  clusterAddedThisWeek: 0,
  bonusFrom: 'Hima Cement',
  payouts: [payout(0, 367_000), payout(1, 301_000)],
  lines: [
    line('Cement 50kg', 'cement', 52, 10),
    line('Sand and aggregate', 'aggregate', 29, 14),
    line('Nails, wire, fittings', 'fittings', 19, 30),
  ],
  orders: [
    ...run({ from: BLOCK.annet + 220, count: 6, back: 4, billed: 1_700_000, cost: 1_520_000, where: 'Mukono', bonus: 210_000, bonusOn: 4 }),
    ...run({ from: BLOCK.annet + 260, count: 7, back: 3, billed: 2_010_000, cost: 1_790_000, where: 'Mukono', bonus: 260_000, bonusOn: 4 }),
    ...run({ from: BLOCK.annet + 320, count: 8, back: 2, billed: 2_400_000, cost: 2_140_000, where: 'Mukono', bonus: 310_000, bonusOn: 5 }),
    ...run({ from: BLOCK.annet + 370, count: 8, back: 1, billed: 2_520_000, cost: 2_245_000, where: 'Mukono', bonus: 330_000, bonusOn: 5 }),
    ...run({ from: BLOCK.annet + 399, count: 9, back: 0, billed: 2_740_000, cost: 2_439_000, where: 'Mukono', bonus: 367_000, bonusOn: 6 }),
  ],
};

/**
 * Moses sells the goods on at exactly what the shop billed him.
 *
 * `hisPrice === shopPrice` on every line, which is what puts the caution
 * pill on his row — an agent taking nothing for himself is an agent who will
 * stop. The figure itself is his business and is nowhere on the screen.
 */
const moses: Agent = {
  id: 'moses',
  name: 'Moses Kirya',
  since: new Date(Date.UTC(2026, 1, 3)),
  round: 'Gayaza',
  terms: 'prepay',
  ceiling: null,
  onHold: false,
  items: 9,
  clusterItems: 5,
  clusterAddedThisWeek: 0,
  bonusFrom: 'Hima Cement',
  payouts: [payout(0, 159_000), payout(1, 142_000)],
  lines: [
    line('Cement 50kg', 'cement', 66, 11),
    line('Roofing nails', 'nails', 21, 23),
    line('Binding wire', 'wire', 13, 26),
  ],
  orders: [
    ...run({ from: BLOCK.moses + 225, count: 3, back: 4, billed: 690_000, cost: 617_000, where: 'Gayaza', bonus: 88_000, bonusOn: 2, atShopPrice: true }),
    ...run({ from: BLOCK.moses + 265, count: 4, back: 3, billed: 910_000, cost: 812_000, where: 'Gayaza', bonus: 112_000, bonusOn: 2, atShopPrice: true }),
    ...run({ from: BLOCK.moses + 325, count: 4, back: 2, billed: 980_000, cost: 875_000, where: 'Gayaza', bonus: 126_000, bonusOn: 3, atShopPrice: true }),
    ...run({ from: BLOCK.moses + 375, count: 5, back: 1, billed: 1_120_000, cost: 999_000, where: 'Gayaza', bonus: 140_000, bonusOn: 3, atShopPrice: true }),
    ...run({ from: BLOCK.moses + 409, count: 5, back: 0, billed: 1_190_000, cost: 1_048_000, where: 'Gayaza', bonus: 159_000, bonusOn: 3, atShopPrice: true }),
  ],
};

/**
 * The nine smallest, who exist so the roll-up row has something to roll up.
 *
 * Three orders and 870,000 between them this month. They are nine records
 * rather than one so that the group band, the roll-up row and the strip all
 * count the same thing — a single record standing for nine would make
 * "12 agents" a literal again.
 */
const SMALL_NAMES = [
  'Betty Nakato',
  'Charles Odoki',
  'Esther Namusoke',
  'Fred Wamala',
  'Gloria Akullo',
  'Henry Bogere',
  'Irene Nabukenya',
  'Julius Opio',
  'Kenneth Ssempa',
] as const;

/** 870,000 billed and 43,000 kept, over three orders, spread across nine. */
const SMALL_MONTHS: readonly { readonly back: number; readonly billed: number; readonly cost: number; readonly orders: number }[] = [
  { back: 4, billed: 610_000, cost: 578_000, orders: 2 },
  { back: 3, billed: 720_000, cost: 682_000, orders: 3 },
  { back: 2, billed: 940_000, cost: 889_000, orders: 4 },
  { back: 1, billed: 810_000, cost: 767_000, orders: 3 },
  { back: 0, billed: 870_000, cost: 827_000, orders: 3 },
];

const small: readonly Agent[] = SMALL_NAMES.map((name, n) => {
  const share = (total: number, months: number): number[] => Money.allocate(m(total), months);
  return {
    id: `small-${n + 1}`,
    name,
    since: new Date(Date.UTC(2026, 3 + (n % 4), 2 + n)),
    round: ['Kawempe', 'Bweyogerere', 'Namugongo'][n % 3] ?? 'Kawempe',
    terms: n % 3 === 0 ? 'credit' : 'prepay',
    ceiling: n % 3 === 0 ? m(400_000) : null,
    onHold: false,
    items: 6,
    clusterItems: 2,
    clusterAddedThisWeek: 0,
    bonusFrom: 'Hima Cement',
    payouts: [],
    lines: [line('Cement 50kg', 'cement', 74, 9), line('Roofing nails', 'nails', 26, 19)],
    orders: SMALL_MONTHS.flatMap((month) => {
      /**
       * A month's orders go to as many of the nine as it has orders — three
       * of them share September's three, not a ninth of an order each. The
       * scatter moves month to month so that every one of the nine has a
       * round somewhere in the five, which is what makes them nine agents
       * rather than one record standing for nine.
       */
      const slot = (n * 4 + month.back * 2) % SMALL_NAMES.length;
      if (slot >= month.orders) return [];
      const billed = share(month.billed, month.orders)[slot] ?? 0;
      const cost = share(month.cost, month.orders)[slot] ?? 0;
      return run({
        from: BLOCK.small + n * 10 + month.back,
        count: 1,
        back: month.back,
        billed,
        cost,
        where: 'Kawempe',
        bonus: month.back === 0 ? Math.round(117_000 / month.orders) : 0,
        firstDay: 5 + n,
      });
    }),
  };
});

/** The fourteen, in the order the frame lists them. */
export const demoAgents = (): readonly Agent[] => [wasswa, joan, derrick, annet, moses, ...small];

/**
 * What the shop sold altogether, so the channel can state its share.
 *
 * 18,420,000 of 59,420,000 is the 31% the strip claims, and the counter's
 * own 24% is the figure the agent margin is read against — both live here
 * rather than in the screen, because they are the shop's numbers and the
 * screen only reads them.
 */
export const demoCounter = (): Counter => ({ sold: m(59_420_000), keptPercent: 24 });

/** The cash accounts a settlement can be taken into. */
export const demoSettlementAccounts: readonly string[] = [
  'Cash · shop till',
  'MTN MoMo · 0772 …',
  'Stanbic · current',
];

/** The rounds an invited agent can be given. */
export const demoRounds: readonly string[] = [
  'Ndeeba',
  'Kireka',
  'Nansana',
  'Mukono',
  'Gayaza',
  'Kawempe',
];

/** The suppliers whose promotions fund a bonus. */
export const demoBonusSuppliers: readonly string[] = [
  'Hima Cement',
  'Roofings Group',
  'Tororo Cement',
];
