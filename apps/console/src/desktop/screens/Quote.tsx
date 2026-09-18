/**
 * Quote — the desktop console. Frame 4a of the Quote handoff.
 *
 * The screen is one long call: a name, then lines, then a figure you can say
 * out loud. Three things it does that the old one did not.
 *
 * 1. **Nothing opens a dialog.** Quantity and price are edited where they
 *    are read. The old app put a modal in front of every line, and on a call
 *    that is the difference between quoting three items and quoting ten.
 * 2. **The shop's side sits beside the client's**, divided by one pixel.
 *    What it cost and who it came from are on the same row as what is being
 *    charged, so "can I go lower" is answered without leaving the line.
 * 3. **The dock never moves.** `Client pays · Costs you · You keep · the
 *    share` — the same four figures, in the same order, as the phone dock,
 *    the shop-side sheet and the item picker's foot.
 *
 * ## The totals are computed, and they disagree with the mockup
 *
 * 4a, 4b and 4d all draw a dock reading `Client pays 519,120` over a table
 * whose lines add to **579,120** — short by exactly the 60,000 Transport
 * charge, which the table draws and the dock counts among its "5 lines".
 * 519,120 is the items plus credit terms and no transport, so the dock was
 * worked out before that line was added. The cost column (467,500) is right,
 * so the kept figure is 111,620 at 19%, not 51,620 at 10%.
 *
 * This screen adds its lines up. A dock that disagrees with the table above
 * it is the defect this rewrite exists to remove, and `quote.test.ts` pins
 * both the true figures and the mockup's, so the difference stays visible
 * instead of becoming folklore.
 */

import { useState, type ReactElement } from 'react';
import {
  Money,
  asId,
  askedFor,
  clientPays,
  costsYou,
  keepPercent,
  keepTone,
  known,
  lineKeepPercent,
  lineTotal,
  match,
  onShelf,
  shortOf,
  unavailable,
  youKeep,
  type ChargeLine,
  type Client,
  type ItemLine,
  type QuoteLine,
} from '@ow/domain';
import {
  commonCharges,
  goesWithIt,
  lastOrder,
  raiseQuote,
  usuallyBuys,
  whyNotSaveable,
  writeQuote,
} from '@ow/data';
import { useCatalogue } from '../../app/useCatalogue.js';
import { useBooks } from '../../app/Books.js';
import { Picker, type Picked } from './QuotePicker.js';
import s from './Quote.module.css';
import { Icon } from '../icons.js';

const v = (token: string): string => `var(--ow-color-${token})`;

/** The tint a kept share wears. See `keepTone` — the boundary is ten. */
const TONE = {
  good: { bg: v('good-chip-light'), ink: v('good-ink') },
  warn: { bg: v('warn-fill'), ink: v('warn-ink') },
  bad: { bg: v('bad-chip'), ink: v('bad-ink') },
} as const;

/**
 * A figure that could not be derived is written as an em dash and says why on
 * hover. It is never written as a zero — absence is not zero, and a dock
 * reading `0` would be a claim the shop makes no margin.
 */
function DerivedFigure({
  value,
  className,
}: {
  readonly value: ReturnType<typeof youKeep>;
  readonly className: string | undefined;
}): ReactElement {
  return match(value, {
    known: (amount) => <span className={className}>{Money.format(amount)}</span>,
    partial: (amount, _basis, missing) => (
      <span className={className} title={`at least this much — ${missing}`}>
        {Money.format(amount)}
        <span className={s.dockPaysUnit}> +</span>
      </span>
    ),
    unavailable: (reason) => (
      <span className={className} title={reason}>
        &#8212;
      </span>
    ),
  });
}

/* -------------------------------------------------------------------------- *
 * The quote, and what it is made of
 * -------------------------------------------------------------------------- */

/**
 * Nobody, until somebody is named.
 *
 * A counter sale is a real thing and `client_name` may be null — but the
 * order still has to say who it is for before it can be saved, which is
 * `whyNotSaveable`'s job and not this one's.
 */
const NOBODY: Client = {
  id: asId(''),
  name: '',
  phone: '',
  orders: 0,
  owesNow: Money.ZERO,
  lastOrder: null,
};

