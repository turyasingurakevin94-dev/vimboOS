/**
 * The desktop console.
 *
 * Built to the Today handoff (`design_handoff_dashboard_today`), §1.1–1.2.
 * This tree never asks how wide the screen is — it is already the answer to
 * that question.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { owingBadge, read } from '@ow/domain';
import { useNeedsYou } from '../app/useBoard.js';
import { useRegister } from '../app/useRegister.js';
import { useToday } from '../app/useToday.js';
import s from './DesktopApp.module.css';
import { Rail, SECTIONS, TODAY, asksForBonus, resolveTab } from './chrome/Rail.js';
import { Icon } from './icons.js';
import { Today } from './screens/Today.js';
import { NotBuiltYet } from './screens/NotBuiltYet.js';
import { Quote } from './screens/Quote.js';
import { Invoices } from './screens/Invoices.js';
import { Customers } from './screens/Customers.js';
import { Agents } from './screens/Agents.js';
import { Messages } from './screens/Messages.js';
import { Shop } from './screens/Shop.js';
import { OrderTracking } from './screens/OrderTracking.js';

/**
 * What a screen puts in the top bar, where the stage chips otherwise sit.
 *
 * The bar is chrome and belongs to the shell, but its right-hand slot and
 * its search hint are the SCREEN's — frame 1a of the Customers handoff draws
 * `New customer` there and a search that offers to answer "owes over 1m",
 * and a Customers screen advertising three order stages would be the shell
 * talking over it. A screen that says nothing keeps the stage chips.
 *
 * `opens` is what the action MAKES, and only an action that makes something
 * wears the plus. Broadcast does not make a customer — it is one of the two
 * features WhatsApp had before it became a lens on Messages, and a plus
 * beside it would promise a new thing rather than a door.
 */
const CHROME: Readonly<
  Partial<
    Record<string, { readonly hint: string; readonly action?: string; readonly opens?: boolean }>
  >
> = {
  customers: { hint: 'Name, phone, or "owes over 1m"', action: 'New customer', opens: true },
  messages: { hint: 'Name, number, or what the message is about', action: 'Broadcast' },
  agents: {
    hint: 'Agent, order no., or "owes the shop"',
    action: 'Invite an agent',
    opens: true,
  },
  /**
   * Order tracking takes the slot and puts nothing in it — the first screen
   * with a hint and no action, which is why `action` is optional.
   *
   * The stage chips ARE this screen: `quoted 12 · packing 5 · out 3` is the
   * board's own lane heads, said a second time, eighty pixels above them and
   * from a different reckoning. The board's page head carries its own search
   * and its own `New quote`, which is where frame 1a draws them, so the slot
   * stays empty rather than holding a second copy of either.
   */
  orders: { hint: 'Client, order number or item' },
};

/** The order-stage chips in the top bar. They replace the old status bar. */
const STAGES = [
  { id: 'quoted', label: 'quoted', n: 12, bg: 'info-chip', ink: 'info-ink' },
  { id: 'packing', label: 'packing', n: 5, bg: 'warn-fill', ink: 'warn-ink' },
  { id: 'out', label: 'out', n: 3, bg: 'good-chip-light', ink: 'good-ink' },
] as const;

const NAMES = new Map<string, string>([
  [TODAY.id, TODAY.label],
  ...SECTIONS.flatMap((sec) => sec.items.map((i) => [i.id, i.label] as [string, string])),
]);

/**
 * The breadcrumb's parent is the section the destination lives in — frame 4a
 * reads "Sell › New quote". Today belongs to no section, so it keeps "Start",
 * which is what screen 2a draws.
 */
/**
 * What to call a destination that has no rail row.
 *
 * A screen can send you somewhere the map does not list yet — the board's
 * `Runs` is one — and `NotBuiltYet` then headed itself with the raw id, in
 * lower case. Title-casing the id is not a name, but it is the id said
 * politely, and it is what the breadcrumb was already doing for Today.
 */
const titleOf = (id: string): string =>
  NAMES.get(id) ?? id.charAt(0).toUpperCase() + id.slice(1);

const PARENTS = new Map<string, string>(
  SECTIONS.flatMap((sec) => sec.items.map((i) => [i.id, sec.name] as [string, string])),
);

