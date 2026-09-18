/**
 * Choosing a thing to quote — the old app's item picker, in this app's
 * clothes.
 *
 * The owner's ruling was to leave the picker and the search as they are in
 * the old app rather than wait for a frame, so this keeps its two stages,
 * its fields and every rule it has learned, and wears the design system's
 * type, colour and spacing.
 *
 * ## Two stages, and the second one is where the money is
 *
 * **Search** is a list of things the shop sells, two lines each: the name
 * with what is on the shelf beside it, then one line of price, category and
 * code. **Stage** is the chosen thing: where to get it, how many, and what
 * to charge — and the quantity comes FIRST, because every price under it is
 * resolved for that quantity. A volume tier that only appears after the
 * item is added is a price nobody saw before quoting it.
 *
 * ## What it refuses to do
 *
 * It will not fill a price box with the cost, and it will not fill it with
 * a guess. Where the shop has set no markup rule for the side the money
 * came off, the box is empty and says so — a price nobody agreed is worse
 * on a quote than a blank somebody has to fill in.
 */

import { useMemo, useState, type ReactElement } from 'react';
import {
  Money,
  OWN_SHELF,
  choose,
  find,
  match,
  onShelf,
  perChosen,
  priceFrom,
  qtyInBaseUnits,
  rankedAtQty,
  sourceOf,
  type Source,
} from '@ow/domain';
import type { Sellable } from '@ow/data';
import s from './QuotePicker.module.css';
import { Icon } from '../icons.js';

/** What the picker hands back: everything a line needs to exist. */
export interface Picked {
  readonly thing: Sellable;
  readonly source: Source;
  /** As typed, in whichever unit was chosen. */
  readonly qty: number;
  readonly countedIn: 'unit' | 'pack';
  /** What the client pays for one of the chosen unit. */
  readonly sellEach: number;
  /** What one of the chosen unit costs the shop, where that is known. */
  readonly buyEach: number | null;
}

/** How many results the console draws before it starts counting. */
const SHOWN = 8;

const n = (v: number): string => Math.round(v).toLocaleString('en-UG');

/** The base unit, or the word for one where the books never named it. */
const unitWord = (unit: string | undefined): string =>
  unit === undefined || unit === '' ? 'unit' : unit;

export function Picker({
  catalogue,
  onPick,
  onClose,
}: {
  readonly catalogue: readonly Sellable[];
  readonly onPick: (picked: Picked) => void;
  readonly onClose: () => void;
}): ReactElement {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Sellable | null>(null);

  const hits = useMemo(() => find(catalogue, query), [catalogue, query]);

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label="Add an item">
      <div className={s.sheet}>
        <header className={s.head}>
          {chosen !== null && (
            <button type="button" className={s.back} onClick={() => setChosen(null)}>
              <Icon name="chevron-left" size={15} />
              Back to search
            </button>
          )}
          <h2 className={s.title}>{chosen === null ? 'Add an item' : chosen.name}</h2>
          <span className={s.spacer} />
          <button type="button" className={s.close} aria-label="Close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </header>

        {chosen === null ? (
          <Search query={query} onQuery={setQuery} hits={hits} onChoose={setChosen} />
        ) : (
          <Stage thing={chosen} onPick={onPick} />
        )}
      </div>
    </div>
  );
}

/* --------------------------------- search --------------------------------- */

function Search({
  query,
  onQuery,
  hits,
  onChoose,
}: {
  readonly query: string;
  readonly onQuery: (q: string) => void;
  readonly hits: readonly Sellable[];
  readonly onChoose: (thing: Sellable) => void;
}): ReactElement {
  const shown = hits.slice(0, SHOWN);

  return (
    <>
      <div className={s.searchRow}>
        <Icon name="search" size={16} className={s.searchMark} />
        <input
          className={s.search}
          value={query}
          autoFocus
          placeholder="Name, code, supplier's code, or anything in the description"
          aria-label="Search what the shop sells"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            // The top result is the best match, and a call does not wait
            // for a mouse.
            if (e.key === 'Enter' && shown[0] !== undefined) onChoose(shown[0]);
          }}
        />
        <span className={s.count}>
          {hits.length} {hits.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      <div className={s.list}>
        {shown.length === 0 ? (
          <p className={s.empty}>
            Nothing here matches that. It may be worth sourcing — the old app&rsquo;s catalogue is
            where a new product is added.
          </p>
        ) : (
          shown.map((thing) => <Result key={`${thing.productId}:${thing.code}`} thing={thing} onChoose={onChoose} />)
        )}

        <p className={s.note}>
          {hits.length > SHOWN
            ? `${hits.length - SHOWN} more · keep typing to narrow`
            : 'Sell prices — costs and suppliers appear once you pick the item.'}
        </p>
      </div>
    </>
  );
}

