/**
 * Today — the desktop console. Built to screen 2a of the Today handoff.
 *
 * The three things this screen does that the old one did not:
 *
 * 1. **One ranked list, not two.** The Manager's numbered moves first, then
 *    the watch beneath as denser rows — same reading order, same visual
 *    family, but separate containers, so the watch can never be sorted into
 *    the moves.
 * 2. **A money strip that states a position**, not five unrelated figures.
 *    Every figure carries its basis on the line below it.
 * 3. **Every alert carries its arithmetic** — both ends of the comparison,
 *    so a row can be checked rather than believed.
 *
 * ## The strip is wired; the list below it is not yet
 *
 * The five cells, the date and the "things want you" count all come from
 * `useToday` now. The moves and the week bars below are still the handoff's
 * own arrays.
 *
 * Wiring the strip changed four things the handoff states in prose, because
 * the prose disagreed with the data beside it. All four are raised for
 * design rather than kept:
 *
 * | the handoff draws | the reckoning says |
 * | ----------------- | ------------------ |
 * | Monday 15 September | **Tuesday** — 15 Sep 2026 is a Tuesday |
 * | 9 customers | **11** accounts owing that 23,650,000 |
 * | a 3-segment aging bar | `agingBands` returns **four** bands |
 * | margin `−1.4 pts` | needs a second window nothing computes |
 */

import { useState, type ReactElement } from 'react';
import {
  Money,
  SOLD_WEEKS,
  type AgingBand,
  type Derived,
  type ManagerMove,
  type SoldByWeek,
  type TodayStrip,
} from '@ow/domain';
import s from './Today.module.css';
import { Icon, type IconName } from '../icons.js';
import { useToday } from '../../app/useToday.js';

const v = (token: string): string => `var(--ow-color-${token})`;

/* ------------------------------ metric strip ------------------------------ */

interface Metric {
  readonly label: string;
  readonly icon: IconName;
  readonly fill: string;
  readonly edge: string;
  readonly chip: string;
  readonly chipInk: string;
  readonly figure: string;
  readonly delta?: { readonly text: string; readonly fill: string; readonly ink: string };
  readonly basis: ReactElement;
  readonly aging?: readonly { readonly pct: number; readonly fill: string }[];
}

/** The five cells as the handoff paints them. Presentation only. */
type Skin = Pick<Metric, 'label' | 'icon' | 'fill' | 'edge' | 'chip' | 'chipInk'>;

const SKIN: Readonly<Record<'cash' | 'owed' | 'owe' | 'margin' | 'stock', Skin>> = {
  cash: {
    label: 'Cash on hand',
    icon: 'wallet',
    fill: v('cash-fill'),
    edge: v('cash-edge'),
    chip: v('cash-chip'),
    chipInk: v('info-ink'),
  },
  owed: {
    label: 'Owed to you',
    icon: 'trending-down',
    fill: v('bad-fill'),
    edge: v('debt-edge'),
    chip: v('bad-chip-soft'),
    chipInk: v('bad-ink'),
  },
  owe: {
    label: 'You owe',
    icon: 'credit-card',
    fill: v('surface'),
    edge: v('hairline'),
    chip: v('owed-chip'),
    chipInk: v('ink-2'),
  },
  margin: {
    label: 'Margin · 7 days',
    icon: 'trending-up',
    fill: v('good-fill'),
    edge: v('margin-edge'),
    chip: v('good-chip'),
    chipInk: v('good-ink-strong'),
  },
  stock: {
    label: 'Stock on the shelf',
    icon: 'package',
    fill: v('study-fill'),
    edge: v('stock-edge'),
    chip: v('study-chip'),
    chipInk: v('study-ink'),
  },
};

/**
 * A figure the books produced, or an honest gap.
 *
 * An em dash, never a nought. The design system's second rule: *"If a
 * derivation failed, say what failed — never render zero."* The reason
 * travels to the basis line under it, where it can be read.
 */
const fig = (d: Derived<Money.Money>): string =>
  d.status === 'unavailable' ? '—' : Money.format(d.value);

