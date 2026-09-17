import { describe, expect, it } from 'vitest';
import { contrast, FLOOR, parseHex, ratio } from '../contrast.js';
import {
  color,
  intentionalAliases,
  legalPairings,
  neverCarriesText,
  type ColorToken,
} from './color.js';
import { designFor, DESIGNS, metrics, SWITCH_PX, HOW_EACH_DESIGN_WORKS } from './device.js';
import { size, weight } from './type.js';
import { space } from './layout.js';

describe('the palette is well formed', () => {
  it('is every value a real colour', () => {
    for (const [name, value] of Object.entries(color)) {
      expect(() => parseHex(value), `${name} = ${value}`).not.toThrow();
    }
  });

  it('stays small — a palette nobody can hold in their head is not a palette', () => {
    expect(Object.keys(color).length).toBeLessThanOrEqual(26);
  });

  it('has no duplicate values beyond the declared aliases', () => {
    const declared = new Set(
      intentionalAliases.flatMap(([a, b]) => [`${a}->${b}`, `${b}->${a}`]),
    );
    const seen = new Map<string, ColorToken>();
    for (const [name, value] of Object.entries(color) as [ColorToken, string][]) {
      const v = value.toUpperCase();
      const prior = seen.get(v);
      if (prior !== undefined && !declared.has(`${name}->${prior}`)) {
        expect.fail(
          `${name} duplicates ${prior} (${v}) — if that is deliberate, say so in intentionalAliases and why`,
        );
      }
      seen.set(v, name);
    }
  });

  it('keeps the declared aliases actually identical', () => {
    // An alias that has drifted is worse than no alias: the two names now
    // promise to match and quietly do not.
    for (const [a, b] of intentionalAliases) {
      expect(color[a].toUpperCase(), `${a} and ${b} are declared aliases`).toBe(
        color[b].toUpperCase(),
      );
    }
  });
});

describe('contrast — every permitted pairing clears its floor', () => {
  it.each(legalPairings)(
    '$note — $ink on $ground',
    ({ ink, ground, floor, note }) => {
      const r = contrast(color[ink], color[ground]);
      expect(
        r,
        `${note}: ${ink} (${color[ink]}) on ${ground} (${color[ground]}) is ${ratio(
          color[ink],
          color[ground],
        )}:1, floor is ${FLOOR[floor]}`,
      ).toBeGreaterThanOrEqual(FLOOR[floor]);
    },
  );

  it('keeps real headroom, not a value squeaking past on the third decimal', () => {
    const body = legalPairings.filter((p) => p.floor === 'body');
    const worst = body
      .map((p) => ({ ...p, r: contrast(color[p.ink], color[p.ground]) }))
      .sort((a, b) => a.r - b.r)[0];
    expect(worst).toBeDefined();
    // 4.8 rather than 4.5: a pairing that only just clears is one rounding
    // decision away from failing, and nobody re-checks after a tweak.
    expect(
      worst!.r,
      `weakest pairing is ${worst!.ink} on ${worst!.ground} at ${Math.round(worst!.r * 100) / 100}:1`,
    ).toBeGreaterThanOrEqual(4.8);
  });

  it('covers every colour — a token with no legal ground is never checked', () => {
    const covered = new Set<ColorToken>();
    for (const p of legalPairings) {
      covered.add(p.ink);
      covered.add(p.ground);
    }
    for (const { token } of neverCarriesText) covered.add(token);

    const uncovered = (Object.keys(color) as ColorToken[]).filter(
      (t) => !covered.has(t),
    );
    expect(
      uncovered,
      `these colours appear in no pairing and in no exemption, so nothing checks them: ${uncovered.join(', ')}`,
    ).toEqual([]);
  });

  it('holds the exempt colours genuinely below the floor, so the exemption stays honest', () => {
    for (const { token, why } of neverCarriesText) {
      const r = contrast(color[token], color.paper);
      expect(
        r,
        `${token} is exempt as "${why}" but reads at ${Math.round(r * 100) / 100}:1 on paper — if it is now legible, give it a pairing instead of an exemption`,
      ).toBeLessThan(FLOOR.body);
    }
  });
});

