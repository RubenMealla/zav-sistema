import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false,
    globalSetup: ['./test/global-setup-e2e.mjs'],
    hookTimeout: 30000,
    testTimeout: 20000,
  },
});
