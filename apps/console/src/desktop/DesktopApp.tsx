/**
 * The desktop console.
 *
 * Built to the Today handoff (`design_handoff_dashboard_today`), §1.1–1.2.
 * This tree never asks how wide the screen is — it is already the answer to
 * that question.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { owingBadge, read } from '@ow/domain';
import { DEMO_TODAY, demoAsks, demoCustomers } from '@ow/data';
import s from './DesktopApp.module.css';
import { Rail, SECTIONS, TODAY, resolveTab } from './chrome/Rail.js';
import { Icon } from './icons.js';
import { Today } from './screens/Today.js';
import { NotBuiltYet } from './screens/NotBuiltYet.js';
import { Quote } from './screens/Quote.js';
import { Invoices } from './screens/Invoices.js';
import { Customers } from './screens/Customers.js';
import { OrderTracking } from './screens/OrderTracking.js';

/**
 * What a screen puts in the top bar, where the stage chips otherwise sit.
 *
 * The bar is chrome and belongs to the shell, but its right-hand slot and
 * its search hint are the SCREEN's — frame 1a of the Customers handoff draws
 * `New customer` there and a search that offers to answer "owes over 1m",
 * and a Customers screen advertising three order stages would be the shell
 * talking over it. A screen that says nothing keeps the stage chips.
 */
const CHROME: Readonly<
  Partial<Record<string, { readonly hint: string; readonly action?: string }>>
> = {
  customers: { hint: 'Name, phone, or "owes over 1m"', action: 'New customer' },
  /**
   * Order tracking takes the slot and puts nothing in it.
   *
   * The stage chips ARE this screen — `quoted 12 · packing 5 · out 3` is the
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
const PARENTS = new Map<string, string>(
  SECTIONS.flatMap((sec) => sec.items.map((i) => [i.id, sec.name] as [string, string])),
);

export default function DesktopApp(): ReactElement {
  const [section, setSection] = useState('today');
  const search = useRef<HTMLInputElement>(null);
  const chrome = CHROME[section];

  /**
   * The Customers badge, from the same reckoning the screen reads.
   *
   * Every other badge in the rail is still the frame's literal, because
   * every other screen is still `NotBuiltYet` — a number invented for a
   * screen that does not exist yet is a placeholder, and a number invented
   * beside a screen that does exist is a lie.
   */
  const badges = useMemo(
    () => ({
      customers: owingBadge(read(demoCustomers(), DEMO_TODAY)),
      // The board's own queue, which is what a badge on this row means:
      // twenty decisions only the owner can make.
      orders: demoAsks().length,
    }),
    [],
  );

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
      <Rail current={section} onNavigate={setSection} badges={badges} />

      <div className={s.work}>
        <header className={s.topbar}>
          <div className={s.crumbs}>
            <span className={s.crumbStart}>{PARENTS.get(section) ?? 'Start'}</span>
            <Icon name="chevron-right" size={14} className={s.crumbSep} />
            <span className={s.crumbHere}>{NAMES.get(section) ?? 'Today'}</span>
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
                const found = resolveTab(e.currentTarget.value);
                if (found !== null) {
                  setSection(found);
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
            <button type="button" className={s.topAction}>
              <Icon name="plus" size={15} />
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
          ) : section === 'orders' ? (
            <OrderTracking />
          ) : (
            <NotBuiltYet name={NAMES.get(section) ?? section} />
          )}
        </div>
      </div>
    </div>
  );
}
