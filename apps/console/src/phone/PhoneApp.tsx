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
import { Agents } from './screens/Agents.js';
import { NotBuiltYet } from './screens/NotBuiltYet.js';

/**
 * A dot rather than a count.
 *
 * The rail on the desktop has room to say EIGHT things want you. A tab bar
 * has room to say that something does, and the screen behind it says how
 * many the moment you arrive. A 19px pill on a 19px glyph is a badge that
 * covers the thing it is badging.
 */
const TABS: readonly { readonly id: TabIcon; readonly label: string; readonly dot?: boolean }[] = [
  { id: 'today', label: 'Today', dot: true },
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
      ) : tab === 'more' ? (
        /**
         * More lands on Agents, and that leaves Customers with no tab.
         *
         * Two handoffs now draw their phone screen with **More** active:
         * Customers 1b and Agents 1b. Both are right — More is where
         * everything that is not one of the four tabs lives — and the thing
         * that resolves them is the More sheet, generated from the rail's own
         * index. That sheet has not been drawn, and inventing a layout to
         * stand in for it would anchor the design it is meant to be.
         *
         * So the newest frame gets the tab, exactly as it draws it, and
         * Customers keeps its screen, its stylesheet and its tests while
         * waiting for the sheet that will carry both. This is the second
         * time this shell has had to park a frame's own placement (Invoices
         * wants slot two, which Sell has) and it is the same answer: say
         * which frame is being served, and leave the other reachable in one
         * edit rather than quietly reflowed into something else.
         */
        <Agents />
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
                {t.dot === true && !on && <span className={s.dot} />}
              </span>
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