/**
 * The three-segment aging bar, from four bands.
 *
 * The handoff draws three segments and the design system's `aging` ramp has
 * three stops, over 0–14, 15–30 and 30+. `agingBands` splits at 0, 30, 45
 * and 60, because that is what the Customers register's own bar shows. The
 * two do not line up, and neither is obviously wrong — so the middle pair is
 * folded into the middle stop rather than inventing a fourth colour, which
 * §7 forbids, or quietly dropping a band, which would understate the debt
 * the bar is about.
 *
 * **This is an approximation and it is the one thing on this screen that is.
 * The bar wants a design decision: four stops, or bands at 14 and 30.**
 */
function agingSegments(bands: readonly AgingBand[]): readonly {
  readonly pct: number;
  readonly fill: string;
}[] {
  const share = (from: number): number => bands.find((b) => b.from === from)?.share ?? 0;

  return [
    { pct: share(0), fill: v('aging-fresh') },
    { pct: share(30) + share(45), fill: v('aging-middle') },
    { pct: share(60), fill: v('aging-oldest') },
  ];
}

/**
 * The strip, from the one reckoning.
 *
 * Not one figure here is this screen's own arithmetic — `packages/domain/
 * src/today.ts` composes the Cash Book's, the Customers register's and the
 * Invoices band's. This function only decides how each cell reads when its
 * figure could not be derived, which the handoff has no state for.
 */
function metricsOf(strip: TodayStrip): readonly Metric[] {
  const cover = strip.cash.cover;
  const due = strip.youOwe.dueThisWeek;
  const margin = strip.margin.percent;

  return [
    {
      ...SKIN.cash,
      figure: fig(strip.cash.held),
      basis:
        cover.status === 'unavailable' ? (
          <>
            {strip.cash.accounts} accounts · {cover.reason}
          </>
        ) : (
          <>
            {strip.cash.accounts} accounts · {cover.value} months of cover
          </>
        ),
    },
    {
      ...SKIN.owed,
      figure: fig(strip.owedToYou.total),
      aging: agingSegments(strip.owedToYou.aging),
      basis: (
        <>
          {strip.owedToYou.customers} customers ·{' '}
          <span className={s.metricBad}>{fig(strip.owedToYou.overSixty)} over 60 days</span>
        </>
      ),
    },
    {
      ...SKIN.owe,
      figure: fig(strip.youOwe.total),
      basis: (
        <>
          {strip.youOwe.suppliers} suppliers · {fig(due)} due this week
          {/* A purchase with no due date is not "not due this week". The
              register says so rather than letting the figure imply it. */}
          {due.status === 'partial' ? <> · {due.missing}</> : null}
        </>
      ),
    },
    {
      ...SKIN.margin,
      figure: margin.status === 'unavailable' ? '—' : `${margin.value}%`,
      basis:
        margin.status === 'unavailable' ? (
          <>{margin.reason}</>
        ) : (
          <>
            {Money.format(strip.margin.kept)} profit on {Money.format(strip.margin.sold)} sold
            {margin.status === 'partial' ? <> · {margin.missing}</> : null}
          </>
        ),
    },
    {
      ...SKIN.stock,
      figure: fig(strip.stock.held),
      basis:
        strip.stock.dead.status === 'unavailable' ? (
          <>
            {strip.stock.linesOnShelf} lines · {strip.stock.deadLines} have stopped selling, not
            yet valued
          </>
        ) : (
          <>
            {strip.stock.linesOnShelf} lines · {fig(strip.stock.dead)} of it has stopped selling
          </>
        ),
    },
  ];
}

/**
 * The sentence under the week bars, as arithmetic about the bars.
 *
 * The handoff writes it by hand — *"the last four weeks are the best run of
 * the twelve — 71, 68 and 82 against a 12-week median of 55"* — and every
 * clause of it is wrong about the array printed beside it: the run of
 * above-median weeks is five, it then names three figures, those figures are
 * the bars' CSS heights rather than money, and the median is 56.5. Derived
 * here so the sentence and the bars cannot come apart again.
 */
