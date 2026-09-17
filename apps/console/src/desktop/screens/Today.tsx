/**
 * Today — the desktop design.
 *
 * A decision-making workspace, not a place that displays data. What reads
 * first is the four figures that decide whether today is going well; what
 * reads second is the queue of things waiting on the owner; and the column
 * beside it is the reading of all that, which is the part the old dashboard
 * never did.
 *
 * Every figure here is a `Derived<Money>`, and one of them is deliberately
 * `unavailable` — the margin, because two of this morning's orders have no
 * supplier cost yet. It renders as the reason, not as a dash and not as
 * zero. That is the law working, visible on screen.
 */

import type { ReactElement } from 'react';
import { Figure } from '@ow/design/react';
import { Money, known, partial, unavailable, type Derived } from '@ow/domain';
import layout from '../DesktopApp.module.css';
import s from './Today.module.css';
import { Icon } from '../icons.js';

const m = Money.money;

/* ---------------------------------------------------------------------- *
 * Demo data. Replaced by @ow/data queries against the live Supabase
 * project — the shapes here are already the shapes those queries return,
 * so the screen does not change when they land.
 * ---------------------------------------------------------------------- */

const takings: Derived<Money.Money> = known(
  m(4_186_000),
  '11 orders invoiced since 6am',
);

const owed: Derived<Money.Money> = known(m(9_240_500), '7 customers, 2 overdue');

const toPay: Derived<Money.Money> = partial(
  m(2_115_000),
  '4 supplier invoices due this week',
  '1 of 5 has no amount on it yet',
);

/**
 * The margin cannot be derived, and the screen says so rather than showing
 * a confident figure built on a gap. In the old app this read as 100%.
 */
const margin: Derived<Money.Money> = unavailable<Money.Money>(
  'no supplier cost on 2 of today’s orders',
);

interface Job {
  readonly id: string;
  readonly who: string;
  readonly what: string;
  readonly value: Derived<Money.Money>;
  readonly waiting: string;
  readonly state: 'good' | 'warn' | 'bad';
  readonly stateLabel: string;
}

const QUEUE: readonly Job[] = [
  {
    id: 'OW-2291',
    who: 'Ssekitoleko Hardware & General Supplies',
    what: 'Iron sheets — G28, 3m box profile ×40',
    value: known(m(3_120_000), 'order total'),
    waiting: '2 days',
    state: 'bad',
    stateLabel: 'Overdue',
  },
  {
    id: 'OW-2294',
    who: 'Kato Construction Ltd',
    what: 'Cement ×120, nails ×8 boxes',
    value: known(m(1_845_000), 'order total'),
    waiting: '4 hours',
    state: 'warn',
    stateLabel: 'Needs pick',
  },
  {
    id: 'OW-2295',
    who: 'Nabukenya Stores',
    what: 'Binding wire ×15 rolls',
    value: known(m(412_500), 'order total'),
    waiting: '1 hour',
    state: 'good',
    stateLabel: 'Packed',
  },
  {
    id: 'OW-2296',
    who: 'Mulongo Hardware',
    what: 'Roofing nails ×6 boxes',
    value: unavailable<Money.Money>('awaiting supplier quote'),
    waiting: '20 minutes',
    state: 'warn',
    stateLabel: 'Sourcing',
  },
];

const CHIP = { good: s.chipGood, warn: s.chipWarn, bad: s.chipBad } as const;

