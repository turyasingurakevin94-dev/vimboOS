/**
 * The Messages desk, in the shape a live query will return it.
 *
 * Nothing here is a total. The lens chips, the tiles above each list and the
 * panels beside them are all read through `@ow/domain` from these rows —
 * `moneyDesk`, `tellingDesk`, `postingDesk`, `lensCounts`, `coverDays`,
 * `keepShare`. A figure typed into this file that the screen also computes
 * would be the drift those functions exist to prevent.
 *
 * ## The frames span four turns, and their figures disagree
 *
 * The handoff is a conversation: `2a` draws the Money lens with ONE person
 * to message, `4a` and `1c` draw its chip reading 9, and `5a` reads 6. Those
 * are three moments of one story, not three states this screen can be in at
 * once, and "any figure that appears on both a lens and a panel must come
 * from one reckoning" is the rule that outranks reproducing all three.
 *
 * So the dataset is the one each lens's OWN canonical frame draws, per the
 * handoff's own table — Money from `2a`, Telling from `4a`, Posting from
 * `1c`, Inbox from `5a` — and every count is derived from it. The Money chip
 * therefore reads 1 on every lens, which is what `2a` draws and what the
 * "To message" tile beside it says.
 *
 * ## One doc number the two handoffs disagree about
 *
 * `INV-0175` is Nakawa Traders at 2,410,000 and 74 days old in every
 * Messages frame, and Ken Bwaise at 465,000 in `demo-invoices.ts`, which is
 * what the Invoices handoff draws. Both are illustrations, they were drawn
 * months apart, and the collision is in the mockups rather than in the code:
 * these rows carry an invoice NUMBER, not a second reckoning of an invoice,
 * and when both screens read the real invoice table it resolves itself. It is
 * written down here rather than quietly renamed so that the day somebody
 * wires this to Supabase, they know which of the two the ledger will win.
 */

import {
  Money,
  type Chat,
  type ChaseRecord,
  type Desk,
  type Link,
  type Owed,
  type Post,
  type SignalRecord,
  type Telling,
  type TellingKind,
  type TellingRecord,
} from '@ow/domain';

// The day, from the one place that already declares it. Every handoff in
// this project is drawn on 15 September 2026, and two modules each naming it
// is how two screens end up a day apart.
import { DEMO_TODAY } from './demo-invoices.js';

const m = Money.money;

const day = (offset: number): Date =>
  new Date(DEMO_TODAY.getTime() + offset * 86_400_000);

const at = (hh: number, mm: number): Date => {
  const d = new Date(DEMO_TODAY);
  d.setHours(hh, mm, 0, 0);
  return d;
};

/* -------------------------------------------------------------------------- */
/*  The Money lens — frame 2a, and the person's own draft in 1b               */
/* -------------------------------------------------------------------------- */

/**
 * The one message the shop owes this morning.
 *
 * No invoice stands behind the balance — it was carried onto the account from
 * earlier — which is why the draft asks for the figure alone and offers to
 * check it, and why an amber block says so above it. That sentence is the
 * owner's own and survives verbatim.
 */
const sampleCustomer: Owed = {
  id: 'owed-sample',
  name: 'Sample Customer',
  initials: 'SC',
  tone: 'bad',
  phone: '0782432454',
  place: 'Ntinda',
  about: 'owes money, no invoice behind it',
  atStake: m(350_000),
  invoice: null,
  oldestDays: 15,
  dueOn: day(-15),
  lastWord: null,
  chases: 0,
  everPaid: false,
  history: [],
  draft: `Hello Sample,

Our records show *350,000 UGX* still
outstanding on your account.

The oldest of this has been outstanding
15 days, and we have not received a
payment on this account yet.

Please let us know when we can expect
payment. If any of this does not match
your own records, tell us and we will
check it.

Thank you,
Ssekitoleko Hardware`,
  hold: null,
  stamp: null,
  replied: false,
};

/**
 * Nakawa Traders — sent, waiting, and the draft frame `1b` opens.
 *
 * Five chases, two of them answered with a promise and nothing after it. The
 * panel's own conclusion is on the screen: messages have stopped working on
 * this account, and a call or a visit is the next lever. The sixth chase is
 * what the box holds.
 */