function weeksReading(sold: SoldByWeek): string {
  const median = Money.format(sold.median);
  const window = `${sold.tradedWeeks}-week median of ${median}`;
  const latest = sold.weeks[sold.weeks.length - 1];

  if (Money.isZero(sold.median) || latest === undefined) {
    return `Nothing has been sold in the last ${SOLD_WEEKS} weeks.`;
  }

  // This week against the median, and nothing else. The handoff lists every
  // week of the run, which reads well at three and turned into six full
  // figures in one sentence the moment real rows went through it — and
  // §7 forbids abbreviating money to get out of that.
  const thisWeek = `this week ${Money.format(latest.sold)}`;

  if (sold.runLength === 0) {
    return `This week is at or below the ${window} — ${thisWeek}.`;
  }

  const weeks = sold.runLength === 1 ? 'week is' : `${sold.runLength} weeks are`;
  return `The last ${weeks} above the ${window} — ${thisWeek}.`;
}

/** "Tuesday 15 September". UTC, as every other date in these books is. */
const longDay = (d: Date): string =>
  d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

const clock = (d: Date): string =>
  d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });

/* --------------------------------- moves ---------------------------------- */

/** "01 of 03" — counted, never stamped. The handoff's cards all say "of 08". */
const movePos = (m: ManagerMove): string =>
  `${String(m.position).padStart(2, '0')} of ${String(m.of).padStart(2, '0')}`;

/**
 * What the fold shows: the arithmetic the row actually carries.
 *
 * The handoff writes a second, longer paragraph per card — *"3,330,000
 * across 4 invoices, oldest 2 August. Five chase messages sent, none
 * answered…"* — and **nothing in `manager_notes` stores it.** A move row
 * holds a title, the reasoning, a figure, what it unlocks and a door; the
 * per-invoice workings behind the figure are not written down, so there is
 * no honest way to render that paragraph.
 *
 * So the fold says what the row does know: what the figure is and what it
 * means, what the move unlocks, what it waits on, and — plainly — that
 * whether it WORKED is not something this app can yet tell, because
 * `deriveMoveOutcome` is not ported. Raised for design: either the meeting
 * should write its workings down, or the fold is a smaller thing than the
 * handoff draws.
 */
function derivation(m: ManagerMove): string {
  const bits: string[] = [];

  if (m.worth.status !== 'unavailable') {
    bits.push(`${Money.format(m.worth.value)} ${m.worthLabel}`);
  } else {
    bits.push('The meeting put no figure on this one');
  }
  if (m.lever !== null) bits.push(`it pulls the ${m.lever} lever`);
  if (m.unlocks !== null) bits.push(`it unlocks ${m.unlocks}`);
  if (m.waitsOn !== null) bits.push(`it waits on ${m.waitsOn.title}`);

  // Named rather than left to be assumed. A card that shows a Done chip it
  // cannot stand behind is the drift 0081 refuses to store state for.
  bits.push(
    'whether it worked is read from the books, and that reading is not ported yet',
  );

  return `${bits.join(' · ')}.`;
}

/* --------------------------------- watch ---------------------------------- */

interface Alert {
  readonly icon: IconName;
  readonly chip: string;
  readonly chipInk: string;
  readonly first: string;
  /** Both ends of the comparison, so it can be checked rather than believed. */
  readonly second: string;
  readonly figure?: string;
  readonly figureInk?: string;
  readonly judgement?: { readonly text: string; readonly fill: string; readonly ink: string };
}

const WATCH: readonly Alert[] = [
  {
    icon: 'clock',
    chip: v('bad-chip'),
    chipInk: v('bad-ink'),
    first: 'Nakawa Traders has owed 74 days',
    second: 'Invoiced 5 July, part-paid 18 July · nothing since',
    figure: '2,410,000',
    figureInk: v('bad-ink'),
  },
  {
    icon: 'package',
    chip: v('warn-chip'),
    chipInk: v('warn-ink'),
    first: '7 lines run out within 10 days',
    second: '14,200,000 to refill against 8,420,000 held',
    judgement: { text: '5,780,000 short', fill: v('warn-fill'), ink: v('warn-ink') },
  },
  {
    icon: 'trending-up',
    chip: v('bad-chip'),
    chipInk: v('bad-ink'),
    first: 'Kampala Steel is billing 30% more',
    second: '10,000 on 1 May, 13,000 now · across 9 invoices',
    judgement: { text: '+30%', fill: v('bad-chip'), ink: v('bad-ink') },
  },
  {
    icon: 'users',
    chip: v('info-chip'),
    chipInk: v('info-ink'),
    first: 'Nsubuga sells at 11% margin against 19% for the rest',
    second: '344,000 commission on 3,100,000 sold, last 30 days',
    judgement: { text: '−8 pts', fill: v('warn-fill'), ink: v('warn-ink') },
  },
  {
    icon: 'layers',
    chip: v('owed-chip'),
    chipInk: v('ink-2'),
    first: '3,100,000 has not moved in 120 days',
    second: '9 lines · oldest bought 14 March',
    figure: '3,100,000',
  },
];

