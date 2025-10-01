import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/services/api/__tests__/**/*.test.ts?(x)'],
    exclude: ['**/*.real.test.ts', '**/*.real.test.tsx'],
    coverage: { enabled: false },
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    }
  }
});
