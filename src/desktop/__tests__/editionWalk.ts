/**
 * WHAT A DESKTOP BUILD MAY NOT CONTAIN, and how a specifier resolves in each
 * edition. The vocabulary, not a test.
 *
 * Two tests now walk the import graph with a desktop's resolution and assert the
 * same thing of two different roots:
 *
 *   `desktopEntry.cloudFree.test.ts`     from `src/desktop/main.tsx` — the module
 *                                        a bundler is actually pointed at;
 *   `layoutIsDesktopClean.test.ts`       from `components/Layout.tsx` — the frame
 *                                        every page is drawn inside, which the
 *                                        entry does not reach yet and which part
 *                                        2 of the mount will make it reach.
 *
 * A second copy of either list would be the failure this repository keeps
 * finding: a rule one file knows about and another does not. `@data` has three
 * separate assertions that its six declarations agree; this is the same care,
 * applied before there are two lists rather than after.
 *
 * ── THE ALIAS MAPS ARE THE POINT OF BOTH TESTS ──────────────────────────────
 *
 * The whole mechanism is that shared source names no edition, so a walk over
 * that source has to be TOLD which one it is walking. Pointing the map at the
 * device halves is what makes each test a test of the desktop build; pointing it
 * at the cloud halves is what proves the instrument can still fail, and both
 * tests do both.
 */

/** Every seam, as `apps/desktop/vite.config.ts` resolves it. */
export const DEVICE_ALIAS: Readonly<Record<string, string>> = {
  '@data': 'services/local/deviceDataPort',
  '@chrome': 'desktop/editions/chrome',
  '@identity': 'desktop/editions/identity',
  '@prefs-store': 'desktop/editions/preferencesStore',
  '@telemetry': 'desktop/editions/telemetry',
  '@session': 'desktop/editions/session',
  '@service': 'desktop/editions/service'
};

/** Every seam, as `vite.config.ts` resolves it. The wrong way, on purpose. */
export const CLOUD_ALIAS: Readonly<Record<string, string>> = {
  '@data': 'services/port/index',
  '@chrome': 'editions/cloud/chrome',
  '@identity': 'editions/cloud/identity',
  '@prefs-store': 'editions/cloud/preferencesStore',
  '@telemetry': 'editions/cloud/telemetry',
  '@session': 'desktop/editions/session',
  '@service': 'editions/cloud/service'
};

/**
 * What a desktop build may not contain, and what each one would cost.
 *
 * ── WHAT `indexedDB` IS AND IS NOT, AND WHY TWO ENTRIES AND NOT ONE ─────────
 *
 * The mount slice's second half added `services/indexedDBService.ts` to this
 * list for about an hour, and took it off again. It is the right instinct and
 * the wrong rule: the prohibition is *the browser's copy of the LEDGER*, and
 * IndexedDB is merely where one of them happened to live. `services/
 * documentService.ts` keeps receipt IMAGES in the same database — browser-local
 * in the web edition too, not the ledger, not a network — and banning the API
 * would have made a receipt a leak.
 *
 * So the two things that WERE the ledger are named instead, and both were found
 * by `scripts/desktop-bundle-greps.mjs` reading the built renderer rather than
 * by this walk reading the source. That is the three-altitudes argument paying
 * for itself: a rule this file does not know is a rule this file reports green
 * on, and the built bundle does not care what the list says.
 *
 * ── WHY `contexts/AppContextSupabase.tsx` IS NO LONGER ON THIS LIST ─────────
 *
 * Because the mount's second half is what it was waiting for, and because it was
 * never really the prohibition. It was on this list from slice 29 with the note
 * *"named here so that arriving early is a failure rather than a surprise"*, and
 * what it was a stand-in FOR was four modules that are each named separately
 * above and below: `services/userIdService`, `services/autoSyncService`, the
 * demo seeder, and `@clerk/clerk-react`. `@session` took all four out of it; the
 * walk from that provider with a desktop's resolution now reaches 38 modules and
 * none of them, and the window MOUNTS it. Keeping it here would ban the app.
 *
 * Nothing was lost by the removal, which is the test of whether it should go: if
 * any of those four ever comes back to that file, four other entries fail.
 *
 * ── WHY THE DEMO BAN MOVED TO `utils/demoSeed.ts` ───────────────────────────
 *
 * The same shape of correction, one layer down. `utils/demoData.ts` was banned
 * for *"sample data written into the browser store"*, and that was two things in
 * one file: object literals, which are edition-blind, and the one function that
 * writes them into `services/storageAdapter`. `utils/testDataset.ts` — Settings
 * → "Load Test Data" — imports five of the literals, so the ban made a perfectly
 * local feature unreachable on a device. The seeding is `demoSeed.ts` now and
 * the ban is on that.
 *
 * ── WHY `loggers/scopedLogger.ts` IS NO LONGER ON THIS LIST ─────────────────
 *
 * It was, from slice 27 until the mount slice, and it was always a stand-in: the
 * app's logger is not the cloud, it merely reached the cloud, through one import
 * of `lib/sentry` two modules down. Seventy-four modules import that logger and
 * most of them are shared UI with nothing to do with a server, so banning it
 * banned logging on a device to ban telemetry on a device.
 *
 * `@telemetry` told the two apart, and this list now names the thing that was
 * always the real prohibition — `lib/sentry.ts`, and `@sentry/react` behind it.
 * That is a narrower rule and a truer one; `deviceDocument.cloudFree.test.ts`
 * keeps the wider one for the DATA layer, where a port that reached the app's
 * logger instead of the one it was constructed with would be a design mistake
 * rather than a leak.
 */
