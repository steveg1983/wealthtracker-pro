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
 * The third is the honest one. See its own note: it is not a to-do list, it is
 * a measurement, and it is why this slice's router mounts one route.
 *
 * ── THE PATHS ARE App.tsx's TOKENS, VERBATIM ────────────────────────────────
 *
 * Every string below is a `path="…"` attribute copied out of `src/App.tsx`
 * exactly as it is written there, which is why some of them are fragments
 * (`app`, `data`, `payees`) rather than addresses (`/settings/app`): those
 * routes are nested, and reconstructing their full addresses would mean parsing
 * JSX. The question this manifest answers is "has every route in the web app
 * been given a desktop answer", and a verbatim token is the only thing a reader
 * of the source can bind to without becoming a compiler. The prose beside each
 * one gives the address a person would type.
 */

/** A route this window serves. */
export interface DesktopRoute {
  /** Its address, as `<Route path>` takes it. */
  readonly path: string;
  /** What the window's title bar should say when it is showing. */
  readonly title: string;
}

/**
 * What the desktop router mounts TODAY.
 *
 * One route, and it is a route the web app does not have: a window's first
 * screen is "which ledger?", where a browser's is a sign-in. Everything else the
 * product does is in {@link AWAITING_THE_MOUNT} for a reason that is measured
 * rather than estimated.
 */
export const DESKTOP_ROUTES = [
  { path: '/', title: 'WealthTracker' }
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
   * seams resolved as `apps/desktop/vite.config.ts` resolves them. Until the
   * mount slice most of them said `Layout → @clerk/clerk-react`, because the
   * FRAME was the first thing every page reached; the frame is clean now
   * (`__tests__/layoutIsDesktopClean.test.ts`) and each entry names what its own
   * page reaches instead.
   */
  readonly blockedBy: string;
}

/**
 * Admitted in principle. Not mounted yet, and the reason is a MEASUREMENT.
 *
 * ── WHAT WAS MEASURED IN SLICE 29, AND WHAT IS TRUE NOW ─────────────────────
 *
 * Slice 29 set out to mount the app's own shell in this window and could not,
 * and wrote the reason down as a number: a runtime import walk from
 * `components/Layout` reached **144 modules and five independent cloud roots**,
 * none of which was any page's own fault — a Clerk button in the header, a bank
 * feed in the chrome, a Supabase client behind the preferences context, Sentry
 * behind the logger, and the browser's store behind the demo banner.
 *
 * The mount slice's first half is what answered them. Four seams — `@chrome`,
 * `@identity`, `@prefs-store`, `@telemetry` — joined `@data`, each a specifier
 * the BUILD resolves to one of two files, and the same walk now reaches
 * **65 modules and ZERO cloud roots**. `desktop/__tests__/layoutIsDesktopClean.
 * test.ts` is that measurement, executed, with an arm that points each seam back
 * at its cloud half and requires the cloud to reappear.
 *
 * So the frame is no longer what stands in the way of anything, and every entry
 * below that said `Layout → @clerk/clerk-react` was corrected rather than
 * deleted. What replaced it is what a walk from each PAGE actually finds today,
 * which is a much shorter story than the old table told:
 *
 * Twenty-five of the entries below have a page of their own; the rest are
 * redirects into one of those. Of the twenty-five:
 *
 *   * TWENTY reach `contexts/AppContextSupabase` — the WEB's state layer, and now
 *     the single blocker of substance. It is one context, it is imported by 70
 *     modules, and it reaches Clerk, the id translator, the browser store, the
 *     demo data and the auto-sync service between them. It is the mount's second
 *     half;
 *   * THREE reach a cloud module of their own and nothing else — a subscription
 *     card, a bank-feed setting, a danger zone;
 *   * **two are already clean**: `documents` and `security/audit-logs` reach no
 *     cloud at all under a desktop's resolution. They are what part 2 can mount
 *     on the day it starts.
 *
 * The redirects are unchanged and are honest as they stand: a redirect cannot be
 * less blocked than the route it redirects into.
 */
