/**
 * Reading the Messages desk from the real books.
 *
 * ## What the desk is, and which half of it the database can answer
 *
 * The desk has four lenses. Two of them are about PEOPLE and money, and the
 * database holds both halves: who owes what (`customers` and `saved_quotes`,
 * through the same register the Customers screen reads) and what has been
 * said to them (`wa_conversations` and `wa_messages`). Those are derived
 * here in full.
 *
 * **Posting is not**, and it is left empty with the reason said out loud.
 * A nomination is "this product is worth posting", which needs what is on
 * the shelf, what it sells at, and what it has been moving — `stock`,
 * `prices` and a sales rate. That is the Catalogue group's work. `wa_posts`
 * only records what was ALREADY posted, so deriving the lens from it would
 * answer a different question and look like an answer to this one.
 *
 * **Telling** is derived for the one kind the schema records plainly: a
 * customer who asked for something the shop did not have, which is exactly
 * what `follow_ups` is. Deliveries, price moves and back-in-stock need the
 * same Catalogue tables as Posting.
 *
 * ## The records read as "nothing yet", and that is the domain working
 *
 * `paidShare`, `kindShare` and `signalShare` all return `unavailable` when
 * their denominator is zero, so a record this pass cannot compute shows as
 * "nothing has been sent yet" rather than as 0%. That is why they are
 * returned empty rather than filled with plausible numbers.
 */

import {
  NOT_DERIVED,
  Money,
  balance,
  daysPastDue,
  oldestDebtDays,
  openInvoices,
  owedOn,
  type Chat,
  type ChatLine,
  type MoneyAmount,
  type Customer,
  type Derived,
  type Desk,
  type Link,
  type Owed,
  type Telling,
  type Tone,
  known,
  unavailable,
} from '@ow/domain';
import { current } from './client.js';
import { readDate, readText } from './boundary.js';
import { assembleRegister, lineDigits, type Register } from './customers.js';
import { readPosting, type Posting } from './posting.js';

/** How many days of thread the Inbox keeps. The domain filters on its own. */
export const CHAT_DAYS = 30;

export interface DeskRead {
  readonly desk: Desk;
  /** What could not be derived, in words, for the footnote under the lenses. */
  readonly unreadable: readonly string[];
}

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

/**
 * Two letters for the avatar.
 *
 * First letters of the first two words; one word gives its first two. Never
 * from a photo, and never more than two — "Kato Construction Ltd" is KC.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first.slice(0, 1)}${words[1]?.slice(0, 1) ?? ''}`.toUpperCase();
}

/** How loudly a balance reads, from how far past its due date it has run. */
export function toneForDebt(daysPastDue: number | null): Tone {
  if (daysPastDue === null) return 'neutral';
  if (daysPastDue > 30) return 'bad';
  if (daysPastDue > 0) return 'caution';
  return 'neutral';
}

/* -------------------------------------------------------------------------- */

export async function readDesk(shopId: string, now: Date): Promise<Derived<DeskRead>> {
  const { sb } = current();
  const since = new Date(now);
  since.setMonth(since.getMonth() - 12);
  const sinceDay = since.toISOString().slice(0, 10);

  const [customersRes, salesRes, convosRes, numbersRes, followRes, promisesRes, debtLogRes] =
    await Promise.all([
    sb
      .from('customers')
      .select('id, name, phone, location, notes, debt, terms_days, credit_limit')
      .eq('shop_id', shopId),
    sb
      .from('saved_quotes')
      .select(
        'id, client_name, client_phone, date, status, invoiced, invoiced_at, amount_paid, voided, payload',
      )
      .eq('shop_id', shopId)
      .eq('invoiced', true)
      .gte('date', sinceDay)
      .order('date', { ascending: true }),
    sb
      .from('wa_conversations')
      .select('id, wa_id, profile_name, last_message_at, last_inbound_at, wa_messages(direction, body, sent_at, created_at, status)')
      .eq('shop_id', shopId),
    sb.from('wa_numbers').select('phone_number_id').eq('shop_id', shopId),
    sb
      .from('follow_ups')
      .select('id, customer_id, product_id, qty, note, created_at, closed_at, payload')
      .eq('shop_id', shopId)
      .is('closed_at', null),
    sb
      .from('payment_promises')
      .select('id, customer_id, promised_on, made_on, amount, note')
      .eq('shop_id', shopId),
    // The window a named promise is kept inside. The desk already read the
    // promises; without the payments it could not say which were kept.
    sb
      .from('customer_debt_log')
      .select('customer_id, date, type, amount')
      .eq('shop_id', shopId)
      .eq('type', 'payment'),
  ]);

  // Without customers or their invoices there is no Money lens, which is the
  // lens the desk opens on. Everything else degrades.
  if (customersRes.error !== null) return unavailable(`customers: ${customersRes.error.message}`);
  if (salesRes.error !== null) return unavailable(`sales invoices: ${salesRes.error.message}`);

  const register = assembleRegister({
    customers: customersRes.data,
    sales: salesRes.data,
    conversations: convosRes.error === null ? convosRes.data : null,
    // The Money lens IS the chase queue, and on this shop's books a broken
    // promise is the only thing that ever makes an account late — no
    // account has terms on file. The desk read these already; now the
    // register standing behind it reads them too, so the lens and the
    // Customers screen cannot disagree about who is overdue.
    promises: promisesRes.error === null ? promisesRes.data : null,
    payments: debtLogRes.error === null ? debtLogRes.data : null,
    now,
  });

  /**
   * What is worth posting, read separately because it reads different books
   * — the shelf, the price book and the shop's own rules for what dead and
   * what thin mean. A refusal there costs the Posting lens and nothing
   * else, so it degrades like the threads and the follow-ups rather than
   * sinking the desk.
   */
  const posting = await readPosting(shopId, now);

  const read = assembleDesk({
    register,
    conversations: convosRes.error === null ? convosRes.data : null,
    linked: numbersRes.error === null ? (numbersRes.data.length > 0) : null,
    followUps: followRes.error === null ? followRes.data : null,
    promises: promisesRes.error === null ? promisesRes.data : null,
    posting: posting.status === 'unavailable' ? null : posting.value,
    postingRefused: posting.status === 'unavailable' ? posting.reason : null,
    now,
  });

  return known(read, `${read.desk.owed.length} accounts owed a word`);
}

