/**
 * The phone application.
 *
 * The shell is the tab bar and the switch between screens, and nothing else.
 * Each screen brings its own header — Today's is a day and a figure strip
 * (screen 2b), the quote's is a brand row and a two-way switch over a 64px
 * dock (frame 4b) — because a shell that owned the header could hold only
 * one of them.
 *
 * The five tabs are Today, Sell, Money, Manager and More. Everything else
 * lives in the More sheet, which is generated from the rail's own index —
 * never a second hand-kept list.
 */

import { useState, type ReactElement } from 'react';
import s from './PhoneApp.module.css';
import { TabMark, type TabIcon } from './icons.js';
import { Today } from './screens/Today.js';
import { Quote } from './screens/Quote.js';
import { Invoices } from './screens/Invoices.js';
import { NotBuiltYet } from './screens/NotBuiltYet.js';

const TABS: readonly { readonly id: TabIcon; readonly label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'sell', label: 'Sell' },
  { id: 'money', label: 'Money' },
  { id: 'manager', label: 'Manager' },
  { id: 'more', label: 'More' },
];

const TITLES: Record<TabIcon, string> = {
  today: 'Today',
  sell: 'Sell',
  money: 'Money',
  manager: 'Manager',
  more: 'More',
};

export default function PhoneApp(): ReactElement {
  const [tab, setTab] = useState<TabIcon>('today');

  return (
    <div className={s.shell}>
      {/* The screen's own root IS the grid cell — see PhoneApp.module.css. */}
      {tab === 'today' ? (
        <Today />
      ) : tab === 'sell' ? (
        // Sell IS the quote being built. There is no list to land on first:
        // the handoff removed the saved-quote lens, and a list of drafts was
        // never the thing anyone opened this tab to reach.
        <Quote />
      ) : tab === 'money' ? (
        /**
         * Invoices lands under Money, and that is an OPEN QUESTION.
         *
         * Frame 1c draws the tab bar as Today · **Invoices** · Money ·
         * Manager · More — Invoices in the slot where Sell sits, and Sell is
         * where the Quote phone screens live. Two handoffs disagree about
         * the second tab, so neither is silently overwritten: Invoices is a
         * money screen and Money was a stub, so it goes there and stays
         * reachable while the owner decides which of the two owns slot two.
         */
        <Invoices />
      ) : (
        <NotBuiltYet name={TITLES[tab]} />
      )}

      <nav className={s.tabs} aria-label="Sections">
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              className={`${s.tab} ${on ? s.tabOn : ''}`}
              aria-current={on ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              <span className={s.tabPill}>
                <TabMark name={t.id} active={on} />
              </span>
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
