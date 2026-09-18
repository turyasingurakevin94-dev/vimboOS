import { describe, expect, it } from 'vitest';
import { asId } from './ids.js';
import * as Money from './money.js';
import {
  chargeAmount,
  clientPays,
  goodsTotal,
  costsYou,
  keepPercent,
  keepTone,
  lineCost,
  lineKeep,
  lineKeepPercent,
  lineTotal,
  shortfalls,
  totalSaving,
  youKeep,
  type ChargeLine,
  type ItemLine,
  type QuoteLine,
} from './quote.js';
import { known, unavailable } from './derived.js';

const item = (over: Partial<ItemLine> = {}): ItemLine => ({
  kind: 'item',
  id: asId('v1'),
  name: 'Iron sheets G28',
  unit: 'Pcs',
  qty: 1,
  priceEach: Money.money(29_000),
  inStock: 4,
  buyFrom: 'Kampala Steel',
  source: {
    productId: 'P077',
    variantIdx: null,
    supplierId: 'S012',
    packUnit: '',
    packQty: 0,
    countedIn: 'unit',
  },
  buyAt: known(Money.money(27_500), 'the last invoice'),
  ...over,
});

const charge = (over: Partial<ChargeLine> = {}): ChargeLine => ({
  kind: 'charge',
  id: 'transport',
  name: 'Transport',
  basis: 'charge',
  rule: { type: 'fixed', value: 60_000 },
  service: 'Transport',
  cost: null,
  ...over,
});

describe('what a line is worth', () => {
  it('multiplies an item out', () => {
    expect(lineTotal(item({ qty: 2, priceEach: Money.money(105_000) }))).toBe(210_000);
  });

  it('takes a charge at its amount', () => {
    expect(lineTotal(charge())).toBe(60_000);
  });

  /**
   * This test used to assert the opposite, and it was wrong in the
   * direction that flatters the shop.
   *
   * What a charge costs the shop is a PAYMENT, not a figure somebody typed:
   * a delivery costs what the driver was handed, and that leaves the till
   * later. Read as a known zero, a 5,000 delivery on a 7,050 order reported
   * `you keep 5,150` — 73% — on an order where most of the fee is about to
   * walk out of the door. It reads `at most 5,150` now, which is the same
   * money and a different claim.
   */
  it('cannot cost a charge nobody has paid out on yet', () => {
    const cost = lineCost(charge());
    expect(cost.status).toBe('partial');
    expect(cost.status !== 'unavailable' && cost.value).toBe(0);
    expect(cost.status === 'partial' ? cost.missing : '').toContain('not recorded until it is paid');
  });

  it('costs a charge at what it actually cost, once that is recorded', () => {
    const paid = lineCost(charge({ cost: Money.money(18_000) }));
    expect(paid.status).toBe('known');
    expect(paid.status === 'known' ? paid.value : 0).toBe(18_000);
  });

  /** Credit terms cost the shop nothing to hand over, and really are zero. */
  it('keeps the whole of a charge that genuinely costs nothing', () => {
    const free = charge({ cost: Money.money(0) });
    expect(lineKeep(free)).toMatchObject({ status: 'known', value: 60_000 });
    expect(lineKeepPercent(free)).toMatchObject({ value: 100 });
  });

  it('cannot cost an item nobody has bought yet', () => {
    const line = item({ buyAt: unavailable('never purchased') });
    expect(lineCost(line).status).toBe('unavailable');
    expect(lineKeep(line).status).toBe('unavailable');
    // And the line total is still perfectly knowable — it is what was typed.
    expect(lineTotal(line)).toBe(29_000);
  });
});

describe('what the quote is worth', () => {
  const lines: readonly QuoteLine[] = [
    item({ qty: 1, priceEach: Money.money(265_000), buyAt: known(Money.money(250_000), 'x') }),
    item({ qty: 2, priceEach: Money.money(105_000), buyAt: known(Money.money(95_000), 'x') }),
    item({ qty: 1, priceEach: Money.money(29_000), buyAt: known(Money.money(27_500), 'x') }),
    charge(),
    charge({ id: 'credit', name: 'Credit terms', rule: { type: 'percent', value: 3 } }),
  ];

  /**
   * These are frame 4a's five lines, to the shilling — and the dock's own
   * figures do not follow from them.
   *
   * 4a, 4b and 4d all draw the same table and all three docks read
   * `Client pays 519,120` and `You keep 51,620`. The lines add to **579,120**.
   * The difference is 60,000 — exactly the Transport charge, which is drawn
   * in the table with a line total of 60,000 and is one of the "5 lines" the
   * dock counts. 519,120 is the items (504,000) plus credit terms (3% of
   * 504,000 = 15,120) and no transport, so the totals were worked out before
   * that line was added.
   *
   * The cost column is right: 250,000 + 190,000 + 27,500 = 467,500. So the
   * kept figure is 579,120 − 467,500 = **111,620**, not 51,620, and the share
   * is 19%, not 10%.
   *
   * The app adds its lines up. A dock that disagrees with the table above it
   * is the exact defect this rewrite exists to remove — and this is flagged
   * to the owner rather than papered over, because if the intent is that
   * transport is not charged to the client, the fix belongs in the table, not
   * in the total.
   */
  /**
   * The figures are the mockup's, to the shilling. What changed is the
   * CONFIDENCE: the transport on this quote has not been paid out, so the
   * cost column is `at least 467,500` and the margin `at most 111,620`.
   * 467,500 read as the whole column was the shop being told a delivery is
   * free until the driver is paid.
   */
  it('adds its own lines up, whatever the mockup dock says', () => {
    expect(clientPays(lines)).toBe(579_120);
    expect(costsYou(lines)).toMatchObject({ status: 'partial', value: 467_500 });
    expect(youKeep(lines)).toMatchObject({ status: 'partial', value: 111_620 });
    expect(keepPercent(lines)).toMatchObject({ status: 'partial', value: 19 });
  });

  it("reconstructs the mockup's 519,120 from the lines it actually summed", () => {
    // Not a curiosity: it is the evidence that the dock is one line short
    // rather than the table being wrong, and it fails the moment either the
    // line figures or the credit-terms rule move.
    const withoutTransport = lines.filter((l) => l.kind !== 'charge' || l.id !== 'transport');
    expect(clientPays(withoutTransport)).toBe(519_120);
    expect(youKeep(withoutTransport)).toMatchObject({ value: 51_620 });
    expect(keepPercent(withoutTransport)).toMatchObject({ value: 10 });
  });

  it('turns the whole total PARTIAL when one cost is missing', () => {
    // Doubt is contagious. The figure is still real money — it just is not
    // the whole column, and the dock has to be able to say which line is out.
    const gapped = [...lines, item({ name: 'New thing', buyAt: unavailable('never purchased') })];
    const cost = costsYou(gapped);
    expect(cost.status).toBe('partial');
    expect(cost.status === 'partial' && cost.missing).toContain('never purchased');
    expect(youKeep(gapped).status).toBe('partial');
    expect(keepPercent(gapped).status).toBe('partial');
  });

  it('does not divide by an empty quote', () => {
    expect(keepPercent([])).toMatchObject({ status: 'partial', value: 0 });
    expect(clientPays([])).toBe(0);
  });
});