export const FORBIDDEN_MODULES: ReadonlyArray<{ module: string; why: string }> = [
  {
    module: 'services/api/supabaseClient.ts',
    why: 'a Supabase client — the cloud, in a program that promises the file never leaves the machine'
  },
  {
    module: 'lib/supabase.ts',
    why: 'a second Supabase client, reached through the realtime service rather than the data layer'
  },
  {
    module: 'services/api/dataService.ts',
    why:
      "the WEB edition's engine. Reaching it means some module imported `services/port` by path " +
      'instead of `@data`, so this build is talking to Supabase and to a file at once'
  },
  {
    module: 'services/storageAdapter.ts',
    why: "the browser's IndexedDB store — a second copy of the ledger, on a device that already has one"
  },
  {
    module: 'pwa/offline-storage.ts',
    why:
      'a queue of writes waiting for a SERVER to come back, kept in IndexedDB. There is no ' +
      'server to be offline from and a device write lands in the file immediately, so the queue ' +
      'is a copy of the ledger with nowhere to go. Found by `desktop:greps` and not by this ' +
      'walk, which is the clearest case in the repository for keeping both: the frame reached it ' +
      'through two PWA components and every list here called the frame clean'
  },
  {
    module: 'services/transactionCache.ts',
    why:
      "the CLOUD engine's boot snapshot — the whole history in IndexedDB so that a re-boot can " +
      'ask the server for a delta instead of 29 MB. A file has no round trip to save. It is here ' +
      'because the shared state layer imported it to EMPTY it on a wipe; that clear lives inside ' +
      '`DataService.wipeAllFinancialData` now, where the cache belongs'
  },
  {
    module: 'lib/sentry.ts',
    why: 'error reporting to a server, from the one edition whose promise is that nothing leaves'
  },
  {
    module: 'services/userIdService.ts',
    why: 'the Clerk↔database translator, in an edition where there is nothing to translate'
  },
  {
    module: 'contexts/AuthContext.tsx',
    why: 'a sign-in session, in an edition whose identity is the uuid inside the open file'
  },
  {
    module: 'contexts/SubscriptionContext.tsx',
    why: 'a billing state, in an edition that is not sold by subscription'
  },
  {
    module: 'utils/demoSeed.ts',
    why: 'sample data written into the browser store, for a hosted demo this edition cannot be in'
  },
  {
    module: 'services/autoSyncService.ts',
    why: 'a background push to a server, in a program with no server'
  },
  {
    module: 'services/realtimeService.ts',
    why: 'a socket listening for changes made somewhere else, and there is nowhere else'
  },
  {
    module: 'hooks/useAutoBankSync.ts',
    why: 'the bank feed’s scheduler — a whole region `NEVER_ON_A_DESKTOP` has already ruled on'
  }
];

/** And the packages, which a bundle would carry whole. */
export const FORBIDDEN_PACKAGES: ReadonlyArray<{ specifier: string; why: string }> = [
  { specifier: '@clerk/clerk-react', why: 'a sign-in provider' },
  { specifier: '@supabase/supabase-js', why: 'a database client' },
  { specifier: '@sentry/react', why: 'error reporting to a server' },
  { specifier: '@stripe/stripe-js', why: 'payments' },
  { specifier: '@stripe/react-stripe-js', why: 'payments' }
];
