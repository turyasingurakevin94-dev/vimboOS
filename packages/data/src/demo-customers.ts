/**
 * The customer book frame 1a draws, in the shape a live query will return.
 *
 * **Nothing here is a total.** The strip's 23,650,000, the group bands, the
 * aging bar, every row's balance, the ask order and the panel's drift check
 * are all derived from these invoices by `@ow/domain/customers`. Writing a
 * band figure here instead would be the exact drift the screen exists to
 * end — the old app kept a debtors list beside the customer list, and when
 * one was re-rendered and the other was not they disagreed about the same
 * debt.
 *
 * ## The frame draws eight rows of a hundred and forty-two accounts
 *
 * So the book has a hundred and forty-two. The eight the frame names are
 * written out; the rest are generated, because the lens counts (All 142,
 * Best 20), the concentration reading ("35% sits with 3 of 142") and the
 * fourth strip card ("86 of 142") are only true if the other accounts
 * actually exist to be counted.
 *
 * ## Where a figure in the frame and a figure derived from these records
 * differ, it is written down
 *
 * Three places, all argued in the commit message:
 *
 * 1. The aging bar reads 28/22/18/32 rather than the drawn 29/23/19/29. The
 *    four rows the frame draws under 30 days already come to 7,465,000 of
 *    23,650,000, which is 31.6% — the drawn 29% cannot be reached without
 *    changing a figure the frame also draws as text.
 * 2. Kato's pays bar is 70/30 rather than 70/24/6. The sentence beside it,
 *    "slow but always pays", is only true if nothing of theirs went very
 *    late, and the sentence is the more useful of the two.
 * 3. Mulongo's cement margin is 14%, not 11%. At 11% the three products
 *    blend to 16% and the tile above them says 18%; 14% is the figure that
 *    makes the tile and the rows the same reckoning.
 */

import {
  Money,
  type Customer,
  type CustomerInvoice,
  type DebtPayment,
  type Promised,
} from '@ow/domain';
import { DEMO_TODAY } from './demo-invoices.js';

const m = Money.money;
const DAY = 86_400_000;

/** `day(-49)` is 28 July 2026 — the day INV-0221 was raised. */
const day = (offset: number): Date => new Date(DEMO_TODAY.getTime() + offset * DAY);

/** An invoice that has been paid off. `settleDays` is measured from issue. */
function settled(
  doc: string,
  issuedAgo: number,
  total: Money.Money,
  termDays: number,
  settleDays: number,
  instalments = 1,
): CustomerInvoice {
  return {
    doc,
    issued: day(-issuedAgo),
    total,
    dueOn: day(-issuedAgo + termDays),
    received: total,
    lastPaidOn: day(-issuedAgo + settleDays),
    settledOn: day(-issuedAgo + settleDays),
    instalments,
  };
}

/** An invoice with money still out. */
function owing(
  doc: string,
  issuedAgo: number,
  total: number,
  termDays: number,
  received = 0,
  paidAgo: number | null = null,
): CustomerInvoice {
  return {
    doc,
    issued: day(-issuedAgo),
    total: m(total),
    dueOn: day(-issuedAgo + termDays),
    received: m(received),
    lastPaidOn: paidAgo === null ? null : day(-paidAgo),
    settledOn: null,
    instalments: received > 0 ? 1 : 0,
  };
}

/**
 * A run of settled invoices sharing a fate, spread BACK through the months
 * from the most recent one.
 *
 * Back, not forward: an invoice dated after this morning is not a record,
 * and a run that walked forward would put half of Ken Bwaise's history in
 * October — where it would still sum correctly, still draw a plausible bar,
 * and quietly make him someone who has bought since he stopped.
 *
 * The total is split with `Money.allocate`, so the run sums to exactly what
 * it was given and the pays bar's percentages are the shares they claim to
 * be rather than shares of a rounded-off figure.
 */
function run(
  prefix: string,
  count: number,
  total: number,
  newestAgo: number,
  spacing: number,
  termDays: number,
  settleDays: number,
  instalments = 1,
  docs: readonly string[] = [],
): CustomerInvoice[] {
  return Money.allocate(m(total), count).map((amount, i) =>
    settled(
      docs[i] ?? `${prefix}-${String(i + 1).padStart(2, '0')}`,
      newestAgo + i * spacing,
      amount,
      termDays,
      settleDays,
      instalments,
    ),
  );
}

