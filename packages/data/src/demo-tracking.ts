/**
 * The board of the Order-tracking handoff, as data.
 *
 * Fifty-four live orders on a busy day — the exact orders frame `1a` draws,
 * and the exact orders the phone frames `1p`, `1q` and `1r` draw, because
 * they are one board seen twice. It sits in the data layer, standing in for
 * `ordersForBoard()`, so that when the real query lands both designs change
 * one import and nothing else.
 *
 * ## Where this differs from the frame's own script, and why
 *
 * The frame carries its state as prose — `'4 of 9 items in'`, `'Waiting on
 * Bbosa Steel'` — and re-derives the card's control by running regular
 * expressions over it. That is fine for a drawing and wrong for an app: the
 * padlock on an order would then depend on how a sentence was phrased. So
 * the prose is unwound into the state it describes, and the control comes
 * off the state.
 *
 * Two places where unwinding it forced a choice:
 *
 * 1. **The meter's denominator is the order's bought-in lines.** The frame's
 *    `#360` says `4 lines, 1 to buy` and then draws `2 of 4 items in`, which
 *    cannot both be true. The handoff's rule — *"bought-in lines checked in
 *    over lines to buy"* — settles it, so `toBuy` is the meter's denominator
 *    and the card's own sub-line quotes that same number.
 * 2. **A Taken order with nothing bought in has no wait**, which is the
 *    handoff's rule in words. `#373` is one line the shop already holds, so
 *    it carries a chevron and says nothing, where the frame drew the line
 *    `Sent 20 minutes ago` — four words on a row the handoff caps at two.
 */

import {
  Money,
  known,
  type Derived,
  type ShortPick,
  type Stage,
  type SupplierAsk,
  type TrackedOrder,
  type Trip,
} from '@ow/domain';

const m = (shillings: number): Derived<Money.Money> =>
  known(Money.money(shillings), 'order total');

/**
 * Eleven in the morning in Kampala, which is when this board was drawn.
 *
 * It is its own constant rather than `DEMO_TODAY`, and the reason is on the
 * cards: the frame's delivered orders were handed over between 07:40 and
 * 11:05, and an order delivered at 10:30 cannot be three hours old at 07:42.
 * The board's clock is the one every age and every handover time on it is
 * read from.
 */
export const DEMO_BOARD_NOW = new Date('2026-09-15T08:00:00Z');

const ago = (hours: number, minutes = 0): Date =>
  new Date(DEMO_BOARD_NOW.getTime() - (hours * 60 + minutes) * 60_000);

/** Suppliers on an order: every name asked, and the ones still silent. */
const asked = (...names: readonly string[]): readonly SupplierAsk[] =>
  names.map((name) => ({ name, answered: false }));

const answered = (...names: readonly string[]): readonly SupplierAsk[] =>
  names.map((name) => ({ name, answered: true }));

interface Draft {
  readonly reference: string;
  readonly customer: string;
  readonly place: string;
  readonly value: number;
  readonly lines: number;
  readonly toBuy?: number;
  readonly checkedIn?: number;
  readonly h: number;
  readonly min: number;
  readonly suppliers?: readonly SupplierAsk[];
  readonly shortPick?: ShortPick;
  readonly packed?: boolean;
  readonly picker?: string;
  readonly run?: string;
  readonly invoice?: string;
}

const card = (stage: Stage, d: Draft): TrackedOrder => ({
  reference: d.reference,
  customer: d.customer,
  place: d.place,
  lines: d.lines,
  toBuy: d.toBuy ?? 0,
  checkedIn: d.checkedIn ?? 0,
  stage,
  since: ago(d.h, d.min),
  value: m(d.value),
  suppliers: d.suppliers ?? [],
  shortPick: d.shortPick ?? null,
  packed: d.packed ?? false,
  picker: d.picker ?? null,
  run: d.run ?? null,
  invoice: d.invoice ?? null,
});

/* --------------------------------- Taken ---------------------------------- */