describe('the accent is cool and the states are warm', () => {
  // The structural fix over the old palette. Blue can only mean "the one
  // action"; warm can only mean "something about this figure". If the accent
  // ever drifts warm, the two vocabularies collide again and a red thing on
  // screen becomes ambiguous.
  const hue = (hex: string): number => {
    const { r, g, b } = parseHex(hex);
    const [R, G, B] = [r / 255, g / 255, b / 255] as const;
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const d = max - min;
    if (d === 0) return 0;
    const h =
      max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    return (h * 60 + 360) % 360;
  };

  it('puts the accent in the blue arc', () => {
    expect(hue(color.accent)).toBeGreaterThan(180);
    expect(hue(color.accent)).toBeLessThan(280);
  });

  it('puts every state colour in the warm arc', () => {
    for (const t of ['good', 'warn', 'bad'] as const) {
      const h = hue(color[t]);
      const warm = h < 180;
      expect(warm, `${t} (${color[t]}) sits at hue ${Math.round(h)}`).toBe(true);
    }
  });

  it('keeps the three states far enough apart to tell apart', () => {
    const hues = (['good', 'warn', 'bad'] as const).map((t) => hue(color[t]));
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        expect(Math.abs(hues[i]! - hues[j]!)).toBeGreaterThan(20);
      }
    }
  });
});

describe('type', () => {
  it('loads four weights and no more — a fifth gets faked by the browser', () => {
    expect(Object.keys(weight)).toHaveLength(4);
    expect(Object.values(weight)).toEqual([400, 500, 600, 700]);
  });

  it('has no half-pixel sizes', () => {
    for (const [name, value] of Object.entries(size)) {
      const px = Number.parseFloat(value);
      expect(Number.isInteger(px), `${name} = ${value}`).toBe(true);
    }
  });

  it('keeps the ramp short enough to choose from', () => {
    expect(Object.keys(size).length).toBeLessThanOrEqual(12);
  });
});

describe('space', () => {
  it('is a 4px grid, with 2 and 6 allowed for the inside of a chip', () => {
    for (const [step, value] of Object.entries(space)) {
      const px = Number.parseFloat(value);
      const ok = px === 0 || px === 2 || px === 6 || px % 4 === 0;
      expect(ok, `step ${step} = ${value} is off the grid`).toBe(true);
    }
  });

  it('increases monotonically', () => {
    const values = Object.values(space).map((v) => Number.parseFloat(v));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });
});

describe('the two-designs law', () => {
  it('has exactly two designs — no tablet, no in-between', () => {
    expect(DESIGNS).toEqual(['desktop', 'phone']);
  });

  it('switches at one number, in one place', () => {
    expect(designFor(SWITCH_PX - 1)).toBe('phone');
    expect(designFor(SWITCH_PX)).toBe('desktop');
    expect(designFor(390)).toBe('phone'); // a phone
    expect(designFor(834)).toBe('phone'); // a portrait tablet
    expect(designFor(1024)).toBe('desktop'); // a landscape tablet, a laptop
    expect(designFor(1920)).toBe('desktop');
  });

  it('gives the phone bigger text than the desktop, not smaller', () => {
    // The reflex is to shrink everything on a small screen. Outdoors, in
    // daylight, at arm's length, the phone needs the LARGER type.
    expect(Number.parseFloat(metrics.phone.bodySize)).toBeGreaterThan(
      Number.parseFloat(metrics.desktop.bodySize),
    );
    expect(Number.parseFloat(metrics.phone.metaSize)).toBeGreaterThan(
      Number.parseFloat(metrics.desktop.metaSize),
    );
  });

  it('gives the phone a thumb-sized target and the desktop a pointer-sized one', () => {
    expect(Number.parseFloat(metrics.phone.tapTarget)).toBeGreaterThanOrEqual(44);
    expect(Number.parseFloat(metrics.desktop.tapTarget)).toBeLessThan(44);
  });

  it('gives the desktop tighter rows and padding — that is what density is', () => {
    expect(Number.parseFloat(metrics.desktop.rowPaddingY)).toBeLessThan(
      Number.parseFloat(metrics.phone.rowPaddingY),
    );
    expect(Number.parseFloat(metrics.desktop.pagePadding)).toBeGreaterThan(
      Number.parseFloat(metrics.phone.pagePadding),
    );
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

  it('gives the phone no rail and the desktop no tab bar', () => {
    expect(metrics.desktop).toHaveProperty('railWidth');
    expect(metrics.desktop).not.toHaveProperty('tabBarHeight');
    expect(metrics.phone).toHaveProperty('tabBarHeight');
    expect(metrics.phone).not.toHaveProperty('railWidth');
  });
});
