/**
 * THE DESKTOP ROUTER, as a decision rather than as a file of JSX.
 *
 * A local-only edition is not the web app with the internet turned off. Three
 * whole regions of the product are about a SERVICE — a bank feed that a server
 * polls, a subscription that a card pays for, an account that somebody signs in
 * to — and none of them can mean anything in a program whose entire promise is
 * one file on one machine. They are not disabled here, or hidden behind a flag,
 * or left to fail politely when their API is unreachable. They are ABSENT: not
 * in the router, not in the bundle, not reachable from the entry.
 *
 * ── WHY A MANIFEST AND NOT JUST A SHORTER `<Routes>` ────────────────────────
 *
 * Because the failure this file exists to prevent is a route that nobody
 * decided about. `src/App.tsx` gains an address every few months. A desktop
 * router written as a second block of JSX would silently not have it, and the
 * gap would be found by a person clicking a menu item that goes nowhere.
 *
 * So every path in the web router is given an answer here, and
 * `__tests__/desktopRouter.test.tsx` reads `src/App.tsx` and fails if any path
 * has none. Three answers are possible and they are three different statements:
 *
 *   {@link DESKTOP_ROUTES}       mounted in this window today;
 *   {@link NEVER_ON_A_DESKTOP}   a decision, with the reason it was made;
 *   {@link AWAITING_THE_MOUNT}   admitted in principle, and blocked by a
 *                                MEASURED coupling that is named.
 *
 * ── THE PATHS ARE App.tsx's TOKENS, VERBATIM ────────────────────────────────
 *
 * Every `path` string below is a `path="…"` attribute copied out of
 * `src/App.tsx` exactly as it is written there, which is why some of them are
 * fragments (`app`, `data`, `payees`) rather than addresses: those routes are
 * nested, and reconstructing their full addresses would mean parsing JSX. The
 * question this manifest answers is "has every route in the web app been given a
 * desktop answer", and a verbatim token is the only thing a reader of the source
 * can bind to without becoming a compiler.
 *
 * What a person would TYPE is a field of its own now — {@link DesktopRoute.at} —
 * because the mount slice's second half needed it to be one. It was prose in the
 * margin while this file described a single screen; a router that serves thirty
 * addresses has to know where each of them actually is.
 */

/** A route this window serves. */
export interface DesktopRoute {
  /**
   * Its `path` attribute in `src/App.tsx`, verbatim — the KEY, not the address.
   *
   * Two of App.tsx's tokens are ambiguous on their own (`subscription` covers
   * two addresses; `security/audit-logs` is nested under `settings` and reads
   * like a top-level path), which is exactly why this stays verbatim and `at`
   * exists separately.
   */
  readonly path: string;
  /**
   * Where it lives in THIS window, relative to the frame.
   *
   * `''` is the index — the ledger's own screen. Everything else is what the
   * address bar a window does not have would show: `dashboard`,
   * `settings/app`, `accounts/:accountId`.
   *
   * It is a second field rather than a derivation because the derivation does
   * not exist: nothing in the token `app` says it is under `settings`. The two
   * are checked against each other by the router's test — every `at` unique,
   * every `at` ending in its own `path` unless the path is a nested token — so
   * a mismatch is a failure rather than a page at the wrong address.
   */
  readonly at: string;
  /**
   * What the window's title bar should say when it is showing.
   *
   * Load-bearing rather than documentation: `DesktopApp` writes it to
   * `document.title` on every navigation, because a window has no tab strip and
   * no address bar, so the title bar is the ONLY place it can say where you are.
   */
  readonly title: string;
}