/* -------------------------------------------------------------------------- */

export function assembleDesk(rows: {
  readonly register: Register;
  /** `null` when the table could not be read — different from no threads. */
  readonly conversations: readonly unknown[] | null;
  /** `null` when the link could not be checked at all. */
  readonly linked: boolean | null;
  readonly followUps: readonly unknown[] | null;
  readonly promises: readonly unknown[] | null;
  /** What is worth posting, or `null` where it could not be worked out. */
  readonly posting?: Posting | null;
  readonly postingRefused?: string | null;
  readonly now: Date;
}): DeskRead {
  const unreadable: string[] = [...rows.register.unreadable];
  const threads = readThreads(rows.conversations);

  if (threads === null) {
    unreadable.push('WhatsApp threads could not be read, so nothing here knows what was already said');
  }
  if (rows.linked === null) {
    unreadable.push('whether this shop’s number is linked could not be checked');
  }

  const promisedBy = new Map<string, number>();
  for (const raw of rows.promises ?? []) {
    const row = obj(raw);
    const id = row === null ? null : readText(row.customer_id);
    if (id !== null) promisedBy.set(id, (promisedBy.get(id) ?? 0) + 1);
  }

  const owed: Owed[] = [];
  for (const c of rows.register.customers) {
    // EITHER, not just the invoices. A balance carried onto an account, or
    // one whose invoice is older than the window this reads, still owes the
    // shop money — and summing only the invoices would drop it from the one
    // lens whose whole job is who to ask. The Owed row says which of the two
    // figures it is standing on, because they answer differently.
    if (Money.isZero(balance(c)) && Money.isZero(c.ledgerBalance)) continue;
    owed.push(toOwed(c, threads, promisedBy.has(c.id), rows.now));
  }

  const chats = threads === null ? [] : toChats(threads, rows.register.customers, rows.now);

  const telling = toTelling(rows.followUps, rows.register.customers);
  if (rows.followUps === null) {
    unreadable.push('the follow-up list could not be read, so nobody is shown as waiting on a product');
  }

  /**
   * What is worth posting.
   *
   * This lens drew nothing and said it needed *stock, prices and a sales
   * rate*. It has all three now — and the part that sentence missed is that
   * the shop had already set what to look for: `deadStockDays`,
   * `targetMarginPct` and the `clearance` map. Three of the five signals
   * come off those.
   *
   * The other two are named rather than faked, which is the same rule the
   * records below follow: `goes-together` needs which products leave
   * together across every order, and `season-starting` a seasonal model
   * these books do not hold.
   */
  const posts = rows.posting?.posts ?? [];
  if (rows.postingRefused !== undefined && rows.postingRefused !== null) {
    unreadable.push(`what is worth posting could not be read: ${rows.postingRefused}`);
  } else {
    for (const gap of NOT_DERIVED) {
      unreadable.push(`nothing is nominated for being ${gap.signal}: it needs ${gap.needs}`);
    }
  }

  return {
    unreadable,
    desk: {
      owed,
      telling,
      posts,
      chats,
      link: toLink(rows.linked, rows.now),
      // Every share over these returns `unavailable` while the denominator
      // is zero, so the screen says "nothing has been sent yet" rather than
      // drawing a 0% that looks measured.
      chaseRecord: {
        sent: 0,
        paid: 0,
        daysToMoney: 0,
        overDays: 30,
        repliedAskingDate: 0,
        repliedAskingAmount: 0,
      },
      tellingRecord: { led: 0, of: 0, bought: Money.ZERO, withinDays: 7, overDays: 30, byKind: new Map() },
      signalRecords: [],
      soldAfterPosts: { amount: Money.ZERO, posts: 0, withinDays: 7 },
    },
  };
}

