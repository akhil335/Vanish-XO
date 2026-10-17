import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      'cloudflare:workers': path.resolve(import.meta.dirname, './test/cloudflare-workers-mock.ts'),
      '@': path.resolve(import.meta.dirname, './src'),
    },
    server: {
      deps: {
        inline: ['partyserver'],
      },
    },
  },
});
