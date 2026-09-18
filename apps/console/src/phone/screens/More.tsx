/**
 * More — the one piece of navigation no frame draws.
 *
 * The Customers phone frames, every Messages phone frame and the Agents 1b
 * frame all draw the tab bar with **More** lit, so all three screens are
 * reached through it and all three are built. Five tabs cannot hold seven
 * destinations, so this stands between the tab and them until the real sheet
 * exists.
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
import { useRegister } from '../../app/useRegister.js';
import { useDesk } from '../../app/useDesk.js';
import s from './More.module.css';
import { Mark, PATH } from '../icons.js';

export type MoreDestination = 'customers' | 'messages' | 'agents';

export interface MoreProps {
  readonly onOpen: (destination: MoreDestination) => void;
}

export function More({ onOpen }: MoreProps): ReactElement {
  /**
   * The same books the screens behind these rows read.
   *
   * This list used to count demo rows while Customers and Messages had gone
   * live, so the sheet promised eleven accounts owing and the screen it
   * opened showed the shop's own number. A badge that disagrees with the
   * screen it leads to is worse than no badge: it is the list inventing an
   * obligation, which is the drift the note below already refuses.
   *
   * No count is shown until the books answer. A badge is a claim about how
   * much wants you, and "not read yet" is not a quantity.
   */
  const register = useRegister();
  const desk = useDesk();

  const owing =
    register.at === 'ready' ? owingBadge(read(register.data.customers, register.today)) : null;
  const owed =
    desk.at === 'ready'
      ? (lensCounts(desk.data.desk, desk.today).find((c) => c.lens === 'money')?.count ?? 0)
      : null;

  const rows: readonly {
    readonly id: MoreDestination;
    readonly label: string;
    readonly icon: string;
    /** `null` until the books have answered — not zero. */
    readonly badge: number | null;
  }[] = [
    { id: 'customers', label: 'Customers', icon: PATH.users, badge: owing },
    { id: 'messages', label: 'Messages', icon: PATH.bubble, badge: owed },
    /**
     * No badge, because the rail draws none on Sales agents. Two agents are
     * behind on settlement and the screen says so the moment you arrive —
     * but a badge here that the rail does not draw would be this list
     * inventing an obligation count, which is the drift the rest of this
     * file exists to avoid.
     */
    { id: 'agents', label: 'Sales agents', icon: PATH.box, badge: 0 },
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
            {r.badge !== null && r.badge > 0 && <span className={s.badge}>{r.badge}</span>}
            <span className={s.chevron}>
              <Mark d={PATH.chevron} size={15} />
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