/**
 * What the desktop router mounts.
 *
 * ── WHAT THIS LIST WAS, AND WHAT MADE IT THIS ───────────────────────────────
 *
 * One route, until the mount slice's second half: a chooser, because a window's
 * first screen is "which ledger?" where a browser's is a sign-in. Everything
 * else the product does was in {@link AWAITING_THE_MOUNT} behind a measurement —
 * a walk from `components/Layout` reaching 144 modules and five cloud roots, and
 * then, once four seams had answered those, twenty pages all naming the same
 * remaining blocker: `contexts/AppContextSupabase`.
 *
 * `@session` was that blocker's answer and `@service` was the answer to the
 * handful of bank-feed and billing surfaces sitting inside otherwise local
 * pages. Thirty-one routes are mounted here now, they are the SAME pages the web
 * app serves — not copies — and a walk from this window's entry still reaches no
 * cloud at all.
 *
 * The chooser is still first, and `''` is still it: a window with no file open
 * has nothing else it could show.
 */
export const DESKTOP_ROUTES = [
  { path: '/', at: '', title: 'WealthTracker' },
  { path: 'dashboard', at: 'dashboard', title: 'Dashboard' },
  { path: 'accounts', at: 'accounts', title: 'Accounts' },
  { path: 'accounts/:accountId', at: 'accounts/:accountId', title: 'Account' },
  { path: 'find', at: 'find', title: 'Find' },
  { path: 'transactions', at: 'transactions', title: 'Find' },
  { path: 'transactions-comparison', at: 'transactions-comparison', title: 'Find' },
  { path: 'reconciliation', at: 'reconciliation', title: 'Reconcile' },
  { path: 'categorisation', at: 'categorisation', title: 'Categorise' },
  { path: 'budget', at: 'budget', title: 'Budget' },
  { path: 'calendar', at: 'calendar', title: 'Calendar' },
  { path: 'reports', at: 'reports', title: 'Reports' },
  { path: 'reports/:reportId', at: 'reports/:reportId', title: 'Reports' },
  { path: 'goals', at: 'goals', title: 'Goals' },
  { path: 'analytics', at: 'analytics', title: 'Reports' },
  { path: 'summaries', at: 'summaries', title: 'Summaries' },
  { path: 'ai-analytics', at: 'ai-analytics', title: 'Reports' },
  { path: 'ai-features', at: 'ai-features', title: 'Reports' },
  { path: 'tax-planning', at: 'tax-planning', title: 'Reports' },
  { path: 'household', at: 'household', title: 'Settings' },
  { path: 'mobile-features', at: 'mobile-features', title: 'Dashboard' },
  { path: 'business-features', at: 'business-features', title: 'Dashboard' },
  { path: 'financial-planning', at: 'financial-planning', title: 'Reports' },
  { path: 'data-intelligence', at: 'data-intelligence', title: 'Reports' },
  { path: 'export-manager', at: 'export-manager', title: 'Export' },
  { path: 'documents', at: 'documents', title: 'Documents' },
  { path: 'performance', at: 'performance', title: 'Dashboard' },
  { path: 'advanced', at: 'advanced', title: 'Dashboard' },
  { path: 'settings', at: 'settings', title: 'Settings' },
  { path: 'app', at: 'settings/app', title: 'App settings' },
  { path: 'categories', at: 'settings/categories', title: 'Categories' },
  { path: 'tags', at: 'settings/tags', title: 'Tags' },
  { path: 'payees', at: 'settings/payees', title: 'Payees' },
  { path: 'security', at: 'settings/security', title: 'Security' },
  { path: 'security/audit-logs', at: 'settings/security/audit-logs', title: 'Audit log' },
  { path: 'forecasting', at: 'forecasting', title: 'Budget' },
  // The catch-all, and it is MOUNTED rather than owed or excluded — this window
  // serves the address, it just serves something else at it. The web app renders
  // `pages/NotFound`; a window has no address bar, so an unknown address is never
  // something a person typed. It is this program having sent itself somewhere
  // that does not exist, and it goes home rather than telling the user about our
  // mistake. Last in the list for a reader's benefit only: react-router v6 ranks
  // by specificity and would put it last wherever it was written.
  { path: '*', at: '*', title: 'WealthTracker' }
] as const satisfies readonly DesktopRoute[];

/**
 * The addresses this window serves, as a type.
 *
 * `DesktopApp` keys its screens by this, so a route added to the manifest above
 * without a screen behind it is a COMPILE error rather than a blank page. It is
 * the same trick the seam plays with `DataPort`: make the list and the
 * implementation check each other, so neither can be the only one that changed.
 */
