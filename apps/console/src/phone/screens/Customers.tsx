/**
 * Customers — the phone. Frame 1b of the Customers handoff.
 *
 * **This is not the console reflowed.** The desktop is a register with six
 * columns, a 390px panel beside it and a rank chip on every row. None of
 * that is here, and none of it was cut to fit — the phone is a different
 * application answering a narrower question.
 *
 * The question is: *who do I chase, and can I do it from here?* So:
 *
 *  - the position is ONE figure in the header, with the same aging bar and a
 *    basis line, rather than four cards;
 *  - a row in the Ask first group ends in a 36px WhatsApp square, because
 *    the whole job on a phone is one tap;
 *  - rows that are not being chased end in a chevron and no button at all —
 *    a second action per row is how a thumb sends the wrong message;
 *  - the picked customer is a card at the FOOT of the list rather than a
 *    second screen, so the list never navigates away;
 *  - the quiet group collapses to one row. Seven accounts that have bought
 *    nothing in ninety days are one fact, not seven.
 *
 * Nothing here imports from `../../desktop/`. Both read `@ow/domain`, which
 * is what stops the two designs disagreeing about a debt while looking
 * nothing like each other.
 */

import { useMemo, useState, type ReactElement } from 'react';
import {
  Money,
  agingBands,
  askTheseFirst,
  balance,
  boughtOver,
  howTheyPay,
  howTheyPayShort,
  initials,
  inWords,
  marginPercent,
  match,
  oldestDebtDays,
  openInvoices,
  qualifier,
  read,
  rowNote,
  standing,
  totalOwed,
  HARD_PAST_DUE_DAYS,
  QUIET_DAYS,
  type Customer,
  type Standing,
} from '@ow/domain';
import { DEMO_TODAY, demoCustomers } from '@ow/data';
import s from './Customers.module.css';
import { Mark, PATH } from '../icons.js';

const v = (token: string): string => `var(--ow-color-${token})`;

/** Three, not the console's four. Best is a desk question. */
type Tab = 'owing' | 'all' | 'quiet';

/**
 * How many rows of "owing, still in time" the chase list carries.
 *
 * Two. The screen is for the money that needs asking for, and seven rows of
 * money that does not is seven rows between the owner's thumb and the card
 * at the foot. The rest is one tap away and says what it is worth first.
 */
const IN_TIME_SHOWN = 2;

