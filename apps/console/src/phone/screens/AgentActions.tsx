/**
 * The four actions, as the phone does them — frames 2b, 2d, 2f and 2h.
 *
 * **Not the desktop dialogs at 390px.** Two of them are full screens and two
 * are sheets, and which is which is the whole decision:
 *
 *  - **a settlement** (2b) and **an invite** (2h) are full screens, because
 *    each is a form with a table or four fields in it and a 620px dialog
 *    squeezed into a hand is how a wrong figure gets taken;
 *  - **the commission** (2d) and **a hold** (2f) are bottom sheets, because
 *    each is one decision about something already on screen, and a sheet
 *    keeps it there behind the scrim.
 *
 * Every commit is 48px and sits at the bottom, under the figure it acts on.
 * The hold's commit is navy rather than accent: holding is not the screen's
 * next action, on either design.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  HOLD_WORDS,
  Money,
  clusterReads,
  commission,
  creditReads,
  cycle,
  dayAndMonth,
  everythingOwed,
  match,
  monthLabel,
  owes,
  settlementReads,
  settlementTotal,
  unsettled,
  type Agent,
  type AgentOrder,
  type Span,
} from '@ow/domain';
import { demoBonusSuppliers, demoRounds, demoSettlementAccounts } from '@ow/data';
import s from './AgentActions.module.css';
import { Mark, PATH } from '../icons.js';

export type PhoneAction =
  | { readonly at: 'settle'; readonly agentId: string }
  | { readonly at: 'commission'; readonly agentId: string }
  | { readonly at: 'hold'; readonly agentId: string }
  | { readonly at: 'invite' };

export interface PhoneAgentActionProps {
  readonly action: PhoneAction;
  readonly agents: readonly Agent[];
  readonly span: Span;
  readonly today: Date;
  readonly onClose: () => void;
}

/** `15 Sep 2026` — the way the shop writes a date. */
const shopDate = (d: Date): string =>
  `${d.getUTCDate()} ${monthLabel(d)} ${d.getUTCFullYear()}`;

/** `9–14 Sep`, or `28 Aug – 4 Sep` when a run crosses a month. */
const rangeReads = (orders: readonly AgentOrder[]): string => {
  const days = orders.map((o) => o.delivered ?? o.taken).sort((a, b) => a.getTime() - b.getTime());
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) return '';
  return first.getUTCMonth() === last.getUTCMonth()
    ? `${first.getUTCDate()}–${last.getUTCDate()} ${monthLabel(last)}`
    : `${dayAndMonth(first)} – ${dayAndMonth(last)}`;
};

export function PhoneAgentAction({
  action,
  agents,
  span,
  today,
  onClose,
}: PhoneAgentActionProps): ReactElement | null {
  const agent = action.at === 'invite' ? null : agents.find((a) => a.id === action.agentId) ?? null;
  if (action.at !== 'invite' && agent === null) return null;

  if (action.at === 'settle' && agent !== null) {
    return <Settle agent={agent} today={today} onClose={onClose} />;
  }
  if (action.at === 'invite') return <Invite agents={agents} onClose={onClose} />;
  if (action.at === 'commission' && agent !== null) {
    return <PayCommission agent={agent} span={span} onClose={onClose} />;
  }
  if (action.at === 'hold' && agent !== null) return <Hold agent={agent} onClose={onClose} />;
  return null;
}

