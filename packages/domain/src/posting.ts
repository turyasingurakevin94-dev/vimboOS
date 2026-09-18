/**
 * What is worth telling the group about.
 *
 * The Posting lens drew nothing and said *"what is worth posting is not
 * derived yet: it needs stock, prices and a sales rate"*. Two of those three
 * arrived with the catalogue, and the third is one pass over the invoiced
 * orders — but the sentence was understating the gap in the other
 * direction too, because **the shop had already told the app what to look
 * for** and nothing was reading it:
 *
 * | the shop set | in `app_settings.presets` | it decides |
 * | --- | --- | --- |
 * | how long is dead | `deadStockDays`, 60 here | the `idle-stock` signal |
 * | what margin it wants | `targetMarginPct`, 10 here | the `margin` signal |
 * | which prices it cut | `clearance`, one line here | the `price-cut` signal |
 *
 * Three of the five signals, from the shop's own settings rather than from a
 * threshold invented here. The other two are named and not faked:
 * `goes-together` needs which products leave together, which is its own
 * derivation across every order, and `season-starting` needs a seasonal
 * model these books do not hold.
 */

import { OWN_SHELF, onShelf, priceFrom, shelfCost, type Choosable, type Lot } from './catalogue.js';
import { known, match, unavailable, type Derived } from './derived.js';
import * as Money from './money.js';
import type { Money as Amount } from './money.js';
import type { Post, Signal } from './messages.js';

/** What the shop said, where it said it. Nothing here invents a threshold. */
export interface PostingRules {
  /** After this long with nothing sold, stock is dead. `deadStockDays`. */
  readonly deadAfterDays: number;
  /** The margin the shop is aiming at, as a per cent. `targetMarginPct`. */
  readonly targetMarginPercent: number;
  /** Prices the shop has cut, by stock key. `clearance`. */
  readonly cuts: ReadonlyMap<string, { readonly price: Amount; readonly setOn: Date }>;
}

/** One thing that could be posted, with everything known about it. */
export interface Nominee extends Choosable {
  readonly key: string;
  readonly code: string;
  readonly unit: string;
  /** Units that left over the window. */
  readonly soldInWindow: number;
  /** How long the window was, in days. */
  readonly windowDays: number;
  readonly lots: readonly Lot[];
}

/** A signal this app cannot derive, and what it would take. */
export interface NotDerived {
  readonly signal: Signal;
  readonly needs: string;
}

/** The two that are named rather than faked. */
export const NOT_DERIVED: readonly NotDerived[] = [
  {
    signal: 'goes-together',
    needs: 'which products leave together, across every order the shop has taken',
  },
  { signal: 'season-starting', needs: 'a seasonal model, which these books do not hold' },
];

/** Units a day. Zero is idle stock, not a small number. */
export const perDay = (soldInWindow: number, windowDays: number): number =>
  windowDays <= 0 ? 0 : soldInWindow / windowDays;

/**
 * What the shop keeps on one of them, as a per cent of what it charges.
 *
 * Named `keptOnShelf` rather than `marginPercent`: `customers.ts` already
 * has a `marginPercent` about a customer's own account, and two functions
 * with one name about two different things is how the wrong one gets called.
 *
 * `unavailable` where either side is missing, because a margin computed off
 * a cost of zero is the "pure profit" reading that `shelfCost` exists to
 * refuse.
 */
export function keptOnShelf(nominee: Nominee): Derived<number> {
  const shelf = shelfCost(nominee.lots);
  const source = { id: OWN_SHELF, name: 'Our stock', at: shelf, packUnit: '', packQty: 0, unit: nominee.unit, have: onShelf(nominee.lots), best: false, consignedTo: null };
  const sell = priceFrom(nominee, source, 1);

  // Both sides have to be settled. A cost that is only an estimate of what
  // replacing the thing would take is not what it cost, and a margin read
  // off it is a margin about a purchase that never happened.
  if (shelf.status !== 'known' || sell.status !== 'known') {
    return unavailable(
      shelf.status !== 'known'
        ? `what it cost is not settled: ${shelf.status === 'partial' ? shelf.missing : shelf.reason}`
        : 'what it sells for is not settled',
    );
  }

  const price = sell.value;
  const cost = shelf.value;
  return price <= 0
    ? known(0, 'it is given away, so there is no share to keep')
    : known(Math.round(((price - cost) / price) * 100), `${price} less ${cost}`);
}

/** What one of them sells for, off the shelf. */
const sellsAt = (nominee: Nominee): Amount | null => {
  const source = { id: OWN_SHELF, name: 'Our stock', at: shelfCost(nominee.lots), packUnit: '', packQty: 0, unit: nominee.unit, have: onShelf(nominee.lots), best: false, consignedTo: null };
  return match(priceFrom(nominee, source, 1), {
    known: (p) => Money.roundDown(p),
    partial: (p) => Money.roundDown(p),
    unavailable: () => null,
  });
};

const costsAt = (nominee: Nominee): Amount | null =>
  match(shelfCost(nominee.lots), {
    known: (c) => Money.roundDown(c),
    partial: (c) => Money.roundDown(c),
    unavailable: () => null,
  });