export function Customers(): ReactElement {
  const now = DEMO_TODAY;
  const all = useMemo(() => demoCustomers(), []);
  const book = useMemo(() => read(all, now), [all, now]);

  const [tab, setTab] = useState<Tab>('owing');
  const [showAllInTime, setShowAllInTime] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>('c-mulongo');
  const picked = all.find((c) => c.id === pickedId) ?? null;

  const bands = agingBands(book.owing, now);
  const three = askTheseFirst(book, now);
  const pastDue = totalOwed(book.pastDue);

  const ask = [...book.pastDue].sort((a, b) => askFirst(a, b, now));
  const inTime = [...book.inTime].sort((a, b) => dueAt(a) - dueAt(b));
  const quiet = [...book.quiet].sort((a, b) =>
    Money.compare(boughtOver(b, now), boughtOver(a, now)),
  );

  return (
    <div className={s.screen}>
      <header className={s.head}>
        <div className={s.brand}>
          <span className={s.mark}>
            <Mark d={PATH.home} size={14} />
          </span>
          <span className={s.title}>Customers</span>
          <button type="button" className={s.glyph} aria-label="Search customers">
            <Mark d={PATH.search} size={18} />
          </button>
          <button type="button" className={s.glyph} aria-label="New customer">
            <Mark d={PATH.plus} size={18} />
          </button>
        </div>

        <div className={s.debt}>
          <div className={s.debtTop}>
            <span className={s.debtLabel}>OWED TO YOU</span>
            <span className={s.debtFig}>{Money.format(totalOwed(book.owing))}</span>
          </div>
          <div className={s.bar}>
            {bands.map((band, i) => (
              <span
                key={band.from}
                className={s.barPart}
                style={{ width: `${band.share}%`, background: AGING_FILL[i] }}
              />
            ))}
          </div>
          <div className={s.debtBasis}>
            {Money.formatMillions(pastDue, 2)} of it past due · {three.share}% sits with{' '}
            {inWords(three.customers.length)} accounts
          </div>
        </div>

        <div className={s.tabs} role="tablist" aria-label="Which customers">
          <Tabs
            tab={tab}
            onPick={setTab}
            counts={{ owing: book.owing.length, all: all.length, quiet: book.quiet.length }}
          />
        </div>
      </header>

      <div className={s.list}>
        {tab === 'owing' && (
          <>
            <Band
              chip={`Ask first ${ask.length}`}
              tone="bad"
              reads={Money.format(pastDue)}
              figure
            />
            {ask.map((c) => (
              <ChaseRow key={c.id} customer={c} now={now} book={book} onPick={setPickedId} />
            ))}

            <Band
              chip={`Owing, in time ${inTime.length}`}
              tone="neutral"
              reads={Money.format(totalOwed(book.inTime))}
              figure
            />
            {(showAllInTime ? inTime : inTime.slice(0, IN_TIME_SHOWN)).map((c) => (
              <WaitRow key={c.id} customer={c} now={now} onPick={setPickedId} />
            ))}
            {/* Capped, and it says what it cut and what that is worth. A list
                that quietly stops is a list you cannot trust the top of. */}
            {!showAllInTime && inTime.length > IN_TIME_SHOWN && (
              <button type="button" className={s.more} onClick={() => setShowAllInTime(true)}>
                {inTime.length - IN_TIME_SHOWN} more, none of it due yet ·{' '}
                <span className={s.moreFig}>
                  {Money.format(totalOwed(inTime.slice(IN_TIME_SHOWN)))}
                </span>
              </button>
            )}

            <Band
              chip={`Gone quiet ${quiet.length}`}
              tone="warn"
              reads={`nothing in ${QUIET_DAYS} days`}
              figure={false}
            />
            <QuietRow customers={quiet} now={now} onPick={setPickedId} />
          </>
        )}

        {tab === 'all' && (
          <>
            <Band
              chip={`All ${all.length}`}
              tone="neutral"
              reads={`${Money.format(totalOwed(book.owing))} owed`}
              figure
            />
            {[...all]
              .sort((a, b) => Money.compare(boughtOver(b, now), boughtOver(a, now)))
              .slice(0, 40)
              .map((c) => (
                <WaitRow key={c.id} customer={c} now={now} onPick={setPickedId} />
              ))}
            <p className={s.cut}>
              Showing 40 of {all.length}, the biggest buyers first. Search for the rest.
            </p>
          </>
        )}

        {tab === 'quiet' && (
          <>
            <Band
              chip={`Gone quiet ${quiet.length}`}
              tone="warn"
              reads={`bought ${Money.formatMillions(
                Money.add(...quiet.map((c) => boughtOver(c, now))),
              )} before`}
              figure={false}
            />
            {quiet.map((c) => (
              <WaitRow key={c.id} customer={c} now={now} onPick={setPickedId} />
            ))}
          </>
        )}

        {picked !== null && (
          <div className={s.pickedWrap}>
            <Picked customer={picked} />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rows                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A row in the Ask first group: the amount, how they pay, and the chase.
 *
 * The WhatsApp square is 36px inside a 44px row, and it is the only button
 * on the row. Tapping anywhere else raises the card at the foot.
 */
function ChaseRow({
  customer,
  now,
  book,
  onPick,
}: {
  readonly customer: Customer;
  readonly now: Date;
  readonly book: ReturnType<typeof read>;
  readonly onPick: (id: string) => void;
}): ReactElement {
  const where = standing(customer, now);
  const mark = qualifier(customer, book, now);
  const age = oldestDebtDays(customer, now);
  const reading = howTheyPayShort(customer, where);

  return (
    <div className={s.row}>
      <button type="button" className={s.rowOpen} onClick={() => onPick(customer.id)}>
        <span className={s.avatar} style={AVATAR[avatarTone(customer, where)]}>
          {initials(customer.name)}
        </span>
        <span className={s.identity}>
          <span className={s.name}>{customer.name}</span>
          <span className={s.marks}>
            {mark !== null && (
              <span className={s.pill} style={TONE[mark.tone]}>
                {mark.pill}
              </span>
            )}
            <span className={`${s.days} ${s[ageTone(customer, where, now)] ?? ''}`}>
              {match(age, {
                known: (d) => `${d} days`,
                partial: (d) => `${d} days`,
                unavailable: () => 'no debt',
              })}
            </span>
          </span>
        </span>
        <span className={s.amount}>
          <span className={`${s.amountFig} ${s.amountBad}`}>
            {Money.format(balance(customer))}
          </span>
          <span className={s.amountReads}>
            {match(reading, {
              known: (w) => w,
              partial: (w) => w,
              unavailable: () => '—',
            })}
          </span>
        </span>
      </button>
      {/* One tap. The chase is the whole reason this group is at the top. */}
      <button
        type="button"
        className={s.chaseSquare}
        aria-label={`Chase ${customer.name} on WhatsApp for ${Money.format(balance(customer))}`}
      >
        <Mark d={PATH.message} size={17} />
      </button>
    </div>
  );
}

/** A row that is not being chased: what it is, what it is worth, a chevron. */
function WaitRow({
  customer,
  now,
  onPick,
}: {
  readonly customer: Customer;
  readonly now: Date;
  readonly onPick: (id: string) => void;
}): ReactElement {
  const where = standing(customer, now);
  const owes = balance(customer);
  const reading = howTheyPay(customer, where);
  const note = rowNote(customer, where, now);
  const pays = match(reading, {
    known: (w) => w,
    partial: (w) => w,
    unavailable: () => '',
  });

  return (
    <button type="button" className={s.rowFlat} onClick={() => onPick(customer.id)}>
      <span className={s.avatar} style={AVATAR.neutral}>
        {initials(customer.name)}
      </span>
      <span className={s.identity}>
        <span className={s.name}>{customer.name}</span>
        <span className={s.note}>
          {pays === '' ? note : `${firstClause(note)} · ${pays}`}
        </span>
      </span>
      {!Money.isZero(owes) && <span className={s.amountFlat}>{Money.format(owes)}</span>}
      <Mark d={PATH.chevron} size={15} />
    </button>
  );
}

/**
 * Seven accounts that have gone quiet, as one row.
 *
 * The frame draws "Rashid Ssemakula · 6 more", and it is right: a list of
 * seven names nobody is going to call this morning is seven rows of scroll
 * between the owner and the card at the foot. The Quiet tab opens them.
 */
function QuietRow({
  customers,
  now,
  onPick,
}: {
  readonly customers: readonly Customer[];
  readonly now: Date;
  readonly onPick: (id: string) => void;
}): ReactElement | null {
  const first = customers[0];
  if (first === undefined) return null;
  const rest = customers.length - 1;

  return (
    <button type="button" className={`${s.rowFlat} ${s.rowQuiet}`} onClick={() => onPick(first.id)}>
      <span className={s.avatar} style={AVATAR.neutral}>
        {initials(first.name)}
      </span>
      <span className={s.identity}>
        <span className={s.name}>
          {first.name}
          {rest > 0 ? ` · ${rest} more` : ''}
        </span>
        <span className={s.note}>
          {boughtMonthlyReads(first, now)} · bought{' '}
          {Money.formatMillions(Money.add(...customers.map((c) => boughtOver(c, now))))} before
        </span>
      </span>
      <Mark d={PATH.chevron} size={15} />
    </button>
  );
}

/** "last bought 4 Jun · was monthly" → "was monthly". */
const boughtMonthlyReads = (c: Customer, now: Date): string => {
  const note = rowNote(c, 'quiet', now);
  return note.split(' · ')[1] ?? note;
};

/** "due 28 Sep · 2 invoices" → "due 28 Sep". The pays reading takes the rest. */
const firstClause = (note: string): string => note.split(' · ')[0] ?? note;

/* -------------------------------------------------------------------------- */
/*  The picked customer                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A card at the foot of the list, not a second screen.
 *
 * Three figures and two actions at 44px. Everything the console's panel has
 * and this does not — the invoice breakdown, the drift check, the product
 * mix, the five months — is reading, and reading is a desk job. The phone
 * gets what a person standing in a yard needs in order to act.
 */
function Picked({ customer }: { readonly customer: Customer }): ReactElement {
  const margin = marginPercent(customer);
  const blocked = openInvoices(customer).length > 0 && isOverLimit(customer);

  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <span className={`${s.avatar} ${s.avatarSmall}`} style={RANK_FIRST}>
          {initials(customer.name)}
        </span>
        <span className={s.cardName}>{customer.name}</span>
        {blocked && <span className={s.onNavyChip}>over limit</span>}
      </div>

      <div className={s.cardFigures}>
        <div className={s.cardFigure}>
          <div className={s.cardLabel}>Owes</div>
          <div className={`${s.cardFig} ${s.cardFigBad}`}>{Money.format(balance(customer))}</div>
        </div>
        <div className={s.cardFigure}>
          <div className={s.cardLabel}>Limit</div>
          <div className={s.cardFig}>
            {customer.creditLimit === null ? 'none' : Money.format(customer.creditLimit)}
          </div>
        </div>
        <div className={s.cardFigureRight}>
          <div className={s.cardLabel}>Margin</div>
          <div className={`${s.cardFig} ${s.cardFigWarn}`}>
            {match(margin, {
              known: (pct) => `${pct}%`,
              partial: (pct) => `${pct}%`,
              // Absence is not zero: a margin with no cost behind it is not 0%.
              unavailable: () => 'not on file',
            })}
          </div>
        </div>
      </div>

      <div className={s.cardActions}>
        {/* The one accent-filled control on this screen. */}
        <button type="button" className={s.chase}>
          <Mark d={PATH.message} size={16} />
          Draft the chase
        </button>
        <button type="button" className={s.secondary}>
          Statement
        </button>
      </div>
    </div>
  );
}

const isOverLimit = (c: Customer): boolean =>
  c.creditLimit !== null && Money.compare(balance(c), c.creditLimit) > 0;

/* -------------------------------------------------------------------------- */
/*  Chrome                                                                    */
/* -------------------------------------------------------------------------- */

function Tabs({
  tab,
  onPick,
  counts,
}: {
  readonly tab: Tab;
  readonly onPick: (t: Tab) => void;
  readonly counts: Record<Tab, number>;
}): ReactElement {
  const items: readonly { readonly id: Tab; readonly label: string }[] = [
    { id: 'owing', label: 'Owing' },
    { id: 'all', label: 'All' },
    { id: 'quiet', label: 'Quiet' },
  ];
  return (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className={`${s.tab} ${tab === item.id ? s.tabOn : ''}`}
          onClick={() => onPick(item.id)}
        >
          {item.label} <span className={s.tabCount}>{counts[item.id]}</span>
        </button>
      ))}
    </>
  );
}

