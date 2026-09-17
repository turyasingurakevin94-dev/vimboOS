/**
 * Messages — the phone. Frames 2b, 1b, 4b, 5b, the phone half of 1c, and
 * 5d, 5f, 5h and 5j.
 *
 * ## The Money lens IS the draft
 *
 * The desktop is a register beside a panel. At 390 there is nothing to sit
 * beside, so the phone opens on the one person who is owed a word, full
 * width, with *1 of N* in the header saying how many are behind them. That is
 * not the desktop list shrunk — it is a different answer to the same
 * question, which is what the two-designs law is for.
 *
 * ## One screen, one action
 *
 * Every lens ends in a footer that does not scroll, holding the hand-off and
 * the two stamps. Nothing sends itself: the green button opens WhatsApp with
 * the draft, and when you come back you say whether it went. That is the only
 * way this app ever learns a message left.
 *
 * ## What is drawn differently from the frames, and why
 *
 * 1. **The stamps are labelled buttons**, as 2b draws them, on every lens.
 *    1b draws the same pair as 44px icon-only squares; the design system's
 *    §7 forbids an unlabelled icon action outside an overflow menu, and *It
 *    was sent* / *It was not* is exactly the pair where a wrong guess writes
 *    a false record.
 * 2. **The lens row keeps every lens.** 5b draws Money · Telling · Inbox and
 *    drops Posting, which would leave the posting queue unreachable on a
 *    phone. Four tabs fit at 390.
 * 3. **The Money lens shows the chase history where there is one** (1b) and
 *    the carried-balance block where there is not (2b). They are one screen
 *    rendering two people, not two designs.
 */

import { useMemo, useState, type ReactElement } from 'react';
import {
  HOLD_REASONS,
  Money,
  coverDays,
  goodUntilLabel,
  lensCounts,
  match,
  moneyDesk,
  postingDesk,
  stateOf,
  tellingDesk,
  type Chat,
  type Desk,
  type Lens,
  type Owed,
  type Telling,
  type Tone,
} from '@ow/domain';
import { DEMO_TODAY, demoDesk } from '@ow/data';
import s from './Messages.module.css';
import { Setup } from './Shop.js';
import { Mark, PATH } from '../icons.js';

const v = (token: string): string => `var(--ow-color-${token})`;

const TONE: Record<Tone, { background: string; color: string }> = {
  bad: { background: v('bad-chip'), color: v('bad-ink') },
  caution: { background: v('warn-fill'), color: v('warn-ink') },
  good: { background: v('good-chip-light'), color: v('good-ink') },
  info: { background: v('info-chip'), color: v('info-ink') },
  studied: { background: v('buy-chip'), color: v('buy-chip-ink') },
  neutral: { background: v('neutral-chip'), color: v('ink-2') },
};

const LENS_LABEL: Record<Lens, string> = {
  money: 'Money',
  telling: 'Telling',
  posting: 'Posting',
  inbox: 'Inbox',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d: Date): string => `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`;
const clock = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * What is pushed over the lens.
 *
 * `setup` keeps the tab bar — frame 3b draws it, because the connection card
 * is a destination and not a step. `link` and `picked-list` cover it: they
 * are one job each, with a back chevron, and a tab bar under a screen that
 * already has a way out is two ways out arguing.
 */
type Pushed = 'setup' | 'link' | 'picked-list' | null;

