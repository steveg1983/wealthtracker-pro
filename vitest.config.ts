import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { createVitestReactConfig } from './packages/config/vitest.react.js';

export default createVitestReactConfig({
  appRoot: process.cwd(),
  defineConfig,
  alias: {
    '@': path.resolve(process.cwd(), './src'),
    '@/contexts/AppContextSupabase': path.resolve(process.cwd(), './src/test/mocks/AppContextSupabase.ts'),
  },
  setupFiles: process.env.RUN_SUPABASE_REAL_TESTS === 'true'
    ? []
    : ['./src/test/setup.ts'],
  exclude: [
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
    'WealthTracker-Backups/**',
    'apps/**',
  ],
  test: {
    environment: process.env.RUN_SUPABASE_REAL_TESTS === 'true' ? 'node' : 'jsdom',
    globals: true,
  },
  esbuild: {
    jsx: 'automatic',
  },
});
