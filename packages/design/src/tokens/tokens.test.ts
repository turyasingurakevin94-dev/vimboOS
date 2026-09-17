import { describe, expect, it } from 'vitest';
import { contrast, FLOOR, parseHex, ratio } from '../contrast.js';
import {
  color,
  greenRamp,
  intentionalAliases,
  legalPairings,
  neverCarriesText,
  violetRamp,
  type ColorToken,
} from './color.js';
import {
  designFor,
  DESIGNS,
  metrics,
  SWITCH_PX,
  HOW_EACH_DESIGN_WORKS,
} from './device.js';
import { size, weight } from './type.js';
import { radius, space } from './layout.js';

describe('the palette is well formed', () => {
  it('is every value a real colour', () => {
    for (const [name, value] of Object.entries(color)) {
      expect(() => parseHex(value), `${name} = ${value}`).not.toThrow();
    }
    for (const value of [...greenRamp, ...violetRamp]) {
      expect(() => parseHex(value), value).not.toThrow();
    }
  });

  it('has no duplicate values beyond the declared aliases', () => {
    const declared = new Set(
      intentionalAliases.flatMap(([a, b]) => [`${a}->${b}`, `${b}->${a}`]),
    );
    const byValue = new Map<string, ColorToken[]>();
    for (const [name, value] of Object.entries(color) as [ColorToken, string][]) {
      const v = value.toUpperCase();
      byValue.set(v, [...(byValue.get(v) ?? []), name]);
    }
    for (const [value, names] of byValue) {
      if (names.length === 1) continue;
      const group: ColorToken[] = [names[0]!];
      for (const name of names.slice(1)) {
        if (!group.some((prior) => declared.has(`${name}->${prior}`))) {
          expect.fail(
            `${name} duplicates ${group.join('/')} (${value}) — if that is deliberate, say so in intentionalAliases and why`,
          );
        }
        group.push(name);
      }
    }
  });

  it('keeps the declared aliases actually identical', () => {
    for (const [a, b] of intentionalAliases) {
      expect(color[a].toUpperCase(), `${a} and ${b} are declared aliases`).toBe(
        color[b].toUpperCase(),
      );
    }
  });
});

describe('contrast — every permitted pairing clears its floor', () => {
  it.each(legalPairings)('$note — $ink on $ground', ({ ink, ground, floor, note }) => {
    const r = contrast(color[ink], color[ground]);
    expect(
      r,
      `${note}: ${ink} (${color[ink]}) on ${ground} (${color[ground]}) is ${ratio(
        color[ink],
        color[ground],
      )}:1, floor is ${FLOOR[floor]}`,
    ).toBeGreaterThanOrEqual(FLOOR[floor]);
  });

  it('covers every colour — a token with no legal ground is never checked', () => {
    const covered = new Set<ColorToken>();
    for (const p of legalPairings) {
      covered.add(p.ink);
      covered.add(p.ground);
    }
    for (const { token } of neverCarriesText) covered.add(token);

    const uncovered = (Object.keys(color) as ColorToken[]).filter((t) => !covered.has(t));
    expect(
      uncovered,
      `these colours appear in no pairing and in no exemption, so nothing checks them: ${uncovered.join(', ')}`,
    ).toEqual([]);
  });

  it('holds the exempt colours genuinely below the floor, so the exemption stays honest', () => {
    for (const { token, why } of neverCarriesText) {
      const r = contrast(color[token], color.surface);
      expect(
        r,
        `${token} is exempt as "${why}" but reads at ${ratio(color[token], color.surface)}:1 on white — if it is now legible, give it a pairing instead of an exemption`,
      ).toBeLessThan(FLOOR.body);
    }
  });
});