/* -------------------------------------------------------------------------- */
/*  2b — Record a settlement, a full screen                                   */
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
  const rest = useMemo(() => cycle(agent).filter((o) => Money.isZero(o.outstanding)), [agent]);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => everythingOwed(agent));
  const [account, setAccount] = useState(demoSettlementAccounts[0] ?? 'Cash · shop till');

  const taking = settlementTotal(agent, ticked);
  const delivered = cycle(agent).length;

  const toggle = (doc: string): void =>
    setTicked((prior) => {
      const next = new Set(prior);
      if (next.has(doc)) next.delete(doc);
      else next.add(doc);
      return next;
    });

  return (
    <div className={s.full}>
      <div className={s.fullHead}>
        <button type="button" className={s.back} aria-label="Back" onClick={onClose}>
          <Mark d={PATH.back} size={18} stroke={2.2} />
        </button>
        <span className={s.fullTitle}>Record a settlement</span>
      </div>

      <div className={s.owedBand}>
        <div className={s.owedLabel}>Owes the shop</div>
        <div className={s.owedFig}>{Money.format(owes(agent))}</div>
        {/* The frame names what his clients paid here. The shop does not hold
            that figure — `agentSellPrice` is his record, not the shop's — so
            the correction is made in the shop's own words instead. */}
        <div className={s.owedWords}>
          on {delivered} delivered {delivered === 1 ? 'order' : 'orders'} · at the shop price, not
          theirs
        </div>
      </div>

      <div className={s.fullBody}>
        <div className={s.label}>Amount taken</div>
        <div className={s.amountField}>
          <span className={s.amountFig}>{Money.format(taking)}</span>
          <span className={s.unit}>UGX</span>
        </div>

        <div className={s.labelSpaced}>Into</div>
        <div className={s.select}>
          <select
            className={s.selectInput}
            aria-label="Into"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            {demoSettlementAccounts.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <span className={s.caret}>
            <Mark d={PATH.chevronDown} size={15} />
          </span>
        </div>

        <div className={s.labelSpaced}>Date</div>
        <div className={s.field}>
          <span className={s.dateText}>{shopDate(today)}</span>
          <span className={s.caret}>
            <Mark d={PATH.calendar} size={15} />
          </span>
        </div>

        <div className={s.labelSpaced}>
          Which orders{' '}
          <span className={s.labelCount}>
            {ticked.size} of {delivered}
          </span>
        </div>
        <div className={s.orders}>
          {owing.map((order) => (
            <button
              key={order.doc}
              type="button"
              className={s.order}
              aria-pressed={ticked.has(order.doc)}
              onClick={() => toggle(order.doc)}
            >
              <span className={ticked.has(order.doc) ? s.tickOn : s.tick}>
                {ticked.has(order.doc) && <Mark d={PATH.tick} size={10} stroke={3.4} />}
              </span>
              <span className={s.orderWho}>
                <span className={s.orderDoc}>{order.doc.replace('-', '‑')}</span>
                <span className={s.orderWhen}>
                  {dayAndMonth(order.delivered ?? order.taken)} · {order.where}
                </span>
              </span>
              <span className={s.orderFig}>{Money.format(order.outstanding)}</span>
            </button>
          ))}

          {rest.length > 0 && (
            <div className={s.orderQuiet}>
              <span className={s.tick} />
              <span className={s.orderRest}>
                {rest.length} more · {rangeReads(rest)}
              </span>
              <span className={s.orderFigQuiet}>0</span>
            </div>
          )}
        </div>
      </div>

      <div className={s.foot}>
        <div className={s.footWords}>{settlementReads(agent, ticked)}</div>
        <button
          type="button"
          className={s.primary}
          disabled={Money.isZero(taking)}
          onClick={onClose}
        >
          Take {Money.format(taking)}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2d — Pay the commission, a sheet                                          */
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
    <Sheet onClose={onClose}>
      <div className={s.sheetTitle}>Pay the {span.names} commission</div>
      <div className={s.sheetSub}>
        {agent.name} · {bonus.earnedOn.length} completed{' '}
        {bonus.earnedOn.length === 1 ? 'order' : 'orders'}, cluster items only
      </div>

      {/* The rule before the figures, here as on the desktop. */}
      <p className={s.sheetWords}>{clusterReads(agent)}</p>

      <div className={s.claimRow}>
        <div>
          <div className={s.label}>Claimable</div>
          <div className={s.claimFig}>{claimable === null ? '—' : Money.format(claimable)}</div>
        </div>
        <div className={s.claimSide}>
          <div className={s.labelWarn}>Not yet counted</div>
          <div className={s.claimSideFig}>{Money.format(bonus.notYetCounted)}</div>
        </div>
      </div>

      <div className={s.labelSpaced}>Claiming from</div>
      <div className={s.select}>
        <select
          className={s.selectInput}
          aria-label="Claiming from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        >
          {[...new Set([agent.bonusFrom, ...demoBonusSuppliers])].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <span className={s.caret}>
          <Mark d={PATH.chevronDown} size={15} />
        </span>
      </div>

      <p className={s.sheetWords}>
        The supplier&apos;s money passing through. It does not change what he owes the shop.
      </p>

      <button
        type="button"
        className={s.primaryWide}
        disabled={claimable === null || Money.isZero(claimable)}
        onClick={onClose}
      >
        {claimable === null ? 'Pay' : `Pay ${Money.format(claimable)}`}
      </button>
      <button type="button" className={s.secondaryWide} onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  2f — Hold new orders, a sheet                                             */
/* -------------------------------------------------------------------------- */

function Hold({
  agent,
  onClose,
}: {
  readonly agent: Agent;
  readonly onClose: () => void;
}): ReactElement {
  const first = agent.name.split(' ')[0] ?? agent.name;
  const delivered = cycle(agent).length;

  return (
    <Sheet onClose={onClose}>
      <div className={s.sheetTitle}>Hold new orders for {first}?</div>
      <p className={s.sheetWords}>
        The counter will refuse a new order in his name until{' '}
        <span className={s.inlineFig}>{Money.format(owes(agent))}</span> is settled. His {delivered}{' '}
        delivered {delivered === 1 ? 'order is' : 'orders are'} unaffected.
      </p>
      <div className={s.labelSpaced}>What he is told</div>
      <div className={s.quote}>&#8220;{HOLD_WORDS}&#8221;</div>
      <button type="button" className={s.darkWide} onClick={onClose}>
        Hold his orders
      </button>
      <button type="button" className={s.secondaryWide} onClick={onClose}>
        Keep selling
      </button>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  2h — Invite an agent, a full screen                                       */
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
    <div className={s.full}>
      <div className={s.fullHead}>
        <button type="button" className={s.back} aria-label="Back" onClick={onClose}>
          <Mark d={PATH.back} size={18} stroke={2.2} />
        </button>
        <span className={s.fullTitle}>Invite an agent</span>
      </div>

      <div className={s.fullBody}>
        <div className={s.label}>Name</div>
        <div className={s.fieldLive}>
          <input
            className={s.input}
            aria-label="Name"
            placeholder="Their full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className={s.labelSpaced}>Phone</div>
        <div className={s.field}>
          <input className={s.input} aria-label="Phone" placeholder="07… · the invite goes here" />
        </div>

        <div className={s.labelSpaced}>Round</div>
        <div className={s.select}>
          <select className={s.selectInput} aria-label="Round" defaultValue="">
            <option value="" disabled>
              Pick one
            </option>
            {demoRounds.map((round) => (
              <option key={round}>{round}</option>
            ))}
          </select>
          <span className={s.caret}>
            <Mark d={PATH.chevronDown} size={15} />
          </span>
        </div>

        <div className={s.labelSpaced}>Terms</div>
        <div className={s.terms}>
          <button
            type="button"
            className={terms === 'prepay' ? s.termOn : s.term}
            aria-pressed={terms === 'prepay'}
            onClick={() => setTerms('prepay')}
          >
            <span className={s.termHead}>
              <span className={terms === 'prepay' ? s.tickOn : s.tick}>
                {terms === 'prepay' && <Mark d={PATH.tick} size={10} stroke={3.4} />}
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
                {terms === 'credit' && <Mark d={PATH.tick} size={10} stroke={3.4} />}
              </span>
              <span className={s.termName}>Credit</span>
            </span>
            <span className={s.termWords}>{creditReads(agents)}</span>
          </button>
        </div>

        {terms === 'credit' && (
          <>
            <div className={s.labelSpaced}>Credit ceiling</div>
            <div className={s.field}>
              <input
                className={s.inputFig}
                inputMode="numeric"
                aria-label="Credit ceiling"
                placeholder="0"
              />
              <span className={s.unit}>UGX</span>
            </div>
          </>
        )}
      </div>

      <div className={s.foot}>
        <div className={s.footWords}>
          Nothing is sold in their name until they open the link
        </div>
        <button
          type="button"
          className={s.primary}
          disabled={name.trim() === ''}
          onClick={onClose}
        >
          Send the invite
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  The sheet                                                                 */
/* -------------------------------------------------------------------------- */

function Sheet({
  children,
  onClose,
}: {
  readonly children: React.ReactNode;
  readonly onClose: () => void;
}): ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={s.sheet} onClick={(e) => e.stopPropagation()}>
        <span className={s.grab} />
        {children}
      </div>
    </div>
  );
}