interface Written {
  readonly id: string;
  readonly name: string;
  readonly sinceAgo: number;
  readonly heldBy: string | null;
  readonly phone: string;
  readonly area: string;
  readonly creditLimit: number | null;
  readonly invoices: readonly CustomerInvoice[];
  readonly chasesSent?: number;
  readonly chasesAnswered?: number;
  readonly retentionHeld?: boolean;
  readonly keptTwelveMonths?: number;
  readonly soldTwelveMonths?: number;
  readonly buys?: Customer['buys'];
  readonly monthly?: readonly { readonly month: string; readonly spent: number }[];
  readonly promises?: readonly Promised[];
  readonly payments?: readonly DebtPayment[];
}

function build(w: Written): Customer {
  return {
    id: w.id,
    name: w.name,
    since: day(-w.sinceAgo),
    heldBy: w.heldBy,
    phone: w.phone,
    area: w.area,
    creditLimit: w.creditLimit === null ? null : m(w.creditLimit),
    // This used to be empty on every account, with a note saying the frames
    // drew no promise and inventing one would put a demo customer on the
    // past-due list for a reason the mockup never showed. Frame 6c now draws
    // three of them — waiting, broken and kept — so the reason is gone and
    // the account it draws carries exactly those.
    promises: w.promises ?? [],
    payments: w.payments ?? [],
    invoices: w.invoices,
    chasesSent: w.chasesSent ?? 0,
    chasesAnswered: w.chasesAnswered ?? 0,
    // The ledger agrees with the invoices everywhere in the demo book. The
    // drift check on the panel is a real comparison against this field, so
    // moving one of these by a shilling makes the panel say so.
    ledgerBalance: Money.add(
      ...w.invoices.map((inv) => Money.max(Money.ZERO, Money.subtract(inv.total, inv.received))),
    ),
    retentionHeld: w.retentionHeld ?? false,
    keptTwelveMonths: w.keptTwelveMonths === undefined ? null : m(w.keptTwelveMonths),
    soldTwelveMonths: w.soldTwelveMonths === undefined ? null : m(w.soldTwelveMonths),
    buys: w.buys ?? [],
    monthly: (w.monthly ?? []).map((x) => ({ month: x.month, spent: m(x.spent) })),
  };
}

/* -------------------------------------------------------------------------- */
/*  The four the frame asks first                                             */
/* -------------------------------------------------------------------------- */

/**
 * Mulongo Hardware — the picked account, and the only one blocked.
 *
 * 3,330,000 owed on one invoice raised 28 July on thirty-day terms, so it is
 * nineteen days past due and forty-nine days old. Against a limit of
 * 2,000,000 that is 1,330,000 over, which is what blocks new credit sales at
 * the till and what the panel's caution paragraph states.
 *
 * The ten settled invoices behind it are what the pays bar reads: six paid
 * inside the terms carrying 34% of the money, two late carrying 26%, and two
 * more than a month late carrying 40%. Four of ten arrived after the due
 * date, which is the sentence under the bar.
 */
const mulongo = build({
  id: 'c-mulongo',
  name: 'Mulongo Hardware',
  sinceAgo: 920,
  heldBy: "Wasswa's account",
  phone: '0772 418 330',
  area: 'Ndeeba',
  creditLimit: 2_000_000,
  invoices: [
    owing('INV-0221', 49, 3_330_000, 30),
    // The most recently settled invoice, and the one the panel draws under
    // the debt: raised 14 July, paid off 2 August, nineteen days. It is
    // named here rather than generated because the panel prints its number.
    ...run('INV-M-ON', 6, 3_083_800, 63, 42, 30, 19, 1, [
      'INV-0208',
      'INV-0194',
      'INV-0181',
      'INV-0166',
      'INV-0152',
      'INV-0139',
    ]),
    ...run('INV-M-LT', 2, 2_358_200, 133, 93, 30, 45),
    ...run('INV-M-VL', 2, 3_628_000, 179, 135, 30, 75),
  ],
  chasesSent: 2,
  chasesAnswered: 1,
  keptTwelveMonths: 1_910_000,
  soldTwelveMonths: 10_600_000,
  buys: [
    // 14%, not the frame's 11%: at 11% these three blend to 16% and the tile
    // above them reads 18%. Two figures for one fact is the drift this app
    // was rewritten to stop, so the rows move to meet the tile.
    { product: 'Cement 50kg', shortName: 'cement', shareOfSpend: 62, margin: 14 },
    { product: 'Iron sheets G28', shortName: 'iron sheets', shareOfSpend: 24, margin: 26 },
    { product: 'Everything else', shortName: 'the rest', shareOfSpend: 14, margin: 22 },
  ],
  monthly: [
    { month: 'May', spent: 780_000 },
    { month: 'Jun', spent: 1_200_000 },
    { month: 'Jul', spent: 990_000 },
    { month: 'Aug', spent: 360_000 },
    { month: 'Sep', spent: 150_000 },
  ],
});

