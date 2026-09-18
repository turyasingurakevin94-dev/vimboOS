/**
 * Order tracking — the phone. Frames `1p`, `1q` and `1r`.
 *
 * Five lanes cannot stand side by side at 390px, so **the lanes become the
 * header strip and one lane is open at a time.** Each step carries its count
 * and an amber dot when some of it needs chasing; the one you are in has the
 * coral underline. Below it, one line states that lane's rule and its one
 * figure, and then the cards.
 *
 * The card keeps all four rows and both controls are 44px — back on the left,
 * the move on the right where the thumb is. Everything about what a control
 * MEANS is read from `@ow/domain`, exactly as the console reads it, which is
 * the only reason the two can never disagree about whether an order is stuck.
 *
 * Nothing here imports from `../../desktop/`, and a lint rule plus a test
 * would both stop it.
 */

import { useState, type ReactElement } from 'react';
import {
  Money,
  ageLabel,
  ageTone,
  handedOverAt,
  invoiced,
  laneWindow,
  lineCheckedIn,
  loaded,
  markFor,
  match,
  meterFor,
  moveFor,
  moveOn,
  nextInvoiceNumber,
  notInvoiced,
  readTracking,
  settledShort,
  stepBack,
  steppedBack,
  steps,
  supplierAnswered,
  unanswered,
  type Control,
  type LaneReading,
  type Stage,
  type TrackedOrder,
} from '@ow/domain';
import { DEMO_BOARD_NOW, demoTrackedOrders, demoTrip } from '@ow/data';
import s from './OrderTracking.module.css';
import { MoveOrder, type Ask } from './MoveOrder.js';
import { Mark, MoveMark, PATH, type MoveGlyph } from '../icons.js';

const GLYPH: Readonly<Record<Control, MoveGlyph>> = {
  chevron: 'chevron',
  lock: 'lock',
  van: 'van',
  doc: 'doc',
  tick: 'tick',
};

const SKIN = {
  chevron: s.moveChevron,
  lock: s.moveLock,
  van: s.moveVan,
  doc: s.moveDoc,
  tick: s.moveTick,
};

const AGE = { quiet: s.age, closing: s.ageClosing, past: s.agePast };
const MARK = { waiting: s.markWaiting, done: s.markDone, quiet: s.markQuiet };

/**
 * How many cards a lane draws before it starts counting.
 *
 * Four is what fits above the fold at 844, and an open step-back panel costs
 * one of them — which is what the frames draw, and the honest thing for a
 * list whose `+N` is a promise about what is below rather than about what
 * exists. The count is always `total − shown`, so it cannot drift.
 */
const SHOWN = 4;
const SHOWN_WITH_PANEL = 3;

