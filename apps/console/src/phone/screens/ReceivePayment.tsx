/**
 * Receive payment on the phone — frames 2d, 2e and 2f.
 *
 * **A full screen, not the dialog shrunk.** The desktop's 700px panel holds
 * a balance, four fields, the payment history and the action; at 390 one of
 * those goes below the fold, and it would be the action. So the balance
 * lives in the header, the fields and the history scroll, and the primary is
 * pinned in the thumb zone with the figure it acts on still on screen.
 *
 * The delete confirm is a bottom sheet rather than a centred box because the
 * thumb reaches the bottom first — and for the same reason its two buttons
 * stack with **Delete it** on top, so the destructive one is not the one the
 * thumb lands on.
 *
 * Nothing here imports from `../../desktop/`; a lint rule and a test would
 * both stop it. The two screens share `@ow/domain` and nothing else, which
 * is why the phone and the desktop cannot disagree about an invoice.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  Money,
  afterDeleting,
  balanceDue,
  canSaveEdit,
  lineAmount,
  linesTotal,
  lowestEditableTotal,
  receivedSoFar,
  receivingClears,
  type InvoiceLine,
  type SalesInvoice,
} from '@ow/domain';
import { demoAccounts } from '@ow/data';
import s from './ReceivePayment.module.css';
import { Mark, PATH } from '../icons.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shopDate = (d: Date): string =>
  `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''} ${d.getFullYear()}`;
const shortDate = (d: Date): string => `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`;

export interface ReceivePaymentProps {
  readonly invoice: SalesInvoice;
  readonly today: Date;
  readonly onClose: () => void;
}

export function ReceivePayment({ invoice, today, onClose }: ReceivePaymentProps): ReactElement {
  const [inv, setInv] = useState<SalesInvoice>(invoice);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState(Money.format(balanceDue(invoice)));
  const [account, setAccount] = useState(demoAccounts[0]?.name ?? 'Cash · shop till');
  const amountRef = useRef<HTMLInputElement>(null);

  const due = balanceDue(inv);
  const parsed = Money.parse(typed);
  const tooMuch = parsed !== null && Money.compare(parsed, due) > 0;
  const amount = parsed === null || tooMuch ? null : parsed;

  useEffect(() => {
    amountRef.current?.focus();
    amountRef.current?.select();
  }, []);

  if (editing) {
    return (
      <EditInvoice
        inv={inv}
        onCancel={() => setEditing(false)}
        onSave={(lines) => {
          setInv((prior) => ({ ...prior, lines, total: linesTotal(lines) }));
          setEditing(false);
        }}
      />
    );
  }

  const payment = inv.payments.find((p) => p.id === confirming);
  const effect = confirming === null ? null : afterDeleting(inv, confirming);

  return (
    <div className={s.screen}>
      <header className={s.header}>
        <div className={s.headTop}>
          {/* Back leaves without saving, and says nothing was received. */}
          <button type="button" className={s.back} aria-label="Back to the ledger" onClick={onClose}>
            <Mark d="m15 18-6-6 6-6" size={18} />
          </button>
          <span className={s.headTitle}>Receive payment</span>
          <button type="button" className={s.ghost} onClick={() => setEditing(true)}>
            Edit invoice
          </button>
        </div>

        <div className={s.headDoc}>
          <span className={s.doc}>{inv.doc}</span>
          <span className={s.headWho}>{inv.customer}</span>
        </div>

        <div className={s.headLabel}>Balance due</div>
        <div className={s.headFig}>
          {Money.format(due)} <span className={s.headUnit}>UGX</span>
        </div>
        <div className={s.headBasis}>
          {Money.format(inv.total)} invoiced · {Money.format(receivedSoFar(inv))} received
        </div>
      </header>

      <div className={s.body}>
        <div className={s.label}>Amount received</div>
        <div className={s.fieldFocus}>
          <input
            ref={amountRef}
            className={s.amount}
            value={typed}
            inputMode="numeric"
            aria-label="Amount received"
            onChange={(e) => setTyped(e.target.value)}
          />
          <span className={s.unit}>UGX</span>
        </div>

        <div className={s.labelGap}>Received into</div>
        <button
          type="button"
          className={s.field}
          onClick={() => {
            const at = demoAccounts.findIndex((a) => a.name === account);
            setAccount(demoAccounts[(at + 1) % demoAccounts.length]?.name ?? account);
          }}
        >
          <span className={s.pick}>{account}</span>
          <span className={s.caret}>
            <Mark d={PATH.chevronDown} size={16} />
          </span>
        </button>

        <div className={s.labelGap}>Date received</div>
        <button type="button" className={s.field}>
          <span className={s.pickFig}>{shopDate(today)}</span>
          <span className={s.caret}>
            <Mark d={PATH.chevronDown} size={16} />
          </span>
        </button>

        <div className={s.labelGap}>
          Note <span className={s.labelSoft}>optional</span>
        </div>
        <input className={s.field} placeholder="Who paid, a reference…" aria-label="Note" />

        <div className={s.paidLabel}>Already received</div>
        {inv.payments.length === 0 ? (
          <div className={s.none}>Nothing yet. This would be the first payment.</div>
        ) : (
          inv.payments.map((p) => (
            <div className={s.payment} key={p.id}>
              <div className={s.payTop}>
                <span className={s.payWhen}>{shopDate(p.on)}</span>
                <span className={s.payHow}>
                  {p.method} · taken by {p.takenBy}
                </span>
                <span className={s.payFig}>{Money.format(p.amount)}</span>
              </div>
              <div className={s.payActions}>
                <button type="button" className={s.btnWide}>
                  Receipt
                </button>
                <button
                  type="button"
                  className={s.btnDelete}
                  aria-label={`Delete the ${Money.format(p.amount)} received on ${shortDate(p.on)}`}
                  onClick={() => setConfirming(p.id)}
                >
                  <Mark d={PATH.trash} size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <footer className={s.foot}>
        <div className={s.footSay}>
          {tooMuch
            ? `More than the ${Money.format(due)} due. Taking more is not designed yet.`
            : amount === null
              ? 'Type an amount to receive.'
              : receivingClears(inv, amount)
                ? 'Receiving this clears the invoice'
                : `${Money.format(Money.subtract(due, amount))} would still be due`}
        </div>
        <button
          type="button"
          className={s.primary}
          disabled={amount === null || Money.isZero(amount)}
          onClick={() => {
            if (amount === null) return;
            setInv((prior) => ({
              ...prior,
              payments: [
                ...prior.payments,
                {
                  id: `local-${prior.payments.length + 1}`,
                  on: today,
                  amount,
                  method: account.split(' · ')[0] ?? 'Cash',
                  account,
                  takenBy: 'Kevin',
                },
              ],
            }));
            onClose();
          }}
        >
          Receive{' '}
          {amount !== null && <span className={s.primaryFig}>{Money.format(amount)}</span>}
        </button>
      </footer>

      {/* Frame 2e. The question states BOTH effects — what the till falls by
          and what the invoice goes back to. */}
      {payment !== undefined && effect !== null && (
        <>
          <div className={s.scrim} onClick={() => setConfirming(null)} aria-hidden="true" />
          <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Delete this payment?">
            <div className={s.grab} aria-hidden="true" />
            <div className={s.askTitle}>
              Delete the <span className={s.askFig}>{Money.format(payment.amount)}</span> received on{' '}
              {shortDate(payment.on)}?
            </div>
            <div className={s.askWhy}>
              The shop till falls by{' '}
              <span className={s.askFig}>{Money.format(effect.tillFallsBy)}</span> and{' '}
              <span className={s.askDoc}>{inv.doc}</span> goes back to{' '}
              <span className={s.askFig}>{Money.format(effect.balanceGoesBackTo)}</span> due.
            </div>
            <button
              type="button"
              className={s.sheetDelete}
              onClick={() => {
                setInv((prior) => ({
                  ...prior,
                  payments: prior.payments.filter((p) => p.id !== confirming),
                }));
                setConfirming(null);
              }}
            >
              Delete it
            </button>
            <button type="button" className={s.sheetKeep} onClick={() => setConfirming(null)}>
              Keep it
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------- frame 2f -------------------------------- */

function EditInvoice({
  inv,
  onCancel,
  onSave,
}: {
  readonly inv: SalesInvoice;
  readonly onCancel: () => void;
  readonly onSave: (lines: readonly InvoiceLine[]) => void;
}): ReactElement {
  const [lines, setLines] = useState<readonly InvoiceLine[]>(inv.lines);
  const verdict = canSaveEdit(inv, lines);
  const num = (raw: string): number => Math.max(0, Number.parseInt(raw.replace(/\D/g, ''), 10) || 0);
  const edit = (
    id: string,
    patch: Partial<Extract<InvoiceLine, { kind: 'item' }>> & { amount?: Money.Money },
  ): void =>
    setLines((prior) => prior.map((l) => (l.id === id ? ({ ...l, ...patch } as InvoiceLine) : l)));

  return (
    <div className={s.screen}>
      <header className={s.header}>
        <div className={s.headTop}>
          <button type="button" className={s.back} aria-label="Back" onClick={onCancel}>
            <Mark d="m15 18-6-6 6-6" size={18} />
          </button>
          <span className={s.headTitle}>Edit invoice</span>
        </div>
        <div className={s.headDoc}>
          <span className={s.doc}>{inv.doc}</span>
          <span className={s.headWho}>
            {inv.customer} · raised {shortDate(inv.issued)}
          </span>
        </div>
      </header>

      {/* A band under the header, so the floor is never scrolled away. */}
      <div className={s.caution}>
        {Money.format(lowestEditableTotal(inv))} is already received, so the total cannot go below
        it.
      </div>

      <div className={s.lines}>
        {lines.map((line) =>
          line.kind === 'item' ? (
            <div className={s.lineCard} key={line.id}>
              <div className={s.lineName}>{line.name}</div>
              <div className={s.lineFields}>
                <div className={s.qtyCell}>
                  <div className={s.label}>Qty</div>
                  <input
                    className={s.lineInput}
                    value={line.qty}
                    inputMode="numeric"
                    aria-label={`Quantity, ${line.name}`}
                    onChange={(e) => edit(line.id, { qty: num(e.target.value) })}
                  />
                </div>
                <div className={s.priceCell}>
                  <div className={s.label}>Price each</div>
                  <input
                    className={s.lineInput}
                    value={Money.format(line.priceEach)}
                    inputMode="numeric"
                    aria-label={`Price each, ${line.name}`}
                    onChange={(e) => edit(line.id, { priceEach: Money.money(num(e.target.value)) })}
                  />
                </div>
                <div className={s.lineOut}>
                  <div className={s.label}>Line</div>
                  <div className={s.lineOutFig}>{Money.format(lineAmount(line))}</div>
                </div>
              </div>
            </div>
          ) : (
            // A charge has no quantity and no unit price, so it is one row
            // with one editable figure rather than a card with empty cells.
            <div className={s.lineCardCharge} key={line.id}>
              <span className={s.chargeName}>
                {line.name} <span className={s.lineBasis}>· {line.basis}</span>
              </span>
              <input
                className={s.lineInputWide}
                value={Money.format(line.amount)}
                inputMode="numeric"
                aria-label={`Amount, ${line.name}`}
                onChange={(e) => edit(line.id, { amount: Money.money(num(e.target.value)) })}
              />
            </div>
          ),
        )}

        <button
          type="button"
          className={s.btnFull}
          onClick={() =>
            setLines((prior) => [
              ...prior,
              {
                kind: 'item',
                id: `new-${prior.length + 1}`,
                name: 'New line',
                qty: 1,
                priceEach: Money.ZERO,
              },
            ])
          }
        >
          <Mark d={PATH.plus} size={16} />
          Add a line
        </button>
      </div>

      <footer className={s.foot}>
        <div className={s.footTotal}>
          <span className={s.label}>New total</span>
          <span className={s.footFig}>{Money.format(linesTotal(lines))}</span>
          <span className={s.unit}>UGX</span>
        </div>
        {!verdict.ok && <div className={s.footSay}>{verdict.why}</div>}
        <button
          type="button"
          className={s.primary}
          disabled={!verdict.ok}
          onClick={() => onSave(lines)}
        >
          Save
        </button>
      </footer>
    </div>
  );
}
