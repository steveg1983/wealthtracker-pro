import path from 'node:path';

const defaultExclude = [
  '**/node_modules/**',
  '**/dist/**',
  'dist/**',
  '**/e2e/**',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  'src.backup.*',
  'src.backup.*/**',
  '**/src.backup.*/**',
  '**/*.backup.*/**',
  '**/CLAUDE.md.backup.*'
];

const defaultInclude = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.real.test.ts',
  '**/*.real.test.tsx'
];

const defaultCoverage = {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  exclude: [
    'node_modules/',
    'src/test/',
    '**/*.d.ts',
    '**/*.config.*',
    '**/mockData.ts',
    'src/main.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/test-utils.ts',
    '**/test-setup.ts',
    '**/src.backup.*/**',
    '**/*.backup.*/**',
  ],
  include: ['src/**/*.{ts,tsx}'],
  all: true,
  clean: true,
  reportsDirectory: './coverage',
  thresholds: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
};

const mergeCoverage = (overrides = {}) => ({
  ...defaultCoverage,
  ...overrides,
  exclude: overrides.exclude ?? defaultCoverage.exclude,
  include: overrides.include ?? defaultCoverage.include,
  thresholds: overrides.thresholds ?? defaultCoverage.thresholds,
});

export const createVitestReactConfig = ({
  appRoot,
  defineConfig: defineConfigFn,
  setupFiles = ['./src/test/setup/vitest-setup.ts'],
  include = defaultInclude,
  exclude = defaultExclude,
  coverage,
  alias,
  test = {},
  plugins = [],
  defineConfigOverrides = {}
} = {}) => {
  if (!appRoot) {
    throw new Error('createVitestReactConfig requires an appRoot directory');
  }
  if (!defineConfigFn) {
    throw new Error('createVitestReactConfig requires a defineConfig function from vitest');
  }

  const resolvedAlias = alias ?? {
    '@': path.resolve(appRoot, './src')
  };

  return defineConfigFn({
    plugins,
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles,
      testTimeout: test.testTimeout ?? 30000,
      hookTimeout: test.hookTimeout ?? 30000,
      include,
      exclude,
      coverage: mergeCoverage(coverage),
      ...test,
    },
    resolve: {
      alias: resolvedAlias,
    },
    ...defineConfigOverrides,
  });
};

export default createVitestReactConfig;
