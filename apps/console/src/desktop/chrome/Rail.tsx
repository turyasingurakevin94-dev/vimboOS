import type { ReactElement } from 'react';
import s from './Rail.module.css';
import { Icon, type IconName } from '../icons.js';

export interface RailItem {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  /** A count worth showing in the rail. Omit rather than showing a zero. */
  readonly count?: number;
  /** The count is something the owner is behind on, not just a tally. */
  readonly alert?: boolean;
}

export interface RailGroup {
  readonly label: string;
  readonly items: readonly RailItem[];
}

/**
 * The console's navigation, grouped by the question being asked rather than
 * by the table being read. The old app had 35 flat tabs, which meant finding
 * anything was a scan of all 35 — "Analytics · Debtors" sat eleven rows away
 * from "Cashbook" and they are the same question.
 */
export const GROUPS: readonly RailGroup[] = [
  {
    label: 'Work',
    items: [
      { id: 'today', label: 'Today', icon: 'sunrise' },
      { id: 'orders', label: 'Orders', icon: 'clipboard', count: 12 },
      { id: 'quotes', label: 'Quotes', icon: 'tag', count: 4 },
    ],
  },
  {
    label: 'Sell',
    items: [
      { id: 'customers', label: 'Customers', icon: 'people' },
      { id: 'agents', label: 'Agents', icon: 'route' },
      { id: 'debtors', label: 'Owed to us', icon: 'coin-in', count: 7, alert: true },
    ],
  },
  {
    label: 'Buy',
    items: [
      { id: 'suppliers', label: 'Suppliers', icon: 'truck' },
      { id: 'purchases', label: 'Purchases', icon: 'invoice' },
      { id: 'sourcing', label: 'Sourcing', icon: 'search' },
    ],
  },
  {
    label: 'Stock',
    items: [
      { id: 'inventory', label: 'Inventory', icon: 'boxes', count: 3, alert: true },
      { id: 'products', label: 'Products', icon: 'sheets' },
      { id: 'prices', label: 'Prices', icon: 'scales' },
    ],
  },
  {
    label: 'Money',
    items: [
      { id: 'cashbook', label: 'Cashbook', icon: 'book' },
      { id: 'payroll', label: 'Payroll', icon: 'wallet' },
      { id: 'loans', label: 'Loans', icon: 'bank' },
    ],
  },
];

export interface RailProps {
  readonly current: string;
  readonly onNavigate: (id: string) => void;
}

export function Rail({ current, onNavigate }: RailProps): ReactElement {
  return (
    <nav className={s.rail} aria-label="Sections">
      <div className={s.brand}>
        <span className={s.mark} aria-hidden="true">
          O
        </span>
        <span className={s.wordmark}>Omni-Ware</span>
      </div>

      <div className={s.scroll}>
        {GROUPS.map((group) => (
          <div className={s.group} key={group.label}>
            <div className={s.groupLabel}>{group.label}</div>
            {group.items.map((item) => {
              const active = item.id === current;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${s.item} ${active ? s.active : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  <Icon name={item.icon} className={s.icon} />
                  <span className={s.label} title={item.label}>
                    {item.label}
                  </span>
                  {item.count !== undefined && (
                    <span
                      className={`${s.count} ${item.alert === true ? s.countAlert : ''}`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
