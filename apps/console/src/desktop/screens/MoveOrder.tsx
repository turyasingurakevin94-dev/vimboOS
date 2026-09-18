/**
 * The four asks a card's control can raise — the desktop.
 *
 * The board's rule is that the card carries one control and no sentences.
 * That holds right up to the moment a control would do something the owner
 * cannot see: put stock on a lorry under somebody's name, take stock off the
 * shelf and post four ledger entries, or take all four back again. Those
 * three ask first, and the handoff says in words what they must say.
 *
 * `Esc` closes. Nothing here acts without a press.
 */

import { useEffect, useState, type ReactElement } from 'react';
import {
  INVOICING_DOES,
  Money,
  UNDOING_INVOICE_DOES,
  match,
  runsToday,
  unanswered,
  type TrackedOrder,
} from '@ow/domain';
import s from './MoveOrder.module.css';
import { Icon } from '../icons.js';

/** Which ask is open. There is only ever one. */
export type Ask =
  | { readonly at: 'owed'; readonly reference: string }
  | { readonly at: 'load'; readonly reference: string }
  | { readonly at: 'invoice'; readonly reference: string }
  | { readonly at: 'undo'; readonly reference: string }
  | { readonly at: 'settle'; readonly reference: string };

export interface MoveOrderProps {
  readonly ask: Ask;
  readonly order: TrackedOrder;
  /** Every order on the board — the runs are read off the ones already out. */
  readonly board: readonly TrackedOrder[];
  readonly invoiceNumber: string;
  readonly onLoad: (run: string) => void;
  readonly onInvoice: () => void;
  readonly onUndo: () => void;
  readonly onSettle: (how: 'amend' | 'confirm') => void;
  /** A supplier has come back. Taken moves itself when it is the last one. */
  readonly onAnswered: (supplier: string) => void;
  /** A bought-in line has arrived. */
  readonly onCheckIn: () => void;
  /** A door to the screen that does the work this board only counts. */
  readonly onGo: (destination: string) => void;
  readonly onClose: () => void;
}

const worth = (order: TrackedOrder): string =>
  match(order.value, {
    known: (m) => Money.format(m),
    partial: (m) => `${Money.format(m)} so far`,
    unavailable: () => 'an amount the books cannot read',
  });