const nakawa: Owed = {
  id: 'owed-nakawa',
  name: 'Nakawa Traders',
  initials: 'NT',
  tone: 'bad',
  phone: '0703 221 884',
  place: null,
  about: 'INV-0175 · 74 days · 6th chase',
  atStake: m(2_410_000),
  invoice: 'INV-0175',
  oldestDays: 74,
  dueOn: day(-60),
  lastWord: day(-13),
  chases: 5,
  everPaid: true,
  history: [
    { on: day(-13), what: 'read, no reply', outcome: 'silent' },
    { on: day(-24), what: 'read, no reply', outcome: 'silent' },
    { on: day(-38), what: 'said "next week"', outcome: 'promised' },
    { on: day(-52), what: 'read, no reply', outcome: 'silent' },
    { on: day(-65), what: 'said "end of the month"', outcome: 'promised' },
  ],
  draft: `Good morning Nakawa Traders.

Invoice INV-0175 of 3 July is still
open:

  Iron sheets G28  40 Pcs  1,160,000
  Cement 50kg      30 bags   960,000
  Roofing nails    8 Box     230,000
  Transport                   60,000
  --------------------------------
  Due                      2,410,000

It is 74 days old. Could you let us
know a date this week?

Ssekitoleko Hardware · 0772 100 400`,
  hold: null,
  stamp: { on: day(-13), by: 'Kevin', went: true },
  replied: false,
};

/**
 * The rest of the Sent group. The register draws three names and "and 18
 * more"; the count under the group header is this list's length, so the
 * eighteen have to exist or the header is a claim rather than a count.
 */
const WAITING: readonly (readonly [string, string, number, number])[] = [
  ['Ken Lubega', 'KL', 640_000, 9],
  ['Innocent Busingye', 'IB', 310_000, 11],
  ['Joan JEZONA', 'JJ', 455_000, 8],
  ['Shafik Katwe', 'SK', 390_000, 7],
  ['Mulongo Hardware', 'MH', 820_000, 7],
  ['Shadia Nabbosa', 'SN', 275_000, 6],
  ['Ken Bwaise', 'KB', 200_000, 6],
  ['Ssebunya Peter', 'SP', 175_000, 6],
  ['Bwire Godfrey', 'BG', 512_000, 5],
  ['Nalubega Grace', 'NG', 96_000, 5],
  ['Kigozi Steel Works', 'KS', 1_040_000, 5],
  ['Musoke Ronald', 'MR', 233_000, 4],
  ['Acaye Denis', 'AD', 148_000, 4],
  ['Namara Sarah', 'NS', 402_000, 3],
  ['Opio Jackson', 'OJ', 87_000, 3],
  ['Wandera Moses', 'WM', 615_000, 3],
  ['Tumwine Brian', 'TB', 129_000, 2],
  ['Kirabo Hardware', 'KH', 744_000, 2],
  ['Ochieng Paul', 'OP', 268_000, 2],
  ['Nakiwala Ruth', 'NR', 310_000, 1],
];

const waitingRow = (
  [name, initials, stake, ago]: readonly [string, string, number, number],
  i: number,
): Owed => ({
  id: `owed-waiting-${i}`,
  name,
  initials,
  tone: 'neutral',
  phone: '0772 000 000',
  place: null,
  about: 'chased, waiting on a reply',
  atStake: m(stake),
  invoice: null,
  oldestDays: ago + 30,
  dueOn: day(-(ago + 16)),
  lastWord: day(-ago),
  chases: 1,
  everPaid: true,
  history: [{ on: day(-ago), what: 'read, no reply', outcome: 'silent' }],
  draft: `Hello ${name},\n\nA gentle reminder about the balance on\nyour account. Could you let us know a\ndate this week?\n\nSsekitoleko Hardware`,
  hold: null,
  stamp: { on: day(-ago), by: 'Kevin', went: true },
  replied: false,
});

export const demoOwed = (): readonly Owed[] => [
  sampleCustomer,
  nakawa,
  ...WAITING.map(waitingRow),
];

/** What 184 sent messages in ninety days have actually done. */
export const demoChaseRecord = (): ChaseRecord => ({
  sent: 184,
  paid: 57,
  daysToMoney: 4.2,
  overDays: 90,
  repliedAskingDate: 44,
  repliedAskingAmount: 19,
});

/* -------------------------------------------------------------------------- */
/*  The Telling lens — frame 4a                                               */
/* -------------------------------------------------------------------------- */

