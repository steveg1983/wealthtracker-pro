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
  '@telemetry': 'desktop/editions/telemetry'
};

/** Every seam, as `vite.config.ts` resolves it. The wrong way, on purpose. */
export const CLOUD_ALIAS: Readonly<Record<string, string>> = {
  '@data': 'services/port/index',
  '@chrome': 'editions/cloud/chrome',
  '@identity': 'editions/cloud/identity',
  '@prefs-store': 'editions/cloud/preferencesStore',
  '@telemetry': 'editions/cloud/telemetry'
};

/**
 * What a desktop build may not contain, and what each one would cost.
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
    module: 'contexts/AppContextSupabase.tsx',
    why:
      "the WEB's state layer, which reaches Clerk, the id translator, the browser store and the " +
      'demo data between them. It is the next thing the mount slice owes and it is named here so ' +
      'that arriving early is a failure rather than a surprise'
  },
  {
    module: 'utils/demoData.ts',
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
