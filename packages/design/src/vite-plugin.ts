/**
 * The tokens reach CSS through a virtual module, not a generated file.
 *
 * A generated `tokens.css` committed to the repo would be one more thing
 * that can be stale — and a stale palette is invisible until a screenshot
 * looks wrong. Deriving it at build time means the stylesheet cannot drift
 * from `tokens/` because there is no stylesheet to drift; it is produced
 * from the TypeScript on every dev boot and every build.
 *
 *   import 'virtual:ow-tokens.css';
 */

import type { Plugin } from 'vite';
import { TOKEN_CSS } from './css.js';

const VIRTUAL_ID = 'virtual:ow-tokens.css';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export function owTokens(): Plugin {
  return {
    name: 'ow-tokens',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      return id === RESOLVED_ID ? TOKEN_CSS : null;
    },
  };
}