export const demoTelling = (): readonly Telling[] => [
  {
    id: 'tell-okello',
    name: 'Okello Fred',
    initials: 'OF',
    tone: 'info',
    kind: 'asked-for',
    what: 'the gutters you asked for are in · 20 at 39,500',
    whyThem: 'asked twice, 16d ago',
    whyTone: 'info',
    goodUntil: { kind: 'day', on: DEMO_TODAY },
    route: 'tell',
    routeNote: null,
    worth: m(790_000),
    stoppedBeingTrue: null,
    draft: `Hello Okello,

The gutters you asked about are
now in stock — 3m, 39,500 each,
20 in the yard.

You asked twice, so I kept you
in mind. Shall I put some aside?

Ssekitoleko Hardware`,
  },
  {
    id: 'tell-kato',
    name: 'Kato Construction',
    initials: 'KC',
    tone: 'info',
    kind: 'delivery',
    what: 'order #348 is on the afternoon run · arriving today',
    whyThem: 'saves them ringing',
    whyTone: 'neutral',
    goodUntil: { kind: 'day', on: DEMO_TODAY },
    route: 'tell',
    routeNote: null,
    // It earns no order. It prevents a phone call, and it must never be
    // ranked by what it might sell or it will always come last.
    worth: null,
    stoppedBeingTrue: null,
    draft: `Hello Kato Construction,

Order #348 is on this afternoon's
run and should reach you today.

Ssekitoleko Hardware`,
  },
  {
    id: 'tell-ssendawula',
    name: 'Ssendawula Sam',
    initials: 'SS',
    tone: 'good',
    kind: 'back-in-stock',
    what: 'cement is back · he came twice while it was out',
    whyThem: 'buys it every week',
    whyTone: 'good',
    goodUntil: { kind: 'day', on: day(3) },
    route: 'tell',
    routeNote: null,
    worth: m(320_000),
    stoppedBeingTrue: null,
    draft: `Hello Sam,

Cement 50kg is back on the shelf.
You came twice while it was out,
so I am telling you first.

Ssekitoleko Hardware`,
  },
  {
    id: 'tell-nakawa-price',
    name: 'Nakawa Traders',
    initials: 'NT',
    tone: 'neutral',
    kind: 'price-move',
    what: 'iron sheets are 8% cheaper · 27,500 a sheet',
    whyThem: 'they owe 2,410,000',
    whyTone: 'caution',
    goodUntil: { kind: 'while-it-holds' },
    // A price on a product is the posting queue's job. The route is on the
    // row, and the row sits outside the count it does not belong to.
    route: 'post',
    routeNote: '1st in the queue',
    worth: null,
    stoppedBeingTrue: null,
    draft: null,
  },
  {
    id: 'tell-timber',
    name: 'Timber price cut',
    initials: 'TP',
    tone: 'neutral',
    kind: 'price-move',
    what: 'Timber price cut · 2 people · the price went back up',
    whyThem: 'the price went back up',
    whyTone: 'neutral',
    goodUntil: { kind: 'while-it-holds' },
    route: 'tell',
    routeNote: null,
    worth: m(260_000),
    stoppedBeingTrue: { on: day(-3), because: 'the price went back up' },
    draft: null,
  },
  {
    id: 'tell-paint',
    name: 'Paint back in stock',
    initials: 'PB',
    tone: 'neutral',
    kind: 'back-in-stock',
    what: 'Paint back in stock · 1 person · they bought it elsewhere',
    whyThem: 'they bought it elsewhere',
    whyTone: 'neutral',
    goodUntil: { kind: 'day', on: day(-4) },
    route: 'tell',
    routeNote: null,
    worth: m(130_000),
    stoppedBeingTrue: { on: day(-4), because: 'they bought it elsewhere' },
    draft: null,
  },
  {
    id: 'tell-nails',
    name: 'Roofing nails asked for',
    initials: 'RN',
    tone: 'neutral',
    kind: 'asked-for',
    what: 'Roofing nails asked for · 1 person · they stopped asking',
    whyThem: 'they stopped asking',
    whyTone: 'neutral',
    goodUntil: { kind: 'day', on: day(-5) },
    route: 'tell',
    routeNote: null,
    // The third of the three, and the one with no figure on file — which is
    // why the total under them reads "two of those three".
    worth: null,
    stoppedBeingTrue: { on: day(-5), because: 'they stopped asking' },
    draft: null,
  },
];

export const demoTellingRecord = (): TellingRecord => ({
  led: 14,
  of: 38,
  bought: m(2_340_000),
  withinDays: 7,
  overDays: 90,
  byKind: new Map<TellingKind, { moved: number; of: number }>([
    ['asked-for', { moved: 5, of: 6 }],
    ['delivery', { moved: 0, of: 9 }],
    ['back-in-stock', { moved: 5, of: 12 }],
    ['price-move', { moved: 4, of: 11 }],
  ]),
});

