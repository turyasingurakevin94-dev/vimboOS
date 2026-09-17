import react from '@vitejs/plugin-react';
import { owTokens } from '@ow/design/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), owTokens()],
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
