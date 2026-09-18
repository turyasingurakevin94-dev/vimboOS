/**
 * Today, from the example books.
 *
 * ## Inputs, not answers
 *
 * This file supplies what `readStrip` takes and then calls it. It does not
 * state the five figures. That matters because the alternative — writing
 * `23,650,000` in here to match the handoff — would give this screen a
 * second reckoning of a figure the Customers register already computes,
 * which is the anti-pattern the design system names and the exact way the
 * old app's Customers and Debtors screens came to disagree.
 *
 * So what is owed comes from `demoCustomers()` through the register's own
 * `read`, and what is owed out comes from `demoPurchaseInvoices()` through
 * the Invoices band's own `stillToPay`. The frame shows whatever those
 * produce.
 *
 * ## Where the handoff's prose does not survive that
 *
 * Three of its basis lines are hand-written next to data that says
 * something else, and wiring the screen to the reckoning changes them:
 *
 * | the handoff says | the reckoning over its own rows |
 * | ---------------- | ------------------------------- |
 * | 9 customers      | **11** accounts owing           |
 * | a 3-segment bar, 42/29/29 | **four** bands, 32/18/22/28 |
 * | 4 suppliers, 11,200,000 | **3** suppliers, 3,104,300 |
 *
 * The totals it states are right — `demoCustomers()` really does owe
 * 23,650,000 — so these are not different data, they are prose that was
 * never checked against the rows beside it. Raised for design rather than
 * papered over: the figures below are the reckoning's.
 *
 * ## Cash, margin and the shelf are given, because nothing owns them yet
 *
 * There is no Cash Book screen and no Inventory screen in this app, so
 * there are no example books for them to own. These are stated here at the
 * handoff's own figures, and move to that screen's demo file the day it
 * exists — the same way the invoices moved to `demo-invoices.ts`.
 */

import {
  known,
  Money,
  profitByProduct,
  rankMoves,
  readStrip,
  soldByWeek,
  unavailable,
  watch,
  wantsYou,
  type CashPosition,
  type MarginInput,
  type MoveRecord,
  type SoldLine,
  type Yesterday,
  type StockInput,
} from '@ow/domain';
import { demoCustomers } from './demo-customers.js';
import { DEMO_TODAY, demoPurchaseInvoices, demoSalesInvoices } from './demo-invoices.js';
import type { TodayBooks } from './today.js';

/** The handoff's own "8,420,000 · 2 accounts". Bank is empty, hence two. */
const demoCash = (): CashPosition => ({
  byAccount: [
    {
      key: 'cash',
      label: 'Cash',
      amount: known(Money.money(6_100_000), 'counted at 5,252,000 on 14 September, then 9 movements'),
    },
    {
      key: 'momo',
      label: 'Mobile Money',
      amount: known(Money.money(2_320_000), 'counted at 1,381,418 on 14 September, then 2 movements'),
    },
    { key: 'bank', label: 'Bank', amount: known(Money.ZERO, 'nothing has moved through the bank') },
  ],
  total: known(Money.money(8_420_000), '2 of 3 accounts'),
  accountsInUse: 2,
  misfiled: [],
});

/**
 * Sized to the handoff's "2.4 months of cover" against its own 8,420,000.
 *
 * Running costs only — no stock buying. Against the real books that
 * distinction moved the cover from 0.2 months to 2.6, so an example that
 * buried stock in here would demonstrate the bug rather than the screen.
 */
const demoBurn = (): ReturnType<typeof known<Money.Money>> =>
  known(Money.money(3_508_333), '5,732,277 paid out over 49 days, apart from 77,777,014 on stock');

/** The handoff's "18.6% · 4,380,000 profit on 23,500,000 sold". */
const demoMargin = (): MarginInput => ({
  kept: Money.money(4_380_000),
  sold: Money.money(23_500_000),
  linesWithoutCost: 0,
  linesCounted: 23,
});

/**
 * The handoff's "41,300,000 on the shelf".
 *
 * Dead stock is `unavailable` here, matching what the live read does and
 * for the same reason: the shop values it at FIFO cost with a
 * replacement-price fallback, and that reckoning is not ported. The handoff
 * draws "3,100,000 unsold past 120 days". An example that showed a figure
 * the live screen cannot produce would be demonstrating a capability this
 * app does not have, which is worse than an honest gap — so the gap is
 * here too, and it is raised for design.
 */
const demoStock = (): StockInput => ({
  shelf: {
    ours: known(Money.money(41_300_000), 'across 120 lines, at what you paid'),
    heldForOthers: known(Money.ZERO, 'nothing is held on consignment'),
    linesOnShelf: 120,
    uncostedUnits: 0,
  },
  dead: unavailable(
    'dead stock is valued at FIFO cost in the shop’s own books, and that reckoning is not ported yet',
  ),
  deadLines: 6,
});

/**
 * The four lines the handoff's profit panel names, plus the 54 it counts.
 *
 * Stated here rather than taken from `demoSalesInvoices()`, because an
 * invoice line carries no buying price — deliberately: *"an invoice is what
 * the client was charged, and the buying price is not part of that
 * document."* Profit needs both halves, so it comes from order lines, and
 * the example books have none yet. Sized to the handoff's own figures so
 * the real reckoning reproduces the panel it drew.
 */