export function Messages(): ReactElement {
  const now = DEMO_TODAY;
  const base = useMemo(() => demoDesk(), []);
  const [linked, setLinked] = useState(base.link.linked);
  const desk: Desk = useMemo(
    () => ({ ...base, link: { ...base.link, linked } }),
    [base, linked],
  );

  const [lens, setLens] = useState<Lens>('money');
  const [pushed, setPushed] = useState<Pushed>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [justPicked, setJustPicked] = useState<string | null>(null);

  const counts = lensCounts(desk, now);
  const here = counts.some((c) => c.lens === lens) ? lens : 'money';

  const tabs = (
    <div className={s.tabs} role="tablist" aria-label="Lenses">
      {counts.map((c) => {
        const on = c.lens === here;
        return (
          <button
            key={c.lens}
            type="button"
            role="tab"
            aria-selected={on}
            className={`${s.tab} ${on ? s.tabOn : ''}`}
            onClick={() => setLens(c.lens)}
          >
            {LENS_LABEL[c.lens]}{' '}
            {c.count > 0 && (
              <span className={on ? s.tabFigOn : s.tabFig}>{c.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {pushed === 'setup' ? (
        <Setup
          linked={linked}
          onBack={() => setPushed(null)}
          onLink={() => setPushed('link')}
        />
      ) : (
        <>
      {here === 'money' && (
        <MoneyLens
          desk={desk}
          now={now}
          tabs={tabs}
          onHold={setHolding}
          onLink={() => setPushed('setup')}
        />
      )}
      {here === 'telling' && (
        <TellingLens
          desk={desk}
          now={now}
          tabs={tabs}
          onList={() => setPushed('picked-list')}
        />
      )}
      {here === 'posting' && (
        <PostingLens
          desk={desk}
          tabs={tabs}
          justPicked={justPicked}
          onPick={setJustPicked}
        />
      )}
      {here === 'inbox' && <InboxLens desk={desk} tabs={tabs} />}
        </>
      )}

      {pushed === 'link' && (
        <LinkScreen
          code={desk.link.code}
          onBack={() => setPushed(null)}
          onLinked={() => {
            setLinked(true);
            setPushed(null);
            setLens('inbox');
          }}
        />
      )}
      {pushed === 'picked-list' && <PickedList onBack={() => setPushed(null)} />}
      {holding !== null && (
        <HoldSheet name={holding} onClose={() => setHolding(null)} />
      )}
    </>
  );
}

/* ========================================================================== */
/*  Money — frames 2b and 1b                                                  */
/* ========================================================================== */

function MoneyLens({
  desk,
  now,
  tabs,
  onHold,
  onLink,
}: {
  readonly desk: Desk;
  readonly now: Date;
  readonly tabs: ReactElement;
  readonly onHold: (name: string) => void;
  readonly onLink: () => void;
}): ReactElement {
  const money = moneyDesk(desk.owed, now);
  const [at, setAt] = useState(0);
  const queue = money.toMessage.length > 0 ? money.toMessage : money.sentWaiting;
  const row = queue[Math.min(at, queue.length - 1)];

  if (row === undefined) {
    // Empty states name their next action rather than describing a void.
    return (
      <div className={s.screen}>
        <header className={s.header}>
          <div className={s.headTop}>
            <span className={s.headTitle}>Messages</span>
          </div>
          {tabs}
        </header>
        <div className={s.bodyPad}>
          <p className={s.aside}>
            Nobody is owed a word this morning. Nothing promised falls due today and
            nothing has gone quiet.
          </p>
        </div>
      </div>
    );
  }

  const owing = stateOf(row, now) === 'draft';

  return (
    <div className={s.screen}>
      <header className={s.header}>
        <div className={s.headTop}>
          <button
            type="button"
            className={s.back}
            aria-label="Back"
            onClick={() => setAt((i) => Math.max(0, i - 1))}
          >
            <Mark d={PATH.back} size={18} />
          </button>
          <span className={s.headAv}>{row.initials}</span>
          <div className={s.headBody}>
            <div className={s.headName}>{row.name}</div>
            <div className={s.headMeta}>{about(row)}</div>
          </div>
          <span className={s.headChip}>
            {at + 1} of {queue.length}
          </span>
        </div>

        {/* The ground says whether the message is still owed. */}
        <div className={owing ? s.stakeOwed : s.stake}>
          <span className={owing ? s.stakeLabelOwed : s.stakeLabel}>AT STAKE</span>
          <span className={s.stakeFig}>{Money.format(row.atStake)}</span>
        </div>

        {tabs}
      </header>

      <div className={s.body}>
        {row.invoice === null && (
          <div className={s.carried}>
            <strong>No invoice behind this balance.</strong> Carried on from earlier ·{' '}
            {row.oldestDays} days old · {row.everPaid ? 'has paid before' : 'never paid'}
          </div>
        )}

        <div className={s.section}>
          <div className={s.labelRow}>
            <span className={s.label}>What will be sent</span>
            <span className={s.hint}>edit it — the box ships</span>
          </div>
          <textarea
            className={s.box}
            defaultValue={row.draft}
            rows={row.draft.split('\n').length}
            aria-label="The message that will be sent"
          />
          <div className={s.tools}>
            <button type="button" className={`${s.secondary} ${s.tapTool}`}>
              Shorter
            </button>
            <button type="button" className={`${s.secondary} ${s.tapTool}`}>
              Firmer
            </button>
            <button type="button" className={`${s.secondary} ${s.tapTool}`}>
              Ring
            </button>
          </div>

          {row.history.length > 0 && (
            <div className={s.history}>
              <div className={s.label}>The last {row.history.length} times</div>
              <div className={s.historyRows}>
                {row.history.map((h) => (
                  <div key={h.on.toISOString()} className={s.historyRow}>
                    <span className={s.historyDate}>{shortDate(h.on)}</span>
                    <span className={s.historyWhat}>{h.what}</span>
                    <span
                      className={s.pill}
                      style={TONE[h.outcome === 'promised' ? 'caution' : 'neutral']}
                    >
                      {h.outcome === 'promised' ? 'promised' : 'silent'}
                    </span>
                  </div>
                ))}
              </div>
              <div className={s.historySay}>
                {promisesThenSilence(row)} Messages have stopped working here — a call or a
                visit is the next lever.
              </div>
            </div>
          )}
        </div>

        <div className={s.note}>
          <div className={s.noteSay}>
            <strong className={s.noteStrong}>
              {money.held.length === 0 ? 'Nobody is held back' : `${money.held.length} held back`}
            </strong>
            , nothing promised is due today, and no news is waiting.{' '}
            {money.toMessage.length === 1
              ? 'This is the only message you owe.'
              : `${money.toMessage.length} messages are owed.`}
          </div>
          <button
            type="button"
            className={`${s.secondary} ${s.tapHold}`}
            onClick={() => onHold(row.name)}
          >
            Hold them
          </button>
        </div>

        {/**
         * Frame 3c, at the foot of a list that has work in it. Not a lens,
         * not a tab, and not a band announcing a void — and it disappears
         * the moment the number is linked.
         */}
        {!desk.link.linked && (
          <button type="button" className={s.linkLine} onClick={onLink}>
            <span className={s.linkIcon}>
              <Mark d={PATH.bubbleDots} size={15} />
            </span>
            <span className={s.linkSay}>
              Chats could be answered here too. Link your number and the replies arrive on
              this screen.
            </span>
            <span className={s.chevron}>
              <Mark d={PATH.chevron} size={15} />
            </span>
          </button>
        )}
      </div>

      <div className={s.foot}>
        <button type="button" className={`${s.handoff} ${s.tapWide}`}>
          <Mark d={PATH.bubble} size={18} />
          Open WhatsApp
        </button>
        <div className={s.footSay}>The app cannot see WhatsApp — say whether it went</div>
        <div className={s.footRow}>
          <button type="button" className={`${s.secondary} ${s.tapShare}`}>
            <span className={s.went}>
              <Mark d={PATH.check} size={16} />
            </span>
            It was sent
          </button>
          <button type="button" className={`${s.secondary} ${s.tapShare}`}>
            <span className={s.didNot}>
              <Mark d={PATH.x} size={16} />
            </span>
            It was not
          </button>
        </div>
      </div>
    </div>
  );
}

const about = (row: Owed): string =>
  row.invoice === null
    ? `${row.phone} · ${row.lastWord === null ? 'first ask' : `${row.chases} chases`}`
    : `${row.invoice.replace('-', '‑')} · ${row.oldestDays} days · ${row.chases + 1}th chase`;

const promisesThenSilence = (row: Owed): string => {
  const promises = row.history.filter((h) => h.outcome === 'promised').length;
  if (promises === 0) return 'Read, and never answered.';
  return `${promises === 1 ? 'One promise' : `${promises} promises`} then silence.`;
};

/* ========================================================================== */
/*  Telling — frame 4b                                                        */
/* ========================================================================== */

function TellingLens({
  desk,
  now,
  tabs,
  onList,
}: {
  readonly desk: Desk;
  readonly now: Date;
  readonly tabs: ReactElement;
  /**
   * One message to a picked list. Frame 4b does not draw this door and frame
   * 5h is the screen behind it, so it goes where the handoff says the list is
   * picked FROM — the Telling lens — at the foot, under the three reasons it
   * would be picked out of.
   */
  readonly onList: () => void;
}): ReactElement {
  const tell = tellingDesk(desk.telling, now);
  const later = tell.speak.filter((t) => goodUntilLabel(t, now) !== 'today');

  return (
    <div className={s.screen}>
      <header className={s.header}>
        <div className={s.headTop}>
          <span className={s.headIcon}>
            <Mark d={PATH.shop} size={14} />
          </span>
          <span className={s.headTitle}>Worth telling</span>
          <button type="button" className={s.headSearch} aria-label="Search">
            <Mark d={PATH.search} size={18} />
          </button>
        </div>

        <div className={s.stake}>
          <span className={s.stakeLabel}>SAY TODAY, OR NOT AT ALL</span>
          <span className={s.stakeFig}>{tell.sayToday}</span>
        </div>
        <div className={s.stakeBasis}>
          {later.length} more holds {goodUntilLabel(later[0] ?? tell.speak[0]!, now)} ·{' '}
          {tell.expired.length} expired · {tell.betterPosted.length} better posted
        </div>

        {tabs}
      </header>

      <div className={s.body}>
        {tell.speak.map((t, i) => (
          <ReasonRow key={t.id} t={t} now={now} first={i === 0} />
        ))}

        {tell.betterPosted.length > 0 && (
          <>
            <div className={s.band}>
              <span className={s.chipTiny} style={TONE.studied}>
                Better posted {tell.betterPosted.length}
              </span>
              <span className={s.bandSay}>outside the three</span>
            </div>
            {tell.betterPosted.map((t) => (
              <div key={t.id} className={s.reasonAside}>
                <div className={s.reasonTop}>
                  <span className={s.av} style={TONE[t.tone]}>
                    {t.initials}
                  </span>
                  <span className={s.who}>
                    <span className={s.name}>{t.name}</span>
                    <span className={s.metaWarn}>{t.whyThem}</span>
                  </span>
                  <span className={s.pill} style={TONE.studied}>
                    better posted
                  </span>
                </div>
                <div className={s.what}>{capitalise(t.what)}</div>
                <div className={s.route}>
                  Already {t.routeNote ?? 'in the posting queue'} — post it rather than write
                  to one buyer
                </div>
              </div>
            ))}
          </>
        )}

        <div className={s.section}>
          <button type="button" className={`${s.secondary} ${s.tap}`} onClick={onList}>
            One message to a picked list
          </button>
        </div>

        {tell.expired.length > 0 && (
          <div className={s.note}>
            <div className={s.noteSay}>
              <strong className={s.noteStrong}>
                {countWord(tell.expired.length)} stopped being true
              </strong>{' '}
              before anyone sent them — {expiredBecause(tell.expired)}.{' '}
              {match(tell.expiredWorth, {
                known: (worth) => `They were worth ${Money.format(worth)}.`,
                partial: (worth, _b, missing) =>
                  `${missing.startsWith('2 of 3') ? 'Two' : 'Some'} were worth ${Money.format(worth)}.`,
                unavailable: () => 'None of them carried a figure.',
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const capitalise = (line: string): string => line.charAt(0).toUpperCase() + line.slice(1);

/**
 * Why they stopped being true, in the shop's own words, joined into one
 * sentence. Named rather than counted: "three expired" teaches nothing, and
 * "a timber cut that went back up" is the whole lesson.
 */
const expiredBecause = (rows: readonly Telling[]): string =>
  rows
    .map((t) => t.stoppedBeingTrue?.because ?? 'the day passed')
    .slice(0, 2)
    .join(', ');

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const countWord = (n: number): string => WORDS[n] ?? String(n);

function ReasonRow({
  t,
  now,
  first,
}: {
  readonly t: Telling;
  readonly now: Date;
  readonly first: boolean;
}): ReactElement {
  const label = goodUntilLabel(t, now);
  return (
    <div className={`${s.reason} ${first ? s.reasonOn : ''}`}>
      <div className={s.reasonTop}>
        <span className={s.av} style={TONE[t.tone]}>
          {t.initials}
        </span>
        <span className={s.who}>
          <span className={s.name}>{t.name}</span>
          <span className={s.meta}>{t.whyThem}</span>
        </span>
        <span className={s.pill} style={TONE[label === 'today' ? 'info' : 'neutral']}>
          {label}
        </span>
      </div>
      <div className={s.what}>{capitalise(t.what)}</div>
      {/**
       * Only what has to be said TODAY carries a button, and only the first
       * of those wears the accent. A reason that holds three days is read
       * now and tapped when its day comes — a button on it would be a third
       * thing to do next on a screen that has one.
       */}
      {label === 'today' && (
        <button
          type="button"
          className={`${first ? s.primary : s.secondary} ${s.tap} ${s.tools}`}
        >
          Write it
        </button>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  Posting — the phone half of 1c, and 5j after a pick                       */
/* ========================================================================== */

function PostingLens({
  desk,
  tabs,
  justPicked,
  onPick,
}: {
  readonly desk: Desk;
  readonly tabs: ReactElement;
  readonly justPicked: string | null;
  readonly onPick: (id: string | null) => void;
}): ReactElement {
  const posts = useMemo(
    () =>
      justPicked === null
        ? desk.posts
        : desk.posts.map((p) => (p.id === justPicked ? { ...p, picked: true } : p)),
    [desk.posts, justPicked],
  );
  const queue = postingDesk(posts, desk.signalRecords);
  const lead = queue.picked[0];
  const card = lead?.card ?? null;
  /**
   * The next three in the queue, each knowing whether a place is still open
   * when its turn comes. The frame draws exactly one Pick and one "rolls
   * over", and that is the cap doing the talking: what is offered is what
   * the day can still take.
   */
  let open = queue.placesLeft;
  const next = queue.queue.slice(1, 4).map((p) => {
    const canPick = !p.picked && open > 0;
    if (canPick) open -= 1;
    return { post: p, canPick };
  });
  const held = queue.held[0];
  const added = queue.queue.find((p) => p.id === justPicked);

  return (
    <div className={`${s.screen} ${s.relative}`}>
      <header className={s.header}>
        <div className={s.headTop}>
          <button type="button" className={s.back} aria-label="Back">
            <Mark d={PATH.back} size={18} />
          </button>
          <div className={s.headBody}>
            <div className={s.headName}>What to post today</div>
            <div className={s.headMeta}>
              {queue.queue.length} nominated · {queue.picked.length} of {queue.cap} picked
            </div>
          </div>
          <span className={s.headChip}>9&#8211;11am</span>
        </div>
        {tabs}
      </header>

      <div className={s.body}>
        {lead !== undefined && card !== null && (
          <>
            <div className={s.postWrap}>
              <div className={s.postCard}>
                <div className={s.postTop}>
                  <div className={s.postShop}>Ssekitoleko Hardware</div>
                  <div className={s.postProduct}>{lead.product}</div>
                  <div className={s.postSpec}>{card.spec}</div>
                  <div className={s.postPrices}>
                    <span className={s.postPrice}>{Money.format(card.price)}</span>
                    {card.wasPrice !== null && (
                      <span className={s.postWas}>{Money.format(card.wasPrice)}</span>
                    )}
                  </div>
                  <div className={s.postStockRow}>
                    <span className={s.postStock}>
                      {match(coverDays(lead), {
                        known: (d) => `${d} days of stock`,
                        partial: (d) => `${d} days of stock`,
                        unavailable: () => 'in the yard',
                      })}
                    </span>
                  </div>
                </div>
                {!card.photo && (
                  <div className={s.noPhoto}>
                    <Mark d={PATH.photo} size={14} />
                    <span className={s.noPhotoSay}>No photo — price card used</span>
                    <button type="button" className={s.ghost}>
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={s.section}>
              <span className={s.chip} style={TONE.good}>
                <Mark d={PATH.arrowDown} size={12} />
                price cut · {signalSay(desk)}
              </span>
              <textarea
                className={s.box}
                defaultValue={card.message}
                rows={card.message.split('\n').length}
                aria-label="The post that will go out"
              />
              <div className={s.tools}>
                <button type="button" className={`${s.secondary} ${s.tapTool}`}>
                  Shorter
                </button>
                <button type="button" className={`${s.secondary} ${s.tapTool}`}>
                  Swap product
                </button>
              </div>
            </div>
          </>
        )}

        <div className={s.queueNext}>
          <div className={s.label}>Next in the queue</div>
          <div className={s.queueRows}>
            {next.map(({ post, canPick }, i) => (
              <div
                key={post.id}
                className={post.picked || canPick ? s.queueRow : s.queueRowRolls}
              >
                <span className={s.queueNo}>{i + 2}</span>
                <span className={s.who}>
                  <span className={s.queueName}>{post.product}</span>
                  <span className={s.queueWhy}>{post.why}</span>
                </span>
                {post.picked ? (
                  <span className={s.chipPicked}>picked</span>
                ) : canPick ? (
                  <button
                    type="button"
                    className={`${s.secondary} ${s.tapPick}`}
                    onClick={() => onPick(post.id)}
                  >
                    Pick
                  </button>
                ) : (
                  <span className={s.queueRolls}>rolls over</span>
                )}
              </div>
            ))}
          </div>
          {held !== undefined && (
            <div className={s.heldLine}>
              <span className={s.heldSay}>
                {held.product} held back ·{' '}
                {match(coverDays(held), {
                  known: (d) => `${d} days of cover`,
                  partial: (d) => `${d} days of cover`,
                  unavailable: () => 'no cover to read',
                })}
              </span>
              <span className={`${s.pill} ${s.pushRight}`} style={TONE.bad}>
                low stock
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={s.footQuiet}>
        <button type="button" className={`${s.handoff} ${s.tapWide}`}>
          <Mark d={PATH.message} size={17} />
          Open WhatsApp with this
        </button>
        <div className={s.footRow}>
          <span className={s.footNote}>
            Then stamp it — that is what ties the next {desk.soldAfterPosts.withinDays} days of
            sales to this post.
          </span>
          <button type="button" className={`${s.secondary} ${s.tapSquare}`} aria-label="It was posted">
            <span className={s.went}>
              <Mark d={PATH.check} size={18} />
            </span>
          </button>
          <button type="button" className={`${s.secondary} ${s.tapSquare}`} aria-label="It was not">
            <span className={s.didNot}>
              <Mark d={PATH.x} size={18} />
            </span>
          </button>
        </div>
      </div>

      {/* Frame 5j: a toast over the queue, not a new screen. */}
      {added !== undefined && (
        <div className={s.toast} role="status">
          <div className={s.toastTop}>
            <span className={s.toastSay}>
              {added.product} added ·{' '}
              {queue.placesLeft === 0
                ? 'that is the day full'
                : queue.placesLeft === 1
                  ? 'one place left today'
                  : `${queue.placesLeft} places left today`}
            </span>
            <button type="button" className={s.toastUndo} onClick={() => onPick(null)}>
              Undo
            </button>
          </div>
          <button type="button" className={s.toastWrite}>
            Write post {queue.picked.length}
          </button>
        </div>
      )}
    </div>
  );
}

const signalSay = (desk: Desk): string => {
  const cut = desk.signalRecords.find((r) => r.signal === 'price-cut');
  return cut === undefined ? 'not posted yet' : `${cut.moved} of ${cut.of} such posts sold`;
};

/* ========================================================================== */
/*  Inbox — frame 5b                                                          */
/* ========================================================================== */

function InboxLens({
  desk,
  tabs,
}: {
  readonly desk: Desk;
  readonly tabs: ReactElement;
}): ReactElement {
  const chats = desk.chats;
  const [lead, ...rest] = chats;

  return (
    <div className={s.screen}>
      <header className={s.header}>
        <div className={s.headTop}>
          <span className={s.headTitle}>Messages</span>
          <span className={s.headChipLoud}>{chats.length} in</span>
        </div>
        {tabs}
      </header>

      <div className={s.body}>
        {lead !== undefined && (
          <div className={s.chatTop}>
            <span className={s.av} style={TONE[lead.tone]}>
              {lead.initials}
            </span>
            <span className={s.who}>
              <span className={s.chatHead}>
                <span className={s.chatName}>{lead.name}</span>
                <span className={s.chatAt}>{clock(lead.at)}</span>
              </span>
              <span className={s.chatPreview}>{lead.preview}</span>
              <span className={s.chatAbout}>{aboutLine(lead)}</span>
              {/* Only the top chat carries its action. */}
              <button type="button" className={s.replyTap}>
                Reply
              </button>
            </span>
          </div>
        )}

        {rest.map((c) => (
          <button key={c.id} type="button" className={s.chatRow}>
            <span className={s.av} style={TONE[c.tone]}>
              {c.initials}
            </span>
            <span className={s.who}>
              <span className={s.name}>{c.name}</span>
              <span className={s.chatPreviewQuiet}>{c.preview}</span>
            </span>
            <span className={s.chevron}>
              <Mark d={PATH.chevron} size={15} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function aboutLine(c: Chat): ReactElement | string {
  if (c.about.kind === 'invoice') {
    return (
      <>
        owes <span className={s.chatAboutFig}>{Money.format(c.about.owes)}</span> ·{' '}
        {c.about.days} days
      </>
    );
  }
  return c.about.kind === 'order' ? c.about.line : c.about.line;
}

/* ========================================================================== */
/*  Linking — frame 5d                                                        */
/* ========================================================================== */

/**
 * On a phone the CODE leads, because you cannot scan your own screen. The
 * square is not drawn here at all: a control that cannot be used is worse
 * than one that is absent.
 */
function LinkScreen({
  code,
  onBack,
  onLinked,
}: {
  readonly code: string;
  readonly onBack: () => void;
  readonly onLinked: () => void;
}): ReactElement {
  return (
    <div className={s.pushed} role="dialog" aria-modal="true" aria-label="Link the shop number">
      <header className={s.headerShut}>
        <div className={s.headTop}>
          <button type="button" className={s.back} onClick={onBack} aria-label="Back">
            <Mark d={PATH.back} size={18} />
          </button>
          <span className={s.headTitle}>Link the shop number</span>
        </div>
      </header>

      <div className={s.stack}>
        <div className={s.linkCode}>
          <div className={s.label}>Type this in WhatsApp</div>
          <div className={s.code}>{code.replace('-', '‑')}</div>
          <div className={s.codeSay}>lasts 60 seconds · a new code is free</div>
        </div>

        <div className={s.card}>
          <div className={s.step}>
            <span className={s.stepNo}>1</span>
            <span className={s.stepSay}>Open WhatsApp on the shop phone</span>
          </div>
          <div className={s.stepNext}>
            <span className={s.stepNo}>2</span>
            <span className={s.stepSay}>
              Settings &#8594; Linked devices &#8594; <strong>Link with a code</strong>
            </span>
          </div>
          <div className={s.stepNext}>
            <span className={s.stepNo}>3</span>
            <span className={s.stepSay}>Type the code above</span>
          </div>
        </div>

        <p className={s.aside}>
          Linking changes nothing on the shop phone. Chats keep arriving there;
          Omni&#8209;Ware starts seeing them too.
        </p>
      </div>

      <div className={s.foot}>
        <button type="button" className={`${s.handoff} ${s.tapWide}`} onClick={onLinked}>
          Open WhatsApp
        </button>
        <button type="button" className={`${s.secondary} ${s.tapWide} ${s.footRow}`} onClick={onBack}>
          Not now
        </button>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Holding — frame 5f                                                        */
/* ========================================================================== */

function HoldSheet({
  name,
  onClose,
}: {
  readonly name: string;
  readonly onClose: () => void;
}): ReactElement {
  const [reason, setReason] = useState<string>('paying');
  const [until, setUntil] = useState<string>('Friday');

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label={`Hold ${name}`}>
      <div className={s.sheet}>
        <div className={s.grab} />
        <div className={s.sheetTitle}>Hold {name}</div>
        <div className={s.sheetSay}>No message goes out while they are held.</div>

        <div className={s.sheetLabel}>Why</div>
        <div className={s.words}>
          {HOLD_REASONS.filter((r) => r.id !== 'other').map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === reason ? s.wordOn : s.word}
              onClick={() => setReason(r.id)}
            >
              {r.id === 'bad-time' ? 'Bad time' : r.label}
            </button>
          ))}
        </div>

        <div className={s.sheetLabel}>Until</div>
        <div className={s.words}>
          {['Friday', '7 days', 'No date'].map((u) => (
            <button
              key={u}
              type="button"
              className={u === until ? s.wordWideOn : s.wordWide}
              onClick={() => setUntil(u)}
            >
              {u}
            </button>
          ))}
        </div>

        <button type="button" className={s.sheetCommit} onClick={onClose}>
          Hold them
        </button>
        <button type="button" className={s.sheetCancel} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  One message, three people — frame 5h                                      */
/* ========================================================================== */

function PickedList({ onBack }: { readonly onBack: () => void }): ReactElement {
  const who = [
    { name: 'Nakawa Traders', why: 'bought G28 in July' },
    { name: 'Kato Construction Ltd', why: 'bought G28 twice' },
    { name: 'Ken Bwaise', why: 'asked for sheets last week' },
  ];
  const message = `Hello {name},

Iron sheets G28 are now 27,500 a piece,
down from 37,000. We have 120 in stock.

Ssekitoleko Hardware`;

  return (
    <div className={s.pushed} role="dialog" aria-modal="true" aria-label="One message, three people">
      <header className={s.headerShut}>
        <div className={s.headTop}>
          <button type="button" className={s.back} onClick={onBack} aria-label="Back">
            <Mark d={PATH.back} size={18} />
          </button>
          <span className={s.headTitle}>
            One message, {countWord(who.length).toLowerCase()} people
          </span>
        </div>
      </header>

      <div className={s.bodyPad}>
        <div className={s.label}>The message</div>
        <textarea
          className={s.box}
          defaultValue={message}
          rows={message.split('\n').length}
          aria-label="The message every person gets"
        />

        <div className={s.labelNext}>
          Who gets it <span className={s.pickFig}>{who.length}</span>
        </div>
        <div className={s.picks}>
          {who.map((p) => (
            <div key={p.name} className={s.pickRow}>
              <span className={s.tick}>
                <Mark d={PATH.check} size={11} />
              </span>
              <span className={s.who}>
                <span className={s.pickName}>{p.name}</span>
                <span className={s.pickWhy}>{p.why}</span>
              </span>
            </div>
          ))}
          <button type="button" className={`${s.secondary} ${s.tap}`}>
            Add someone else
          </button>
        </div>
      </div>

      <div className={s.foot}>
        {/* The part that could go wrong, stated where the send is. */}
        <div className={s.footNote}>Each person gets their own copy, one at a time</div>
        <button type="button" className={`${s.primary} ${s.tapWide} ${s.footRow}`} onClick={onBack}>
          Send to {who.length}
        </button>
      </div>
    </div>
  );
}