export const AWAITING_THE_MOUNT: readonly OwedRoute[] = [
  { path: 'dashboard', blockedBy: 'ImprovedDashboard → AppContextSupabase' },
  { path: 'accounts', blockedBy: 'Accounts → AppContextSupabase' },
  { path: 'accounts/:accountId', blockedBy: 'AccountTransactions → AppContextSupabase' },
  { path: 'find', blockedBy: 'Find → AppContextSupabase' },
  { path: 'transactions', blockedBy: 'a redirect into find, which is itself owed' },
  { path: 'transactions-comparison', blockedBy: 'a redirect into find, which is itself owed' },
  { path: 'reconciliation', blockedBy: 'Reconciliation → AppContextSupabase' },
  { path: 'categorisation', blockedBy: 'Categorisation → AppContextSupabase' },
  { path: 'investments', blockedBy: 'Investments → AppContextSupabase' },
  { path: 'budget', blockedBy: 'Budget → AppContextSupabase' },
  { path: 'calendar', blockedBy: 'Calendar → AppContextSupabase' },
  { path: 'reports', blockedBy: 'ReportsHub → AppContextSupabase' },
  { path: 'reports/:reportId', blockedBy: 'ReportsHub → AppContextSupabase' },
  { path: 'goals', blockedBy: 'Goals → AppContextSupabase' },
  { path: 'analytics', blockedBy: 'a redirect into reports, which is itself owed' },
  {
    path: 'custom-reports',
    blockedBy:
      'CustomReports → AppContextSupabase; and its ProtectedSuspense asks requirePremium, which ' +
      'is a subscription question a device edition does not have — see NEVER_ON_A_DESKTOP'
  },
  { path: 'summaries', blockedBy: 'FinancialSummaries → AppContextSupabase' },
  { path: 'ai-analytics', blockedBy: 'a redirect into reports, which is itself owed' },
  { path: 'ai-features', blockedBy: 'a redirect into reports, which is itself owed' },
  { path: 'tax-planning', blockedBy: 'a redirect into reports, which is itself owed' },
  { path: 'household', blockedBy: 'a redirect into settings, which is itself owed' },
  { path: 'mobile-features', blockedBy: 'a redirect into dashboard, which is itself owed' },
  { path: 'business-features', blockedBy: 'a redirect into dashboard, which is itself owed' },
  { path: 'financial-planning', blockedBy: 'a redirect into reports, which is itself owed' },
  { path: 'data-intelligence', blockedBy: 'a redirect into reports, which is itself owed' },
  { path: 'export-manager', blockedBy: 'ExportManager → AppContextSupabase' },
  { path: 'enhanced-import', blockedBy: 'EnhancedImport → AppContextSupabase' },
  {
    path: 'documents',
    blockedBy:
      'NOTHING but the mount itself. A walk from `pages/Documents` with a desktop’s resolution ' +
      'reaches 13 modules and no cloud at all. Part 2 mounts this one first.'
  },
  { path: 'performance', blockedBy: 'a redirect into dashboard, which is itself owed' },
  { path: 'advanced', blockedBy: 'a redirect into dashboard, which is itself owed' },
  {
    path: 'settings',
    blockedBy:
      '/settings — Settings → SubscriptionStatus → SubscriptionContext → Clerk. Not the state ' +
      'layer: the settings index shows a billing card, which is a region this edition does not have'
  },
  { path: 'app', blockedBy: '/settings/app — AppSettings → BankFeedRefreshSettings → Clerk' },
  { path: 'data', blockedBy: '/settings/data — DataManagement → AppContextSupabase' },
  { path: 'categories', blockedBy: '/settings/categories — Categories → AppContextSupabase' },
  { path: 'tags', blockedBy: '/settings/tags — Tags → AppContextSupabase' },
  { path: 'payees', blockedBy: '/settings/payees — PayeeCleanup → AppContextSupabase' },
  { path: 'security', blockedBy: '/settings/security — DangerZone → @clerk/clerk-react' },
  {
    path: 'security/audit-logs',
    blockedBy:
      '/settings/security/audit-logs — NOTHING but the mount itself. Nine modules, no cloud. The ' +
      'second route part 2 can mount, and the more interesting of the two: a device edition owes ' +
      'an audit trail exactly as much as a hosted one does'
  },
  { path: 'forecasting', blockedBy: 'a redirect into budget, which is itself owed' },
  { path: '*', blockedBy: 'the web router’s catch-all; this window has its own (see DesktopApp)' }
];
