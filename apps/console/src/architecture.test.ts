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
import { cssVariables } from '@ow/design';


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

  it('keeps width media queries out of the PHONE design entirely', () => {
    // The desktop reflows within itself, and the handoff says so: the metric
    // grid drops 5→3→2 and the insight rail moves below the work column.
    // Nothing resizes and no target changes, so that is the desktop design
    // reorganising for a laptop, not the phone design arriving early.
    //
    // The phone is ONE width. A width query there is the compromise the
    // switch exists to replace.
    const offenders = files(['.css'], 'phone')
      .filter((f) => /@media[^{]*width/.test(read(f)))
      .map(show);

    expect(
      offenders,
      `${offenders.join(', ')} uses a width media query inside the phone design. The phone is one width.`,
    ).toEqual([]);
  });
});

describe('the palette is the only source of colour', () => {
  it('has no raw hex in any component or stylesheet', () => {
    const offenders: string[] = [];
    for (const f of [...files(['.css']), ...files(['.tsx'])]) {
      const source = read(f)
        // Comments discuss hex values on purpose — the note explaining why
        // white on #ef4b39 is 3.66:1 is documentation, not a declaration.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        // `&#8209;` is a non-breaking hyphen, not a colour.
        .replace(/&#\d+;/g, '');
      for (const hex of source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
        offenders.push(`${show(f)}: ${hex}`);
      }
    }
    expect(
      offenders,
      `raw hex found — use var(--ow-color-*). A hand-typed value is how a 25th colour is born, and it is never checked for contrast:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('has no rgb()/hsl() literal either — the same hole, differently spelled', () => {
    // Comments are stripped first. This rule used to read its own prose and
    // fail on the sentence explaining WHY translucency over navy is exempt —
    // the same mistake the spacing rule already made once, about a phone
    // being 390px wide. A rule that fails on its own documentation teaches
    // people to delete the documentation.
    const offenders: string[] = [];
    for (const f of files(['.css'])) {
      const source = read(f).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
      for (const [i, line] of source.split('\n').entries()) {
        // rgba() is legal: a rail hover and the phone's tinted header cells
        // have to let the navy show through, and no flat token can do that.
        // A SOLID rgb()/hsl() has no such excuse — it is a colour smuggled
        // past the palette.
        const translucent = /rgba\([^)]*,\s*0?\.\d+\s*\)/.test(line);
        if (/\b(rgb|hsl)a?\(/.test(line) && !translucent) {
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
        } else if (!Number.isInteger(px)) {
          // A dimension is what a component needs: a 34px avatar, a 19px
          // badge, a 7px bar. There is no grid to be off — the space scale
          // is every integer — so the only rule left is that a dimension
          // is a whole pixel.
          offenders.push(`${where} — ${m} is not a whole pixel`);
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
      /**
       * It is `--ow-color-accent-btn` that matters, not `--ow-color-accent`.
       *
       * This rule used to count the raw coral, and had been watching the one
       * token a filled button never wears since the accent split three ways:
       * every primary on every screen went past it unseen. The raw accent is
       * a brand square, a bar segment or a 3px border — `neverCarriesText`
       * already governs it, and none of those is "the thing to do next".
       *
       * Counting the button token instead immediately found a second filled
       * control on the phone's Today.
       */
      const fills = (read(file).match(/background:\s*var\(--ow-color-accent-btn\)/g) ?? [])
        .length;
      expect(
        fills,
        `${show(file)} fills the accent ${fills} times. If two things on a screen are the one thing to do next, one of them is wrong.`,
      ).toBeLessThanOrEqual(1);
    },
  );
});

describe('no rule sets the same property twice', () => {
  /**
   * The later declaration silently wins, which is how a badge ends up with
   * `color: accentInk` immediately above `color: onFill` and renders white
   * on a pale pink chip at 1.6:1.
   *
   * Nothing else here would see it. The contrast test reads `legalPairings`,
   * not stylesheets; the token test reads tokens. A duplicate property is a
   * declaration that looks present, is present, and does nothing — the same
   * shape as the undefined custom property and the unresolved className that
   * both shipped before.
   */
  const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

  it.each(files(['.css']))('%s', (file) => {
    const offenders: string[] = [];
    for (const block of stripComments(read(file)).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const seen = new Map<string, number>();
      for (const decl of (block[2] ?? '').split(';')) {
        const prop = /^\s*([a-z-]+)\s*:/.exec(decl)?.[1];
        if (prop === undefined) continue;
        seen.set(prop, (seen.get(prop) ?? 0) + 1);
      }
      for (const [prop, n] of seen) {
        // A shorthand followed by its own longhand is a deliberate idiom
        // (`padding` then `padding-bottom`); the same property twice is not.
        if (n > 1) offenders.push(`${show(file)}: ${(block[1] ?? '').trim()} sets ${prop} ${n} times`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
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

describe('every design token a stylesheet asks for exists', () => {
  /**
   * `var(--ow-color-ink-2)` where the generated name is `--ow-color-ink2` is
   * not an error. It is an undefined variable, so the property falls back to
   * whatever it inherited and the screen looks *almost* right — the phone's
   * header labels rendered in dark body ink on a navy ground and the build
   * was green.
   *
   * The cause was a kebab-case function that split a letter from a capital
   * but not from a digit. The class of bug is "a name that silently resolves
   * to nothing", which is the same class the className test above catches for
   * CSS modules. This catches it for custom properties.
   */
  const defined = new Set(Object.keys(cssVariables()));

  it.each([...files(['.css']), ...files(['.tsx'])])('%s', (file) => {
    const missing = new Set<string>();
    for (const m of read(file).matchAll(/var\((--ow-[a-z0-9-]+)\s*[,)]/g)) {
      const name = m[1];
      if (name !== undefined && !defined.has(name)) missing.add(name);
    }
    expect(
      [...missing],
      `${show(file)} uses design tokens that are never generated, so they resolve to nothing:\n${[...missing].join('\n')}`,
    ).toEqual([]);
  });

  it('generates a token set worth checking against', () => {
    expect(defined.size).toBeGreaterThan(60);
  });
});