/**
 * Nakawa Traders — the oldest money, and the one that has stopped answering.
 *
 * Twenty-two of twenty-four invoices were paid inside their terms. The
 * screen's whole argument is on this row: by history they are a good
 * account, and 2,410,000 has been out for seventy-four days with five chases
 * unanswered. The amount says how much; the bar says it usually comes back;
 * the silence says this time is different.
 */
const nakawa = build({
  id: 'c-nakawa',
  name: 'Nakawa Traders',
  sinceAgo: 690,
  heldBy: null,
  phone: '0701 224 819',
  area: 'Nakawa',
  creditLimit: null,
  invoices: [
    owing('INV-0196', 74, 2_410_000, 30),
    ...run('INV-N-ON', 22, 10_080_000, 96, 28, 30, 21),
    ...run('INV-N-LT', 1, 960_000, 640, 1, 30, 44),
    ...run('INV-N-VL', 1, 960_000, 700, 1, 30, 78),
  ],
  /**
   * The three promises frame 6c draws, in its own order: one still waiting,
   * one broken, one kept. Placed against `DEMO_TODAY` rather than the date
   * the frame was drawn on, so the words derive to the same thing — "in 2
   * days", "broken, 12 days", "paid that day".
   *
   * The broken one is why this account reads past-due, and that is correct
   * rather than incidental: with no `terms_days` on any account in these
   * books, a broken promise is the only evidence of lateness there is.
   */
  promises: [
    { id: 'p-nakawa-3', promisedOn: day(2), madeOn: day(0), amount: m(1_000_000), note: null },
    {
      id: 'p-nakawa-2',
      promisedOn: day(-12),
      madeOn: day(-18),
      amount: null,
      note: 'after the Nateete job pays us',
    },
    {
      id: 'p-nakawa-1',
      promisedOn: day(-22),
      madeOn: day(-26),
      amount: m(700_000),
      note: null,
    },
  ],
  // The payment that kept the oldest one, on the day they named.
  payments: [{ on: day(-22), amount: m(700_000) }],
  chasesSent: 5,
  chasesAnswered: 0,
  keptTwelveMonths: 1_640_000,
  soldTwelveMonths: 7_100_000,
  buys: [
    { product: 'Nails, assorted', shortName: 'nails', shareOfSpend: 44, margin: 21 },
    { product: 'Binding wire', shortName: 'binding wire', shareOfSpend: 31, margin: 24 },
    { product: 'Everything else', shortName: 'the rest', shareOfSpend: 25, margin: 25 },
  ],
  monthly: [
    { month: 'May', spent: 1_400_000 },
    { month: 'Jun', spent: 1_100_000 },
    { month: 'Jul', spent: 900_000 },
    { month: 'Aug', spent: 300_000 },
    { month: 'Sep', spent: 0 },
  ],
});

/**
 * Kato Construction Ltd — the biggest buyer, one day past due.
 *
 * Nothing of theirs has ever gone more than a month late, which is why the
 * bar reads "slow but always pays" instead of a count. One day past due on
 * 2,640,000 is third in the ask order and would be first in a list sorted by
 * amount, which is the argument for ranking by shillings times days.
 */