export default function DesktopApp(): ReactElement {
  const [section, setSection] = useState('today');
  /**
   * A third crumb, where a screen has somewhere inside it worth naming.
   *
   * Only the posting queue uses it — frame 1c draws "Sell › Messages ›
   * Posting" — because a lens is not a destination and the other three are
   * not places you say you are going.
   */
  const [trail, setTrail] = useState<string | null>(null);
  /**
   * The top bar's action belongs to the SCREEN, not the shell.
   *
   * The bar is chrome, so the button is drawn here; what it opens is the
   * screen's — *Invite an agent* raises frame 2g, which reads the same
   * agents the list reads. The shell holds one flag and hands it down, and
   * the screen hands back the close. A screen that owned the button would
   * have to own the bar.
   */
  const [topAction, setTopAction] = useState(false);
  /**
   * Which part of the screen the search was asking for.
   *
   * "payout" resolves to Agents, and a cut screen is only really absorbed if
   * the word lands on the figures it used to show rather than on the top of
   * whatever swallowed it. It counts up so that typing it twice scrolls
   * twice.
   */
  const [bonusAsk, setBonusAsk] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const chrome = CHROME[section];

  const navigate = (id: string): void => {
    setTopAction(false);
    setSection(id);
  };

  /**
   * Today's own count, read here so the rail cannot disagree with the page.
   *
   * `wantsYou` exists to be one number read twice — the page's sub-line and
   * this badge — and wiring the sub-line while leaving the badge at the
   * frame's literal 8 produced exactly the drift it was written to prevent:
   * a rail saying 8 beside a sentence saying 10. The query is keyed, so the
   * screen's own `useToday()` reads this same cache rather than asking again.
   */
  const today = useToday();
  const people = useRegister();
  const needsYou = useNeedsYou();

  /**
   * The badges that come from the books.
   *
   * Every other badge in the rail is still the frame's literal, because
   * every other screen is still `NotBuiltYet` — a number invented for a
   * screen that does not exist yet is a placeholder, and a number invented
   * beside a screen that does exist is a lie.
   */
  const badges = useMemo(
    () => ({
      // Off the SAME register the screen reads. It was the demo book, so
      // the rail said 11 owing beside a screen reading 10 — a figure about
      // somebody else's shop, on the row that opens this one.
      ...(people.at === 'ready'
        ? { customers: owingBadge(read(people.data.customers, people.today)) }
        : {}),
      // The board's own queue, which is what a badge on this row means:
      // the decisions only the owner can make. Omitted until the board
      // lands, for the same reason Today's is.
      ...(needsYou === null ? {} : { orders: needsYou }),
      // Omitted until the read lands, rather than sent as zero: the rail
      // draws no badge for zero, and "nothing wants you" is the one thing
      // this row must not say while it is still finding out.
      ...(today.at === 'ready' ? { today: today.data.wantsYou } : {}),
    }),
    [today, needsYou, people],
  );

  const onTrail = useCallback((next: string | null) => setTrail(next), []);

  // Ctrl/Cmd + K focuses the field. Escape gives it up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === search.current) {
        search.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={s.shell}>
      <Rail current={section} onNavigate={navigate} badges={badges} />

      <div className={s.work}>
        <header className={s.topbar}>
          <div className={s.crumbs}>
            <span className={s.crumbStart}>{PARENTS.get(section) ?? 'Start'}</span>
            <Icon name="chevron-right" size={14} className={s.crumbSep} />
            <span className={s.crumbHere}>{titleOf(section)}</span>
            {trail !== null && (
              <>
                <Icon name="chevron-right" size={14} className={s.crumbSep} />
                <span className={s.crumbHere}>{trail}</span>
              </>
            )}
          </div>

          <div className={s.search}>
            <Icon name="search" size={15} />
            <input
              ref={search}
              className={s.searchInput}
              type="search"
              placeholder={chrome?.hint ?? 'Search a screen, customer or product'}
              aria-label="Search"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                // "debtors" still reaches the list it used to name.
                const typed = e.currentTarget.value;
                const found = resolveTab(typed);
                if (found !== null) {
                  navigate(found);
                  if (found === 'agents' && asksForBonus(typed)) {
                    setBonusAsk((n) => n + 1);
                  }
                  e.currentTarget.blur();
                }
              }}
            />
            <span className={s.kbd} aria-hidden="true">
              Ctrl K
            </span>
          </div>

          <div className={s.spacer} />

          {chrome?.action !== undefined ? (
            <button type="button" className={s.topAction} onClick={() => setTopAction(true)}>
              {chrome.opens === true && <Icon name="plus" size={15} />}
              {chrome.action}
            </button>
          ) : chrome === undefined ? (
            <div className={s.stages}>
              {STAGES.map((st) => (
                <span
                  key={st.id}
                  className={s.stage}
                  style={{
                    background: `var(--ow-color-${st.bg})`,
                    color: `var(--ow-color-${st.ink})`,
                  }}
                  title={`${st.label}: ${st.n}`}
                >
                  <span className={s.stageFig}>{st.n}</span>
                  <span className={s.stageLabel}>{st.label}</span>
                </span>
              ))}
            </div>
          ) : null}

          <div className={s.avatar}>KT</div>
        </header>

        <div className={s.body}>
          {section === 'today' ? (
            <Today />
          ) : section === 'quote' ? (
            <Quote />
          ) : section === 'invoices' ? (
            <Invoices />
          ) : section === 'customers' ? (
            <Customers />
          ) : section === 'agents' ? (
            <Agents
              inviting={topAction}
              bonusAsk={bonusAsk}
              onInviteClose={() => setTopAction(false)}
            />
          ) : section === 'messages' ? (
            <Messages onTrail={onTrail} />
          ) : section === 'shop' ? (
            <Shop onTrail={onTrail} />
          ) : section === 'orders' ? (
            <OrderTracking onGo={navigate} />
          ) : (
            <NotBuiltYet name={titleOf(section)} />
          )}
        </div>
      </div>
    </div>
  );
}
