/**
 * What is worth telling the group about, from the real books.
 *
 * Three inputs, and the interesting one is the third:
 *
 *  - **the shelf and the price book** — the catalogue, already read;
 *  - **what has moved** — one pass over the invoiced orders, counting units
 *    by the same `stockKey` the shelf is kept under;
 *  - **the shop's own rules** — `deadStockDays`, `targetMarginPct` and the
 *    `clearance` map, all sitting in `app_settings.presets` and none of them
 *    read by anything until now. The shop had already said how long is dead
 *    and what margin it wants; the lens was drawing nothing beside it.
 *
 * The window is the shop's `deadStockDays`, not a number chosen here. `Idle`
 * means idle by the shop's own definition of the word.
 */

import {
  Money,
  known,
  stockKey,
  unavailable,
  type Derived,
  type Nominee,
  type Post,
  type PostingRules,
  nominations,
} from '@ow/domain';
import { readText } from './boundary.js';
import { readCatalogue } from './catalogue.js';
import { current } from './client.js';

export interface Posting {
  readonly posts: readonly Post[];
  /** How long the sales window was, in days — the shop's own figure. */
  readonly windowDays: number;
  /** Things on the shelf that nothing could be worked out about. */
  readonly unreadable: readonly string[];
}

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v !== null && typeof v !== 'object' && v !== '' && Number.isFinite(n) ? n : null;
};

/** What the shop has set, with the old app's own defaults where it has not. */
export function readRules(presets: unknown): PostingRules {
  const p = obj(presets);
  const cuts = new Map<string, { readonly price: Money.Money; readonly setOn: Date }>();

  for (const [key, raw] of Object.entries(obj(p?.clearance) ?? {})) {
    const one = obj(raw);
    const price = one === null ? null : num(one.price);
    const setOn = one === null ? null : readText(one.setOn);
    if (price === null || price <= 0) continue;
    const at = setOn === null ? null : new Date(setOn);
    cuts.set(key, {
      price: Money.money(Math.round(price)),
      // A cut with no date is still a cut. Dating it today rather than
      // dropping it: the price is the fact, and "how long ago" is the
      // decoration — but it must not read as older than it is.
      setOn: at === null || Number.isNaN(at.getTime()) ? new Date() : at,
    });
  }

  return {
    // The old app's own shipped defaults, for a shop that has set neither.
    deadAfterDays: num(p?.deadStockDays) ?? 60,
    targetMarginPercent: num(p?.targetMarginPct) ?? 10,
    cuts,
  };
}

/**
 * Units that left, by the key the shelf is kept under.
 *
 * Only INVOICED orders count. An order sitting in a lane has not left the
 * shop, and counting it as sold would make a thing look like it moves while
 * it is still on the shelf — which is the exact reading `idle-stock` is
 * trying to make.
 */
export function soldByKey(
  rows: readonly unknown[],
  from: Date,
): ReadonlyMap<string, number> {
  const since = from.toISOString().slice(0, 10);
  const sold = new Map<string, number>();

  for (const raw of rows) {
    const row = obj(raw);
    if (row === null || row.voided === true || row.invoiced !== true) continue;
    const on = readText(row.date);
    if (on === null || on < since) continue;

    for (const rawItem of arr(obj(row.payload)?.items)) {
      const item = obj(rawItem);
      const productId = item === null ? null : readText(item.productId);
      if (item === null || productId === null) continue;

      const idx = num(item.variantIdx);
      const key = stockKey(productId, idx);
      sold.set(key, (sold.get(key) ?? 0) + (num(item.qty) ?? 0));
    }
  }

  return sold;
}

/** The lens, for one shop. */
export async function readPosting(shopId: string, now: Date): Promise<Derived<Posting>> {
  const { sb } = current();

  const catalogue = await readCatalogue(shopId);
  if (catalogue.status === 'unavailable') {
    return unavailable(`what is worth posting: ${catalogue.reason}`);
  }

  const [settings, quotes] = await Promise.all([
    sb.from('app_settings').select('presets').eq('shop_id', shopId).maybeSingle(),
    sb.from('saved_quotes').select('date, invoiced, voided, payload').eq('shop_id', shopId),
  ]);

  if (quotes.error !== null) {
    return unavailable(`what has sold: ${quotes.error.message}`);
  }

  const rules = readRules((settings.data as { readonly presets?: unknown } | null)?.presets ?? null);
  const from = new Date(now.getTime() - rules.deadAfterDays * 86_400_000);
  const sold = soldByKey(quotes.data, from);

  const unreadable: string[] = [];
  const nominees: Nominee[] = [];

  for (const thing of catalogue.value.sellables) {
    const key = stockKey(thing.productId, thing.variantIdx);
    // A thing with no price and nothing on the shelf cannot be nominated
    // for anything, and there are hundreds of them. Silence, not a note.
    if (thing.prices.length === 0 && thing.lots.length === 0) continue;

    nominees.push({
      key,
      code: thing.code,
      name: thing.name,
      unit: thing.prices[0]?.unit ?? '',
      prices: thing.prices,
      lots: thing.lots,
      counted: thing.counted,
      markups: thing.markups,
      soldInWindow: sold.get(key) ?? 0,
      windowDays: rules.deadAfterDays,
    });
  }

  const posts = nominations(nominees, rules, now);

  return known(
    { posts, windowDays: rules.deadAfterDays, unreadable },
    `${posts.length} worth posting, out of ${nominees.length} the shop could say something about`,
  );
}