/* ------------------------------ insight rail ------------------------------ */

const PRODUCTS = [
  { name: 'Iron sheets G28', money: '4,120,000', pct: '31%', tone: 'good', width: 100 },
  { name: 'Cement — Tororo', money: '2,980,000', pct: '18%', tone: 'neutral', width: 72 },
  { name: 'Steel bars Y12', money: '1,640,000', pct: '9%', tone: 'thin', width: 40 },
  { name: 'Binding wire', money: '1,205,000', pct: '22%', tone: 'good', width: 29 },
] as const;

const TONE = {
  good: { fill: v('good-chip-light'), ink: v('good-ink') },
  thin: { fill: v('warn-fill'), ink: v('warn-ink') },
  neutral: { fill: v('neutral-chip'), ink: v('neutral-ink') },
} as const;


export function Today(): ReactElement {
  const read = useToday();
  if (read.at === 'loading') return <Waiting />;
  if (read.at === 'failed') return <Refused why={read.why} />;
  return <Morning read={read} />;
}

/**
 * Reading, not a quiet morning.
 *
 * PostgREST answers "still fetching", "refused by RLS" and "this shop has
 * traded nothing" with the same empty array, and only the last of those is a
 * morning worth drawing. "Nothing wants you" would be the worst of the three
 * to get wrong.
 */
function Waiting(): ReactElement {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.greeting}>
          <h1 className={s.title}>Good morning, Kevin</h1>
          <p className={s.sub}>Reading the books…</p>
        </div>
      </header>
    </div>
  );
}

function Refused({ why }: { readonly why: string }): ReactElement {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.greeting}>
          <h1 className={s.title}>Good morning, Kevin</h1>
          {/* What failed, in the words the database used. An empty strip
              here would be a claim that the shop holds nothing and is owed
              nothing. */}
          <p className={s.sub}>This morning could not be read. {why}</p>
        </div>
      </header>
    </div>
  );
}