export function Today(): ReactElement {
  return (
    <>
      <div className={layout.work}>
        <header className={s.head}>
          <div>
            <h1 className={s.title}>Today</h1>
            <p className={s.sub}>Wednesday 17 September · reading as at 14:20</p>
          </div>
          <div className={s.headSpacer} />
          <button type="button" className={s.actionGhost}>
            Open cash day
          </button>
          {/* The one accent on this screen. */}
          <button type="button" className={s.action}>
            Take an order
          </button>
        </header>

        <section className={s.strip} aria-label="Today at a glance">
          <div className={s.metric}>
            <div className={s.metricLabel}>Taken today</div>
            <Figure value={takings} unit="UGX" size="lg" showBasis />
          </div>
          <div className={s.metric}>
            <div className={s.metricLabel}>Owed to us</div>
            <Figure value={owed} unit="UGX" size="lg" showBasis tone="bad" />
          </div>
          <div className={s.metric}>
            <div className={s.metricLabel}>We owe</div>
            <Figure value={toPay} unit="UGX" size="lg" showBasis />
          </div>
          <div className={s.metric}>
            <div className={s.metricLabel}>Margin today</div>
            <Figure value={margin} unit="UGX" size="lg" showBasis />
          </div>
        </section>

        <section className={s.panel} aria-label="Waiting on you">
          <div className={s.panelHead}>
            <span className={s.panelTitle}>Waiting on you</span>
            <span className={s.panelCount}>{QUEUE.length}</span>
          </div>
          <table className={s.table}>
            {/* The figure columns take exactly what a full-length figure
                needs; the two name columns share everything left over. */}
            <colgroup>
              <col className={s.colOrder} />
              <col />
              <col />
              <col className={s.colValue} />
              <col className={s.colWaiting} />
              <col className={s.colState} />
            </colgroup>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Goods</th>
                <th className={s.numeric}>Value</th>
                <th>Waiting</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {QUEUE.map((job) => (
                <tr key={job.id}>
                  <td className={s.meta}>{job.id}</td>
                  <td className={s.name} title={job.who}>
                    {job.who}
                  </td>
                  <td className={s.name} title={job.what}>
                    {job.what}
                  </td>
                  <td className={s.numeric}>
                    <Figure value={job.value} size="sm" align="right" />
                  </td>
                  <td className={s.meta}>{job.waiting}</td>
                  <td>
                    <span className={`${s.chip} ${CHIP[job.state]}`}>
                      <span className={s.dot} aria-hidden="true" />
                      {job.stateLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className={s.demoNote}>
          The figures above are demonstration data in the shapes the live
          queries return. “Margin today” is deliberately underivable, to show
          what the app does with a gap: it names the cause instead of
          reporting a confident number built on one.
        </p>
      </div>

      <aside className={layout.context} aria-label="What this means">
        <div className={s.contextTitle}>What this means</div>

        <Insight
          tone="bad"
          label="Ssekitoleko is 2 days overdue"
          body="3,120,000 on an order picked Monday. They have paid late twice in the last six weeks, both times after a call rather than a message."
          action="Draft the chase"
        />
        <Insight
          tone="warn"
          label="Margin is unreadable until 2 costs land"
          body="OW-2296 and OW-2290 have no supplier cost. Until they do, today's margin cannot be derived — and neither can this week's."
          action="Enter the costs"
        />
        <Insight
          tone="good"
          label="Kikuubo Metals is cheapest on G28 today"
          body="12,400 a sheet against Mukwano's 13,150. On the 40 sheets in OW-2291 that is 30,000 saved."
          action="Compare suppliers"
        />
        <Insight
          tone="warn"
          label="Binding wire runs out in 3 days"
          body="15 rolls left, selling about 5 a day this month. The last order from Kikuubo took 2 days to arrive."
          action="Reorder"
        />
      </aside>
    </>
  );
}

interface InsightProps {
  readonly tone: 'good' | 'warn' | 'bad';
  readonly label: string;
  readonly body: string;
  readonly action: string;
}

function Insight({ tone, label, body, action }: InsightProps): ReactElement {
  return (
    <article className={s.insight}>
      <div className={s.insightHead}>
        <span className={`${s.chip} ${CHIP[tone]}`}>
          <span className={s.dot} aria-hidden="true" />
          {tone === 'bad' ? 'Act' : tone === 'warn' ? 'Look' : 'Good'}
        </span>
        <span className={s.insightLabel}>{label}</span>
      </div>
      <p className={s.insightBody}>{body}</p>
      {/* A control says what will happen, never "Submit". */}
      <button type="button" className={s.insightLink}>
        {action}
        <Icon name="chevron-right" />
      </button>
    </article>
  );
}