/**
 * A nomination and its raw weight, before the weights are compared.
 *
 * `strength` is *how strongly THIS row shows its signal*, nought to one, and
 * it only means anything against the other rows showing the same one. Scaled
 * against a constant chosen here it saturated: twenty-six margin rows all at
 * 1, and a list that fell back to alphabetical — a screw selling ten beside a
 * screw selling 262, indistinguishable. `nominations` scales the weights
 * within each signal instead, so no threshold is invented at all.
 */
export interface Weighed {
  readonly post: Omit<Post, 'strength'>;
  /** In the signal's own terms: shillings for two of them, a share for one. */
  readonly weight: number;
}

/**
 * Why this thing is worth a post, and how strongly.
 *
 * One nomination per thing, and the order below is the order of how hard the
 * evidence is: a price the shop actually cut beats stock that has not moved,
 * which beats a margin worth pushing. Two of them on one line is still one
 * post, because the group gets one message about one thing.
 */
export function nominate(nominee: Nominee, rules: PostingRules, now: Date): Weighed | null {
  const onHand = onShelf(nominee.lots);
  const sell = sellsAt(nominee);
  const cost = costsAt(nominee);
  const soldPerDay = perDay(nominee.soldInWindow, nominee.windowDays);

  const base = {
    id: `post:${nominee.key}`,
    product: nominee.name,
    onHand,
    soldPerDay,
    sellPrice: sell ?? Money.ZERO,
    costPrice: cost,
    picked: false,
    card: null,
  };

  // 1. A price the shop has actually cut. This is a fact about a decision
  //    somebody took, not a reading of a trend.
  const cut = rules.cuts.get(nominee.key);
  if (cut !== undefined && sell !== null) {
    const days = Math.max(0, Math.floor((now.getTime() - cut.setOn.getTime()) / 86_400_000));
    const off = sell <= 0 ? 0 : (sell - cut.price) / sell;
    return {
      post: {
        ...base,
        signal: 'price-cut',
        sellPrice: cut.price,
        why: `cut to ${Money.format(cut.price)} from ${Money.format(sell)} · ${
          days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
        }`,
      },
      // How deep the cut is. An eight per cent cut is a weaker nomination
      // than a half-price clearance.
      weight: Math.max(0, off),
    };
  }

  // 2. Nothing has sold and it is sitting on the shelf. The shop set how
  //    long counts as dead; this does not guess at it.
  if (onHand > 0 && nominee.soldInWindow === 0 && nominee.windowDays >= rules.deadAfterDays) {
    const money = cost === null ? null : Money.times(cost, onHand);
    return {
      post: {
        ...base,
        signal: 'idle-stock',
        why: `${onHand} on the shelf, nothing sold in ${rules.deadAfterDays} days${
          money === null ? '' : ` · ${Money.format(money)} standing still`
        }`,
      },
      // The money standing still, not the count: sixty sofa legs at 3,166 is
      // a bigger question than fifty drill bits at 450. Nothing to value
      // weighs nothing rather than nothing at all — the row still belongs.
      weight: money ?? 0,
    };
  }

  // 3. It moves and it keeps well over what the shop is aiming at.
  const margin = keptOnShelf(nominee);
  if (onHand > 0 && soldPerDay > 0 && margin.status === 'known') {
    const over = margin.value - rules.targetMarginPercent;
    if (over > 0 && sell !== null && cost !== null) {
      /**
       * **Ranked by money, over the units that actually sold.**
       *
       * By percentage over the target it was useless: the shop aims at 10%
       * and keeps 39% to 95% on everything that moves, so every one of the
       * twenty-six nominations saturated at 1 and the list fell back to
       * alphabetical — a screw selling ten beside a screw selling 262,
       * indistinguishable. The old app's own Manager notes say why: *"a list
       * ordered by percentage puts a 2% line nobody buys above a 4.8% line
       * carrying 6,615,000 of trade."*
       */
      const earned = Money.times(Money.subtract(sell, cost), nominee.soldInWindow);
      return {
        post: {
          ...base,
          signal: 'margin',
          why: `keeps ${margin.value}% against the ${rules.targetMarginPercent}% you aim at · ${
            nominee.soldInWindow
          } sold in ${nominee.windowDays} days, ${Money.format(earned)} kept`,
        },
        weight: earned,
      };
    }
  }

  return null;
}

/** How many nominations the lens draws before it starts counting. */
export const SHOWN = 12;

/**
 * Everything worth posting, strongest first.
 *
 * **A strength is relative to the other rows wearing the same chip.** The
 * strongest margin nomination on the board is a 1 and the rest are a share
 * of it, so the chip ranks rather than saturating — and no threshold is
 * chosen here, which is the point: the shop set what dead and what margin
 * mean, and nothing else needed setting.
 *
 * Ordered by strength and then by name, so the list does not reshuffle under
 * the eye when two rows are equally strong.
 */
export function nominations(
  nominees: readonly Nominee[],
  rules: PostingRules,
  now: Date,
): readonly Post[] {
  const weighed = nominees.flatMap((n) => {
    const one = nominate(n, rules, now);
    return one === null ? [] : [one];
  });

  const strongest = new Map<Signal, number>();
  for (const { post, weight } of weighed) {
    strongest.set(post.signal, Math.max(strongest.get(post.signal) ?? 0, weight));
  }

  return weighed
    .map(({ post, weight }) => {
      const top = strongest.get(post.signal) ?? 0;
      return { ...post, strength: top <= 0 ? 1 : Math.min(1, weight / top) };
    })
    .sort((a, b) => b.strength - a.strength || a.product.localeCompare(b.product));
}