function Band({
  chip,
  tone,
  reads,
  figure,
}: {
  readonly chip: string;
  readonly tone: 'bad' | 'warn' | 'neutral';
  readonly reads: string;
  readonly figure: boolean;
}): ReactElement {
  return (
    <div className={s.band}>
      <span className={s.pill} style={TONE[tone]}>
        {chip}
      </span>
      <span className={figure ? s.bandFig : s.bandWords}>{reads}</span>
    </div>
  );
}

function avatarTone(c: Customer, where: Standing): 'bad' | 'warn' | 'neutral' {
  if (where !== 'past-due') return 'neutral';
  return openInvoices(c).some((inv) => !Money.isZero(inv.received)) ? 'warn' : 'bad';
}

function ageTone(c: Customer, where: Standing, now: Date): 'daysBad' | 'daysWarn' | 'daysCalm' {
  if (where !== 'past-due') return 'daysCalm';
  const worst = openInvoices(c).reduce((most, inv) => {
    const over =
      inv.dueOn === null ? 0 : Math.floor((now.getTime() - inv.dueOn.getTime()) / 86_400_000);
    return Math.max(most, over);
  }, 0);
  return worst > HARD_PAST_DUE_DAYS ? 'daysBad' : 'daysWarn';
}

/** The console's ask order, read again here. Two designs, one ranking. */
function askFirst(a: Customer, b: Customer, now: Date): number {
  const blocked = Number(isOverLimit(b)) - Number(isOverLimit(a));
  if (blocked !== 0) return blocked;
  const score = (c: Customer): number => {
    const d = oldestDebtDays(c, now);
    return Number(balance(c)) * (d.status === 'unavailable' ? 0 : d.value);
  };
  return score(b) - score(a);
}

