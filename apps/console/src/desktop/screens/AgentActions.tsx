/**
 * The four actions the console offers — frames 2a, 2c, 2e and 2g.
 *
 * They are one component because they are one conversation: each is opened
 * from the agent panel or the top bar, each reads the same agent the panel
 * reads, and each either creates a record or blocks a sale. What each one
 * had to settle:
 *
 * **A settlement** takes money against particular orders, so the orders are
 * ticked rather than implied, and the figure taken is the SHOP price — the
 * money he brings is his own payment for goods, not his clients' money
 * passing through the shop. There is no client-price column, here least of
 * all.
 *
 * **The commission** leads with *claimable* and puts *not yet counted*
 * beside it with its reason, so the owner claims what the payout will pay.
 * The last line is the one that matters: it is the supplier's money, it pays
 * only on cluster items, and it does not touch what he owes.
 *
 * **A hold** blocks a sale at the counter, so it states the three things the
 * owner would otherwise have to guess: what is refused, what is untouched,
 * and the words the agent will read. Its commit is navy, not accent —
 * holding is not the screen's next action.
 *
 * **An invite** makes the terms the decision rather than a dropdown: two
 * cards carrying their consequence, and a credit ceiling that stays greyed
 * until credit is chosen. The 2-of-14 figure is the shop's own record
 * arguing for prepay.
 *
 * `Esc` closes every one of them, and `Ctrl/Cmd ↵` commits.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  HOLD_WORDS,
  Money,
  commission,
  creditReads,
  cycle,
  owes,
  dayAndMonth,
  everythingOwed,
  match,
  monthLabel,
  settlementReads,
  settlementTotal,
  unsettled,
  type Agent,
  type AgentOrder,
  type Span,
} from '@ow/domain';
import { demoBonusSuppliers, demoRounds, demoSettlementAccounts } from '@ow/data';
import s from './AgentActions.module.css';
import { Icon } from '../icons.js';

export type Action =
  | { readonly at: 'settle'; readonly agentId: string }
  | { readonly at: 'commission'; readonly agentId: string }
  | { readonly at: 'hold'; readonly agentId: string }
  | { readonly at: 'invite' };

export interface AgentActionProps {
  readonly action: Action;
  readonly agents: readonly Agent[];
  readonly span: Span;
  readonly today: Date;
  readonly onClose: () => void;
}

/** `15 Sep 2026` — the way the shop writes a date. */
export const shopDate = (d: Date): string =>
  `${d.getUTCDate()} ${monthLabel(d)} ${d.getUTCFullYear()}`;

/** `9–14 Sep`, or `28 Aug – 4 Sep` when a run crosses a month. */
export function rangeReads(orders: readonly AgentOrder[]): string {
  const days = orders.map((o) => o.delivered ?? o.taken).sort((a, b) => a.getTime() - b.getTime());
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) return '';
  if (first.getUTCMonth() === last.getUTCMonth()) {
    return `${first.getUTCDate()}–${last.getUTCDate()} ${monthLabel(last)}`;
  }
  return `${dayAndMonth(first)} – ${dayAndMonth(last)}`;
}

