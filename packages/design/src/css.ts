/**
 * The tokens, as CSS custom properties.
 *
 * TypeScript is the single source of truth and this file derives the CSS from
 * it, so the two can never disagree. In the old app the palette lived in a
 * comment beside 38,000 lines of stylesheet, and the stylesheet won every
 * argument.
 *
 * Naming: `--ow-<group>-<name>`, kebab-cased. A component reads
 * `var(--ow-color-accent)` and never a hex value — there is a lint rule that
 * says so, because a hand-typed `#1D4ED8` is how a 24th colour is born.
 */

import { color, greenRamp, violetRamp } from './tokens/color.js';
import {
  chrome,
  elevation,
  focusRing,
  layer,
  motion,
  radius,
  scrim,
  space,
} from './tokens/layout.js';
import { font, leading, measure, size, tracking, weight } from './tokens/type.js';

/**
 * `cashFill` → `cash-fill`, and `14.5` → `14-5`.
 *
 * The dot has to go: a custom property named `--ow-size-14.5` must be
 * escaped as `--ow-size-14\.5` at every single use site, and one missed
 * backslash is a silently unstyled element.
 */
const kebab = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    // `ink2` → `ink-2`. Without this the digit stays welded on and the
    // generated name is `--ow-color-ink2` while every stylesheet asks for
    // `--ow-color-ink-2` — which is not an error, it is an undefined
    // variable, so the text silently falls back to whatever it inherited.
    .replace(/([a-z])(\d)/g, '$1-$2')
    .replace(/\./g, '-')
    .toLowerCase();

const group = (
  prefix: string,
  values: Record<string, string | number>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(values).map(([k, v]) => [`--ow-${prefix}-${kebab(k)}`, String(v)]),
  );

/** Every token as a flat map of custom property name to value. */
export function cssVariables(): Record<string, string> {
  return {
    ...group('color', color),
    ...group('space', space),
    ...group('radius', radius),
    ...group('elevation', elevation),
    ...group('chrome', chrome),
    ...group('font', font),
    ...group('weight', weight),
    ...group('size', size),
    ...group('leading', leading),
    ...group('tracking', tracking),
    ...group('motion', motion),
    ...group('layer', layer),
    ...Object.fromEntries(greenRamp.map((v, i) => [`--ow-green-${i + 1}`, v])),
    ...Object.fromEntries(violetRamp.map((v, i) => [`--ow-violet-${i + 1}`, v])),
    '--ow-scrim': scrim,
    '--ow-measure': measure,
    '--ow-focus-width': focusRing.width,
    '--ow-focus-offset': focusRing.offset,
  };
}

/** The `:root` block, ready to be written into a stylesheet. */
export const TOKEN_CSS: string = [
  ':root {',
  ...Object.entries(cssVariables()).map(([k, v]) => `  ${k}: ${v};`),
  '}',
].join('\n');