const kato = build({
  id: 'c-kato',
  name: 'Kato Construction Ltd',
  sinceAgo: 725,
  heldBy: null,
  phone: '0752 900 114',
  area: 'Kyanja',
  creditLimit: 8_000_000,
  invoices: [
    owing('INV-0304', 31, 2_640_000, 30),
    ...run('INV-K-ON', 14, 25_032_000, 60, 44, 30, 26),
    ...run('INV-K-LT', 5, 10_728_000, 690, 4, 30, 51),
  ],
  keptTwelveMonths: 4_300_000,
  soldTwelveMonths: 19_800_000,
  buys: [
    { product: 'Iron sheets G28', shortName: 'iron sheets', shareOfSpend: 51, margin: 19 },
    { product: 'Cement 50kg', shortName: 'cement', shareOfSpend: 33, margin: 14 },
    { product: 'Everything else', shortName: 'the rest', shareOfSpend: 16, margin: 42 },
  ],
  monthly: [
    { month: 'May', spent: 2_900_000 },
    { month: 'Jun', spent: 3_400_000 },
    { month: 'Jul', spent: 3_100_000 },
    { month: 'Aug', spent: 2_640_000 },
    { month: 'Sep', spent: 1_900_000 },
  ],
});

/**
 * Ken Bwaise — pays, but never all at once.
 *
 * 520,000 came in over the counter the day the invoice was raised and
 * 640,000 has not. Ten settled invoices, every one of them in instalments,
 * which is a different problem from lateness and gets a different sentence.
 */
const ken = build({
  id: 'c-ken',
  name: 'Ken Bwaise',
  sinceAgo: 610,
  heldBy: null,
  phone: '0774 310 902',
  area: 'Bwaise',
  creditLimit: 1_500_000,
  invoices: [
    owing('INV-0338', 25, 1_160_000, 14, 520_000, 25),
    ...run('INV-B-ON', 6, 6_000_000, 70, 46, 14, 11, 2),
    ...run('INV-B-LT', 3, 3_000_000, 500, 40, 14, 30, 3),
    ...run('INV-B-VL', 1, 1_000_000, 660, 1, 14, 60, 2),
  ],
  chasesSent: 1,
  chasesAnswered: 1,
  keptTwelveMonths: 780_000,
  soldTwelveMonths: 3_900_000,
  buys: [
    { product: 'Paint, 20L', shortName: 'paint', shareOfSpend: 48, margin: 23 },
    { product: 'Brushes and rollers', shortName: 'brushes', shareOfSpend: 27, margin: 31 },
    { product: 'Everything else', shortName: 'the rest', shareOfSpend: 25, margin: 6 },
  ],
  monthly: [
    { month: 'May', spent: 600_000 },
    { month: 'Jun', spent: 700_000 },
    { month: 'Jul', spent: 560_000 },
    { month: 'Aug', spent: 1_160_000 },
    { month: 'Sep', spent: 0 },
  ],
});

/* -------------------------------------------------------------------------- */
/*  Owing, still in time                                                      */
/* -------------------------------------------------------------------------- */

/** Shadia Nakato — two invoices raised yesterday, and a three-day habit. */
const shadia = build({
  id: 'c-shadia',
  name: 'Shadia Nakato',
  sinceAgo: 540,
  heldBy: null,
  phone: '0703 551 208',
  area: 'Kawempe',
  creditLimit: 1_200_000,
  invoices: [
    owing('INV-0370', 1, 400_000, 14),
    owing('INV-0371', 1, 215_000, 14),
    ...run('INV-S-ON', 19, 9_400_000, 70, 20, 14, 2),
    ...run('INV-S-LT', 1, 600_000, 460, 1, 14, 25),
  ],
  keptTwelveMonths: 1_900_000,
  soldTwelveMonths: 7_600_000,
  buys: [
    { product: 'Plumbing fittings', shortName: 'fittings', shareOfSpend: 57, margin: 27 },
    { product: 'PVC pipe', shortName: 'pipe', shareOfSpend: 28, margin: 22 },
    { product: 'Everything else', shortName: 'the rest', shareOfSpend: 15, margin: 21 },
  ],
  monthly: [
    { month: 'May', spent: 640_000 },
    { month: 'Jun', spent: 700_000 },
    { month: 'Jul', spent: 580_000 },
    { month: 'Aug', spent: 620_000 },
    { month: 'Sep', spent: 615_000 },
  ],
});

