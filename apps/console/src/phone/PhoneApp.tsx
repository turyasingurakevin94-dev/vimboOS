/**
 * The phone application.
 *
 * The shell is the tab bar and the switch between screens, and nothing else.
 * Each screen brings its own header — Today's is a day and a figure strip
 * (screen 2b), the quote's is a brand row and a two-way switch over a 64px
 * dock (frame 4b) — because a shell that owned the header could hold only
 * one of them.
 *
 * The five tabs are Today, Sell, Money, Orders and More. Everything else
 * lives in the More sheet, which is generated from the rail's own index —
 * never a second hand-kept list.
 *
 * **Slot four was Manager, and Manager was a stub.** The board arrived with
 * three phone frames of its own and had to be reachable; the only slot
 * holding nothing was the one showing `Not built yet`, and a tab labelled
 * for a screen that exists beats a tab labelled for one that does not.
 * Manager keeps its rail row and its cards on Today, and it comes back into
 * the tab bar or into the More sheet the day it is built — that is the
 * owner's call, and it is named here rather than left to be discovered.
 */

import { useState, type ReactElement } from 'react';
import s from './PhoneApp.module.css';
import { TabMark, type TabIcon } from './icons.js';
import { Today } from './screens/Today.js';
import { Quote } from './screens/Quote.js';
import { Invoices } from './screens/Invoices.js';
import { Customers } from './screens/Customers.js';
import { OrderTracking } from './screens/OrderTracking.js';

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
  { id: 'orders', label: 'Orders' },
  { id: 'more', label: 'More' },
];

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
      ) : tab === 'orders' ? (
        <OrderTracking />
      ) : (
        /**
         * More lands on Customers, which is what frame 1b draws.
         *
         * When the More sheet is built — generated from the rail's own index,
         * never a second hand-kept list — Customers becomes a row in it and
         * this becomes a push. Until then the destination the frame shows
         * under this tab is the destination this tab reaches, rather than a
         * sheet nobody has designed standing between them.
         *
         * It is the final branch, not a `tab === 'more'` one, because all
         * five tabs now land on a screen that exists: `NotBuiltYet` was the
         * fallback while one of them did not, and a branch that can never be
         * taken is a screen nobody will ever see.
         */
        <Customers />
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
