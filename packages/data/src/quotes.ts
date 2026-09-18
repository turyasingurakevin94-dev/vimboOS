/**
 * Raising an order on the shop's own books.
 *
 * The first thing this app writes that the shop will work from. A promise is
 * a note beside a customer; an order is the document a picker packs, a buyer
 * carries money for and a client is eventually billed on.
 *
 * ## It inserts, and that is the whole of the permission
 *
 * The preservation contract in `savedQuotes.ts` is about a payload being
 * REBUILT from thirty named keys, which is something that only happens when
 * a row already there is overwritten. A new row has no prior payload, so an
 * insert cannot break it — and an update could, on the first try, which is
 * why `WRITE_IS_INSERT_ONLY` sits beside the key list and why this file has
 * exactly one `.insert()` and no `.update()`.
 *
 * Editing an order and moving it between lanes both stay with the old app
 * until a merge that reads the row first is argued for on its own terms.
 *
 * ## One click, one document
 *
 * Issuing the id is a round trip, and the id becomes the `INV-` number on
 * paper. The old app learned this live: a shop pressed Save twice on a slow
 * connection and got `PINV-0143` and `PINV-0144` for the same twenty
 * cartons, seconds apart — not a duplicate, a second document, with the
 * stock moved twice behind it. Its fix is a wrapper that flags AND disables,
 * because the flag is what makes the second press harmless and the greyed
 * button is what tells the person why nothing happened.
 *
 * This file cannot disable a button. What it can do is refuse to be in
 * flight twice for the same shop, which is {@link raising} — and the screen
 * still owes the greyed button.
 */

import {
  match,
  perChosen,
  qtyInBaseUnits,
  type ChargeLine,
  type ItemLine,
  type Quote,
} from '@ow/domain';
import {
  QUOTE_ID_KIND,
  lineIds,
  newQuotePayload,
  type QuoteLineWrite,
} from './savedQuotes.js';
import { idFloor, isRefusedByPolicy, issueRowId, writer, type Written } from './writer.js';

/** What `saved_quotes` is given. Column names, spelled once. */
export interface QuoteRow extends Readonly<Record<string, unknown>> {
  readonly id: number;
  readonly shop_id: string;
  readonly client_name: string | null;
  readonly client_phone: string | null;
  readonly date: string;
  readonly status: string;
  readonly invoiced: boolean;
  readonly invoiced_at: string | null;
  readonly invoiced_ts: string | null;
  readonly amount_paid: number;
  readonly voided: boolean;
  readonly payload: Record<string, unknown>;
}

/** An order as this app raises it, before it is a row. */
export interface NewQuote {
  readonly client: { readonly name: string; readonly phone: string };
  /** The customer this is charged to, where it is one of the shop's own. */
  readonly customerId: string | null;
  readonly items: readonly QuoteLineWrite[];
  readonly charges: readonly { readonly name: string; readonly amount: number }[];
}

/** Kampala is UTC+3, and every day-string in both apps is a UTC one. */
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * An order as a row — the part of this file that can be wrong, and the part
 * that needs no database to test.
 *
 * `status: 'draft'` because that is where a raised order waits: the old app
 * holds it in Draft until every supplier on it has come back, and only then
 * tells the sales group. Raising an order is not agreeing it.
 *
 * `client_name` and `client_phone` are columns AND payload — the old app
 * writes both from one object, and the board reads the column while the
 * quote screen reads the payload. Writing one and not the other is how they
 * start disagreeing about whose order it is.
 */
export function quoteRow(shopId: string, id: number, quote: NewQuote, now: Date): QuoteRow {
  return {
    id,
    shop_id: shopId,
    client_name: quote.client.name === '' ? null : quote.client.name,
    client_phone: quote.client.phone === '' ? null : quote.client.phone,
    date: isoDay(now),
    status: 'draft',
    invoiced: false,
    invoiced_at: null,
    invoiced_ts: null,
    amount_paid: 0,
    voided: false,
    payload: newQuotePayload({
      client: quote.client,
      items: quote.items,
      charges: quote.charges,
      customerId: quote.customerId,
      now,
    }),
  };
}

/**
 * What an order has to have before it is worth an invoice number.
 *
 * Checked before the round trip, not after, for the reason the old app
 * states at the same point in its own save: *a save the shop backs out of
 * must cost nothing*. An id issued for an order that is then refused is a
 * gap in the shop's invoice sequence, on paper, for ever.
 */
