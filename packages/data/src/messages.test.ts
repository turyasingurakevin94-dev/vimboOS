/**
 * The Messages desk, off rows shaped like the shop's real ones.
 *
 * Three things here can be wrong in ways that look like data: which thread
 * belongs to which account (one phone, three spellings), whether the shop is
 * waiting on a reply or owes one (which depends on the ORDER of two dates),
 * and what a lens says when its table could not be read at all.
 */

import { describe, expect, it } from 'vitest';
import { moneyDesk, paidShare, stateOf } from '@ow/domain';
import { assembleDesk, initialsOf, toneForDebt } from './messages.js';
import { assembleRegister } from './customers.js';

const NOW = new Date('2026-09-17T00:00:00Z');

const ken = {
  id: 'cust-ken',
  name: 'Ken Bwaise',
  phone: '0772481330',
  location: 'Nakawa',
  debt: '165000',
  terms_days: 30,
  credit_limit: null,
};

const invoice = {
  id: 175,
  client_name: 'Ken Bwaise',
  date: '2026-08-17',
  invoiced: true,
  amount_paid: '300000',
  voided: false,
  payload: {
    items: [{ lineId: 1, productName: 'Cement — Tororo', qty: 10, price: 38_000, sellPrice: 44_500 }],
    charges: [{ id: 'c1', name: 'Transport', kind: 'charge', amount: 20_000 }],
    payments: [{ date: '2026-08-19', amount: 300_000, method: 'Cash', id: 1 }],
  },
};

type DeskRows = Parameters<typeof assembleDesk>[0];

const desk = (over: Partial<DeskRows> = {}) =>
  assembleDesk({
    // The register reads the same threads the desk does, so a test that
    // hands over conversations must hand them to both or the chase counts
    // and the last-word dates would disagree.
    register: assembleRegister({
      customers: [ken],
      sales: [invoice],
      conversations: over.conversations === undefined ? [] : over.conversations,
      promises: [],
      payments: [],
      now: NOW,
    }),
    conversations: [],
    linked: true,
    followUps: [],
    promises: [],
    now: NOW,
    ...over,
  });

describe('two letters for an avatar', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Ken Bwaise')).toBe('KB');
    expect(initialsOf('Kato Construction Ltd')).toBe('KC');
  });

  it('takes two from a single word rather than drawing one', () => {
    expect(initialsOf('Shadia')).toBe('SH');
  });
});

describe('how loudly a balance reads', () => {
  it('is quiet until it is past due, and loud a month after', () => {
    expect(toneForDebt(null)).toBe('neutral');
    expect(toneForDebt(-5)).toBe('neutral');
    expect(toneForDebt(1)).toBe('caution');
    expect(toneForDebt(31)).toBe('bad');
  });
});

describe('who is owed a word', () => {
  it('lists an account with a balance, with the invoice behind it', () => {
    const { desk: d } = desk();
    expect(d.owed).toHaveLength(1);
    expect(d.owed[0]!.atStake).toBe(165_000);
    expect(d.owed[0]!.invoice).toBe('INV-0175');
    expect(d.owed[0]!.everPaid).toBe(true);
  });

  it('leaves out an account that owes nothing', () => {
    const settled = desk({
      register: assembleRegister({
        customers: [{ ...ken, debt: '0' }],
        sales: [{ ...invoice, amount_paid: '465000',
          payload: { ...invoice.payload, payments: [{ date: '2026-08-19', amount: 465_000, id: 1 }] } }],
        conversations: [],
        promises: [],
        payments: [],
        now: NOW,
      }),
    });
    expect(settled.desk.owed).toEqual([]);
  });

  it('asks for the total, not an invoice, when no invoice stands behind it', () => {
    const carried = desk({
      register: assembleRegister({
        customers: [ken],
        sales: [],
        conversations: [],
        promises: [],
        payments: [],
        now: NOW,
      }),
    });
    const row = carried.desk.owed[0]!;
    // The balance is the stored one; there is no document to name.
    expect(row.invoice).toBeNull();
    expect(row.about).toMatch(/carried on from earlier/);
  });
});

describe('sent, or owed — which depends on the order of two dates', () => {
  const thread = (messages: readonly Record<string, unknown>[]) => [
    { id: 1, wa_id: '256772481330', profile_name: 'Ken', wa_messages: messages },
  ];

  it('is WAITING once the shop has written and nobody has answered', () => {
    const { desk: d } = desk({
      conversations: thread([{ direction: 'out', body: 'Hello', sent_at: '2026-09-10' }]),
    });
    const row = d.owed[0]!;
    expect(row.lastWord?.toISOString().slice(0, 10)).toBe('2026-09-10');
    expect(row.replied).toBe(false);
    expect(stateOf(row, NOW)).toBe('sent');
  });

  it('is OWED A WORD again once they answer', () => {
    const { desk: d } = desk({
      conversations: thread([
        { direction: 'out', body: 'Hello', sent_at: '2026-09-10' },
        { direction: 'in', body: 'Next week', sent_at: '2026-09-12' },
      ]),
    });
    expect(d.owed[0]!.replied).toBe(true);
    expect(stateOf(d.owed[0]!, NOW)).toBe('draft');
  });

  it('does not count a message they sent BEFORE ours as an answer to it', () => {
    const { desk: d } = desk({
      conversations: thread([
        { direction: 'in', body: 'Are you open?', sent_at: '2026-09-01' },
        { direction: 'out', body: 'Hello', sent_at: '2026-09-10' },
      ]),
    });
    expect(d.owed[0]!.replied).toBe(false);
  });

  it('falls back to when the row was written when WhatsApp never said', () => {
    const { desk: d } = desk({
      conversations: thread([{ direction: 'out', body: 'Hi', created_at: '2026-09-11' }]),
    });
    expect(d.owed[0]!.lastWord?.toISOString().slice(0, 10)).toBe('2026-09-11');
  });

  it('matches the thread however the number is written', () => {
    const { desk: d } = desk({
      conversations: [
        { id: 1, wa_id: '+256 772 481330', wa_messages: [{ direction: 'out', sent_at: '2026-09-10' }] },
      ],
    });
    expect(d.owed[0]!.lastWord).not.toBeNull();
  });
});

