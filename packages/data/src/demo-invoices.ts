/**
 * The ledgers frame 1b draws, in the shape a live query will return.
 *
 * Nothing here is a total: the band's four figures, every row's balance and
 * every paid-off share are DERIVED from these by `readBand` and friends.
 * That is the handoff's rule — one reckoning, read twice — and hardcoding a
 * band figure here would be the exact drift it exists to prevent.
 *
 * The frame draws six of eighteen open sales and six of nine unpaid
 * purchases, so the counts and totals below are the full set; the screen
 * shows what fits and says how many there are.
 */

import { Money, type PurchaseInvoice, type SalesInvoice } from '@ow/domain';

const m = Money.money;

/** 15 September 2026, the day every frame in every handoff is drawn on. */
export const DEMO_TODAY = new Date('2026-09-15T07:42:00Z');

const day = (offset: number): Date => new Date(DEMO_TODAY.getTime() + offset * 86_400_000);

const took = (
  id: string,
  amount: number | Money.Money,
  ago: number,
): SalesInvoice['payments'][number] => ({
  id,
  on: day(-ago),
  amount: m(amount),
  method: 'Cash',
  account: 'Cash · shop till',
  takenBy: 'Kevin',
});

export function demoSalesInvoices(): readonly SalesInvoice[] {
  const s = (
    doc: string,
    customer: string,
    total: number,
    issuedAgo: number,
    paid: number,
    termDays = 14,
  ): SalesInvoice => ({
    kind: 'sale',
    doc,
    customer,
    total: m(total),
    issued: day(-issuedAgo),
    dueOn: day(-issuedAgo + termDays),
    payments: paid > 0 ? [took(`${doc}-1`, paid, Math.max(0, issuedAgo - 2))] : [],
  });

  return [
    s('INV-0175', 'Ken Bwaise', 465_000, 29, 300_000),
    s('INV-0209', 'Ken Bwaise', 740_000, 21, 700_000),
    s('INV-0218', 'Ken Bwaise', 485_000, 21, 345_000, 30),
    s('INV-0230', 'Joan JEZONA', 1_770_000, 20, 1_700_000, 30),
    s('INV-0287', 'Shadia', 615_000, 12, 610_000, 30),
    s('INV-0363', 'Innocent', 310_000, 0, 0, 14),
    // The twelve the frame does not have room for. They are here because the
    // band counts eighteen and says 6,614,000, and a screen that showed six
    // rows over a total of six rows would be telling a different truth.
    s('INV-0301', 'Mulongo Hardware', 820_000, 9, 0, 30),
    s('INV-0309', 'Nakawa Traders', 1_240_000, 8, 400_000, 30),
    s('INV-0318', 'Shafik Katwe', 390_000, 7, 0, 30),
    s('INV-0322', 'Joan JEZONA', 655_000, 6, 300_000, 30),
    s('INV-0330', 'Innocent', 480_000, 5, 200_000, 30),
    s('INV-0337', 'Ken Bwaise', 1_100_000, 5, 900_000, 30),
    s('INV-0341', 'Shadia', 275_000, 4, 0, 30),
    s('INV-0344', 'Nakawa Traders', 960_000, 3, 500_000, 30),
    s('INV-0349', 'Mulongo Hardware', 540_000, 3, 200_000, 30),
    s('INV-0352', 'Shafik Katwe', 705_000, 2, 305_000, 30),
    s('INV-0358', 'Joan JEZONA', 815_000, 1, 0, 30),
    s('INV-0361', 'Innocent', 1_009_000, 1, 300_000, 30),
    ...settledTail(),
  ];
}

/**
 * The 141 invoices of the last thirty days that are already paid off.
 *
 * They are here because the band counts **159 invoices, 90,417,995, 93%
 * received** — and those figures have to DERIVE. A screen that showed
 * eighteen rows over a total of eighteen would be telling a different truth
 * from the one the frame tells, and the moment a band figure is typed by
 * hand rather than summed it starts drifting from the rows beneath it.
 *
 * The frame's own arithmetic is exact, which is how the target was found:
 * 90,417,995 invoiced less 83,803,995 received is the 6,614,000 owed, and
 * 83,803,995 over 90,417,995 is 92.68% — the 93% it draws.
 *
 * `Money.allocate` splits the remainder a shilling at a time, so the 141
 * totals sum back to exactly 77,043,995 rather than to a rounded
 * approximation of it.
 */