export type DesktopPath = (typeof DESKTOP_ROUTES)[number]['path'];

/** A route that will never be part of a device edition, and why. */
export interface ExcludedRoute {
  /** Its `path` attribute in `src/App.tsx`. */
  readonly path: string;
  /** Which of the three absent regions it belongs to. */
  readonly region: 'banking' | 'subscription' | 'auth' | 'hosted-service';
  /** The reason, in the form a person asking "why can't I…" deserves. */
  readonly why: string;
}

/**
 * The gating proper: routes that are absent from the device edition by
 * decision.
 *
 * Each one is a REGION rather than a feature, and the regions are the three the
 * plan names plus the pages that describe the hosted service itself. Removing a
 * route from a router is the visible half; the other half is that nothing in the
 * desktop's import graph reaches the modules behind them, which
 * `desktopEntry.cloudFree.test.ts` walks and `scripts/desktop-bundle-greps.mjs`
 * measures in the built bundle.
 *
 * The same three regions, one level DOWN, are `@service` — the five or six
 * surfaces that are about the hosted service but live inside pages that are
 * otherwise entirely about the ledger. A region excluded at the router and then
 * smuggled back in as a card on a settings page would be no exclusion at all.
 */
export const NEVER_ON_A_DESKTOP: readonly ExcludedRoute[] = [
  {
    path: '/login',
    region: 'auth',
    why:
      'A device edition has no logins. The identity of a ledger is the uuid in the file’s own ' +
      'users row (deviceIdentity.ts), minted when the file is created, and the act that answers ' +
      '"who are you" is choosing a file. There is no ClerkProvider in this build and therefore ' +
      'nothing for a sign-in screen to talk to.'
  },
  {
    path: '/auth/callback',
    region: 'banking',
    why:
      'Despite its address this is the BANK feed’s OAuth return (pages/BankingCallback), not a ' +
      'sign-in. It exists to receive a redirect from a bank’s consent screen, which requires a ' +
      'server holding a client secret and a public URL to come back to. A desktop has neither.'
  },
  {
    path: 'open-banking',
    region: 'banking',
    why:
      'Bank feeds are a service: a server holds the consent, polls the institution and stores ' +
      'the rows. A program that promises the money never leaves the machine cannot have one. ' +
      'A device edition imports statements — QIF, OFX, CSV, .mny — which is the same data ' +
      'arriving by a route the person controls.'
  },
  {
    path: 'subscription',
    region: 'subscription',
    why:
      'Both addresses this token covers (/subscription and /settings/subscription) are Stripe ' +
      'billing for the hosted service. A desktop edition is not a subscription; whatever it is ' +
      'sold as, it is not sold from inside this router.'
  },
  {
    path: 'custom-reports',
    region: 'subscription',
    why:
      'Its page is clean and would mount — this is a decision, not a measurement. The web route ' +
      'is wrapped in a ProtectedSuspense that asks requirePremium, so the address exists to be ' +
      'refused to people on the wrong PLAN. A device edition has no plans, so mounting it would ' +
      'mean either shipping a premium feature to everyone by accident or inventing a tier to ' +
      'withhold it behind. Neither is a decision a router should make quietly, so the report ' +
      'builder waits for a deliberate answer about what a device edition sells.'
  },
  {
    path: '/privacy',
    region: 'hosted-service',
    why:
      'The privacy policy of a service that stores your data. This edition stores nothing ' +
      'anywhere, so the page would describe a relationship that does not exist. A device ' +
      'edition’s terms belong in its About screen and its licence, not at a URL.'
  },
  {
    path: '/terms',
    region: 'hosted-service',
    why:
      'The terms of service of a service. They govern an account, a subscription and rows held ' +
      'on somebody else’s computer, none of which this edition has. What a device edition owes ' +
      'a person instead is a licence, which ships with the application rather than at an address.'
  }
];