/* -------------------------------------------------------------------------- */

interface Thread {
  readonly key: string;
  readonly profileName: string | null;
  readonly lines: readonly ChatLine[];
  readonly lastOut: Date | null;
  readonly lastIn: Date | null;
  readonly sent: number;
}

function readThreads(conversations: readonly unknown[] | null): Map<string, Thread> | null {
  if (conversations === null) return null;

  const out = new Map<string, Thread>();
  for (const raw of conversations) {
    const convo = obj(raw);
    if (convo === null) continue;
    const key = lineDigits(readText(convo.wa_id));
    if (key === null) continue;

    const lines: ChatLine[] = [];
    let lastOut: Date | null = null;
    let lastIn: Date | null = null;
    let sent = 0;

    for (const rawMsg of arr(convo.wa_messages)) {
      const msg = obj(rawMsg);
      if (msg === null) continue;
      // `sent_at` is when WhatsApp says it went; `created_at` is when this
      // shop's app wrote the row. The first is the truth and the second is
      // the fallback, because an outbound that never left still has a row.
      const at = readDate(msg.sent_at) ?? readDate(msg.created_at);
      if (at === null) continue;
      const us = msg.direction === 'out';
      lines.push({ from: us ? 'us' : 'them', text: readText(msg.body) ?? '', at, by: null });
      if (us) {
        sent += 1;
        if (lastOut === null || at > lastOut) lastOut = at;
      } else if (lastIn === null || at > lastIn) lastIn = at;
    }

    lines.sort((a, b) => a.at.getTime() - b.at.getTime());
    const prior = out.get(key);
    out.set(key, {
      key,
      profileName: readText(convo.profile_name) ?? prior?.profileName ?? null,
      lines: [...(prior?.lines ?? []), ...lines],
      lastOut: newest(prior?.lastOut ?? null, lastOut),
      lastIn: newest(prior?.lastIn ?? null, lastIn),
      sent: (prior?.sent ?? 0) + sent,
    });
  }
  return out;
}

const newest = (a: Date | null, b: Date | null): Date | null =>
  a === null ? b : b === null ? a : a > b ? a : b;

const DAY = 86_400_000;

function toOwed(
  c: Customer,
  threads: Map<string, Thread> | null,
  promised: boolean,
  now: Date,
): Owed {
  const open = openInvoices(c);
  const oldest = open[0] ?? null;
  const thread = threads === null ? undefined : threads.get(lineDigits(c.phone) ?? '');
  const days = oldestDebtDays(c, now);
  const pastDue =
    oldest?.dueOn == null ? null : Math.floor((now.getTime() - oldest.dueOn.getTime()) / DAY);

  // A reply only counts if it came AFTER the last thing the shop said.
  const replied =
    thread?.lastIn != null && (thread.lastOut === null || thread.lastIn > thread.lastOut);

  return {
    id: c.id,
    name: c.name,
    initials: initialsOf(c.name),
    tone: toneForDebt(pastDue),
    phone: c.phone,
    place: c.area === '' ? null : c.area,
    about:
      oldest === null
        ? 'a balance carried on from earlier'
        : `${oldest.doc} · ${Money.format(owedOn(oldest))} of ${Money.format(oldest.total)}`,
    // The invoices where there are any, because they can be shown and
    // disputed line by line; the stored balance only where there are none.
    // Preferring the stored figure would quietly paper over the drift that
    // `ledgerAgrees` exists to surface.
    atStake: open.length > 0 ? balance(c) : c.ledgerBalance,
    // `null` is not a missing field. A balance with no invoice behind it
    // changes what the message can ask for, so the draft asks for the total
    // and offers to check it.
    invoice: oldest?.doc ?? null,
    oldestDays: days.status === 'unavailable' ? 0 : days.value,
    dueOn: oldest?.dueOn ?? null,
    lastWord: thread?.lastOut ?? null,
    chases: c.chasesSent,
    everPaid: c.invoices.some((inv) => !Money.isZero(inv.received)),
    history: [],
    draft: draftFor(c, oldest, promised, open.length > 0 ? balance(c) : c.ledgerBalance),
    // No table records a hold; the old app had no such idea. Null, not a
    // lifted hold, so nobody is hidden by a default.
    hold: null,
    stamp:
      thread?.lastOut == null ? null : { on: thread.lastOut, by: 'the shop', went: true },
    replied: replied === true,
  };
}