/**
 * A result is TWO LINES: the name, whole, with what is on the shelf at its
 * right; under it one line of what it sells for, the category and the code.
 *
 * Five wrapping lines with the code first was the shipped shape, and it read
 * as a table that had fallen over.
 */
function Result({
  thing,
  onChoose,
}: {
  readonly thing: Sellable;
  readonly onChoose: (thing: Sellable) => void;
}): ReactElement {
  const shelf = onShelf(thing.lots);
  const best = rankedAtQty(thing.prices, 1)[0];
  const at = best?.at ?? null;

  return (
    <button type="button" className={s.result} onClick={() => onChoose(thing)}>
      <span className={s.resultName}>{thing.name}</span>
      <span className={`${s.shelf} ${shelf > 0 ? s.shelfSome : s.shelfNone}`}>
        {shelf > 0 ? `${n(shelf)} on the shelf` : 'none on the shelf'}
      </span>
      <span className={s.resultMeta}>
        {at === null
          ? thing.prices.length === 0
            ? 'no price on file'
            : 'everyone who sells it has run out'
          : `from ${n(at)}${best?.unit === '' ? '' : ` / ${best?.unit ?? ''}`}`}
        {thing.category === '' ? '' : ` · ${thing.category}`} · {thing.code}
      </span>
    </button>
  );
}

/* --------------------------------- stage ---------------------------------- */

