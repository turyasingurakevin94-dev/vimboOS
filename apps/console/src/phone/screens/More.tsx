/**
 * More — the one piece of navigation no frame draws.
 *
 * Both the Customers phone frames and every Messages phone frame draw the tab
 * bar with **More** lit, so both screens are reached through it and both are
 * built. Five tabs cannot hold six destinations, so this stands between the
 * tab and them until the real sheet exists.
 *
 * It invents as little as it can: a title and the destinations, as 44px rows
 * in the phone's own row idiom. Its counts are the same reckonings the
 * screens behind them read, because a badge that disagreed with the screen it
 * opens is the drift the whole app is built to avoid.
 *
 * **This is not a designed screen.** When the More sheet arrives — generated
 * from the rail's own index rather than a second hand-kept list, which the
 * phone cannot reach today because a lint rule forbids importing the
 * desktop's tree — this file goes.
 */

import { type ReactElement } from 'react';
import { lensCounts, owingBadge, read } from '@ow/domain';
import { DEMO_TODAY, demoCustomers, demoDesk } from '@ow/data';
import s from './More.module.css';
import { Mark, PATH } from '../icons.js';

export type MoreDestination = 'customers' | 'messages';

export interface MoreProps {
  readonly onOpen: (destination: MoreDestination) => void;
}

export function More({ onOpen }: MoreProps): ReactElement {
  const owing = owingBadge(read(demoCustomers(), DEMO_TODAY));
  const desk = demoDesk();
  const owed = lensCounts(desk, DEMO_TODAY).find((c) => c.lens === 'money')?.count ?? 0;

  const rows: readonly {
    readonly id: MoreDestination;
    readonly label: string;
    readonly icon: string;
    readonly badge: number;
  }[] = [
    { id: 'customers', label: 'Customers', icon: PATH.users, badge: owing },
    { id: 'messages', label: 'Messages', icon: PATH.bubble, badge: owed },
  ];

  return (
    <div className={s.screen}>
      <header className={s.header}>
        <span className={s.title}>More</span>
      </header>
      <nav className={s.body} aria-label="More destinations">
        {rows.map((r) => (
          <button key={r.id} type="button" className={s.row} onClick={() => onOpen(r.id)}>
            <span className={s.mark}>
              <Mark d={r.icon} size={17} />
            </span>
            <span className={s.name}>{r.label}</span>
            {r.badge > 0 && <span className={s.badge}>{r.badge}</span>}
            <span className={s.chevron}>
              <Mark d={PATH.chevron} size={15} />
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
