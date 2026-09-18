/**
 * The Customers register, off rows shaped like the shop's real ones.
 *
 * The parts that can be wrong are the join (by name), the margin (which
 * needs the pair of prices it is fatal to confuse), the chase count (which
 * needs three spellings of one phone number to agree), and the line between
 * "nobody chased them" and "the app cannot see". Each is pinned here.
 */

import { describe, expect, it } from 'vitest';
import { Money, balance, ledgerAgrees, owedOn } from '@ow/domain';
import { assembleRegister, lineDigits, shortNameOf } from './customers.js';

const NOW = new Date('2026-09-17T00:00:00Z');

/** `ledgerAgrees` answers `Derived<boolean>` — it can also not know. */
const agrees = (c: Parameters<typeof ledgerAgrees>[0]): boolean | null => {
  const d = ledgerAgrees(c);
  return d.status === 'unavailable' ? null : d.value;
};

const ken = {
  id: 'cust-ken',
  name: 'Ken Bwaise',
  phone: '0772481330',
  location: 'Nakawa',
  notes: null,
  debt: '165000',
  terms_days: 30,
  credit_limit: '2000000',
};

/** 10 bags at 44,500 sold, bought at 38,000. 20,000 transport on top. */
const invoice = (over: Record<string, unknown> = {}) => ({
  id: 175,
  client_name: 'Ken Bwaise',
  client_phone: '0772481330',
  date: '2026-08-17',
  status: 'invoiced',
  invoiced: true,
  invoiced_at: '2026-08-17',
  amount_paid: '300000',
  voided: false,
  payload: {
    client: { name: 'Ken Bwaise' },
    items: [
      { lineId: 12, productName: 'Cement — Tororo', qty: 10, price: 38_000, sellPrice: 44_500 },
    ],
    // The shape production holds. It was `{id, name, kind, amount}` here
    // too — the same guess, pinned in a second file.
    charges: [
      { id: 1, cost: null, type: 'fixed', label: 'Transport', value: 20_000, service: 'Transport' },
    ],
    payments: [{ date: '2026-08-19', amount: 300_000, method: 'Cash · shop till', id: 1 }],
  },
  ...over,
});

const one = (rows: Partial<Parameters<typeof assembleRegister>[0]> = {}) =>
  assembleRegister({
    customers: [ken],
    sales: [invoice()],
    conversations: [],
    promises: [],
    payments: [],
    now: NOW,
    ...rows,
  });

describe('a phone number, three ways of writing it', () => {
  it('reduces every spelling to the same line', () => {
    expect(lineDigits('0772481330')).toBe('772481330');
    expect(lineDigits('256772481330')).toBe('772481330');
    expect(lineDigits('+256 772 481330')).toBe('772481330');
  });

  it('refuses what is not a number, rather than matching everything', () => {
    expect(lineDigits(null)).toBeNull();
    expect(lineDigits('')).toBeNull();
    expect(lineDigits('n/a')).toBeNull();
    expect(lineDigits('0772')).toBeNull();
  });
});

