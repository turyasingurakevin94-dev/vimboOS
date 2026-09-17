/**
 * Invoices — the phone. Frame 1c of the Invoices phone handoff.
 *
 * **Not the desktop table restyled.** The desktop faces two ledgers at each
 * other and links them by dimming; at 390px there is no facing anything, so
 * two things move:
 *
 * 1. **The switch moves into the header** — one ledger at a time, Money in
 *    or Money out, with the other side carrying its count so it is never a
 *    blind tap.
 * 2. **The link moves onto the row.** Hiding the purchases column loses
 *    nothing because the sale that has purchases against it now states them:
 *    a doc pill and "bought for it · 95,000 still owed". On the desktop that
 *    is a column; here it is a sentence.
 *
 * **Exactly one row owns an action.** The row that needs you gets a tint and
 * a full-width 44px Receive with the figure it acts on directly above it;
 * every other row is a tap-through and its chevron is affordance, not a
 * second control.
 *
 * Every figure comes from the same reckoning the desktop reads — `readBand`,
 * `groupLedger`, `balanceDue` — so the two designs cannot disagree about an
 * invoice. That is the handoff's last check and it is a property of the
 * architecture here, not something to remember.
 */

import { useState, type ReactElement, type ReactNode } from 'react';
import {
  Money,
  balanceDue,
  groupLedger,
  paidOffShare,
  readBand,
  receivedSoFar,
  settledByDay,
  state,
  stillToPay,
  type LedgerGroup,
  type PurchaseInvoice,
  type SalesInvoice,
} from '@ow/domain';
import { useLedgers } from '../../app/useLedgers.js';
import s from './Invoices.module.css';
import { ReceivePayment } from './ReceivePayment.js';
import { Mark, PATH } from '../icons.js';

const v = (t: string): string => `var(--ow-color-${t})`;

const TAG = {
  late: { background: v('bad-chip'), color: v('bad-ink') },
  open: { background: v('warn-fill'), color: v('warn-ink') },
  part: { background: v('neutral-chip'), color: v('neutral-ink') },
  settled: { background: v('good-chip-light'), color: v('good-ink') },
  voided: { background: v('neutral-chip'), color: v('neutral-ink') },
  unknown: { background: v('neutral-chip'), color: v('neutral-ink') },
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d: Date): string => `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`;

export function Invoices(): ReactElement {
  // Not `state` — that name belongs to the domain reckoning imported above.
  const read = useLedgers();
  if (read.at === 'loading') return <Plain say="Reading the books…" />;
  if (read.at === 'failed') return <Plain say={`The books could not be read. ${read.why}`} />;
  return <Register read={read} />;
}

/**
 * The header with no figures under it.
 *
 * Reading and refused share a shape because they share a problem: there is
 * no ledger yet, and a zero would be a claim that nothing is owed. The one
 * thing that differs between them is the sentence, so that is the one thing
 * this takes.
 */
