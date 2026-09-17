import { useState, type ReactElement } from 'react';
import s from './Rail.module.css';
import { Icon, type IconName } from '../icons.js';

export interface Destination {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  /** A tally. Quiet — Plex Mono, rail ink. */
  readonly count?: number;
  /** A count that means something wants you. A pill, not a number. */
  readonly badge?: number;
  /** A badge that is a caution rather than a demand. */
  readonly badgeTone?: 'warn';
}

export interface Section {
  readonly name: string;
  /** The two-letter mark in the section's chip. */
  readonly abbr: string;
  readonly chip: string;
  readonly chipInk: string;
  readonly items: readonly Destination[];
  /** Only Sell. Every frame in `Rail.dc.html` and in `Quote.dc.html` 4a
   * opens Sell and shuts the rest; the fold is then the person's own. */
  readonly openAtRest: boolean;
}

/**
 * **The rail is the complete map.**
 *
 * `Rail.dc.html` is the authority on navigation — the Quote handoff says so
 * in those words — and it settles two things the Today handoff left open.
 *
 * **Sell changed.** A quote is no longer saved into a list of its own:
 * *Save quote* hands it to Order tracking at the stage *Taken*. So
 * `Saved quotes` and `Follow-ups` are gone, `WhatsApp` is now `Messages`,
 * and `Order tracking` is the second row.
 *
 * **A section shows its count only when it is SHUT.** Open, the rows are
 * the count and a chevron beside them says nothing the rows do not. Shut,
 * both appear, so the fold is never a place things go to be forgotten.
 */
export const TODAY: Destination = { id: 'today', label: 'Today', icon: 'sunrise', badge: 8 };

export const SECTIONS: readonly Section[] = [
  {
    name: 'Sell',
    abbr: 'Se',
    chip: 'var(--ow-color-sell-chip)',
    chipInk: 'var(--ow-color-sell-chip-ink)',
    openAtRest: true,
    items: [
      { id: 'quote', label: 'New quote', icon: 'tag' },
      { id: 'orders', label: 'Order tracking', icon: 'truck', badge: 5 },
      { id: 'invoices', label: 'Invoices', icon: 'file-text', badge: 4 },
      { id: 'customers', label: 'Customers', icon: 'users', badge: 11 },
      { id: 'messages', label: 'Messages', icon: 'message-square', badge: 13 },
      // The mark is the one the file draws — a parcel, for the person who
      // carries the goods, not a second pair of shoulders beside Customers.
      { id: 'agents', label: 'Sales agents', icon: 'package' },
    ],
  },
  {
    name: 'Buy',
    abbr: 'Bu',
    chip: 'var(--ow-color-buy-chip)',
    chipInk: 'var(--ow-color-buy-chip-ink)',
    openAtRest: false,
    items: [
      { id: 'compare', label: 'Compare prices', icon: 'scale' },
      { id: 'sourcing', label: 'Sourcing', icon: 'search' },
      { id: 'suppliers', label: 'Suppliers', icon: 'truck' },
      { id: 'purchase-analytics', label: 'Purchase analytics', icon: 'bar-chart-3' },
    ],
  },
  {
    name: 'Catalogue',
    abbr: 'Ca',
    chip: 'var(--ow-color-catalogue-chip)',
    chipInk: 'var(--ow-color-catalogue-chip-ink)',
    openAtRest: false,
    items: [
      { id: 'products', label: 'Products', icon: 'package' },
      { id: 'pricing', label: 'Pricing', icon: 'tag', badge: 14 },
      { id: 'inventory', label: 'Inventory', icon: 'layers' },
      { id: 'goes-with', label: 'What goes with what', icon: 'layout-grid' },
    ],
  },
  {
    name: 'Money',
    abbr: 'Mo',
    chip: 'var(--ow-color-money-chip)',
    chipInk: 'var(--ow-color-money-chip-ink)',
    openAtRest: false,
    items: [
      { id: 'cashbook', label: 'Cash book', icon: 'wallet' },
      { id: 'debtors', label: 'Debtors', icon: 'trending-down', badge: 9 },
      { id: 'creditors', label: 'Creditors', icon: 'credit-card' },
      { id: 'statements', label: 'Statements', icon: 'file-text' },
      { id: 'payroll', label: 'Payroll & rent', icon: 'users' },
      { id: 'assets', label: 'Assets & loans', icon: 'warehouse' },
    ],
  },
  {
    name: 'Insight',
    abbr: 'In',
    chip: 'var(--ow-color-insight-chip)',
    chipInk: 'var(--ow-color-insight-chip-ink)',
    openAtRest: false,
    items: [
      { id: 'analytics', label: 'Sales analytics', icon: 'line-chart' },
      { id: 'map', label: 'Map', icon: 'map-pin' },
      { id: 'forecasts', label: 'Forecasts', icon: 'activity' },
    ],
  },
  {
    name: 'Setup',
    abbr: 'Su',
    chip: 'var(--ow-color-setup-chip)',
    chipInk: 'var(--ow-color-setup-chip-ink)',
    openAtRest: false,
    items: [
      { id: 'staff', label: 'Staff', icon: 'users' },
      { id: 'worker', label: 'Worker view', icon: 'clock' },
      { id: 'shop', label: 'The shop', icon: 'store' },
    ],
  },
];