const demoSoldLines = (): readonly SoldLine[] => {
  const on = new Date(DEMO_TODAY.getTime() - 5 * 86_400_000);

  /** One line that keeps `kept` at `pct` per cent, which fixes what it sold. */
  const line = (name: string, kept: number, pct: number): SoldLine => {
    const sold = Math.round(kept / (pct / 100));
    return {
      on,
      name,
      qty: 1,
      sell: Money.money(sold),
      buy: Money.money(sold - kept),
    };
  };

  // The 54 the panel does not name, sharing their 3,260,000 a shilling at a
  // time so the total it prints is the total of the rows behind it.
  const rest = Money.allocate(Money.money(3_260_000), 54).map((share, i) =>
    line(`Other line ${i + 1}`, share, 25),
  );

  return [
    line('Iron sheets G28', 4_120_000, 31),
    line('Cement — Tororo', 2_980_000, 18),
    line('Steel bars Y12', 1_640_000, 9),
    line('Binding wire', 1_205_000, 22),
    ...rest,
  ];
};

/**
 * Yesterday, at the handoff's four figures.
 *
 * Stated for the same reason cash is: there is no Cash Book screen and no
 * example cash movements for one to own. Its own numbers are consistent —
 * 4,186,000 sold less 2,940,000 collected is the 1,246,000 of new debt it
 * prints — which is more than can be said for several of its sentences.
 */
const demoYesterday = (): Yesterday => ({
  on: new Date(DEMO_TODAY.getTime() - 86_400_000),
  sold: Money.money(4_186_000),
  collected: Money.money(2_940_000),
  paidOut: Money.money(1_760_000),
  newDebt: Money.money(1_246_000),
});

/**
 * The handoff's three moves, as `manager_notes` rows.
 *
 * Its cards are stamped "01 of 08", "02 of 08", "03 of 08" — and there are
 * three of them. The sub-heading above says "three moves", so the array and
 * the heading agree and only the stamps are wrong. They are derived now, so
 * the count on a card is the count in the list.
 *
 * `worthBasis` is the old app's vocabulary rather than the handoff's labels,
 * because two of those labels change the claim: the handoff calls
 * `loss_avoided` "Sales at risk", and avoided loss is money kept where
 * sales at risk is money that might go. Raised for design.
 */
const demoMoves = (): readonly MoveRecord[] => [
  {
    id: '1',
    meetingId: 'demo-meeting',
    title: 'Ask Mulongo Hardware for a deposit before the next delivery',
    why: 'Five chases since 2 August produced nothing, and they have taken two deliveries on credit since. The debt is 44 days old.',
    worth: Money.money(3_330_000),
    worthBasis: 'cash_freed',
    lever: 'collect',
    unlocks: 'the 40 boxes of G28 that need ordering before Friday',
    door: 'chase',
    after: null,
    settled: false,
  },
  {
    id: '2',
    meetingId: 'demo-meeting',
    title: 'Raise iron sheets G28 by 4% — you are still selling at May’s cost',
    why: 'Kampala Steel billed 13,000 a sheet on 20 July against 10,000 on 1 May. The shelf price has not moved since April.',
    worth: Money.money(1_180_000),
    worthBasis: 'profit_30d',
    lever: 'price',
    unlocks: null,
    door: 'prices',
    after: null,
    settled: false,
  },
  {
    id: '3',
    meetingId: 'demo-meeting',
    title: 'Order 40 boxes of G28 before Friday',
    why: 'Six days of cover at the last four weeks’ rate. The order needs 9,600,000 against 8,420,000 held — the Mulongo deposit covers the gap.',
    worth: Money.money(7_400_000),
    worthBasis: 'loss_avoided',
    lever: 'buy',
    unlocks: null,
    // The handoff's button says "Open forecasts". `MANAGER_DOORS` has no
    // forecasts entry — the nearest real door for "order 40 boxes" is What
    // to buy, and the label is the door's own rather than the handoff's.
    door: 'buy',
    // "waits on 01", which is index 0 of this meeting's plan.
    after: 0,
    settled: false,
  },
];

export function demoToday(): TodayBooks {
  const moves = rankMoves(demoMoves());
  const cash = demoCash();
  const stock = demoStock();
  const strip = readStrip(
    {
      cash,
      burn: demoBurn(),
      customers: demoCustomers(),
      purchases: demoPurchaseInvoices(),
      margin: demoMargin(),
      stock,
    },
    DEMO_TODAY,
  );

  return {
    strip,
    // The bars and the sentence under them, over the example invoices — so
    // the panel's prose is arithmetic about the rows beside it rather than a
    // sentence written next to them. The handoff's own is wrong four ways
    // over; see `soldByWeek`.
    sold: soldByWeek(demoSalesInvoices(), DEMO_TODAY),
    // Off the example invoices' own lines, so the panel and the strip's
    // margin cell are reading the same rows.
    profit: profitByProduct(demoSoldLines(), DEMO_TODAY),
    yesterday: demoYesterday(),
    // Over the same example accounts the strip's second cell reads, so a
    // row here and the figure up there cannot disagree about a debt.
    watch: watch(
      {
        customers: demoCustomers(),
        cash,
        deadLines: stock.deadLines,
        deadValue: stock.dead,
        quietDays: 60,
      },
      DEMO_TODAY,
    ),
    moves,
    openMoves: moves.length,
    wantsYou: wantsYou(strip, moves.length),
    asOf: DEMO_TODAY,
    unreadable: [],
  };
}
