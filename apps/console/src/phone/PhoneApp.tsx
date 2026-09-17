/**
 * The phone application.
 *
 * Held in one hand, outdoors, in daylight, while doing something else. That
 * is a different product from the console, and this tree is written as one:
 * larger type, 44px targets, cards instead of tables, one thing at a time,
 * and the five things worth a tab under the thumb.
 *
 * The desktop's sixteen rail items do not appear here and are not meant to.
 * Everything beyond the five lives under More. A phone that offered all
 * sixteen would be the console with a scrollbar.
 */

import { useState, type ReactElement } from 'react';
import s from './PhoneApp.module.css';
import { TabMark, type TabIcon } from './icons.js';
import { Today } from './screens/Today.js';
import { NotBuiltYet } from './screens/NotBuiltYet.js';

interface Tab {
  readonly id: TabIcon;
  readonly label: string;
  readonly badge?: number;
  /**
   * The screen's one action, rendered by the shell in the thumb zone rather
   * than by the screen itself — so it is always reachable and can never sit
   * on top of the work. A tab with no single obvious next action has none,
   * and shows no bar; an invented one would spend the accent on nothing.
   */
  readonly action?: string;
}

const TABS: readonly Tab[] = [
  { id: 'today', label: 'Today', action: 'Take an order' },
  { id: 'sell', label: 'Sell', action: 'Start a sale' },
  { id: 'money', label: 'Money', badge: 7 },
  { id: 'stock', label: 'Stock', badge: 3 },
  { id: 'more', label: 'More' },
];

const TITLES: Record<TabIcon, string> = {
  today: 'Today',
  sell: 'Sell',
  money: 'Money',
  stock: 'Stock',
  more: 'More',
};

export default function PhoneApp(): ReactElement {
  const [tab, setTab] = useState<TabIcon>('today');
  const action = TABS.find((t) => t.id === tab)?.action;

  return (
    <div className={s.shell}>
      <header className={s.topbar}>
        <span className={s.topTitle}>{TITLES[tab]}</span>
        <div className={s.topSpacer} />
        <button type="button" className={s.topBtn} aria-label="Search">
          <svg
            viewBox="0 0 24 24"
            width={22}
            height={22}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
        </button>
      </header>

      <main className={s.scroll}>
        {tab === 'today' ? <Today /> : <NotBuiltYet name={TITLES[tab]} />}
      </main>

      {action !== undefined && (
        <div className={s.actionBar}>
          {/* The one accent on the screen. */}
          <button type="button" className={s.primary}>
            {action}
          </button>
        </div>
      )}

      <nav className={s.tabs} aria-label="Sections">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              className={`${s.tab} ${active ? s.tabActive : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              <span className={s.tabIconWrap}>
                <TabMark name={t.id} active={active} />
                {t.badge !== undefined && (
                  <span className={s.tabBadge}>
                    {t.badge}
                    <span className="ow-sr-only"> needing attention</span>
                  </span>
                )}
              </span>
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