export function whyNotSaveable(quote: NewQuote): string | null {
  if (quote.items.length === 0) return 'Add at least one item before saving.';
  if (quote.client.name.trim() === '') return 'Say who the order is for before saving.';

  const badQty = quote.items.find((i) => !Number.isFinite(i.qty) || i.qty <= 0);
  if (badQty !== undefined) return `${badQty.productName} has no quantity.`;

  // Not "a whole number of shillings". The old app prices a line per BASE
  // unit and divides a per-carton figure back down by the pack size, so a
  // carton of twelve at 25,000 stores 2083.333… — fractions are in these
  // books by design and rounding them here would change what the client is
  // billed. What is checked is that there is a figure at all.
  const badPrice = quote.items.find((i) => !Number.isFinite(i.sellPrice) || i.sellPrice < 0);
  if (badPrice !== undefined) return `${badPrice.productName} has no price.`;

  const badCost = quote.items.find((i) => !Number.isFinite(i.price) || i.price < 0);
  if (badCost !== undefined) return `${badCost.productName} has no buying price.`;

  return null;
}

/**
 * Shops with a save in flight.
 *
 * Module-level rather than per-caller: two screens holding their own flag
 * would each be sure it was the only one saving. It is keyed by shop so a
 * console with two shops open cannot have one block the other.
 */
const raising = new Set<string>();

/** Whether a save is in flight for this shop. The screen greys its button. */
export const isRaising = (shopId: string): boolean => raising.has(shopId);

/**
 * Raise the order.
 *
 * `shopId` is passed rather than inferred, as everywhere else here: RLS
 * would scope the insert anyway, but the schema lets somebody belong to two
 * shops, and a write that lets the policy pick one is a write that lands in
 * the wrong books.
 */
export async function raiseQuote(
  shopId: string,
  quote: NewQuote,
  now: Date,
): Promise<Written> {
  const refuse = whyNotSaveable(quote);
  if (refuse !== null) return { ok: false, why: refuse };

  // The second press is not a duplicate of the first, it is a second
  // document — with its own invoice number, and its own stock behind it.
  if (raising.has(shopId)) {
    return { ok: false, why: 'That order is being saved. Nothing was saved twice.' };
  }
  raising.add(shopId);

  try {
    const issued = await issueRowId(
      shopId,
      QUOTE_ID_KIND,
      await idFloor('saved_quotes', shopId),
      'The order',
    );
    if (!issued.ok) return issued;

    const { error } = await writer()
      .from('saved_quotes')
      .insert(quoteRow(shopId, issued.id, quote, now));

    if (error !== null) {
      return {
        ok: false,
        why: isRefusedByPolicy(error)
          ? 'You are not allowed to raise an order on this shop’s books. Nothing was saved.'
          : `The order was not saved (${error.message}).`,
      };
    }

    return { ok: true, id: issued.id };
  } finally {
    raising.delete(shopId);
  }
}

/* -------------------------------------------------------------------------- *
 * A quote on screen, as lines in the books
 * -------------------------------------------------------------------------- */

/**
 * One line of the quote, in the exact shape the old app's own item picker
 * pushes onto `payload.items`.
 *
 * `price` is the BUY price and `sellPrice` what the client pays, and they
 * are that way round in the books — a reader that swapped them would show
 * the shop's buying price as the customer's. Both count per BASE unit,
 * whatever unit the person typed in, which is what `qtyInBaseUnits` and
 * `perChosen` are for.
 *
 * A buy price that could not be derived is written as 0 and NOT as a guess.
 * Zero is what the old app writes for a line off a shelf with no cost on
 * file, and the margin read off it is wrong in the direction everybody can
 * see — where a guessed cost is wrong in the direction nobody checks.
 */
export function writeLine(line: ItemLine, lineId: number): QuoteLineWrite {
  const per = perChosen(line.source.countedIn, line.source.packQty);

  return {
    lineId,
    productId: line.source.productId,
    variantIdx: line.source.variantIdx,
    productName: line.name,
    unit: line.unit,
    packUnit: line.source.packUnit,
    packQty: line.source.packQty,
    qtyIn: line.source.countedIn,
    qty: qtyInBaseUnits(line.qty, line.source.countedIn, line.source.packQty),
    supplierId: line.source.supplierId,
    supplierName: line.buyFrom,
    price: match(line.buyAt, {
      known: (at) => at / per,
      partial: (at) => at / per,
      unavailable: () => 0,
    }),
    sellPrice: line.priceEach / per,
  };
}

/** The whole quote, as the order it is about to become. */
export function writeQuote(
  quote: Quote,
  customerId: string | null,
): NewQuote {
  const items = quote.lines.filter((l): l is ItemLine => l.kind === 'item');

  return {
    client: { name: quote.client.name, phone: quote.client.phone },
    customerId,
    items: items.map((line, at) => writeLine(line, lineIds(items.length)[at] ?? at + 1)),
    charges: quote.lines
      .filter((l): l is ChargeLine => l.kind === 'charge')
      .map((c) => ({ name: c.name, amount: c.amount })),
  };
}