export interface RailProps {
  readonly current: string;
  readonly onNavigate: (id: string) => void;
}

export function Rail({ current, onNavigate }: RailProps): ReactElement {
  const [folded, setFolded] = useState<ReadonlySet<string>>(
    () => new Set(SECTIONS.filter((x) => !x.openAtRest).map((x) => x.name)),
  );

  const toggle = (name: string): void =>
    setFolded((prior) => {
      const next = new Set(prior);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <nav className={s.rail} aria-label="Sections">
      <div className={s.brand}>
        <span className={s.mark}>
          <Icon name="warehouse" size={17} />
        </span>
        <div className={s.brandText}>
          {/* A non-breaking hyphen: "Omni-Ware" must never wrap mid-name. */}
          <div className={s.appName}>Omni&#8209;Ware</div>
          <div className={s.shopName}>Ssekitoleko Hardware</div>
        </div>
      </div>

      <div className={s.scroll}>
        <Row item={TODAY} current={current} onNavigate={onNavigate} />

        {SECTIONS.map((section) => {
          const open = !folded.has(section.name);
          return (
            <div key={section.name}>
              <button
                type="button"
                className={s.section}
                aria-expanded={open}
                onClick={() => toggle(section.name)}
              >
                <span
                  className={s.sectionChip}
                  style={{ background: section.chip, color: section.chipInk }}
                  aria-hidden="true"
                >
                  {section.abbr}
                </span>
                <span className={s.sectionName}>{section.name}</span>
                {/* Open, the rows ARE the count and the chevron says nothing
                    they do not. Shut, both appear. */}
                {!open && (
                  <>
                    <span className={s.sectionCount}>{section.items.length}</span>
                    <Icon name="chevron-down" size={13} className={s.sectionCaret} />
                  </>
                )}
              </button>
              {open &&
                section.items.map((item) => (
                  <Row key={item.id} item={item} current={current} onNavigate={onNavigate} />
                ))}
            </div>
          );
        })}
      </div>

      {/* Outside the scroll box, so it never scrolls away. */}
      <div className={s.foot}>
        <button type="button" className={s.row}>
          <Icon name="log-out" size={17} className={s.icon} />
          <span className={s.label}>Sign out</span>
        </button>
      </div>
    </nav>
  );
}

function Row({
  item,
  current,
  onNavigate,
}: {
  readonly item: Destination;
  readonly current: string;
  readonly onNavigate: (id: string) => void;
}): ReactElement {
  const on = item.id === current;
  return (
    <button
      type="button"
      className={`${s.row} ${on ? s.on : ''}`}
      aria-current={on ? 'page' : undefined}
      onClick={() => onNavigate(item.id)}
    >
      <Icon name={item.icon} size={17} className={s.icon} />
      <span className={s.label} title={item.label}>
        {item.label}
      </span>
      {/* A badge is drawn only when its number is above zero — a "0 waiting"
          pill is a demand for attention that nothing is asking for. */}
      {item.badge !== undefined && item.badge > 0 && (
        <span className={`${s.badge} ${item.badgeTone === 'warn' ? s.badgeWarn : ''}`}>
          {item.badge}
        </span>
      )}
      {item.badge === undefined && item.count !== undefined && item.count > 0 && (
        <span className={s.count}>{item.count}</span>
      )}
    </button>
  );
}
