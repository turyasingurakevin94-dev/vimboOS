/**
 * Demonstration orders, in the exact shape the live query returns.
 *
 * This sits in the data layer rather than in either design, because it is
 * standing in for `ordersForBoard()` — when that lands, both screens change
 * one import and nothing else. Putting it in a design would also have meant
 * writing it twice, and duplicating *data* is not what the two-designs law
 * asks for; duplicating *design* is.
 *
 * The awkward cases are deliberate, and each one is a thing the old app got
 * wrong on a real morning:
 *   · an order with no supplier cost, so its margin cannot be derived;
 *   · an order with no date on it, so it cannot be chased on time;
 *   · an order whose value is unreadable because the quote is still out;
 *   · a customer name longer than any column anyone would draw for it.
 */

import {
  Money,
  known,
  partial,
  unavailable,
  type Order,
} from '@ow/domain';

const m = Money.money;
const hoursAgo = (now: Date, h: number): Date => new Date(now.getTime() - h * 3_600_000);

export function demoOrders(now: Date): readonly Order[] {
  const ago = (h: number): Date => hoursAgo(now, h);

  return [
    {
      id: '2291',
      reference: 'OW-2291',
      customer: 'Ssekitoleko Hardware & General Supplies',
      summary: 'Iron sheets — G28, 3m box profile ×40',
      stage: 'preparing',
      since: ago(41),
      value: known(m(3_120_000), 'order total'),
      cost: known(m(2_480_000), 'Kikuubo Metals invoice'),
      unreadable: [],
    },
    {
      id: '2294',
      reference: 'OW-2294',
      customer: 'Kato Construction Ltd',
      summary: 'Cement ×120, roofing nails ×8 boxes',
      stage: 'preparing',
      since: ago(4),
      value: known(m(1_845_000), 'order total'),
      cost: known(m(1_502_000), 'Mukwano invoice'),
      unreadable: [],
    },
    {
      id: '2295',
      reference: 'OW-2295',
      customer: 'Nabukenya Stores',
      summary: 'Binding wire ×15 rolls',
      stage: 'pending_delivery',
      since: ago(2),
      value: known(m(412_500), 'order total'),
      // Delivered goods, invoice not in yet. Margin is unavailable, not 100%.
      cost: unavailable<Money.Money>('no invoice yet'),
      unreadable: [],
    },
    {
      id: '2296',
      reference: 'OW-2296',
      customer: 'Mulongo Hardware',
      summary: 'Roofing nails ×6 boxes',
      stage: 'draft',
      since: ago(3),
      // The quote is still out with the supplier, so there is no value yet.
      value: unavailable<Money.Money>('awaiting quote'),
      cost: unavailable<Money.Money>('awaiting quote'),
      unreadable: [],
    },
    {
      id: '2297',
      reference: 'OW-2297',
      customer: 'Bugolobi Site Works',
      summary: 'Steel bars — Y12 ×60, Y16 ×20',
      stage: 'awaiting_goods',
      since: ago(73),
      value: known(m(5_460_000), 'order total'),
      cost: known(m(4_690_000), 'Kikuubo Metals invoice'),
      unreadable: [],
    },
    {
      id: '2298',
      reference: 'OW-2298',
      customer: 'Nakawa Traders',
      summary: 'Cement ×40',
      stage: 'awaiting_goods',
      since: ago(9),
      value: known(m(1_240_000), 'order total'),
      cost: known(m(1_010_000), 'Mukwano invoice'),
      unreadable: [],
    },
    {
      id: '2299',
      reference: 'OW-2299',
      customer: 'Kireka Builders',
      summary: 'Iron sheets — G30 ×25, ridges ×6',
      stage: 'draft',
      // No date on it. Not fine, not late — unknown, and the board says so.
      since: null,
      value: known(m(1_980_000), 'order total'),
      cost: unavailable<Money.Money>('no invoice yet'),
      unreadable: [],
    },
    {
      id: '2288',
      reference: 'OW-2288',
      customer: 'Ntinda Hardware',
      summary: 'Nails ×12 boxes, binding wire ×8 rolls',
      stage: 'completed',
      since: ago(5),
      value: known(m(892_000), 'order total'),
      cost: known(m(701_000), 'Mukwano invoice'),
      unreadable: [],
    },
    {
      id: '2289',
      reference: 'OW-2289',
      customer: 'Seeta Estates',
      summary: 'Cement ×200, sand — 2 trips',
      stage: 'completed',
      since: ago(7),
      value: partial(m(6_400_000), 'order total', 'the sand line has no price on it'),
      cost: known(m(5_180_000), 'Mukwano + haulage'),
      unreadable: ['the sand line has no price on it'],
    },
    {
      id: '2290',
      reference: 'OW-2290',
      customer: 'Kyaliwajjala Depot',
      summary: 'Iron sheets — G28 ×30',
      stage: 'pending_delivery',
      since: ago(29),
      value: known(m(2_340_000), 'order total'),
      cost: known(m(1_920_000), 'Kikuubo Metals invoice'),
      unreadable: [],
    },
  ];
}

/** How long the last handful of orders took, end to end. */
export const demoCompletionHours = (): readonly { readonly hours: number }[] => [
  { hours: 31 },
  { hours: 44 },
  { hours: 28 },
  { hours: 52 },
  { hours: 36 },
  { hours: 220 },
];
