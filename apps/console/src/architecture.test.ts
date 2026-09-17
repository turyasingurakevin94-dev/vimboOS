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
  /**
   * Two different rules, because two different diseases.
   *
   * SPACING AND TYPE must come from a token. This is the one that rotted the
   * old file: 33 font sizes in half-pixel steps, and it starts with a single
   * reasonable-looking 12.5. There is a token for every legitimate value, so
   * a literal here is always someone eyeballing it.
   *
   * DIMENSIONS — the width of a rail, a column, a tap target — are layout,
   * not rhythm, and there is no token for "the customer column". They only
   * have to land on the 4px grid, which is enough to stop 37px.
   *
   * Comments are stripped first. The rule used to read its own prose and
   * fail on the sentence explaining why a phone is 390px wide.
   */
  const RHYTHM = /^(padding|margin|gap|row-gap|column-gap|font-size|border-radius|inset|top|right|bottom|left)/;
  /**
   * A border width is neither rhythm nor a dimension — it is a rule drawn on
   * an edge, and the only sane values are a hairline, a line, or an accent
   * stripe. 4px would be a slab.
   */
  const BORDER = /^(border|outline)/;
  const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

  const EXCEPT = new Set<number>([
    // Hairlines, and the two values the space scale blesses off-grid for
    // the inside of a chip: 2 and 6.
    0, 1, 2, 6,
    // Chrome and targets, declared in device.ts: rail, bars, rows, targets.
    26, 30, 44, 52, 232,
  ]);

  const onGrid = (px: number): boolean => EXCEPT.has(px) || px % 4 === 0;

  it.each(files(['.css']))('%s', (file) => {
    const offenders: string[] = [];
    for (const [i, line] of stripComments(read(file)).split('\n').entries()) {
      if (line.trimStart().startsWith('@media')) continue; // a breakpoint, not a dimension
      const decl = /^\s*([a-z-]+)\s*:/.exec(line);
      const prop = decl?.[1] ?? '';
      for (const m of line.match(/(?<![\w-])(\d+(?:\.\d+)?)px/g) ?? []) {
        const px = Number.parseFloat(m);
        const where = `${show(file)}:${i + 1}: ${line.trim()}`;
        if (BORDER.test(prop)) {
          if (px > 3) {
            offenders.push(`${where} — a ${m} border is a slab, not a rule`);
          }
        } else if (RHYTHM.test(prop)) {
          if (px !== 0) {
            offenders.push(`${where} — ${prop} takes a token, not ${m}`);
          }
        } else if (!onGrid(px)) {
          offenders.push(`${where} — ${m} is off the 4px grid`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('has no half-pixel anywhere — that is the disease, and it starts with one', () => {
    const offenders: string[] = [];
    for (const f of files(['.css'])) {
      for (const m of stripComments(read(f)).match(/\d+\.\d+px/g) ?? []) {
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

describe('every className resolves to a real rule', () => {
  /**
   * `className={s.work}` where `work` is not in that stylesheet is
   * `className="undefined"` — no error, no warning, and a screen that
   * *mostly* looks right because a grid placed its children anyway. That
   * shipped here: both desktop screens lost their page gutter and scroll
   * containment, and the screenshots did not obviously show it.
   *
   * CSS-module imports are resolved at build time, so TypeScript cannot
   * catch this. Reading both files can.
   */
  const classesIn = (cssPath: string): Set<string> => {
    const names = new Set<string>();
    for (const m of read(cssPath).matchAll(/\.([a-zA-Z][\w-]*)\s*(?=[,{:.\s])/g)) {
      if (m[1] !== undefined) names.add(m[1]);
    }
    return names;
  };

  it.each(files(['.tsx']))('%s', (file) => {
    const src = read(file);
    const dir = join(file, '..');

    // Which local name each stylesheet was imported under.
    const imports = new Map<string, string>();
    for (const m of src.matchAll(/import\s+(\w+)\s+from\s+'([^']+\.module\.css)'/g)) {
      const [, local, spec] = m;
      if (local !== undefined && spec !== undefined) {
        imports.set(local, join(dir, spec));
      }
    }
    if (imports.size === 0) return;

    const missing: string[] = [];
    for (const [local, cssPath] of imports) {
      const defined = classesIn(cssPath);
      for (const m of src.matchAll(new RegExp(`\\b${local}\\.([a-zA-Z]\\w*)`, 'g'))) {
        const name = m[1];
        if (name !== undefined && !defined.has(name)) {
          missing.push(`${local}.${name} is not in ${relative(dir, cssPath)}`);
        }
      }
    }

    expect(
      missing,
      `${show(file)} references classes that do not exist, so they render as "undefined":\n${missing.join('\n')}`,
    ).toEqual([]);
  });
});
