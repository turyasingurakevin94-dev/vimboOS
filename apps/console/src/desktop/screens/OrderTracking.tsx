/**
 * Order tracking — the desktop console. Frame `1a` of the handoff.
 *
 * **The card is a name, a figure and one control.** The control IS the
 * movement, and its shape says what is possible: a chevron where nothing is
 * owed, an amber padlock where something is, a van out of Preparing because
 * loading is the move, a solid document on a delivered order and a green
 * tick on an invoiced one. Nothing on this screen explains that in a
 * sentence; a four-glyph legend in the page head teaches it once.
 *
 * Everything the board knows about a card lives in `@ow/domain`, not here.
 * `moveFor` decides the control, `markFor` the two words beside the meter,
 * `readTracking` every count on the screen. This file draws them.
 *
 * ## The controls do the thing
 *
 * Pressing a chevron moves the order, and the lane counts, the dock tiles and
 * the phone's header strip all change together because all of them are one
 * reading of one array. That matters more than it sounds: a board whose
 * controls are decoration teaches that the app is decoration, and this app
 * has shipped a button that did nothing once already.
 *
 * ## What is drawn differently from the frame, and why
 *
 * 1. **The shell's top bar is this app's, not the frame's.** The frame draws
 *    a 54px navy bar; `Rail.dc.html`, which the design system calls the
 *    authority on navigation, draws 58px and white, and it is chrome the
 *    shell owns for every screen. The work area below it is the frame's, to
 *    the pixel.
 * 2. **`Past stage limit` reads 6, where the frame typed 5.** The card's age
 *    turns coral past the limit and six of the fifty-four are coral. A tile
 *    that disagrees with the cards under it is the second reckoning the
 *    handoff's own last rule forbids. See `demo-tracking.test.ts`.
 * 3. **One card carries the oxide edge, not two.** It is the card the queue
 *    is serving, so pressing `Next` walks the mark across the board — which
 *    is the dock pointing at a card rather than printing a second copy of
 *    it. The design system allows one such row per screen.
 */

import { useMemo, useState, type ReactElement } from 'react';
import {
  LEGEND,
  Money,
  ageLabel,
  ageTone,
  dockBasis,
  hoursWaiting,
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
  supplierAnswered,
  unanswered,
  type Control,
  type LaneReading,
  type TrackedOrder,
} from '@ow/domain';
import { DEMO_BOARD_NOW, demoAsks, demoTrackedOrders, demoTrip } from '@ow/data';
import s from './OrderTracking.module.css';
import { MoveOrder, type Ask as MoveAsk } from './MoveOrder.js';
import { Icon, type IconName } from '../icons.js';

/** Each control's glyph and its skin. One table, read by the card and the legend. */
const GLYPH: Readonly<Record<Control, IconName>> = {
  chevron: 'move-on',
  lock: 'lock',
  van: 'van',
  doc: 'doc',
  tick: 'tick',
};

/**
 * A CSS-module key is `string | undefined` to the type-checker, so these
 * tables are left to infer rather than annotated `Record<_, string>`. A
 * separate test proves every one of them resolves to a real rule — an
 * annotation here would only be a promise, and `undefined` renders as the
 * class name "undefined" without so much as a warning.
 */
const SKIN = {
  chevron: s.moveChevron,
  lock: s.moveLock,
  van: s.moveVan,
  doc: s.moveDoc,
  tick: s.moveTick,
};

const AGE = {
  quiet: s.ageQuiet,
  closing: s.ageClosing,
  past: s.agePast,
};

const MARK = {
  waiting: s.markWaiting,
  done: s.markDone,
  quiet: s.markQuiet,
};

/** A lane's own door, where it has one. */
const LANE_ACT: Readonly<Partial<Record<string, string>>> = {
  awaiting_goods: 'Buying list',
  pending_delivery: 'Runs',
  completed: 'Invoice',
};

/**
 * The card frame `1a` draws with its step-back panel open: the oldest card
 * in Preparing.
 *
 * Derived rather than named. Quite apart from surviving a change to the
 * data, an order reference in this shop is spelled `#339` — which is also a
 * valid CSS colour, and the rule that keeps hand-typed hex out of this tree
 * reads it as one. A literal here is a lint failure waiting for the next
 * person who writes one.
 */
