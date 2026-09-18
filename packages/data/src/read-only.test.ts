/**
 * Read-only first, enforced.
 *
 * The old app runs the business. This one goes live reading the same books
 * and writing none of them, until the payload contract is proven against
 * real rows — and "we agreed not to write" is not a safeguard, it is an
 * intention. A stray `.update()` shipped on a Friday is how a shop's ledger
 * gets quietly rewritten by the app that was only supposed to be looking.
 *
 * **When writes are turned on, this test is the place to argue for it**, in
 * the commit message, one screen at a time — not a line to delete quietly.
 * `savedQuotes.ts` already records what receiving money has to write:
 * a `cash_txns` row, `payload.payments`, `amount_paid`, and the customer's
 * debt. A write path that does fewer than four of those leaves the till, the
 * invoice and the debtors list disagreeing.
 *
 * ## So it is an allowlist, not a switch
 *
 * {@link WRITES_ALLOWED} names each file permitted to write and why. A file
 * absent from it still cannot write, which is every file but one. Adding a
 * name is the decision, and the reason beside it is the argument — kept here
 * next to the guard rather than only in a commit message somebody would have
 * to go looking for.
 *
 * Two tests keep the list from rotting. A name for a file that does not
 * exist fails, so a rename cannot leave a hole. A name for a file that no
 * longer writes ALSO fails, because a permission nothing is using is a
 * permission nobody is thinking about, and it is the one that will be there
 * the day somebody adds an `.update()` to that file for an unrelated reason.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(SRC).filter((f) => extname(f) === '.ts' && !f.endsWith('.test.ts'));

/** The PostgREST verbs that change a row. `select` and `rpc` are not here. */
const WRITES = /\.(insert|update|upsert|delete)\s*\(/;

/**
 * The files allowed to write, and the argument for each.
 *
 * **`promises.ts`.** `payment_promises` is append-only by the design of
 * migration 0089 — *"the row is never rewritten — a changed mind is a SECOND
 * promise"* — so this app cannot overwrite anything the old app wrote, and
 * no total anywhere is rebuilt from these rows. That is what makes it the
 * safe first write while the old app is still running the shop: the worst a
 * wrong row can do is add a promise the owner then deletes, which 0089
 * documents as the correction.
 *
 * **`quotes.ts`, and INSERT only.** The hazard on `saved_quotes` is the
 * preservation contract: the old app rebuilds a payload from thirty named
 * keys, so a partial write strips whatever it did not name — *order 151's
 * lesson, a third time*, in that app's own words. That is a hazard of
 * OVERWRITING. A new order has no prior payload, so an insert cannot break
 * it, and `newQuotePayload` writes every one of the thirty keys the old app
 * gives a brand-new record.
 *
 * The permission is exactly that wide. Editing an order and moving it
 * between lanes both rewrite a payload that already exists, and both stay
 * with the old app until a merge that reads the row first is argued for
 * here on its own terms. A second test below holds `quotes.ts` to inserts,
 * so widening it is a decision somebody has to make on purpose.
 *
 * Contrast receiving money, which `savedQuotes.ts` describes: a `cash_txns`
 * row, `payload.payments`, `amount_paid` and the customer's debt, all four
 * or the till, the invoice and the debtors list disagree. That one is not
 * argued for yet.
 */
const WRITES_ALLOWED: Readonly<Record<string, string>> = {
  'promises.ts': 'payment_promises is append-only (0089); nothing is recomputed from it',
  'quotes.ts': 'saved_quotes INSERT only — a new order has no payload to preserve',
};

/** Files allowed to write, but only to add a row. */
const INSERT_ONLY: readonly string[] = ['quotes.ts'];

/**
 * A file's writes, with the comments stripped so prose cannot trip it.
 *
 * Read by STATEMENT, and a statement counts only if it also reaches a
 * table — every PostgREST write is `sb.from('t').insert(…)`, on one chain.
 * Line by line, `raising.delete(shopId)` on a `Set` tripped the ban, and a
 * false positive in a guard is worse than no guard: the obvious way to
 * quieten it is to loosen the pattern, and then the next real `.delete()`
 * goes through as well.
 */
function writesIn(file: string): readonly string[] {
  const source = readFileSync(join(SRC, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const lines = source.split('\n');
  const found: string[] = [];
  let statement = '';
  let startedAt = 1;

  lines.forEach((line, i) => {
    if (statement === '') startedAt = i + 1;
    statement += line;
    if (!line.includes(';')) return;

    const verb = WRITES.exec(statement);
    if (verb !== null && statement.includes('.from(')) {
      found.push(`${file}:${startedAt}: ${verb[0]}`);
    }
    statement = '';
  });

  return found;
}

/** Everything still under the ban — every file but the ones argued for. */
const guarded = files.filter((f) => WRITES_ALLOWED[f] === undefined);

describe('this app writes to the shop’s books only where it has argued for it', () => {
  it.each(guarded)('%s', (file) => {
    const offenders = writesIn(file);

    expect(
      offenders,
      `${offenders.join('\n')}\n\nThe old app is still the one running the shop. Turning a write on means adding ${file} to WRITES_ALLOWED with the reason — a decision to argue for in the commit message, see the note at the head of this file.`,
    ).toEqual([]);
  });

  it('is watching a real number of files, not an empty directory', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(guarded.length).toBeGreaterThan(5);
  });

  // A name here for a file that has gone is a hole in the guard: rename
  // `promises.ts` and the new file would be checked, but the entry left
  // behind would be waiting for anything that took the old name.
  it.each(Object.keys(WRITES_ALLOWED))('%s is allowed to write and still exists', (file) => {
    expect(files, `${file} is allowed to write but is not in ${SRC}`).toContain(file);
  });

  // And a name for a file that no longer writes is a permission nobody is
  // thinking about any more. Remove it rather than leave it armed.
  it.each(Object.keys(WRITES_ALLOWED))('%s still writes, so its entry is live', (file) => {
    expect(
      writesIn(file).length,
      `${file} is in WRITES_ALLOWED but no longer writes — take it back out`,
    ).toBeGreaterThan(0);
  });

  /**
   * An insert-only permission that quietly grows an `.update()` is the
   * whole hazard back again, in the one file already trusted enough that
   * nobody would look. `saved_quotes` is safe to add a row to and unsafe to
   * rewrite, and that difference is a line of code apart.
   */
  it.each(INSERT_ONLY)('%s adds rows and rewrites none', (file) => {
    const rewrites = writesIn(file).filter((line) => /\.(update|upsert|delete)\s*\(/.test(line));

    expect(
      rewrites,
      `${rewrites.join('\n')}\n\n${file} is allowed to INSERT because a new row has no payload to preserve. Rewriting one does have a payload to preserve, and the old app rebuilds it from thirty named keys — see WRITE_IS_INSERT_ONLY in savedQuotes.ts. Argue for the merge before widening this.`,
    ).toEqual([]);
  });
});
