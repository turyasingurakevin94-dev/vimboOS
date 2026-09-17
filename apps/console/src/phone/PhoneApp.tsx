/**
 * The phone application — screen 2b of the Today handoff.
 *
 * A navy header carrying the brand, the title, the day, an "8 to do" chip
 * and one 4-across figure strip; then the work; then a 56px tab bar whose
 * active state is a FILLED glyph in a tinted pill.
 *
 * The five tabs are Today, Sell, Money, Manager and More. Everything else
 * lives in the More sheet, which is generated from the rail's own index —
 * never a second hand-kept list.
 */

import { useState, type ReactElement } from 'react';
import s from './PhoneApp.module.css';
import { Mark, PATH, TabMark, type TabIcon } from './icons.js';
import { Today } from './screens/Today.js';
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

/** Abbreviated money is used ONLY here — the full figure is one tap away. */
const CELLS = [
  { label: 'CASH', fig: '8.42', unit: 'M', tone: 'plain' },
  { label: 'OWED YOU', fig: '23.65', unit: 'M', tone: 'bad' },
  { label: 'YOU OWE', fig: '11.2', unit: 'M', tone: 'plain' },
  { label: 'MARGIN', fig: '18.6', unit: '%', tone: 'good' },
] as const;

export default function PhoneApp(): ReactElement {
  const [tab, setTab] = useState<TabIcon>('today');

  return (
    <div className={s.shell}>
      <header className={s.header}>
        <div className={s.headTop}>
          <span className={s.mark} aria-hidden="true">
            <Mark
              d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35"
              size={14}
            />
          </span>
          <div className={s.headTitles}>
            <span className={s.headTitle}>{TITLES[tab]}</span>
            <span className={s.headWhen}>Mon 15 Sept · 07:42</span>
          </div>
          <span className={s.todo}>8 to do</span>
          <button type="button" className={s.headBtn} aria-label="Search">
            <Mark d={PATH.search} size={18} />
          </button>
        </div>

        <div className={s.strip} aria-label="The position">
          {CELLS.map((c) => (
            <div
              key={c.label}
              className={`${s.cell} ${
                c.tone === 'bad' ? s.cellBad : c.tone === 'good' ? s.cellGood : ''
              }`}
            >
              <div
                className={`${s.cellLabel} ${
                  c.tone === 'bad'
                    ? s.cellLabelBad
                    : c.tone === 'good'
                      ? s.cellLabelGood
                      : ''
                }`}
              >
                {c.label}
              </div>
              <div className={s.cellFig}>
                {c.fig}
                <span
                  className={`${s.cellUnit} ${
                    c.tone === 'bad'
                      ? s.cellUnitBad
                      : c.tone === 'good'
                        ? s.cellUnitGood
                        : ''
                  }`}
                >
                  {c.unit}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* The detail the cells dropped. Nothing is lost, only moved. */}
        <div className={s.headMeta}>
          2.4 months of cover · <span className={s.headMetaBad}>6.9M over 60 days</span> ·
          margin −1.4 pts
        </div>
      </header>

      <main className={s.scroll}>
        {tab === 'today' ? <Today /> : <NotBuiltYet name={TITLES[tab]} />}
      </main>

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