describe('the kept share reads by its own boundary', () => {
  // Frame 4a: 10% green, 6% and 5% amber. Nothing kept is not a thin margin,
  // it is working for free.
  it.each([
    [10, 'good'],
    [31, 'good'],
    [9, 'warn'],
    [5, 'warn'],
    [1, 'warn'],
    [0, 'bad'],
    [-4, 'bad'],
  ])('reads %i%% as %s', (pc, tone) => {
    expect(keepTone(pc)).toBe(tone);
  });
});

describe('what the shelf cannot cover', () => {
  it('counts only the lines that are genuinely short', () => {
    const out = shortfalls([
      item({ name: 'Covered', qty: 1, inStock: 4 }),
      item({ name: 'Exactly enough', qty: 4, inStock: 4 }),
      item({ name: 'Short', qty: 3, inStock: 1 }),
      charge(),
    ]);
    expect(out.map((s) => [s.line.name, s.short])).toEqual([['Short', 2]]);
  });
});

describe('what switching suppliers would save', () => {
  it('multiplies each saving by its quantity', () => {
    const saved = totalSaving([
      item({ qty: 2, cheaperElsewhere: { supplier: 'Shafik Katwe', saves: Money.money(500) } }),
      item({ name: 'no cheaper option' }),
    ]);
    expect(saved).toMatchObject({ status: 'known', value: 1000 });
  });

  it('is nothing at all when no line has an alternative', () => {
    expect(totalSaving([item(), charge()])).toMatchObject({ status: 'known', value: 0 });
  });
});

describe('a charge carries its rule, not its shillings', () => {
  const goods = [
    item({ qty: 1, priceEach: Money.money(265_000), buyAt: known(Money.money(250_000), 'x') }),
    item({ qty: 2, priceEach: Money.money(105_000), buyAt: known(Money.money(95_000), 'x') }),
    item({ qty: 1, priceEach: Money.money(29_000), buyAt: known(Money.money(27_500), 'x') }),
  ];
  const credit = charge({
    id: 'credit',
    name: 'Credit terms',
    rule: { type: 'percent', value: 3 },
    service: null,
  });

  it('is a percent of the goods, and only of the goods', () => {
    expect(goodsTotal(goods)).toBe(504_000);
    expect(chargeAmount(credit, goodsTotal(goods))).toBe(15_120);
  });

  /**
   * The whole reason it is a rule. Frozen at the moment it was tapped, the
   * document goes on printing `3%` beside a figure that is three per cent of
   * something that is no longer on it.
   */
  it('moves when a line is added under it', () => {
    const more = [...goods, item({ qty: 1, priceEach: Money.money(96_000) }), credit];

    expect(goodsTotal(more)).toBe(600_000);
    expect(chargeAmount(credit, goodsTotal(more))).toBe(18_000);
    expect(clientPays(more)).toBe(618_000);
  });

  /**
   * Compounding settled without a rule about ordering: every percent
   * resolves against the goods, so two of them come to the same total
   * whichever was tapped first.
   */
  it('never charges a percent on another percent', () => {
    const also = charge({ id: 'urgent', name: 'Urgent', rule: { type: 'percent', value: 5 } });
    const oneWay = [...goods, credit, also];
    const other = [...goods, also, credit];

    expect(clientPays(oneWay)).toBe(clientPays(other));
    // 504,000 + 3% + 5% of the GOODS, not of each other.
    expect(clientPays(oneWay)).toBe(504_000 + 15_120 + 25_200);
  });

  /** A charge is money the shop is owed, and a discount is not one. */
  it('comes to nothing at zero or less', () => {
    const on = Money.money(504_000);
    expect(chargeAmount(charge({ rule: { type: 'fixed', value: 0 } }), on)).toBe(0);
    expect(chargeAmount(charge({ rule: { type: 'percent', value: -5 } }), on)).toBe(0);
  });
});