/* -------------------------------------------------------------------------- */
/*  The Posting lens — frame 1c                                               */
/* -------------------------------------------------------------------------- */

/**
 * Fourteen nominated and thirty-one held back.
 *
 * Both counts are this array's own, split by `heldBack` in the domain: a
 * product whose shelf cannot carry a week of cover is held, and the queue is
 * what is left. The five the frame draws in full are first; the nine behind
 * them are real rows because the lens chip counts them and the tile says
 * twelve roll to tomorrow.
 */
export function demoPosts(): readonly Post[] {
  const ironSheets: Post = {
    id: 'post-iron-g28',
    product: 'Iron sheets G28',
    why: 'Kampala Steel dropped to 27,500 · 8% under August',
    signal: 'price-cut',
    onHand: 340,
    soldPerDay: 16,
    sellPrice: m(34_500),
    costPrice: m(25_530),
    // Eight per cent under August, from the shop's biggest supplier: as
    // strong as a price cut gets here.
    strength: 1,
    picked: true,
    card: {
      spec: '30 gauge · 3 metre · per piece',
      price: m(34_500),
      wasPrice: m(37_000),
      onHandSaid: 'We have 340 Pcs. Ndeeba shop, or we deliver in town.',
      phone: '0772 100 400',
      place: 'Ndeeba',
      photo: false,
      message: `New price on iron sheets G28.

  Was    37,000 / Pc
  Now    34,500 / Pc

We have 340 Pcs. Ndeeba shop, or we
deliver in town.

Ssekitoleko Hardware · 0772 100 400`,
    },
  };

  const pvc: Post = {
    id: 'post-pvc-20',
    product: 'PVC conduit 20mm',
    why: '40 lengths, 180 days idle · 3 past buyers to tell',
    signal: 'idle-stock',
    onHand: 40,
    // Nothing has sold. Not a small rate — no rate, which is why the Cover
    // column says "no sales" and why it is NOT held back.
    soldPerDay: 0,
    sellPrice: m(12_000),
    costPrice: m(12_000),
    strength: 1,
    picked: true,
    card: null,
  };

  const rest: readonly Post[] = [
    {
      id: 'post-ridge-caps',
      product: 'Ridge caps',
      why: 'bought with iron sheets on 18 of last 21 orders',
      signal: 'goes-together',
      onHand: 170,
      soldPerDay: 5,
      sellPrice: m(8_000),
      costPrice: m(5_520),
      strength: 1,
      picked: false,
      card: null,
    },
    {
      id: 'post-gutters-3m',
      product: 'Rain gutters 3m',
      why: 'rains start late Sep · sold 3× as much last October',
      signal: 'season-starting',
      onHand: 94,
      soldPerDay: 2,
      sellPrice: m(39_500),
      costPrice: m(28_045),
      strength: 1,
      picked: false,
      card: null,
    },
    {
      id: 'post-binding-wire',
      product: 'Binding wire 20kg',
      why: 'your widest margin that nobody asks for',
      signal: 'margin',
      onHand: 62,
      soldPerDay: 1,
      sellPrice: m(96_000),
      costPrice: m(59_520),
      strength: 1,
      picked: false,
      card: null,
    },
    ...NOMINATED.map(nominatedRow),
  ];

  return [ironSheets, pvc, ...rest, ...HELD.map(heldRow)];
}

/**
 * The nine behind the five, so that "14 nominated" is a count.
 *
 * Each shows its signal WEAKLY — a six per cent cut where the sheets are
 * eight, a pairing on sixteen of eighteen orders where the ridge caps are
 * eighteen of twenty-one — which is what puts them behind the five the frame
 * draws. Their last column is that strength, and it is the only thing
 * separating two rows wearing the same chip.
 */