const taken: readonly TrackedOrder[] = [
  card('draft', { reference: '#341', customer: 'Ssekitoleko Hardware', place: 'Kisenyi', value: 1_240_000, lines: 6, toBuy: 4, h: 21, min: 8, suppliers: [...answered('Haidery Hardware', 'Zzimwe Supplies', 'Karddia'), ...asked('Mulongo Hardware')] }),
  card('draft', { reference: '#348', customer: 'Kato Construction Ltd', place: 'Nateete', value: 860_000, lines: 3, toBuy: 3, h: 14, min: 52, suppliers: [...answered('Tendo Hardware', 'Haidery Hardware'), ...asked('Bbosa Steel')] }),
  card('draft', { reference: '#357', customer: 'Jackson', place: 'Ndeeba', value: 250_000, lines: 1, toBuy: 1, h: 15, min: 19, suppliers: answered('Karddia') }),
  card('draft', { reference: '#361', customer: 'Nabirye Stores', place: 'Katwe', value: 410_000, lines: 2, toBuy: 2, h: 9, min: 30, suppliers: asked('Karddia') }),
  card('draft', { reference: '#364', customer: 'Kigongo Traders', place: 'Bweyogerere', value: 95_000, lines: 1, toBuy: 1, h: 6, min: 45, suppliers: asked('Tendo') }),
  card('draft', { reference: '#366', customer: 'Namugongo Builders', place: 'Ndeeba', value: 620_000, lines: 4, toBuy: 1, h: 4, min: 12, suppliers: asked('Haidery') }),
  card('draft', { reference: '#369', customer: 'Ntale Hardware', place: 'Kisenyi', value: 180_000, lines: 2, toBuy: 2, h: 2, min: 55, suppliers: asked('Zzimwe') }),
  card('draft', { reference: '#371', customer: 'Lubega Traders', place: 'Industrial Area', value: 740_000, lines: 5, toBuy: 2, h: 1, min: 40, suppliers: asked('Bbosa Steel') }),
  // Nothing bought in, so nobody to wait on: the chevron is the whole card.
  card('draft', { reference: '#373', customer: 'Wasswa Hardware', place: 'Katwe', value: 135_000, lines: 1, h: 0, min: 21 }),
];

/* --------------------------------- Buying --------------------------------- */

const buying: readonly TrackedOrder[] = [
  card('awaiting_goods', { reference: '#360', customer: 'Ssendawula Sam', place: 'Trade Center', value: 235_000, lines: 4, toBuy: 4, checkedIn: 2, h: 19, min: 4 }),
  card('awaiting_goods', { reference: '#344', customer: 'Mulongo Hardware', place: 'Industrial Area', value: 1_980_000, lines: 9, toBuy: 9, checkedIn: 4, h: 17, min: 36 }),
  card('awaiting_goods', { reference: '#350', customer: 'Bbosa Steel', place: 'Kisenyi', value: 520_000, lines: 3, toBuy: 3, checkedIn: 1, h: 13, min: 10 }),
  card('awaiting_goods', { reference: '#352', customer: 'Kirumira & Sons', place: 'Nateete', value: 380_000, lines: 2, toBuy: 2, h: 11, min: 48 }),
  card('awaiting_goods', { reference: '#354', customer: 'Nakato Hardware', place: 'Ndeeba', value: 760_000, lines: 5, toBuy: 5, checkedIn: 2, h: 10, min: 22 }),
  card('awaiting_goods', { reference: '#356', customer: 'Zzimwe Contractors', place: 'Bweyogerere', value: 2_140_000, lines: 11, toBuy: 11, checkedIn: 3, h: 9, min: 5 }),
  card('awaiting_goods', { reference: '#358', customer: 'Byaruhanga Timber', place: 'Katwe', value: 295_000, lines: 2, toBuy: 1, h: 8, min: 40 }),
  card('awaiting_goods', { reference: '#362', customer: 'Tendo Hardware', place: 'Kisenyi', value: 165_000, lines: 1, toBuy: 1, h: 7, min: 15 }),
  card('awaiting_goods', { reference: '#363', customer: 'Kyambogo Works', place: 'Industrial Area', value: 910_000, lines: 6, toBuy: 6, checkedIn: 1, h: 6, min: 30 }),
  card('awaiting_goods', { reference: '#365', customer: 'Nakalema Stores', place: 'Nateete', value: 148_000, lines: 1, toBuy: 1, h: 5, min: 2 }),
  card('awaiting_goods', { reference: '#367', customer: 'Kigongo Traders', place: 'Ndeeba', value: 330_000, lines: 3, toBuy: 3, checkedIn: 2, h: 4, min: 25 }),
  card('awaiting_goods', { reference: '#368', customer: 'Ssekitoleko Hardware', place: 'Kisenyi', value: 470_000, lines: 3, toBuy: 2, h: 3, min: 18 }),
  card('awaiting_goods', { reference: '#370', customer: 'Kato Construction Ltd', place: 'Nateete', value: 1_120_000, lines: 7, toBuy: 7, h: 2, min: 44 }),
  card('awaiting_goods', { reference: '#372', customer: 'Lubega Traders', place: 'Katwe', value: 88_000, lines: 1, toBuy: 1, h: 1, min: 12 }),
];

