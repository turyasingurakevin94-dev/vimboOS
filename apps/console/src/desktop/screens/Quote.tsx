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

import type { ReactElement } from 'react';
import {
  Money,
  clientPays,
  costsYou,
  keepPercent,
  keepTone,
  lineKeepPercent,
  lineTotal,
  match,
  youKeep,
  type ChargeLine,
  type ItemLine,
  type QuoteLine,
} from '@ow/domain';
import { commonCharges, demoQuote, goesWithIt, lastOrder, usuallyBuys } from '@ow/data';
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

export function Quote(): ReactElement {
  const quote = demoQuote();
  const { lines, client } = quote;
  const pays = clientPays(lines);
  const cost = costsYou(lines);
  const keep = youKeep(lines);
  const share = keepPercent(lines);
  const items = lines.filter((l): l is ItemLine => l.kind === 'item');

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className={s.title}>Quote</h1>
          <p className={s.sub}>
            Build the order live, on the call · say the price, move to the next item
          </p>
        </div>
      </header>

      <div className={s.work}>
        <div className={s.lines}>
          <ClientStrip client={client} date={quote.date} />

          <section className={`${s.card} ${s.clip}`}>
            <div className={s.addRow}>
              <div className={s.addField}>
                <Icon name="search" size={16} style={{ color: v('ink-3'), flex: 'none' }} />
                <span className={s.addFieldText}>Add item — name, SKU or supplier code</span>
                <span className={s.key} aria-hidden="true">
                  /
                </span>
              </div>
            </div>

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

            {lines.map((line, i) =>
              line.kind === 'item' ? (
                <ItemRow key={line.id} line={line} at={i + 1} />
              ) : (
                <ChargeRow key={line.id} line={line} />
              ),
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
        </aside>
      </div>

      <footer className={s.dock}>
        <div className={s.dockFirst}>
          <div className={s.dockLabel}>Client pays · {lines.length} lines</div>
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
          {match(share, {
            known: (pc) => <ShareChip percent={pc} />,
            partial: (pc, _b, missing) => <ShareChip percent={pc} title={missing} />,
            unavailable: () => <span />,
          })}
        </div>

        <div className={s.spacer} />

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
          {/* The one accent-filled control on the screen. */}
          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnDockPrimary}`}>
            Save quote
          </button>
        </div>
      </footer>
    </div>
  );
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
}: {
  readonly client: ReturnType<typeof demoQuote>['client'];
  readonly date: string;
}): ReactElement {
  const owesNothing = Money.isZero(client.owesNow);
  return (
    <section className={`${s.card} ${s.clip} ${s.strip}`}>
      <div className={s.cellClient}>
        <div className={s.cellLabel}>Client</div>
        <div className={s.cellValue}>
          <span className={s.clientName}>{client.name}</span>
          <span className={s.clientPhone}>{client.phone}</span>
        </div>
      </div>
      <div className={s.cell} style={{ flex: 0.9 }}>
        <div className={s.cellLabel}>Date</div>
        <div className={s.cellValue}>
          <span className={s.cellFigLight}>{date}</span>
        </div>
      </div>
      <div className={s.cell} style={{ flex: 0.7 }}>
        <div className={s.cellLabel}>Orders</div>
        <div className={s.cellValue}>
          <span className={s.cellFig}>{client.orders}</span>
        </div>
      </div>
      {/* Owing nothing is good news and the strip says so with a tint. */}
      <div
        className={`${s.cell} ${owesNothing ? s.cellGood : ''}`}
        style={{ flex: 0.9 }}
      >
        <div className={s.cellLabel}>Owes now</div>
        <div className={s.cellValue}>
          <span
            className={s.cellFig}
            style={{ color: owesNothing ? v('good-ink') : v('bad-ink') }}
          >
            {Money.format(client.owesNow)} <span className={s.unit}>UGX</span>
          </span>
        </div>
      </div>
      <div className={s.cell} style={{ flex: 1.3 }}>
        <div className={s.cellLabel}>Last order</div>
        <div className={s.cellValue}>
          {client.lastOrder === null ? (
            <span className={s.when}>nothing yet</span>
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

function ItemRow({ line, at }: { readonly line: ItemLine; readonly at: number }): ReactElement {
  return (
    <div className={s.row}>
      <span className={s.num}>{at}</span>

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
        <input className={s.editable} defaultValue={line.qty} aria-label={`Quantity, ${line.name}`} />
        <span className={s.qtyUnit}>{line.unit}</span>
      </div>

      <div className={s.right}>
        <input
          className={s.editable}
          defaultValue={Money.format(line.priceEach)}
          aria-label={`Price each, ${line.name}`}
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
          known: (at2) => (
            <input
              className={`${s.editable} ${s.editableBuy}`}
              defaultValue={Money.format(at2)}
              aria-label={`Bought at, ${line.name}`}
            />
          ),
          partial: (at2) => (
            <input
              className={`${s.editable} ${s.editableBuy}`}
              defaultValue={Money.format(at2)}
              aria-label={`Bought at, ${line.name}`}
            />
          ),
          // Never a zero: nobody has bought this, so there is no cost to show
          // and no margin to claim.
          unavailable: (reason) => (
            <span className={`${s.editable} ${s.editableBuy}`} title={reason}>
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

/** What the shelf can do for this line, in the words the line uses. */
function StockNote({ line }: { readonly line: ItemLine }): ReactElement {
  if (line.inStock >= line.qty) return <>{line.inStock} in stock</>;
  const short = line.qty - line.inStock;
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

function StockToCover({ items }: { readonly items: readonly ItemLine[] }): ReactElement {
  const short = items.filter((l) => l.qty > l.inStock).length;
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
          const covered = line.inStock >= line.qty;
          return (
            <div key={line.id} className={s.stockRow}>
              <span className={`${s.stockName} ${covered ? '' : s.stockShort}`}>{line.name}</span>
              {covered ? (
                <span className={s.stockFig}>
                  {line.qty} / {line.inStock}
                </span>
              ) : (
                <span className={s.stockFig} style={{ color: v('bad-ink') }}>
                  {line.inStock} / {line.qty - line.inStock}{' '}
                  <span className={s.stockOrderIn}>order in</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