export function OrderTracking(): ReactElement {
  const now = DEMO_BOARD_NOW;
  const [orders, setOrders] = useState<readonly TrackedOrder[]>(demoTrackedOrders);
  const [open, setOpen] = useState<Stage>('draft');
  const [acting, setActing] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  /** Lanes the person has opened past the fold. */
  const [opened, setOpened] = useState<ReadonlySet<Stage>>(() => new Set());

  const board = readTracking(orders, demoTrip(), now);
  const lane = board.lanes.find((l) => l.stage === open) ?? board.lanes[0];

  const change = (reference: string, how: (o: TrackedOrder) => TrackedOrder): void =>
    setOrders((prior) => prior.map((o) => (o.reference === reference ? how(o) : o)));

  const press = (order: TrackedOrder): void => {
    const control = moveFor(order).control;
    if (control === 'chevron') change(order.reference, (o) => moveOn(o, now));
    else if (control === 'van') setAsk({ at: 'load', reference: order.reference });
    else if (control === 'doc') setAsk({ at: 'invoice', reference: order.reference });
    else if (control === 'tick') setAsk({ at: 'undo', reference: order.reference });
    else if (order.stage === 'preparing') setAsk({ at: 'settle', reference: order.reference });
    // Taken and Buying wait on somebody in Kikuubo. The card says so in the
    // padlock's `title`, which on a phone is nothing at all, so pressing it
    // opens the panel that names what is owed and carries the act.
    else setAsk({ at: 'owed', reference: order.reference });
  };

  const inAsk = orders.find((o) => o.reference === ask?.reference);
  if (lane === undefined) throw new Error('the board has no lanes');

  const fits = lane.orders.some((o) => o.reference === acting) ? SHOWN_WITH_PANEL : SHOWN;
  const window = laneWindow(lane, now, opened.has(lane.stage) ? lane.count : fits);

  return (
    <div className={s.screen}>
      {ask !== null && inAsk !== undefined && (
        <MoveOrder
          ask={ask}
          order={inAsk}
          board={orders}
          invoiceNumber={nextInvoiceNumber(orders)}
          onClose={() => setAsk(null)}
          onLoad={(run) => {
            change(inAsk.reference, (o) => loaded(o, run, now));
            setAsk(null);
          }}
          onInvoice={() => {
            const number = nextInvoiceNumber(orders);
            change(inAsk.reference, (o) => invoiced(o, number));
            setAsk(null);
          }}
          onUndo={() => {
            change(inAsk.reference, notInvoiced);
            setAsk(null);
          }}
          onSettle={(how) => {
            change(inAsk.reference, (o) => settledShort(o, how));
            setAsk(null);
          }}
          onAnswered={(supplier) => {
            change(inAsk.reference, (o) => supplierAnswered(o, supplier, now));
            // Stays open while others are still owed; closes itself once the
            // order has moved out of the lane behind it.
            if (unanswered(inAsk).length <= 1) setAsk(null);
          }}
          onCheckIn={() => {
            change(inAsk.reference, lineCheckedIn);
            if (inAsk.checkedIn + 1 >= inAsk.toBuy) setAsk(null);
          }}
        />
      )}

      <header className={s.header}>
        <div className={s.headTop}>
          <span className={s.brand} aria-hidden="true">
            <Mark d={PATH.home} size={15} />
          </span>
          <span className={s.headTitle}>Order tracking</span>
          <button type="button" className={s.headBtn} aria-label="Search the board">
            <Mark d={PATH.search} size={17} />
          </button>
        </div>

        <div className={s.steps} role="tablist" aria-label="The five stages">
          {steps(board).map((step) => {
            const on = step.stage === open;
            return (
              <button
                type="button"
                role="tab"
                key={step.stage}
                aria-selected={on}
                className={on ? s.stepOn : s.step}
                onClick={() => {
                  setOpen(step.stage);
                  setActing(null);
                }}
              >
                <span className={s.stepLabel}>{step.label}</span>
                <span className={s.stepFigures}>
                  <span className={s.stepCount}>{step.count}</span>
                  {step.chasing && (
                    <span className={s.stepDot} title="Some of this lane needs chasing" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <LaneRule lane={lane} toInvoice={board.totals.toInvoice} runs={demoTrip().runs} />

      <div className={s.lane}>
        {lane.count === 0 ? (
          <p className={s.empty}>{lane.empty}</p>
        ) : (
          window.shown.map((order) => (
            <Card
              key={order.reference}
              order={order}
              now={now}
              acting={acting === order.reference}
              onBack={() =>
                setActing((at) => (at === order.reference ? null : order.reference))
              }
              onStepBack={() => {
                change(order.reference, (o) => steppedBack(o, now));
                setActing(null);
              }}
              onPress={() => press(order)}
            />
          ))
        )}
        {window.behind > 0 && (
          <button
            type="button"
            className={s.more}
            onClick={() => setOpened((prior) => new Set([...prior, lane.stage]))}
          >
            +{window.behind}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- the lane rule ---------------------------- */

/**
 * One line: what moves an order out of this lane, and this lane's one figure.
 *
 * The figure is different in every lane because the question is: how many
 * are still owed something, how many are packed, how many runs are carrying
 * them, how many are still to invoice. A lane that showed its own count here
 * would be saying what the step above it already says.
 */
function LaneRule({
  lane,
  toInvoice,
  runs,
}: {
  readonly lane: LaneReading;
  readonly toInvoice: number;
  readonly runs: number;
}): ReactElement {
  return (
    <div className={s.rule}>
      <span className={s.ruleText}>{lane.rule.replace(/\.$/, '')}</span>

      {(lane.stage === 'draft' || lane.stage === 'awaiting_goods') && (
        <>
          <span className={s.ruleLockMark}>
            <MoveMark name="lock" size={13} />
          </span>
          <span className={s.ruleLocked}>{lane.locked}</span>
        </>
      )}

      {lane.stage === 'preparing' && (
        <>
          <span className={s.ruleWord}>packed</span>
          <span className={s.ruleFigure}>
            {lane.orders.filter((o) => markFor(o)?.text === 'packed').length}
          </span>
        </>
      )}

      {lane.stage === 'pending_delivery' && (
        <>
          <span className={s.ruleWord}>runs</span>
          <span className={s.ruleFigure}>{runs}</span>
        </>
      )}

      {lane.stage === 'completed' && (
        <>
          <span className={s.ruleDocMark}>
            <MoveMark name="doc" size={13} />
          </span>
          <span className={s.ruleToInvoice}>{toInvoice}</span>
        </>
      )}
    </div>
  );
}

/* ---------------------------------- a card -------------------------------- */

function Card({
  order,
  now,
  acting,
  onBack,
  onStepBack,
  onPress,
}: {
  readonly order: TrackedOrder;
  readonly now: Date;
  readonly acting: boolean;
  readonly onBack: () => void;
  readonly onStepBack: () => void;
  readonly onPress: () => void;
}): ReactElement {
  const move = moveFor(order);
  const mark = markFor(order);
  const meter = meterFor(order);
  const step = stepBack(order.stage);
  const handed = order.stage === 'completed' ? handedOverAt(order) : null;

  return (
    <div
      className={acting ? s.cardActing : move.control === 'lock' ? s.cardLocked : s.card}
    >
      <div className={s.top}>
        <span className={s.client}>{order.customer}</span>
        {match(order.value, {
          known: (m) => <span className={s.amount}>{Money.format(m)}</span>,
          partial: (m) => (
            <span className={s.amount} title="Part of this order could not be read">
              {Money.format(m)}+
            </span>
          ),
          unavailable: (why) => (
            <span className={s.amountUnread} title={why}>
              —
            </span>
          ),
        })}
      </div>

      <div className={s.meta}>
        <span className={s.ref}>{order.reference}</span>
        <span
          className={s.where}
          title={`${order.place} · ${order.lines} ${order.lines === 1 ? 'line' : 'lines'}${
            order.toBuy > 0 ? `, ${order.toBuy} to buy` : ''
          }`}
        >
          {order.place} · {order.lines} {order.lines === 1 ? 'line' : 'lines'}
        </span>
        <span className={handed !== null ? s.age : AGE[ageTone(order, now)]}>
          {handed ?? ageLabel(order, now)}
        </span>
      </div>

      {acting && step !== null ? (
        <>
          <div className={s.stepFromTo}>
            <span>{step.from}</span>
            <span className={s.stepArrow}>
              <MoveMark name="stepArrow" size={14} />
            </span>
            <span>{step.to}</span>
          </div>
          <p className={s.stepCost}>{step.cost}</p>
          <div className={s.stepActs}>
            <button type="button" className={s.stepLeave} onClick={onBack}>
              Leave it
            </button>
            <button type="button" className={s.stepBackBtn} onClick={onStepBack}>
              Step it back
            </button>
          </div>
        </>
      ) : (
        <div className={s.acts}>
          {meter.length > 0 && (
            <span className={s.meter}>
              {meter.map((seg, i) => (
                <span
                  // A meter segment has no identity beyond its position in
                  // the meter, which is what the index is.
                  key={i}
                  className={
                    seg === 'full' ? s.segFull : seg === 'part' ? s.segPart : s.segEmpty
                  }
                />
              ))}
            </span>
          )}
          {mark !== null && <span className={MARK[mark.tone]}>{mark.text}</span>}
          <span className={s.spacer} />
          {step !== null && (
            <button
              type="button"
              className={s.back}
              aria-label={`Step ${order.reference} back`}
              onClick={onBack}
            >
              <MoveMark name="back" size={16} />
            </button>
          )}
          <button
            type="button"
            className={SKIN[move.control]}
            title={move.why}
            aria-label={`${move.why}: ${order.reference}`}
            onClick={onPress}
          >
            <MoveMark
              name={GLYPH[move.control]}
              size={17}
              strokeWidth={move.control === 'tick' ? 2.4 : 2}
            />
          </button>
        </div>
      )}
    </div>
  );
}