const SETTLED_COUNT = 141;
const SETTLED_TOTAL = 77_043_995;
const REGULARS = [
  'Ken Bwaise',
  'Joan JEZONA',
  'Shadia',
  'Innocent',
  'Nakawa Traders',
  'Mulongo Hardware',
  'Shafik Katwe',
] as const;

/**
 * How many invoices were finished on each of the past days, newest first.
 *
 * Hand-varied on purpose. The first version spread 141 invoices evenly with
 * `i % 27` and split the total with `allocate`, so the phone's settled group
 * drew six identical rows — "6 invoices · 3,278,468" over and over. Demo
 * data that is obviously generated stops the screen being judged: a reviewer
 * reads the repetition instead of the design. Real trading days differ.
 */
const PER_DAY = [9, 4, 7, 3, 11, 5, 8, 2, 6, 10, 4, 7, 5, 9, 3, 6, 8, 4, 11, 5, 7, 3, 9, 6];

/** The day each settled invoice was finished, as whole days before today. */
function settledDayOffsets(): readonly number[] {
  const out: number[] = [];
  for (const [d, n] of PER_DAY.entries()) {
    for (let k = 0; k < n && out.length < SETTLED_COUNT; k += 1) out.push(d + 1);
  }
  // Any remainder lands on the oldest day rather than being dropped — the
  // count has to stay 141, because the band derives from it.
  while (out.length < SETTLED_COUNT) out.push(PER_DAY.length + 1);
  return out;
}

function settledTail(): readonly SalesInvoice[] {
  const offsets = settledDayOffsets();
  // `allocateBy` keeps the sum EXACT while letting the invoices differ in
  // size — odd shillings go to the largest weights, so 141 varied totals
  // still come to 77,043,995 to the shilling.
  const weights = offsets.map((_, i) => ((i * 13) % 17) + 6);

  return Money.allocateBy(m(SETTLED_TOTAL), weights).map((total, i) => {
    const paidAgo = offsets[i] ?? 1;
    const issuedAgo = paidAgo + 3 + (i % 9);
    const doc = `INV-${String(100 + i).padStart(4, '0')}`;
    return {
      kind: 'sale' as const,
      doc,
      customer: REGULARS[i % REGULARS.length] ?? 'Ken Bwaise',
      total,
      issued: day(-issuedAgo),
      dueOn: day(-issuedAgo + 30),
      payments: [took(`${doc}-1`, total, paidAgo)],
    };
  });
}

export function demoPurchaseInvoices(): readonly PurchaseInvoice[] {
  const p = (
    doc: string,
    supplier: string,
    total: number,
    paid: number,
    forSale: string | null,
    dueIn: number | null,
  ): PurchaseInvoice => ({
    kind: 'purchase',
    doc,
    supplier,
    total: m(total),
    paid: m(paid),
    dueOn: dueIn === null ? null : day(dueIn),
    forSale,
  });

  return [
    p('PINV-0099', 'Karddia Hardware', 220_000, 220_000, 'INV-0175', -3),
    p('PINV-0098', 'Mukwano Steel', 95_000, 0, 'INV-0175', 0),
    p('PINV-0301', 'Karddia Hardware', 210_000, 0, 'INV-0363', 6),
    p('PINV-0296', 'Mukwano Steel', 640_000, 0, 'INV-0344', 4),
    // Stock bought on the shop's own account. The ledger writes that out
    // rather than leaving the cell blank, because blank reads as missing.
    p('PINV-0289', 'Nsambya Cement', 1_120_000, 0, null, 9),
    {
      ...p('PINV-0255', 'Karddia Hardware', 180_000, 0, 'INV-0175', null),
      voided: { replacedBy: 'PINV-0256', on: day(-6) },
    },
    p('PINV-0256', 'Karddia Hardware', 180_000, 0, 'INV-0175', 11),
    p('PINV-0271', 'Mukwano Steel', 415_000, 0, 'INV-0309', 8),
    p('PINV-0280', 'Nsambya Cement', 204_300, 0, 'INV-0322', 12),
    p('PINV-0284', 'Karddia Hardware', 140_000, 0, 'INV-0337', 15),
    // Due today, with PINV-0098 — the band counts two.
    p('PINV-0292', 'Mukwano Steel', 100_000, 0, 'INV-0344', 0),
  ];
}