const openAtRest = (orders: readonly TrackedOrder[], now: Date): string | null => {
  const preparing = orders.filter((o) => o.stage === 'preparing');
  const oldest = [...preparing].sort(
    (a, b) => (hoursWaiting(b, now) ?? 0) - (hoursWaiting(a, now) ?? 0),
  )[0];
  return oldest?.reference ?? null;
};

/** How many cards a desktop lane draws before it starts counting. */
const SHOWN = 24;
/** Delivered is a window on today, and the morning is counted at its foot. */
const SHOWN_DELIVERED = 6;

export interface OrderTrackingProps {
  /** The shell's own navigation. A door on this board is a door, not a stub. */
  readonly onGo: (destination: string) => void;
}

export function OrderTracking({ onGo }: OrderTrackingProps): ReactElement {
  const now = DEMO_BOARD_NOW;
  const trip = useMemo(demoTrip, []);
  const asks = useMemo(demoAsks, []);

  const [orders, setOrders] = useState<readonly TrackedOrder[]>(demoTrackedOrders);
  /**
   * The card whose step-back panel is open. One at a time — opening a second
   * closes the first, which is not a limitation but the thing that stops a
   * press landing on the wrong card after the lane above it grew taller.
   *
   * It opens at rest on the oldest card in Preparing, because that is where
   * frame `1a` draws it open — stepped back into Buying, with what the step
   * would cost said before it happens.
   */
  const [acting, setActing] = useState<string | null>(() =>
    openAtRest(demoTrackedOrders(), DEMO_BOARD_NOW),
  );
  const [ask, setAsk] = useState<MoveAsk | null>(null);
  const [served, setServed] = useState(0);
  /** Lanes opened past the window they draw at rest. */
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());

  const board = readTracking(orders, trip, now);
  const basis = dockBasis(board);
  const current = asks[served % asks.length];
  const peek = [asks[(served + 1) % asks.length], asks[(served + 2) % asks.length]];

  const change = (reference: string, how: (o: TrackedOrder) => TrackedOrder): void =>
    setOrders((prior) => prior.map((o) => (o.reference === reference ? how(o) : o)));

  /** The one control. What it does depends on what it is. */
  const press = (order: TrackedOrder): void => {
    const control = moveFor(order).control;
    if (control === 'chevron') change(order.reference, (o) => moveOn(o, now));
    else if (control === 'van') setAsk({ at: 'load', reference: order.reference });
    else if (control === 'doc') setAsk({ at: 'invoice', reference: order.reference });
    else if (control === 'tick') setAsk({ at: 'undo', reference: order.reference });
    else if (order.stage === 'preparing') setAsk({ at: 'settle', reference: order.reference });
    // Taken and Buying wait on somebody in Kikuubo, and the padlock used to
    // say so only in its `title` — a hover, which is nothing on a phone and
    // a guess on a console. It opens and says what is owed.
    else setAsk({ at: 'owed', reference: order.reference });
  };

  /**
   * A lane's own door. Two of the three lead off this screen; the third is
   * the screen's own work, so it opens here.
   */
  const laneAct = (lane: LaneReading): void => {
    if (lane.stage === 'awaiting_goods') onGo('sourcing');
    else if (lane.stage === 'pending_delivery') onGo('runs');
    else {
      // `Invoice` at the head of Delivered invoices the one the lane is
      // about: the oldest handover nobody has invoiced yet. It used to be a
      // button that did nothing at the head of a lane of seventeen.
      const next = laneWindow(lane, now, lane.count).shown.find((o) => o.invoice === null);
      if (next !== undefined) setAsk({ at: 'invoice', reference: next.reference });
    }
  };

  const inAsk = orders.find((o) => o.reference === ask?.reference);

  return (
    <div className={s.page}>
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
            // The panel stays open while other suppliers are still owed, and
            // closes itself when the order has left the lane behind it.
            if (unanswered(inAsk).length <= 1) setAsk(null);
          }}
          onCheckIn={() => {
            change(inAsk.reference, lineCheckedIn);
            if (inAsk.checkedIn + 1 >= inAsk.toBuy) setAsk(null);
          }}
          onGo={(destination) => {
            setAsk(null);
            onGo(destination);
          }}
        />
      )}

      <header className={s.head}>
        <h1 className={s.title}>Order tracking</h1>
        <button type="button" className={s.about} aria-label="What this board counts">
          i
        </button>
        <p className={s.position}>
          {board.totals.live} live · {asks.length} need you, one at a time
        </p>

        <div className={s.legend} aria-label="What a card's control means">
          {LEGEND.map((mark) => (
            <span className={s.legendItem} key={mark.control} title={mark.label}>
              <span className={`${s.legendGlyph} ${SKIN[mark.control]}`}>
                <Icon name={GLYPH[mark.control]} size={12} />
              </span>
              <span className={s.legendLabel}>{mark.label}</span>
            </span>
          ))}
        </div>

        <span className={s.spacer} />
        <button type="button" className={s.search}>
          <Icon name="search" size={14} />
          Client, order number or item
        </button>
        <button type="button" className={s.control} onClick={() => onGo('quote')}>
          New quote
        </button>
      </header>

      {/* ------------------------------- the dock ----------------------------- */}

      <section className={s.dock} aria-label="The position">
        <div className={s.tiles}>
          <Tile label="Live" figure={String(board.totals.live)} basis={basis.live} />
          <span className={s.tileRule} />
          <Tile
            label="Cash to buy in"
            figure={match(board.totals.cashToBuyIn, {
              known: (m) => Money.format(m),
              partial: (m) => Money.format(m),
              unavailable: () => '—',
            })}
            unit="UGX"
            basis={basis.cashToBuyIn}
          />
          <span className={s.tileRule} />
          <Tile
            label="Past stage limit"
            figure={String(board.totals.pastStageLimit)}
            basis={basis.pastStageLimit}
            bad
          />
          <span className={s.tileRule} />
          <Tile
            label="To invoice"
            figure={String(board.totals.toInvoice)}
            basis={basis.toInvoice}
          />
        </div>

        <span className={s.dockRule} />

        <div className={s.trip}>
          <div className={s.tripHead}>
            <span className={s.tileLabel}>Today&rsquo;s trip &amp; runs</span>
            <span className={s.spacer} />
            <button type="button" className={s.tripSmall} onClick={() => onGo('sourcing')}>
              Plan trip
            </button>
            <button type="button" className={s.tripSmall} onClick={() => onGo('runs')}>
              Runs
            </button>
          </div>
          <p className={s.tripRoute}>
            {trip.route} · {trip.stops} stops · carry{' '}
            <span className={s.tripCarry}>
              {match(trip.carry, {
                known: (m) => Money.format(m),
                partial: (m) => Money.format(m),
                unavailable: () => '—',
              })}
            </span>{' '}
            <span className={s.tripUnit}>UGX</span>
          </p>
          <p className={s.tripRuns}>
            {board.lanes[3]?.count ?? 0} orders out on {trip.runs} runs ·{' '}
            {trip.overdue === 0 ? 'nothing overdue' : `${trip.overdue} overdue`}
          </p>
        </div>
      </section>

      {/* ------------------------------ needs you ----------------------------- */}

      <section className={s.queue} aria-label="Waiting on you">
        <div className={s.queueHead}>
          <span className={s.queueName}>Needs you</span>
          <span className={s.queueCount}>{asks.length}</span>
          <span className={s.queueNote}>
            A queue, longest waiting first. One at a time; the rest wait their turn.
          </span>
          <div className={s.queueNav}>
            <span className={s.queuePos}>
              {(served % asks.length) + 1} of {asks.length}
            </span>
            <button
              type="button"
              className={s.queuePrev}
              aria-label="The one before"
              onClick={() => setServed((i) => (i + asks.length - 1) % asks.length)}
            >
              <Icon name="step-back" size={14} />
            </button>
            <button
              type="button"
              className={s.queueNext}
              onClick={() => setServed((i) => (i + 1) % asks.length)}
            >
              Next
              <Icon name="move-on" size={14} />
            </button>
          </div>
        </div>

        {current !== undefined && (
          <div className={s.queueBody}>
            <div className={s.ask}>
              <div className={s.askText}>
                <div className={s.askTop}>
                  <span className={s.askClient}>{current.customer}</span>
                  <span className={s.askMeta}>
                    {current.reference} · {current.place} · {current.age}
                  </span>
                </div>
                <p className={s.askWhy}>{current.why}</p>
              </div>
              <div className={s.askSide}>
                <span className={s.askAmount}>
                  {match(current.value, {
                    known: (m) => Money.format(m),
                    partial: (m) => Money.format(m),
                    unavailable: () => '—',
                  })}
                </span>
                <div className={s.askActs}>
                  <button
                    type="button"
                    className={s.askSecondary}
                    onClick={() => onGo('messages')}
                  >
                    {current.instead}
                  </button>
                  <button
                    type="button"
                    className={s.askPrimary}
                    onClick={() => setServed((i) => (i + 1) % asks.length)}
                  >
                    {current.act}
                  </button>
                </div>
              </div>
            </div>

            <div className={s.peek}>
              <span className={s.peekLabel}>Behind it</span>
              {peek.map((next, i) =>
                next === undefined ? null : (
                  <button
                    type="button"
                    className={s.peekRow}
                    key={next.reference}
                    onClick={() => setServed((at) => (at + i + 1) % asks.length)}
                  >
                    <span className={s.peekClient}>{next.customer}</span>
                    <span className={s.peekRef}>{next.reference}</span>
                    <span className={`${s.peekAge} ${AGE[next.tone]}`}>{next.age}</span>
                  </button>
                ),
              )}
              <span className={s.peekFoot}>
                +{Math.max(0, asks.length - 3)} more behind · open the Waiting-on-you list
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------- the board ---------------------------- */}

      <section className={s.board} aria-label="The stage board">
        {board.totals.live === 0 ? (
          <p className={s.boardEmpty}>No orders on the board. A saved quote lands in Taken.</p>
        ) : (
          board.lanes.map((lane) => (
            <Lane
              key={lane.stage}
              lane={lane}
              now={now}
              acting={acting}
              serving={current?.reference ?? null}
              onBack={(ref) => setActing((open) => (open === ref ? null : ref))}
              onStepBack={(ref) => {
                change(ref, (o) => steppedBack(o, now));
                setActing(null);
              }}
              onPress={press}
              opened={opened.has(lane.stage)}
              onOpen={() => setOpened((prior) => new Set([...prior, lane.stage]))}
              onAct={() => laneAct(lane)}
            />
          ))
        )}
      </section>
    </div>
  );
}