/** A route the device edition WILL have, and the coupling that keeps it out. */
export interface OwedRoute {
  /** Its `path` attribute in `src/App.tsx`. */
  readonly path: string;
  /**
   * What its page reaches at IMPORT TIME that a desktop bundle may not contain.
   *
   * Measured, not guessed: these are the chains the shared walker
   * (`services/local/__tests__/importGraph.ts`) finds from each page with the
   * seams resolved as `apps/desktop/vite.config.ts` resolves them.
   */
  readonly blockedBy: string;
}

/**
 * Admitted in principle. Not mounted, and the reason is a MEASUREMENT.
 *
 * ── THIS LIST WAS THIRTY-NINE ENTRIES LONG. IT IS THREE ─────────────────────
 *
 * Slice 29 could not mount the app's shell and wrote the reason down as a
 * number: a walk from `components/Layout` reached 144 modules and five
 * independent cloud roots — a Clerk button in the header, a bank feed in the
 * chrome, a Supabase client behind the preferences context, Sentry behind the
 * logger, the browser's store behind the demo banner. The mount slice's first
 * half answered all five with four seams and got the frame to 65 modules and
 * zero roots.
 *
 * That left twenty-five pages, of which twenty named one file:
 * `contexts/AppContextSupabase`, the state layer, whose walk found 48 modules
 * and four roots of its own — Clerk, the id translator, the offline queue and
 * the demo seeder. `@session` answered those four, and a walk from that provider
 * now reaches 38 modules and none.
 *
 * Behind it, five more things surfaced that had been INVISIBLE while it stood
 * there (a walk records the first chain that reaches a module, so a page's own
 * faults hide behind a shared one). Every one turned out to be a bank feed or a
 * billing card sitting inside a page that is otherwise entirely about the
 * ledger, so `@service` took them, and three pure helpers that happened to share
 * a file with a cloud one were split out: the demo sample rows, the backup file
 * format's download helper, and the bank-link mapping.
 *
 * ── WHAT IS LEFT, AND WHY EACH IS A SLICE RATHER THAN A LINE ────────────────
 *
 * Three, and they are two problems. Both are real work in a service this slice
 * had no business rewriting while it was mounting a router on top of it; both
 * are named here with the exact chain and the exact fix, which is what this list
 * is for.
 */
export const AWAITING_THE_MOUNT: readonly OwedRoute[] = [
  {
    path: 'investments',
    blockedBy:
      'Investments → services/api/investmentService → services/api/supabaseClient, and → ' +
      'services/userIdService. The page is not the problem: holdings are the one part of the ' +
      'ledger that never went through the seam, so this page talks to Supabase DIRECTLY rather ' +
      'than through `@data`. Mounting it in a window would mean a page that renders and then ' +
      'silently shows nothing, over a network the edition promises not to use. The fix is port ' +
      'verbs for holdings and prices, on both engines, with differential coverage — a slice of ' +
      'its own, and the last unported region of the data layer.'
  },
  {
    path: 'enhanced-import',
    blockedBy:
      'EnhancedImport → RestoreBackupModal → services/localBackupService → storageAdapter, and → ' +
      'services/backupService → supabaseClient. The restore itself already goes through ' +
      '`dataPort`; what does not is the PREVIEW — "this file holds rows your store cannot keep" ' +
      '— which reads LOCAL_BACKUP_BINDINGS, a description of the BROWSER\'s store. That is also ' +
      'a latent bug for this edition rather than only a coupling: the dialog picks that list ' +
      'whenever `backupTarget !== \'login\'`, so a device would be told a file\'s budgets cannot ' +
      'be kept when the file keeps all fourteen tables. The fix is a port question ("what can ' +
      'you not hold?") rather than a split, because the answer genuinely differs per engine.'
  },
  {
    path: 'data',
    blockedBy:
      '/settings/data — DataManagement → RestoreBackupModal, exactly as enhanced-import above; ' +
      'nothing else on the page is coupled any more. Worth naming what goes with it: this is ' +
      'where `dataPort.wipeAllFinancialData` is called from, so until the restore dialog is ' +
      'answered, a desktop window has no delete-everything button. That is the right way round ' +
      '— a destructive act should arrive with the dialog that explains it, not before'
  }
];
