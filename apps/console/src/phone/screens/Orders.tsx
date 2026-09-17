/**
 * Orders — the phone design.
 *
 * Same board, same domain, a different product. The desktop shows five lanes
 * at once and twenty rows; the phone shows one lane and cards, because it is
 * held in one hand in a yard and the person using it came to answer one
 * question — usually "what is out for delivery" or "what is late".
 *
 * The decision waiting is stated at the top, and its action is in the thumb
 * bar. Those are two halves of one thing, deliberately far apart: the words
 * belong where the eye lands and the button belongs where the thumb is.
 *
 * Nothing here imports from `../../desktop/`, and a lint rule plus a test
 * would both stop it. The overlap with the desktop screen is two designs
 * answering one question, which is the law working.
 */

import { useMemo, useState, type ReactElement } from 'react';
import { Figure } from '@ow/design/react';
import {
  decisions,
  hoursWaiting,
  isOverdue,
  laneValue,
  margin,
  readBoard,
  STAGE,
  STAGES,
  type Order,
  type Stage,
} from '@ow/domain';
import { demoOrders } from '@ow/data';
import s from './Orders.module.css';

const NOW = new Date('2026-09-17T14:20:00Z');

/** The thumb bar's label for this screen: the one thing to do next. */
export function ordersThumbAction(): string {
  const board = readBoard(demoOrders(NOW), NOW);
  return decisions(board, NOW)[0]?.act ?? 'Take an order';
}

function waited(hours: number | null): string {
  if (hours === null) return 'no date on it';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)} hours here`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} here`;
}

export function Orders(): ReactElement {
  const orders = useMemo(() => demoOrders(NOW), []);
  const board = useMemo(() => readBoard(orders, NOW), [orders]);
  const queue = useMemo(() => decisions(board, NOW), [board]);

  // The lane the owner most often opens the phone for is the one that is
  // stuck. Defaulting there saves a tap on the morning it matters.
  const [lane, setLane] = useState<Stage>(
    () => board.bottleneck?.stage ?? 'preparing',
  );

  const next = queue[0];
  const spec = STAGE[lane];
  const inLane = board.byStage[lane];

  return (
    <>
      {next === undefined ? (
        <div className={s.clear}>
          Nothing is waiting on you. Every order is with a supplier, a picker
          or a driver.
        </div>
      ) : (
        <section
          className={`${s.decision} ${next.urgency === 'warn' ? s.decisionWarn : ''}`}
          aria-label="What needs you"
        >
          <div className={s.decisionLabel}>Needs you</div>
          <div className={s.decisionAsk}>{next.ask}</div>
          <div className={s.decisionWhy}>{next.because}</div>
          {queue.length > 1 && (
            <div className={s.decisionRest}>
              {queue.length - 1} more after this one
            </div>
          )}
        </section>
      )}

      <div className={s.lanes} role="tablist" aria-label="Lanes">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            role="tab"
            aria-selected={stage === lane}
            className={`${s.lane} ${stage === lane ? s.laneOn : ''}`}
            onClick={() => setLane(stage)}
          >
            {STAGE[stage].name}
            <span className={s.laneCount}>{board.byStage[stage].length}</span>
          </button>
        ))}
      </div>

      <div className={s.laneAbout}>
        <div className={s.laneMoney}>
          <Figure value={laneValue(inLane, lane)} size="md" />
          {/* What this lane's money IS. Never "total" — no two lanes mean
              the same thing by it. */}
          <span className={s.laneMoneyWord}>{spec.money}</span>
        </div>
        <div className={s.laneRule}>{spec.rule}</div>
      </div>

      {inLane.length === 0 ? (
        // "Not enough is an answer." A blank list is not.
        <div className={s.empty}>{spec.empty}</div>
      ) : (
        inLane.map((order) => <Card key={order.id} order={order} />)
      )}

      <p className={s.note}>
        Demonstration data in the shape the live query returns. Two orders
        carry no supplier invoice, so their margin is not shown as zero — it
        is shown as the reason it cannot be worked out.
      </p>
    </>
  );
}

function Card({ order }: { readonly order: Order }): ReactElement {
  const hours = hoursWaiting(order, NOW);
  const late = isOverdue(order, NOW);
  const noDate = order.since === null;

  return (
    <article className={s.card}>
      <div className={s.cardTop}>
        <span className={s.ref}>{order.reference}</span>
        <span className={s.spacer} />
        <span
          className={`${s.chip} ${late ? s.chipBad : noDate ? s.chipWarn : s.chipPlain}`}
        >
          {(late || noDate) && <span className={s.dot} aria-hidden="true" />}
          {late ? `Late · ${waited(hours)}` : waited(hours)}
        </span>
      </div>

      <div className={s.who} title={order.customer}>
        {order.customer}
      </div>
      <div className={s.what}>{order.summary}</div>

      <div className={s.figures}>
        <div>
          <div className={s.figureLabel}>Value</div>
          <Figure value={order.value} unit="UGX" size="md" />
        </div>
        <div>
          <div className={s.figureLabel}>Margin</div>
          <Figure value={margin(order)} size="md" />
        </div>
      </div>
    </article>
  );
}