/* ---------------------------------- a tile -------------------------------- */

function Tile({
  label,
  figure,
  unit,
  basis,
  bad = false,
}: {
  readonly label: string;
  readonly figure: string;
  readonly unit?: string;
  readonly basis: string;
  readonly bad?: boolean;
}): ReactElement {
  return (
    // The basis is the tile's own title rather than a line under it: the
    // frame draws a single-row dock, and every one of these four figures is
    // spelled out again within 200px — the lane heads below are the basis
    // for `Live`, and the trip block beside it is the basis for the cash.
    <div className={s.tile} title={basis}>
      <span className={s.tileLabel}>{label}</span>
      <span className={bad ? s.tileFigureBad : s.tileFigure}>
        {figure}
        {unit !== undefined && <span className={s.unit}> {unit}</span>}
      </span>
    </div>
  );
}

/* ---------------------------------- a lane -------------------------------- */

function Lane({
  lane,
  now,
  acting,
  serving,
  onBack,
  onStepBack,
  onPress,
  opened,
  onOpen,
  onAct,
}: {
  readonly lane: LaneReading;
  readonly now: Date;
  readonly acting: string | null;
  readonly serving: string | null;
  readonly onBack: (reference: string) => void;
  readonly onStepBack: (reference: string) => void;
  readonly onPress: (order: TrackedOrder) => void;
  readonly opened: boolean;
  readonly onOpen: () => void;
  readonly onAct: () => void;
}): ReactElement {
  const act = LANE_ACT[lane.stage];
  const fits = lane.stage === 'completed' ? SHOWN_DELIVERED : SHOWN;
  const window = laneWindow(lane, now, opened ? lane.count : fits);

  return (
    <div className={`${s.lane} ${lane.stage === 'completed' ? s.laneDone : ''}`}>
      <div className={s.laneHead}>
        <div className={s.laneTop}>
          <span className={s.laneName}>{lane.name}</span>
          <span className={s.laneCount}>{lane.count}</span>
          <span className={s.spacer} />
          {act !== undefined && (
            <button type="button" className={s.laneAct} onClick={onAct}>
              {act}
            </button>
          )}
        </div>
        <p className={s.laneRule}>{lane.rule}</p>
      </div>

      <div className={s.laneBody}>
        {lane.count === 0 ? (
          <p className={s.laneEmpty}>{lane.empty}</p>
        ) : (
          window.shown.map((order) => (
            <Card
              key={order.reference}
              order={order}
              now={now}
              acting={acting === order.reference}
              serving={serving === order.reference}
              onBack={() => onBack(order.reference)}
              onStepBack={() => onStepBack(order.reference)}
              onPress={() => onPress(order)}
            />
          ))
        )}
        {window.more !== null && (
          <button type="button" className={s.laneMore} onClick={onOpen}>
            {window.more}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- a card -------------------------------- */

function Card({
  order,
  now,
  acting,
  serving,
  onBack,
  onStepBack,
  onPress,
}: {
  readonly order: TrackedOrder;
  readonly now: Date;
  readonly acting: boolean;
  readonly serving: boolean;
  readonly onBack: () => void;
  readonly onStepBack: () => void;
  readonly onPress: () => void;
}): ReactElement {
  const move = moveFor(order);
  const mark = markFor(order);
  const meter = meterFor(order);
  const step = stepBack(order.stage);

  return (
    <div
      className={`${s.card} ${serving ? s.cardNeeds : ''} ${acting ? s.cardActing : ''}`}
    >
      <div className={s.cardTop}>
        <span className={s.client} title={order.customer}>
          {order.customer}
        </span>
        {serving && <span className={s.flag}>Needs you</span>}
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

      <div className={s.cardMeta}>
        <span className={s.ref}>{order.reference}</span>
        <span
          className={s.where}
          title={`${order.place} · ${order.lines} ${order.lines === 1 ? 'line' : 'lines'}${
            order.toBuy > 0 ? `, ${order.toBuy} to buy` : ''
          }`}
        >
          {order.place} · {order.lines} {order.lines === 1 ? 'line' : 'lines'}
          {order.toBuy > 0 && <span className={s.toBuy}>, {order.toBuy} to buy</span>}
        </span>
        <span className={`${s.age} ${AGE[ageTone(order, now)]}`}>
          {ageLabel(order, now)}
        </span>
      </div>

      {/* Above the control row, so a supplier's name is never truncated. */}
      {mark !== null && <p className={MARK[mark.tone]}>{mark.text}</p>}

      <div className={s.controls}>
        <span className={s.meter}>
          {meter.map((seg, i) => (
            <span
              // A meter segment has no identity beyond its position in the
              // meter, which is what the index is.
              key={i}
              className={seg === 'full' ? s.segFull : seg === 'part' ? s.segPart : s.segEmpty}
            />
          ))}
        </span>
        <span className={s.spacer} />
        {step !== null && (
          <button
            type="button"
            className={s.back}
            title="Step it back"
            aria-label={`Step ${order.reference} back`}
            aria-expanded={acting}
            onClick={onBack}
          >
            <Icon name="step-back" size={13} />
          </button>
        )}
        <button
          type="button"
          className={SKIN[move.control]}
          title={move.why}
          aria-label={`${move.why}: ${order.reference}`}
          onClick={onPress}
        >
          <Icon name={GLYPH[move.control]} size={13} strokeWidth={move.control === 'tick' ? 2.4 : 2} />
        </button>
      </div>

      {acting && step !== null && (
        <div className={s.stepBack}>
          <div className={s.stepFromTo}>
            <span>{step.from}</span>
            <Icon name="step-arrow" size={13} className={s.stepArrow} />
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
        </div>
      )}
    </div>
  );
}