describe('the accent is a fill and an icon, never a word', () => {
  /**
   * The single most important rule in this palette, and the one the app has
   * already broken once (amber ink on a red fill shipped, and nothing caught
   * it because the palette was a comment).
   *
   * #ef4b39 is 3.66:1 against white. That is below the floor in BOTH
   * directions — it cannot be text on a light ground, and white cannot be
   * text on it. The handoff's own prose slipped once and described the
   * primary button as #ef4b39; its markup uses #c2311f, and these tests hold
   * the markup's rule rather than the sentence's.
   */
  it('cannot be read as text on white, which is why it is exempt', () => {
    expect(contrast(color.accent, color.surface)).toBeLessThan(FLOOR.body);
  });

  it('cannot carry white text either — the direction people forget', () => {
    expect(contrast(color.onFill, color.accent)).toBeLessThan(FLOOR.body);
  });

  it('is never named as an ink or a ground in any legal pairing', () => {
    const used = legalPairings.filter((p) => p.ink === 'accent' || p.ground === 'accent');
    expect(
      used.map((p) => p.note),
      'the accent appears in a text pairing — use accentInk for anything with words on it',
    ).toEqual([]);
  });

  it('hands the button to accentBtn, which carries white', () => {
    expect(contrast(color.onFill, color.accentBtn)).toBeGreaterThanOrEqual(FLOOR.body);
    expect(contrast(color.onFill, color.accentBtnHover)).toBeGreaterThanOrEqual(FLOOR.body);
    // And the pressed state must be DARKER than the rest state, or the
    // button appears to light up when it is pushed down.
    expect(contrast(color.accentBtnHover, color.surface)).toBeGreaterThan(
      contrast(color.accentBtn, color.surface),
    );
  });

  it('hands accent-coloured TYPE to accentInk, which is darker again', () => {
    // Three reds, in one order: a fill you cannot read, a fill you can read
    // white on, and an ink you can read on white. Each step is darker than
    // the last, and a swap in either direction is a contrast failure.
    expect(contrast(color.accentInk, color.surface)).toBeGreaterThanOrEqual(FLOOR.body);
    expect(contrast(color.accentInk, color.surface)).toBeGreaterThan(
      contrast(color.accentBtn, color.surface),
    );
    expect(contrast(color.accentBtn, color.surface)).toBeGreaterThan(
      contrast(color.accent, color.surface),
    );
  });

  it('keeps all three close enough to read as one colour', () => {
    // They are the same red doing three jobs. If they drift apart, a button
    // and the brand square beside it stop looking like the same system.
    const far = (a: string, b: string): number => {
      const x = parseHex(a);
      const y = parseHex(b);
      return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
    };
    expect(far(color.accent, color.accentBtn)).toBeLessThan(80);
    expect(far(color.accent, color.accentInk)).toBeLessThan(90);
  });
});

describe('the five meaning families', () => {
  const FAMILIES = [
    { name: 'bad', fill: 'badFill', chip: 'badChip', ink: 'badInk' },
    { name: 'caution', fill: 'warnFill', chip: 'warnChip', ink: 'warnInk' },
    { name: 'good', fill: 'goodFill', chip: 'goodChip', ink: 'goodInk' },
    { name: 'informational', fill: 'infoFill', chip: 'infoChip', ink: 'infoInk' },
    { name: 'studied', fill: 'studyFill', chip: 'studyChip', ink: 'studyInk' },
  ] as const;

  it.each(FAMILIES)('$name has a fill, a chip and an ink, and the ink reads on its fill', (f) => {
    expect(color[f.fill]).toBeTruthy();
    expect(color[f.chip]).toBeTruthy();
    expect(contrast(color[f.ink], color[f.fill])).toBeGreaterThanOrEqual(FLOOR.body);
  });

  it.each(FAMILIES)('$name: the fill is lighter than the chip, which is lighter than the ink', (f) => {
    // A family whose three steps are not ordered is not a ramp, and a card
    // tinted darker than the chip on it reads as a mistake.
    const l = (c: string): number => contrast(c, '#000000');
    expect(l(color[f.fill])).toBeGreaterThan(l(color[f.chip]));
    expect(l(color[f.chip])).toBeGreaterThan(l(color[f.ink]));
  });

  it('gives "good" a lighter chip for its own ink, because the deep one is 4.18:1', () => {
    // goodInk on goodChip measures 4.18 — legal for an ICON, not for text.
    // So the design carries two greens: goodChipLight for text in goodInk,
    // and goodChip with goodInkStrong on it.
    expect(contrast(color.goodInk, color.goodChip)).toBeLessThan(FLOOR.body);
    expect(contrast(color.goodInk, color.goodChip)).toBeGreaterThanOrEqual(FLOOR.ui);
    expect(contrast(color.goodInk, color.goodChipLight)).toBeGreaterThanOrEqual(FLOOR.body);
    expect(contrast(color.goodInkStrong, color.goodChip)).toBeGreaterThanOrEqual(FLOOR.body);
  });
});

describe('the ramps', () => {
  it('deepens the green ramp monotonically', () => {
    const l = (c: string): number => contrast(c, '#000000');
    for (let i = 1; i < greenRamp.length; i++) {
      expect(l(greenRamp[i]!), `${greenRamp[i]} after ${greenRamp[i - 1]}`).toBeLessThan(
        l(greenRamp[i - 1]!),
      );
    }
  });

  it('lightens the violet ramp monotonically', () => {
    const l = (c: string): number => contrast(c, '#000000');
    for (let i = 1; i < violetRamp.length; i++) {
      expect(l(violetRamp[i]!)).toBeGreaterThan(l(violetRamp[i - 1]!));
    }
  });

  it('starts the violet ramp at the studied ink — the bars and the mark are one idea', () => {
    expect(violetRamp[0]).toBe(color.studyInk);
  });

  it('ends the aging bar on the accent — the oldest debt IS the thing to do next', () => {
    expect(color.agingOldest).toBe(color.accent);
  });
});

