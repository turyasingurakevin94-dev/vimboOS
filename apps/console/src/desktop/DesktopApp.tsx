/**
 * The desktop console.
 *
 * A dense work console for someone sitting in front of it for hours: a
 * persistent rail, a 56px top bar, the work in the main column and the
 * context that supports a decision in a 320px column beside it.
 *
 * This tree never asks how wide the screen is. It is already the answer to
 * that question.
 */

import { useState, type ReactElement } from 'react';
import s from './DesktopApp.module.css';
import { Rail } from './chrome/Rail.js';
import { Icon } from './icons.js';
import { Today } from './screens/Today.js';
import { Orders } from './screens/Orders.js';
import { NotBuiltYet } from './screens/NotBuiltYet.js';

export default function DesktopApp(): ReactElement {
  const [section, setSection] = useState('today');

  return (
    <div className={s.shell}>
      <Rail current={section} onNavigate={setSection} />

      <header className={s.topbar}>
        <input
          className={s.search}
          type="search"
          placeholder="Search orders, customers, products…"
          aria-label="Search"
        />
        <div className={s.spacer} />
        <button type="button" className={s.iconBtn} aria-label="Notifications">
          <Icon name="bell" />
        </button>
        <div className={s.who}>
          <span className={s.avatar} aria-hidden="true">
            KT
          </span>
          <span>
            <span className={s.whoName}>Kevin T.</span>
            <br />
            <span className={s.whoRole}>Owner</span>
          </span>
        </div>
      </header>

      <div className={s.main}>
        {section === 'today' ? (
          <Today />
        ) : section === 'orders' ? (
          <Orders />
        ) : (
          <NotBuiltYet section={section} />
        )}
      </div>
    </div>
  );
}