export function MoveOrder(props: MoveOrderProps): ReactElement {
  const { ask, order, onClose } = props;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title =
    ask.at === 'owed'
      ? 'Still owed'
      : ask.at === 'load'
        ? 'Load it'
        : ask.at === 'invoice'
          ? 'Invoice it'
          : ask.at === 'undo'
            ? 'Undo the invoice'
            : 'Settle the short pick';

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label={title}>
      <div className={s.panel}>
        <header className={s.head}>
          <span className={s.headTitle}>{title}</span>
          <span className={s.ref}>{order.reference}</span>
          <span className={s.spacer} />
          <button type="button" className={s.close} aria-label="Close" onClick={onClose}>
            <Icon name="plus" size={15} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </header>

        {ask.at === 'owed' ? (
          <Owed {...props} />
        ) : ask.at === 'load' ? (
          <Load {...props} />
        ) : ask.at === 'invoice' ? (
          <Invoice {...props} />
        ) : ask.at === 'undo' ? (
          <Undo {...props} />
        ) : (
          <Settle {...props} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- still owed ------------------------------- */

/**
 * What a padlock is holding, said out loud.
 *
 * The board's rule is that the card carries one control and no sentences,
 * and the control's `title` names what is owed. That works on a console with
 * a mouse and nowhere else: a `title` is unreachable on a phone, and twenty
 * of the fifty-four cards on a busy day wear a padlock. So pressing one
 * opens this, in the same words the card uses.
 *
 * Both lanes also carry the act that would clear them, because a panel that
 * only says "waiting on Bbosa Steel" and offers `Leave it` is the dead end
 * the padlock already was.
 */
function Owed({ order, onAnswered, onCheckIn, onGo, onClose }: MoveOrderProps): ReactElement {
  const waiting = unanswered(order);
  const stillOut = order.toBuy - order.checkedIn;

  return (
    <>
      <div className={s.body}>
        <p className={s.who}>
          {order.customer} · {order.place} · {order.lines}{' '}
          {order.lines === 1 ? 'line' : 'lines'} · <span className={s.amount}>{worth(order)}</span>
        </p>

        {order.stage === 'draft' ? (
          <div className={s.owed}>
            {order.suppliers.map((supplier) => (
              <div
                key={supplier.name}
                className={supplier.answered ? s.owedRow : s.owedRowWaiting}
              >
                <span className={s.owedText}>
                  <span className={s.owedName}>{supplier.name}</span>
                  <span className={supplier.answered ? s.owedDone : s.owedWaiting}>
                    {supplier.answered ? 'answered' : 'has not answered'}
                  </span>
                </span>
                {!supplier.answered && (
                  <button
                    type="button"
                    className={s.owedAct}
                    onClick={() => onAnswered(supplier.name)}
                  >
                    They answered
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className={s.who}>
              <span className={s.amount}>{order.checkedIn}</span> of{' '}
              <span className={s.amount}>{order.toBuy}</span> bought-in lines are checked in.{' '}
              <span className={s.amount}>{stillOut}</span>{' '}
              {stillOut === 1 ? 'is' : 'are'} still out.
            </p>
            <div className={s.caution}>
              It cannot be picked until the last line is in — the goods are still in a
              supplier&rsquo;s shop, not on the shelf.
            </div>
          </>
        )}
      </div>

      <footer className={s.foot}>
        <span className={s.footNote}>
          {order.stage === 'draft'
            ? waiting.length === 1
              ? 'It moves itself when this one answers.'
              : 'It moves itself when the last supplier answers.'
            : 'It unlocks on the last line in.'}
        </span>
        <button type="button" className={s.btn} onClick={onClose}>
          Leave it
        </button>
        {order.stage === 'awaiting_goods' && (
          // Goods-in proper — quantities, costs, a supplier invoice — is
          // Sourcing's work. This is the board recording that one arrived.
          <button type="button" className={s.btn} onClick={onCheckIn}>
            Check the next line in
          </button>
        )}
        <button
          type="button"
          className={s.btnPrimary}
          onClick={() => onGo(order.stage === 'draft' ? 'messages' : 'sourcing')}
        >
          {order.stage === 'draft' ? 'Draft the chase' : 'Buying list'}
        </button>
      </footer>
    </>
  );
}

/* --------------------------------- load ----------------------------------- */

/**
 * Who carries it, and then it is out.
 *
 * The run is chosen, not typed. An order out under a name nobody else spells
 * the same way is the question "where is Kato's cement" with three different
 * answers at the end of the day.
 */
function Load({ order, board, onLoad, onClose }: MoveOrderProps): ReactElement {
  const runs = runsToday(board);
  const [run, setRun] = useState<string>(runs[0] ?? `Run ${runs.length + 1}`);

  const carrying = (name: string): number =>
    board.filter((o) => o.run === name && o.stage === 'pending_delivery').length;

  return (
    <>
      <div className={s.body}>
        <p className={s.who}>
          {order.customer} · {order.place} · {order.lines}{' '}
          {order.lines === 1 ? 'line' : 'lines'} · <span className={s.amount}>{worth(order)}</span>
        </p>

        <div className={s.choices}>
          {runs.map((name) => (
            <button
              type="button"
              key={name}
              className={name === run ? s.choiceOn : s.choice}
              aria-pressed={name === run}
              onClick={() => setRun(name)}
            >
              <span className={s.choiceDot} />
              <span className={s.choiceName}>{name}</span>
              <span className={s.choiceCarrying}>
                {carrying(name)} already on it
              </span>
            </button>
          ))}
          <button
            type="button"
            className={run.startsWith('Run ') && !runs.includes(run) ? s.choiceOn : s.choice}
            aria-pressed={!runs.includes(run)}
            onClick={() => setRun(`Run ${runs.length + 1}`)}
          >
            <span className={s.choiceDot} />
            <span className={s.choiceName}>A new run</span>
            <span className={s.choiceCarrying}>Run {runs.length + 1}</span>
          </button>
        </div>
      </div>

      <footer className={s.foot}>
        <span className={s.footNote}>It leaves Preparing the moment it is loaded.</span>
        <button type="button" className={s.btn} onClick={onClose}>
          Leave it
        </button>
        <button type="button" className={s.btnPrimary} onClick={() => onLoad(run)}>
          Loaded on {run.split(' · ')[0]}
        </button>
      </footer>
    </>
  );
}

/* -------------------------------- invoice --------------------------------- */

function Invoice({ order, invoiceNumber, onInvoice, onClose }: MoveOrderProps): ReactElement {
  return (
    <>
      <div className={s.body}>
        <p className={s.who}>
          {order.customer} · delivered {order.place} · {order.lines}{' '}
          {order.lines === 1 ? 'line' : 'lines'}
        </p>

        <ul className={s.does}>
          <li className={s.doesLabel}>What this does</li>
          {INVOICING_DOES.map((what) => (
            <li className={s.doesItem} key={what}>
              <Icon name="tick" size={14} className={s.doesMark} />
              {what}
            </li>
          ))}
        </ul>
      </div>

      <footer className={s.foot}>
        <span className={s.footNote}>It becomes {invoiceNumber}.</span>
        <button type="button" className={s.btn} onClick={onClose}>
          Not yet
        </button>
        <button type="button" className={s.btnPrimary} onClick={onInvoice}>
          Invoice {worth(order)}
        </button>
      </footer>
    </>
  );
}

/* ---------------------------------- undo ---------------------------------- */

function Undo({ order, onUndo, onClose }: MoveOrderProps): ReactElement {
  return (
    <>
      <div className={s.body}>
        <p className={s.who}>
          {order.invoice} was raised for {order.customer}. Undoing it returns the order to
          Delivered and takes all four postings back.
        </p>

        <ul className={s.does}>
          <li className={s.doesLabel}>What this takes back</li>
          {UNDOING_INVOICE_DOES.map((what) => (
            <li className={s.doesItem} key={what}>
              <Icon name="step-back" size={14} className={s.doesMarkUndo} />
              {what}
            </li>
          ))}
        </ul>
      </div>

      <footer className={s.foot}>
        <span className={s.footNote}>The order goes back on the board.</span>
        <button type="button" className={s.btn} onClick={onClose}>
          Leave it
        </button>
        <button type="button" className={s.btnDanger} onClick={onUndo}>
          Undo {order.invoice}
        </button>
      </footer>
    </>
  );
}

/* --------------------------------- settle --------------------------------- */

/**
 * The one padlock on this board the owner can clear from here.
 *
 * Taken and Buying wait on a supplier in Kikuubo; no press of the owner's
 * moves them, which is why those padlocks only say what is owed. A short
 * pick is different: it waits on a decision, and there are exactly two.
 */
function Settle({ order, onSettle, onClose }: MoveOrderProps): ReactElement {
  const short = order.shortPick;
  if (short === null) return <div className={s.body}>The pick is settled.</div>;
  const missing = short.asked - short.found;

  return (
    <>
      <div className={s.body}>
        <p className={s.who}>
          {order.customer} · the pick asked for <span className={s.amount}>{short.asked}</span> and
          found <span className={s.amount}>{short.found}</span>.
        </p>

        <div className={s.caution}>
          It cannot be loaded until this is settled. Loading it now would bill{' '}
          {order.customer} for {missing} {missing === 1 ? 'line' : 'lines'} nobody put on the
          lorry.
        </div>
      </div>

      <footer className={s.foot}>
        <span className={s.footNote} />
        <button type="button" className={s.btn} onClick={onClose}>
          Leave it
        </button>
        <button type="button" className={s.btn} onClick={() => onSettle('confirm')}>
          All {short.asked} went out
        </button>
        {/* Amending is the primary because it is the truthful one: billing
            for goods nobody loaded is the error this padlock exists to
            prevent. Confirming is still one press away for the case where
            the full quantity did go out and the count was wrong. */}
        <button type="button" className={s.btnPrimary} onClick={() => onSettle('amend')}>
          Amend to {short.found}
        </button>
      </footer>
    </>
  );
}
