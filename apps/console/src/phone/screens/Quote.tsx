/**
 * Quote — the phone. Frames 4b and 4c of the Quote handoff.
 *
 * **This is not the desktop screen narrowed.** The desktop puts the client's
 * side and the shop's side on one row, divided by a pixel, and hangs a 310px
 * column of derivations beside it. At 390 there is no such row and no such
 * column, so the screen is two tabs:
 *
 * - **The lines** — the quote itself, edge to edge, with the shop's side
 *   folded into one summary row at the foot of the list.
 * - **Client & stock** — the desktop's whole right column, plus its client
 *   strip. The handoff says in words not to leave this unbuilt, and it is
 *   right: "is he good for it" and "can I even supply it" are the two
 *   questions a quote is refused over.
 *
 * The dock is the same on both, because the figure is the same figure.
 *
 * As on the desktop, the totals are **computed from the lines**; the frames'
 * own docks read 519,120 over a table that adds to 579,120. See the note at
 * the head of the desktop screen and `quote.test.ts`.
 */

import { useState, type ReactElement } from 'react';
import {
  Money,
  clientPays,
  costsYou,
  keepPercent,
  keepTone,
  lineTotal,
  match,
  youKeep,
  type ChargeLine,
  type ItemLine,
} from '@ow/domain';
import { commonCharges, demoQuote, goesWithIt, lastOrder } from '@ow/data';
import s from './Quote.module.css';
import { Mark, PATH } from '../icons.js';

const v = (t: string): string => `var(--ow-color-${t})`;

const TONE = {
  good: { background: v('good-chip-light'), color: v('good-ink') },
  warn: { background: v('warn-fill'), color: v('warn-ink') },
  bad: { background: v('bad-chip'), color: v('bad-ink') },
} as const;

type Tab = 'lines' | 'client';

export function Quote(): ReactElement {
  const [tab, setTab] = useState<Tab>('lines');
  /**
   * One line is open at a time. Opening a second closes the first, which is
   * not a limitation — it is what stops a thumb landing in the wrong stepper
   * after the list has grown two rows taller somewhere above.
   */
  const [open, setOpen] = useState<string | null>('v-bowsaw');

  const quote = demoQuote();
  const { lines, client } = quote;
  const pays = clientPays(lines);
  const items = lines.filter((l): l is ItemLine => l.kind === 'item');
  const asideCount = 4;

  return (
    <div className={s.screen}>
      <header className={s.header}>
        <div className={s.headTop}>
          <span className={s.mark} aria-hidden="true">
            <Mark d={PATH.box} size={14} />
          </span>
          <div className={s.headTitles}>
            <span className={s.headTitle}>Quote</span>
            <span className={s.headWho}>
              {client.name.split(' ')[0]} · {quote.date.slice(0, 6)}
            </span>
          </div>
          <button type="button" className={s.headBtn} aria-label="Search this quote">
            <Mark d={PATH.search} size={18} />
          </button>
          <button type="button" className={s.headBtn} aria-label="More for this quote">
            <Mark d={PATH.dots} size={18} />
          </button>
        </div>

        <div className={s.switch} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'lines'}
            className={`${s.switchTab} ${tab === 'lines' ? s.switchOn : ''}`}
            onClick={() => setTab('lines')}
          >
            The lines <span className={s.switchCount}>{lines.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'client'}
            className={`${s.switchTab} ${tab === 'client' ? s.switchOn : ''}`}
            onClick={() => setTab('client')}
          >
            Client &amp; stock <span className={s.switchCount}>{asideCount}</span>
          </button>
        </div>
      </header>

      {tab === 'lines' ? (
        <Lines
          lines={lines}
          open={open}
          onOpen={(id) => setOpen((prior) => (prior === id ? null : id))}
        />
      ) : (
        <ClientAndStock client={client} items={items} lines={lines} />
      )}

      <footer className={s.dock}>
        <div className={s.dockFirst}>
          <div className={s.dockLabel}>Client pays · {lines.length} lines</div>
          <div className={s.dockFig}>
            {Money.format(pays)} <span className={s.dockUnit}>UGX</span>
          </div>
        </div>
        <button type="button" className={s.dockSquare} aria-label="Send on WhatsApp">
          <Mark d={PATH.message} size={19} />
        </button>
        <button type="button" className={s.dockSave}>
          Save quote
        </button>
      </footer>
    </div>
  );
}

/* ---------------------------------- 4b ------------------------------------ */