describe('the account, from its invoices', () => {
  it('sums the invoices rather than trusting the stored balance', () => {
    const { customers } = one();
    const c = customers[0]!;
    // 10 × 44,500 + 20,000 = 465,000, less 300,000 received.
    expect(balance(c)).toBe(165_000);
    expect(owedOn(c.invoices[0]!)).toBe(165_000);
  });

  it('holds the stored balance up against them', () => {
    // `customers.debt` is maintained by hand on every save in the old app.
    // It is read to be CHECKED, never to be shown.
    expect(agrees(one().customers[0]!)).toBe(true);

    const drifted = one({ customers: [{ ...ken, debt: '900000' }] });
    expect(agrees(drifted.customers[0]!)).toBe(false);
    expect(drifted.customers[0]!.ledgerBalance).toBe(900_000);
  });

  it('takes the due date from the customer, not the invoice', () => {
    expect(one().customers[0]!.invoices[0]!.dueOn?.toISOString().slice(0, 10)).toBe('2026-09-16');

    const noTerms = one({ customers: [{ ...ken, terms_days: null }] });
    expect(noTerms.customers[0]!.invoices[0]!.dueOn).toBeNull();
  });

  it('dates the account from its first invoice', () => {
    const { customers } = one({
      sales: [invoice({ id: 9, date: '2026-02-03' }), invoice()],
    });
    expect(customers[0]!.since.toISOString().slice(0, 10)).toBe('2026-02-03');
  });

  it('counts instalments, and settles only when the last shilling lands', () => {
    const part = one().customers[0]!.invoices[0]!;
    expect(part.instalments).toBe(1);
    expect(part.settledOn).toBeNull();
    expect(part.lastPaidOn?.toISOString().slice(0, 10)).toBe('2026-08-19');

    const paid = one({
      sales: [
        invoice({
          amount_paid: '465000',
          payload: {
            ...invoice().payload,
            payments: [
              { date: '2026-08-19', amount: 300_000, method: 'Cash', id: 1 },
              { date: '2026-09-02', amount: 165_000, method: 'Cash', id: 2 },
            ],
          },
        }),
      ],
    }).customers[0]!.invoices[0]!;
    expect(paid.instalments).toBe(2);
    expect(paid.settledOn?.toISOString().slice(0, 10)).toBe('2026-09-02');
  });

  it('leaves a voided invoice out of the account entirely', () => {
    const { customers } = one({ sales: [invoice({ voided: true })] });
    expect(customers[0]!.invoices).toEqual([]);
    expect(balance(customers[0]!)).toBe(Money.ZERO);
  });
});

describe('what the shop kept, which needs BOTH prices', () => {
  it('keeps the difference, and sells the sell price', () => {
    const c = one().customers[0]!;
    // Sold 445,000 of goods; kept 10 × (44,500 − 38,000) = 65,000.
    expect(c.soldTwelveMonths).toBe(445_000);
    expect(c.keptTwelveMonths).toBe(65_000);
  });

  it('does NOT claim a full margin on a line with no recorded cost', () => {
    // The dangerous default: treating a missing buy price as zero reports
    // the shop's best-ever margin on its worst-documented line.
    const noCost = one({
      sales: [
        invoice({
          payload: {
            ...invoice().payload,
            items: [{ lineId: 12, productName: 'Cement — Tororo', qty: 10, sellPrice: 44_500 }],
          },
        }),
      ],
    }).customers[0]!;
    expect(noCost.soldTwelveMonths).toBe(445_000);
    expect(noCost.keptTwelveMonths).toBe(0);
  });

  it('shares spend across products, biggest first, and names them for prose', () => {
    const c = one({
      sales: [
        invoice({
          payload: {
            ...invoice().payload,
            items: [
              { lineId: 1, productName: 'Cement — Tororo', qty: 10, price: 38_000, sellPrice: 44_500 },
              { lineId: 2, productName: 'Iron sheets G28', qty: 2, price: 50_000, sellPrice: 55_000 },
            ],
          },
        }),
      ],
    }).customers[0]!;

    expect(c.buys.map((b) => b.product)).toEqual(['Cement — Tororo', 'Iron sheets G28']);
    expect(c.buys[0]!.shareOfSpend).toBe(80); // 445,000 of 555,000
    expect(c.buys[0]!.shortName).toBe('cement');
    expect(c.buys[0]!.margin).toBe(15); // 65,000 kept on 445,000 sold
  });

  it('shortens a product name to the word a sentence would use', () => {
    expect(shortNameOf('Cement — Tororo')).toBe('cement');
    expect(shortNameOf('Iron sheets G28')).toBe('iron');
    expect(shortNameOf('Binding wire (16g)')).toBe('binding');
  });
});

describe('the five months the panel draws', () => {
  it('draws every month, including the ones with no order', () => {
    // Four bars and a gap would read as "we have no record", which is a
    // different thing from "they bought nothing that month".
    const { customers } = one();
    expect(customers[0]!.monthly.map((m) => m.month)).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep']);
    expect(customers[0]!.monthly.map((m) => m.spent)).toEqual([0, 0, 0, 465_000, 0]);
  });
});