const NOMINATED: readonly (readonly [
  string,
  string,
  Post['signal'],
  number,
  number,
  number,
  number,
  number,
])[] = [
  ['Roofing nails 4"', 'sold with sheets on 12 of 19 orders', 'goes-together', 210, 6, 9_500, 6_650, 0.24],
  ['Wheelbarrow heavy', '60 days idle · 4 past buyers', 'idle-stock', 18, 0, 185_000, 129_500, 0.22],
  ['Hoop iron 30m', 'season starting with the rains', 'season-starting', 150, 4, 22_000, 15_400, 0.2],
  ['Damp course 1m', 'goes with cement on 9 of 14 orders', 'goes-together', 300, 12, 4_500, 3_060, 0.18],
  ['Wall plugs 100pc', 'widest margin in the small lines', 'margin', 240, 5, 12_000, 6_600, 0.17],
  ['Paint brush 4"', '90 days idle · 6 past buyers', 'idle-stock', 75, 0, 14_000, 9_800, 0.15],
  ['Ceiling boards', 'supplier dropped 6% this week', 'price-cut', 220, 9, 28_000, 20_160, 0.14],
  ['Gutter brackets', 'goes with gutters on 16 of 18', 'goes-together', 400, 10, 3_500, 2_310, 0.12],
  ['Padlock 50mm', 'season starting · school term', 'season-starting', 130, 3, 17_000, 11_050, 0.1],
];

const nominatedRow = (
  [product, why, signal, onHand, soldPerDay, sell, cost, strength]: readonly [
    string,
    string,
    Post['signal'],
    number,
    number,
    number,
    number,
    number,
  ],
  i: number,
): Post => ({
  id: `post-nominated-${i}`,
  product,
  why,
  signal,
  onHand,
  soldPerDay,
  sellPrice: m(sell),
  costPrice: m(cost),
  strength,
  picked: false,
  card: null,
});

/**
 * Thirty-one products the shelf cannot carry a week of.
 *
 * Cement is the one the frame draws at the head of the group, so it is the
 * thinnest shelf of the thirty-one: three days of cover, and posting it
 * would sell what the shop cannot deliver. `postingDesk` ranks the group on
 * that figure, so nothing may sit below it.
 */
const HELD: readonly (readonly [string, string, number, number, number, number])[] = [
  ['Cement 50kg', '3 days of cover · posting it would sell what you cannot deliver', 36, 12, 32_000, 28_480],
  ['Iron sheets G30', '4 days of cover', 48, 12, 31_000, 22_940],
  ['Steel bars Y12', '5 days of cover', 40, 8, 46_000, 33_120],
  ['Steel bars Y10', '5 days of cover', 35, 7, 38_000, 27_360],
  ['Sand, tipper', '4 days of cover', 8, 2, 420_000, 336_000],
  ['Hardcore, tipper', '3 days of cover', 6, 2, 380_000, 304_000],
  ['Tiles 40×40', '6 days of cover', 120, 20, 3_200, 2_240],
  ['Nails 3"', '4 days of cover', 60, 15, 8_500, 5_950],
  ['Binding wire 5kg', '5 days of cover', 25, 5, 26_000, 18_200],
  ['PPC pozzolanic', '4 days of cover', 40, 10, 33_000, 29_370],
  ['Ridge caps 2m', '6 days of cover', 30, 5, 12_000, 8_280],
  ['Gutter downpipe', '4 days of cover', 24, 6, 27_000, 18_900],
  ['Roof tiles, clay', '3 days of cover', 90, 30, 4_800, 3_360],
  ['Timber 4×2', '5 days of cover', 100, 20, 14_000, 9_800],
  ['Timber 6×2', '4 days of cover', 60, 15, 22_000, 15_400],
  ['Plywood 12mm', '6 days of cover', 36, 6, 78_000, 54_600],
  ['Chipboard 18mm', '5 days of cover', 25, 5, 92_000, 64_400],
  ['Paint, white 20L', '3 days of cover', 12, 4, 168_000, 117_600],
  ['Paint, cream 20L', '4 days of cover', 16, 4, 168_000, 117_600],
  ['Undercoat 4L', '6 days of cover', 18, 3, 46_000, 32_200],
  ['Door frames, steel', '5 days of cover', 15, 3, 210_000, 147_000],
  ['Window frames 4ft', '4 days of cover', 12, 3, 240_000, 168_000],
  ['Hinges 4"', '6 days of cover', 120, 20, 6_500, 4_550],
  ['Door locks, brass', '3 days of cover', 9, 3, 85_000, 59_500],
  ['PVC pipe 4"', '5 days of cover', 30, 6, 42_000, 29_400],
  ['PVC pipe 2"', '6 days of cover', 36, 6, 24_000, 16_800],
  ['Elbows 4"', '4 days of cover', 48, 12, 7_000, 4_900],
  ['Cable 2.5mm, roll', '5 days of cover', 10, 2, 320_000, 224_000],
  ['Switch sockets', '6 days of cover', 60, 10, 15_000, 10_500],
  ['Bulbs, LED 12W', '4 days of cover', 80, 20, 11_000, 7_700],
  ['Water tank 1000L', '5 days of cover', 10, 2, 640_000, 486_400],
];

