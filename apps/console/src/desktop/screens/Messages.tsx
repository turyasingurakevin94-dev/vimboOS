/**
 * Messages — the desktop console. Frames 2a, 4a, 1c, 5a and what they open.
 *
 * ## Two rail rows became one
 *
 * **Follow-ups** was a list of people owed a word, already tagged with a
 * reason. **WhatsApp** was the box you write that word in. Neither was usable
 * without the other — the list's only action was to open the box, and the
 * box's only content came from the list — and the code's own nav index
 * admitted the search problem: the obvious search for Follow-ups is
 * "broadcast", and broadcast was WhatsApp's screen.
 *
 * One desk, lenses instead of destinations. Broadcast is a button in the top
 * bar; a template is what the draft box is pre-filled with. Nothing is lost.
 *
 * ## The two lenses rank on opposites, and the header says which
 *
 * Money: most at stake first, and waiting makes a message MORE urgent.
 * Telling: *Good until*, and waiting makes it worthless. Each lens states
 * what it ranks on in its own sub-line, because a list whose order you cannot
 * name is a list you scroll rather than read.
 *
 * ## Every figure here is derived
 *
 * The lens chips, the tiles and the panels all read `lensCounts`,
 * `moneyDesk`, `tellingDesk`, `postingDesk`, `coverDays` and `keepShare` over
 * the same rows drawn beneath them. `messages.test.ts` pins the rules;
 * nothing on this screen is a typed figure.
 *
 * ## What is drawn differently from the frames, and why
 *
 * 1. **The Money lens chip reads 1 on every lens.** The frames were drawn
 *    across four turns and disagree with each other about it — 1, 6 and 9 —
 *    and one reckoning outranks reproducing all three. See the head of
 *    `demo-messages.ts`.
 * 2. **"Sent, waiting on a reply" says its oldest is 13 days**, where 2a
 *    draws 11. It is `daysBetween` over the same chase history the phone's
 *    draft screen lists, and the frame's own most recent chase is 2 Sep.
 * 3. **The expired group draws all three reasons**, where 4a draws two of
 *    the three inside one row. The group header counts three either way, and
 *    a list that says 3 above two rows is the shape this desk exists to stop.
 */

import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import {
  bestKind,
  type Chat,
  coverDays,
  DAILY_POST_CAP,
  describeDay,
  type Desk,
  draftPromise,
  goodUntilLabel,
  HOLD_REASONS,
  keepShare,
  kindShare,
  type Lens,
  lensCounts,
  match,
  Money,
  moneyDesk,
  monthGrid,
  type Owed,
  paidShare,
  type Post,
  postingDesk,
  PROMISE_NOTE_MAX,
  promiseDayChips,
  ridingOnIt,
  type Signal,
  signalShare,
  stepMonth,
  type Telling,
  tellingDesk,
  type TellingKind,
  type Tone,
  unspokenFor,
  waitedDays,
  WEEK_HEADINGS,
} from '@ow/domain';
import { PICKED_LIST_CANDIDATES } from '@ow/data';
import { useDesk } from '../../app/useDesk.js';
import { useRecordPromise } from '../../app/useRecordPromise.js';
import s from './Messages.module.css';
import { LinkWhatsApp } from './LinkWhatsApp.js';
import { Icon, type IconName } from '../icons.js';

const v = (token: string): string => `var(--ow-color-${token})`;

/**
 * A tint means something, and these five are the desk's whole vocabulary.
 *
 * The studied family here is the Buy chip's pair rather than §2's violet:
 * every Messages frame draws "Better posted", "just added" and "{name} fills
 * itself" on `#e6e3ff / #4230a8`, and where the document and a file disagree
 * the file wins.
 */
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

const clock = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** A product with no photo still needs a face on its row. */
const POST_MARK: Record<Signal, IconName> = {
  'price-cut': 'sheets',
  'idle-stock': 'panel',
  'goes-together': 'roof',
  'season-starting': 'crate',
  margin: 'coil',
};

const SIGNAL_LABEL: Record<Signal, string> = {
  'price-cut': 'price cut',
  'idle-stock': 'idle stock',
  'goes-together': 'goes together',
  'season-starting': 'season starting',
  margin: 'margin',
};

const SIGNAL_TONE: Record<Signal, Tone> = {
  'price-cut': 'good',
  'idle-stock': 'caution',
  'goes-together': 'info',
  'season-starting': 'studied',
  margin: 'good',
};

export interface MessagesProps {
  /**
   * The lens, as the third crumb in the top bar. Frame 1c draws
   * "Sell › Messages › Posting"; the other lenses draw two crumbs, because a
   * lens is not a destination and only the posting queue is a place you say
   * you are going.
   */
  readonly onTrail?: (trail: string | null) => void;
}

export function Messages({ onTrail }: MessagesProps): ReactElement {
  const got = useDesk();
  if (got.at === 'loading') return <Bare say="Reading the desk…" />;
  if (got.at === 'failed') return <Bare say={`The desk could not be read. ${got.why}`} />;
  // Spread, not `onTrail={onTrail}`: under `exactOptionalPropertyTypes`
  // passing an absent optional explicitly is passing `undefined`.
  return <Deck got={got} {...(onTrail === undefined ? {} : { onTrail })} />;
}

/**
 * The screen with no lenses under it.
 *
 * Reading and refused share a shape because they share a problem: there is
 * no desk yet, and a lens row of zeroes would say the shop owes nobody a
 * word — which is the one thing this screen exists to know.
 */
function Bare({ say }: { readonly say: string }): ReactElement {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.titles}>
          <h1 className={s.title}>Messages</h1>
          <p className={s.sub}>{say}</p>
        </div>
      </header>
    </div>
  );
}