describe('type', () => {
  it('loads four weights and no more — a fifth gets faked by the browser', () => {
    expect(Object.values(weight)).toEqual([400, 500, 600, 700]);
  });

  /**
   * The ramp is an ALLOWLIST, not a grid.
   *
   * An earlier version of this system banned half-pixel sizes outright,
   * because the old app had reached 33 of them. But the disease was sizes
   * picked per screen with no list — not the existence of a .5. The handoff
   * uses 13.5 and 14.5 deliberately, so the rule is the list itself, which
   * is stricter: 21 is a whole number and still illegal.
   */
  it('is exactly the sizes the design file uses', () => {
    // Sorted, because JS hoists integer-like object keys ahead of the rest
    // however they are written. The set is the contract, not the order.
    const px = Object.keys(size)
      .map(Number.parseFloat)
      .sort((a, b) => a - b);
    expect(px).toEqual([
      9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 16.5, 17, 18,
      19, 20, 22, 24, 27,
    ]);
  });

  it('keys every size to its own pixel value, so the key can be read as the size', () => {
    for (const [key, value] of Object.entries(size)) {
      expect(value, key).toBe(`${key}px`);
    }
  });

  it('has no duplicate sizes', () => {
    const px = Object.values(size).map((v) => Number.parseFloat(v));
    expect(new Set(px).size).toBe(px.length);
  });
});

describe('space and radius', () => {
  it('is exactly the space scale the design file uses', () => {
    expect(Object.values(space).map((v) => Number.parseFloat(v))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 30,
    ]);
  });

  it('names every radius after what wears it', () => {
    // A radius called "md" tells you nothing at the call site; one called
    // "card" cannot be used on a chip by accident.
    expect(Object.keys(radius)).toEqual([
      'barWaterfall', 'barSmall', 'barTop', 'checkbox', 'chipSquare', 'segment',
      'iconChip', 'button', 'field', 'tile', 'block', 'card', 'sheet', 'frame',
      'pill',
    ]);
  });

  it('orders the radii from chip to frame', () => {
    const px = [
      'barWaterfall', 'barSmall', 'barTop', 'checkbox', 'chipSquare', 'segment',
      'iconChip', 'button', 'field', 'tile', 'card', 'frame',
    ] as const;
    for (let i = 1; i < px.length; i++) {
      expect(Number.parseFloat(radius[px[i]!])).toBeGreaterThan(
        Number.parseFloat(radius[px[i - 1]!]),
      );
    }
  });
});

describe('the two-designs law', () => {
  it('has exactly two designs — no tablet, no in-between', () => {
    expect(DESIGNS).toEqual(['desktop', 'phone']);
  });

  it('switches at 820, which is the handoff’s number', () => {
    expect(SWITCH_PX).toBe(820);
    expect(designFor(819)).toBe('phone');
    expect(designFor(820)).toBe('desktop');
    expect(designFor(390)).toBe('phone');
    expect(designFor(1440)).toBe('desktop');
  });

  /**
   * The phone is COMPACT here, by the owner's explicit request — "the same
   * content, less air" — and its type is the same 13/11 as the desktop's,
   * not larger. An earlier version of this file asserted the opposite.
   *
   * What still protects someone using it one-handed in a yard is the TARGET,
   * not the type size. That floor does not move, and this is the test that
   * holds it.
   */
  it('keeps every phone target at 44px, whatever the type does', () => {
    expect(Number.parseFloat(metrics.phone.tapTarget)).toBeGreaterThanOrEqual(44);
  });

  it('lets the desktop go below 44, because a pointer is not a thumb', () => {
    expect(Number.parseFloat(metrics.desktop.tapTarget)).toBeLessThan(44);
  });

  it('gives the desktop a rail and no tab bar, and the phone the reverse', () => {
    expect(metrics.desktop).toHaveProperty('railWidth');
    expect(metrics.desktop).not.toHaveProperty('tabBarHeight');
    expect(metrics.phone).toHaveProperty('tabBarHeight');
    expect(metrics.phone).not.toHaveProperty('railWidth');
  });

  it('records the width each design was drawn at, so a screenshot can be compared', () => {
    expect(metrics.desktop.drawnAt).toBe('1440px');
    expect(metrics.phone.drawnAt).toBe('390px');
  });

  it('answers every job differently for each design', () => {
    for (const [job, answers] of Object.entries(HOW_EACH_DESIGN_WORKS)) {
      expect(answers.desktop, `${job} has no desktop answer`).toBeTruthy();
      expect(answers.phone, `${job} has no phone answer`).toBeTruthy();
      expect(
        answers.desktop,
        `${job} gives both designs the same answer — then it is one design, and the law is broken`,
      ).not.toBe(answers.phone);
    }
  });
});