export function AgentAction({
  action,
  agents,
  span,
  today,
  onClose,
}: AgentActionProps): ReactElement | null {
  const agent = action.at === 'invite' ? null : agents.find((a) => a.id === action.agentId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (action.at !== 'invite' && agent === null) return null;

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div
        className={action.at === 'hold' ? s.panelSmall : action.at === 'settle' ? s.panelWide : s.panel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {action.at === 'settle' && agent !== null && (
          <Settle agent={agent} today={today} onClose={onClose} />
        )}
        {action.at === 'commission' && agent !== null && (
          <PayCommission agent={agent} span={span} onClose={onClose} />
        )}
        {action.at === 'hold' && agent !== null && <Hold agent={agent} onClose={onClose} />}
        {action.at === 'invite' && <Invite agents={agents} onClose={onClose} />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2a — Record a settlement                                                  */
/* -------------------------------------------------------------------------- */

function Settle({
  agent,
  today,
  onClose,
}: {
  readonly agent: Agent;
  readonly today: Date;
  readonly onClose: () => void;
}): ReactElement {
  const owing = useMemo(() => unsettled(agent), [agent]);
  const rest = useMemo(
    () => cycle(agent).filter((o) => Money.isZero(o.outstanding)),
    [agent],
  );
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => everythingOwed(agent));
  const [account, setAccount] = useState(demoSettlementAccounts[0] ?? 'Cash · shop till');

  const taking = settlementTotal(agent, ticked);
  const cycleOrders = cycle(agent).length;

  const toggle = (doc: string): void =>
    setTicked((prior) => {
      const next = new Set(prior);
      if (next.has(doc)) next.delete(doc);
      else next.add(doc);
      return next;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <Head title="Record a settlement" who={agent.name} onClose={onClose} />

      <div className={s.owedBand}>
        <div>
          <div className={s.owedLabel}>Owes the shop</div>
          <div className={s.owedFig}>{Money.format(Money.add(...owing.map((o) => o.outstanding)))}</div>
        </div>
        <div className={s.owedSide}>
          <div className={s.owedLabelSmall}>On</div>
          <div className={s.owedOn}>
            {cycleOrders} delivered {cycleOrders === 1 ? 'order' : 'orders'}
          </div>
        </div>
        <div className={s.owedWords}>
          He is paying the shop for goods he has taken, not handing over money he collected for the
          shop.
        </div>
      </div>

      <div className={s.tableHead}>
        <span />
        <span className={s.column}>Order</span>
        <span className={s.column}>Delivered</span>
        <span className={`${s.column} ${s.columnRight}`}>Shop price</span>
      </div>

      {owing.map((order) => (
        <div key={order.doc} className={s.tableRow}>
          <button
            type="button"
            className={ticked.has(order.doc) ? s.tickOn : s.tick}
            aria-pressed={ticked.has(order.doc)}
            aria-label={`Settle ${order.doc}`}
            onClick={() => toggle(order.doc)}
          >
            {ticked.has(order.doc) && <Icon name="check" size={10} strokeWidth={3.4} />}
          </button>
          <span className={s.doc}>{order.doc.replace('-', '‑')}</span>
          <span className={s.when}>
            {dayAndMonth(order.delivered ?? order.taken)} · {order.where}
          </span>
          <span className={s.amount}>{Money.format(order.outstanding)}</span>
        </div>
      ))}

      {rest.length > 0 && (
        <div className={`${s.tableRow} ${s.tableRowQuiet}`}>
          <span className={s.tickOff} />
          <span className={s.restCount}>
            {rest.length} more
          </span>
          <span className={s.when}>{rangeReads(rest)}</span>
          <span className={`${s.amount} ${s.amountQuiet}`}>0</span>
        </div>
      )}

      <div className={s.fields}>
        {/* Derived, not typed. What is taken is the shop price on the orders
            ticked above — a figure typed over that would be a settlement
            against nothing in particular, which is the thing the table
            exists to prevent. */}
        <div className={s.fieldAmount}>
          <div className={s.label}>Amount taken</div>
          <div className={s.amountField}>
            <span className={s.amountTyped}>{Money.format(taking)}</span>
            <span className={s.unit}>UGX</span>
          </div>
        </div>
        <div className={s.fieldAccount}>
          <div className={s.label}>Into</div>
          <div className={s.select}>
            <select
              className={s.selectInput}
              value={account}
              aria-label="Into"
              onChange={(e) => setAccount(e.target.value)}
            >
              {demoSettlementAccounts.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <Icon name="chevron-down" size={14} className={s.caret} />
          </div>
        </div>
        <div className={s.fieldDate}>
          <div className={s.label}>Date</div>
          <div className={s.field}>
            <span className={s.dateText}>{shopDate(today)}</span>
            <Icon name="calendar" size={14} className={s.caret} />
          </div>
        </div>
      </div>

      <Foot
        words={settlementReads(agent, ticked)}
        commit={`Take ${Money.format(taking)}`}
        disabled={Money.isZero(taking)}
        onClose={onClose}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  2c — Pay the commission                                                   */
/* -------------------------------------------------------------------------- */

function PayCommission({
  agent,
  span,
  onClose,
}: {
  readonly agent: Agent;
  readonly span: Span;
  readonly onClose: () => void;
}): ReactElement {
  const bonus = commission(agent, span);
  const [from, setFrom] = useState(agent.bonusFrom);
  const claimable = match(bonus.claimable, {
    known: (amount) => amount,
    partial: (amount) => amount,
    unavailable: () => null,
  });

  return (
    <>
      <Head title={`Pay the ${span.names} commission`} who={agent.name} onClose={onClose} />

      <div className={s.twoUp}>
        <div className={s.claim}>
          <div className={s.label}>Claimable</div>
          <div className={s.claimFig}>{claimable === null ? '—' : Money.format(claimable)}</div>
          <div className={s.claimBasis}>
            on {bonus.earnedOn.length} completed {bonus.earnedOn.length === 1 ? 'order' : 'orders'},
            cluster items only
          </div>
        </div>
        <div className={s.claimSide}>
          <div className={s.labelWarn}>Not yet counted</div>
          <div className={s.claimSideFig}>{Money.format(bonus.notYetCounted)}</div>
          <div className={s.claimBasis}>
            {bonus.waitingOn.length} {bonus.waitingOn.length === 1 ? 'order' : 'orders'} still out
            for delivery
          </div>
        </div>
      </div>

      <div className={s.noticeWrap}>
        {match(bonus.agrees, {
          known: (agreed) =>
            agreed ? (
              <div className={s.noticeGood}>
                <Icon name="check" size={14} className={s.noticeGlyph} />
                <span className={s.noticeWords}>
                  The payout agrees with what this screen shows. Claim what you can prove.
                </span>
              </div>
            ) : (
              <div className={s.noticeWarn}>
                <Icon name="alert-circle" size={14} className={s.noticeGlyphWarn} />
                <span className={s.noticeWordsWarn}>
                  The payout and this screen disagree. Claim the payout&apos;s figure and find the
                  difference before it is paid twice.
                </span>
              </div>
            ),
          partial: () => (
            <div className={s.noticeWarn}>
              <Icon name="alert-circle" size={14} className={s.noticeGlyphWarn} />
              <span className={s.noticeWordsWarn}>
                Part of {span.names} is still being counted.
              </span>
            </div>
          ),
          unavailable: (why) => (
            <div className={s.noticeWarn}>
              <Icon name="alert-circle" size={14} className={s.noticeGlyphWarn} />
              <span className={s.noticeWordsWarn}>{why}</span>
            </div>
          ),
        })}
      </div>

      <div className={s.fields}>
        <div className={s.fieldFrom}>
          <div className={s.label}>Claiming from</div>
          <div className={s.select}>
            <select
              className={s.selectInput}
              value={from}
              aria-label="Claiming from"
              onChange={(e) => setFrom(e.target.value)}
            >
              {[...new Set([agent.bonusFrom, ...demoBonusSuppliers])].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <Icon name="chevron-down" size={14} className={s.caret} />
          </div>
        </div>
        <div className={s.fieldRef}>
          <div className={s.label}>
            Reference <span className={s.labelSoft}>optional</span>
          </div>
          <div className={s.field}>
            <input className={s.input} placeholder="Their claim number" aria-label="Reference" />
          </div>
        </div>
      </div>

      <Foot
        words="This is the supplier’s money passing through. It does not change what he owes the shop."
        commit={claimable === null ? 'Pay' : `Pay ${Money.format(claimable)}`}
        disabled={claimable === null || Money.isZero(claimable)}
        onClose={onClose}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  2e — Hold new orders                                                      */
/* -------------------------------------------------------------------------- */

function Hold({
  agent,
  onClose,
}: {
  readonly agent: Agent;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <div className={s.ask}>
      <div className={s.askTitle}>Hold new orders for {agent.name}?</div>
      <p className={s.askWords}>
        The counter will refuse a new order in his name until{' '}
        <span className={s.inlineFig}>{Money.format(owes(agent))}</span> is settled. His{' '}
        <strong className={s.askStrong}>
          {cycle(agent).length} delivered {cycle(agent).length === 1 ? 'order' : 'orders'}
        </strong>{' '}
        {cycle(agent).length === 1 ? 'is' : 'are'} unaffected, and he keeps seeing them in his app.
      </p>
      <div className={s.labelSpaced}>What he is told</div>
      <div className={s.quote}>&#8220;{HOLD_WORDS}&#8221;</div>
      <div className={s.askActions}>
        <button type="button" className={s.secondaryWide} onClick={onClose}>
          Keep selling
        </button>
        <button type="button" className={s.dark} onClick={onClose}>
          Hold his orders
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2g — Invite an agent                                                      */
/* -------------------------------------------------------------------------- */

function Invite({
  agents,
  onClose,
}: {
  readonly agents: readonly Agent[];
  readonly onClose: () => void;
}): ReactElement {
  const [terms, setTerms] = useState<'prepay' | 'credit'>('prepay');
  const [name, setName] = useState('');

  return (
    <>
      <Head title="Invite an agent" who={null} onClose={onClose} />

      <div className={s.fields}>
        <div className={s.fieldName}>
          <div className={s.label}>Name</div>
          <div className={s.fieldLive}>
            <input
              className={s.input}
              placeholder="Their full name"
              aria-label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <div className={s.fieldPhone}>
          <div className={s.label}>
            Phone <span className={s.labelSoft}>the invite goes here</span>
          </div>
          <div className={s.field}>
            <input className={s.input} placeholder="07…" aria-label="Phone" />
          </div>
        </div>
        <div className={s.fieldRound}>
          <div className={s.label}>Round</div>
          <div className={s.select}>
            <select className={s.selectInput} defaultValue="" aria-label="Round">
              <option value="" disabled>
                Pick one
              </option>
              {demoRounds.map((round) => (
                <option key={round}>{round}</option>
              ))}
            </select>
            <Icon name="chevron-down" size={14} className={s.caret} />
          </div>
        </div>
      </div>

      <div className={s.termsBlock}>
        <div className={s.label}>Terms</div>
        <div className={s.terms}>
          <button
            type="button"
            className={terms === 'prepay' ? s.termOn : s.term}
            aria-pressed={terms === 'prepay'}
            onClick={() => setTerms('prepay')}
          >
            <span className={s.termHead}>
              <span className={terms === 'prepay' ? s.tickOn : s.tick}>
                {terms === 'prepay' && <Icon name="check" size={10} strokeWidth={3.4} />}
              </span>
              <span className={s.termName}>Prepay</span>
            </span>
            <span className={s.termWords}>
              They pay the shop price before the goods leave. Nothing can fall behind.
            </span>
          </button>

          <button
            type="button"
            className={terms === 'credit' ? s.termOn : s.term}
            aria-pressed={terms === 'credit'}
            onClick={() => setTerms('credit')}
          >
            <span className={s.termHead}>
              <span className={terms === 'credit' ? s.tickOn : s.tick}>
                {terms === 'credit' && <Icon name="check" size={10} strokeWidth={3.4} />}
              </span>
              <span className={s.termName}>Credit</span>
            </span>
            <span className={s.termWords}>{creditReads(agents)}</span>
          </button>
        </div>
      </div>

      <div className={terms === 'credit' ? s.ceiling : s.ceilingOff}>
        <div className={s.label}>Credit ceiling</div>
        <div className={s.ceilingField}>
          <input
            className={s.ceilingInput}
            inputMode="numeric"
            placeholder="0"
            aria-label="Credit ceiling"
            disabled={terms !== 'credit'}
          />
          <span className={s.unit}>UGX</span>
        </div>
        <div className={s.ceilingWords}>
          {terms === 'credit'
            ? 'Nothing leaves the shop in his name above this'
            : 'Set this only if you choose credit'}
        </div>
      </div>

      <Foot
        words="They get a link to the agent app. Nothing is sold in their name until they open it."
        commit="Send the invite"
        disabled={name.trim() === ''}
        onClose={onClose}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  The parts every dialog shares                                             */
/* -------------------------------------------------------------------------- */

function Head({
  title,
  who,
  onClose,
}: {
  readonly title: string;
  readonly who: string | null;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <div className={s.head}>
      <span className={s.headTitle}>{title}</span>
      {who !== null && <span className={s.headWho}>{who}</span>}
      <span className={s.spacer} />
      <button type="button" className={s.close} aria-label="Close" onClick={onClose}>
        <Icon name="x" size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function Foot({
  words,
  commit,
  disabled,
  onClose,
}: {
  readonly words: string;
  readonly commit: string;
  readonly disabled: boolean;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <div className={s.foot}>
      <span className={s.footWords}>{words}</span>
      <button type="button" className={s.secondary} onClick={onClose}>
        Cancel
      </button>
      <button type="button" className={s.primary} disabled={disabled} onClick={onClose}>
        {commit}
      </button>
    </div>
  );
}
