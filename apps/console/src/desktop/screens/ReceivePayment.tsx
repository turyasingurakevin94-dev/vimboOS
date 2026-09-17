/**
 * Receive payment — frames 2a, 2b and 2c of the Invoices handoff.
 *
 * Three dialogs over one scrim: take a payment, confirm deleting one, and
 * edit the invoice itself. They are one component because they are one
 * conversation — Edit invoice opens from the Receive header, and the delete
 * confirm from a payment row inside it — and because all three read the same
 * invoice, which is the handoff's rule about one reckoning.
 *
 * ## What the buttons actually do
 *
 * This is demonstration state: receiving a payment adds it to a local copy
 * of the invoice and the figures move, deleting one takes it away again.
 * Nothing is written anywhere. It matters that they MOVE — a dialog whose
 * primary does nothing teaches that the app does nothing, and this screen
 * shipped once with a Receive button that was decoration.
 *
 * ## Escape and commit
 *
 * `Esc` closes, `Ctrl/Cmd ↵` commits, and focus lands on the amount, as the
 * handoff's interaction notes require. The amount defaults to the balance
 * due and accepts less. **More than the balance is not designed** — the
 * handoff says so in words — so the field refuses it and says why rather
 * than inventing an overpayment rule.
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
  type Payment,
  type SalesInvoice,
} from '@ow/domain';
import { demoAccounts } from '@ow/data';
import s from './ReceivePayment.module.css';
import { Icon } from '../icons.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `17 Sep 2026` — the way the shop writes a date, not `09/17/2026`. */
export const shopDate = (d: Date): string =>
  `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''} ${d.getFullYear()}`;

export interface ReceivePaymentProps {
  readonly invoice: SalesInvoice;
  readonly today: Date;
  readonly onClose: () => void;
}

type Stage =
  | { readonly at: 'receive' }
  | { readonly at: 'confirm-delete'; readonly paymentId: string }
  | { readonly at: 'edit' };

