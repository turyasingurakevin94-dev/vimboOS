/**
 * Agents — the phone. Frame 1b of the Agents handoff.
 *
 * **This is not the console reflowed.** The desktop is a six-column register
 * with a 390px panel beside it, a waterfall, a line mix and five months of
 * bars. None of that is here, and none of it was cut to fit — the phone is
 * a different application answering a narrower question.
 *
 * The question is: **who owes me, and can I take it from here?** So the
 * screen is settlement first:
 *
 *  - the position is three figures inside the navy header, and it is the
 *    ONE place in either design where money is abbreviated — every figure
 *    in the list and in the card below is written in full;
 *  - a row is two lines: the name and the amount, then the qualifier and
 *    the word for the amount, so `owes you` and `billed` are never confused
 *    at arm's length in daylight;
 *  - the picked agent is a card at the FOOT of the list rather than a second
 *    screen, so the list never navigates away;
 *  - the one action is 44px and in the thumb's reach, with the owed figure
 *    still on screen above it.
 *
 * Nothing here imports from `../../desktop/`. Both read `@ow/domain`, which
 * is what stops the two designs disagreeing about a shilling while looking
 * nothing like each other.
 */

import { useMemo, useState, type ReactElement } from 'react';
import {
  Money,
  agentMark,
  agentNoteShort,
  behind,
  groups,
  initials,
  millions,
  match,
  owes,
  position,
  shopBilled,
  spanFor,
  waterfall,
  type Agent,
  type Period,
  type Span,
} from '@ow/domain';
import { DEMO_TODAY, demoAgents, demoCounter } from '@ow/data';
import s from './Agents.module.css';
import { Mark, PATH } from '../icons.js';
import { PhoneAgentAction, type PhoneAction } from './AgentActions.js';

const v = (token: string): string => `var(--ow-color-${token})`;

/** Month · Last · Year — the header's own tabs, in the frame's words. */
const TABS: readonly { readonly id: Period; readonly label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'last', label: 'Last' },
  { id: 'year', label: 'Year' },
];

const TONE = {
  info: { background: v('info-chip'), color: v('info-ink') },
  warn: { background: v('warn-fill'), color: v('warn-ink') },
  good: { background: v('good-chip-light'), color: v('good-ink') },
  neutral: { background: v('neutral-chip'), color: v('ink-2') },
} as const;

