/**
 * What `@ow/design` is allowed to contain.
 *
 * It is the one package both designs import, so anything in it is
 * automatically shared by both. Tokens and pure functions are fine — a
 * colour is a colour on either device. A **React component** is not: it
 * would be one component rendered by the desktop and the phone alike, which
 * is precisely the "one design wearing two hats" that `apps/console`'s
 * architecture test forbids between the two trees. The shared package is the
 * back door to that, and this closes it.
 *
 * This package shipped exactly one such component — an unused `<Figure>`
 * written before the first mockup arrived. It referenced four custom
 * properties that were never generated (`--ow-color-good`, `--ow-color-warn`,
 * `--ow-color-bad`, `--ow-leading-snug`) and nothing caught it, because the
 * var-exists test only walks `apps/console/src`. Both holes close here.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cssVariables } from './index.js';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC).filter((f) => !f.endsWith('.test.ts'));
const show = (f: string): string => relative(SRC, f);

describe('the shared package stays shareable', () => {
  it('has no .tsx in it at all', () => {
    const offenders = ALL.filter((f) => extname(f) === '.tsx').map(show);
    expect(
      offenders,
      `${offenders.join(', ')} is a React component in the package BOTH designs import. Put it in apps/console/src/desktop or apps/console/src/phone — and if both need it, write it twice.`,
    ).toEqual([]);
  });

  it('does not depend on React', () => {
    const pkg = readFileSync(join(SRC, '..', 'package.json'), 'utf8');
    expect(pkg).not.toMatch(/"react"/);
  });
});

describe('every token this package names is a token it generates', () => {
  const defined = new Set(Object.keys(cssVariables()));

  it.each(ALL.filter((f) => ['.ts', '.css'].includes(extname(f))).map(show))('%s', (rel) => {
    const missing = new Set<string>();
    for (const m of readFileSync(join(SRC, rel), 'utf8').matchAll(/var\((--ow-[a-z0-9-]+)\s*[,)]/g)) {
      const name = m[1];
      if (name !== undefined && !defined.has(name)) missing.add(name);
    }
    expect([...missing], `${rel} names tokens that resolve to nothing`).toEqual([]);
  });
});
