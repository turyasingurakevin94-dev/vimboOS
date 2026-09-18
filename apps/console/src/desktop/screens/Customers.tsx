/**
 * Customers — the desktop console. Frame 1a of the Customers handoff.
 *
 * ## Debtors is a lens here, not a screen
 *
 * The cut this screen makes: a debtor is a customer with a balance, so there
 * is one list with an **Owing** lens rather than two lists that have to be
 * re-rendered together. Everything drawn here reads
 * `@ow/domain/customers` — the strip, the group bands, the rank chips, the
 * panel and the panel's own drift check — so no two of them can disagree
 * about the same debt, which is precisely what the old pair did after every
 * void and every payment.
 *
 * ## The point of the screen is the third column
 *
 * `Owes` says how much. `How they pay` says whether it comes back, and it is
 * the reason the rows are not simply sorted by amount: 2,640,000 from an
 * account that has never gone a month late is a different morning from
 * 2,410,000 from one that has stopped answering. The bar is the share of
 * their MONEY that arrived on time, late and very late; the sentence under
 * it counts invoices. Two facts, not one ratio drawn twice.
 *
 * ## The accent is on Draft the chase, once
 *
 * The `1st` chip wears the same coral as a mark rather than a control — see
 * `accentMark` in the palette. There is one thing to press.
 */

import { useMemo, useState, type ReactElement } from 'react';
import {
  agingBands,
  type AskOrder,
  askTheseFirst,
  balance,
  best,
  boughtOver,
  type Customer,
  type CustomerInvoice,
  dayAndMonth,
  HARD_PAST_DUE_DAYS,
  hasPayHistory,
  howTheyPay,
  initials,
  isQuietMonth,
  ledgerAgrees,
  marginPercent,
  marginReading,
  match,
  Money,
  oldestDebtDays,
  openInvoices,
  ORDER_READS,
  overLimit,
  overLimitBy,
  owedOn,
  payBands,
  paysWithoutChasing,
  promiseReading,
  promisesOf,
  qualifier,
  QUIET_DAYS,
  quietReading,
  read,
  rowNote,
  sinceReads,
  sortBy,
  standing,
  type Standing,
  totalOwed,
} from '@ow/domain';
import { DEMO_SHOP_MARGIN } from '@ow/data';
import { useRegister } from '../../app/useRegister.js';
import s from './Customers.module.css';
import { Icon } from '../icons.js';

const v = (token: string): string => `var(--ow-color-${token})`;

/** The four lenses, in the frame's order. Owing is armed by default. */
type Lens = 'owing' | 'all' | 'best' | 'quiet';

/** How many of the best accounts the Best lens holds. */
const BEST = 20;

export function Customers(): ReactElement {
  // Not `read` — that name belongs to the domain's book reckoning imported
  // above, which the register below calls.
  const got = useRegister();
  if (got.at === 'loading') return <Bare say="Reading the accounts…" />;
  if (got.at === 'failed') return <Bare say={`The accounts could not be read. ${got.why}`} />;
  return <Register got={got} />;
}

/**
 * The header with no figures under it.
 *
 * Reading and refused share a shape because they share a problem: there is
 * no register yet, and a zero owed would be a claim that nobody owes
 * anything — the one claim this screen must never make by accident.
 */
function Bare({ say }: { readonly say: string }): ReactElement {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <h1>Customers</h1>
        <p className={s.sub}>{say}</p>
      </header>
    </div>
  );
}