/* ------------------------------- Preparing -------------------------------- */

const preparing: readonly TrackedOrder[] = [
  card('preparing', { reference: '#339', customer: 'Nakato Hardware', place: 'Ndeeba', value: 540_000, lines: 4, h: 8, min: 26, picker: 'Alice' }),
  card('preparing', { reference: '#343', customer: 'Wasswa Hardware', place: 'Katwe', value: 215_000, lines: 2, h: 6, min: 55, picker: 'Alice' }),
  card('preparing', { reference: '#345', customer: 'Kirumira & Sons', place: 'Nateete', value: 690_000, lines: 5, h: 5, min: 30, picker: 'Musoke', packed: true }),
  card('preparing', { reference: '#347', customer: 'Ntale Hardware', place: 'Kisenyi', value: 128_000, lines: 1, h: 4, min: 10, picker: 'Musoke' }),
  // The short pick nobody has settled. It is the one padlock in this lane.
  card('preparing', { reference: '#351', customer: 'Namugongo Builders', place: 'Ndeeba', value: 1_340_000, lines: 8, h: 3, min: 2, picker: 'Alice', shortPick: { asked: 8, found: 6, settled: false } }),
  card('preparing', { reference: '#353', customer: 'Nabirye Stores', place: 'Katwe', value: 175_000, lines: 2, h: 1, min: 48, picker: 'Musoke', packed: true }),
  card('preparing', { reference: '#359', customer: 'Tendo Hardware', place: 'Kisenyi', value: 260_000, lines: 2, h: 0, min: 35, picker: 'Alice', packed: true }),
];

/* ----------------------------------- Out ---------------------------------- */

const out: readonly TrackedOrder[] = [
  card('pending_delivery', { reference: '#328', customer: 'Zzimwe Contractors', place: 'Bweyogerere', value: 2_410_000, lines: 12, h: 5, min: 20, run: 'Run 1 · Kizito' }),
  card('pending_delivery', { reference: '#331', customer: 'Byaruhanga Timber', place: 'Katwe', value: 385_000, lines: 3, h: 4, min: 50, run: 'Run 1 · Kizito' }),
  card('pending_delivery', { reference: '#334', customer: 'Kyambogo Works', place: 'Industrial Area', value: 870_000, lines: 6, h: 4, min: 5, run: 'Run 1 · Kizito' }),
  card('pending_delivery', { reference: '#336', customer: 'Nakalema Stores', place: 'Nateete', value: 142_000, lines: 1, h: 2, min: 30, run: 'Run 2 · Opio' }),
  card('pending_delivery', { reference: '#338', customer: 'Jackson', place: 'Ndeeba', value: 310_000, lines: 2, h: 1, min: 55, run: 'Run 2 · Opio' }),
  card('pending_delivery', { reference: '#340', customer: 'Mulongo Hardware', place: 'Industrial Area', value: 1_060_000, lines: 7, h: 0, min: 40, run: 'Run 2 · Opio' }),
];

/* -------------------------------- Delivered ------------------------------- */

