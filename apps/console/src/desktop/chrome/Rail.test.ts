/**
 * The rail is the complete map, and a cut screen's words still reach it.
 *
 * Deleting a row is the easy half of cutting a screen. The half that gets
 * forgotten is that somebody will type "debtors" tomorrow, because that is
 * what it has been called for three years — and a search that answers
 * nothing has taken a screen away and put nothing in its place.
 */

import { describe, expect, it } from 'vitest';
import { SECTIONS, TODAY, resolveTab } from './Rail.js';

const rows = SECTIONS.flatMap((s) => s.items);

describe('the map Rail.dc.html settles', () => {
  it('is 23 rows in six groups, plus Today', () => {
    expect(rows.length).toBe(23);
    expect(SECTIONS.length).toBe(6);
    expect(TODAY.id).toBe('today');
  });

  it('has the group sizes the Customers frame draws when they are shut', () => {
    expect(SECTIONS.map((s) => [s.name, s.items.length])).toEqual([
      ['Sell', 6],
      ['Buy', 2],
      ['Catalogue', 4],
      ['Money', 4],
      ['Insight', 4],
      ['Setup', 3],
    ]);
  });

  it('has cut Debtors and Creditors — both were a list with a filter on it', () => {
    expect(rows.map((r) => r.id)).not.toContain('debtors');
    expect(rows.map((r) => r.id)).not.toContain('creditors');
  });

  it('badges obligations only, on the eight rows that carry one', () => {
    const badged = [TODAY, ...rows].filter((r) => r.badge !== undefined);
    expect(badged.map((r) => [r.id, r.badge])).toEqual([
      ['today', 8],
      ['orders', 5],
      ['invoices', 4],
      ['customers', 11],
      ['messages', 13],
      ['sourcing', 14],
      ['suppliers', 5],
      ['pricing', 14],
    ]);
  });

  it('never draws a badge for zero', () => {
    for (const row of [TODAY, ...rows]) {
      if (row.badge !== undefined) expect(row.badge).toBeGreaterThan(0);
      if (row.count !== undefined) expect(row.count).toBeGreaterThan(0);
    }
  });

  it('gives every row a unique id', () => {
    const ids = [TODAY, ...rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the words that used to reach a cut screen', () => {
  it.each([
    ['debtors', 'customers'],
    ['who owes me', 'customers'],
    ['Who Owes Me', 'customers'],
    ['aging', 'customers'],
    ['ageing', 'customers'],
    ['receivables', 'customers'],
    ['credit', 'customers'],
    ['creditors', 'suppliers'],
    ['payables', 'suppliers'],
    ['compare prices', 'pricing'],
    ['purchase analytics', 'analysis'],
    ['whatsapp', 'messages'],
  ])('%s reaches %s', (query, id) => {
    expect(resolveTab(query)).toBe(id);
  });

  it('still lets a destination be reached by its own name', () => {
    expect(resolveTab('Customers')).toBe('customers');
    expect(resolveTab('Invoices')).toBe('invoices');
  });

  it("does not let a keyword outrank a destination's own name", () => {
    // "Pricing" is a row AND "compare prices" is a keyword pointing at it.
    // The row wins, so typing a name never lands somewhere surprising.
    expect(resolveTab('Pricing')).toBe('pricing');
  });

  it('prefers the longest matching phrase', () => {
    // "credit" is inside "creditors". Sorting by length is what stops
    // someone looking for Suppliers landing on Customers.
    expect(resolveTab('creditors')).toBe('suppliers');
  });

  it('answers nothing rather than guessing', () => {
    expect(resolveTab('')).toBeNull();
    expect(resolveTab('   ')).toBeNull();
    expect(resolveTab('zzzz')).toBeNull();
  });

  it('resolves every keyword to a row that actually exists', () => {
    const ids = new Set([TODAY, ...rows].map((r) => r.id));
    for (const word of ['debtors', 'creditors', 'compare prices', 'purchase analytics', 'media']) {
      const found = resolveTab(word);
      expect(found, `${word} resolves to nothing`).not.toBeNull();
      expect(ids.has(found ?? ''), `${word} resolves to ${found ?? 'null'}, which is not a row`).toBe(
        true,
      );
    }
  });
});