function Lines({
  lines,
  open,
  onOpen,
}: {
  readonly lines: ReturnType<typeof demoQuote>['lines'];
  readonly open: string | null;
  readonly onOpen: (id: string) => void;
}): ReactElement {
  const cost = costsYou(lines);
  const keep = youKeep(lines);
  const share = keepPercent(lines);

  return (
    <>
      <div className={s.addBand}>
        <button type="button" className={s.addField}>
          <Mark d={PATH.search} size={16} />
          <span className={s.addFieldText}>Add item — name, SKU or code</span>
        </button>
      </div>

      <div className={s.list}>
        <div className={s.listHead}>
          <span />
          <span className={s.colLabel}>Item</span>
          <span className={s.colLabel}>Line total</span>
        </div>

        {lines.map((line, i) =>
          line.kind === 'item' ? (
            <ItemRow
              key={line.id}
              line={line}
              at={i + 1}
              open={open === line.id}
              onOpen={() => onOpen(line.id)}
            />
          ) : (
            <ChargeRow key={line.id} line={line} />
          ),
        )}

        <div className={s.nextLine}>
          <span className={s.nextMark} aria-hidden="true">
            <Mark d={PATH.plus} size={12} />
          </span>
          {commonCharges.slice(0, 2).map((c) => (
            <button key={c.name} type="button" className={s.pill}>
              {c.name} <span className={s.pillFig}>{c.rate}</span>
            </button>
          ))}
          <button type="button" className={`${s.pill} ${s.pillOpen}`}>
            Other
          </button>
        </div>

        {/* Everything right of the desktop's one-pixel divider, folded. */}
        <button type="button" className={s.shopSide}>
          <span className={s.shopSay}>
            Shop side · costs you <DerivedFigure value={cost} className={s.shopFig} /> · you
            keep <DerivedFigure value={keep} className={s.shopKeep} />
          </span>
          {match(share, {
            known: (pc) => (
              <span className={s.chip} style={TONE[keepTone(pc)]}>
                {pc}%
              </span>
            ),
            partial: (pc, _b, missing) => (
              <span className={s.chip} style={TONE[keepTone(pc)]} title={missing}>
                {pc}%
              </span>
            ),
            unavailable: () => <span />,
          })}
          <span className={s.shopCaret} aria-hidden="true">
            <Mark d={PATH.chevron} size={14} />
          </span>
        </button>
      </div>
    </>
  );
}

