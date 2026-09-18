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
import { useQueryClient } from '@tanstack/react-query';
import {
  Money,
  asId,
  askedFor,
  balance,
  chargeAmount,
  clientFrom,
  clientPays,
  goodsTotal,
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
  type Customer,
  type ItemLine,
  type QuoteLine,
} from '@ow/domain';
import {
  boughtInLines,
  raiseQuote,
  stageOf,
  whyNotSaveable,
  writeQuote,
  type NewQuote,
  type Service,
} from '@ow/data';
import { useCatalogue } from '../../app/useCatalogue.js';
import { useBooks } from '../../app/Books.js';
import { useRegister } from '../../app/useRegister.js';
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
 *
 * **Which way a partial figure is wrong depends on which figure it is**, and
 * it used to wear `+` either way. A cost missing a line is at LEAST what is
 * shown; the margin left over is at MOST what is shown. `5,150 +` on a
 * margin said the opposite of the truth, in the direction that flatters the
 * shop — the same direction the charge's own missing cost already leans.
 */
function DerivedFigure({
  value,
  className,
  bound,
}: {
  readonly value: ReturnType<typeof youKeep>;
  readonly className: string | undefined;
  readonly bound: 'at least' | 'at most';
}): ReactElement {
  return match(value, {
    known: (amount) => <span className={className}>{Money.format(amount)}</span>,
    partial: (amount, _basis, missing) => (
      <span className={className} title={`${bound} this much — ${missing}`}>
        {Money.format(amount)}
        <span className={s.dockPaysUnit}> {bound}</span>
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

/**
 * Where the order just saved has gone, in the lane's own words.
 *
 * Read off the same `stageOf` the row was written with rather than stated
 * as a fact about Taken. It used to say Taken either way, which was wrong
 * about every order filled off the shelf — and the person reading it would
 * then go looking in the lane it is not in.
 */
function landedIn(order: NewQuote): string {
  if (stageOf(order) !== 'draft') {
    return 'Everything on it is off our own shelf, so it is in Preparing, waiting to be picked.';
  }
  const waiting = new Set(boughtInLines(order).map((i) => i.supplierName)).size;
  return `It waits in Taken until ${
    waiting === 1 ? 'the supplier on it has' : `all ${waiting} suppliers on it have`
  } answered.`;
}

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
  const cache = useQueryClient();
  // Read here rather than inside the strip: the same register answers the
  // aside panels, and two reads of it are two answers about one account.
  const people = useRegister();
  const [lines, setLines] = useState<readonly QuoteLine[]>([]);
  const [client, setClient] = useState<Client>(NOBODY);
  /**
   * The account behind the name, where the name is one the books know.
   *
   * Held beside the client rather than folded into it: `Client` is what the
   * quote's own strip reads, and what they usually buy is a fact about the
   * ACCOUNT. Pushing it onto the quote would be the quote carrying a copy
   * of the register.
   */
  const [account, setAccount] = useState<Customer | null>(null);
  const [picking, setPicking] = useState(false);
  /** What came of the last press of Save, in words. */
  const [said, setSaid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Worked out once for the whole document: every percent charge is a
  // percent of THIS, so two of them come to the same total whichever was
  // added first, and neither is ever a percent of the other.
  const goods = goodsTotal(lines);
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

  /**
   * A charge, at the rule the shop set — never at the shillings it happens
   * to come to now. A percent frozen at the moment it was tapped goes stale
   * on the next line added.
   *
   * The label is copied rather than referenced, which is the opposite rule
   * for the opposite reason: an order is a record of what was agreed, and
   * renaming the service next month must not rewrite it.
   */
  /** Whether this charge is already on the order. */
  const on = (service: Service): boolean =>
    lines.some((l) => l.kind === 'charge' && l.service === service.name);

  const addCharge = (service: Service): void => {
    setLines((prior) => [
      ...prior,
      {
        kind: 'charge',
        id: `charge:${service.name}`,
        name: service.name,
        basis: service.type === 'percent' ? `${service.value}% of the goods` : 'charge',
        rule: { type: service.type, value: service.value },
        service: service.name,
        // What it costs the shop is a payment, and none has been made.
        cost: null,
      },
    ]);
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

    const order = writeQuote(
      { client, date: dayReads(read.today), lines },
      client.id === '' ? null : client.id,
    );

    setSaving(true);
    setSaid(null);
    const written = await raiseQuote(books.shopId, order, read.today);
    setSaving(false);

    if (!written.ok) {
      setSaid(written.why);
      return;
    }

    // Every screen that reads an order is now out of date — the board and
    // its Live count above all, and Today's figures behind them. Re-read
    // rather than push the new order into a cache by hand: the board is a
    // reckoning of rows, and a second one assembled here is how two
    // screens start disagreeing about the same order.
    //
    // Without this the order was in the books and on nobody's board until
    // somebody reloaded the page: the cache holds a read for a minute
    // (see `Books.tsx`), so opening Order tracking re-used the answer from
    // before the save.
    void cache.invalidateQueries();

    setSaid(`Saved as #${written.id}. ${landedIn(order)}`);
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
          <ClientStrip
            client={client}
            date={dayReads(read.today)}
            onClient={(next, who) => {
              setClient(next);
              setAccount(who);
            }}
            register={people.at === 'ready' ? people.data.customers : []}
            account={account}
          />

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

            {/* What this account actually buys, from the sales analytics
                derivation the Customers panel already draws — the share of
                their spend each line takes. Not a guess at what they might
                want: a fact about what they have bought. */}
            {account !== null && account.buys.length > 0 && (
              <div className={s.suggests}>
                <span className={s.suggestLabel}>Usually buys</span>
                {account.buys.slice(0, 3).map((u) => (
                  <button key={u.product} type="button" className={s.pill}>
                    {u.product} <span className={s.pillFig}>{u.shareOfSpend}%</span>
                  </button>
                ))}
                {account.buys.length > 3 && (
                  <button type="button" className={`${s.pill} ${s.pillOpen}`}>
                    +{account.buys.length - 3} more
                  </button>
                )}
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
                  <ChargeRow key={line.id} line={line} amount={chargeAmount(line, goods)} />
                ),
              )
            )}

            {/* The charges the shop has agreed it makes, off its own
                services list — a name, a kind and a figure it set up once.
                These were three invented rates, and this shop has one. */}
            <div className={s.nextLine}>
              <span className={s.nextMark} aria-hidden="true">
                <Icon name="plus" size={13} strokeWidth={2.2} />
              </span>
              <span className={s.nextSay}>
                {read.data.services.length === 0
                  ? 'Next item. No charges are set up for this shop yet.'
                  : 'Next item, or a charge'}
              </span>
              {read.data.services.map((service) => (
                <button
                  key={service.name}
                  type="button"
                  // A toggle, not a one-way door. A charge added by mistake
                  // has to come off, and a charge has no line number to
                  // hang a handle on — the pill that put it there is the
                  // obvious place to take it back.
                  className={`${s.pill} ${on(service) ? s.pillOn : ''}`}
                  aria-pressed={on(service)}
                  onClick={() => (on(service) ? drop(`charge:${service.name}`) : addCharge(service))}
                >
                  {service.name}{' '}
                  <span className={s.pillFig}>
                    {service.type === 'percent'
                      ? `${service.value}%`
                      : Money.format(Money.roundDown(service.value))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className={s.aside}>
          <CheaperElsewhere lines={lines} />
          <StockToCover items={items} />

          {/* `Goes with it` and the last order's LINES are the two things
              this panel asked for that nothing here can answer. What goes
              with what is its own derivation across the shop's orders, and
              a `CustomerInvoice` carries a document and a total but not the
              lines under it. Drawn from the frame's own figures, both would
              be fiction pinned to a real account — which is worse than the
              gap, because the account makes it look checked.

              What the account DOES say is above, on `Usually buys`. */}
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
          <DerivedFigure value={cost} className={s.dockCost} bound="at least" />
        </div>
        <div className={s.dockKeep}>
          <div>
            <div className={s.dockLabel}>You keep</div>
            <DerivedFigure value={keep} className={s.dockFig} bound="at most" />
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

/**
 * Who the order is for: typed, and matched against the register as it goes.
 *
 * A name typed freehand is a counter sale, and a real thing — but most
 * orders are for somebody the books already know, and the three cells to
 * the right of the name only mean anything about one of those. So the field
 * offers what it matches rather than making somebody go and look the
 * account up: the same words, in the same order, as the item search, which
 * is the only other thing on this screen that finds something.
 */
function ClientStrip({
  client,
  date,
  onClient,
  register,
  account,
}: {
  readonly client: Client;
  readonly date: string;
  readonly onClient: (client: Client, account: Customer | null) => void;
  readonly register: readonly Customer[];
  /** The account behind the name, where the books know one. */
  readonly account: Customer | null;
}): ReactElement {
  const [looking, setLooking] = useState(false);
  const owesNothing = Money.isZero(client.owesNow);
  const known = client.id !== '';

  const words = client.name.trim().toLowerCase();
  const hits =
    words === ''
      ? []
      : register
          .filter((c) => `${c.name} ${c.phone} ${c.area}`.toLowerCase().includes(words))
          .slice(0, 6);

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
            autoComplete="off"
            onFocus={() => setLooking(true)}
            onChange={(e) => {
              setLooking(true);
              // Typing over a matched account unmatches it: the figures
              // beside the name belong to whoever the name says, and a
              // half-edited name pointing at the old account's balance is
              // the wrong customer's debt on somebody else's quote.
              onClient({ ...NOBODY, name: e.target.value, phone: known ? '' : client.phone }, null);
            }}
            onBlur={() => window.setTimeout(() => setLooking(false), 120)}
          />
          <input
            className={`${s.clientPhone} ${s.clientField}`}
            value={client.phone}
            placeholder="Phone"
            aria-label="Their phone number"
            // A phone corrected on a matched account is a correction to
            // this order, not to the register — the account it points at is
            // unchanged, and this app does not edit customers.
            onChange={(e) => onClient({ ...client, phone: e.target.value }, account)}
          />

          {looking && hits.length > 0 && (
            <div className={s.found}>
              {hits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={s.foundRow}
                  // mousedown, not click: the field's own blur would close
                  // the list out from under the press.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onClient(clientFrom({ ...c, balance: balance(c) }), c);
                    setLooking(false);
                  }}
                >
                  <span className={s.foundName}>{c.name}</span>
                  <span className={s.foundMeta}>
                    {c.area === '' ? c.phone : `${c.area} · ${c.phone}`}
                  </span>
                  {!Money.isZero(balance(c)) && (
                    <span className={s.foundOwes}>{Money.format(balance(c))} owing</span>
                  )}
                </button>
              ))}
            </div>
          )}
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

/**
 * A charge is drawn at what it comes to, worked out from the goods on the
 * quote right now — never from a figure frozen when somebody tapped it. A
 * percent that does not move when a line is added is a document printing
 * `3%` beside a figure that is three per cent of something else.
 */
function ChargeRow({
  line,
  amount,
}: {
  readonly line: ChargeLine;
  readonly amount: Money.Money;
}): ReactElement {
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
        {Money.format(amount)} <span className={s.unit}>UGX</span>
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
