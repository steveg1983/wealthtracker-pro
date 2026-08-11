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

export default defineConfig({
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
