import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@quizbude/protocol': here('./packages/protocol/src/index.ts'),
      '@quizbude/core': here('./packages/core/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