/**
 * The box is what ships, so this is the text and not a template id.
 *
 * It asks for a DATE rather than the money, because that is what the
 * record says gets answered — and it offers to be wrong, because a shop
 * that insists on a figure its customer disputes loses both.
 */
export function draftFor(
  c: Customer,
  oldest: { readonly doc: string; readonly total: MoneyAmount } | null,
  promised: boolean,
  atStake: MoneyAmount,
): string {
  const owing = Money.format(atStake);
  const opening = `Hello ${c.name.split(/\s+/)[0] ?? c.name},`;
  const what =
    oldest === null
      ? `Our records show *${owing} UGX* still outstanding on your account.`
      : `Invoice ${oldest.doc} is still open: *${owing} UGX* of ${Money.format(oldest.total)} remains.`;
  const ask = promised
    ? 'You mentioned a date earlier — could you confirm it still holds?'
    : 'Please let us know when we can expect payment.';

  return `${opening}\n\n${what}\n\n${ask} If any of this does not match your own records, tell us and we will check it.\n\nThank you.`;
}

function toChats(threads: Map<string, Thread>, customers: readonly Customer[], now: Date): Chat[] {
  const nameByKey = new Map<string, Customer>();
  for (const c of customers) {
    const key = lineDigits(c.phone);
    if (key !== null) nameByKey.set(key, c);
  }

  const chats: Chat[] = [];
  for (const thread of threads.values()) {
    const last = thread.lines[thread.lines.length - 1];
    if (last === undefined) continue;
    const filed = nameByKey.get(thread.key);
    // A thread from a number nobody has filed is still a message. It shows
    // under the number, because "unknown" is what the shop actually knows.
    const name = filed?.name ?? thread.profileName ?? thread.key;
    const open = filed === undefined ? null : (openInvoices(filed)[0] ?? null);

    chats.push({
      id: thread.key,
      name,
      initials: initialsOf(name),
      tone: open === null ? 'neutral' : toneForDebt(daysPastDue(open, now)),
      phone: filed?.phone ?? thread.key,
      at: last.at,
      preview: last.text.slice(0, 120),
      // What a thread is ABOUT is the balance behind it where there is one.
      // Saying `none` for a customer with an open invoice would make the
      // Inbox the one lens that does not know what the desk is for.
      about:
        open === null
          ? {
              kind: 'none',
              line: filed === undefined ? 'not a filed customer' : 'no open balance',
            }
          : {
              kind: 'invoice',
              doc: open.doc,
              owes: owedOn(open),
              days: Math.max(0, Math.floor((now.getTime() - open.issued.getTime()) / DAY)),
            },
      lines: thread.lines,
      // What they promised is a reading of the words, not a stored figure.
      promised: null,
    });
  }
  return chats.sort((a, b) => b.at.getTime() - a.at.getTime());
}

function toTelling(
  followUps: readonly unknown[] | null,
  customers: readonly Customer[],
): Telling[] {
  if (followUps === null) return [];
  const byId = new Map(customers.map((c) => [c.id, c]));

  const out: Telling[] = [];
  for (const raw of followUps) {
    const row = obj(raw);
    if (row === null) continue;
    const customerId = readText(row.customer_id);
    const who = customerId === null ? undefined : byId.get(customerId);
    // A follow-up whose customer has been deleted leaves a dangling id —
    // the schema says so in its own comment, and this is the read that
    // tolerates it.
    if (who === undefined) continue;

    const note = readText(row.note);
    const product = readText(obj(row.payload)?.productName) ?? readText(row.product_id) ?? 'what they asked for';
    const qty = typeof row.qty === 'number' ? row.qty : null;

    out.push({
      id: `fu-${readText(row.id) ?? product}`,
      name: who.name,
      initials: initialsOf(who.name),
      tone: 'info',
      kind: 'asked-for',
      what: qty === null ? product : `${product} × ${qty}`,
      whyThem: note ?? 'they asked for it and the shop did not have it',
      whyTone: 'info',
      // Nobody recorded when the asking stops being worth acting on, and a
      // date invented here would quietly drop the row on its own.
      goodUntil: { kind: 'while-it-holds' },
      route: 'tell',
      routeNote: null,
      worth: null,
      stoppedBeingTrue: null,
      draft: null,
    });
  }
  return out;
}

/**
 * The link, and the pairing code this pass cannot issue.
 *
 * Issuing a code is a WRITE. Until this app writes, an unlinked shop is told
 * the number is not connected and is not handed a code that would never
 * work — `codeAlive` is false on an empty one, which is the honest state.
 */
function toLink(linked: boolean | null, now: Date): Link {
  return { linked: linked === true, code: '', issuedAt: new Date(now.getTime() - 86_400_000) };
}

