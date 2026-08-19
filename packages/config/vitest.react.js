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
  '**/CLAUDE.md.backup.*',
  // Session worktrees are FULL CHECKOUTS nested under .claude/worktrees, and a
  // vitest file argument is a FILTER, not a path: measured from the repo root,
  // `vitest list --filesOnly src/test/supabase/supabase-smoke.test.ts` matched
  // 7 files — the named one plus six worktree copies, some stale enough to
  // fail on rules the current tree no longer has. A worktree running its own
  // suite is unaffected: its files are `src/...` relative to its own root.
  '**/.claude/**'
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
  all: false,
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
