/**
 * WCAG contrast, computed rather than eyeballed.
 *
 * The old app shipped dark amber ink on a red fill — the worst pairing there
 * is on a phone in a yard in daylight — and nothing caught it, because the
 * palette was a list of hex values in a comment. Here every pairing the
 * system permits is checked by a test, so a bad one cannot be added.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`not a hex colour: ${hex}`);
  }
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/** Relative luminance, per WCAG 2.1. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Rounded to two places, for readable test output. */
export const ratio = (a: string, b: string): number =>
  Math.round(contrast(a, b) * 100) / 100;

/**
 * The floor a pairing must clear.
 *
 * `body` is anything at normal weight below 20px — most of this app.
 * `large` is ≥20px, or ≥14px bold. `ui` is the 3:1 floor for the boundary
 * of a control or a meaningful graphic.
 */
export const FLOOR = { body: 4.5, large: 3, ui: 3 } as const;

export type Floor = keyof typeof FLOOR;

export const passes = (ink: string, ground: string, floor: Floor = 'body'): boolean =>
  contrast(ink, ground) >= FLOOR[floor];
