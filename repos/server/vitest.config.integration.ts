import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    globals: true,
    hookTimeout: 120_000,
    include: ['**/*.integration-spec.ts'],
    root: './',
    testTimeout: 30_000,
  },
});
