import react from '@vitejs/plugin-react';
import { owTokens } from '@ow/design/vite';
import { defineConfig } from 'vite';
import { buildStamp } from './build-stamp.js';

export default defineConfig({
  plugins: [react(), owTokens(), buildStamp()],
  /**
   * Served from a domain root by default.
   *
   * NOT a relative `./`: the SPA rewrite hands index.html to every path, so
   * at `/customers/42` a relative asset URL would resolve to
   * `/customers/assets/…` and 404. There is no router yet, but the rewrite
   * is already in `vercel.json` and this would break the day one lands.
   *
   * To serve from a subpath instead — a GitHub Pages project site, a static
   * snapshot — pass it at build time: `vite build --base=/vimboOS/`.
   */
  base: '/',
  build: {
    // The two designs are separate entry points into the same app. Splitting
    // them means a phone never downloads the desktop console's table code,
    // and `bundles.test.ts` asserts neither chunk contains the other.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('/src/desktop/')) return 'desktop';
          if (id.includes('/src/phone/')) return 'phone';
          return undefined;
        },
      },
    },
  },
});