/**
 * Eighteen delivered today, one of them invoiced.
 *
 * Six are the board's window — the most recent handovers, oldest of those at
 * the top of the lane — and the twelve earlier ones are counted at its foot
 * rather than drawn. That is the same cut every long list in this app makes,
 * and it is what makes `1 of 18 invoiced`, `To invoice 17` and the phone's
 * `Done 18` the same three readings of one lane.
 */
const earlier = (n: number, h: number, min: number, value: number, customer: string, place: string, lines: number): TrackedOrder =>
  card('completed', { reference: `#${n}`, customer, place, value, lines, h, min });

const delivered: readonly TrackedOrder[] = [
  card('completed', { reference: '#312', customer: 'Ssekitoleko Hardware', place: 'Kisenyi', value: 980_000, lines: 6, h: 3, min: 20, invoice: 'INV-0412' }),
  card('completed', { reference: '#314', customer: 'Kato Construction Ltd', place: 'Nateete', value: 1_450_000, lines: 9, h: 2, min: 45 }),
  card('completed', { reference: '#317', customer: 'Nakato Hardware', place: 'Ndeeba', value: 260_000, lines: 2, h: 2, min: 0 }),
  card('completed', { reference: '#319', customer: 'Wasswa Hardware', place: 'Katwe', value: 118_000, lines: 1, h: 1, min: 15 }),
  card('completed', { reference: '#322', customer: 'Nabirye Stores', place: 'Katwe', value: 505_000, lines: 4, h: 0, min: 30 }),
  card('completed', { reference: '#325', customer: 'Tendo Hardware', place: 'Kisenyi', value: 190_000, lines: 1, h: 0, min: 12 }),

  earlier(286, 10, 40, 340_000, 'Lubega Traders', 'Industrial Area', 3),
  earlier(288, 10, 5, 1_120_000, 'Zzimwe Contractors', 'Bweyogerere', 8),
  earlier(291, 9, 35, 96_000, 'Kigongo Traders', 'Ndeeba', 1),
  earlier(293, 9, 10, 415_000, 'Byaruhanga Timber', 'Katwe', 3),
  earlier(296, 8, 45, 760_000, 'Kyambogo Works', 'Industrial Area', 5),
  earlier(298, 8, 20, 155_000, 'Ntale Hardware', 'Kisenyi', 1),
  earlier(301, 7, 50, 2_050_000, 'Mulongo Hardware', 'Industrial Area', 11),
  earlier(303, 7, 15, 128_000, 'Nakalema Stores', 'Nateete', 1),
  earlier(305, 6, 40, 580_000, 'Kirumira & Sons', 'Nateete', 4),
  earlier(307, 6, 5, 240_000, 'Jackson', 'Ndeeba', 2),
  earlier(309, 5, 25, 1_310_000, 'Ssendawula Sam', 'Trade Center', 7),
  earlier(310, 4, 50, 172_000, 'Namugongo Builders', 'Ndeeba', 2),
];

export const demoTrackedOrders = (): readonly TrackedOrder[] => [
  ...taken,
  ...buying,
  ...preparing,
  ...out,
  ...delivered,
];

/** Today's buying trip and delivery runs, as the dock states them. */
export const demoTrip = (): Trip => ({
  route: 'Industrial Area, then Ndeeba',
  stops: 2,
  carry: known(Money.money(2_180_000), 'the cash the buyer carries today'),
  runs: 2,
  overdue: 0,
});

/* ------------------------------ Waiting on you ---------------------------- */

/*
 * The queue used to live here as twenty hand-written sentences, and it was
 * cut rather than rewritten. `asksFor` in `@ow/domain` reads the same board
 * these cards make, so the example books and the shop's own books get their
 * queue from one place and the head of the screen can no longer say
 * `54 live · 20 need you` about two different readings.
 *
 * What was lost with it: five reasons the books do not record anywhere —
 * a client asking for an order to be split, a supplier quoting above the
 * price promised, a credit limit reached, a cost that changed on arrival,
 * and cash asked for up front. Those are real decisions and they are not
 * invented here again. Each needs a field the old app does not keep, and
 * a queue that states them from nothing is the mockup lying about the shop.
 */

