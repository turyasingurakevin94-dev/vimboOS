/**
 * Invoices — the desktop console. Frame 1b of the Invoices handoff.
 *
 * ## Two facing ledgers, because it is one piece of money
 *
 * The Sales / Purchases toggle is gone. A sale and the purchases raised to
 * fill it are not two lists to switch between — they are the two halves of
 * one transaction, and the question "did I make anything on Ken Bwaise's
 * order" needs both on screen at once. So: money in on the left, money out
 * on the right, and **picking a row on either side dims everything the other
 * side does not touch.**
 *
 * That dimming is not a view concern. `linkedTo` in `@ow/domain` returns the
 * set of documents a selection touches, and both ledgers read the same set —
 * which is what stops them disagreeing about what is lit, as they would the
 * moment each decided for itself.
 *
 * ## Every figure is derived
 *
 * The band's four figures come from `readBand` over the same rows drawn
 * beneath it. The handoff's rule is that one reckoning serves the ledger and
 * the dialog both, and a band figure typed by hand is how that rule gets
 * broken quietly. `demo-invoices.test.ts` pins the whole chain: the demo
 * rows derive to 6,614,000 owed, 3,104,300 owing, +3,509,700 net and 159
 * invoices at 93% received — exactly what the frame draws.
 *
 * ## What is drawn differently from the frame, and why
 *
 * The skin is this app's, by the owner's decision — see the mapping at the
 * head of `Invoices.module.css`. Two other departures, both stated rather
 * than slipped in:
 *
 * 1. **One accent fill, not three.** The frame fills `New invoice`,
 *    `Receive` on the picked row and `Pay` on the purchase due today. The
 *    design system allows one, and the handoff's own checklist asks for one.
 *    The next action on a register of debts is collecting the money you are
 *    looking at, so the picked row keeps it.
 * 2. **Dimmed rows sit at 0.6, not 0.42.** At 0.42 body ink measures about
 *    2.7:1 on white, and a dimmed row is still clickable so it is not the
 *    "inactive component" the contrast rule exempts.
 */

import { useState, type ReactElement } from 'react';
import {
  Money,
  balanceDue,
  byAttention,
  daysOld,
  linkedTo,
  match,
  paidOffShare,
  readBand,
  state,
  stillToPay,
  type PurchaseInvoice,
  type SalesInvoice,
} from '@ow/domain';
import { useLedgers } from '../../app/useLedgers.js';
import s from './Invoices.module.css';
import { ReceivePayment } from './ReceivePayment.js';
import { Icon } from '../icons.js';

const v = (token: string): string => `var(--ow-color-${token})`;

/** How many rows a ledger shows before the foot takes over the counting. */
const SHOWN = 6;

const TAG = {
  late: { background: v('bad-chip'), color: v('bad-ink') },
  open: { background: v('warn-fill'), color: v('warn-ink') },
  part: { background: v('neutral-chip'), color: v('neutral-ink') },
  settled: { background: v('good-chip-light'), color: v('good-ink') },
  voided: { background: v('neutral-chip'), color: v('neutral-ink') },
  unknown: { background: v('neutral-chip'), color: v('neutral-ink') },
} as const;

export function Invoices(): ReactElement {
  // Not `state` — that name belongs to the domain reckoning imported above,
  // and shadowing it here is how a row's tone quietly starts reading the
  // wrong thing.
  const read = useLedgers();
  if (read.at === 'loading') return <Waiting />;
  if (read.at === 'failed') return <Refused why={read.why} />;
  return <Register read={read} />;
}

/**
 * Reading, not empty.
 *
 * The distinction is the whole reason `useLedgers` is three-way: PostgREST
 * answers "still fetching", "refused by RLS" and "this shop has no invoices"
 * with the same empty array, and only the last is a ledger worth drawing.
 */
function Waiting(): ReactElement {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.titles}>
          <h1 className={s.title}>Invoices</h1>
          <p className={s.sub}>Reading the books…</p>
        </div>
      </header>
    </div>
  );
}

function Refused({ why }: { readonly why: string }): ReactElement {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.titles}>
          <h1 className={s.title}>Invoices</h1>
          {/* What failed, in the words the database used. An empty ledger
              here would be a claim that nothing is owed. */}
          <p className={s.sub}>The books could not be read. {why}</p>
        </div>
      </header>
    </div>
  );
}

