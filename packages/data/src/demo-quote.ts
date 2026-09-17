/**
 * The quote frame 4a draws, in the shape a live query will return.
 *
 * Every figure here is the handoff's, to the shilling — including the two
 * that make the mockup's own dock disagree with its table. See the comment on
 * `quote.test.ts`: the three item lines and two charges add to 579,120 while
 * all three frames' docks read 519,120, short by exactly the Transport
 * charge. The lines are drawn; the dock was worked out before Transport was
 * added. This file keeps the drawn lines and lets the app add them up.
 *
 * It sits in the data layer rather than in either design, because it stands
 * in for a query. Duplicating *data* is not what the two-designs law asks
 * for; duplicating *design* is.
 */

import { Money, asId, known, type Quote } from '@ow/domain';

const m = Money.money;

export function demoQuote(): Quote {
  return {
    date: '15 Sep 2026',
    client: {
      id: asId('c-jackson'),
      name: 'Jackson Mubiru',
      phone: '0772 481 330',
      orders: 12,
      owesNow: Money.ZERO,
      lastOrder: { total: m(230_000), when: 'yesterday' },
    },
    lines: [
      {
        kind: 'item',
        id: asId('v-mulper'),
        name: 'Soft Close Mulper — Half Bend',
        unit: 'Ctn',
        qty: 1,
        priceEach: m(265_000),
        inStock: 4,
        buyFrom: 'Roto Industry',
        buyAt: known(m(250_000), 'the last invoice, 2 Sept'),
      },
      {
        kind: 'item',
        id: asId('v-bowsaw'),
        name: 'G‑MAN Bow Saw 24"',
        unit: 'Bdl',
        qty: 2,
        priceEach: m(105_000),
        inStock: 18,
        buyFrom: 'Mulongo Hardware',
        buyAt: known(m(95_000), 'the last invoice, 28 Aug'),
        cheaperElsewhere: { supplier: 'Shafik Katwe', saves: m(500) },
      },
      {
        kind: 'item',
        id: asId('v-g28'),
        name: 'Iron sheets G28 · 3m box profile',
        unit: 'Pcs',
        qty: 1,
        priceEach: m(29_000),
        inStock: 0,
        buyFrom: 'Kampala Steel',
        buyAt: known(m(27_500), 'the last invoice, 20 July'),
      },
      { kind: 'charge', id: 'transport', name: 'Transport', basis: 'charge', amount: m(60_000) },
      {
        kind: 'charge',
        id: 'credit',
        name: 'Credit terms',
        basis: '+3% on 30 days',
        amount: m(15_120),
      },
    ],
  };
}

/** What this client usually buys, for the chip row under the add-item field. */
export const usuallyBuys: readonly { readonly name: string; readonly rate: string }[] = [
  { name: 'Black screws 8"', rate: '7 Box' },
  { name: 'Iron sheets G28', rate: '12 Pcs' },
  { name: 'Hinges 100mm', rate: '4 Ctn' },
];

/** The three charges that are added often enough to be one tap. */
export const commonCharges: readonly { readonly name: string; readonly rate: string }[] = [
  { name: 'Delivery', rate: '60,000' },
  { name: 'Urgent', rate: '5%' },
  { name: 'On credit', rate: '+3%' },
];

/** What is bought alongside these lines, and how often. */
export const goesWithIt: readonly { readonly name: string; readonly rate: string }[] = [
  { name: 'Roofing nails 2.5"', rate: '4 of 5 orders' },
  { name: 'Ridge caps', rate: '3 of 5' },
];

/** The client's previous order, line by line. */
export const lastOrder = {
  when: '14 Sept',
  lines: [
    { name: 'Soft Close Mulper · 1 Ctn', total: m(125_000) },
    { name: 'Black screws 8" · 7 Box', total: m(105_000) },
  ],
} as const;
