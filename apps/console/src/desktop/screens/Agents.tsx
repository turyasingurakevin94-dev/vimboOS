/**
 * Agents — the desktop console. Frame 1a of the Agents handoff.
 *
 * ## What the screen is for
 *
 * An agent buys the goods from the shop and sells them on at his own price.
 * So the screen answers two questions and refuses a third:
 *
 *  - **what he owes**, which is the SHOP price on the orders he has taken;
 *  - **what commission he has earned**, which is the supplier's money and
 *    pays only on the items in his cluster;
 *  - and **not** what he charged his own clients. The shop never collects
 *    from them, `agentSellPrice` is not the shop's record to show, and
 *    there is no column for it here. Removing that column is what makes the
 *    row readable in one pass.
 *
 * ## The cut this screen carries: Commissions
 *
 * A Commissions screen would read these same order rows and sum one field
 * off them. The agent app already shows the agent that figure, and the two
 * have drifted before — a bonus shown as earned that the payout would not
 * pay. So the reconciliation lives on the panel, visible, as three figures
 * and a chip: shown as earned · claimable · not yet counted. The payout
 * stays where the record is, and *Pay the commission* acts on the month
 * being looked at.
 *
 * ## One reckoning
 *
 * The strip, the rows, the panel, the waterfall and the five bars are all
 * `@ow/domain/agents` reading the same orders. No two of them can disagree
 * about the same shilling, which is what a second screen could not promise.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from 'react';
import {
  Money,
  agentMark,
  agentNote,
  agentSince,
  bandCount,
  barHeight,
  behind,
  clusterReads,
  commission,
  cycle,
  groups,
  initials,
  kept,
  linesReads,
  match,
  monthlySeries,
  orderCount,
  ordersReads,
  owes,
  position,
  rollupName,
  rollupReads,
  shopBilled,
  spanFor,
  waitingReads,
  waterfall,
  type Agent,
  type Period,
  type Span,
} from '@ow/domain';
import { DEMO_TODAY, demoAgents, demoCounter } from '@ow/data';
import s from './Agents.module.css';
import { Icon } from '../icons.js';
import { AgentAction, type Action } from './AgentActions.js';

const v = (token: string): string => `var(--ow-color-${token})`;

/** The three lenses, in the order the frame draws them. */
const LENSES: readonly { readonly id: Period; readonly label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'last', label: 'Last month' },
  { id: 'year', label: 'Year' },
];

/** How a heading names the span it is reading. */
const whenReads = (span: Span): string =>
  span.period === 'month' ? 'this month' : span.period === 'last' ? 'last month' : `in ${span.names}`;

/** An avatar is tinted by what the row is telling you, never by the person. */
const avatarTone = (agent: Agent, top: boolean): Record<string, string> =>
  behind(agent)
    ? { background: v('warn-fill'), color: v('warn-ink') }
    : top
      ? { background: v('info-chip'), color: v('info-ink') }
      : { background: v('neutral-chip'), color: v('ink-2') };

const PILL: Record<'info' | 'warn' | 'neutral' | 'good', Record<string, string>> = {
  info: { background: v('info-chip'), color: v('info-ink') },
  warn: { background: v('warn-fill'), color: v('warn-ink') },
  good: { background: v('good-chip-light'), color: v('good-ink') },
  neutral: { background: v('neutral-chip'), color: v('ink-2') },
};

export interface AgentsProps {
  /** The top bar's *Invite an agent* has been pressed. The shell owns it. */
  readonly inviting?: boolean;
  readonly onInviteClose?: () => void;
  /**
   * Counts up each time somebody searched for "commission", "bonus",
   * "earnings" or "payout" — the words that used to reach the Commissions
   * screen. The block they were asking for scrolls into view.
   */
  readonly bonusAsk?: number;
}

