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
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(SRC).filter((f) => extname(f) === '.ts' && !f.endsWith('.test.ts'));

/** The PostgREST verbs that change a row. `select` and `rpc` are not here. */
const WRITES = /\.(insert|update|upsert|delete)\s*\(/;

describe('this app does not write to the shop’s books', () => {
  it.each(files)('%s', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    const offenders = source
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => WRITES.test(line))
      .map(([n, line]) => `${file}:${n}: ${line.trim()}`);

    expect(
      offenders,
      `${offenders.join('\n')}\n\nThe old app is still the one running the shop. Turning a write on is a decision to argue for in the commit message — see the note at the head of this file.`,
    ).toEqual([]);
  });

  it('is watching a real number of files, not an empty directory', () => {
    expect(files.length).toBeGreaterThan(5);
  });
});