function Register({
  got,
}: {
  readonly got: Extract<ReturnType<typeof useRegister>, { at: 'ready' }>;
}): ReactElement {
  const now = got.today;
  const all = got.data.customers;
  const { unreadable } = got.data;
  const book = useMemo(() => read(all, now), [all, now]);

  const [lens, setLens] = useState<Lens>('owing');
  const [order, setOrder] = useState<AskOrder>('ask');
  /**
   * The frame opens on Mulongo Hardware. Real books open on whoever the
   * reckoning says to ask first — carrying a mockup's account id into a
   * shop's own register would pick nobody, or worse, somebody at random.
   */
  const [pickedId, setPickedId] = useState<string>(
    got.live ? (askTheseFirst(book, now).customers[0]?.id ?? '') : 'c-mulongo',
  );

  const picked = all.find((c) => c.id === pickedId) ?? null;

  const bands = agingBands(book.owing, now);
  const three = askTheseFirst(book, now);
  const blocked = overLimit(all);
  const prompt = all.filter(paysWithoutChasing);
  const owed = totalOwed(book.owing);

  /**
   * The ask order, computed once over the past-due group and read twice —
   * by the strip's "ask these three first" and by the rank chip on each row.
   * Two rankings would be two answers to "who first".
   */
  const ranked = [...book.pastDue].sort(sortBy(order, now));
  const rankOf = new Map(ranked.map((c, i) => [c.id, i + 1]));

  const groups = groupsFor(lens, book, now, order, ranked);

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.titles}>
          <h1 className={s.title}>Customers</h1>
          <p className={s.sub}>
            {all.length} accounts · ranked by what they owe and how long they have owed it
            {/* Attached to the count it qualifies, because that is the figure
                it makes untrue, and said once rather than against a row —
                a row that would not read is exactly the row that cannot be
                named. */}
            {unreadable.length > 0 && (
              <span className={s.subNote}> · {unreadable.length} not fully readable</span>
            )}
          </p>
        </div>

        <div className={s.lenses} role="group" aria-label="Which customers">
          <LensButton
            label="Owing"
            count={book.owing.length}
            tone="bad"
            on={lens === 'owing'}
            onPick={() => setLens('owing')}
          />
          <LensButton
            label="All"
            count={all.length}
            tone="neutral"
            on={lens === 'all'}
            onPick={() => setLens('all')}
          />
          <LensButton
            label="Best"
            count={BEST}
            tone="neutral"
            on={lens === 'best'}
            onPick={() => setLens('best')}
          />
          <LensButton
            label="Gone quiet"
            count={book.quiet.length}
            tone="warn"
            on={lens === 'quiet'}
            onPick={() => setLens('quiet')}
          />
        </div>
      </header>

      <section className={s.strip} aria-label="The position">
        <div className={`${s.card} ${s.cardBad}`}>
          <div className={`${s.cardLabel} ${s.cardLabelBad}`}>Owed to you</div>
          <div className={s.cardFig}>{Money.format(owed)}</div>
          <div className={s.bar}>
            {bands.map((band, i) => (
              <span
                key={band.from}
                className={s.barPart}
                style={{ width: `${band.share}%`, background: AGING_FILL[i] }}
              />
            ))}
          </div>
          <div className={s.cardBasisBad}>{bands.map((b) => b.reads).join(' · ')}</div>
        </div>

        <div className={s.card}>
          <div className={s.cardLabel}>Ask these three first</div>
          <div className={s.cardFig}>{Money.format(three.amount)}</div>
          <div className={s.cardBasis}>
            {/* "0% of the debt sits with 0 of 142" is arithmetic nobody asked
                for. With nothing owed the card says so in words. */}
            {three.customers.length === 0
              ? `Nothing is owed by any of the ${all.length}`
              : `${three.share}% of the debt sits with ${three.customers.length} of ${all.length}`}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardLabel}>Credit out beyond limit</div>
          <div className={`${s.cardFig} ${s.cardFigWarn}`}>
            {blocked.length} {blocked.length === 1 ? 'account' : 'accounts'}
          </div>
          <div className={s.cardBasis}>
            {blocked.length === 0
              ? 'Every account is inside its agreed limit'
              : blocked.map((c) => overLimitReads(c)).join(' · ')}
          </div>
        </div>

        <div className={`${s.card} ${s.cardGood}`}>
          <div className={`${s.cardLabel} ${s.cardLabelGood}`}>Pay without chasing</div>
          <div className={`${s.cardFig} ${s.cardFigGood}`}>{prompt.length}</div>
          <div className={s.cardBasisGood}>
            of {all.length} · settle inside {7} days, every time
          </div>
        </div>
      </section>

      <div className={s.work}>
        <section className={s.list} aria-label="Who to ask first">
          <div className={s.listHead}>
            <span className={s.listTitle}>Who to ask first</span>
            <span className={s.listWhy}>{ORDER_READS[order]}</span>
            <span className={s.spacer} />
            <button
              type="button"
              className={s.ghost}
              onClick={() => setOrder(nextOrder(order))}
              title={`Sorted by ${ORDER_READS[order]}. Click for the next order.`}
            >
              <Icon name="sort" size={14} />
              Sort
            </button>
          </div>

          <div className={s.cols}>
            <span />
            <span className={s.col}>Customer</span>
            <span className={`${s.col} ${s.right}`}>Owes</span>
            <span className={`${s.col} ${s.right}`}>Oldest</span>
            <span className={s.col}>How they pay</span>
            <span className={`${s.col} ${s.right}`}>Ask</span>
          </div>

          <div className={s.rows}>
            {groups.map((group) => (
              <div key={group.name}>
                <div className={s.group}>
                  <span className={s.groupChip} style={TONE[group.tone]}>
                    {group.name}
                  </span>
                  <span className={s.groupCount}>
                    {group.customers.length} {group.customers.length === 1 ? 'account' : 'accounts'}
                  </span>
                  <span className={s.spacer} />
                  <span className={s.groupFig}>{group.reads}</span>
                </div>

                {group.customers.length === 0 && (
                  <p className={s.empty}>{group.emptyReads}</p>
                )}

                {group.customers.map((c) => (
                  <Row
                    key={c.id}
                    customer={c}
                    now={now}
                    book={book}
                    rank={rankOf.get(c.id) ?? null}
                    picked={c.id === pickedId}
                    onPick={() => setPickedId(c.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <aside className={s.panel} aria-label="The picked customer">
          {picked === null ? (
            <p className={s.empty}>Pick a customer to see what their debt is made of.</p>
          ) : (
            <Panel customer={picked} now={now} />
          )}
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  The list                                                                  */
/* -------------------------------------------------------------------------- */

interface Group {
  readonly name: string;
  readonly tone: 'bad' | 'neutral' | 'warn';
  readonly customers: readonly Customer[];
  /** What the band says on its right — money, or what the group is. */
  readonly reads: string;
  /** What stands in for the rows when there are none. */
  readonly emptyReads: string;
}

/**
 * What the list is made of under each lens.
 *
 * The Owing lens keeps the quiet group at its foot, without a total: those
 * accounts are not money to chase this morning, they are calls to make, and
 * totalling them beside the two groups above would invite the eye to add
 * three figures the strip does not add.
 *
 * ## Each group is in the order that group is FOR
 *
 * At rest, only the past-due group is in the ask order — it is the only one
 * the card header is about, because it is the only one you would ask. Money
 * that is not due yet is ordered by **when it lands**, which is the only
 * question open about it; a quiet account is ordered by **what it used to
 * buy**, because that is what makes a phone call worth making.
 *
 * Choosing a Sort replaces all three, so the control stays a promise about
 * the whole list rather than about its first band.
 */
function groupsFor(
  lens: Lens,
  book: ReturnType<typeof read>,
  now: Date,
  order: AskOrder,
  ranked: readonly Customer[],
): readonly Group[] {
  const quietReads = `bought ${Money.formatMillions(
    Money.add(...book.quiet.map((c) => boughtOver(c, now))),
  )} before, nothing in ${QUIET_DAYS} days`;

  /** Worth winning back, most first. */
  const byWorth = (a: Customer, b: Customer): number =>
    Money.compare(boughtOver(b, now), boughtOver(a, now));

  /** Soonest to land, first. An account with no terms recorded sorts last. */
  const byWhenDue = (a: Customer, b: Customer): number => dueAt(a) - dueAt(b);

  const quietGroup: Group = {
    name: 'Gone quiet',
    tone: 'warn',
    customers: [...book.quiet].sort(order === 'ask' ? byWorth : sortBy(order, now)),
    reads: quietReads,
    emptyReads: 'Nobody has gone quiet. Every account has bought inside 90 days.',
  };

  switch (lens) {
    case 'owing':
      return [
        {
          name: 'Past due',
          tone: 'bad',
          customers: ranked,
          reads: Money.format(totalOwed(book.pastDue)),
          emptyReads:
            'Nothing is past due. Every account owing you is still inside its terms — try the All lens.',
        },
        {
          name: 'Owing, still in time',
          tone: 'neutral',
          customers: [...book.inTime].sort(order === 'ask' ? byWhenDue : sortBy(order, now)),
          reads: Money.format(totalOwed(book.inTime)),
          emptyReads: 'Nobody owes you anything that is not already past due.',
        },
        quietGroup,
      ];
    case 'quiet':
      return [quietGroup];
    case 'best':
      return [
        {
          name: 'Best',
          tone: 'neutral',
          customers: best(book.all, now, BEST),
          reads: `bought ${Money.formatMillions(
            Money.add(...best(book.all, now, BEST).map((c) => boughtOver(c, now))),
          )} over 2 years`,
          emptyReads: 'Nothing has been bought yet.',
        },
      ];
    case 'all':
      return [
        {
          name: 'All customers',
          tone: 'neutral',
          customers: [...book.all].sort(sortBy(order, now)),
          reads: `${Money.format(totalOwed(book.owing))} owed across ${book.owing.length}`,
          emptyReads: 'There are no customers yet.',
        },
      ];
  }
}

/** When the soonest of an account's open invoices falls due. */
function dueAt(c: Customer): number {
  let soonest = Number.POSITIVE_INFINITY;
  for (const inv of openInvoices(c)) {
    if (inv.dueOn !== null) soonest = Math.min(soonest, inv.dueOn.getTime());
  }
  return soonest;
}

const nextOrder = (order: AskOrder): AskOrder =>
  order === 'ask' ? 'largest' : order === 'largest' ? 'oldest' : 'ask';

function Row({
  customer,
  now,
  book,
  rank,
  picked,
  onPick,
}: {
  readonly customer: Customer;
  readonly now: Date;
  readonly book: ReturnType<typeof read>;
  readonly rank: number | null;
  readonly picked: boolean;
  readonly onPick: () => void;
}): ReactElement {
  const where = standing(customer, now);
  const owes = balance(customer);
  const age = oldestDebtDays(customer, now);
  const mark = qualifier(customer, book, now);
  const bands = payBands(customer);
  const reading = howTheyPay(customer, where);

  return (
    <div
      className={`${s.row} ${picked ? s.rowOn : ''} ${where === 'quiet' ? s.rowQuiet : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={picked}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
    >
      <span className={s.avatar} style={AVATAR[avatarTone(customer, where, now)]}>
        {initials(customer.name)}
      </span>

      <div className={s.identity}>
        <div className={s.name}>{customer.name}</div>
        {mark === null ? (
          <div className={s.note}>{rowNote(customer, where, now)}</div>
        ) : (
          <div className={s.marks}>
            <span className={s.pill} style={TONE[mark.tone]}>
              {mark.pill}
            </span>
            {mark.fact !== null && <span className={s.fact}>{mark.fact}</span>}
          </div>
        )}
      </div>

      <div className={`${s.owes} ${where === 'past-due' ? s.owesBad : ''}`}>
        {Money.format(owes)}
      </div>

      <div className={`${s.age} ${s[ageTone(customer, where, now)] ?? ''}`}>
        {match(age, {
          known: (days) => `${days}d`,
          partial: (days) => `${days}d`,
          // Never a zero standing in for a figure the books did not produce.
          unavailable: () => '—',
        })}
      </div>

      <div>
        <div className={s.bar}>
          {hasPayHistory(bands) ? (
            <>
              <span
                className={s.barPart}
                style={{ width: `${bands.onTime}%`, background: v('good-ink') }}
              />
              <span
                className={s.barPart}
                style={{ width: `${bands.late}%`, background: v('pay-late') }}
              />
              <span
                className={s.barPart}
                style={{ width: `${bands.veryLate}%`, background: v('accent-mark') }}
              />
            </>
          ) : (
            <span className={s.barPart} style={{ width: '100%', background: v('pay-quiet') }} />
          )}
        </div>
        <div className={s.reading}>
          {match(reading, {
            known: (words) => words,
            partial: (words) => words,
            unavailable: (why) => why,
          })}
        </div>
      </div>

      <div className={s.right}>
        <AskChip where={where} rank={rank} />
      </div>
    </div>
  );
}

/**
 * The chase order as a chip.
 *
 * `1st` is filled because it is the recommendation the card header states;
 * `2nd` is the bad chip and the rest are neutral, so the eye finds the top
 * of the list without reading four ordinals. An account still inside its
 * terms is not in the order at all and says so with an em dash rather than a
 * rank nobody should act on; one that has gone quiet says `call`.
 */
function AskChip({
  where,
  rank,
}: {
  readonly where: Standing;
  readonly rank: number | null;
}): ReactElement {
  if (where === 'quiet') return <span className={s.pill} style={TONE.neutral}>call</span>;
  if (where !== 'past-due' || rank === null) return <span className={s.dash}>—</span>;
  const style = rank === 1 ? RANK_FIRST : rank === 2 ? TONE.bad : TONE.neutral;
  return (
    <span className={s.pill} style={style}>
      {ordinal(rank)}
    </span>
  );
}

const ordinal = (n: number): string => {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
};

/**
 * A row's avatar carries its state, so the group is readable without the
 * band: bad when nothing has come in against a past-due debt, caution when
 * something has, and inert otherwise. Part paid is not the same news as
 * silence, and drawing them alike is how a row that is being worked looks
 * like one that is not.
 */
function avatarTone(c: Customer, where: Standing, now: Date): 'bad' | 'warn' | 'neutral' {
  if (where !== 'past-due') return 'neutral';
  const anythingIn = openInvoices(c).some((inv) => !Money.isZero(inv.received));
  void now;
  return anythingIn ? 'warn' : 'bad';
}

/** More than a fortnight past due reads as bad; inside that, as caution. */
function ageTone(c: Customer, where: Standing, now: Date): 'ageBad' | 'ageWarn' | 'ageCalm' {
  if (where !== 'past-due') return 'ageCalm';
  const worst = openInvoices(c).reduce((most, inv) => {
    const over = inv.dueOn === null ? 0 : Math.floor((now.getTime() - inv.dueOn.getTime()) / 86_400_000);
    return Math.max(most, over);
  }, 0);
  return worst > HARD_PAST_DUE_DAYS ? 'ageBad' : 'ageWarn';
}

const overLimitReads = (c: Customer): string => {
  const first = c.name.split(' ')[0] ?? c.name;
  const limit = c.creditLimit;
  if (limit === null) return first;
  return `${first} ${Money.formatMillions(balance(c), 2)} of ${Money.formatMillions(limit, 2)}`;
};

/* -------------------------------------------------------------------------- */
/*  The panel                                                                 */
/* -------------------------------------------------------------------------- */

function Panel({ customer, now }: { readonly customer: Customer; readonly now: Date }): ReactElement {
  const over = overLimitBy(customer);
  const check = ledgerAgrees(customer);
  const margin = marginPercent(customer);
  const reading = marginReading(customer, DEMO_SHOP_MARGIN);
  const quiet = quietReading(customer, now);
  const rows = panelInvoices(customer);
  // Newest first, each with its verdict read off the debt ledger rather than
  // stored — a stamped verdict and a ledger that disagreed is the drift this
  // shop has already had to write a repair banner for once.
  const said = promisesOf(customer).map((promise) => ({
    promise,
    reading: promiseReading(promise, customer, now),
  }));
  const busiest = customer.monthly.reduce(
    (most, m) => Math.max(most, Number(m.spent)),
    0,
  );

  return (
    <>
      <section className={s.pane}>
        <header className={s.paneHead}>
          <div className={s.paneWho}>
            <span className={`${s.avatar} ${s.avatarLarge}`} style={RANK_FIRST}>
              {initials(customer.name)}
            </span>
            <div className={s.paneNames}>
              <div className={s.paneName}>{customer.name}</div>
              <div className={s.paneSince}>
                customer since {sinceReads(customer.since)}
                {customer.heldBy === null ? '' : ` · ${customer.heldBy}`}
              </div>
            </div>
            <Icon name="more-horizontal" size={17} className={s.kebab} />
          </div>
          <div className={s.paneChips}>
            <span className={s.onNavyChip}>
              <Icon name="tag" size={12} />
              {customer.phone}
            </span>
            <span className={s.onNavyChip}>{customer.area}</span>
          </div>
        </header>

        <div className={s.paneBody}>
          <div className={s.figures}>
            <div className={s.figure}>
              <div className={s.cardLabel}>Owes now</div>
              <div className={`${s.paneFig} ${s.paneFigBad}`}>
                {Money.format(balance(customer))}
              </div>
            </div>
            <div className={s.figure}>
              <div className={s.cardLabel}>Credit limit</div>
              <div className={s.paneFig}>
                {customer.creditLimit === null ? 'none set' : Money.format(customer.creditLimit)}
              </div>
            </div>
            <div className={s.figure}>
              <div className={s.cardLabel}>Bought 2 yrs</div>
              <div className={s.paneFig}>{Money.format(boughtOver(customer, now))}</div>
            </div>
          </div>

          {match(over, {
            known: (amount, basis) =>
              Money.isZero(amount) ? null : (
                <div className={s.caution}>
                  <Icon name="alert-triangle" size={15} className={s.cautionMark} />
                  <p className={s.cautionWords} title={basis}>
                    <strong>{Money.format(amount)} over the limit.</strong> New credit sales are
                    blocked for this account until it comes under{' '}
                    {Money.format(customer.creditLimit ?? Money.ZERO)}.
                  </p>
                </div>
              ),
            partial: () => null,
            unavailable: (why) => (
              <div className={s.caution}>
                <Icon name="alert-triangle" size={15} className={s.cautionMark} />
                <p className={s.cautionWords}>{why}.</p>
              </div>
            ),
          })}
        </div>

        {/* What they have said — frame 6c.
            Folded into this panel rather than given a card of its own: 6c
            draws its own avatar, name and balance, and all three are already
            in the header above. THE-BRIEF's rule — cut duplication, don't
            just restyle. What is lost is a standalone header; what absorbs
            it is this panel, which was already the one place a customer is
            looked at whole. */}
        {said.length > 0 && (
          <div className={s.debt}>
            <div className={s.debtHead}>
              <span className={s.cardLabel}>What they have said</span>
              <span className={s.debtCount}>newest first · nothing is overwritten</span>
            </div>
            <div className={s.debtRows}>
              {said.map(({ promise, reading }) => (
                <div key={promise.id} className={s.saidRow}>
                  <span className={s.saidDot} style={SAID_DOT[reading.state]} />
                  <div className={s.saidCell}>
                    <div className={s.saidWhat}>
                      {/* No figure named means the balance, which is what
                          the books store and what they actually said. */}
                      {promise.amount === null ? (
                        'the balance'
                      ) : (
                        <span className={s.saidFig}>{Money.format(promise.amount)}</span>
                      )}{' '}
                      on <span className={s.saidFig}>{dayAndMonth(promise.promisedOn)}</span>
                    </div>
                    <div className={s.saidWhen}>
                      said {dayAndMonth(promise.madeOn)}
                      {/* Their words beat the app's. The derived detail only
                          shows when they left none. */}
                      {promise.note !== null
                        ? ` · “${promise.note}”`
                        : reading.detail === null
                          ? ''
                          : ` · ${reading.detail}`}
                    </div>
                  </div>
                  <span className={s.pill} style={SAID_TONE[reading.state]}>
                    {reading.chip}
                  </span>
                </div>
              ))}
            </div>
            <p className={s.saidNote}>
              A row is only ever added. A wrong one is deleted, never edited — which is why the
              list can be trusted as what was actually said.
            </p>
          </div>
        )}

        <div className={s.debt}>
          <div className={s.debtHead}>
            <span className={s.cardLabel}>What the debt is made of</span>
            <span className={s.debtCount}>
              {rows.length} {rows.length === 1 ? 'invoice' : 'invoices'}
            </span>
          </div>
          <div className={s.debtRows}>
            {rows.map((inv) => {
              const out = owedOn(inv);
              const settled = Money.isZero(out);
              return (
                <div key={inv.doc} className={s.debtRow}>
                  <span
                    className={s.pill}
                    style={settled ? TONE.good : TONE.bad}
                  >
                    {inv.doc}
                  </span>
                  <span className={`${s.debtWhen} ${settled ? s.debtWhenCalm : ''}`}>
                    {dayAndMonth(inv.issued)} ·{' '}
                    {inv.settledOn === null
                      ? `${Math.floor((now.getTime() - inv.issued.getTime()) / 86_400_000)} days`
                      : `settled ${dayAndMonth(inv.settledOn)}`}
                  </span>
                  <span className={`${s.debtFig} ${settled ? s.debtFigCalm : s.debtFigBad}`}>
                    {Money.format(out)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className={s.checkRow}>
            <span className={s.cardLabel}>
              {match(check, {
                known: (agrees) =>
                  agrees ? 'Ledger agrees with the balance' : 'Ledger disagrees with the balance',
                partial: () => 'Ledger disagrees with the balance',
                unavailable: () => 'The ledger could not be read',
              })}
            </span>
            <span
              className={s.pill}
              style={match(check, {
                known: (agrees) => (agrees ? TONE.good : TONE.bad),
                partial: () => TONE.bad,
                unavailable: () => TONE.neutral,
              })}
              title={match(check, {
                known: (_agrees, basis) => basis,
                partial: (_agrees, basis) => basis,
                unavailable: (why) => why,
              })}
            >
              {match(check, {
                known: (agrees) => (agrees ? <Icon name="check" size={12} /> : null),
                partial: () => null,
                unavailable: () => null,
              })}
              {match(check, {
                known: (agrees) => (agrees ? 'checked' : 'apart'),
                partial: () => 'apart',
                unavailable: () => 'unread',
              })}
            </span>
          </div>
        </div>

        <div className={s.actions}>
          {/* The one accent-filled control on this screen. */}
          <button type="button" className={s.chase}>
            <Icon name="message-circle" size={15} />
            Draft the chase
          </button>
          <button type="button" className={s.secondary}>
            Send statement
          </button>
          <button type="button" className={s.secondary}>
            Record a payment
          </button>
        </div>
      </section>

      <section className={s.pane2}>
        <div className={s.paneTitle}>What they buy, and what it earns</div>
        <div className={s.tiles}>
          <div className={s.tile}>
            <div className={s.tileLabel}>You kept, 12 months</div>
            <div className={`${s.tileFig} ${s.tileFigGood}`}>
              {customer.keptTwelveMonths === null
                ? 'not on file'
                : Money.format(customer.keptTwelveMonths)}
            </div>
            <div className={s.tileBasis}>
              {match(margin, {
                known: (pct) => `${pct}% margin`,
                partial: (pct) => `${pct}% margin`,
                unavailable: () => 'margin cannot be derived',
              })}
            </div>
          </div>
          <div className={s.tile}>
            <div className={s.tileLabel}>Shop average</div>
            <div className={s.tileFig}>{DEMO_SHOP_MARGIN}%</div>
            <div className={s.tileBasis}>
              {match(margin, {
                known: (pct) =>
                  pct < DEMO_SHOP_MARGIN ? 'they buy on discount' : 'they buy at the list price',
                partial: () => 'they buy on discount',
                unavailable: () => 'no comparison yet',
              })}
            </div>
          </div>
        </div>

        <div className={s.products}>
          {customer.buys.map((p, i) => (
            <div key={p.product} className={`${s.product} ${i === 0 ? s.productFirst : ''}`}>
              <span className={s.productName}>{p.product}</span>
              <span className={s.productShare}>
                {p.shareOfSpend}%{i === 0 ? ' of spend' : ''}
              </span>
              <span className={s.productMargin}>{p.margin}%</span>
            </div>
          ))}
        </div>

        <p className={s.paneReading}>
          {match(reading, {
            known: (words) => words,
            partial: (words) => words,
            unavailable: (why) => why,
          })}
        </p>
      </section>

      <section className={s.pane2}>
        <div className={s.cardLabel}>Last five months</div>
        <div className={s.months}>
          {customer.monthly.map((month) => (
            <div key={month.month} className={s.month}>
              <div
                className={`${s.monthBar} ${isQuietMonth(customer, month) ? s.monthBarQuiet : ''}`}
                style={{ height: `${barHeight(Number(month.spent), busiest)}px` }}
                title={`${month.month}: ${Money.format(month.spent)}`}
              />
              <span className={s.monthName}>{month.month}</span>
            </div>
          ))}
        </div>
        <p className={s.paneReading}>
          {match(quiet, {
            known: (words) => words,
            partial: (words) => words,
            unavailable: (why) => why,
          })}
        </p>
      </section>
    </>
  );
}

/** The tallest month is 40px; a month with nothing in it still draws 2px. */
const barHeight = (spent: number, busiest: number): number =>
  busiest === 0 ? 2 : Math.max(2, Math.round((spent / busiest) * 40));

/**
 * What the panel lists under the debt: everything still out, and the one
 * most recently settled.
 *
 * The settled one is there to be read as NOT part of the balance — it is the
 * same customer paying the last invoice off, which is the context that turns
 * "they owe 3,330,000" into "they owe 3,330,000 and they used to pay".
 */
function panelInvoices(c: Customer): readonly CustomerInvoice[] {
  const open = openInvoices(c);
  const lastSettled = c.invoices
    .filter((inv) => inv.settledOn !== null)
    .sort((a, b) => (b.settledOn?.getTime() ?? 0) - (a.settledOn?.getTime() ?? 0))[0];
  return lastSettled === undefined ? open : [...open, lastSettled];
}

/* -------------------------------------------------------------------------- */
/*  Chrome                                                                    */
/* -------------------------------------------------------------------------- */

function LensButton({
  label,
  count,
  tone,
  on,
  onPick,
}: {
  readonly label: string;
  readonly count: number;
  readonly tone: 'bad' | 'warn' | 'neutral';
  readonly on: boolean;
  readonly onPick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={`${s.lens} ${on ? s.lensOn : ''}`}
      aria-pressed={on}
      onClick={onPick}
    >
      {label}
      {/* A badge is drawn only when its number is above zero. */}
      {count > 0 && (
        <span className={s.lensCount} style={LENS_TONE[tone]}>
          {count}
        </span>
      )}
    </button>
  );
}

const TONE = {
  bad: { background: v('bad-chip'), color: v('bad-ink') },
  warn: { background: v('warn-fill'), color: v('warn-ink') },
  info: { background: v('info-chip'), color: v('info-ink') },
  good: { background: v('good-chip-light'), color: v('good-ink') },
  neutral: { background: v('neutral-chip'), color: v('neutral-ink') },
} as const;

const LENS_TONE = {
  bad: { background: v('bad-chip'), color: v('bad-ink') },
  warn: { background: v('warn-fill'), color: v('warn-ink') },
  neutral: { background: v('neutral-chip'), color: v('ink-2') },
} as const;

/**
 * A promise's three states, as chip and as dot.
 *
 * §2's meaning families, used for what they mean: green is a promise kept,
 * amber is one still waiting, coral-red is one broken. The dot repeats the
 * chip's colour on purpose — it is the thing that makes the list scannable
 * down its left edge without reading a word of it.
 */
const SAID_TONE = {
  kept: { background: v('good-chip-light'), color: v('good-ink') },
  waiting: { background: v('warn-fill'), color: v('warn-ink') },
  broken: { background: v('bad-chip'), color: v('bad-ink') },
} as const;

const SAID_DOT = {
  kept: { background: v('good-ink') },
  waiting: { background: v('warn-ink') },
  broken: { background: v('bad-ink') },
} as const;

/** The rank-one chip and the panel's avatar: the accent as a mark. */
const RANK_FIRST = { background: v('accent-mark'), color: v('on-fill') } as const;

const AVATAR = {
  bad: { background: v('bad-chip'), color: v('bad-ink') },
  warn: { background: v('warn-fill'), color: v('warn-ink') },
  neutral: { background: v('neutral-chip'), color: v('neutral-ink') },
} as const;

/**
 * The debt bar, deepest first. Sixty days and over wears the accent as a
 * mark, then the raw accent, then two clay bands — the whole bar is money
 * that is late or going late, so none of it is the cool blue Invoices uses
 * for a document that is merely young.
 */
const AGING_FILL = [
  v('accent-mark'),
  v('accent'),
  v('debt-mid'),
  v('debt-fresh'),
] as const;
