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
    'src-backup-optimized/**',
    '**/*.backup.*/**',
    '**/CLAUDE.md.backup.*',
    'WealthTracker-Backups/**',
    'apps/**',
    'api/**', // Backend API endpoints tested separately
    // The local edition's contract run. It needs a built Rust binary and
    // REFUSES to skip without one, which is right on a developer's machine and
    // wrong in Vercel's build container — so it is asked for on purpose, by
    // `npm run test:local-contract` (vitest.local.config.ts), and never by
    // accident here.
    '**/localCore.*.test.ts',
  ],
  test: {
    environment: process.env.RUN_SUPABASE_REAL_TESTS === 'true' ? 'node' : 'jsdom',
    globals: true,
  },
  esbuild: {
    jsx: 'automatic',
  },
});