describe('chases: nobody chased them, versus the app cannot see', () => {
  it('counts a thread matched to the account by number, however it is written', () => {
    const { customers, chasesUnknown } = one({
      conversations: [
        {
          id: 1,
          wa_id: '256772481330',
          wa_messages: [
            { direction: 'out', sent_at: '2026-09-01' },
            { direction: 'in', sent_at: '2026-09-02' },
            { direction: 'out', sent_at: '2026-09-10' },
          ],
        },
      ],
    });
    expect(customers[0]!.chasesSent).toBe(2);
    expect(customers[0]!.chasesAnswered).toBe(1);
    expect(chasesUnknown.has('cust-ken')).toBe(false);
  });

  it('does not count an inbound that nobody prompted as an answer', () => {
    const { customers } = one({
      conversations: [{ id: 1, wa_id: '256772481330', wa_messages: [{ direction: 'in' }] }],
    });
    expect(customers[0]!.chasesAnswered).toBe(0);
  });

  it('marks the account UNKNOWN when the table could not be read', () => {
    const { customers, chasesUnknown } = one({ conversations: null });
    expect(chasesUnknown.has('cust-ken')).toBe(true);
    // The zero is there because the type demands a number. The set is what
    // the screen must read before it draws it.
    expect(customers[0]!.chasesSent).toBe(0);
  });

  it('marks it unknown for an account with no thread and no number', () => {
    expect(one({ customers: [{ ...ken, phone: null }] }).chasesUnknown.has('cust-ken')).toBe(true);
    expect(one().chasesUnknown.has('cust-ken')).toBe(true);
  });
});

describe('an account that has not bought this year', () => {
  it('is in the register, with nothing derived rather than nothing at all', () => {
    const { customers } = one({ sales: [] });
    const c = customers[0]!;
    expect(c.name).toBe('Ken Bwaise');
    expect(c.invoices).toEqual([]);
    // No invoices means no basis for a margin. Null, not zero — the shop has
    // not made 0% on them, it has made nothing it can see.
    expect(c.keptTwelveMonths).toBeNull();
    expect(c.soldTwelveMonths).toBeNull();
    expect(c.buys).toEqual([]);
    // And the stored debt is still there to disagree with.
    expect(c.ledgerBalance).toBe(165_000);
    expect(agrees(c)).toBe(false);
  });
});

describe('rows that will not read', () => {
  it('skips a customer with no id or no name, and keeps the rest', () => {
    const { customers } = one({
      customers: [{ ...ken, name: null }, ken, { debt: '0' }],
    });
    expect(customers.map((c) => c.name)).toEqual(['Ken Bwaise']);
  });

  it('says so when the stored balance itself will not read', () => {
    const { customers, unreadable } = one({ customers: [{ ...ken, debt: 'plenty' }] });
    expect(unreadable.some((u) => u.includes('cross-check'))).toBe(true);
    expect(customers[0]!.ledgerBalance).toBe(Money.ZERO);
  });

  it('matches each invoice to its OWN account', () => {
    const { customers } = one({
      customers: [ken, { ...ken, id: 'cust-joan', name: 'Joan JEZONA', debt: '0' }],
      sales: [invoice(), invoice({ id: 230, client_name: 'Joan JEZONA' })],
    });
    expect(customers.map((c) => c.invoices.length)).toEqual([1, 1]);
    expect(customers[1]!.invoices[0]!.doc).toBe('INV-0230');
  });
});

describe('the register says when chases are unreadable', () => {
  it('names it once, not once per account', () => {
    const { unreadable } = one({
      customers: [ken, { ...ken, id: 'c2', name: 'Joan JEZONA' }],
      conversations: null,
    });
    expect(unreadable.filter((u) => u.includes('WhatsApp'))).toHaveLength(1);
  });

  it('says nothing when the table reads fine and is simply empty', () => {
    expect(one({ conversations: [] }).unreadable).toEqual([]);
  });
});
