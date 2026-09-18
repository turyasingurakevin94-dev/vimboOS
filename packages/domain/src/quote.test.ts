import { describe, expect, it } from 'vitest';
import { asId } from './ids.js';
import * as Money from './money.js';
import {
  clientPays,
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
  amount: Money.money(60_000),
  ...over,
});

describe('what a line is worth', () => {
  it('multiplies an item out', () => {
    expect(lineTotal(item({ qty: 2, priceEach: Money.money(105_000) }))).toBe(210_000);
  });

  it('takes a charge at its amount', () => {
    expect(lineTotal(charge())).toBe(60_000);
  });

  it('costs a charge NOTHING — and that is a known zero, not a gap', () => {
    const cost = lineCost(charge());
    expect(cost.status).toBe('known');
    expect(cost.status !== 'unavailable' && cost.value).toBe(0);
  });

  it('keeps the whole of a charge, which is why its column reads "all"', () => {
    const keep = lineKeep(charge());
    expect(keep.status !== 'unavailable' && keep.value).toBe(60_000);
    expect(lineKeepPercent(charge())).toMatchObject({ value: 100 });
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
    charge({ id: 'credit', name: 'Credit terms', amount: Money.money(15_120) }),
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
  it('adds its own lines up, whatever the mockup dock says', () => {
    expect(clientPays(lines)).toBe(579_120);
    expect(costsYou(lines)).toMatchObject({ status: 'known', value: 467_500 });
    expect(youKeep(lines)).toMatchObject({ status: 'known', value: 111_620 });
    expect(keepPercent(lines)).toMatchObject({ status: 'known', value: 19 });
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
