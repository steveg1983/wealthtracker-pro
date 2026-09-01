/**
 * The local edition's contract run.
 *
 * A config of its own rather than a flag on the main one, because the two runs
 * disagree about three things that cannot be reconciled in a single file:
 *
 *  - ENVIRONMENT. The app's suite is jsdom; this one is node, because it opens
 *    a file on disk with `node:sqlite` and spawns the ledger crate.
 *  - SETUP. The app's setup registers a global mock for AppContextSupabase and
 *    a pile of browser shims. Nothing here has a browser or a cloud in it.
 *  - WHERE IT CAN RUN. This suite needs a built Rust binary and REFUSES to skip
 *    without one (R-8), which is exactly right for a developer's machine and
 *    exactly wrong for Vercel's build container. `vitest.config.ts` therefore
 *    excludes it by path, and this file is how it is asked for on purpose.
 *
 * `npm run test:local-contract`.
 */

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    // This run drives the DEVICE engine against real files, so `@data` is the
    // device's own choosing line. Nothing in the suite imports it today — the
    // contract tests build a `LocalDataPort` themselves, because a contract that
    // resolved its engine from a build config would be testing the config — but
    // the mapping is here so that the two runs never disagree about what the
    // word means, which is the failure a second alias would eventually cause.
    alias: {
      '@data': path.resolve(process.cwd(), './src/services/local/deviceDataPort'),
      // The mount slice's four, device halves, and here for the same reason
      // `@data` is: nothing in this suite imports them today, and the day one
      // does it must mean what it means everywhere else in this edition.
      '@chrome': path.resolve(process.cwd(), './src/desktop/editions/chrome'),
      '@identity': path.resolve(process.cwd(), './src/desktop/editions/identity'),
      '@prefs-store': path.resolve(process.cwd(), './src/desktop/editions/preferencesStore'),
      '@rules-store': path.resolve(process.cwd(), './src/desktop/editions/rulesStore'),
      '@telemetry': path.resolve(process.cwd(), './src/desktop/editions/telemetry'),
      '@session': path.resolve(process.cwd(), './src/desktop/editions/session'),
      '@service': path.resolve(process.cwd(), './src/desktop/editions/service'),
      // …and the device's answer to "can this edition write .xlsx", which is no
      // (owner, 1 Sep 2026).
      '@spreadsheet': path.resolve(process.cwd(), './src/desktop/editions/spreadsheet')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/services/port/__tests__/localCore.*.test.ts'],
    // One process, one temp directory of ledgers, one binary. The suite is
    // dominated by process spawns rather than by CPU, so a pool of workers
    // would buy contention rather than speed.
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 60000
  }
});