function Morning({
  read,
}: {
  readonly read: Extract<ReturnType<typeof useToday>, { at: 'ready' }>;
}): ReactElement {
  const books = read.data;
  const metrics = metricsOf(books.strip);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const toggle = (pos: string): void =>
    setOpen((prior) => {
      const next = new Set(prior);
      if (next.has(pos)) next.delete(pos);
      else next.add(pos);
      return next;
    });

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.greeting}>
          <h1 className={s.title}>Good morning, Kevin</h1>
          <p className={s.sub}>
            {longDay(books.asOf)} · read at {clock(books.asOf)} ·{' '}
            {books.wantsYou === 1 ? 'one thing wants' : `${books.wantsYou} things want`} you today
          </p>
        </div>
        <div className={s.headActions}>
          <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnLg}`}>
            <Icon name="plus" size={16} />
            New quote
          </button>
          {/* The one accent-filled control on the screen. */}
          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`}>
            <Icon name="check" size={16} />
            Work the list
          </button>
        </div>
      </header>

      <section className={s.metrics} aria-label="The position">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={s.metric}
            style={{ background: m.fill, border: `1px solid ${m.edge}` }}
          >
            <div className={s.metricTop}>
              <span
                className={s.metricIcon}
                style={{ background: m.chip, color: m.chipInk }}
                aria-hidden="true"
              >
                <Icon name={m.icon} size={14} />
              </span>
              <span className={s.metricLabel}>{m.label}</span>
            </div>

            {m.delta === undefined ? (
              <div className={s.metricFig}>{m.figure}</div>
            ) : (
              <div className={s.metricFigRow}>
                <span className={s.metricFig} style={{ marginTop: 0 }}>
                  {m.figure}
                </span>
                <span
                  className={`${s.chip} ${s.chipSm}`}
                  style={{ background: m.delta.fill, color: m.delta.ink }}
                >
                  {m.delta.text}
                </span>
              </div>
            )}

            {m.aging !== undefined && (
              <div className={s.aging} aria-hidden="true">
                {m.aging.map((seg, i) => (
                  <div key={i} style={{ width: `${seg.pct}%`, background: seg.fill }} />
                ))}
              </div>
            )}

            <div
              className={`${s.metricBasis} ${m.aging !== undefined ? s.metricBasisTight : ''}`}
            >
              {m.basis}
            </div>
          </div>
        ))}
      </section>

      <div className={s.split}>
        <div className={s.column}>
          <div className={s.sectionHead}>
            <span className={s.sectionTitle}>What to do today</span>
            <span className={s.sectionNote}>
              {/* Counted. The handoff writes "three moves" beside three
                  cards each stamped "of 08", and this shop has 39 open. */}
              {books.moves.length === 1
                ? 'one move from the last reading'
                : `${books.moves.length} moves from the last reading`}
              , in the order they depend on each other
            </span>
          </div>

          {books.moves.map((m) => (
            <article
              key={m.id}
              className={`${s.card} ${s.move} ${m.waitsOn !== null ? s.moveWaiting : ''}`}
            >
              <div className={s.moveTop}>
                <span
                  className={s.chip}
                  style={{ background: v('study-chip'), color: v('study-ink') }}
                >
                  <Icon name="message-square" size={12} />
                  Manager
                </span>
                <span className={s.movePos}>{movePos(m)}</span>
                {m.waitsOn !== null && (
                  <span
                    className={`${s.chip} ${s.chipSm}`}
                    style={{ background: v('neutral-chip'), color: v('neutral-ink') }}
                  >
                    {/* §5's recipe, terse. The blocker's TITLE goes in the
                        fold, where there is room for it — in the chip it
                        ran to sixty characters and pushed the figure off
                        the line. */}
                    waits on {String(m.waitsOn.position).padStart(2, '0')}
                  </span>
                )}
                <span className={s.grow} />
                <div className={s.moveWorth}>
                  <div className={s.moveWorthLabel}>
                    {m.worth.status === 'unavailable' ? 'Worth' : m.worthLabel}
                  </div>
                  {/* A figure is a size, not a warning — the old app's own
                      scar. The gain ink is switched on by what the figure
                      MEANS, never by it existing. */}
                  <div className={`${s.moveWorthFig} ${m.isGain ? s.gain : ''}`}>
                    {m.worth.status === 'unavailable'
                      ? '—'
                      : `${m.isGain ? '+' : ''}${Money.format(m.worth.value)}`}
                  </div>
                </div>
              </div>

              <h2 className={s.moveTitle}>{m.title}</h2>
              <p className={s.moveWhy}>{m.why}</p>

              <div className={s.moveActions}>
                {/* The door the meeting chose, with the door's own label.
                    The handoff also draws a per-move primary action —
                    "Draft the chase" — and nothing in `manager_notes`
                    carries one: a move stores a destination, not a verb.
                    Raised for design rather than invented. */}
                {m.door !== null && (
                  <button type="button" className={`${s.btn} ${s.btnMd} ${s.btnSecondary}`}>
                    {m.door.label}
                    <Icon name="arrow-right" size={15} />
                  </button>
                )}
                <span className={s.grow} />
                <button
                  type="button"
                  className={`${s.btn} ${s.btnGhost} ${s.btnMd}`}
                  aria-expanded={open.has(m.id)}
                  onClick={() => toggle(m.id)}
                >
                  <Icon name={open.has(m.id) ? 'chevron-down' : 'chevron-right'} size={15} />
                  How this was worked out
                </button>
              </div>

              {open.has(m.id) && <p className={s.derivation}>{derivation(m)}</p>}
            </article>
          ))}

          <section className={`${s.card} ${s.watch}`} aria-label="What the books flagged">
            <div className={s.watchHead}>
              <span className={s.watchTitle}>What the books flagged</span>
              <span className={s.watchNote}>
                arithmetic, not advice · five of five shown
              </span>
            </div>
            {WATCH.map((a) => (
              <button type="button" className={s.watchRow} key={a.first}>
                <span
                  className={s.watchIcon}
                  style={{ background: a.chip, color: a.chipInk }}
                  aria-hidden="true"
                >
                  <Icon name={a.icon} size={16} />
                </span>
                <span className={s.watchBody}>
                  <span className={s.watchFirst}>{a.first}</span>
                  <span className={s.watchSecond}>{a.second}</span>
                </span>
                {a.figure !== undefined && (
                  <span className={s.watchFig} style={{ color: a.figureInk }}>
                    {a.figure}
                  </span>
                )}
                {a.judgement !== undefined && (
                  <span
                    className={s.chip}
                    style={{ background: a.judgement.fill, color: a.judgement.ink }}
                  >
                    {a.judgement.text}
                  </span>
                )}
                <Icon name="chevron-right" size={16} className={s.watchCaret} />
              </button>
            ))}
          </section>
        </div>

        <aside className={s.insightRail} aria-label="Insight">
          <section className={`${s.card} ${s.panel}`}>
            <div className={s.panelTitle}>Where the profit came from</div>
            <div className={s.panelSub}>Last 30 days · gross margin</div>
            {PRODUCTS.map((p, i) => (
              <div className={s.product} key={p.name}>
                <div className={s.productTop}>
                  <span className={s.productName} title={p.name}>
                    {p.name}
                  </span>
                  <span className={s.productFig}>{p.money}</span>
                  <span
                    className={`${s.chip} ${s.chipSm}`}
                    style={{ background: TONE[p.tone].fill, color: TONE[p.tone].ink }}
                  >
                    {p.pct}
                  </span>
                </div>
                <div className={s.productBarTrack}>
                  <div
                    className={s.productBar}
                    style={{
                      width: `${p.width}%`,
                      background: `var(--ow-violet-${i + 1})`,
                    }}
                  />
                </div>
              </div>
            ))}
            {/* Truncating a list says how many were cut. */}
            <div className={s.notListed}>
              <span className={s.grow}>54 other lines</span>
              <span className={s.productFig}>3,260,000</span>
            </div>
          </section>

          <section className={`${s.card} ${s.panel} ${s.weeks}`}>
            <div className={s.sectionHead}>
              <span className={s.panelTitle}>Sold by week</span>
              <span className={s.grow} />
              {/* Only when it is true. A chip claiming the best week of
                  twelve over a week that was not is the kind of flattery
                  this screen exists to stop. */}
              {books.sold.bestIsLatest ? (
                <span
                  className={`${s.chip} ${s.chipSm}`}
                  style={{ background: v('good-chip'), color: v('good-ink-strong') }}
                >
                  best of 12
                </span>
              ) : null}
            </div>
            <div className={s.bars} aria-hidden="true">
              {books.sold.weeks.map((w, i) => (
                <div
                  key={w.from.toISOString()}
                  className={s.bar}
                  style={{
                    // A share of the tallest week, so the bars are the
                    // figures rather than a hand-picked set of heights.
                    height: `${w.share}%`,
                    background: `var(--ow-green-${Math.min(6, Math.floor(i / 2) + 1)})`,
                  }}
                />
              ))}
            </div>
            <div className={s.axis}>
              <span>12 wks ago</span>
              <span>this week</span>
            </div>
            <p className={s.weeksReading}>{weeksReading(books.sold)}</p>
          </section>

          <section className={`${s.card} ${s.panel}`}>
            <div className={s.panelTitle}>Yesterday</div>
            <div className={s.tiles}>
              <div className={s.tile} style={{ background: v('surface-2') }}>
                <div className={s.tileLabel}>Sold</div>
                <div className={s.tileFig}>4,186,000</div>
              </div>
              <div className={s.tile} style={{ background: v('good-fill') }}>
                <div className={s.tileLabel}>Collected</div>
                <div className={s.tileFig} style={{ color: v('good-ink') }}>
                  2,940,000
                </div>
              </div>
              <div className={s.tile} style={{ background: v('surface-2') }}>
                <div className={s.tileLabel}>Paid out</div>
                <div className={s.tileFig}>1,760,000</div>
              </div>
              <div className={s.tile} style={{ background: v('bad-fill') }}>
                <div className={s.tileLabel}>New debt</div>
                <div className={s.tileFig} style={{ color: v('bad-ink') }}>
                  1,246,000
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