function dueAt(c: Customer): number {
  let soonest = Number.POSITIVE_INFINITY;
  for (const inv of openInvoices(c)) {
    if (inv.dueOn !== null) soonest = Math.min(soonest, inv.dueOn.getTime());
  }
  return soonest;
}

const TONE = {
  bad: { background: v('bad-chip'), color: v('bad-ink') },
  warn: { background: v('warn-fill'), color: v('warn-ink') },
  info: { background: v('info-chip'), color: v('info-ink') },
  neutral: { background: v('neutral-chip'), color: v('neutral-ink') },
} as const;

const AVATAR = {
  bad: { background: v('bad-chip'), color: v('bad-ink') },
  warn: { background: v('warn-fill'), color: v('warn-ink') },
  neutral: { background: v('neutral-chip'), color: v('neutral-ink') },
} as const;

const RANK_FIRST = { background: v('accent-mark'), color: v('on-fill') } as const;

/**
 * The same four bands as the console, except the last.
 *
 * On white, debt under thirty days is pale clay. On the navy header it has
 * to be white at 22% instead: no flat token can let the navy through, and a
 * clay band on navy reads as a fifth colour rather than the quiet end of
 * the same ramp.
 */
const AGING_FILL = [
  v('accent-mark'),
  v('accent'),
  v('debt-mid'),
  'rgba(255, 255, 255, 0.22)',
] as const;