describe('the inbox says what a thread is about', () => {
  it('names the open invoice behind a filed customer', () => {
    const { desk: d } = desk({
      conversations: [
        { id: 1, wa_id: '256772481330', wa_messages: [{ direction: 'in', body: 'Hello', sent_at: '2026-09-12' }] },
      ],
    });
    expect(d.chats).toHaveLength(1);
    expect(d.chats[0]!.name).toBe('Ken Bwaise');
    expect(d.chats[0]!.about).toMatchObject({ kind: 'invoice', doc: 'INV-0175', owes: 165_000 });
  });

  it('keeps a thread from a number nobody has filed, under the number', () => {
    const { desk: d } = desk({
      conversations: [
        { id: 2, wa_id: '256700111222', wa_messages: [{ direction: 'in', body: 'Price?', sent_at: '2026-09-15' }] },
      ],
    });
    const stranger = d.chats.find((c) => c.id === '700111222');
    expect(stranger).toBeDefined();
    expect(stranger!.about).toEqual({ kind: 'none', line: 'not a filed customer' });
  });

  it('is empty, and says why, when the threads could not be read', () => {
    const { desk: d, unreadable } = desk({ conversations: null });
    expect(d.chats).toEqual([]);
    expect(unreadable.some((u) => u.includes('WhatsApp threads could not be read'))).toBe(true);
  });
});

describe('the lenses this pass does not derive', () => {
  it('says posting needs the shelf rather than drawing an empty nomination list', () => {
    expect(desk().unreadable.some((u) => u.includes('worth posting'))).toBe(true);
    expect(desk().desk.posts).toEqual([]);
  });

  it('leaves the chase record at nothing-yet, which reads as unavailable', () => {
    // The point of returning it empty: the domain already refuses to compute
    // a share with no denominator, so the screen says "nothing has been sent
    // yet" instead of a 0% that looks measured.
    expect(paidShare(desk().desk.chaseRecord).status).toBe('unavailable');
  });
});

describe('what the shop asked to be told about', () => {
  it('turns an open follow-up into someone to tell', () => {
    const { desk: d } = desk({
      followUps: [
        { id: 4, customer_id: 'cust-ken', product_id: 'p-cement', qty: 20, note: 'wants Tororo',
          created_at: '2026-09-10', closed_at: null, payload: { productName: 'Cement — Tororo' } },
      ],
    });
    expect(d.telling).toHaveLength(1);
    expect(d.telling[0]!.what).toBe('Cement — Tororo × 20');
    expect(d.telling[0]!.kind).toBe('asked-for');
    // Nobody records when the asking stops being worth acting on, so it is
    // not given a date that would drop the row on its own.
    expect(d.telling[0]!.goodUntil).toEqual({ kind: 'while-it-holds' });
  });

  it('drops a follow-up whose customer no longer exists', () => {
    // The schema's own comment says this id can dangle.
    const { desk: d } = desk({
      followUps: [{ id: 5, customer_id: 'gone', product_id: 'p-x', created_at: '2026-09-10' }],
    });
    expect(d.telling).toEqual([]);
  });
});

describe('the link', () => {
  it('is linked when the shop has a number, and is not handed a dead code', () => {
    expect(desk().desk.link.linked).toBe(true);
    expect(desk({ linked: false }).desk.link.linked).toBe(false);
    // Issuing a code is a write. An empty one is never alive, which is the
    // honest state rather than a code that would not work.
    expect(desk({ linked: false }).desk.link.code).toBe('');
  });

  it('says so when it could not be checked at all', () => {
    expect(desk({ linked: null }).unreadable.some((u) => u.includes('linked'))).toBe(true);
  });
});

describe('the money desk ranks what it is given', () => {
  it('puts the biggest stake first', () => {
    const { desk: d } = desk({
      register: assembleRegister({
        customers: [ken, { ...ken, id: 'c-big', name: 'Kato Construction', phone: '0700999888', debt: '2640000' }],
        sales: [invoice],
        conversations: [],
        promises: [],
        payments: [],
        now: NOW,
      }),
    });
    expect(moneyDesk(d.owed, NOW).toMessage.map((r) => r.name)[0]).toBe('Kato Construction');
  });
});
