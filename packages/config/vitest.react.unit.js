export const createVitestReactUnitConfig = ({
  defineConfig,
  test = {},
  defineConfigOverrides = {}
} = {}) => {
  if (!defineConfig) {
    throw new Error('createVitestReactUnitConfig requires a defineConfig function from vitest');
  }
  return defineConfig({
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
    },
    ...test,
  },
  ...defineConfigOverrides,
  });
};

export default createVitestReactUnitConfig;
