/**
 * Today — the phone design.
 *
 * Same question as the desktop screen, different answer. The figures are a
 * 2×2 in one card rather than a strip; the queue is cards with the action
 * ON them rather than a table you click into; the reading of it all sits
 * below the work rather than beside it; and the one thing to do next is a
 * full-width button in the thumb zone rather than a 32px button in a header.
 *
 * Nothing in this file imports anything from `../desktop/`, and a lint rule
 * would stop it. The duplication with the desktop screen is the law working,
 * not a shortcut not yet taken.
 */

import type { ReactElement } from 'react';
import { Figure } from '@ow/design/react';
import { Money, known, partial, unavailable, type Derived } from '@ow/domain';
import s from './Today.module.css';
import { ChevronRight } from '../icons.js';

const m = Money.money;

const takings: Derived<Money.Money> = known(m(4_186_000), '11 orders since 6am');
const owed: Derived<Money.Money> = known(m(9_240_500), '7 customers');
const toPay: Derived<Money.Money> = partial(
  m(2_115_000),
  '4 invoices due',
  '1 of 5 has no amount yet',
);
const margin: Derived<Money.Money> = unavailable<Money.Money>(
  'no cost on 2 of today’s orders',
);

interface Job {
  readonly id: string;
  readonly who: string;
  readonly what: string;
  readonly value: Derived<Money.Money>;
  readonly waiting: string;
  readonly state: 'good' | 'warn' | 'bad';
  readonly stateLabel: string;
  readonly action: string;
}

const QUEUE: readonly Job[] = [
  {
    id: 'OW-2291',
    who: 'Ssekitoleko Hardware & General Supplies',
    what: 'Iron sheets — G28, 3m box profile ×40',
    value: known(m(3_120_000), 'order total'),
    waiting: 'Waiting 2 days',
    state: 'bad',
    stateLabel: 'Overdue',
    action: 'Draft the chase',
  },
  {
    id: 'OW-2294',
    who: 'Kato Construction Ltd',
    what: 'Cement ×120, nails ×8 boxes',
    value: known(m(1_845_000), 'order total'),
    waiting: 'Waiting 4 hours',
    state: 'warn',
    stateLabel: 'Needs pick',
    action: 'Start the pick',
  },
  {
    id: 'OW-2296',
    who: 'Mulongo Hardware',
    what: 'Roofing nails ×6 boxes',
    value: unavailable<Money.Money>('awaiting supplier quote'),
    waiting: 'Waiting 20 minutes',
    state: 'warn',
    stateLabel: 'Sourcing',
    action: 'Ask Kikuubo',
  },
];

const CHIP = { good: s.chipGood, warn: s.chipWarn, bad: s.chipBad } as const;

export function Today(): ReactElement {
  return (
    <>
      <div className={s.head}>
        <p className={s.date}>Wednesday 17 September · as at 14:20</p>
      </div>

      <section className={s.metrics} aria-label="Today at a glance">
        <div className={s.metric}>
          <div className={s.metricLabel}>Taken today</div>
          <Figure value={takings} unit="UGX" size="md" />
        </div>
        <div className={s.metric}>
          <div className={s.metricLabel}>Owed to us</div>
          <Figure value={owed} unit="UGX" size="md" tone="bad" />
        </div>
        <div className={s.metric}>
          <div className={s.metricLabel}>We owe</div>
          <Figure value={toPay} unit="UGX" size="md" />
        </div>
        <div className={s.metric}>
          <div className={s.metricLabel}>Margin today</div>
          <Figure value={margin} unit="UGX" size="md" />
        </div>
      </section>

      <div className={s.sectionTitle}>
        <span className={s.sectionName}>Waiting on you</span>
        <span className={s.sectionCount}>{QUEUE.length}</span>
      </div>

      {QUEUE.map((job) => (
        <article className={s.job} key={job.id}>
          <div className={s.jobTop}>
            <span className={s.jobId}>{job.id}</span>
            <div className={s.jobSpacer} />
            <span className={`${s.chip} ${CHIP[job.state]}`}>
              <span className={s.dot} aria-hidden="true" />
              {job.stateLabel}
            </span>
          </div>
          <div className={s.jobWho} title={job.who}>
            {job.who}
          </div>
          <div className={s.jobWhat}>{job.what}</div>
          <div className={s.jobFoot}>
            <div>
              <Figure value={job.value} unit="UGX" size="md" />
              <div className={s.jobWaiting}>{job.waiting}</div>
            </div>
            <div className={s.jobSpacer} />
            <button type="button" className={s.jobAction}>
              {job.action}
            </button>
          </div>
        </article>
      ))}

      <div className={s.sectionTitle}>
        <span className={s.sectionName}>What this means</span>
      </div>

      <Insight
        tone="bad"
        chip="Act"
        label="Ssekitoleko is 2 days overdue"
        body="3,120,000 on an order picked Monday. They have paid late twice in six weeks — both times after a call, not a message."
        action="Draft the chase"
      />
      <Insight
        tone="warn"
        chip="Look"
        label="Margin is unreadable until 2 costs land"
        body="OW-2296 and OW-2290 have no supplier cost. Until they do, today's margin cannot be derived."
        action="Enter the costs"
      />
      <Insight
        tone="good"
        chip="Good"
        label="Kikuubo is cheapest on G28 today"
        body="12,400 a sheet against Mukwano's 13,150. On the 40 sheets in OW-2291 that is 30,000 saved."
        action="Compare suppliers"
      />

      <p className={s.demoNote}>
        Demonstration data. “Margin today” is deliberately underivable, to show
        what the app does with a gap.
      </p>
    </>
  );
}

interface InsightProps {
  readonly tone: 'good' | 'warn' | 'bad';
  readonly chip: string;
  readonly label: string;
  readonly body: string;
  readonly action: string;
}

function Insight({ tone, chip, label, body, action }: InsightProps): ReactElement {
  return (
    <article className={s.insight}>
      <span className={`${s.chip} ${CHIP[tone]}`}>
        <span className={s.dot} aria-hidden="true" />
        {chip}
      </span>
      <div className={s.insightLabel}>{label}</div>
      <p className={s.insightBody}>{body}</p>
      <button type="button" className={s.insightAction}>
        {action}
        <ChevronRight />
      </button>
    </article>
  );
}
