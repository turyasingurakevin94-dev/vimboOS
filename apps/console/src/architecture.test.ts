/**
 * The rules that hold the architecture up.
 *
 * A design system is a document until something fails when you break it.
 * These are the four things that, left unchecked, would quietly turn this
 * back into the app it replaced:
 *
 *   1. the two designs importing each other, which is how "two designs"
 *      becomes "one design with two stylesheets";
 *   2. a raw hex in a component, which is how a 25-value palette is born;
 *   3. a size or a space off the ramp, which is how 33 font sizes in
 *      half-pixel steps happen;
 *   4. a second accent on a screen, which is how the accent stops meaning
 *      "the one thing to do next".
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { size, space } from '@ow/design/tokens';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC);
const files = (ext: readonly string[], under?: string): string[] =>
  ALL.filter(
    (f) =>
      ext.includes(extname(f)) &&
      !f.endsWith('.test.ts') &&
      (under === undefined || relative(SRC, f).startsWith(under)),
  );

const read = (f: string): string => readFileSync(f, 'utf8');
const show = (f: string): string => relative(SRC, f);

describe('the two designs stay two designs', () => {
  it('has both trees, and they are not empty', () => {
    expect(files(['.tsx', '.ts'], 'desktop').length).toBeGreaterThan(3);
    expect(files(['.tsx', '.ts'], 'phone').length).toBeGreaterThan(3);
  });

  it.each([
    ['desktop', 'phone'],
    ['phone', 'desktop'],
  ])('never lets %s import from %s', (from, to) => {
    const offenders = files(['.ts', '.tsx'], from)
      .filter((f) => new RegExp(`from '[^']*${to}/`).test(read(f)))
      .map(show);

    expect(
      offenders,
      `${offenders.join(', ')} imports from the ${to} design. The two trees share @ow/domain and @ow/data and nothing else — a component used by both is one design wearing two hats, and it will drift toward the middle that serves neither. Duplicate it instead.`,
    ).toEqual([]);
  });

  it('asks how wide the screen is in exactly one place', () => {
    // Every branch on viewport width outside the root switch is the
    // responsive compromise the law forbids.
    const offenders = files(['.ts', '.tsx'])
      .filter((f) => !show(f).startsWith('app/'))
      .filter((f) => /matchMedia|innerWidth|SWITCH_PX|designFor/.test(read(f)))
      .map(show);

    expect(
      offenders,
      `${offenders.join(', ')} branches on screen width. Only app/useDesign.ts may — below the root switch you are already inside one design.`,
    ).toEqual([]);
  });

  it('keeps a media query out of the two designs\' stylesheets, except for the desktop\'s own column drop', () => {
    const offenders = files(['.css'])
      .filter((f) => /@media[^{]*width/.test(read(f)))
      .map(show)
      // The desktop drops its context column under 1280px. That is the
      // desktop design reorganising itself for a laptop, not the phone
      // design arriving early — nothing resizes and no target changes.
      .filter((f) => f !== 'desktop/DesktopApp.module.css');

    expect(
      offenders,
      `${offenders.join(', ')} uses a width media query. A width breakpoint inside a design is a reflow, and reflow is what the switch exists to replace.`,
    ).toEqual([]);
  });
});

describe('the palette is the only source of colour', () => {
  it('has no raw hex in any component or stylesheet', () => {
    const offenders: string[] = [];
    for (const f of [...files(['.css']), ...files(['.tsx'])]) {
      for (const hex of read(f).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
        offenders.push(`${show(f)}: ${hex}`);
      }
    }
    expect(
      offenders,
      `raw hex found — use var(--ow-color-*). A hand-typed value is how a 25th colour is born, and it is never checked for contrast:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('has no rgb()/hsl() literal either — the same hole, differently spelled', () => {
    const offenders: string[] = [];
    for (const f of files(['.css'])) {
      for (const [i, line] of read(f).split('\n').entries()) {
        // rgba() over white or ink is legal for a scrim or a rail hover,
        // where the whole point is translucency the palette cannot express.
        if (/\b(rgb|hsl)a?\(/.test(line) && !/rgba\(\s*(255,\s*255,\s*255|247|16)/.test(line)) {
          offenders.push(`${show(f)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

describe('sizes and spaces come off the ramp', () => {
  const ALLOWED_PX = new Set<number>([
    ...Object.values(size).map((v) => Number.parseFloat(v)),
    ...Object.values(space).map((v) => Number.parseFloat(v)),
    // Chrome heights and targets, declared in device.ts and used literally
    // in layout: rail, bars, rows, targets, icons, hairlines.
    0, 1, 3, 5, 26, 28, 30, 32, 40, 44, 48, 52, 56, 60, 96, 104, 112, 132, 150,
    232, 320, 420, 1279, 1600,
  ]);

  it('uses no px value that is not a token or a declared chrome dimension', () => {
    const offenders: string[] = [];
    for (const f of files(['.css'])) {
      for (const [i, line] of read(f).split('\n').entries()) {
        for (const m of line.match(/(?<![\w-])(\d+(?:\.\d+)?)px/g) ?? []) {
          const px = Number.parseFloat(m);
          if (!ALLOWED_PX.has(px)) {
            offenders.push(`${show(f)}:${i + 1}: ${m} — ${line.trim()}`);
          }
        }
      }
    }
    expect(
      offenders,
      `off-ramp pixel values. Use var(--ow-space-*) / var(--ow-size-*), or add the value to the chrome list here with a reason:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('has no half-pixel anywhere — that is the disease, and it starts with one', () => {
    const offenders: string[] = [];
    for (const f of files(['.css'])) {
      for (const m of read(f).match(/\d+\.\d+px/g) ?? []) {
        offenders.push(`${show(f)}: ${m}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

describe('the accent appears once per screen', () => {
  // Not something a test can fully judge — an accent is about meaning, not
  // count. But it can catch the obvious: a screen filling more than one
  // element with the accent colour is almost always two "one things to do
  // next", and one of them is wrong.
  it.each(files(['.css'], 'desktop/screens').concat(files(['.css'], 'phone/screens')))(
    '%s fills the accent at most once',
    (file) => {
      const fills = (read(file).match(/background:\s*var\(--ow-color-accent\)/g) ?? [])
        .length;
      expect(
        fills,
        `${show(file)} fills the accent ${fills} times. If two things on a screen are the one thing to do next, one of them is wrong.`,
      ).toBeLessThanOrEqual(1);
    },
  );
});
