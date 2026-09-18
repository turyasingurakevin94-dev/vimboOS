/**
 * The four asks a card's control can raise — the phone.
 *
 * Same four questions as the console's, and a different answer to the shape
 * of them: a sheet from the bottom edge, one column, 44px targets, and the
 * choice list as rows rather than as a radio group. The words are the
 * domain's, so the two designs cannot end up promising different things.
 */

import { useState, type ReactElement } from 'react';
import {
  INVOICING_DOES,
  Money,
  UNDOING_INVOICE_DOES,
  match,
  runsToday,
  type TrackedOrder,
} from '@ow/domain';
import s from './MoveOrder.module.css';
import { MoveMark } from '../icons.js';

export type Ask =
  | { readonly at: 'load'; readonly reference: string }
  | { readonly at: 'invoice'; readonly reference: string }
  | { readonly at: 'undo'; readonly reference: string }
  | { readonly at: 'settle'; readonly reference: string };

export interface MoveOrderProps {
  readonly ask: Ask;
  readonly order: TrackedOrder;
  readonly board: readonly TrackedOrder[];
  readonly invoiceNumber: string;
  readonly onLoad: (run: string) => void;
  readonly onInvoice: () => void;
  readonly onUndo: () => void;
  readonly onSettle: (how: 'amend' | 'confirm') => void;
  readonly onClose: () => void;
}

const worth = (order: TrackedOrder): string =>
  match(order.value, {
    known: (m) => Money.format(m),
    partial: (m) => `${Money.format(m)} so far`,
    unavailable: () => 'an amount the books cannot read',
  });

const TITLE: Readonly<Record<Ask['at'], string>> = {
  load: 'Load it',
  invoice: 'Invoice it',
  undo: 'Undo the invoice',
  settle: 'Settle the short pick',
};

export function MoveOrder(props: MoveOrderProps): ReactElement {
  const { ask, order } = props;

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label={TITLE[ask.at]}>
      <div className={s.sheet}>
        <span className={s.grip} />
        <header className={s.head}>
          <span className={s.headTitle}>{TITLE[ask.at]}</span>
          <span className={s.ref}>{order.reference}</span>
        </header>

        {ask.at === 'load' ? (
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

function Load({ order, board, onLoad, onClose }: MoveOrderProps): ReactElement {
  const runs = runsToday(board);
  const [run, setRun] = useState<string>(runs[0] ?? 'Run 1');
  const carrying = (name: string): number =>
    board.filter((o) => o.run === name && o.stage === 'pending_delivery').length;

  return (
    <>
      <div className={s.body}>
        <p className={s.who}>
          {order.customer} · {order.place} · <span className={s.amount}>{worth(order)}</span>
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
              <span className={s.choiceCarrying}>{carrying(name)} on it</span>
            </button>
          ))}
          <button
            type="button"
            className={runs.includes(run) ? s.choice : s.choiceOn}
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

function Invoice({ order, invoiceNumber, onInvoice, onClose }: MoveOrderProps): ReactElement {
  return (
    <>
      <div className={s.body}>
        <p className={s.who}>
          {order.customer} · delivered {order.place} · it becomes {invoiceNumber}.
        </p>
        <ul className={s.does}>
          <li className={s.doesLabel}>What this does</li>
          {INVOICING_DOES.map((what) => (
            <li className={s.doesItem} key={what}>
              <MoveMark name="tick" size={14} strokeWidth={2.4} />
              {what}
            </li>
          ))}
        </ul>
      </div>
      <footer className={s.foot}>
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

function Undo({ order, onUndo, onClose }: MoveOrderProps): ReactElement {
  return (
    <>
      <div className={s.body}>
        <p className={s.who}>
          {order.invoice} was raised for {order.customer}. Undoing it returns the order to
          Delivered.
        </p>
        <ul className={s.does}>
          <li className={s.doesLabel}>What this takes back</li>
          {UNDOING_INVOICE_DOES.map((what) => (
            <li className={s.doesItem} key={what}>
              <MoveMark name="back" size={14} />
              {what}
            </li>
          ))}
        </ul>
      </div>
      <footer className={s.foot}>
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

function Settle({ order, onSettle, onClose }: MoveOrderProps): ReactElement {
  const short = order.shortPick;
  if (short === null) {
    return (
      <div className={s.body}>
        <p className={s.who}>The pick is settled.</p>
      </div>
    );
  }
  const missing = short.asked - short.found;

  return (
    <>
      <div className={s.body}>
        <p className={s.who}>
          The pick asked for <span className={s.amount}>{short.asked}</span> and found{' '}
          <span className={s.amount}>{short.found}</span>.
        </p>
        <div className={s.caution}>
          Loading it now would bill {order.customer} for {missing}{' '}
          {missing === 1 ? 'line' : 'lines'} nobody put on the lorry.
        </div>
        <div className={s.choices}>
          <button type="button" className={s.choice} onClick={() => onSettle('confirm')}>
            <span className={s.choiceName}>All {short.asked} went out</span>
          </button>
          <button type="button" className={s.choice} onClick={() => onSettle('amend')}>
            <span className={s.choiceName}>Amend the order to {short.found}</span>
          </button>
        </div>
      </div>
      <footer className={s.foot}>
        <button type="button" className={s.btn} onClick={onClose}>
          Leave it
        </button>
      </footer>
    </>
  );
}