export function ReceivePayment({ invoice, today, onClose }: ReceivePaymentProps): ReactElement {
  const [inv, setInv] = useState<SalesInvoice>(invoice);
  const [stage, setStage] = useState<Stage>({ at: 'receive' });
  const [typed, setTyped] = useState<string>(Money.format(balanceDue(invoice)));
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

  const take = (): void => {
    if (amount === null || Money.isZero(amount)) return;
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
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (stage.at === 'receive') onClose();
        else setStage({ at: 'receive' });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && stage.at === 'receive') {
        e.preventDefault();
        take();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (stage.at === 'confirm-delete') {
    return (
      <ConfirmDelete
        inv={inv}
        paymentId={stage.paymentId}
        onKeep={() => setStage({ at: 'receive' })}
        onDelete={() => {
          setInv((prior) => ({
            ...prior,
            payments: prior.payments.filter((p) => p.id !== stage.paymentId),
          }));
          setStage({ at: 'receive' });
        }}
      />
    );
  }

  if (stage.at === 'edit') {
    return (
      <EditInvoice
        inv={inv}
        onCancel={() => setStage({ at: 'receive' })}
        onSave={(lines) => {
          setInv((prior) => ({ ...prior, lines, total: linesTotal(lines) }));
          setStage({ at: 'receive' });
        }}
      />
    );
  }

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label="Receive payment">
      <div className={s.panel}>
        <header className={s.head}>
          <span className={s.headTitle}>Receive payment</span>
          <span className={s.doc}>{inv.doc}</span>
          <span className={s.headWho}>{inv.customer}</span>
          <span className={s.spacer} />
          <button type="button" className={s.btn} onClick={() => setStage({ at: 'edit' })}>
            <Icon name="file-text" size={14} />
            Edit invoice
          </button>
          <button type="button" className={s.btnIcon} aria-label="Close" onClick={onClose}>
            <Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </header>

        {/* Balance due leads. The other two figures sit beside it, smaller. */}
        <div className={s.band}>
          <div>
            <div className={s.label}>Balance due</div>
            <div className={s.bandDue}>
              {Money.format(due)} <span className={s.unit}>UGX</span>
            </div>
          </div>
          <div className={s.bandSide}>
            <div className={s.label}>Invoice total</div>
            <div className={s.bandFig}>{Money.format(inv.total)}</div>
          </div>
          <div className={s.bandSide}>
            <div className={s.label}>Received so far</div>
            <div className={s.bandFigGood}>{Money.format(receivedSoFar(inv))}</div>
          </div>
        </div>

        <div className={s.body}>
          <div className={s.fields}>
            <div className={s.field}>
              <div className={s.label}>Amount received</div>
              <div className={s.controlFocus}>
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
            </div>
            <div className={s.field}>
              <div className={s.label}>Received into</div>
              <button
                type="button"
                className={s.control}
                onClick={() => {
                  const at = demoAccounts.findIndex((a) => a.name === account);
                  setAccount(demoAccounts[(at + 1) % demoAccounts.length]?.name ?? account);
                }}
              >
                <span className={s.pick}>{account}</span>
                <span className={s.caret}>
                  <Icon name="chevron-down" size={14} />
                </span>
              </button>
            </div>
            <div className={s.field}>
              <div className={s.label}>Date received</div>
              <button type="button" className={s.control}>
                <span className={s.pickFig}>{shopDate(today)}</span>
                <span className={s.caret}>
                  <Icon name="calendar" size={14} />
                </span>
              </button>
            </div>
          </div>

          <div className={s.wide}>
            <div className={s.label}>
              Note <span className={s.labelSoft}>optional</span>
            </div>
            {/* Not "e.g. Cash, mobile money…" — that is what Received into asks. */}
            <input
              className={s.control}
              placeholder="Who paid, a reference number, anything to remember"
              aria-label="Note"
            />
          </div>

          <div className={s.paid}>
            <div className={s.label}>Already received</div>
            {inv.payments.length === 0 ? (
              <div className={s.none}>Nothing yet. This would be the first payment.</div>
            ) : (
              inv.payments.map((p) => (
                <PaymentRow
                  key={p.id}
                  payment={p}
                  onDelete={() => setStage({ at: 'confirm-delete', paymentId: p.id })}
                />
              ))
            )}
          </div>
        </div>

        <footer className={s.foot}>
          <span className={s.footSay}>
            {tooMuch
              ? `More than the ${Money.format(due)} due. Taking more is not designed yet.`
              : amount === null
                ? 'Type an amount to receive.'
                : receivingClears(inv, amount)
                  ? 'Receiving this clears the invoice'
                  : `${Money.format(Money.subtract(due, amount))} would still be due`}
          </span>
          <span className={s.spacer} />
          <button type="button" className={s.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={s.btnPrimary}
            disabled={amount === null || Money.isZero(amount)}
            onClick={take}
          >
            Receive {amount === null ? '' : Money.format(amount)}
          </button>
        </footer>
      </div>
    </div>
  );
}

function PaymentRow({
  payment,
  onDelete,
}: {
  readonly payment: Payment;
  readonly onDelete: () => void;
}): ReactElement {
  return (
    <div className={s.payment}>
      <span className={s.payWhen}>{shopDate(payment.on)}</span>
      <span className={s.payHow}>
        {payment.method} · taken by {payment.takenBy}
      </span>
      <span className={s.payFig}>{Money.format(payment.amount)}</span>
      {/* Printing is labelled; only deleting stays an icon, and it asks. */}
      <button type="button" className={s.btn}>
        <Icon name="file-text" size={14} />
        Receipt
      </button>
      <button
        type="button"
        className={s.btnIcon}
        aria-label={`Delete the ${Money.format(payment.amount)} received on ${shopDate(payment.on)}`}
        onClick={onDelete}
      >
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}

/* --------------------------------- frame 2b -------------------------------- */

/**
 * The trash icon moves money, so it asks once — and the question states BOTH
 * effects: what the till falls by and what the invoice goes back to. One
 * without the other is not a question, it is a warning.
 */
function ConfirmDelete({
  inv,
  paymentId,
  onKeep,
  onDelete,
}: {
  readonly inv: SalesInvoice;
  readonly paymentId: string;
  readonly onKeep: () => void;
  readonly onDelete: () => void;
}): ReactElement {
  const effect = afterDeleting(inv, paymentId);
  const gone = inv.payments.find((p) => p.id === paymentId);

  // Not a user error — a payment that is not on this invoice is a bug, and a
  // confirmation for it would be a question about nothing.
  if (effect === null || gone === undefined) {
    onKeep();
    return <></>;
  }

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label="Delete this payment?">
      <div className={s.panelSmall}>
        <div className={s.askTitle}>
          Delete the <span className={s.askFig}>{Money.format(gone.amount)}</span> received on{' '}
          {shopDate(gone.on)}?
        </div>
        <div className={s.askWhy}>
          The shop till falls by <span className={s.askFig}>{Money.format(effect.tillFallsBy)}</span>{' '}
          and <span className={s.askDoc}>{inv.doc}</span> goes back to{' '}
          <span className={s.askFig}>{Money.format(effect.balanceGoesBackTo)}</span> due.
        </div>
        <div className={s.askButtons}>
          <button type="button" className={s.btn} onClick={onKeep}>
            Keep it
          </button>
          <button type="button" className={s.btnDanger} onClick={onDelete}>
            Delete it
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- frame 2c -------------------------------- */

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
  const floor = lowestEditableTotal(inv);
  const verdict = canSaveEdit(inv, lines);

  const edit = (id: string, patch: Partial<Extract<InvoiceLine, { kind: 'item' }>> & { amount?: Money.Money }): void =>
    setLines((prior) =>
      prior.map((l) => (l.id === id ? ({ ...l, ...patch } as InvoiceLine) : l)),
    );

  const num = (raw: string): number => Math.max(0, Number.parseInt(raw.replace(/\D/g, ''), 10) || 0);

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label="Edit invoice">
      <div className={s.panel}>
        <header className={s.head}>
          <span className={s.headTitle}>Edit invoice</span>
          <span className={s.doc}>{inv.doc}</span>
          <span className={s.headWho}>
            {inv.customer} · raised {shopDate(inv.issued)}
          </span>
          <span className={s.spacer} />
          <button type="button" className={s.btnIcon} aria-label="Close" onClick={onCancel}>
            <Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </header>

        {/* The floor, stated before you type. */}
        <div className={s.caution}>
          {Money.format(floor)} is already received, so the total cannot go below it.
        </div>

        <div className={s.body}>
          <div className={s.editHead}>
            <span />
            <span className={s.label}>Item</span>
            <span className={`${s.label} ${s.right}`}>Qty</span>
            <span className={`${s.label} ${s.right}`}>Price each</span>
            <span className={`${s.label} ${s.right}`}>Line total</span>
          </div>

          {lines.map((line, i) =>
            line.kind === 'item' ? (
              <div className={s.editRow} key={line.id}>
                <span className={s.editNum}>{i + 1}</span>
                <div className={s.editName} title={line.name}>
                  {line.name}
                </div>
                <input
                  className={s.editField}
                  value={line.qty}
                  inputMode="numeric"
                  aria-label={`Quantity, ${line.name}`}
                  onChange={(e) => edit(line.id, { qty: num(e.target.value) })}
                />
                <input
                  className={s.editField}
                  value={Money.format(line.priceEach)}
                  inputMode="numeric"
                  aria-label={`Price each, ${line.name}`}
                  onChange={(e) => edit(line.id, { priceEach: Money.money(num(e.target.value)) })}
                />
                <div className={s.editTotal}>{Money.format(lineAmount(line))}</div>
              </div>
            ) : (
              // A charge has no quantity and no unit price; the cells are
              // empty rather than zero, because zero is a claim.
              <div className={s.editRowCharge} key={line.id}>
                <span />
                <div className={s.editName}>
                  {line.name} <span className={s.editBasis}>· {line.basis}</span>
                </div>
                <span />
                <span />
                <input
                  className={s.editField}
                  value={Money.format(line.amount)}
                  inputMode="numeric"
                  aria-label={`Amount, ${line.name}`}
                  onChange={(e) => edit(line.id, { amount: Money.money(num(e.target.value)) })}
                />
              </div>
            ),
          )}

          <div className={s.foot} style={{ marginTop: 0, borderTop: 0 }}>
            <button
              type="button"
              className={s.btn}
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
              <Icon name="plus" size={14} />
              Add a line
            </button>
            <span className={s.spacer} />
            {!verdict.ok && <span className={s.footSay}>{verdict.why}</span>}
            <div className={s.footTotal}>
              <div className={s.label}>New total</div>
              <div className={s.footFig}>
                {Money.format(linesTotal(lines))} <span className={s.unit}>UGX</span>
              </div>
            </div>
            <button type="button" className={s.btn} onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={s.btnPrimary}
              disabled={!verdict.ok}
              onClick={() => onSave(lines)}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