export function Agents(): ReactElement {
  const all = useMemo(() => demoAgents(), []);
  const counter = useMemo(() => demoCounter(), []);
  const [period, setPeriod] = useState<Period>('month');
  const [pickedId, setPickedId] = useState<string | null>(all[0]?.id ?? null);
  const [action, setAction] = useState<PhoneAction | null>(null);

  const span = useMemo(() => spanFor(period, DEMO_TODAY), [period]);
  const strip = useMemo(() => position(all, span, counter), [all, span, counter]);
  const bands = useMemo(() => groups(all, span), [all, span]);
  const picked = all.find((a) => a.id === pickedId) ?? null;

  return (
    <div className={s.screen}>
      <header className={s.head}>
        <div className={s.brand}>
          <span className={s.mark}>
            <Mark d={PATH.home} size={14} />
          </span>
          <span className={s.title}>Agents</span>
          <button type="button" className={s.glyph} aria-label="Search agents">
            <Mark d={PATH.search} size={18} />
          </button>
          <button
            type="button"
            className={s.glyph}
            aria-label="Invite an agent"
            onClick={() => setAction({ at: 'invite' })}
          >
            <Mark d={PATH.plus} size={18} />
          </button>
        </div>

        {/* The one place a figure is abbreviated, and it is one tap from the
            full figure in the list below. */}
        <div className={s.figures}>
          <div className={s.cell}>
            <div className={s.cellLabel}>SOLD</div>
            <div className={s.cellFig}>
              {millions(strip.sold)}
              <span className={s.cellUnit}>M</span>
            </div>
          </div>
          <div className={s.cell}>
            <div className={s.cellLabel}>YOU KEPT</div>
            <div className={s.cellFig}>
              {match(strip.keptPercent, {
                known: (pct) => `${pct}`,
                partial: (pct) => `${pct}`,
                unavailable: () => '—',
              })}
              <span className={s.cellUnit}>%</span>
            </div>
          </div>
          <div className={s.cellOwed}>
            <div className={s.cellLabelOwed}>OWED YOU</div>
            <div className={s.cellFig}>
              {millions(strip.owed)}
              <span className={s.cellUnitOwed}>M</span>
            </div>
          </div>
        </div>

        <div className={s.tabs} role="tablist" aria-label="Which period">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={period === tab.id}
              className={period === tab.id ? s.tabOn : s.tab}
              onClick={() => setPeriod(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className={s.list}>
        {bands.map((group) => (
          <div key={group.id}>
            <div className={s.band}>
              <span className={s.chip} style={group.id === 'behind' ? TONE.warn : TONE.good}>
                {group.id === 'behind' ? 'Behind' : 'Settled'} {group.agents.length}
              </span>
              {group.id === 'behind' ? (
                <span className={s.bandFig}>{group.reads}</span>
              ) : (
                <span className={s.bandWords}>prepay or on delivery</span>
              )}
            </div>

            {group.shown.map((agent) => (
              <Row
                key={agent.id}
                agent={agent}
                all={all}
                span={span}
                onPick={() => setPickedId(agent.id)}
              />
            ))}

            {/* No roll-up row here, and that is the frame's decision, not an
                omission: the band already says `Settled 12` beside three
                rows, so the count that was cut is stated where the group is
                named. A `+9` row on a phone is a row you cannot open. */}
          </div>
        ))}

        {picked !== null && (
          <div className={s.pickedWrap}>
            <Picked
              agent={picked}
              span={span}
              onSettle={() => setAction({ at: 'settle', agentId: picked.id })}
              onHold={() => setAction({ at: 'hold', agentId: picked.id })}
              onPay={() => setAction({ at: 'commission', agentId: picked.id })}
            />
          </div>
        )}
      </div>

      {action !== null && (
        <PhoneAgentAction
          action={action}
          agents={all}
          span={span}
          today={DEMO_TODAY}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  A row: two lines, three columns                                           */
/* -------------------------------------------------------------------------- */

function Row({
  agent,
  all,
  span,
  onPick,
}: {
  readonly agent: Agent;
  readonly all: readonly Agent[];
  readonly span: Span;
  readonly onPick: () => void;
}): ReactElement {
  const owed = owes(agent);
  const late = behind(agent);
  const mark = agentMark(agent, all, span);

  return (
    <button type="button" className={s.row} onClick={onPick}>
      <span
        className={s.avatar}
        style={late ? TONE.warn : mark?.tone === 'info' ? TONE.info : TONE.neutral}
      >
        {initials(agent.name)}
      </span>

      <span className={s.name}>{agent.name}</span>
      <span className={late ? s.figureWarn : s.figure}>
        {Money.format(late ? owed : shopBilled(agent, span))}
      </span>

      {mark === null ? (
        <span className={s.note}>{agentNoteShort(agent, span)}</span>
      ) : (
        <span className={s.marks}>
          <span className={s.pill} style={mark.tone === 'info' ? TONE.info : TONE.warn}>
            {mark.pill === 'sells at the shop price' ? 'at the shop price' : mark.pill}
          </span>
          {mark.tone === 'info' && <span className={s.markFact}>{agentNoteShort(agent, span)}</span>}
        </span>
      )}

      {/* The word for the figure above it. Two reasons a row carries money,
          and at arm's length they must not look the same. */}
      <span className={s.word}>{late ? 'owes you' : 'billed'}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  The picked agent, at the foot of the list                                 */
/* -------------------------------------------------------------------------- */

function Picked({
  agent,
  span,
  onSettle,
  onHold,
  onPay,
}: {
  readonly agent: Agent;
  readonly span: Span;
  readonly onSettle: () => void;
  readonly onHold: () => void;
  readonly onPay: () => void;
}): ReactElement {
  const wf = waterfall(agent, span);
  const owed = owes(agent);

  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <span className={s.cardAvatar}>{initials(agent.name)}</span>
        <span className={s.cardName}>{agent.name}</span>
        <span className={s.cardChip}>{agent.terms}</span>
      </div>

      <div className={s.cardBody}>
        <div className={s.wf}>
          <span className={s.wfLabel}>Your cost</span>
          <span className={s.wfBar} style={{ width: `${wf.costWidth}%`, background: v('cost-bar') }} />
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
          <span className={s.wfFigGood}>{Money.format(wf.kept)}</span>
        </div>
        <div className={s.wfTotal}>
          <span className={s.wfLabelTotal}>Shop billed</span>
          <span className={s.wfBar} style={{ width: '100%', background: v('navy') }} />
          <span className={s.wfFig}>{Money.format(wf.billed)}</span>
        </div>
      </div>

      <div className={s.owed}>
        <span className={s.owedLabel}>Owes the shop</span>
        <span className={s.owedFig}>{Money.format(owed)}</span>
      </div>

      <div className={s.actions}>
        <button type="button" className={s.primary} onClick={onSettle}>
          Record settlement
        </button>
        <button type="button" className={s.secondary} onClick={onHold}>
          {agent.onHold ? 'Let him sell' : 'Hold orders'}
        </button>
      </div>

      {/* The commission is a desk question — the payout is claimed against a
          month, not on a round. It is one line here, and it opens the sheet
          that states the cluster rule before the figure. */}
      <button type="button" className={s.bonusRow} onClick={onPay}>
        <span className={s.bonusLabel}>Commission, {span.names}</span>
        <span className={s.bonusMark}>
          <Mark d={PATH.chevron} size={14} />
        </span>
      </button>
    </div>
  );
}