function Stage({
  thing,
  onPick,
}: {
  readonly thing: Sellable;
  readonly onPick: (picked: Picked) => void;
}): ReactElement {
  const [typed, setTyped] = useState('1');
  const [countedIn, setCountedIn] = useState<'unit' | 'pack'>('unit');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  /** Null until somebody types over what the shop's own rule suggests. */
  const [override, setOverride] = useState<string | null>(null);

  const askedFor = Number(typed);
  const qtyTyped = Number.isFinite(askedFor) && askedFor > 0 ? askedFor : 0;

  // Resolved in the base unit, always. A pack context has to be settled
  // before a quantity can be read at all, so it comes off whichever source
  // is in hand.
  const settled = useMemo(() => choose(thing, 1), [thing]);
  const packContext = sourceOf(settled, supplierId ?? settled.restsOn);
  const packQty = packContext?.packQty ?? 0;
  const hasPack = packQty > 0 && (packContext?.packUnit ?? '') !== '';
  const counted = hasPack ? countedIn : 'unit';
  const qty = qtyInBaseUnits(qtyTyped, counted, packQty);

  // Now that there IS a quantity, everything is resolved for it — so a
  // volume tier shows up as soon as it is reached rather than after the
  // item has been added.
  const choice = useMemo(() => choose(thing, qty), [thing, qty]);
  const at = supplierId ?? choice.restsOn;
  const source = sourceOf(choice, at);

  const per = perChosen(counted, packQty);
  const chosenUnit = counted === 'pack' ? packContext?.packUnit ?? '' : packContext?.unit ?? '';

  const suggested = source === null ? null : priceFrom(thing, source, qty);
  const sellPerBase = match(suggested ?? { status: 'unavailable', reason: '' }, {
    known: (p) => p,
    partial: (p) => p,
    unavailable: () => null,
  });
  const sellEach = override !== null ? Number(override) : sellPerBase === null ? null : sellPerBase * per;
  const buyEach = match(source?.at ?? { status: 'unavailable', reason: '' }, {
    known: (c) => c * per,
    partial: (c) => c * per,
    unavailable: () => null,
  });

  const ready = qty > 0 && sellEach !== null && Number.isFinite(sellEach) && sellEach >= 0;

  return (
    <div className={s.stage}>
      {choice.nobodyHasIt && (
        <p className={s.hard}>
          Nobody has this in stock right now. It has been quoted before, so ask when it is back
          before promising a date.
        </p>
      )}

      {choice.runOut.length > 0 && !choice.nobodyHasIt && (
        <p className={s.soft}>
          Out of stock at{' '}
          {choice.runOut
            .map((r) => `${r.name}${r.since === null ? '' : ` since ${r.since}`}`)
            .join(', ')}
          . The prices below are from whoever still has it.
        </p>
      )}

      {/* The quantity comes first: every price under it is resolved for it. */}
      <div className={s.field}>
        <label className={s.label} htmlFor="ip-qty">
          How many
        </label>
        <div className={s.qtyRow}>
          <input
            id="ip-qty"
            className={s.input}
            value={typed}
            inputMode="decimal"
            autoFocus
            onChange={(e) => setTyped(e.target.value)}
          />
          {hasPack && (
            <div className={s.units} role="group" aria-label="Counted in">
              {(['unit', 'pack'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`${s.unitBtn} ${counted === mode ? s.unitOn : ''}`}
                  aria-pressed={counted === mode}
                  onClick={() => {
                    setCountedIn(mode);
                    setOverride(null);
                  }}
                >
                  {mode === 'unit' ? unitWord(packContext?.unit) : packContext?.packUnit}
                </button>
              ))}
            </div>
          )}
          {counted === 'pack' && (
            <span className={s.qtyReads}>
              {n(qty)} {packContext?.unit === '' ? 'units' : packContext?.unit}
            </span>
          )}
        </div>
      </div>

      <div className={s.field}>
        <span className={s.label}>Where it comes from</span>
        <div className={s.sources}>
          {choice.sources.length === 0 ? (
            <p className={s.empty}>
              No supplier on file prices this, and there is none on the shelf. Nothing here can
              work out what it costs.
            </p>
          ) : (
            choice.sources.map((one) => (
              <button
                key={one.id}
                type="button"
                className={`${s.source} ${one.id === at ? s.sourceOn : ''}`}
                aria-pressed={one.id === at}
                onClick={() => {
                  setSupplierId(one.id);
                  setOverride(null);
                }}
              >
                <span className={s.sourceName}>
                  {one.name}
                  {one.best && <span className={s.bestChip}>cheapest</span>}
                </span>
                <span className={s.sourceAt}>
                  {match(one.at, {
                    known: (c) => `${n(c * per)} / ${unitWord(chosenUnit)}`,
                    partial: (c) => `${n(c * per)} / ${unitWord(chosenUnit)} — to replace it`,
                    unavailable: () => 'no price on file',
                  })}
                </span>
                {one.id === OWN_SHELF && (
                  <span className={s.sourceMeta}>
                    {n(one.have ?? 0)} on the shelf
                    {one.consignedTo !== null && ` · ${one.consignedTo}'s goods, still owed for`}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="ip-price">
          What the client pays, per {unitWord(chosenUnit)}
        </label>
        <input
          id="ip-price"
          className={s.input}
          inputMode="decimal"
          placeholder={sellPerBase === null ? 'Nothing says what to charge — type it' : ''}
          value={override ?? (sellEach === null ? '' : String(Math.round(sellEach)))}
          onChange={(e) => setOverride(e.target.value)}
          aria-label={`What the client pays per ${unitWord(chosenUnit)}`}
        />
        <p className={s.why}>
          {match(suggested ?? { status: 'unavailable', reason: 'nothing is chosen' }, {
            known: (_p, basis) => `The shop's own rule: ${basis}.`,
            partial: (_p, basis, missing) => `The shop's own rule: ${basis} — ${missing}.`,
            unavailable: (why) => `No figure is suggested: ${why}.`,
          })}
        </p>
      </div>

      <footer className={s.foot}>
        <div className={s.foots}>
          <span className={s.footLabel}>Client pays</span>
          <span className={s.footFig}>
            {sellEach === null ? '—' : n(sellEach * qtyTyped)} <span className={s.footUnit}>UGX</span>
          </span>
        </div>
        <div className={s.foots}>
          <span className={s.footLabel}>Costs you</span>
          <span className={s.footFig}>{buyEach === null ? '—' : n(buyEach * qtyTyped)}</span>
        </div>
        <div className={s.foots}>
          <span className={s.footLabel}>You keep</span>
          <span className={s.footFig}>
            {sellEach === null || buyEach === null ? '—' : n((sellEach - buyEach) * qtyTyped)}
          </span>
        </div>
        <span className={s.spacer} />
        <button
          type="button"
          className={s.add}
          disabled={!ready || source === null}
          onClick={() => {
            // `ready` is what guarantees there is a figure at all, and the
            // button is disabled without it — this is belt to that.
            if (!ready || source === null) return;
            onPick({ thing, source, qty: qtyTyped, countedIn: counted, sellEach, buyEach });
          }}
        >
          Add to the quote
        </button>
      </footer>
    </div>
  );
}

/** Kept out of the JSX so the money format is spelled once. */
export const formatEach = (amount: number): string => Money.format(Money.roundDown(amount));
