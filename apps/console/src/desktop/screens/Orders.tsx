/**
 * Orders — the desktop design.
 *
 * What reads first is the one decision waiting on the owner. What reads
 * second is the board, grouped by lane, dense enough to see the whole shop
 * at once. Beside it is the reading of all that: where the work is stuck,
 * what is late, what the margin is, and how long an order is taking.
 *
 * The four figures the design system asks this screen to surface —
 * bottleneck, overdue actions, margin, expected completion — are all
 * `Derived`, and two of them are deliberately not `known` on this data.
 */

import { useMemo, type ReactElement } from 'react';
import { Figure } from '@ow/design/react';
import {
  decisions,
  expectedCompletion,
  hoursWaiting,
  isOverdue,
  laneValue,
  margin,
  marginOf,
  match,
  readBoard,
  STAGE,
  STAGES,
  type Order,
  type Stage,
} from '@ow/domain';
import { demoCompletionHours, demoOrders } from '@ow/data';
import layout from '../DesktopApp.module.css';
import s from './Orders.module.css';
import { Icon } from '../icons.js';

/** "41 hours" reads as arithmetic. "1 day" reads as a fact about a shop. */
function waited(hours: number | null): string {
  if (hours === null) return 'no date';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function Orders(): ReactElement {
  // Fixed, so the screenshots are stable and the demo does not drift.
  const now = useMemo(() => new Date('2026-09-17T14:20:00Z'), []);
  const orders = useMemo(() => demoOrders(now), [now]);
  const board = useMemo(() => readBoard(orders, now), [orders, now]);
  const queue = useMemo(() => decisions(board, now), [board, now]);

  const next = queue[0];
  const completion = expectedCompletion(demoCompletionHours());
  const boardMargin = marginOf(orders);

  return (
    <>
      <div className={layout.work}>
        <header className={s.head}>
          <div>
            <h1 className={s.title}>Orders</h1>
            <p className={s.sub}>
              {orders.length} on the board · reading as at 14:20
            </p>
          </div>
          <div className={s.headSpacer} />
          <button type="button" className={s.btn}>
            Buying list
          </button>
          {/*
            The accent moves. With a decision waiting, the one thing to do
            next is that decision and this is a plain button; with the dock
            clear, taking the next order is the one thing to do next.
          */}
          <button
            type="button"
            className={`${s.btn} ${next === undefined ? s.primary : ''}`}
          >
            Take an order
          </button>
        </header>

        {next === undefined ? (
          <div className={s.dockClear}>
            <Icon name="sunrise" className={s.dockClearMark} />
            Nothing is waiting on you. Every order is with a supplier, a picker
            or a driver.
          </div>
        ) : (
          <section
            className={`${s.dock} ${next.urgency === 'warn' ? s.dockWarn : ''}`}
            aria-label="What needs you"
          >
            <div className={s.dockBody}>
              <div className={s.dockAsk}>{next.ask}</div>
              <div className={s.dockWhy}>{next.because}</div>
            </div>
            {queue.length > 1 && (
              <span className={s.dockRest}>
                {queue.length - 1} more after this
              </span>
            )}
            <button type="button" className={`${s.btn} ${s.primary}`}>
              {next.act}
            </button>
          </section>
        )}

        <section className={s.board} aria-label="The order board">
          <table className={s.table}>
            <colgroup>
              <col className={s.colRef} />
              <col className={s.colCustomer} />
              <col />
              <col className={s.colValue} />
              <col className={s.colMargin} />
              <col className={s.colWaiting} />
            </colgroup>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Goods</th>
                <th className={s.numeric}>Value</th>
                <th className={s.numeric}>Margin</th>
                <th>Waiting</th>
              </tr>
            </thead>
            {STAGES.map((stage) => (
              <Lane
                key={stage}
                stage={stage}
                orders={board.byStage[stage]}
                now={now}
              />
            ))}
          </table>
        </section>
      </div>

      <aside className={layout.context} aria-label="What this means">
        <div className={s.contextTitle}>What this means</div>

        <article className={s.insight}>
          <div className={s.insightLabel}>The bottleneck</div>
          {board.bottleneck === null ? (
            <>
              <div className={`${s.insightHead} ${s.insightGood}`}>
                Nothing is stuck
              </div>
              <p className={s.insightBody}>
                Every order is inside the time its lane usually takes.
              </p>
            </>
          ) : (
            <>
              <div className={`${s.insightHead} ${s.insightBad}`}>
                {STAGE[board.bottleneck.stage].name} is holding{' '}
                {board.bottleneck.overdue}
              </div>
              <p className={s.insightBody}>
                {STAGE[board.bottleneck.stage].rule} Past the{' '}
                {STAGE[board.bottleneck.stage].name.toLowerCase()} lane&rsquo;s
                usual time, so it is worth a look rather than a wait.
              </p>
            </>
          )}
        </article>

        <article className={s.insight}>
          <div className={s.insightLabel}>Waiting on you</div>
          <div
            className={`${s.insightHead} ${queue.length > 0 ? s.insightBad : s.insightGood}`}
          >
            {queue.length === 0
              ? 'Nothing'
              : `${queue.length} ${queue.length === 1 ? 'decision' : 'decisions'}`}
          </div>
          <p className={s.insightBody}>
            {board.overdue.length} past its lane&rsquo;s usual time
            {board.unknownAge.length > 0 &&
              `, and ${board.unknownAge.length} with no date on it, which cannot be chased on time at all`}
            .
          </p>
        </article>

        <article className={s.insight}>
          <div className={s.insightLabel}>Margin on the board</div>
          <Figure value={boardMargin} unit="UGX" size="lg" showBasis />
          <p className={s.insightBody}>
            Value less supplier cost across every order on the board. An order
            with no invoice yet is left out and named, never counted as costing
            nothing.
          </p>
        </article>

        <article className={s.insight}>
          <div className={s.insightLabel}>An order takes</div>
          {match(completion, {
            known: (hours, basis) => (
              <>
                <div className={s.insightHead}>
                  {Math.round(hours / 24)} days, typically
                </div>
                <p className={s.insightBody}>
                  {basis}. The median rather than the average, so one order that
                  waited three weeks on an import does not move the number you
                  plan by.
                </p>
              </>
            ),
            partial: (hours, _basis, missing) => (
              <>
                <div className={`${s.insightHead} ${s.insightWarn}`}>
                  About {Math.round(hours / 24)} days
                </div>
                <p className={s.insightBody}>{missing}</p>
              </>
            ),
            unavailable: (reason) => (
              <>
                <div className={`${s.insightHead} ${s.insightWarn}`}>
                  Cannot say yet
                </div>
                <p className={s.insightBody}>{reason}</p>
              </>
            ),
          })}
        </article>
      </aside>
    </>
  );
}

function Lane({
  stage,
  orders,
  now,
}: {
  readonly stage: Stage;
  readonly orders: readonly Order[];
  readonly now: Date;
}): ReactElement {
  const spec = STAGE[stage];

  return (
    <tbody>
      <tr className={s.laneHead}>
        <td colSpan={6}>
          <div className={s.laneTop}>
            <span className={s.laneStep}>{spec.step}</span>
            <span className={s.laneName}>{spec.name}</span>
            <span className={s.laneCount}>{orders.length}</span>
            <span className={s.laneSpacer} />
            <span className={s.laneMoney}>
              <Figure value={laneValue(orders, stage)} size="sm" align="right" />
              {/* Never "total": no two lanes mean the same thing by it. */}
              <span className={s.laneMoneyWord}>{spec.money}</span>
            </span>
          </div>
          <div className={s.laneRule}>{spec.rule}</div>
        </td>
      </tr>

      {orders.length === 0 ? (
        // "Not enough is an answer." A blank column is not.
        <tr className={s.laneEmpty}>
          <td colSpan={6}>{spec.empty}</td>
        </tr>
      ) : (
        orders.map((order) => {
          const hours = hoursWaiting(order, now);
          const late = isOverdue(order, now);
          const noDate = order.since === null;

          return (
            <tr className={s.row} key={order.id}>
              <td className={s.ref}>{order.reference}</td>
              <td className={s.who} title={order.customer}>
                {order.customer}
              </td>
              <td className={s.what} title={order.summary}>
                {order.summary}
              </td>
              <td className={s.numeric}>
                <Figure value={order.value} size="sm" align="right" />
              </td>
              <td className={s.numeric}>
                <Figure value={margin(order)} size="sm" align="right" />
              </td>
              <td
                className={`${s.waiting} ${late ? s.late : ''} ${noDate ? s.unknown : ''}`}
              >
                {waited(hours)}
                {late && ' · late'}
              </td>
            </tr>
          );
        })
      )}
    </tbody>
  );
}
