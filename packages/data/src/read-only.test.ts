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
 * One entry. `payment_promises` is append-only by the design of migration
 * 0089 — *"the row is never rewritten — a changed mind is a SECOND
 * promise"* — so this app cannot overwrite anything the old app wrote, and
 * no total anywhere is rebuilt from these rows. That is what makes it the
 * safe first write while the old app is still running the shop: the worst a
 * wrong row can do is add a promise the owner then deletes, which 0089
 * documents as the correction. Contrast `savedQuotes.ts` above, where one
 * write has to land in four places at once or the books disagree with
 * themselves.
 */
const WRITES_ALLOWED: Readonly<Record<string, string>> = {
  'promises.ts': 'payment_promises is append-only (0089); nothing is recomputed from it',
};

/** A file's write lines, with the comments stripped so prose cannot trip it. */
function writesIn(file: string): readonly string[] {
  const source = readFileSync(join(SRC, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  return source
    .split('\n')
    .map((line, i) => [i + 1, line] as const)
    .filter(([, line]) => WRITES.test(line))
    .map(([n, line]) => `${file}:${n}: ${line.trim()}`);
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
});