/** Innocent Busingye — bought today, on credit, for the first time. */
const innocent = build({
  id: 'c-innocent',
  name: 'Innocent Busingye',
  sinceAgo: 0,
  heldBy: null,
  phone: '0788 640 117',
  area: 'Kisaasi',
  creditLimit: 500_000,
  invoices: [owing('INV-0374', 0, 310_000, 14)],
  monthly: [
    { month: 'May', spent: 0 },
    { month: 'Jun', spent: 0 },
    { month: 'Jul', spent: 0 },
    { month: 'Aug', spent: 0 },
    { month: 'Sep', spent: 310_000 },
  ],
});

/** Bugolobi Estates — 5,900,000 on retention, and they pay on the date. */
const bugolobi = build({
  id: 'c-bugolobi',
  name: 'Bugolobi Estates',
  sinceAgo: 700,
  heldBy: null,
  phone: '0414 289 330',
  area: 'Bugolobi',
  creditLimit: 12_000_000,
  invoices: [
    owing('INV-0360', 6, 5_900_000, 25),
    ...run('INV-G-ON', 8, 8_800_000, 80, 60, 25, 25),
    ...run('INV-G-LT', 1, 1_200_000, 600, 1, 25, 32),
  ],
  retentionHeld: true,
  keptTwelveMonths: 2_700_000,
  soldTwelveMonths: 12_800_000,
  buys: [
    { product: 'Cement 50kg', shortName: 'cement', shareOfSpend: 61, margin: 17 },
    { product: 'Hardcore and sand', shortName: 'hardcore', shareOfSpend: 24, margin: 26 },
    { product: 'Everything else', shortName: 'the rest', shareOfSpend: 15, margin: 26 },
  ],
  monthly: [
    { month: 'May', spent: 2_100_000 },
    { month: 'Jun', spent: 1_800_000 },
    { month: 'Jul', spent: 2_400_000 },
    { month: 'Aug', spent: 1_900_000 },
    { month: 'Sep', spent: 5_900_000 },
  ],
});

/**
 * The four in-time accounts the frame has no room for.
 *
 * They are here because the group band says seven accounts and 14,630,000,
 * and a list showing three rows over a total of three rows would be telling
 * a different truth. Their terms are the long ones a contractor gets — 90,
 * 60 and 45 days — which is how an invoice can be sixty-five days old and
 * still not due, and it is what puts 28% of the debt in the oldest band.
 */
const undrawnInTime: readonly Customer[] = [
  { id: 'c-kireka', name: 'Kireka Builders', ago: 65, amount: 4_200_000, term: 90, area: 'Kireka' },
  { id: 'c-namuwongo', name: 'Namuwongo Works', ago: 48, amount: 1_915_000, term: 75, area: 'Namuwongo' },
  { id: 'c-seeta', name: 'Seeta Contractors', ago: 31, amount: 1_000_000, term: 60, area: 'Seeta' },
  { id: 'c-mukono', name: 'Mukono Roofing', ago: 30, amount: 690_000, term: 60, area: 'Mukono' },
].map((x, i) =>
  build({
    id: x.id,
    name: x.name,
    sinceAgo: 500 + i * 30,
    heldBy: null,
    phone: `0772 ${500 + i} 200`,
    area: x.area,
    creditLimit: 20_000_000,
    invoices: [
      owing(`INV-04${10 + i}`, x.ago, x.amount, x.term),
      ...run(`INV-U${i}-ON`, 4, 3_000_000, 200 + i * 10, 40, x.term, x.term - 4),
      ...run(`INV-U${i}-LT`, 1, 500_000, 560, 1, x.term, x.term + 9),
    ],
  }),
);

/* -------------------------------------------------------------------------- */
/*  Gone quiet                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Rashid Ssemakula — owes 510,000 and has bought nothing since 4 June.
 *
 * He is the reason quiet beats owing in {@link standing}: he is over a
 * 400,000 limit, so he could not buy again even if he wanted to, and putting
 * him in the ask order would send a chase to somebody the shop has already
 * shut out. The row says `call`.
 */