export function Agents({
  inviting = false,
  onInviteClose,
  bonusAsk = 0,
}: AgentsProps): ReactElement {
  const all = useMemo(() => demoAgents(), []);
  const counter = useMemo(() => demoCounter(), []);
  const [period, setPeriod] = useState<Period>('month');
  const [pickedId, setPickedId] = useState<string | null>(all[0]?.id ?? null);
  const [action, setAction] = useState<Action | null>(null);

  const bonusBlock = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bonusAsk > 0) bonusBlock.current?.scrollIntoView({ block: 'nearest' });
  }, [bonusAsk]);

  const span = useMemo(() => spanFor(period, DEMO_TODAY), [period]);
  const strip = useMemo(() => position(all, span, counter), [all, span, counter]);
  const bands = useMemo(() => groups(all, span), [all, span]);
  const picked = all.find((a) => a.id === pickedId) ?? null;

  const open = inviting ? ({ at: 'invite' } as const) : action;
  const close = (): void => {
    setAction(null);
    onInviteClose?.();
  };

  if (all.length === 0) {
    return (
      <div className={s.page}>
        <header className={s.head}>
          <div className={s.titles}>
            <h1 className={s.title}>Agents</h1>
            <p className={s.sub}>Nobody is selling for you yet.</p>
          </div>
        </header>
        <div className={s.empty}>
          <p className={s.emptyWords}>
            An agent buys the goods from the shop and sells them on his own round. Invite one and
            what he sells, keeps and owes will be here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.titles}>
          <h1 className={s.title}>Agents</h1>
          <p className={s.sub}>
            {all.length} active · what they sold, what you kept, what they owe you
          </p>
        </div>

        <div className={s.lenses} role="group" aria-label="Which period">
          {LENSES.map((lens) => (
            <button
              key={lens.id}
              type="button"
              className={`${s.lens} ${period === lens.id ? s.lensOn : ''}`}
              aria-pressed={period === lens.id}
              onClick={() => setPeriod(lens.id)}
            >
              {lens.label}
            </button>
          ))}
        </div>
      </header>

      <section className={s.strip} aria-label="The position">
        <div className={s.card}>
          <div className={s.cardLabel}>Sold through agents</div>
          <div className={s.cardFig}>{Money.format(strip.sold)}</div>
          <div className={s.cardBasis}>
            {strip.orders} orders ·{' '}
            {match(strip.share, {
              known: (pct) => `${pct}% of everything you sold`,
              partial: (pct) => `${pct}% of everything you sold so far`,
              unavailable: (why) => why,
            })}
          </div>
        </div>

        <div className={`${s.card} ${s.cardGood}`}>
          <div className={`${s.cardLabel} ${s.cardLabelGood}`}>You kept</div>
          <div className={`${s.cardFig} ${s.cardFigGood}`}>{Money.format(strip.kept)}</div>
          <div className={s.cardBasisGood}>
            {match(strip.keptPercent, {
              known: (pct) => `${pct}%`,
              partial: (pct) => `${pct}% so far`,
              unavailable: () => 'no margin to read',
            })}{' '}
            · shop counter runs {counter.keptPercent}%
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardLabel}>Commission earned</div>
          <div className={s.cardFig}>{Money.format(strip.commission)}</div>
          <div className={s.cardBasis}>supplier-funded · on cluster items only</div>
        </div>

        <div className={`${s.card} ${s.cardWarn}`}>
          <div className={`${s.cardLabel} ${s.cardLabelWarn}`}>Owed to the shop</div>
          <div className={`${s.cardFig} ${s.cardFigWarn}`}>{Money.format(strip.owed)}</div>
          <div className={s.cardBasisWarn}>
            {strip.behind} {strip.behind === 1 ? 'agent' : 'agents'} behind · at the shop price, not
            theirs
          </div>
        </div>
      </section>

      <div className={s.work}>
        <section className={s.list} aria-label="Who sells, and on what terms">
          <div className={s.listHead}>
            <span className={s.listTitle}>Who sells, and on what terms</span>
            <span className={s.spacer} />
            <span className={s.ruleChip}>
              <Icon name="alert-circle" size={12} />
              commission is the supplier&apos;s money, not yours
            </span>
          </div>

          <div className={s.columns}>
            <span />
            <span className={s.column}>Agent</span>
            <span className={`${s.column} ${s.columnRight}`}>Shop billed</span>
            <span className={`${s.column} ${s.columnRight}`}>You kept</span>
            <span className={`${s.column} ${s.columnRight}`}>Owes you</span>
            <span className={`${s.column} ${s.columnRight}`}>Terms</span>
          </div>

          <div className={s.rows}>
            {bands.map((group) => (
              <div key={group.id}>
                <div className={s.band}>
                  <span className={s.chip} style={group.id === 'behind' ? PILL.warn : PILL.good}>
                    {group.name}
                  </span>
                  <span className={s.bandCount}>{bandCount(group)}</span>
                  <span className={s.spacer} />
                  <span className={s.bandReads}>{group.reads}</span>
                </div>

                {group.shown.map((agent) => (
                  <Row
                    key={agent.id}
                    agent={agent}
                    all={all}
                    span={span}
                    picked={agent.id === pickedId}
                    onPick={() => setPickedId(agent.id)}
                  />
                ))}

                {group.rolled !== null && (
                  <div className={`${s.row} ${s.rowRolled}`}>
                    <span className={s.avatar} style={PILL.neutral}>
                      +{group.rolled.agents}
                    </span>
                    <div className={s.identity}>
                      <div className={s.rolledName}>{rollupName(group.rolled)}</div>
                      <div className={s.note}>{rollupReads(group.rolled, span)}</div>
                    </div>
                    <div className={s.figure}>{Money.format(group.rolled.billed)}</div>
                    <div className={`${s.figure} ${s.figureQuiet}`}>
                      {Money.format(group.rolled.kept)}
                    </div>
                    <div className={`${s.figure} ${s.figureQuiet}`}>0</div>
                    <div className={s.termsCell}>
                      <span className={s.mixed}>mixed</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {picked !== null && (
          <aside className={s.panel} aria-label={picked.name}>
            <Panel
              agent={picked}
              span={span}
              bonusRef={bonusBlock}
              onSettle={() => setAction({ at: 'settle', agentId: picked.id })}
              onHold={() => setAction({ at: 'hold', agentId: picked.id })}
              onPay={() => setAction({ at: 'commission', agentId: picked.id })}
            />
          </aside>
        )}
      </div>

      {open !== null && (
        <AgentAction
          action={open}
          agents={all}
          span={span}
          today={DEMO_TODAY}
          onClose={close}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  A row                                                                     */
/* -------------------------------------------------------------------------- */

function Row({
  agent,
  all,
  span,
  picked,
  onPick,
}: {
  readonly agent: Agent;
  readonly all: readonly Agent[];
  readonly span: Span;
  readonly picked: boolean;
  readonly onPick: () => void;
}): ReactElement {
  const mark = agentMark(agent, all, span);
  const owed = owes(agent);
  const top = mark?.pill === 'top seller';

  return (
    <div
      className={`${s.row} ${picked ? s.rowOn : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={picked}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
    >
      <span className={s.avatar} style={avatarTone(agent, top)}>
        {initials(agent.name)}
      </span>

      <div className={s.identity}>
        <div className={s.name}>{agent.name}</div>
        {mark === null ? (
          <div className={s.note}>{agentNote(agent, span)}</div>
        ) : (
          <div className={s.marks}>
            <span className={s.pill} style={PILL[mark.tone]}>
              {mark.pill}
            </span>
            {/* The count rides beside the shorter pill only. `sells at the
                shop price` is already a sentence; a figure after it is the
                second thing to read in a cell that should carry one. */}
            {mark.tone === 'info' && (
              <span className={s.markFact}>
                {orderCount(agent, span)} {orderCount(agent, span) === 1 ? 'order' : 'orders'}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={s.figure}>{Money.format(shopBilled(agent, span))}</div>
      <div className={`${s.figure} ${s.figureGood}`}>{Money.format(kept(agent, span))}</div>
      <div className={`${s.figure} ${Money.isZero(owed) ? s.figureQuiet : s.figureWarn}`}>
        {Money.format(owed)}
      </div>
      <div className={s.termsCell}>
        <span className={s.pill} style={agent.terms === 'credit' ? PILL.neutral : PILL.good}>
          {agent.terms}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  The panel                                                                 */
/* -------------------------------------------------------------------------- */

function Panel({
  agent,
  span,
  bonusRef,
  onSettle,
  onHold,
  onPay,
}: {
  readonly agent: Agent;
  readonly span: Span;
  readonly bonusRef: RefObject<HTMLDivElement>;
  readonly onSettle: () => void;
  readonly onHold: () => void;
  readonly onPay: () => void;
}): ReactElement {
  const wf = waterfall(agent, span);
  const owed = owes(agent);
  const bonus = commission(agent, span);
  const series = monthlySeries(agent, DEMO_TODAY);
  const counter = demoCounter();

  return (
    <>
      <div className={s.panelCard}>
        <div className={s.identityHead}>
          <span className={s.headAvatar}>{initials(agent.name)}</span>
          <div className={s.identity}>
            <div className={s.headName}>{agent.name}</div>
            <div className={s.headSince}>{agentSince(agent)}</div>
          </div>
          <button type="button" className={s.kebab} aria-label={`More for ${agent.name}`}>
            <Icon name="more-horizontal" size={17} />
          </button>
        </div>

        <div className={s.block}>
          <div className={s.label}>What the shop billed him, {whenReads(span)}</div>
          <div className={s.waterfall}>
            <div className={s.wf}>
              <span className={s.wfLabel}>Your cost</span>
              <span
                className={s.wfBar}
                style={{ width: `${wf.costWidth}%`, background: v('cost-bar') }}
              />
              <span className={s.wfFig}>{Money.format(wf.cost)}</span>
            </div>
            <div className={s.wf}>
              <span className={s.wfLabel}>You kept</span>
              <span
                className={s.wfBar}
                style={{
                  width: `${wf.keptWidth}%`,
                  marginLeft: `${wf.costWidth}%`,
                  background: v('good-ink'),
                }}
              />
              <span className={`${s.wfFig} ${s.wfFigGood}`}>{Money.format(wf.kept)}</span>
            </div>
            <div className={`${s.wf} ${s.wfTotal}`}>
              <span className={s.wfLabelTotal}>Shop billed</span>
              <span className={s.wfBar} style={{ width: '100%', background: v('navy') }} />
              <span className={s.wfFig}>{Money.format(wf.billed)}</span>
            </div>
          </div>
          <p className={s.reading}>
            What he charges his own clients is his business and is not recorded here. The
            shop&apos;s figure is the {Money.format(wf.billed)} he was billed.
          </p>
        </div>

        <div className={s.owesBlock}>
          <div className={s.owesHead}>
            <span className={s.owesLabel}>Owes the shop</span>
            <span className={s.owesFig}>{Money.format(owed)}</span>
          </div>
          <p className={s.owesReading}>
            The shop price on {cycle(agent).length} orders he has taken. He collects from his own
            clients himself.
          </p>
          <div className={s.owesActions}>
            <button type="button" className={s.primary} onClick={onSettle}>
              Record a settlement
            </button>
            <button type="button" className={s.secondary} onClick={onHold}>
              {agent.onHold ? 'Let him sell again' : 'Hold new orders'}
            </button>
          </div>
        </div>

        <div className={s.bonusBlock} ref={bonusRef}>
          <div className={s.bonusHead}>
            <span className={s.label}>Commission, {span.names}</span>
            {match(bonus.agrees, {
              known: (agreed) =>
                agreed ? (
                  <span className={`${s.chip} ${s.chipGood}`}>
                    <Icon name="check" size={12} />
                    screen agrees with payout
                  </span>
                ) : (
                  <span className={`${s.chip} ${s.chipBad}`}>
                    <Icon name="alert-circle" size={12} />
                    payout pays less than this
                  </span>
                ),
              partial: () => <span className={`${s.chip} ${s.chipNeutral}`}>partly checked</span>,
              unavailable: () => (
                <span className={`${s.chip} ${s.chipNeutral}`}>no payout yet</span>
              ),
            })}
          </div>
          <p className={s.reading}>{clusterReads(agent)}</p>
          <div className={s.three}>
            <div className={s.cell}>
              <div className={s.cellLabel}>Shown as earned</div>
              <div className={s.cellFig}>{Money.format(bonus.earned)}</div>
            </div>
            <div className={s.cell}>
              <div className={s.cellLabel}>Claimable</div>
              <div className={s.cellFig}>
                {match(bonus.claimable, {
                  known: (amount) => Money.format(amount),
                  partial: (amount) => Money.format(amount),
                  unavailable: () => '—',
                })}
              </div>
            </div>
            <div className={s.cell}>
              <div className={s.cellLabel}>Not yet counted</div>
              <div className={`${s.cellFig} ${s.cellFigWarn}`}>
                {Money.format(bonus.notYetCounted)}
              </div>
            </div>
          </div>
          <p className={s.reading}>{waitingReads(bonus)}</p>
          <button type="button" className={s.secondary} onClick={onPay}>
            Pay the commission
          </button>
        </div>
      </div>

      <div className={s.panelCard}>
        <div className={s.blockPlain}>
          <div className={s.cardTitle}>Which lines they sell</div>
          <div className={s.lines}>
            {agent.lines.map((line, i) => (
              <div key={line.line} className={`${s.lineRow} ${i === 0 ? s.lineFirst : ''}`}>
                <span className={s.lineName}>{line.line}</span>
                <span className={s.lineShare}>
                  {line.shareOfOrders}%{i === 0 ? ' of orders' : ''}
                </span>
                <span className={s.lineMargin}>{line.margin}%</span>
              </div>
            ))}
          </div>
          <p className={s.reading}>{linesReads(agent, span, counter)}</p>
        </div>
      </div>

      <div className={s.panelCard}>
        <div className={s.blockPlain}>
          <div className={s.label}>Orders through them</div>
          <div className={s.bars}>
            {series.map((month, i) => (
              <div key={month.month} className={s.barCell}>
                <span
                  className={s.bar}
                  style={{
                    height: `${barHeight(month, series)}px`,
                    background: i === series.length - 1 ? v('info-ink') : v('money-chip'),
                  }}
                />
                <span className={s.barLabel}>{month.month}</span>
              </div>
            ))}
          </div>
          <p className={s.reading}>{ordersReads(agent, series)}</p>
        </div>
      </div>
    </>
  );
}