const heldRow = (
  [product, why, onHand, soldPerDay, sell, cost]: readonly [
    string,
    string,
    number,
    number,
    number,
    number,
  ],
  i: number,
): Post => ({
  id: `post-held-${i}`,
  product,
  why,
  signal: 'price-cut',
  onHand,
  soldPerDay,
  sellPrice: m(sell),
  costPrice: m(cost),
  strength: 0.5,
  picked: false,
  card: null,
});

/** What each signal has actually done, over 22 stamped posts in 90 days. */
export const demoSignalRecords = (): readonly SignalRecord[] => [
  { signal: 'price-cut', moved: 6, of: 7 },
  { signal: 'goes-together', moved: 4, of: 6 },
  { signal: 'season-starting', moved: 1, of: 2 },
  { signal: 'idle-stock', moved: 2, of: 8 },
  { signal: 'margin', moved: 1, of: 4 },
];

/* -------------------------------------------------------------------------- */
/*  The Inbox lens — frame 5a, and only once the number is linked             */
/* -------------------------------------------------------------------------- */

export const demoChats = (): readonly Chat[] => [
  {
    id: 'chat-nakawa',
    name: 'Nakawa Traders',
    initials: 'NT',
    tone: 'bad',
    phone: '0703 221 884',
    at: at(14, 22),
    preview: '“We shall pay 1,000,000 on Friday”',
    about: { kind: 'invoice', doc: 'INV-0175', owes: m(2_410_000), days: 74 },
    lines: [
      { from: 'them', text: 'We shall pay 1,000,000 on Friday', at: at(14, 22), by: null },
      { from: 'us', text: 'Noted, thank you.', at: at(14, 26), by: 'you' },
    ],
    promised: m(1_000_000),
  },
  {
    id: 'chat-kato',
    name: 'Kato Construction Ltd',
    initials: 'KC',
    tone: 'info',
    phone: '0772 884 120',
    at: at(13, 5),
    preview: '“Are the sheets on the van today?”',
    about: { kind: 'order', doc: 'ORD-0412', line: 'out for delivery · lands Thursday' },
    lines: [
      { from: 'them', text: 'Are the sheets on the van today?', at: at(13, 5), by: null },
    ],
    promised: null,
  },
  {
    id: 'chat-mariam',
    name: 'Mariam Kigozi',
    initials: 'MK',
    tone: 'neutral',
    phone: '0759 400 221',
    at: at(11, 40),
    preview: '“How much for 20 bags of cement?”',
    about: { kind: 'none', line: 'not a customer yet · no order on file' },
    lines: [
      { from: 'them', text: 'How much for 20 bags of cement?', at: at(11, 40), by: null },
    ],
    promised: null,
  },
  {
    id: 'chat-kampala-steel',
    name: 'Kampala Steel',
    initials: 'KS',
    tone: 'neutral',
    phone: '0700 118 220',
    at: at(9, 12),
    preview: '“G28 is 27,500 this week”',
    about: { kind: 'supplier', line: 'supplier · already in the posting queue' },
    lines: [{ from: 'them', text: 'G28 is 27,500 this week', at: at(9, 12), by: null }],
    promised: null,
  },
];

/**
 * The number is not linked, which is the state the whole third turn is about.
 *
 * The Inbox lens is therefore absent rather than empty, and the register
 * keeps one line at its foot offering to turn it on.
 */
export const demoLink = (): Link => ({
  linked: false,
  code: 'MQ4K-7TD2',
  issuedAt: DEMO_TODAY,
});

/* -------------------------------------------------------------------------- */

export const demoDesk = (): Desk => ({
  owed: demoOwed(),
  telling: demoTelling(),
  posts: demoPosts(),
  chats: demoChats(),
  link: demoLink(),
  chaseRecord: demoChaseRecord(),
  tellingRecord: demoTellingRecord(),
  signalRecords: demoSignalRecords(),
  soldAfterPosts: { amount: m(4_180_000), posts: 22, withinDays: 3 },
});

/** What the shop's own catalogue says it has, for the setup card's basis. */
export const CATALOGUE_WITH_PHOTO_AND_PRICE = 131;

/** How many people buy the line a price change would be sent to. */
export const PICKED_LIST_SIZE = 24;

/**
 * How many of them the Telling lens has actually nominated for the iron
 * sheets message — the list the picked-list dialog is picking three out of.
 */
export const PICKED_LIST_CANDIDATES = 11;
