/**
 * What the shop sells, from the real books.
 *
 * Four tables and one jsonb column, and the shapes matter:
 *
 * | what | where |
 * | --- | --- |
 * | the thing | `products`, with `variants[]` for a variable one |
 * | what each supplier charges | `prices`, one row per product × variant × supplier |
 * | volume breaks | `prices.tiers`, `[{minQty, price}]` |
 * | how many are on the shelf | `stock.qty`, keyed `P073::3` |
 * | what those cost | `stock_lots`, same key, oldest first |
 *
 * **`prices.variant_idx` is TEXT.** It holds `"1"`, not `1`, and a simple
 * product's rows hold null. Comparing it to a number finds nothing, and
 * finding nothing here means a product with three suppliers reads as
 * unpriced — which the picker would then show as "no price on file" and
 * somebody would quote from memory.
 *
 * Nothing here is priced or ranked. Those are `@ow/domain/catalogue`, which
 * is the old app's rules ported with its own bug cases as tests.
 */

import {
  known,
  stockKey,
  unavailable,
  type Derived,
  type Lot,
  type PriceRow,
  type Tier,
} from '@ow/domain';
import { readText } from './boundary.js';
import { current } from './client.js';

/** A thing the shop sells, and the variants of it where there are any. */
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  readonly notes: string;
  /** The words nobody thinks to put in a name: `the 90 litre one`. */
  readonly description: string;
  /** Empty for a simple product; one entry per variant otherwise. */
  readonly variants: readonly Variant[];
  readonly image: string | null;
}

export interface Variant {
  /** Its position, which is what stock and prices are keyed by. */
  readonly idx: number;
  /** `HALFBEND`, where the shop set one. */
  readonly sku: string | null;
  /** `Half Bend` — the attribute values, joined as the shop reads them. */
  readonly label: string;
  readonly image: string | null;
}

/** One sellable thing: a product, or one variant of one. */
export interface Sellable {
  readonly productId: string;
  readonly variantIdx: number | null;
  /** `Soft Close Mulper — Half Bend`. */
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  /** Everything else a person might type to find it, lower case. */
  readonly findBy: string;
  /** `P044`, or the variant's sku, or `P044-2`. */
  readonly code: string;
  readonly image: string | null;
  readonly prices: readonly PriceRow[];
  readonly lots: readonly Lot[];
  /** What the shelf count says, which is not always the lots' sum. */
  readonly counted: number;
}

export interface Catalogue {
  readonly sellables: readonly Sellable[];
  /** Rows that were read and could not be understood, in words. */
  readonly unreadable: readonly string[];
}

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v !== null && typeof v !== 'object' && v !== '' && Number.isFinite(n) ? n : null;
};

/**
 * A variant index, whichever way the books wrote it down.
 *
 * `prices.variant_idx` is a TEXT column holding `"1"`; `stock.variant_idx`
 * is text too; a product's variants are positions in an array. One reader,
 * so a number and its own string cannot disagree about which variant they
 * mean.
 */
