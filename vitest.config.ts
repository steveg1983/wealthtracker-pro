import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { createVitestReactConfig } from './packages/config/vitest.react.js';

export default createVitestReactConfig({
  appRoot: process.cwd(),
  defineConfig,
  alias: {
    // The suite runs the WEB edition, so `@data` is the web edition's engine —
    // the same file `vite.config.ts` points it at. A test that wants the device
    // engine names `services/local/deviceDataPort` outright, because a test
    // which had to be told which edition it was in would not be testing the
    // seam. FIRST for the reason vite.config.ts gives: '@' would claim it.
    '@data': path.resolve(process.cwd(), './src/services/port'),
    // The mount slice's four, likewise the WEB halves: the suite renders the
    // browser's Layout, with a Clerk button and a search box that searches.
    '@chrome': path.resolve(process.cwd(), './src/editions/cloud/chrome'),
    '@identity': path.resolve(process.cwd(), './src/editions/cloud/identity'),
    '@prefs-store': path.resolve(process.cwd(), './src/editions/cloud/preferencesStore'),
    '@telemetry': path.resolve(process.cwd(), './src/editions/cloud/telemetry'),
    '@session': path.resolve(process.cwd(), './src/editions/cloud/session'),
    '@service': path.resolve(process.cwd(), './src/editions/cloud/service'),
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
    // The desktop MOUNT run, for the same reason and a sharper one: this config
    // maps all seven seams at their CLOUD halves and replaces
    // `AppContextSupabase` with a fixture provider, so the window rendered here
    // would be the web app wearing a HashRouter. It would pass, and it would go
    // on passing on the day the desktop build broke. `vitest.desktop.config.ts`
    // is how it is asked for, and `npm run test:desktop-mount` runs it.
    '**/desktopPages.test.tsx',
  ],
  test: {
    environment: process.env.RUN_SUPABASE_REAL_TESTS === 'true' ? 'node' : 'jsdom',
    globals: true,
  },
  esbuild: {
    jsx: 'automatic',
  },
});