function Deck({
  got,
  onTrail,
}: {
  readonly got: Extract<ReturnType<typeof useDesk>, { at: 'ready' }>;
} & MessagesProps): ReactElement {
  const now = got.today;
  const base = got.data.desk;
  const { unreadable } = got.data;

  /**
   * Linking is the one thing on this screen that changes what the screen IS:
   * the Inbox lens does not exist until the number is linked, and the line at
   * the foot of the register disappears when it does.
   */
  const [linked, setLinked] = useState(base.link.linked);
  const desk: Desk = useMemo(
    () => ({ ...base, link: { ...base.link, linked } }),
    [base, linked],
  );

  const [lens, setLens] = useState<Lens>('money');
  const [dialog, setDialog] = useState<'link' | 'hold' | 'list' | null>(null);
  const [picked, setPicked] = useState<string | null>('owed-sample');
  const [tellPicked, setTellPicked] = useState<string | null>('tell-okello');
  const [chatPicked, setChatPicked] = useState<string | null>('chat-nakawa');
  const [extraPick, setExtraPick] = useState<string | null>(null);
  /** The account a promise is being written against, or none. */
  const [promiseFor, setPromiseFor] = useState<Owed | null>(null);

  const counts = lensCounts(desk, now);
  const here = counts.some((c) => c.lens === lens) ? lens : 'money';

  useEffect(() => {
    onTrail?.(here === 'posting' ? 'Posting' : null);
    return () => onTrail?.(null);
  }, [here, onTrail]);

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.titles}>
          <h1 className={s.title}>{TITLE[here]}</h1>
          <p className={s.sub}>
            {sub(desk, here)}
            {/* What the desk could NOT work out, above the lenses it did —
                because a lens reading zero and a lens that was never
                computed look identical, and only one of them is news. */}
            {unreadable.length > 0 && (
              <span className={s.subNote}> · {unreadable.length} not worked out</span>
            )}
          </p>
        </div>
        <div className={s.lenses} role="tablist" aria-label="Lenses">
          {counts.map((c) => (
            <button
              key={c.lens}
              type="button"
              role="tab"
              aria-selected={c.lens === here}
              className={`${s.lens} ${c.lens === here ? s.lensOn : ''}`}
              onClick={() => setLens(c.lens)}
            >
              {LENS_LABEL[c.lens]}
              {/* A badge is drawn only when its number is above zero. */}
              {c.count > 0 && (
                <span className={s.lensChip} style={TONE[c.wants ? c.tone : 'neutral']}>
                  {c.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {here === 'money' && (
        <MoneyLens
          desk={desk}
          now={now}
          picked={picked}
          onPick={setPicked}
          onHold={() => setDialog('hold')}
          onLink={() => setDialog('link')}
          onPromise={setPromiseFor}
        />
      )}
      {here === 'telling' && (
        <TellingLens
          desk={desk}
          now={now}
          picked={tellPicked}
          onPick={setTellPicked}
          onList={() => setDialog('list')}
        />
      )}
      {here === 'posting' && (
        <PostingLens desk={desk} extraPick={extraPick} onPick={setExtraPick} />
      )}
      {here === 'inbox' && (
        <InboxLens desk={desk} picked={chatPicked} onPick={setChatPicked} />
      )}

      {dialog === 'link' && (
        <LinkWhatsApp
          code={desk.link.code}
          onClose={() => setDialog(null)}
          onLinked={() => {
            setLinked(true);
            setDialog(null);
            setLens('inbox');
          }}
        />
      )}
      {dialog === 'hold' && (
        <HoldDialog name="Nakawa Traders" onClose={() => setDialog(null)} />
      )}
      {dialog === 'list' && <PickedListDialog onClose={() => setDialog(null)} />}
      {promiseFor !== null && (
        <PromiseDialog
          who={promiseFor}
          owes={promiseFor.atStake}
          oldestDays={promiseFor.oldestDays}
          today={now}
          onClose={() => setPromiseFor(null)}
        />
      )}
    </div>
  );
}

const TITLE: Record<Lens, string> = {
  money: 'Messages',
  telling: 'Worth telling someone',
  posting: 'What to post today',
  inbox: 'Messages',
};

/** Each lens says what it ranks on, in its own header. */
function sub(desk: Desk, lens: Lens): ReactElement | string {
  if (lens === 'money') {
    return 'One message a person, most at stake first · held back and sent are groups in this list';
  }
  if (lens === 'telling') {
    return 'Nothing is owed on these · soonest to stop being true at the top';
  }
  if (lens === 'posting') {
    const post = postingDesk(desk.posts, desk.signalRecords);
    return `${post.queue.length} products nominated · ranked by the signal, capped at ${DAILY_POST_CAP} a day · you pick, the rest roll over`;
  }
  const chats = desk.chats;
  const money = chats.filter((c) => c.about.kind === 'invoice').length;
  return (
    <>
      {countWord(chats.length)} chats came in ·{' '}
      <span className={s.subFig}>{money}</span>{' '}
      {money === 1 ? 'is' : 'are'} about money you are owed
    </>
  );
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const countWord = (n: number): string => WORDS[n] ?? String(n);

/* ========================================================================== */
/*  Money — frame 2a                                                          */
/* ========================================================================== */

function MoneyLens({
  desk,
  now,
  picked,
  onPick,
  onHold,
  onLink,
  onPromise,
}: {
  readonly desk: Desk;
  readonly now: Date;
  readonly picked: string | null;
  readonly onPick: (id: string | null) => void;
  readonly onHold: () => void;
  readonly onLink: () => void;
  /** The row itself, because the dialog's header is about that account. */
  readonly onPromise: (row: Owed) => void;
}): ReactElement {
  const money = moneyDesk(desk.owed, now);
  const riding = ridingOnIt(desk.owed, now);
  const paid = paidShare(desk.chaseRecord);
  const open = desk.owed.find((r) => r.id === picked) ?? money.toMessage[0];
  const shown = money.sentWaiting.slice(0, 3);

  return (
    <>
      <section className={s.tiles} aria-label="The position">
        <div className={s.tileBad}>
          <div className={s.tileLabelBad}>To message</div>
          <div className={s.tileFig}>{riding.count}</div>
          <div className={s.tileBasisBad}>
            {Money.format(riding.amount)} riding on it ·{' '}
            {match(riding.pastTerms, {
              known: (d) => `${d} days past your terms`,
              partial: (d) => `${d} days past your terms`,
              unavailable: () => 'no terms recorded on the account',
            })}
          </div>
        </div>

        {/* The four empty counts became one sentence. Five tiles of which
            four read 0 teach you to stop reading tiles. */}
        <div className={s.tile}>
          <div className={s.tileLabel}>Everything else is clear</div>
          <div className={s.tileSay}>
            Nothing promised falls due today, no goods or price news is waiting, and nobody
            has gone quiet.
          </div>
        </div>

        <div className={s.tile}>
          <div className={s.tileLabel}>Chases that got paid</div>
          <div className={s.tileFigGood}>
            {match(paid, {
              known: (pc) => `${pc}%`,
              partial: (pc) => `${pc}%`,
              unavailable: () => '—',
            })}
          </div>
          <div className={s.tileBasis}>
            {desk.chaseRecord.paid} of {desk.chaseRecord.sent} sent ·{' '}
            {desk.chaseRecord.daysToMoney} days to the money
          </div>
        </div>
      </section>

      <div className={s.work}>
        <section className={s.register} aria-label="Who you owe a word">
          <div className={s.cardHead}>
            <span className={s.cardTitle}>Who you owe a word</span>
            <span className={s.spacer} />
            {/* A number that changes who is in a list belongs beside the list
                it changes, not above the figures as the screen's first
                question. */}
            <span className={s.cardNote}>Quiet after</span>
            <button type="button" className={`${s.secondary} ${s.sizeSetting}`}>
              <span className={s.growFig}>{money.quietAfterDays}</span> days
              <Icon name="chevron-down" size={13} />
            </button>
          </div>

          <div className={s.scroll}>
            <div className={`${s.colHeadSticky} ${s.moneyCols}`}>
              <span />
              <span className={s.col}>Who, and what about</span>
              <span className={s.colRight}>At stake</span>
              <span className={s.colRight}>Last word</span>
              <span className={s.colRight}>State</span>
            </div>

            {money.held.map((row) => (
              <OwedRow
                key={row.id}
                row={row}
                now={now}
                on={row.id === picked}
                onPick={() => onPick(row.id)}
                state="held"
              />
            ))}

            {money.toMessage.map((row) => (
              <OwedRow
                key={row.id}
                row={row}
                now={now}
                on={row.id === picked}
                onPick={() => onPick(row.id)}
                state="draft"
              />
            ))}

            <div className={s.grow}>
              <span className={s.chip} style={TONE.neutral}>
                Sent, waiting on a reply
              </span>
              <span className={s.growCount}>{money.sentWaiting.length}</span>
              <span className={s.spacer} />
              <span className={s.growSay}>
                {match(money.oldestWaitingDays, {
                  known: (d) => `oldest ${d} days`,
                  partial: (d) => `oldest ${d} days`,
                  unavailable: () => 'nothing waiting',
                })}
              </span>
            </div>
            <div className={s.names}>
              {shown.map((r) => r.name).join(' · ')}
              {money.sentWaiting.length > shown.length &&
                ` · and ${money.sentWaiting.length - shown.length} more`}
            </div>

            {/* Empty, it is one line offering the action — not a band
                announcing that a group is empty. */}
            {money.held.length === 0 && (
              <div className={s.holdLine}>
                <Icon name="pause" size={15} className={s.cannotSeeIcon} />
                <span className={s.holdSay}>
                  <strong className={s.holdStrong}>Nobody is held back.</strong> Hold someone
                  and they appear here, above the list, with the reason and the date it lifts.
                </span>
                <button
                  type="button"
                  className={`${s.ghost} ${s.sizeRow}`}
                  onClick={onHold}
                >
                  Hold someone
                </button>
              </div>
            )}

            <div className={s.footLine}>
              <span className={s.footSay}>
                {desk.chaseRecord.sent} sent in {desk.chaseRecord.overDays} days · the record
                is this list on its Sent group
              </span>
              <button type="button" className={`${s.ghost} ${s.sizeRow}`}>
                Show sent
                <Icon name="arrow-right" size={13} />
              </button>
            </div>

            {/* Frame 3c. One line, at the foot of a list that has work in it. */}
            {!desk.link.linked && (
              <div className={s.linkLine}>
                <Icon name="message-dots" size={15} />
                <span className={s.linkSay}>
                  Chats could be answered here too. Link your number and the replies to these
                  messages arrive on this screen.
                </span>
                <button
                  type="button"
                  className={`${s.secondary} ${s.sizeLinkLine}`}
                  onClick={onLink}
                >
                  Link WhatsApp
                </button>
              </div>
            )}
          </div>
        </section>

        {open !== undefined && <DraftPanel row={open} desk={desk} onPromise={onPromise} />}
      </div>
    </>
  );
}

function OwedRow({
  row,
  now,
  on,
  onPick,
  state,
}: {
  readonly row: Owed;
  readonly now: Date;
  readonly on: boolean;
  readonly onPick: () => void;
  readonly state: 'draft' | 'held';
}): ReactElement {
  return (
    <button
      type="button"
      className={`${s.row} ${s.moneyCols} ${on ? s.rowOn : ''}`}
      aria-pressed={on}
      onClick={onPick}
    >
      <span className={s.av} style={TONE[row.tone]}>
        {row.initials}
      </span>
      <span className={s.cell}>
        <span className={s.name}>{row.name}</span>
        <span className={s.meta}>
          {[row.phone, row.place, row.about].filter((x) => x !== null).join(' · ')}
        </span>
      </span>
      <span className={s.stake}>{Money.format(row.atStake)}</span>
      <span className={s.cellRight}>
        <span className={s.lastWord}>
          {row.lastWord === null ? 'never' : `${waitedDays(row, now)} days`}
        </span>
        <span className={s.lastWordWhy}>
          {row.lastWord === null ? 'first ask' : `${row.chases} chases`}
        </span>
      </span>
      <span className={s.cellRight}>
        <span className={s.chip} style={TONE[state === 'held' ? 'neutral' : 'bad']}>
          {state === 'held' ? 'held' : 'draft'}
        </span>
      </span>
    </button>
  );
}

function DraftPanel({
  row,
  desk,
  onPromise,
}: {
  readonly row: Owed;
  readonly desk: Desk;
  readonly onPromise: (row: Owed) => void;
}): ReactElement {
  return (
    <aside className={s.panel} aria-label={`The message for ${row.name}`}>
      <div className={s.panelCard}>
        <div className={s.who}>
          <span className={s.whoAv}>{row.initials}</span>
          <div className={s.cell}>
            <div className={s.whoName}>{row.name}</div>
            <div className={s.whoMeta}>
              {[row.phone, row.place].filter((x) => x !== null).join(' · ')}
            </div>
          </div>
          <span className={s.chipOnNavy}>
            {row.lastWord === null ? 'first ask' : `${row.chases + 1}th chase`}
          </span>
        </div>

        <div className={s.panelBody}>
          <div className={s.owesRow}>
            <span className={s.owesLabel}>Owes</span>
            <span className={s.owesFig}>{Money.format(row.atStake)}</span>
          </div>
          <div className={s.owesBasis}>
            oldest of it {row.oldestDays} days ·{' '}
            {row.everPaid ? 'has paid before' : 'never paid on this account'}
          </div>

          {/* The reason this message asks for a total rather than an invoice. */}
          {row.invoice === null && (
            <div className={s.carried}>
              <strong>No invoice stands behind this balance.</strong> It was carried onto the
              account from earlier, so the message asks for the figure alone and offers to
              check it.
            </div>
          )}

          <div className={s.panelActions}>
            <button type="button" className={`${s.secondary} ${s.sizePanel}`}>
              Receive a payment
            </button>
            <button
              type="button"
              className={`${s.secondary} ${s.sizePanel}`}
              onClick={() => onPromise(row)}
            >
              They promised a date
            </button>
          </div>
        </div>

        <div className={s.panelRule}>
          <div className={s.draftHead}>
            <span className={s.owesLabel}>What will be sent</span>
            <span className={s.draftHint}>edit it — the box is what ships</span>
          </div>
          {/* A textarea, not a rendering: the box IS the message. */}
          <textarea
            className={s.draftBox}
            defaultValue={row.draft}
            rows={row.draft.split('\n').length}
            aria-label="The message that will be sent"
          />
          <div className={s.draftTools}>
            <span className={s.pill} style={TONE.neutral}>
              fits a phone
            </span>
            <button type="button" className={`${s.secondary} ${s.sizeRow}`}>
              Shorter
            </button>
            <button type="button" className={`${s.secondary} ${s.sizeRow}`}>
              Firmer
            </button>
            <button type="button" className={`${s.secondary} ${s.sizeRow}`}>
              Ring instead
            </button>
          </div>
        </div>

        <div className={s.panelRule}>
          <button type="button" className={`${s.handoff} ${s.sizeHandoff}`}>
            <Icon name="message-square" size={17} />
            Open WhatsApp with this
          </button>
          <div className={s.cannotSee}>
            <Icon name="eye-off" size={15} className={s.cannotSeeIcon} />
            <span className={s.cannotSeeSay}>
              The app cannot see WhatsApp. When you come back, say whether it went — nothing
              is recorded until you do.
            </span>
          </div>
          <div className={s.stamps}>
            <button type="button" className={`${s.secondary} ${s.sizeStamp}`}>
              <span className={s.stampWent}>
                <Icon name="check" size={15} strokeWidth={2.4} />
              </span>
              It was sent
            </button>
            <button type="button" className={`${s.secondary} ${s.sizeStamp}`}>
              <span className={s.stampDid}>
                <Icon name="x" size={15} strokeWidth={2.4} />
              </span>
              It was not
            </button>
          </div>
        </div>
      </div>

      <div className={s.panelPad}>
        <div className={s.owesLabel}>What gets answered</div>
        <div className={s.panelSay}>
          Out of {desk.chaseRecord.sent} sent: asking for a date gets a reply{' '}
          <strong className={s.panelStrong}>{desk.chaseRecord.repliedAskingDate}%</strong> of
          the time, the amount alone{' '}
          <strong className={s.panelStrong}>{desk.chaseRecord.repliedAskingAmount}%</strong>.
          This draft asks for a date, and offers to check the figure — which is the only thing
          that helps when no invoice stands behind it.
        </div>
      </div>
    </aside>
  );
}

/* ========================================================================== */
/*  Telling — frame 4a                                                        */
/* ========================================================================== */

function TellingLens({
  desk,
  now,
  picked,
  onPick,
  onList,
}: {
  readonly desk: Desk;
  readonly now: Date;
  readonly picked: string | null;
  readonly onPick: (id: string) => void;
  readonly onList: () => void;
}): ReactElement {
  const tell = tellingDesk(desk.telling, now);
  const open = tell.speak.find((t) => t.id === picked) ?? tell.speak[0];
  const best = bestKind(desk.tellingRecord);
  const priceShare = kindShare(desk.tellingRecord, 'price-move');
  const bestShare = best === null ? null : kindShare(desk.tellingRecord, best);

  return (
    <>
      <section className={s.tiles} aria-label="The position">
        <div className={s.tileInfo}>
          <div className={s.tileLabelInfo}>Say today, or not at all</div>
          <div className={s.tileFig}>{tell.sayToday}</div>
          <div className={s.tileBasisInfo}>
            a delivery on this afternoon&#8217;s run, and goods somebody asked for twice
          </div>
        </div>
        <div className={s.tileGood}>
          <div className={s.tileLabelGood}>Telling led to an order</div>
          <div className={s.tileFigGood}>
            {desk.tellingRecord.led} of {desk.tellingRecord.of}
          </div>
          <div className={s.tileBasisGood}>
            {Money.format(desk.tellingRecord.bought)} bought within a week ·{' '}
            {desk.tellingRecord.overDays} days
          </div>
        </div>
        <div className={s.tile}>
          <div className={s.tileLabel}>Best reason to speak</div>
          <div className={s.tileWord}>{best === null ? 'Nothing yet' : BEST_LABEL[best]}</div>
          <div className={s.tileBasis}>
            {bestShare === null
              ? 'nothing has been told yet'
              : match(bestShare, {
                  known: (_pc, basis) => basis,
                  partial: (_pc, basis) => basis,
                  unavailable: (why) => why,
                })}{' '}
            · telling a price cut,{' '}
            {match(priceShare, {
              known: (_pc, basis) => basis.replace(' bought', ''),
              partial: (_pc, basis) => basis.replace(' bought', ''),
              unavailable: () => 'not told yet',
            })}
          </div>
        </div>
      </section>

      <div className={s.workScroll}>
        <section className={s.card} aria-label="Three people, three reasons">
          <div className={s.cardHead}>
            <span className={s.cardTitle}>
              {countWord(tell.speak.length)} people, {countWord(tell.speak.length).toLowerCase()}{' '}
              reasons
            </span>
            <span className={s.cardNote}>
              each one is a fact from the books, not a greeting
            </span>
          </div>

          <div className={`${s.colHead} ${s.tellCols}`}>
            <span />
            <span className={s.col}>Who, and what you would say</span>
            <span className={s.col}>Why them</span>
            <span className={s.colRight}>Good until</span>
            <span className={s.colRight}>Next</span>
          </div>

          {tell.speak.map((t, i) => (
            <TellRow
              key={t.id}
              t={t}
              now={now}
              on={t.id === picked}
              first={i === 0}
              onPick={() => onPick(t.id)}
            />
          ))}

          {tell.betterPosted.length > 0 && (
            <>
              <div className={s.grow}>
                <span className={s.chip} style={TONE.studied}>
                  Better posted
                </span>
                <span className={s.growCount}>{tell.betterPosted.length}</span>
                <span className={s.spacer} />
                <span className={s.growSay}>
                  outside the three · a price on a product is the posting queue&#8217;s job
                </span>
              </div>
              {tell.betterPosted.map((t) => (
                <div key={t.id} className={`${s.rowAside} ${s.tellCols}`}>
                  <span className={s.av} style={TONE[t.tone]}>
                    {t.initials}
                  </span>
                  <span className={s.cell}>
                    <span className={s.name}>{t.name}</span>
                    <span className={s.meta}>{t.what}</span>
                  </span>
                  <span className={s.cell}>
                    <span className={s.pill} style={TONE[t.whyTone]}>
                      {t.whyThem}
                    </span>
                  </span>
                  <span className={s.cellRight}>
                    <span className={s.until}>{goodUntilLabel(t, now)}</span>
                  </span>
                  <span className={s.cellRight}>
                    <span className={s.pill} style={TONE.studied}>
                      {t.routeNote ?? 'in the queue'}
                    </span>
                  </span>
                </div>
              ))}
            </>
          )}

          {tell.expired.length > 0 && (
            <>
              <div className={s.grow}>
                <span className={s.chip} style={TONE.neutral}>
                  No longer worth saying
                </span>
                <span className={s.growCount}>{tell.expired.length}</span>
                <span className={s.spacer} />
                <span className={s.growSay}>dropped on their own · no message was sent</span>
              </div>
              <div className={`${s.rowGone} ${s.tellCols}`}>
                <span />
                <span className={s.cell}>
                  {tell.expired.map((t, i) => (
                    <span key={t.id} className={i === 0 ? s.goneLine : s.goneLineNext}>
                      {t.what}
                    </span>
                  ))}
                </span>
                <span />
                <span className={s.cellRight}>
                  <span className={s.untilGone}>expired</span>
                </span>
                <span />
              </div>
            </>
          )}
        </section>

        <div className={s.tellUnder}>
          <div className={s.tellCard}>
            <div className={s.owesLabel}>
              The draft for {open === undefined ? 'nobody' : open.name.split(' ')[0]}
            </div>
            <textarea
              className={s.tellBox}
              value={open?.draft ?? ''}
              readOnly
              rows={(open?.draft ?? '').split('\n').length}
              aria-label="The draft"
            />
            <div className={s.tellSay}>
              It names what he asked for, the price, how many there are, and that he was
              remembered. <strong className={s.panelStrong}>Five of the last six</strong>{' '}
              messages like this ended in an order.
            </div>
          </div>

          <div className={s.tellCard}>
            <div className={s.owesLabel}>Why this order, and not by amount</div>
            <div className={s.tellWhy}>
              On the <strong>Money</strong> lens, a message left unsent gets more urgent every
              day — the debt is still there. Here it gets <strong>less</strong> worth sending:
              goods somebody asked for are news for a day, a delivery is news until the van
              arrives, and a price cut is news only while the price holds.
              <br />
              <br />
              So the column that ranks this list is <strong>Good until</strong>, not an amount,
              and the bottom group is not a backlog — it is{' '}
              {countWord(tell.expired.length).toLowerCase()} reasons that quietly stopped being
              true, kept visible for a week so the shop can see what it missed.{' '}
              {match(tell.expiredWorth, {
                known: (worth) => (
                  <>
                    They were worth{' '}
                    <span className={s.tellWhyFig}>{Money.format(worth)}</span>.
                  </>
                ),
                partial: (worth, _basis, missing) => (
                  <>
                    {missing.startsWith('2 of 3') ? 'Two of those three' : 'Some of them'} were
                    worth <span className={s.tellWhyFig}>{Money.format(worth)}</span>.
                  </>
                ),
                unavailable: () => <>None of them carried a figure.</>,
              })}
            </div>
            <div className={s.tellSay}>
              <button type="button" className={`${s.secondary} ${s.sizeRow}`} onClick={onList}>
                One message to a picked list
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const BEST_LABEL: Record<TellingKind, string> = {
  'asked-for': 'What you asked for is in',
  delivery: 'Your order is on the van',
  'price-move': 'The price has moved',
  'back-in-stock': 'It is back on the shelf',
};

function TellRow({
  t,
  now,
  on,
  first,
  onPick,
}: {
  readonly t: Telling;
  readonly now: Date;
  readonly on: boolean;
  readonly first: boolean;
  readonly onPick: () => void;
}): ReactElement {
  const label = goodUntilLabel(t, now);
  return (
    <button
      type="button"
      className={`${s.row} ${s.tellCols} ${on ? s.rowOn : ''}`}
      aria-pressed={on}
      onClick={onPick}
    >
      <span className={s.av} style={TONE[t.tone]}>
        {t.initials}
      </span>
      <span className={s.cell}>
        <span className={s.name}>{t.name}</span>
        <span className={s.meta}>{t.what}</span>
      </span>
      <span className={s.cell}>
        <span className={s.pill} style={TONE[t.whyTone]}>
          {t.whyThem}
        </span>
      </span>
      <span className={s.cellRight}>
        <span className={label === 'today' ? s.untilNow : s.until}>{label}</span>
      </span>
      <span className={s.cellRight}>
        {/* The one accent on this lens: the reason that goes stale first. */}
        <span className={`${first ? s.primary : s.secondary} ${s.sizePick}`}>Write it</span>
      </span>
    </button>
  );
}

/* ========================================================================== */
/*  Posting — frame 1c, and 5i after a pick                                   */
/* ========================================================================== */

function PostingLens({
  desk,
  extraPick,
  onPick,
}: {
  readonly desk: Desk;
  readonly extraPick: string | null;
  readonly onPick: (id: string | null) => void;
}): ReactElement {
  const posts = useMemo(
    () =>
      extraPick === null
        ? desk.posts
        : desk.posts.map((p) => (p.id === extraPick ? { ...p, picked: true } : p)),
    [desk.posts, extraPick],
  );
  const queue = postingDesk(posts, desk.signalRecords);
  const best = [...desk.signalRecords].sort((a, b) => b.moved / b.of - a.moved / a.of)[0];
  const card = queue.picked[0];

  return (
    <>
      <section className={s.tiles4} aria-label="The position">
        <div className={s.tile}>
          <div className={s.tileLabel}>Picked for today</div>
          <div className={s.slots}>
            {Array.from({ length: queue.cap }, (_, i) => (
              <span key={i} className={i < queue.picked.length ? s.slotTaken : s.slot} />
            ))}
            <span className={s.slotsFig}>
              {queue.picked.length} of {queue.cap}
            </span>
          </div>
          <div className={s.tileBasis}>
            {queue.placesLeft === 0
              ? 'the day is full'
              : queue.placesLeft === 1
                ? 'one slot left'
                : `${queue.placesLeft} slots left`}{' '}
            · {queue.rollsOver} roll to tomorrow
          </div>
        </div>
        <div className={s.tileGood}>
          <div className={s.tileLabelGood}>Sold after a post</div>
          <div className={s.tileFigGood}>{Money.format(desk.soldAfterPosts.amount)}</div>
          <div className={s.tileBasisGood}>
            {desk.soldAfterPosts.posts} posts · within {desk.soldAfterPosts.withinDays} days of
            the stamp
          </div>
        </div>
        <div className={s.tile}>
          <div className={s.tileLabel}>Signal that sells best</div>
          <div className={s.tileFig}>
            {best === undefined ? '—' : capitalise(SIGNAL_LABEL[best.signal])}
          </div>
          <div className={s.tileBasis}>
            {best === undefined ? 'nothing stamped yet' : `${best.moved} of ${best.of} moved`} ·
            idle stock, {idleRecord(desk)}
          </div>
        </div>
        <div className={s.tile}>
          <div className={s.tileLabel}>Held back</div>
          <div className={s.tileFig}>{queue.held.length}</div>
          <div className={s.tileBasis}>too little stock to fill an order</div>
        </div>
      </section>

      <div className={s.work}>
        <section className={s.register} aria-label="The queue">
          <div className={s.cardHead}>
            <span className={s.cardTitle}>The queue</span>
            <span className={s.cardNote}>every row says why it is here</span>
            <span className={s.spacer} />
            <button type="button" className={`${s.ghost} ${s.sizeSetting}`}>
              Why this order
            </button>
          </div>

          <div className={`${s.colHead} ${s.postCols}`}>
            <span className={s.col}>#</span>
            <span />
            <span className={s.col}>Product</span>
            <span className={s.col}>Why it is here</span>
            <span className={s.colRight}>Cover</span>
            <span className={s.colRight}>You keep</span>
            <span className={s.colRight}>Pick</span>
          </div>

          <div className={s.scroll}>
            {queue.queue.map((p, i) => (
              <PostRow
                key={p.id}
                p={p}
                n={i + 1}
                onPick={() => onPick(p.id)}
                full={queue.placesLeft === 0}
              />
            ))}

            <div className={s.grow}>
              <span className={s.chip} style={TONE.neutral}>
                Held back
              </span>
              <span className={s.growCount}>{queue.held.length} products</span>
              <span className={s.spacer} />
              <span className={s.growSay}>not enough stock to fill an order</span>
            </div>

            {queue.held.map((p) => (
              <HeldRow key={p.id} p={p} />
            ))}
          </div>
        </section>

        <aside className={s.panel} aria-label="What will be posted">
          {card !== undefined && (
            <PostPanel post={card} n={1} of={queue.picked.length} />
          )}

          <div className={s.panelPad}>
            <div className={s.cardTitle}>Which signals actually sell</div>
            <div className={s.bars}>
              {desk.signalRecords
                .filter((r) => r.signal !== 'margin')
                .map((r) => {
                  const share = signalShare(r);
                  const pc = share.status === 'unavailable' ? 0 : share.value;
                  // Green when a signal mostly works, grey when it is a coin
                  // toss, amber when it mostly does not. The bar and the
                  // figure are one fact, so they take the same reading.
                  const tone: BarTone = pc >= 60 ? 'good' : pc >= 40 ? 'flat' : 'warn';
                  return (
                    <div key={r.signal}>
                      <div className={s.barHead}>
                        <span className={s.barName}>{capitalise(SIGNAL_LABEL[r.signal])}</span>
                        <span
                          className={
                            tone === 'good' ? s.barFig : tone === 'flat' ? s.barFigFlat : s.barFigWarn
                          }
                        >
                          {r.moved} of {r.of}
                        </span>
                      </div>
                      <div className={s.barTrack}>
                        <i
                          className={
                            tone === 'good'
                              ? s.barFill
                              : tone === 'flat'
                                ? s.barFillFlat
                                : s.barFillWarn
                          }
                          style={{ width: `${pc}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className={s.panelSay}>
              Of {desk.soldAfterPosts.posts} posts stamped in {desk.chaseRecord.overDays} days,
              a price cut moved the line five times out of six. Idle stock almost never moves
              on a post alone — those need the three past buyers told directly, which is what
              the second pick does.
            </div>
          </div>

          <TodaysPicks queue={queue} justAdded={extraPick} onUndo={() => onPick(null)} />
        </aside>
      </div>
    </>
  );
}

type BarTone = 'good' | 'flat' | 'warn';

const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

const idleRecord = (desk: Desk): string => {
  const idle = desk.signalRecords.find((r) => r.signal === 'idle-stock');
  return idle === undefined ? 'not posted yet' : `${idle.moved} of ${idle.of}`;
};

function PostRow({
  p,
  n,
  onPick,
  full,
}: {
  readonly p: Post;
  readonly n: number;
  readonly onPick: () => void;
  readonly full: boolean;
}): ReactElement {
  const cover = coverDays(p);
  const keep = keepShare(p);
  return (
    <div className={`${s.row} ${s.postCols} ${p.picked ? s.rowOn : ''}`}>
      <span className={s.postNo}>{n}</span>
      <span className={p.picked ? s.postMarkOn : s.postMark}>
        <Icon name={POST_MARK[p.signal]} size={18} strokeWidth={1.9} />
      </span>
      <span className={s.cell}>
        <span className={s.name}>{p.product}</span>
        <span className={s.meta}>{p.why}</span>
      </span>
      <span className={s.cell}>
        <span className={s.chipSmall} style={TONE[SIGNAL_TONE[p.signal]]}>
          {p.signal === 'price-cut' && <Icon name="arrow-down" size={12} strokeWidth={2.4} />}
          {SIGNAL_LABEL[p.signal]}
          {p.signal === 'margin' &&
            match(keep, {
              known: (pc) => ` ${pc}%`,
              partial: (pc) => ` ${pc}%`,
              unavailable: () => '',
            })}
        </span>
      </span>
      <span className={s.cover}>
        {match<number, ReactNode>(cover, {
          known: (d) => `${d} days`,
          partial: (d) => `${d} days`,
          // Not "0 days" and not "forever": nothing has sold, so there is no
          // rate to divide the shelf by.
          unavailable: () => <span className={s.coverNone}>no sales</span>,
        })}
      </span>
      <span className={s.keep}>
        {match<number, ReactNode>(keep, {
          known: (pc) => (pc === 0 ? 'at cost' : `${pc}%`),
          partial: (pc) => `${pc}%`,
          unavailable: () => <span className={s.keepFlat}>&#8212;</span>,
        })}
      </span>
      <span className={s.cellRight}>
        {p.picked ? (
          <span className={s.chipPicked}>picked</span>
        ) : (
          <button
            type="button"
            className={`${s.secondary} ${s.sizePick}`}
            onClick={onPick}
            disabled={full}
          >
            Pick
          </button>
        )}
      </span>
    </div>
  );
}

function HeldRow({ p }: { readonly p: Post }): ReactElement {
  const cover = coverDays(p);
  const keep = keepShare(p);
  return (
    <div className={`${s.rowHeld} ${s.postCols}`}>
      <span className={s.postNo}>&#8212;</span>
      <span className={s.postMark}>
        <Icon name="bin" size={18} strokeWidth={1.9} />
      </span>
      <span className={s.cell}>
        <span className={s.name}>{p.product}</span>
        <span className={s.meta}>{p.why}</span>
      </span>
      <span className={s.cell}>
        <span className={s.chipSmall} style={TONE.bad}>
          low stock
        </span>
      </span>
      <span className={s.coverThin}>
        {match(cover, {
          known: (d) => `${d} days`,
          partial: (d) => `${d} days`,
          unavailable: () => 'no sales',
        })}
      </span>
      <span className={s.keepFlat}>
        {match(keep, {
          known: (pc) => `${pc}%`,
          partial: (pc) => `${pc}%`,
          unavailable: () => '—',
        })}
      </span>
      <span className={s.heldSay}>held</span>
    </div>
  );
}

function PostPanel({
  post,
  n,
  of,
}: {
  readonly post: Post;
  readonly n: number;
  readonly of: number;
}): ReactElement {
  const card = post.card;
  const cover = coverDays(post);
  return (
    <div className={s.panelCard}>
      <div className={s.who}>
        <div className={s.cell}>
          <div className={s.whoName}>{post.product}</div>
          <div className={s.whoMeta}>
            post {n} of {of} picked · {SIGNAL_LABEL[post.signal]}
          </div>
        </div>
        {card !== null && !card.photo && <span className={s.chipOnNavy}>no photo</span>}
      </div>

      <div className={s.panelBody}>
        <div className={s.draftHead}>
          <span className={s.owesLabel}>What will be posted</span>
          <span className={s.draftHint}>edit it — the box is what ships</span>
        </div>

        {card !== null && (
          <>
            <div className={s.postCard}>
              <div className={s.postCardTop}>
                <div className={s.postShop}>Ssekitoleko Hardware</div>
                <div className={s.postProduct}>{post.product}</div>
                <div className={s.postSpec}>{card.spec}</div>
                <div className={s.postPrices}>
                  <span className={s.postPrice}>{Money.format(card.price)}</span>
                  {card.wasPrice !== null && (
                    <span className={s.postWas}>{Money.format(card.wasPrice)}</span>
                  )}
                </div>
                <div className={s.postFoot}>
                  <span className={s.postStock}>
                    {match(cover, {
                      known: (d) => `${d} days of stock`,
                      partial: (d) => `${d} days of stock`,
                      unavailable: () => 'in the yard',
                    })}
                  </span>
                  <span className={s.postWhere}>
                    {card.phone} · {card.place}
                  </span>
                </div>
              </div>
              {!card.photo && (
                <div className={s.noPhoto}>
                  <Icon name="image" size={14} />
                  <span className={s.noPhotoSay}>
                    No photo on this product — a price card is used instead
                  </span>
                  <button type="button" className={`${s.ghost} ${s.sizeTiny}`}>
                    Add one
                  </button>
                </div>
              )}
            </div>

            <textarea
              className={s.postBox}
              defaultValue={card.message}
              rows={card.message.split('\n').length}
              aria-label="The post that will go out"
            />
          </>
        )}

        <div className={s.postTools}>
          <button type="button" className={`${s.ghost} ${s.sizeTiny}`}>
            Shorter
          </button>
          <button type="button" className={`${s.ghost} ${s.sizeTiny}`}>
            Add a photo
          </button>
          <button type="button" className={`${s.ghost} ${s.sizeTiny} ${s.pushRight}`}>
            Swap product
          </button>
        </div>
      </div>

      <div className={s.postStampArea}>
        <button type="button" className={`${s.handoff} ${s.sizeHandoff}`}>
          <Icon name="message-circle" size={16} />
          Open WhatsApp with this
        </button>
        <div className={s.stampBlock}>
          <div className={s.stampWhy}>
            <Icon name="eye-off" size={15} className={s.cannotSeeIcon} />
            <span className={s.stampWhySay}>
              The app cannot see what you post. Stamping it is what lets the next three days of
              sales be read against it.
            </span>
          </div>
          <div className={s.stampRow}>
            <button type="button" className={`${s.secondary} ${s.sizeStamp}`}>
              <span className={s.stampWent}>
                <Icon name="check" size={14} strokeWidth={2.4} />
              </span>
              It was posted
            </button>
            <button type="button" className={`${s.secondary} ${s.sizeStamp}`}>
              <span className={s.stampDid}>
                <Icon name="x" size={14} strokeWidth={2.4} />
              </span>
              It was not
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Today's picks, and — once something has just been picked — frame 5i.
 *
 * The result of a pick has to say what is LEFT of the day's cap and offer
 * Undo beside the next write. A pick that changed a chip and said nothing
 * else is a tap that looks like it did nothing.
 */
function TodaysPicks({
  queue,
  justAdded,
  onUndo,
}: {
  readonly queue: ReturnType<typeof postingDesk>;
  readonly justAdded: string | null;
  readonly onUndo: () => void;
}): ReactElement {
  if (justAdded !== null) {
    return (
      <div className={s.panelCard}>
        <div className={s.grow}>
          <span className={s.growTitle}>Picked for today</span>
          <span className={s.spacer} />
          <span className={s.growFig}>
            {queue.picked.length} of {queue.cap}
          </span>
        </div>
        {queue.picked.map((p, i) => (
          <div
            key={p.id}
            className={p.id === justAdded ? s.pickedRowNew : s.pickedRow}
          >
            <span className={s.pickedNo}>{i + 1}</span>
            <div className={s.cell}>
              <div className={s.pickedName}>{p.product}</div>
              {p.id === justAdded && <div className={s.pickedWhy}>{p.why}</div>}
            </div>
            {p.id === justAdded ? (
              <span className={s.chipSmall} style={TONE.studied}>
                just added
              </span>
            ) : (
              <span className={s.pill} style={TONE[SIGNAL_TONE[p.signal]]}>
                {SIGNAL_LABEL[p.signal]}
              </span>
            )}
          </div>
        ))}
        <div className={s.pickedFoot}>
          <span className={s.pickedSay}>
            {queue.placesLeft === 0
              ? 'That is the day full.'
              : queue.placesLeft === 1
                ? 'One place left today.'
                : `${queue.placesLeft} places left today.`}{' '}
            {DAILY_POST_CAP} a day is the cap, because a fourth post in a day halved the
            replies.
          </span>
          <button type="button" className={`${s.secondary} ${s.sizeQueue}`} onClick={onUndo}>
            Undo
          </button>
          <button type="button" className={`${s.primary} ${s.sizeQueue}`}>
            Write post {queue.picked.length}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.panelPad}>
      <div className={s.owesLabel}>Today&#8217;s picks</div>
      <div className={s.picks}>
        {queue.picked.map((p, i) => (
          <div key={p.id} className={s.pickRow}>
            <span className={i === 0 ? s.pickNo : s.pickNoQuiet}>{i + 1}</span>
            <span className={i === 0 ? s.pickName : s.pickNameQuiet}>{p.product}</span>
            <span className={s.pill} style={TONE[SIGNAL_TONE[p.signal]]}>
              {SIGNAL_LABEL[p.signal]}
            </span>
          </div>
        ))}
        {Array.from({ length: queue.placesLeft }, (_, i) => (
          <div key={i} className={s.pickRowOpen}>
            <span className={s.pickNoOpen}>{queue.picked.length + i + 1}</span>
            <span className={s.pickNameOpen}>one slot open</span>
          </div>
        ))}
      </div>
      <div className={s.picksFoot}>
        {DAILY_POST_CAP} a day is the cap, set in Setup. More than that and the replies fall
        off — the posts start competing with each other.
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Inbox — frame 5a                                                          */
/* ========================================================================== */

function InboxLens({
  desk,
  picked,
  onPick,
}: {
  readonly desk: Desk;
  readonly picked: string | null;
  readonly onPick: (id: string) => void;
}): ReactElement {
  const chats = desk.chats;
  const open = chats.find((c) => c.id === picked) ?? chats[0];

  return (
    <div className={s.work}>
      <section className={s.register} aria-label="Chats">
        <div className={s.grow}>
          <span className={s.cardTitle}>Newest first</span>
          <span className={s.spacer} />
          <span className={s.cardNote}>chats stay here for 30 days</span>
        </div>
        <div className={s.scroll}>
          {chats.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${s.chatRow} ${c.id === open?.id ? s.chatRowOn : ''}`}
              onClick={() => onPick(c.id)}
            >
              <span className={s.av} style={TONE[c.tone]}>
                {c.initials}
              </span>
              <span className={s.cell}>
                <span className={s.chatTop}>
                  <span className={s.chatName}>{c.name}</span>
                  <span className={s.chatAt}>{clock(c.at)}</span>
                </span>
                <span className={s.chatPreview}>{c.preview}</span>
                <span className={s.chatAbout}>
                  {c.about.kind === 'invoice' && (
                    <>
                      <span className={s.pill} style={TONE.bad}>
                        {c.about.doc.replace('-', '‑')}
                      </span>
                      <span className={s.chatAboutSay}>
                        they owe{' '}
                        <span className={s.chatAboutFig}>{Money.format(c.about.owes)}</span> ·{' '}
                        {c.about.days} days
                      </span>
                    </>
                  )}
                  {c.about.kind === 'order' && (
                    <>
                      <span className={s.pill} style={TONE.info}>
                        {c.about.doc.replace('-', '‑')}
                      </span>
                      <span className={s.chatAboutSay}>{c.about.line}</span>
                    </>
                  )}
                  {(c.about.kind === 'none' || c.about.kind === 'supplier') && (
                    <span className={s.chatAboutSay}>{c.about.line}</span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {open !== undefined && <Thread chat={open} />}
    </div>
  );
}

function Thread({ chat }: { readonly chat: Chat }): ReactElement {
  return (
    <aside className={s.panelThread} aria-label={`The chat with ${chat.name}`}>
      <div className={s.panelCard}>
        <div className={s.who}>
          <div className={s.cell}>
            <div className={s.whoName}>{chat.name}</div>
            <div className={s.whoMeta}>{chat.phone} · chat on WhatsApp</div>
          </div>
        </div>
        <div className={s.thread}>
          {chat.lines.map((line, i) => (
            <Bubble key={i} line={line} />
          ))}
        </div>
        <div className={s.replyArea}>
          <button type="button" className={s.replyBox}>
            Write a reply
          </button>
          <div className={s.replyActions}>
            <button type="button" className={`${s.primary} ${s.sizeDialog}`}>
              Send the reply
            </button>
            {/* A money chat offers the second door: the promise in the thread
                is a figure the books can hold. */}
            {chat.promised !== null && (
              <button type="button" className={`${s.secondary} ${s.sizeDialog}`}>
                Record {Money.format(chat.promised)} promised
              </button>
            )}
          </div>
        </div>
      </div>
      <div className={s.threadNote}>
        A reply typed here leaves through your own number. Nothing is sent on a schedule and
        nothing is sent without this button.
      </div>
    </aside>
  );
}

function Bubble({ line }: { readonly line: Chat['lines'][number] }): ReactElement {
  const us = line.from === 'us';
  return (
    <>
      <div className={us ? s.bubbleUs : s.bubbleThem}>{line.text}</div>
      <div className={us ? s.bubbleAtUs : s.bubbleAtThem}>
        {us ? `sent by ${line.by ?? 'you'} · ` : 'today '}
        {clock(line.at)}
      </div>
    </>
  );
}

/* ========================================================================== */
/*  What the register opens — 5c, 5e, 5g                                      */
/* ========================================================================== */

/**
 * Picking a day the words do not cover — frame 6e's grid.
 *
 * The month opens on Monday and **the blanks before the 1st are the whole
 * point**: without them every date sits under the wrong weekday heading for
 * a month, which is the one mistake a calendar cannot make.
 *
 * A day already gone is drawn and disabled rather than hidden. The books
 * accept a promise for a past day — somebody who named yesterday and missed
 * it is a record worth keeping — but offering one as a fresh choice here
 * would almost always be catching a mis-tap rather than an intention.
 */
function DayPicker({
  month,
  chosen,
  today,
  onMonth,
  onPick,
  onDone,
}: {
  readonly month: Date;
  readonly chosen: Date | null;
  readonly today: Date;
  readonly onMonth: (d: Date) => void;
  readonly onPick: (d: Date) => void;
  readonly onDone: () => void;
}): ReactElement {
  const grid = monthGrid(month, today);

  return (
    <div className={s.picker}>
      <div className={s.pickerHead}>
        <span className={s.pickerMonth}>{grid.label}</span>
        <button
          type="button"
          className={`${s.secondary} ${s.pickerStep}`}
          onClick={() => onMonth(stepMonth(grid.firstOfMonth, -1))}
          aria-label="The month before"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <button
          type="button"
          className={`${s.secondary} ${s.pickerStep}`}
          onClick={() => onMonth(stepMonth(grid.firstOfMonth, 1))}
          aria-label="The month after"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      <div className={s.pickerGrid}>
        {WEEK_HEADINGS.map((h, i) => (
          <div key={i} className={s.pickerHeading}>
            {h}
          </div>
        ))}
        {Array.from({ length: grid.blanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {grid.days.map((d) => (
          <button
            key={d.on.toISOString()}
            type="button"
            disabled={d.past}
            className={`${s.pickerDay} ${chosen?.getTime() === d.on.getTime() ? s.pickerDayOn : ''}`}
            onClick={() => onPick(d.on)}
          >
            {d.on.getUTCDate()}
          </button>
        ))}
      </div>

      {/* 6e's order: the grid, then the day in words, then the control that
          accepts it. The line has to sit where it is read before the tap. */}
      <div className={s.promiseResolved}>
        {chosen === null ? 'No day named yet.' : describeDay(chosen, today)}
      </div>
      {/* Secondary, not navy: "Write it down" is this dialog's one commit,
          and a second filled control above it competes to be the thing the
          owner presses. On the phone sheet this is the bottom button and
          carries the weight; here it only folds the grid away. */}
      <button type="button" className={`${s.secondary} ${s.pickerDone}`} onClick={onDone}>
        Use this day
      </button>
    </div>
  );
}

/** "Saturday" — the weekday alone, for the sentence that names the day. */
const weekdayOf = (d: Date): string =>
  d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });

/**
 * Writing down what they said — frame 6a.
 *
 * The popup behind *They promised a date*. It writes one row into
 * `payment_promises` and nothing else. **It is not a payment**: *Receive a
 * payment* sits beside it and stays the only control that touches money,
 * and nothing is sent to the customer either — writing down an answer is
 * not a reply. The grey band says so in prose before the commit, because
 * that is the one thing a clerk could get wrong.
 *
 * The day is the only required field. Everything else is optional, and the
 * amount being empty is not an unfinished form — it MEANS the whole
 * balance, which the line under the field says out loud rather than hiding
 * in a tooltip.
 */
function PromiseDialog({
  who,
  owes,
  oldestDays,
  today,
  onClose,
}: {
  readonly who: { readonly id: string; readonly name: string };
  readonly owes: Money.Money;
  readonly oldestDays: number;
  readonly today: Date;
  readonly onClose: () => void;
}): ReactElement {
  const chips = promiseDayChips(today);
  const [on, setOn] = useState<Date | null>(chips[1]?.on ?? chips[0]?.on ?? null);
  /** The month the picker is showing, or none while the chips are up. */
  const [picking, setPicking] = useState<Date | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const promise = useRecordPromise();

  const named = Money.parse(amount);
  const short = on === null ? null : unspokenFor(named, owes);
  const draft = draftPromise({ promisedOn: on, amount: named, note }, today);

  const commit = (): void => {
    if (draft.ok) promise.write(who.id, draft.record);
  };

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label={`What did ${who.name} say?`}>
      <div className={s.dialogPromise}>
        <div className={s.promiseHead}>
          <div className={s.cell}>
            <div className={s.promiseTitle}>What did they say?</div>
            {/* One reckoning: the same balance the register shows. */}
            <div className={s.promiseWho}>
              {who.name} · owes <span className={s.fig}>{Money.format(owes)}</span> · oldest{' '}
              <span className={s.fig}>{oldestDays}</span> days
            </div>
          </div>
          <button type="button" className={s.promiseClose} onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className={s.promiseBody}>
          <div className={s.promiseLabel}>They will pay on</div>
          {picking === null ? (
            <div className={s.promiseChips}>
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`${on?.getTime() === c.on.getTime() ? s.secondaryOn : s.secondary} ${s.sizeWord}`}
                  onClick={() => setOn(c.on)}
                >
                  {c.label} {c.detail !== '' && <span className={s.chipDate}>{c.detail}</span>}
                </button>
              ))}
              {/* Anything the four words do not cover. Opened here rather
                  than in a second window: the balance and the sentence
                  below stay on screen while the day is chosen. */}
              <button
                type="button"
                className={`${s.secondary} ${s.sizeWord}`}
                onClick={() => setPicking(on ?? today)}
              >
                <Icon name="calendar" size={14} />
                Pick a day
              </button>
            </div>
          ) : (
            <DayPicker
              month={picking}
              chosen={on}
              today={today}
              onMonth={setPicking}
              onPick={setOn}
              onDone={() => setPicking(null)}
            />
          )}
          {/* Generated from the date, never written beside it: the weekday
              and the date have to agree, or this line manufactures the very
              mis-tap it exists to catch. */}
          {picking === null && (
            <div className={s.promiseResolved}>
              {on === null ? 'No day named yet.' : describeDay(on, today)}
            </div>
          )}
        </div>

        <div className={s.promiseFields}>
          <div className={s.promiseAmount}>
            <div className={s.promiseLabel}>
              How much <span className={s.promiseOptional}>optional</span>
            </div>
            <div className={s.promiseInputRow}>
              <input
                className={s.promiseInput}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={Money.format(owes)}
                aria-label="How much they promised"
              />
              <span className={s.promiseUnit}>UGX</span>
            </div>
            <div className={s.promiseHint}>Empty means the whole balance</div>
            {/* A promise for part of a debt is not a promise about the debt,
                and the screen must not let that pass quietly. */}
            {short !== null && (
              <div className={s.promisePart}>
                Part of {Money.format(owes)} — {Money.format(short)} unspoken for
              </div>
            )}
          </div>

          <div className={s.promiseNote}>
            <div className={s.promiseLabel}>
              In their words <span className={s.promiseOptional}>optional</span>
            </div>
            <div className={s.promiseInputRow}>
              <input
                className={s.promiseWords}
                value={note}
                maxLength={PROMISE_NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                placeholder="“after the Nateete job pays us”"
                aria-label="What they said, in their words"
              />
            </div>
            <div className={s.promiseCount}>
              <span className={s.fig}>{note.length}</span> / {PROMISE_NOTE_MAX}
            </div>
          </div>
        </div>

        <div className={s.promiseSays}>
          <Icon name="alert-circle" size={14} className={s.promiseSaysIcon} />
          <div className={s.cell}>
            No money is received and nothing is charged. The{' '}
            <span className={s.fig}>{Money.format(owes)}</span> still stands.
            {on !== null && (
              <>
                {' '}
                If {weekdayOf(on)} passes unpaid, this becomes a <strong>broken promise</strong> —
                which is the evidence the shop chases on.
              </>
            )}
          </div>
        </div>

        <div className={s.promiseFoot}>
          <span className={s.promiseFootNote}>
            {promise.state.at === 'refused'
              ? promise.state.why
              : promise.state.at === 'written'
                ? 'Written down. It sits on top of the last one.'
                : draft.ok
                  ? 'Kept as said, on top of the last one. Nothing is overwritten.'
                  : draft.why}
          </span>
          <button type="button" className={`${s.secondary} ${s.sizeFooter}`} onClick={onClose}>
            {promise.state.at === 'written' ? 'Close' : 'Cancel'}
          </button>
          {promise.state.at !== 'written' && (
            <button
              type="button"
              className={`${s.commit} ${s.sizeFooterCommit}`}
              disabled={!draft.ok || promise.state.at === 'writing'}
              onClick={commit}
            >
              {promise.state.at === 'writing' ? 'Writing…' : 'Write it down'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Holding someone — frame 5e.
 *
 * The reason is the point, so it is the first field and it is offered as four
 * words rather than a blank box. *Until* defaults to the promise already in
 * the thread, so a hold expires instead of hiding someone forever. The commit
 * is navy: holding is not the screen's next action.
 */
function HoldDialog({
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
      <div className={s.dialogHold}>
        <div className={s.holdTitle}>Hold {name}</div>
        <div className={s.holdSub}>
          They stay in the list, above it, with the reason showing. No message goes out while
          they are held.
        </div>

        <div className={s.holdLabel}>Why</div>
        <div className={s.holdWords}>
          {HOLD_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${r.id === reason ? s.secondaryOn : s.secondary} ${s.sizeWord}`}
              onClick={() => setReason(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className={s.holdLabel}>
          Note <span className={s.holdOptional}>optional</span>
        </div>
        <input
          className={s.holdNote}
          defaultValue="Promised 1,000,000 on Friday"
          aria-label="A note on the hold"
        />

        <div className={s.holdLabel}>Until</div>
        <div className={s.holdWords}>
          {['Friday', '7 days', 'No date'].map((u) => (
            <button
              key={u}
              type="button"
              className={`${u === until ? s.secondaryOn : s.secondary} ${s.sizeWord}`}
              onClick={() => setUntil(u)}
            >
              {u}
            </button>
          ))}
        </div>

        <div className={s.holdActions}>
          <button type="button" className={`${s.secondary} ${s.sizeCommit}`} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${s.commit} ${s.sizeCommit}`} onClick={onClose}>
            Hold them
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One message, many people — frame 5g.
 *
 * The screen states the part that could go wrong: `{name}` fills itself, each
 * person gets their own copy one at a time, and each send is stamped on that
 * person's row.
 */
function PickedListDialog({ onClose }: { readonly onClose: () => void }): ReactElement {
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
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label="One message, three people">
      <div className={s.dialogList}>
        <div className={s.dialogHead}>
          <span className={s.dialogTitle}>One message, {countWord(who.length).toLowerCase()} people</span>
          <span className={s.spacer} />
          <span className={s.dialogNote}>picked from the Telling lens</span>
        </div>

        <div className={s.listBody}>
          <div className={s.listWho}>
            <div className={s.grow}>
              <span className={s.listHead}>Who gets it</span>
              <span className={s.spacer} />
              <span className={s.growFig}>
                {who.length} of {PICKED_LIST_CANDIDATES}
              </span>
            </div>
            {who.map((p) => (
              <div key={p.name} className={s.listRow}>
                <span className={s.tick}>
                  <Icon name="check" size={10} strokeWidth={3.4} />
                </span>
                <div className={s.cell}>
                  <div className={s.listName}>{p.name}</div>
                  <div className={s.listWhy}>{p.why}</div>
                </div>
              </div>
            ))}
            <div className={s.listRowMore}>
              <span className={s.tickOff} />
              <div className={s.cell}>
                <div className={s.listName}>
                  {PICKED_LIST_CANDIDATES - who.length} more on the lens
                </div>
              </div>
            </div>
          </div>

          <div className={s.listMessage}>
            <div className={s.tileLabel}>The message</div>
            <textarea
              className={s.listBox}
              defaultValue={message}
              rows={message.split('\n').length}
              aria-label="The message every person gets"
            />
            <div className={s.listFills}>
              <span className={s.pill} style={TONE.studied}>
                {'{name}'} fills itself
              </span>
              <span className={s.listFillsSay}>
                each person gets their own copy, one at a time
              </span>
            </div>
            <div className={s.listActions}>
              <span className={s.listActionsSay}>
                Nothing leaves until you press send. Each send is stamped on that
                person&#8217;s row.
              </span>
              <button
                type="button"
                className={`${s.secondary} ${s.sizeDialog}`}
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="button" className={`${s.primary} ${s.sizeDialog}`} onClick={onClose}>
                Send to {who.length}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