export const variantIndex = (v: unknown): number | null => {
  // A number as well as its own string: `readText` rejects a number, which
  // is right for a name and wrong here. This column is text on `prices`
  // today and the function's whole job is to not care.
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

/** `Half Bend`, from the attribute values the shop set. */
export const variantLabel = (combo: unknown): string =>
  Object.values(obj(combo) ?? {})
    .map((v) => readText(v))
    .filter((v): v is string => v !== null)
    .join(' · ');

/** One `products` row, as a product — or null with a reason. */
export function toProduct(raw: unknown): {
  readonly product: Product | null;
  readonly why: string | null;
} {
  const row = obj(raw);
  const id = row === null ? null : readText(row.id);
  if (row === null || id === null) return { product: null, why: 'a product has no id' };

  const name = readText(row.name);
  if (name === null) return { product: null, why: `${id} has no name` };

  const variants = arr(row.variants).map((raw_, idx): Variant => {
    const v = obj(raw_);
    return {
      idx,
      sku: v === null ? null : readText(v.sku),
      label: v === null ? '' : variantLabel(v.combo),
      image: v === null ? null : readText(v.image),
    };
  });

  return {
    why: null,
    product: {
      id,
      name,
      category: readText(row.category) ?? '',
      subcategory: readText(row.subcategory) ?? '',
      notes: readText(row.notes) ?? '',
      description: readText(row.short_description) ?? '',
      variants,
      image: readText(row.image),
    },
  };
}

/** One `prices` row, as a price — or null where it names no supplier. */
export function toPriceRow(raw: unknown, supplierNames: ReadonlyMap<string, string>): PriceRow | null {
  const row = obj(raw);
  const supplierId = row === null ? null : readText(row.supplier_id);
  if (row === null || supplierId === null) return null;

  const tiers: Tier[] = [];
  for (const t of arr(row.tiers)) {
    const tier = obj(t);
    const minQty = tier === null ? null : num(tier.minQty);
    if (minQty === null) continue;
    tiers.push({ minQty, price: tier === null ? null : num(tier.price) });
  }

  return {
    supplierId,
    supplierName: supplierNames.get(supplierId) ?? supplierId,
    wholesale: num(row.wholesale),
    retail: num(row.retail),
    unit: readText(row.unit) ?? '',
    packUnit: readText(row.pack_unit) ?? '',
    packQty: num(row.pack_qty) ?? 0,
    tiers,
    outOfStock: row.out_of_stock === true,
    outOfStockSince: readText(row.out_of_stock_since),
    on: readText(row.date),
    // The code the supplier's own quote uses. It lives on the price row
    // rather than on the product, so a search that only walked products
    // could not see it — and a code is written down precisely so it can be
    // typed back in.
    supplierSku: readText(row.supplier_sku),
  };
}

/** Everything the shop sells, one entry per thing that can go on a line. */
export function assembleCatalogue(
  productRows: readonly unknown[],
  priceRows: readonly unknown[],
  stockRows: readonly unknown[],
  lotRows: readonly unknown[],
  supplierRows: readonly unknown[],
): Catalogue {
  const unreadable: string[] = [];

  const supplierNames = new Map<string, string>();
  for (const raw of supplierRows) {
    const s = obj(raw);
    const id = s === null ? null : readText(s.id);
    if (s !== null && id !== null) supplierNames.set(id, readText(s.name) ?? id);
  }

  // Keyed the way the shelf is keyed, so a price, a count and a lot for one
  // variant all meet under one string rather than under three notions of
  // what "variant 1" means.
  const pricesAt = new Map<string, PriceRow[]>();
  for (const raw of priceRows) {
    const r = obj(raw);
    const productId = r === null ? null : readText(r.product_id);
    if (r === null || productId === null) continue;

    const price = toPriceRow(raw, supplierNames);
    if (price === null) continue;

    const key = stockKey(productId, variantIndex(r.variant_idx));
    const at = pricesAt.get(key) ?? [];
    at.push(price);
    pricesAt.set(key, at);
  }

  const countAt = new Map<string, number>();
  for (const raw of stockRows) {
    const r = obj(raw);
    const key = r === null ? null : readText(r.key);
    if (key !== null) countAt.set(key, num(r?.qty) ?? 0);
  }

  const lotsAt = new Map<string, Lot[]>();
  for (const raw of lotRows) {
    const r = obj(raw);
    const key = r === null ? null : readText(r.key);
    if (r === null || key === null) continue;
    const at = lotsAt.get(key) ?? [];
    at.push({ qty: num(r.qty) ?? 0, cost: num(r.cost), consign: readText(r.consign) });
    lotsAt.set(key, at);
  }

  const sellables: Sellable[] = [];
  for (const raw of productRows) {
    const { product, why } = toProduct(raw);
    if (product === null) {
      if (why !== null) unreadable.push(why);
      continue;
    }

    /**
     * Everything a person might type to find this line, in one string.
     *
     * The name, the category and the id were the whole of it once, so the
     * short description and the notes — the two fields that exist precisely
     * to hold the words nobody thinks to put in a name — were searchable in
     * the Products tab and not in the picker. Somebody typing here has a
     * customer in front of them repeating what they were told: *the 90
     * litre one*, *the heavy duty barrow*. Those words are in the
     * description and nowhere else, and a search that cannot see them
     * answers "no matching products" about something the shop is holding.
     */
    const one = (variantIdx: number | null, name: string, code: string, image: string | null): void => {
      const key = stockKey(product.id, variantIdx);
      const prices = pricesAt.get(key) ?? [];

      sellables.push({
        productId: product.id,
        variantIdx,
        name,
        category: product.category,
        subcategory: product.subcategory,
        findBy: [
          name,
          product.name,
          product.category,
          product.subcategory,
          product.description,
          product.notes,
          product.id,
          code,
          // A variant is found by the code its own supplier gave it, never
          // by one belonging to its neighbour.
          ...prices.map((p) => p.supplierSku ?? ''),
        ]
          .join(' ')
          .toLowerCase(),
        code,
        image,
        prices,
        lots: lotsAt.get(key) ?? [],
        counted: countAt.get(key) ?? 0,
      });
    };

    if (product.variants.length === 0) {
      one(null, product.name, product.id, product.image);
      continue;
    }

    for (const v of product.variants) {
      one(
        v.idx,
        v.label === '' ? product.name : `${product.name} — ${v.label}`,
        v.sku ?? `${product.id}-${v.idx + 1}`,
        v.image ?? product.image,
      );
    }
  }

  return { sellables, unreadable };
}

/** How many rows a page of a table holds before the next one is asked for. */
const PAGE = 1_000;

/**
 * Everything, in pages.
 *
 * `prices` alone is 495 rows on this shop and PostgREST caps a response at
 * a thousand by default — a catalogue silently cut at the cap is a product
 * that reads as unpriced because its supplier's row was on page two.
 */
async function all(table: string, columns: string, shopId: string): Promise<readonly unknown[]> {
  const { sb } = current();
  const rows: unknown[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .eq('shop_id', shopId)
      .range(from, from + PAGE - 1);

    if (error !== null) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/** The catalogue, for one shop. */
export async function readCatalogue(shopId: string): Promise<Derived<Catalogue>> {
  try {
    const [products, prices, stock, lots, suppliers] = await Promise.all([
      all('products', 'id, name, category, subcategory, notes, short_description, image, variants', shopId),
      all(
        'prices',
        'product_id, supplier_id, variant_idx, wholesale, retail, date, unit, pack_unit, pack_qty, tiers, out_of_stock, out_of_stock_since, supplier_sku',
        shopId,
      ),
      all('stock', 'key, qty', shopId),
      all('stock_lots', 'key, qty, cost, consign', shopId),
      all('suppliers', 'id, name', shopId),
    ]);

    const catalogue = assembleCatalogue(products, prices, stock, lots, suppliers);
    const priced = catalogue.sellables.filter((s) => s.prices.length > 0).length;

    return known(
      catalogue,
      `${catalogue.sellables.length} things to sell, ${priced} with a price on file`,
    );
  } catch (err) {
    return unavailable(`the catalogue: ${err instanceof Error ? err.message : String(err)}`);
  }
}