const rashid = build({
  id: 'c-rashid',
  name: 'Rashid Ssemakula',
  sinceAgo: 640,
  heldBy: null,
  phone: '0757 118 440',
  area: 'Kasangati',
  creditLimit: 400_000,
  invoices: [
    owing('INV-0148', 103, 510_000, 30),
    ...run('INV-R-ON', 4, 1_900_000, 133, 31, 30, 24),
    ...run('INV-R-LT', 1, 600_000, 255, 1, 30, 43),
  ],
  keptTwelveMonths: 520_000,
  soldTwelveMonths: 2_400_000,
  buys: [
    { product: 'Timber, 4x2', shortName: 'timber', shareOfSpend: 63, margin: 18 },
    { product: 'Nails, assorted', shortName: 'nails', shareOfSpend: 22, margin: 24 },
    { product: 'Everything else', shortName: 'the rest', shareOfSpend: 15, margin: 26 },
  ],
  monthly: [
    { month: 'May', spent: 430_000 },
    { month: 'Jun', spent: 510_000 },
    { month: 'Jul', spent: 0 },
    { month: 'Aug', spent: 0 },
    { month: 'Sep', spent: 0 },
  ],
});

/** The six other accounts that have gone quiet. The band counts their spend. */
const otherQuiet: readonly Customer[] = [
  'Ssemwanga Hardware',
  'Gayaza Timber',
  'Luweero Supplies',
  'Nansana Metal',
  'Kajjansi Stores',
  'Buloba Builders',
].map((name, i) =>
  build({
    id: `c-quiet-${i}`,
    name,
    sinceAgo: 600 + i * 20,
    heldBy: null,
    phone: `0700 ${310 + i} 555`,
    area: 'Wakiso',
    creditLimit: 1_000_000,
    invoices: [settled(`INV-Q${i}`, 120 + i * 9, m(1_015_000), 30, 26)],
  }),
);

/* -------------------------------------------------------------------------- */
/*  The hundred and twenty-four that owe nothing                              */
/* -------------------------------------------------------------------------- */

const TAIL_NAMES = [
  'Ssewankambo', 'Nabukenya', 'Kiyimba', 'Namugga', 'Wandera', 'Atuhaire',
  'Byaruhanga', 'Nakigozi', 'Okello', 'Tumusiime', 'Kabuye', 'Nantongo',
  'Mugisha', 'Achieng', 'Kagimu', 'Nalwoga', 'Odongo', 'Birungi',
  'Ssentongo', 'Nassuna', 'Opio', 'Kyomuhendo', 'Lubega', 'Namatovu',
] as const;

const TAIL_TRADES = [
  'Hardware', 'Stores', 'Traders', 'Supplies', 'Builders', 'Works',
] as const;

/**
 * The quiet majority: accounts that owe nothing this morning.
 *
 * Eighty-six of them settle inside a week every time, which is the fourth
 * strip card. The rest are slower or have been late once, which is what
 * keeps that card from reading "142 of 142" — a figure nobody would look at
 * twice.
 */
function tail(): readonly Customer[] {
  return Array.from({ length: 124 }, (_, i) => {
    const name = `${TAIL_NAMES[i % TAIL_NAMES.length] ?? 'Ssebugwawo'} ${TAIL_TRADES[i % TAIL_TRADES.length] ?? 'Stores'}`;
    const prompt = i < 86;
    // Largest first, so the Best lens has a well-ordered twenty to take.
    const spend = 9_000_000 - i * 68_000;
    return build({
      id: `c-tail-${i}`,
      name,
      sinceAgo: 200 + i * 4,
      heldBy: null,
      phone: `07${String(20 + (i % 70)).padStart(2, '0')} ${String(100 + i).padStart(3, '0')} ${String(200 + i).padStart(3, '0')}`,
      area: 'Kampala',
      creditLimit: 2_000_000,
      invoices: prompt
        ? run(`INV-T${i}`, 5, spend, 60 + (i % 20), 12, 14, 4)
        : [
            ...run(`INV-T${i}-ON`, 4, spend - 400_000, 60 + (i % 20), 12, 14, 9),
            ...run(`INV-T${i}-LT`, 1, 400_000, 300, 1, 14, 25),
          ],
    });
  });
}

/* -------------------------------------------------------------------------- */

/** Every account the shop has. One hundred and forty-two of them. */
export function demoCustomers(): readonly Customer[] {
  return [
    mulongo,
    nakawa,
    kato,
    ken,
    shadia,
    innocent,
    bugolobi,
    ...undrawnInTime,
    rashid,
    ...otherQuiet,
    ...tail(),
  ];
}

/** What the shop keeps across everything it sells — the panel compares to it. */
export const DEMO_SHOP_MARGIN = 24;