function Plain({ say }: { readonly say: string }): ReactElement {
  return (
    <div className={s.screen}>
      <header className={s.header}>
        <div className={s.headTop}>
          <span className={s.headTitle}>Invoices</span>
        </div>
        <div className={s.headLabel}>{say}</div>
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
  const { sales, purchases, unreadable } = read.ledgers;
  const band = readBand(sales, purchases, now);
  const [side, setSide] = useState<'in' | 'out'>('in');
  /** Which invoice's Receive screen is open. Null is the ledger. */
  const [receiving, setReceiving] = useState<string | null>(null);

  const inward = side === 'in';
  const inDialog = sales.find((x) => x.doc === receiving);

  // A full screen REPLACES the ledger rather than covering it — that is what
  // makes it a screen and not a dialog, and it is why the tab bar stays.
  if (inDialog !== undefined) {
    return <ReceivePayment invoice={inDialog} today={now} onClose={() => setReceiving(null)} />;
  }

  return (
    <div className={s.screen}>
      <header className={s.header}>
        <div className={s.headTop}>
          <span className={s.headTitle}>Invoices</span>
          <button type="button" className={s.headBtn} aria-label="Search invoices">
            <Mark d={PATH.search} size={18} />
          </button>
        </div>

        {/* The header states the side you are ON. Switching restates it. */}
        <div className={s.headLabel}>{inward ? 'Owed to you' : 'You owe suppliers'}</div>
        <div className={s.headFig}>
          {Money.format(inward ? band.owedToUs : band.weOweSuppliers)}{' '}
          <span className={s.headUnit}>UGX</span>
        </div>
        <div className={s.headBasis}>
          {inward ? (
            <>
              on {band.openSales} invoices
              {band.oldestDays.status !== 'unavailable' && ` · oldest ${band.oldestDays.value} days`}
            </>
          ) : (
            <>
              on {band.unpaidPurchases} purchase invoices · {band.dueToday} due today
            </>
          )}
        </div>

        <div className={s.seg} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={inward}
            className={`${s.side} ${inward ? s.sideOn : ''}`}
            onClick={() => setSide('in')}
          >
            Money in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!inward}
            className={`${s.side} ${inward ? '' : s.sideOn}`}
            onClick={() => setSide('out')}
          >
            Money out <span className={s.sideCount}>{band.unpaidPurchases}</span>
          </button>
        </div>
      </header>

      <div className={s.list}>
        {/* Said once, at the top, where it qualifies every figure below it —
            not swallowed, and not attached to a single row, because a row
            that would not parse is exactly the row that cannot be named. */}
        {unreadable.length > 0 && (
          <p className={s.note}>
            {unreadable.length} {unreadable.length === 1 ? 'invoice' : 'invoices'} could not be read
            in full. The totals above leave out what they could not say.
          </p>
        )}
        {inward ? (
          <MoneyIn
            sales={sales}
            purchases={purchases}
            now={now}
            onReceive={(doc) => setReceiving(doc)}
          />
        ) : (
          <MoneyOut purchases={purchases} now={now} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- money in --------------------------------- */

function MoneyIn({
  sales,
  purchases,
  now,
  onReceive,
}: {
  readonly sales: readonly SalesInvoice[];
  readonly purchases: readonly PurchaseInvoice[];
  readonly now: Date;
  readonly onReceive: (doc: string) => void;
}): ReactElement {
  const groups = groupLedger(sales, now);
  if (groups.length === 0) {
    return (
      <Empty
        say="Nothing is owed to you."
        why="Every invoice in this range has been settled. The next one starts with a quote."
      />
    );
  }

  /**
   * The one row that owns an action: the worst of the overdue.
   *
   * Not "every overdue row" — the handoff is explicit that exactly one row in
   * the list carries a button, and a screen with four Receives has no single
   * next action, which is the whole rule.
   */
  const needsYou = groups.find((g) => g.key === 'overdue')?.invoices[0]?.doc ?? null;

  return (
    <>
      {groups.map((group) => (
        <Group key={group.key} group={group}>
          {group.key === 'settled' ? (
            <SettledDays sales={group.invoices} />
          ) : (
            group.invoices
              .slice(0, CAP)
              .map((inv) => (
                <SaleRow
                  key={inv.doc}
                  inv={inv}
                  purchases={purchases}
                  now={now}
                  needsYou={inv.doc === needsYou}
                  onReceive={() => onReceive(inv.doc)}
                />
              ))
          )}
          {group.key !== 'settled' && group.invoices.length > CAP && (
            <Cut n={group.invoices.length - CAP} />
          )}
        </Group>
      ))}
    </>
  );
}

/** Long lists cap per group and SAY how many were cut. Never a silent slice. */
const CAP = 6;

function Cut({ n }: { readonly n: number }): ReactElement {
  return (
    <div className={s.row}>
      <span className={s.dayWhen}>
        {n} more, not shown
      </span>
      <span className={s.chevron} aria-hidden="true">
        <Mark d={PATH.chevron} size={16} />
      </span>
    </div>
  );
}

function Group({
  group,
  children,
}: {
  readonly group: LedgerGroup;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <>
      <div className={s.group}>
        <span className={s.groupLabel}>{group.label}</span>
        <span className={s.groupCount}>
          <span className={s.groupFig}>{group.count}</span> ·{' '}
          <span className={s.groupFig}>{Money.format(group.total)}</span>
          {group.key === 'settled' ? ' collected' : ''}
        </span>
      </div>
      {children}
    </>
  );
}

function SaleRow({
  inv,
  purchases,
  now,
  needsYou,
  onReceive,
}: {
  readonly inv: SalesInvoice;
  readonly purchases: readonly PurchaseInvoice[];
  readonly now: Date;
  readonly needsYou: boolean;
  readonly onReceive: () => void;
}): ReactElement {
  const due = balanceDue(inv);
  const got = receivedSoFar(inv);
  const st = state(inv, now);
  const tone = st.status === 'unavailable' ? 'unknown' : st.value;

  const days = Math.max(0, Math.floor((now.getTime() - inv.issued.getTime()) / 86_400_000));
  const share = paidOffShare(inv);
  const tagText =
    tone === 'late'
      ? `${days} days`
      : tone === 'unknown'
        ? 'No terms'
        : Money.isZero(got)
          ? 'Open'
          : share.status === 'unavailable'
            ? '—'
            : `${share.value}%`;

  // The link the desktop puts in a facing column.
  const against = purchases.filter((p) => p.forSale === inv.doc && p.voided === undefined);
  const owedOnThem = Money.add(...against.map(stillToPay));
  const first = against[0];

  const body = (
    <div className={s.rowBody}>
      <div className={s.line1}>
        <span className={s.doc}>{inv.doc}</span>
        <span className={s.who}>{inv.customer}</span>
        <span className={s.tag} style={TAG[tone]}>
          {tagText}
        </span>
      </div>

      <div className={needsYou ? s.line2Big : s.line2}>
        <span className={needsYou ? s.owedBig : s.owed}>{Money.format(due)}</span>
        <span className={s.basis}>
          of {Money.format(inv.total)} ·{' '}
          {Money.isZero(got) ? 'nothing received' : `${Money.format(got)} received`}
        </span>
      </div>

      {/* The pill and the figure must describe the SAME thing. One purchase
          names its document and its own balance; several name how many there
          are and what they come to — a doc number over a total that belongs
          to two other documents is a figure attributed to the wrong invoice. */}
      {needsYou && first !== undefined && (
        <div className={s.link}>
          <span className={Money.isZero(owedOnThem) ? s.linkPillPaid : s.linkPill}>
            {against.length === 1 ? first.doc : `${against.length} purchases`}
          </span>
          <span className={s.basis}>
            bought for it ·{' '}
            {Money.isZero(owedOnThem) ? 'paid in full' : `${Money.format(owedOnThem)} still owed`}
          </span>
        </div>
      )}

      {needsYou && (
        <button type="button" className={s.act} onClick={onReceive}>
          Receive <span className={s.actFig}>{Money.format(due)}</span>
        </button>
      )}
    </div>
  );

  // A row that owns a button is not itself a button — nesting one inside the
  // other is invalid, and the tap target would swallow the action.
  return needsYou ? (
    <div className={s.rowNeedsYou}>{body}</div>
  ) : (
    <button type="button" className={s.row}>
      {body}
      <span className={s.chevron} aria-hidden="true">
        <Mark d={PATH.chevron} size={16} />
      </span>
    </button>
  );
}

function SettledDays({ sales }: { readonly sales: readonly SalesInvoice[] }): ReactElement {
  const days = settledByDay(sales).slice(0, CAP);
  return (
    <>
      {days.map((d) => (
        <button type="button" className={s.row} key={d.on.toISOString()}>
          <span className={s.dayWhen}>
            {shortDate(d.on)} · <span className={s.groupFig}>{d.count}</span>{' '}
            {d.count === 1 ? 'invoice' : 'invoices'}
          </span>
          <span className={s.dayFig}>{Money.format(d.collected)}</span>
          <span className={s.chevron} aria-hidden="true">
            <Mark d={PATH.chevron} size={16} />
          </span>
        </button>
      ))}
    </>
  );
}

/* ------------------------------- money out -------------------------------- */

/**
 * The other side of the switch.
 *
 * The frame draws the switch but only the Money in side beneath it. This
 * reuses the row idiom that IS drawn, filled with the purchase fields the
 * desktop ledger draws — so nothing here is invented, only recombined. A
 * dead half of a switch would be worse than either.
 */
function MoneyOut({
  purchases,
  now,
}: {
  readonly purchases: readonly PurchaseInvoice[];
  readonly now: Date;
}): ReactElement {
  const owing = purchases.filter((p) => p.voided === undefined && !Money.isZero(stillToPay(p)));
  if (owing.length === 0) {
    return <Empty say="You owe nothing." why="Every purchase invoice in this range is paid." />;
  }

  const dueToday = (p: PurchaseInvoice): boolean =>
    p.dueOn !== null && p.dueOn.toDateString() === now.toDateString();
  const sorted = [...owing].sort(
    (a, b) => Number(dueToday(b)) - Number(dueToday(a)) || (a.dueOn?.getTime() ?? 0) - (b.dueOn?.getTime() ?? 0),
  );
  const needsYou = sorted[0]?.doc ?? null;

  return (
    <>
      <div className={s.group}>
        <span className={s.groupLabel}>Unpaid</span>
        <span className={s.groupCount}>
          <span className={s.groupFig}>{owing.length}</span> ·{' '}
          <span className={s.groupFig}>{Money.format(Money.add(...owing.map(stillToPay)))}</span>
        </span>
      </div>

      {sorted.slice(0, CAP).map((p) => {
        const owes = stillToPay(p);
        const today = dueToday(p);
        const mine = p.doc === needsYou;

        const body = (
          <div className={s.rowBody}>
            <div className={s.line1}>
              <span className={s.doc}>{p.doc}</span>
              <span className={s.who}>{p.supplier}</span>
              <span className={s.tag} style={today ? TAG.open : TAG.part}>
                {today ? 'Due today' : p.dueOn === null ? 'No terms' : shortDate(p.dueOn)}
              </span>
            </div>
            <div className={mine ? s.line2Big : s.line2}>
              <span className={mine ? s.owedBig : s.owed}>{Money.format(owes)}</span>
              <span className={s.basis}>
                of {Money.format(p.total)} ·{' '}
                {p.forSale === null ? 'stock, no invoice' : `for ${p.forSale}`}
              </span>
            </div>
            {mine && (
              <button type="button" className={s.act}>
                Pay <span className={s.actFig}>{Money.format(owes)}</span>
              </button>
            )}
          </div>
        );

        return mine ? (
          <div className={s.rowNeedsYou} key={p.doc}>
            {body}
          </div>
        ) : (
          <button type="button" className={s.row} key={p.doc}>
            {body}
            <span className={s.chevron} aria-hidden="true">
              <Mark d={PATH.chevron} size={16} />
            </span>
          </button>
        );
      })}

      {owing.length > CAP && <Cut n={owing.length - CAP} />}
    </>
  );
}

function Empty({ say, why }: { readonly say: string; readonly why: string }): ReactElement {
  return (
    <div className={s.empty}>
      <div className={s.emptySay}>{say}</div>
      <div className={s.emptyWhy}>{why}</div>
    </div>
  );
}
