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

import { color } from './tokens/color.js';
import { elevation, focusRing, layer, motion, radius, scrim, space } from './tokens/layout.js';
import { font, leading, measure, size, tracking, weight } from './tokens/type.js';

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

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
    ...group('font', font),
    ...group('weight', weight),
    ...group('size', size),
    ...group('leading', leading),
    ...group('tracking', tracking),
    ...group('motion', motion),
    ...group('layer', layer),
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
