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
 *
 * ## The map the Customers handoff settles
 *
 * Twenty-three rows in six groups, plus Today — from thirty-three. The two
 * cuts this turn are the same cut twice: **Debtors** is Customers with a
 * filter on it and **Creditors** is Suppliers with a filter on it, so both
 * become lenses and their rows go. Compare prices folds into Pricing and
 * Purchase analytics into Analysis. Sell 6 · Buy 2 · Catalogue 4 · Money 4 ·
 * Insight 4 · Setup 3.
 *
 * **A badge counts obligations only.** Eight rows carry one — Today 8, Order
 * tracking 5, Invoices 4, Customers 11, Messages 13, Sourcing 14, Suppliers
 * 5, Pricing 14. Inventory's under-floor lines and Forecasts' buy
 * suggestions are the plan's ADVICE, and a badge on advice teaches people to
 * ignore badges.
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
      { id: 'sourcing', label: 'Sourcing', icon: 'search', badge: 14 },
      // Creditors folds in as the You owe lens, the same cut as Debtors and
      // for the same reason: a creditor is a supplier with a balance.
      { id: 'suppliers', label: 'Suppliers', icon: 'truck', badge: 5 },
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
      // Debtors is gone. It was Customers with a filter on it, and the two
      // had to be re-rendered together after every void and every payment.
      // `resolveTab` keeps the words pointing here.
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
      { id: 'forecasts', label: 'Forecasts', icon: 'activity' },
      { id: 'analysis', label: 'Analysis', icon: 'line-chart' },
      { id: 'manager', label: 'Manager', icon: 'message-circle' },
      { id: 'map', label: 'Map', icon: 'map-pin' },
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

/**
 * The words that used to reach a destination, pointing at the one that
 * absorbed it.
 *
 * Cutting a screen is not finished when its row is deleted. Somebody types
 * "debtors" into the search field because that is what the thing has been
 * called for three years, and a cut that leaves them with no results has
 * taken a screen away and given nothing back. Every word listed here reached
 * something yesterday.
 *
 * `debtors` resolves to Customers, which opens on its Owing lens — the lens
 * is armed by default whenever the badge is above zero, so the word lands on
 * exactly the list it used to name.
 */
const KEYWORDS: readonly (readonly [string, string])[] = [
  ['debtors', 'customers'],
  ['who owes me', 'customers'],
  ['owing', 'customers'],
  ['aging', 'customers'],
  ['ageing', 'customers'],
  ['receivables', 'customers'],
  ['credit', 'customers'],
  ['creditors', 'suppliers'],
  ['we owe', 'suppliers'],
  ['payables', 'suppliers'],
  ['compare prices', 'pricing'],
  ['rivals', 'pricing'],
  ['purchase analytics', 'analysis'],
  ['sales analytics', 'analysis'],
  ['whatsapp', 'messages'],
  ['follow-ups', 'messages'],
  ['media', 'products'],
  ['photos', 'products'],
  ['consignment', 'inventory'],
  // Commissions was a screen until this pass. Its four words reach Agents,
  // where the figures it existed to compare now live on the agent panel.
  ['commission', 'agents'],
  ['commissions', 'agents'],
  ['bonus', 'agents'],
  ['earnings', 'agents'],
  ['payout', 'agents'],
  ['sales agent', 'agents'],
];

/**
 * The words that should land on the commission block rather than the top of
 * Agents.
 *
 * Cutting Commissions is only finished if typing "payout" puts the payout in
 * front of the person who typed it. `resolveTab` says WHICH screen; this says
 * WHERE on it, and the screen scrolls its bonus block into view.
 */
const BONUS_WORDS = ['commission', 'bonus', 'earnings', 'payout'] as const;

/** Whether a typed phrase was asking for the commission figures. */
export const asksForBonus = (query: string): boolean => {
  const q = query.trim().toLowerCase();
  return q !== '' && BONUS_WORDS.some((word) => q.includes(word));
};

/**
 * Which destination a typed phrase reaches, or `null` for none.
 *
 * Destination labels first, so "Invoices" always beats a keyword; then the
 * keyword table, longest phrase first, so "who owes me" is not swallowed by
 * a shorter entry that happens to appear earlier.
 */
export function resolveTab(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (q === '') return null;

  const destinations: readonly Destination[] = [
    TODAY,
    ...SECTIONS.flatMap((section) => section.items),
  ];
  const named = destinations.find((d) => d.label.toLowerCase() === q);
  if (named !== undefined) return named.id;

  const keyed = [...KEYWORDS]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([word]) => q.includes(word));
  if (keyed !== undefined) return keyed[1];

  const partial = destinations.find((d) => d.label.toLowerCase().includes(q));
  return partial?.id ?? null;
}

export interface RailProps {
  readonly current: string;
  readonly onNavigate: (id: string) => void;
  /**
   * Counts that come from the books, by destination id, replacing the
   * literal above.
   *
   * The literals in `SECTIONS` are the frame's, and they stand in for
   * screens that have not been built yet. A screen that HAS been built owns
   * its own count and hands it here — the Customers handoff is explicit
   * that "every figure shown twice — the rail badge, the strip, the panel —
   * must come from one reckoning", and a rail saying 11 beside a list
   * showing nine is the drift this whole rewrite is about.
   */
  readonly badges?: Readonly<Record<string, number>>;
}

export function Rail({ current, onNavigate, badges }: RailProps): ReactElement {
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
          {/* A shop with a door, per `Rail.dc.html`. */}
          <Icon name="home" size={17} />
        </span>
        <div className={s.brandText}>
          {/* A non-breaking hyphen: "Omni-Ware" must never wrap mid-name. */}
          <div className={s.appName}>Omni&#8209;Ware</div>
          <div className={s.shopName}>Ssekitoleko Hardware</div>
        </div>
      </div>

      <div className={s.scroll}>
        <Row item={withBadge(TODAY, badges)} current={current} onNavigate={onNavigate} />

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
                  <Row
                    key={item.id}
                    item={withBadge(item, badges)}
                    current={current}
                    onNavigate={onNavigate}
                  />
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

/** A live count wins over the frame's literal; absence leaves it alone. */
function withBadge(
  item: Destination,
  badges: Readonly<Record<string, number>> | undefined,
): Destination {
  const live = badges?.[item.id];
  return live === undefined ? item : { ...item, badge: live };
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