/** A day, as the quote's own strip says it: `18 Sep 2026`. */
const dayReads = (on: Date): string =>
  `${on.getUTCDate()} ${MONTHS[on.getUTCMonth()] ?? ''} ${on.getUTCFullYear()}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function Quote(): ReactElement {
  const read = useCatalogue();
  if (read.at === 'loading') return <Waiting />;
  if (read.at === 'failed') return <Refused why={read.why} />;
  return <Desk read={read} />;
}

/**
 * Reading, not an empty catalogue.
 *
 * A picker with nothing in it and a picker that could not be filled look
 * identical, and only one of them means the shop sells nothing.
 */
function Waiting(): ReactElement {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className={s.title}>Quote</h1>
          <p className={s.sub}>Reading what the shop sells&#8230;</p>
        </div>
      </header>
    </div>
  );
}

function Refused({ why }: { readonly why: string }): ReactElement {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className={s.title}>Quote</h1>
          <p className={s.sub}>The catalogue could not be read. {why}</p>
        </div>
      </header>
    </div>
  );
}

function Desk({
  read,
}: {
  readonly read: Extract<ReturnType<typeof useCatalogue>, { at: 'ready' }>;
}): ReactElement {
  const books = useBooks();
  const [lines, setLines] = useState<readonly QuoteLine[]>([]);
  const [client, setClient] = useState<Client>(NOBODY);
  const [picking, setPicking] = useState(false);
  /** What came of the last press of Save, in words. */
  const [said, setSaid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pays = clientPays(lines);
  const cost = costsYou(lines);
  const keep = youKeep(lines);
  const share = keepPercent(lines);
  const items = lines.filter((l): l is ItemLine => l.kind === 'item');

  const add = (picked: Picked): void => {
    setPicking(false);
    setLines((prior) => [...prior, lineFrom(picked)]);
    setSaid(null);
  };

  const drop = (id: string): void => {
    setLines((prior) => prior.filter((l) => l.id !== id));
    setSaid(null);
  };

  /**
   * Quantity and price are edited where they are read, and a figure that
   * cannot be read as a number is left alone rather than snapped to zero —
   * somebody halfway through typing `1` in `12` has an empty box for one
   * keystroke, and a line that jumped to 0 there would be a line they have
   * to fix afterwards.
   */
  const retype = (id: string, what: 'qty' | 'priceEach', typed: string): void => {
    // A figure is read aloud grouped, so it is typed back grouped too.
    const value = Number(typed.replace(/[\s,]/g, ''));
    if (!Number.isFinite(value) || value < 0) return;
    setLines((prior) =>
      prior.map((l) =>
        l.id !== id || l.kind !== 'item'
          ? l
          : what === 'qty'
            ? { ...l, qty: value }
            : { ...l, priceEach: Money.roundDown(value) },
      ),
    );
    setSaid(null);
  };

  const save = async (): Promise<void> => {
    // The example books are an array in this app's own memory. There is
    // nowhere to write them, and a quote that said it had been saved to
    // them would be the only lie on the screen.
    if (books.from !== 'live') {
      setSaid('These are example books, so nothing is written. Sign in to raise a real order.');
      return;
    }

    setSaving(true);
    setSaid(null);
    const written = await raiseQuote(
      books.shopId,
      writeQuote({ client, date: dayReads(read.today), lines }, client.id === '' ? null : client.id),
      read.today,
    );
    setSaving(false);

    if (!written.ok) {
      setSaid(written.why);
      return;
    }
    setSaid(`Saved as #${written.id}. It waits in Taken until every supplier on it has answered.`);
    setLines([]);
    setClient(NOBODY);
  };

  return (
    <div className={s.page}>
      {picking && (
        <Picker
          catalogue={read.data.sellables}
          onPick={add}
          onClose={() => setPicking(false)}
        />
      )}

      <header className={s.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className={s.title}>Quote</h1>
          <p className={s.sub}>
            Build the order live, on the call &#183; say the price, move to the next item
          </p>
        </div>
      </header>

      <div className={s.work}>
        <div className={s.lines}>
          <ClientStrip client={client} date={dayReads(read.today)} onClient={setClient} />

          <section className={`${s.card} ${s.clip}`}>
            <div className={s.addRow}>
              <button type="button" className={s.addField} onClick={() => setPicking(true)}>
                <Icon name="search" size={16} style={{ color: v('ink-3'), flex: 'none' }} />
                <span className={s.addFieldText}>
                  Add item &#8212; name, code or supplier code
                </span>
                <span className={s.key} aria-hidden="true">
                  /
                </span>
              </button>
            </div>

            {client.id !== '' && (
              <div className={s.suggests}>
                <span className={s.suggestLabel}>Usually buys</span>
                {usuallyBuys.map((u) => (
                  <button key={u.name} type="button" className={s.pill}>
                    {u.name} <span className={s.pillFig}>{u.rate}</span>
                  </button>
                ))}
                <button type="button" className={`${s.pill} ${s.pillOpen}`}>
                  +3 more
                </button>
              </div>
            )}

            <div className={s.headRow}>
              <span />
              <span className={s.colLabel}>Item</span>
              <span className={`${s.colLabel} ${s.right}`}>Qty</span>
              <span className={`${s.colLabel} ${s.right}`}>Price each</span>
              <span className={`${s.colLabel} ${s.right}`}>Line total</span>
              {/* One pixel: the boundary between the client's side and the
                  shop's. Everything right of it is the shop's. */}
              <span className={s.divideHead} />
              <span className={s.colLabel}>Buy from</span>
              <span className={`${s.colLabel} ${s.right}`}>Buy @</span>
              <span className={`${s.colLabel} ${s.right}`}>Keep</span>
            </div>

            {lines.length === 0 ? (
              <p className={s.nothing}>
                Nothing on it yet. Add the first item and the figures below start counting.
              </p>
            ) : (
              lines.map((line, i) =>
                line.kind === 'item' ? (
                  <ItemRow key={line.id} line={line} at={i + 1} onQty={retype} onDrop={drop} />
                ) : (
                  <ChargeRow key={line.id} line={line} />
                ),
              )
            )}

            <div className={s.nextLine}>
              <span className={s.nextMark} aria-hidden="true">
                <Icon name="plus" size={13} strokeWidth={2.2} />
              </span>
              <span className={s.nextSay}>Next item, a charge, or credit terms</span>
              {commonCharges.map((c) => (
                <button key={c.name} type="button" className={s.pill}>
                  {c.name} <span className={s.pillFig}>{c.rate}</span>
                </button>
              ))}
              <button type="button" className={`${s.pill} ${s.pillOpen}`}>
                Other
              </button>
            </div>
          </section>
        </div>

        <aside className={s.aside}>
          <CheaperElsewhere lines={lines} />
          <StockToCover items={items} />

          {/* Both of these are about a customer the books know, and both
              are still the frame's own figures. `Goes with it` needs what
              this shop's orders actually carry together, and `Last order`
              needs the client picked rather than typed — neither is read
              yet, so neither is drawn about nobody. */}
          {client.id !== '' && (
            <>
              <section className={`${s.card} ${s.cardPad}`}>
                <div className={s.asideTitle}>Goes with it</div>
                <div className={s.pillWrap}>
                  {goesWithIt.map((g) => (
                    <button key={g.name} type="button" className={s.pill}>
                      {g.name} <span className={s.pillFig}>{g.rate}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className={`${s.card} ${s.cardPad}`}>
                <div className={s.asideHead}>
                  <span className={s.asideTitle}>Last order</span>
                  <span className={s.asideWhen}>{lastOrder.when}</span>
                </div>
                {lastOrder.lines.map((l) => (
                  <div key={l.name} className={s.pastRow}>
                    <span className={s.stockName}>{l.name}</span>
                    <span className={s.stockFig}>{Money.format(l.total)}</span>
                  </div>
                ))}
              </section>
            </>
          )}
        </aside>
      </div>

      <footer className={s.dock}>
        <div className={s.dockFirst}>
          <div className={s.dockLabel}>
            Client pays &#183; {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </div>
          <div className={s.dockPays}>
            {Money.format(pays)} <span className={s.dockPaysUnit}>UGX</span>
          </div>
        </div>
        <div className={s.dockCell}>
          <div className={s.dockLabel}>Costs you</div>
          <DerivedFigure value={cost} className={s.dockCost} />
        </div>
        <div className={s.dockKeep}>
          <div>
            <div className={s.dockLabel}>You keep</div>
            <DerivedFigure value={keep} className={s.dockFig} />
          </div>
          {lines.length === 0
            ? null
            : match(share, {
                known: (pc) => <ShareChip percent={pc} />,
                partial: (pc, _b, missing) => <ShareChip percent={pc} title={missing} />,
                unavailable: () => <span />,
              })}
        </div>

        <div className={s.spacer} />

        {said !== null && <p className={s.said}>{said}</p>}

        <div className={s.dockActions}>
          <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnDock}`}>
            <Icon name="message-circle" size={16} />
            Send on WhatsApp
          </button>
          <button
            type="button"
            className={`${s.btn} ${s.btnSecondary} ${s.btnSquare}`}
            aria-label="More for this quote"
          >
            <Icon name="more-horizontal" size={18} />
          </button>
          {/* The one accent-filled control on the screen.
              Disabled AS WELL AS guarded: the guard in `raiseQuote` is what
              makes a second press harmless, and the greyed button is what
              tells the person why nothing happened. Without it the fix
              looks exactly like the app ignoring them. */}
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary} ${s.btnDockPrimary}`}
            disabled={saving || whyNotSaveable(writeQuote({ client, date: '', lines }, null)) !== null}
            title={whyNotSaveable(writeQuote({ client, date: '', lines }, null)) ?? undefined}
            onClick={() => {
              void save();
            }}
          >
            {saving ? 'Saving\u2026' : 'Save quote'}
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * A pick, as a line on the quote.
 *
 * The id has to be unique on the document rather than on the catalogue: the
 * same thing can go on twice, at two quantities, from two suppliers — a
 * carton from Roto and three loose off the shelf is one order and two
 * lines, and keying them both by the product would draw one.
 */
function lineFrom(picked: Picked): ItemLine {
  const { thing, source, qty, countedIn, sellEach, buyEach } = picked;

  return {
    kind: 'item',
    id: asId(`${thing.productId}:${thing.variantIdx ?? ''}:${source.id}:${Date.now()}`),
    name: thing.name,
    unit: countedIn === 'pack' ? source.packUnit : source.unit,
    qty,
    priceEach: Money.roundDown(sellEach),
    // In base units, always. See `ItemLine.inStock`.
    inStock: onShelf(thing.lots),
    buyFrom: source.name,
    buyAt:
      buyEach === null
        ? unavailable(`nothing on file says what ${source.name} charges for this`)
        : known(Money.roundDown(buyEach), `${source.name}, ${qty} at a time`),
    source: {
      productId: thing.productId,
      variantIdx: thing.variantIdx,
      supplierId: source.id,
      packUnit: source.packUnit,
      packQty: source.packQty,
      countedIn,
    },
  };
}

function ShareChip({
  percent,
  title,
}: {
  readonly percent: number;
  readonly title?: string;
}): ReactElement {
  const tone = TONE[keepTone(percent)];
  return (
    <span
      className={s.chip}
      style={{ background: tone.bg, color: tone.ink }}
      title={title ?? undefined}
    >
      {percent}%
    </span>
  );
}

/* ------------------------------ client strip ------------------------------ */

function ClientStrip({
  client,
  date,
  onClient,
}: {
  readonly client: Client;
  readonly date: string;
  readonly onClient: (client: Client) => void;
}): ReactElement {
  const owesNothing = Money.isZero(client.owesNow);
  const known = client.id !== '';

  return (
    <section className={`${s.card} ${s.clip} ${s.strip}`}>
      <div className={s.cellClient}>
        <div className={s.cellLabel}>Client</div>
        <div className={s.cellValue}>
          <input
            className={`${s.clientName} ${s.clientField}`}
            value={client.name}
            placeholder="Who it is for"
            aria-label="Who the order is for"
            onChange={(e) => onClient({ ...client, name: e.target.value })}
          />
          <input
            className={`${s.clientPhone} ${s.clientField}`}
            value={client.phone}
            placeholder="Phone"
            aria-label="Their phone number"
            onChange={(e) => onClient({ ...client, phone: e.target.value })}
          />
        </div>
      </div>
      <div className={s.cell} style={{ flex: 0.9 }}>
        <div className={s.cellLabel}>Date</div>
        <div className={s.cellValue}>
          <span className={s.cellFigLight}>{date}</span>
        </div>
      </div>
      {/* Three cells that only mean something about somebody the books know.
          Typed into the field above, this is a counter sale — and `0 orders,
          owes nothing` about a name the shop has never seen is three
          confident figures about nobody. */}
      <div className={s.cell} style={{ flex: 0.7 }}>
        <div className={s.cellLabel}>Orders</div>
        <div className={s.cellValue}>
          <span className={s.cellFig}>{known ? client.orders : '\u2014'}</span>
        </div>
      </div>
      {/* Owing nothing is good news and the strip says so with a tint. */}
      <div
        className={`${s.cell} ${known && owesNothing ? s.cellGood : ''}`}
        style={{ flex: 0.9 }}
      >
        <div className={s.cellLabel}>Owes now</div>
        <div className={s.cellValue}>
          {known ? (
            <span
              className={s.cellFig}
              style={{ color: owesNothing ? v('good-ink') : v('bad-ink') }}
            >
              {Money.format(client.owesNow)} <span className={s.unit}>UGX</span>
            </span>
          ) : (
            <span className={s.cellFig}>&#8212;</span>
          )}
        </div>
      </div>
      <div className={s.cell} style={{ flex: 1.3 }}>
        <div className={s.cellLabel}>Last order</div>
        <div className={s.cellValue}>
          {client.lastOrder === null ? (
            <span className={s.when}>{known ? 'nothing yet' : 'not a recorded customer'}</span>
          ) : (
            <>
              <span className={s.cellFig}>{Money.format(client.lastOrder.total)}</span>
              <span className={s.when}>{client.lastOrder.when}</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- line rows -------------------------------- */

function ItemRow({
  line,
  at,
  onQty,
  onDrop,
}: {
  readonly line: ItemLine;
  readonly at: number;
  readonly onQty: (id: string, what: 'qty' | 'priceEach', typed: string) => void;
  readonly onDrop: (id: string) => void;
}): ReactElement {
  /**
   * What is in the box while somebody is typing in it.
   *
   * The price is read aloud on a call, so it is grouped like every other
   * figure on the screen — and a box that reformats under the caret moves
   * it, so the raw keystrokes stand until the field is left. `null` means
   * nobody is typing and the line's own figure is what shows.
   */
  const [typing, setTyping] = useState<{ readonly what: string; readonly text: string } | null>(
    null,
  );
  const box = (what: 'qty' | 'priceEach', shown: string): string =>
    typing?.what === what ? typing.text : shown;

  const type = (what: 'qty' | 'priceEach', text: string): void => {
    setTyping({ what, text });
    onQty(line.id, what, text);
  };

  return (
    <div className={s.row}>
      {/* The line number is the handle: hovering it offers to take the line
          off, so a row that is wrong does not need a control of its own
          sitting in every row that is right. */}
      <button
        type="button"
        className={s.num}
        aria-label={`Take ${line.name} off the quote`}
        onClick={() => onDrop(line.id)}
      >
        <span className={s.numAt}>{at}</span>
        <span className={s.numDrop} aria-hidden="true">
          <Icon name="x" size={12} strokeWidth={2.2} />
        </span>
      </button>

      <div style={{ minWidth: 0 }}>
        <div className={s.itemName}>{line.name}</div>
        <div className={s.itemMeta}>
          {line.unit} · <StockNote line={line} />
          {line.cheaperElsewhere !== undefined && (
            <>
              {' · '}
              <span className={s.metaWarn}>
                {Money.format(line.cheaperElsewhere.saves)} cheaper at{' '}
                {line.cheaperElsewhere.supplier}
              </span>
            </>
          )}
        </div>
      </div>

      <div className={s.qtyCell}>
        <input
          className={s.editable}
          value={box('qty', String(line.qty))}
          inputMode="decimal"
          aria-label={`Quantity, ${line.name}`}
          onChange={(e) => type('qty', e.target.value)}
          onBlur={() => setTyping(null)}
        />
        <span className={s.qtyUnit}>{line.unit}</span>
      </div>

      <div className={s.right}>
        <input
          className={s.editable}
          value={box('priceEach', Money.format(line.priceEach))}
          inputMode="decimal"
          aria-label={`Price each, ${line.name}`}
          onChange={(e) => type('priceEach', e.target.value)}
          onBlur={() => setTyping(null)}
        />
      </div>

      <div className={s.lineTotal}>
        {Money.format(lineTotal(line))} <span className={s.unit}>UGX</span>
      </div>

      <span className={s.divide} />

      <div className={s.supplier} title={line.buyFrom}>
        {line.buyFrom}
      </div>

      <div className={s.right}>
        {match(line.buyAt, {
          known: (at2) => <span className={s.buyAt}>{Money.format(at2)}</span>,
          partial: (at2, _b, missing) => (
            <span className={s.buyAt} title={missing}>
              {Money.format(at2)}
              <span className={s.unit}> +</span>
            </span>
          ),
          // Never a zero: nobody has bought this, so there is no cost to show
          // and no margin to claim.
          unavailable: (reason) => (
            <span className={s.buyAt} title={reason}>
              &#8212;
            </span>
          ),
        })}
      </div>

      <div className={s.right}>
        {match(lineKeepPercent(line), {
          known: (pc) => <ShareChip percent={pc} />,
          partial: (pc, _b, missing) => <ShareChip percent={pc} title={missing} />,
          unavailable: (reason) => (
            <span className={s.itemMeta} title={reason}>
              &#8212;
            </span>
          ),
        })}
      </div>
    </div>
  );
}

/**
 * What the shelf can do for this line, in the units the shelf counts in.
 *
 * Both figures are base units. A line quoted as 1 Ctn of 100 against eight
 * pieces on the shelf read `0 in stock`, which is true about cartons and
 * hides the eight — and the eight are what somebody would go and look at.
 */
function StockNote({ line }: { readonly line: ItemLine }): ReactElement {
  const short = shortOf(line);
  const unit = line.source.countedIn === 'pack' ? '' : ` ${line.unit}`;

  if (short === 0) {
    return (
      <>
        {line.inStock}
        {unit} in stock
      </>
    );
  }
  return (
    <span className={s.metaBad}>
      {line.inStock} in stock · {short} to order in
    </span>
  );
}

function ChargeRow({ line }: { readonly line: ChargeLine }): ReactElement {
  return (
    <div className={s.rowCharge}>
      <span />
      <div style={{ minWidth: 0 }}>
        <div className={s.chargeName}>
          {line.name} <span className={s.chargeBasis}>· {line.basis}</span>
        </div>
      </div>
      <span />
      <span />
      <div className={s.lineTotal}>
        {Money.format(line.amount)} <span className={s.unit}>UGX</span>
      </div>
      {/* The shop-side cells are EMPTY, not zero: a charge has no supplier and
          no buying price, and a dash in three columns would suggest it does. */}
      <span className={s.divide} />
      <span />
      <span />
      <span />
    </div>
  );
}

/* --------------------------------- aside ---------------------------------- */

function CheaperElsewhere({ lines }: { readonly lines: readonly QuoteLine[] }): ReactElement | null {
  const cheaper = lines.flatMap((line, i) =>
    line.kind === 'item' && line.cheaperElsewhere !== undefined
      ? [{ line, at: i + 1, alt: line.cheaperElsewhere }]
      : [],
  );
  const first = cheaper[0];
  if (first === undefined) return null;

  return (
    <section className={s.noticeWarn}>
      <div className={s.asideHead}>
        <span className={s.asideMark} aria-hidden="true">
          <Icon name="trending-down" size={15} />
        </span>
        <span className={s.asideTitle}>Cheaper elsewhere</span>
        <span
          className={`${s.chip} ${s.asideCount}`}
          style={{ background: v('warn-chip'), color: v('warn-ink') }}
        >
          1 of {cheaper.length}
        </span>
      </div>
      <div className={s.asideBody}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={s.asideItem}>{first.line.name}</div>
          <div className={s.asideMeta}>{first.alt.supplier} · last bought 20 Aug</div>
        </div>
        <span className={s.asideFig}>&#8722;{Money.format(first.alt.saves)}</span>
      </div>
      <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.asideAction}`}>
        Switch the supplier on line {first.at}
      </button>
    </section>
  );
}

function StockToCover({ items }: { readonly items: readonly ItemLine[] }): ReactElement | null {
  // Nothing on the quote is not "all covered". It is nothing to cover.
  if (items.length === 0) return null;

  const short = items.filter((l) => shortOf(l) > 0).length;
  return (
    <section className={`${s.card} ${s.cardPad}`}>
      <div className={s.asideHead}>
        <span className={s.asideTitle}>Stock to cover it</span>
        <span
          className={`${s.chip} ${s.asideCount}`}
          style={
            short > 0
              ? { background: v('bad-chip'), color: v('bad-ink') }
              : { background: v('good-chip-light'), color: v('good-ink') }
          }
        >
          {short > 0 ? `${short} short` : 'all covered'}
        </span>
      </div>
      <div className={s.stockList}>
        {items.map((line) => {
          const short = shortOf(line);
          return (
            <div key={line.id} className={s.stockRow}>
              <span className={`${s.stockName} ${short === 0 ? '' : s.stockShort}`}>
                {line.name}
              </span>
              {short === 0 ? (
                <span className={s.stockFig}>
                  {askedFor(line)} / {line.inStock}
                </span>
              ) : (
                <span className={s.stockFig} style={{ color: v('bad-ink') }}>
                  {line.inStock} / {short} <span className={s.stockOrderIn}>order in</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