function ItemRow({
  line,
  at,
  open,
  onOpen,
}: {
  readonly line: ItemLine;
  readonly at: number;
  readonly open: boolean;
  readonly onOpen: () => void;
}): ReactElement {
  const short = line.qty > line.inStock;
  return (
    <div className={open ? s.rowOpen : s.row} onClick={open ? undefined : onOpen}>
      <span className={s.num}>{at}</span>

      <div className={s.name}>
        {line.name}
        {open && <span className={s.nameSupplier}> · {line.buyFrom.split(' ')[0]}</span>}
      </div>
      <div className={s.total}>{Money.format(lineTotal(line))}</div>

      {open ? (
        <div className={s.edit}>
          <div className={s.stepper}>
            <button type="button" className={s.stepDown} aria-label={`One fewer ${line.name}`}>
              <Mark d={PATH.minus} size={15} />
            </button>
            <span className={s.qty}>
              {line.qty} <span className={s.qtyUnit}>{line.unit}</span>
            </span>
            <button type="button" className={s.stepUp} aria-label={`One more ${line.name}`}>
              <Mark d={PATH.plus} size={15} />
            </button>
          </div>
          <span className={s.times}>&#215;</span>
          <div className={s.priceField}>
            <input
              className={s.priceFig}
              defaultValue={Money.format(line.priceEach)}
              aria-label={`Price each, ${line.name}`}
            />
            <span className={s.priceEach}>each</span>
          </div>
        </div>
      ) : (
        <div className={s.sub}>
          <span className={s.subFig}>
            {line.qty} {line.unit}
          </span>
          <span>&#215;</span>
          <span className={s.subFig}>{Money.format(line.priceEach)}</span>
          <span className={s.subSpacer} />
          {short ? (
            <span className={s.subShort}>{line.inStock} in stock</span>
          ) : (
            <span className={s.subFrom}>{line.buyFrom}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ChargeRow({ line }: { readonly line: ChargeLine }): ReactElement {
  return (
    <div className={s.rowCharge}>
      <span />
      <div className={s.chargeName}>
        {line.name} <span className={s.nameSupplier}>· {line.basis}</span>
      </div>
      {/* A charge you typed carries the dotted rule; one the app worked out
          from a rate does not, because changing it would change the rate. */}
      <div className={`${s.total} ${line.basis === 'charge' ? s.typed : ''}`}>
        {Money.format(line.amount)}
      </div>
    </div>
  );
}

/* ---------------------------------- 4c ------------------------------------ */

function ClientAndStock({
  client,
  items,
  lines,
}: {
  readonly client: ReturnType<typeof demoQuote>['client'];
  readonly items: readonly ItemLine[];
  readonly lines: ReturnType<typeof demoQuote>['lines'];
}): ReactElement {
  const cheaper = lines.flatMap((line, i) =>
    line.kind === 'item' && line.cheaperElsewhere !== undefined
      ? [{ line, at: i + 1, alt: line.cheaperElsewhere }]
      : [],
  );
  const first = cheaper[0];
  const shortLines = items.filter((l) => l.qty > l.inStock);
  const shortest = shortLines[0];

  return (
    <div className={s.cards}>
      <section className={s.card}>
        <div className={s.clientTop}>
          <span className={s.clientName}>{client.name}</span>
          <span className={s.clientPhone}>{client.phone}</span>
        </div>
        <div className={s.tiles}>
          <div className={s.tile}>
            <div className={s.tileLabel}>Orders</div>
            <div className={s.tileFig}>{client.orders}</div>
          </div>
          <div className={Money.isZero(client.owesNow) ? s.tileGood : s.tile}>
            <div className={s.tileLabel}>Owes now</div>
            <div
              className={s.tileFig}
              style={{ color: Money.isZero(client.owesNow) ? v('good-ink') : v('bad-ink') }}
            >
              {Money.format(client.owesNow)}
            </div>
          </div>
          <div className={s.tile}>
            <div className={s.tileLabel}>Last order</div>
            <div className={s.tileFig}>
              {client.lastOrder === null ? '—' : Money.format(client.lastOrder.total)}
            </div>
          </div>
        </div>
        <div className={s.behaviour}>
          Paid inside 14 days on 11 of 12 · last order {client.lastOrder?.when ?? 'never'}
        </div>
      </section>

      {first !== undefined && (
        <section className={s.noticeWarn}>
          <div className={s.cardHead}>
            <span className={s.cardMark} aria-hidden="true">
              <Mark d={PATH.down} size={14} />
            </span>
            <span className={s.cardTitle}>Cheaper elsewhere</span>
            <span
              className={`${s.chip19} ${s.cardRight}`}
              style={{ background: v('warn-chip'), color: v('warn-ink') }}
            >
              1 of {cheaper.length}
            </span>
          </div>
          <div className={s.noticeBody}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={s.noticeItem}>{first.line.name}</div>
              <div className={s.noticeMeta}>{first.alt.supplier} · last bought 20 Aug</div>
            </div>
            <span className={s.noticeFig}>&#8722;{Money.format(first.alt.saves)}</span>
          </div>
          <button type="button" className={s.noticeAction}>
            Switch the supplier on line {first.at}
          </button>
        </section>
      )}

      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardTitle}>Stock to cover it</span>
          <span
            className={`${s.chip19} ${s.cardRight}`}
            style={
              shortLines.length > 0
                ? { background: v('bad-chip'), color: v('bad-ink') }
                : { background: v('good-chip-light'), color: v('good-ink') }
            }
          >
            {shortLines.length > 0 ? `${shortLines.length} short` : 'all covered'}
          </span>
        </div>
        <div className={s.lineList}>
          {items.map((line) => {
            const covered = line.inStock >= line.qty;
            return (
              <div key={line.id} className={s.lineRow}>
                <span className={covered ? s.lineName : s.lineShort}>{line.name}</span>
                {covered ? (
                  <span className={s.lineFig}>
                    {line.qty} / {line.inStock}
                  </span>
                ) : (
                  <span className={s.lineFigShort}>
                    {line.inStock} / {line.qty - line.inStock}{' '}
                    <span className={s.orderIn}>order in</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* What to do about the short line, not just that it is short. */}
        {shortest !== undefined && (
          <div className={s.cardFoot}>
            {shortest.buyFrom} delivers next day ·{' '}
            {match(shortest.buyAt, {
              known: (at) => <span className={s.lineFig}>{Money.format(at)}</span>,
              partial: (at) => <span className={s.lineFig}>{Money.format(at)}</span>,
              unavailable: (reason) => <span title={reason}>price unknown</span>,
            })}{' '}
            each
          </div>
        )}
      </section>

      <section className={s.card}>
        <div className={s.cardTitle}>Goes with it</div>
        <div className={s.pillWrap}>
          {goesWithIt.map((g) => (
            <button key={g.name} type="button" className={s.pillTall}>
              {g.name} <span className={s.pillFig}>{g.rate}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardTitle}>Last order</span>
          <span className={s.cardWhen}>{lastOrder.when}</span>
        </div>
        {lastOrder.lines.map((l) => (
          <div key={l.name} className={s.pastRow}>
            <span className={s.lineName}>{l.name}</span>
            <span className={s.lineFig}>{Money.format(l.total)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

/**
 * A figure that could not be derived is an em dash with its reason on hover,
 * never a zero. A partial one carries a `+`: this much is real, and there is
 * more that the app could not work out.
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
        {Money.format(amount)}+
      </span>
    ),
    unavailable: (reason) => (
      <span className={className} title={reason}>
        &#8212;
      </span>
    ),
  });
}
