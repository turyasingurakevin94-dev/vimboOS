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
  /** Sell, Buy, Money and Insight are open at rest. */
  readonly openAtRest: boolean;
}

/**
 * **The rail is the complete map.**
 *
 * The design file shows it abridged to fit a screenshot; the handoff is
 * explicit that the real one carries every destination, and that nothing may
 * go behind a hover or a click. Sections may fold — and a folded section
 * still shows its count, so the fold is not a place things go to be
 * forgotten.
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
      { id: 'saved-quotes', label: 'Saved quotes', icon: 'bookmark', count: 8 },
      { id: 'invoices', label: 'Invoices', icon: 'file-text', count: 20 },
      { id: 'customers', label: 'Customers', icon: 'users' },
      { id: 'agents', label: 'Sales agents', icon: 'users' },
      { id: 'whatsapp', label: 'WhatsApp', icon: 'message-circle', badge: 13 },
      { id: 'followups', label: 'Follow-ups', icon: 'inbox', badge: 6 },
    ],
  },
  {
    name: 'Buy',
    abbr: 'Bu',
    chip: 'var(--ow-color-buy-chip)',
    chipInk: 'var(--ow-color-buy-chip-ink)',
    openAtRest: true,
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
      { id: 'prices', label: 'Prices', icon: 'tag' },
      { id: 'inventory', label: 'Inventory', icon: 'layers', badge: 3, badgeTone: 'warn' },
      { id: 'fasteners', label: 'Fasteners', icon: 'layout-grid' },
      { id: 'media', label: 'Media', icon: 'image' },
    ],
  },
  {
    name: 'Money',
    abbr: 'Mo',
    chip: 'var(--ow-color-money-chip)',
    chipInk: 'var(--ow-color-money-chip-ink)',
    openAtRest: true,
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
    openAtRest: true,
    items: [
      { id: 'analytics', label: 'Sales analytics', icon: 'line-chart' },
      { id: 'map', label: 'Map', icon: 'map-pin' },
      { id: 'forecasts', label: 'Forecasts', icon: 'activity' },
    ],
  },
  {
    name: 'Setup',
    abbr: 'Su',
    chip: 'var(--ow-color-neutral-chip)',
    chipInk: 'var(--ow-color-neutral-ink)',
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
                <span className={s.sectionCount}>{section.items.length}</span>
                <Icon
                  name="chevron-down"
                  size={14}
                  className={`${s.sectionCaret} ${open ? s.sectionCaretOpen : ''}`}
                />
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
