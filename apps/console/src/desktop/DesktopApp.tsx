/**
 * The desktop console.
 *
 * Built to the Today handoff (`design_handoff_dashboard_today`), §1.1–1.2.
 * This tree never asks how wide the screen is — it is already the answer to
 * that question.
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import s from './DesktopApp.module.css';
import { Rail, SECTIONS, TODAY } from './chrome/Rail.js';
import { Icon } from './icons.js';
import { Today } from './screens/Today.js';
import { NotBuiltYet } from './screens/NotBuiltYet.js';
import { Quote } from './screens/Quote.js';
import { Invoices } from './screens/Invoices.js';
import { Messages } from './screens/Messages.js';
import { Shop } from './screens/Shop.js';

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
const PARENTS = new Map<string, string>(
  SECTIONS.flatMap((sec) => sec.items.map((i) => [i.id, sec.name] as [string, string])),
);

/**
 * What the search field is looking for, where a screen makes it specific.
 *
 * A placeholder that says "Search a screen, customer or product" on the
 * Messages desk is a field that has not read the screen it is sitting above:
 * what you search for there is a person and what the message is about.
 */
const SEARCH_HINT: Record<string, string> = {
  messages: 'Name, number, or what the message is about',
};

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
  const search = useRef<HTMLInputElement>(null);

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
      <Rail current={section} onNavigate={setSection} />

      <div className={s.work}>
        <header className={s.topbar}>
          <div className={s.crumbs}>
            <span className={s.crumbStart}>{PARENTS.get(section) ?? 'Start'}</span>
            <Icon name="chevron-right" size={14} className={s.crumbSep} />
            <span className={s.crumbHere}>{NAMES.get(section) ?? 'Today'}</span>
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
              placeholder={SEARCH_HINT[section] ?? 'Search a screen, customer or product'}
              aria-label="Search"
            />
            <span className={s.kbd} aria-hidden="true">
              Ctrl K
            </span>
          </div>

          <div className={s.spacer} />

          {/**
           * Messages puts its own door here instead of the stage chips.
           * Broadcast was one of WhatsApp's two features and it survives the
           * merge as a button; the order stages belong to the screens that
           * are about orders.
           */}
          {section === 'messages' ? (
            <button type="button" className={s.topAction}>
              Broadcast
            </button>
          ) : (
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
          )}

          <div className={s.avatar}>KT</div>
        </header>

        <div className={s.body}>
          {section === 'today' ? (
            <Today />
          ) : section === 'quote' ? (
            <Quote />
          ) : section === 'invoices' ? (
            <Invoices />
          ) : section === 'messages' ? (
            <Messages onTrail={onTrail} />
          ) : section === 'shop' ? (
            <Shop onTrail={onTrail} />
          ) : (
            <NotBuiltYet name={NAMES.get(section) ?? section} />
          )}
        </div>
      </div>
    </div>
  );
}
