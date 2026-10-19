import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/play/',
  plugins: [react()],
  resolve: {
    alias: {
      '@quizbude/protocol': fileURLToPath(
        new URL('../../packages/protocol/src/index.ts', import.meta.url),
      ),
    },
  },
  server: { port: 5174 },
  build: { outDir: 'dist', emptyOutDir: true },
});