function Register({
  read,
}: {
  readonly read: Extract<ReturnType<typeof useLedgers>, { at: 'ready' }>;
}): ReactElement {
  const now = read.today;
  const { sales, purchases, unreadable } = read.data;
  const band = readBand(sales, purchases, now);

  /**
   * Null is the resting state: no question asked yet, so nothing is dimmed.
   *
   * The example books open on the frame's picked row, because that is the
   * frame. The real books open at rest — an invoice number carried over from
   * a mockup would either dim a shop's whole register or, worse, silently
   * match a real invoice and claim a link nobody asked about.
   */
  const [picked, setPicked] = useState<string | null>(read.live ? null : 'INV-0175');
  /** Which invoice's Receive dialog is open. Null is closed. */
  const [receiving, setReceiving] = useState<string | null>(null);
  const lit = linkedTo(picked, sales, purchases);

  const open = sales
    .filter((x) => x.voided === undefined && !Money.isZero(balanceDue(x)))
    .sort(byAttention(now));
  /**
   * The right ledger puts what the selection touches at the top.
   *
   * Dimming alone is not enough when only six of ten rows fit: the purchases
   * that fund the picked sale could be dimmed AND below the fold, which is
   * the opposite of what picking it was for. A voided one that is linked
   * stays in — "this was withdrawn and replaced" is exactly what you want to
   * see while looking at the sale it was raised for.
   */
  const outRows = [...purchases]
    .sort((a, b) => (lit.has(a.doc) ? 0 : 1) - (lit.has(b.doc) ? 0 : 1))
    .slice(0, SHOWN);

  const pick = (doc: string): void => setPicked((prior) => (prior === doc ? null : doc));
  const inDialog = sales.find((x) => x.doc === receiving);

  return (
    <div className={s.page}>
      {inDialog !== undefined && (
        <ReceivePayment invoice={inDialog} today={now} onClose={() => setReceiving(null)} />
      )}
      <header className={s.head}>
        <div className={s.titles}>
          <h1 className={s.title}>Invoices</h1>
          <p className={s.sub}>What is owed to us, and what we owe for it.</p>
        </div>
        <button type="button" className={`${s.control} ${s.search}`}>
          <Icon name="search" size={15} />
          <span className={s.searchText}>Doc no. / customer / item</span>
        </button>
        <button type="button" className={s.control}>
          Last 30 days
          <Icon name="chevron-down" size={14} />
        </button>
        <button type="button" className={s.control}>
          <Icon name="file-text" size={15} />
          Print list
        </button>
      </header>

      <section className={s.band} aria-label="The position">
        <BandCell
          label="Owed to us"
          figure={Money.format(band.owedToUs)}
          unit="UGX"
          basis={match(band.oldestDays, {
            known: (d) => `${band.openSales} invoices · oldest ${d} days`,
            partial: (d) => `${band.openSales} invoices · oldest ${d} days`,
            unavailable: () => `${band.openSales} invoices`,
          })}
        />
        <BandCell
          label="We owe suppliers"
          figure={Money.format(band.weOweSuppliers)}
          unit="UGX"
          basis={`${band.unpaidPurchases} purchase invoices · ${band.dueToday} due today`}
        />
        <BandCell
          label="Net position"
          figure={`${Money.isNegative(band.netPosition) ? '−' : '+'}${Money.format(Money.abs(band.netPosition))}`}
          unit="UGX"
          basis="if everything open is collected and paid"
          good
        />
        <BandCell
          label="This range"
          figure={Money.format(band.rangeInvoiced)}
          unit="UGX"
          basis={match(band.rangeReceivedShare, {
            known: (pc) => `${band.rangeCount} invoices · ${pc}% received`,
            partial: () => `${band.rangeCount} invoices`,
            unavailable: () => `${band.rangeCount} invoices`,
          })}
        />
        <div className={s.bandActions}>
          <button type="button" className={s.ghost}>
            Bulk operation
          </button>
          <button type="button" className={s.bandPrimary}>
            New invoice
          </button>
        </div>
      </section>

      <div className={s.ledgers}>
        <section className={s.paneIn} aria-label="Money in">
          <div className={s.pane}>
            <div className={s.paneHead}>
              <span className={s.stripe} style={{ background: v('good-ink') }} aria-hidden="true" />
              <span className={s.paneTitle}>Money in — sales invoices</span>
              <span className={s.spacer} />
              <div className={s.seg}>
                <button type="button" className={`${s.lens} ${s.lensOn}`}>
                  Open
                </button>
                <button type="button" className={s.lens}>
                  Overdue {open.filter((x) => isLate(x, now)).length}
                </button>
                <button type="button" className={s.lens}>
                  All {band.rangeCount}
                </button>
              </div>
            </div>

            <div className={s.colHead}>
              <span className={`${s.colLabel} ${s.docIn}`}>Doc no.</span>
              <span className={`${s.colLabel} ${s.who}`}>Customer</span>
              <span className={`${s.colLabel} ${s.due}`}>Still due</span>
              <span className={`${s.colLabel} ${s.progress}`}>Paid off</span>
              <span className={s.footPadActions} />
            </div>

            {open.slice(0, SHOWN).map((inv) => (
              <SaleRow
                key={inv.doc}
                inv={inv}
                now={now}
                picked={picked === inv.doc}
                dim={!lit.has(inv.doc)}
                onPick={() => pick(inv.doc)}
                onReceive={() => setReceiving(inv.doc)}
              />
            ))}

            <div className={s.foot}>
              <span className={s.footSay}>
                {band.openSales} open invoices
                {unreadable.length > 0 && (
                  <span className={s.footNote}> · {unreadable.length} could not be read in full</span>
                )}
              </span>
              <span className={s.footFigIn}>
                {Money.format(band.owedToUs)} <span className={s.unit}>UGX</span>
              </span>
              <span className={s.footPad} />
              <span className={s.footPadActions} />
            </div>
          </div>
        </section>

        <section className={s.paneOut} aria-label="Money out">
          <div className={s.pane}>
            <div className={s.paneHead}>
              <span className={s.stripe} style={{ background: v('accent') }} aria-hidden="true" />
              <span className={s.paneTitle}>Money out — purchase invoices</span>
              <span className={s.spacer} />
              {picked !== null && (
                <span className={s.tag} style={TAG.part}>
                  for {picked}
                </span>
              )}
            </div>

            <div className={s.colHead}>
              <span className={`${s.colLabel} ${s.docOut}`}>Doc no.</span>
              <span className={`${s.colLabel} ${s.who}`}>Supplier</span>
              <span className={`${s.colLabel} ${s.owed}`}>Owed</span>
              <span className={s.footPadActionsOut} />
            </div>

            {outRows.map((p) => (
              <PurchaseRow
                key={p.doc}
                p={p}
                now={now}
                dim={!lit.has(p.doc)}
                onPick={() => pick(p.doc)}
              />
            ))}

            <div className={s.foot}>
              <span className={s.footSay}>{band.unpaidPurchases} unpaid purchases</span>
              <span className={s.footFigOut}>{Money.format(band.weOweSuppliers)}</span>
              <span className={s.footPadActionsOut} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const isLate = (inv: SalesInvoice, now: Date): boolean => {
  const st = state(inv, now);
  return st.status !== 'unavailable' && st.value === 'late';
};

function BandCell({
  label,
  figure,
  unit,
  basis,
  good = false,
}: {
  readonly label: string;
  readonly figure: string;
  readonly unit: string;
  readonly basis: string;
  readonly good?: boolean;
}): ReactElement {
  return (
    <div className={s.bandCell}>
      <div className={s.bandLabel}>{label}</div>
      <div className={good ? s.bandFigGood : s.bandFig}>
        {figure} <span className={s.bandUnit}>{unit}</span>
      </div>
      {/* Every figure carries its basis. A number on its own is not readable. */}
      <div className={s.bandBasis}>{basis}</div>
    </div>
  );
}

function SaleRow({
  inv,
  now,
  picked,
  dim,
  onPick,
  onReceive,
}: {
  readonly inv: SalesInvoice;
  readonly now: Date;
  readonly picked: boolean;
  readonly dim: boolean;
  readonly onPick: () => void;
  readonly onReceive: () => void;
}): ReactElement {
  const late = isLate(inv, now);
  const share = paidOffShare(inv);
  const paidAnything = !Money.isZero(Money.subtract(inv.total, balanceDue(inv)));

  return (
    <div
      className={`${picked ? s.rowPicked : s.row} ${dim ? s.rowDim : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={picked}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
    >
      <span className={s.docIn}>{inv.doc}</span>
      <span className={s.who}>
        <span className={s.whoName}>{inv.customer}</span>
        <span className={s.whoBasis}>
          · {daysOld(inv, now) === 0 ? 'today' : `${daysOld(inv, now)} days`} ·{' '}
          {Money.format(inv.total)} invoiced
        </span>
      </span>
      <span className={late ? s.dueLate : s.due}>{Money.format(balanceDue(inv))}</span>

      {/* A bar for an invoice that is part paid; a tag for one that is not.
          A 0% bar says "there is progress here" about a row with none. */}
      <span className={s.progress}>
        {paidAnything ? (
          match(share, {
            known: (pc) => <Bar percent={pc} late={late} />,
            partial: (pc) => <Bar percent={pc} late={late} />,
            unavailable: () => <span className={s.share}>&#8212;</span>,
          })
        ) : (
          <span className={s.tag} style={TAG[toneOf(inv, now)]}>
            {labelOf(inv, now)}
          </span>
        )}
      </span>

      <span className={s.actions}>
        <button
          type="button"
          className={picked ? s.receiveOn : s.receive}
          onClick={(e) => {
            // The row selects; the button receives. Without this the click
            // would bubble and deselect the row the dialog is about.
            e.stopPropagation();
            onReceive();
          }}
        >
          Receive
        </button>
        <button
          type="button"
          className={s.kebab}
          aria-label={`More for ${inv.doc}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="more-horizontal" size={14} />
        </button>
      </span>
    </div>
  );
}

function Bar({ percent, late }: { readonly percent: number; readonly late: boolean }): ReactElement {
  return (
    <>
      <span className={s.bar}>
        <i className={late ? s.barFillLate : s.barFill} style={{ width: `${percent}%` }} />
      </span>
      <span className={s.share}>{percent}%</span>
    </>
  );
}

const toneOf = (inv: SalesInvoice, now: Date): keyof typeof TAG => {
  const st = state(inv, now);
  return st.status === 'unavailable' ? 'unknown' : st.value;
};

const labelOf = (inv: SalesInvoice, now: Date): string => {
  const st = state(inv, now);
  // "No terms" is the honest label for a row whose lateness cannot be
  // derived. `Open` would be the app answering a question it cannot.
  if (st.status === 'unavailable') return 'No terms';
  return { late: 'Overdue', open: 'Open', part: 'Part paid', settled: 'Paid', voided: 'Voided' }[
    st.value
  ];
};

function PurchaseRow({
  p,
  now,
  dim,
  onPick,
}: {
  readonly p: PurchaseInvoice;
  readonly now: Date;
  readonly dim: boolean;
  readonly onPick: () => void;
}): ReactElement {
  const owed = stillToPay(p);
  const settled = Money.isZero(owed);
  const dueToday =
    p.dueOn !== null && p.dueOn.toDateString() === now.toDateString() && !settled;
  const voided = p.voided;

  return (
    <button
      type="button"
      className={`${s.row} ${dim ? s.rowDim : ''}`}
      onClick={onPick}
      style={
        voided !== undefined
          ? undefined
          : settled
            ? { background: v('good-fill') }
            : dueToday
              ? { background: v('warn-fill') }
              : undefined
      }
    >
      <span className={s.docOut}>{p.doc}</span>
      <span className={s.who}>
        <span className={voided !== undefined ? s.whoVoid : s.whoName}>{p.supplier}</span>
        <span className={s.whoBasis}>
          ·{' '}
          {voided !== undefined
            ? `voided, replaced by ${voided.replacedBy ?? 'nothing'}`
            : p.forSale === null
              ? 'stock, no invoice'
              : settled
                ? `${Money.format(p.total)} bought`
                : `for ${p.forSale}`}
          {dueToday ? ' · due today' : ''}
        </span>
      </span>
      <span className={settled || voided !== undefined ? s.owedNil : dueToday ? s.owedDueToday : s.owed}>
        {Money.format(owed)}
      </span>
      <span className={s.actionsOut}>
        {settled && voided === undefined && (
          <span className={s.tag} style={TAG.settled}>
            Paid
          </span>
        )}
        {!settled && voided === undefined && <span className={s.receive}>Pay</span>}
      </span>
    </button>
  );
}
