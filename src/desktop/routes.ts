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
 *                                MEASURED coupling that is named. EMPTY as of
 *                                slice 31 — see its own note.
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
 * pages. Thirty-one routes were mounted then, they are the SAME pages the web
 * app serves — not copies — and a walk from this window's entry still reaches no
 * cloud at all.
 *
 * THIRTY-FOUR NOW. Slice 31 took the last three off {@link AWAITING_THE_MOUNT}
 * by answering the two measured couplings that held them, and both answers were
 * seam work rather than router work:
 *
 *   `investments` — holdings went through `dataPort` (five operations, both
 *   engines, differential coverage), so the page stopped calling
 *   `services/api/investmentService` and a Supabase client with it. Two chains
 *   had to go, not one: the second, `components/PortfolioManager`, was invisible
 *   behind the first and reached the same client at RUNTIME for a dropdown's
 *   list of asset kinds.
 *
 *   `enhanced-import` and `data` — `RestoreBackupModal` stopped describing the
 *   BROWSER's store from outside it. Its preview now asks
 *   `capabilities().cannotKeep`, its format types come from the lifted
 *   `backup/format`, and the boot-snapshot cache it was clearing by hand went
 *   back into the engine that owns it.
 *
 * ── AND ONE ROUTE ARRIVED FROM THE OTHER LIST ───────────────────────────────
 *
 * `custom-reports` is the first path ever to move OUT of
 * {@link NEVER_ON_A_DESKTOP}, so it is worth saying why, at the length a
 * reversal deserves.
 *
 * Its old entry was honest about being a decision rather than a measurement:
 * the page was clean and would mount, and what held it out was that the web
 * route is wrapped in a `ProtectedSuspense` asking `requirePremium`. The
 * address therefore exists, in the hosted product, TO BE REFUSED to people on
 * the wrong plan. The entry concluded that a device edition has no plans, so
 * mounting it would mean either shipping a premium feature to everyone by
 * accident or inventing a tier to withhold it behind, and it asked for "a
 * deliberate answer about what a device edition sells".
 *
 * The answer is that a device edition HAS a plan, and its buyer is on it. The
 * local edition is a ONE-TIME PURCHASE — no online storage, no bank feeds, no
 * future updates, and paid for. There is exactly one tier in this build, the
 * person running it bought that tier, and there is nobody in a window to refuse
 * anything to. So the premise "a device edition has no plans" was the part that
 * was wrong, not the conclusion drawn from it. A report builder is precisely the
 * kind of thing a paid, offline, own-your-file product should be generous with:
 * it computes from rows the person already has, over a file they already own,
 * and it costs the seller nothing per use.
 *
 * ── THE REFUSAL WAS ALSO, MEASURABLY, NOT HAPPENING ─────────────────────────
 *
 * Worth recording because it is the more useful half. Taking the path out of
 * this list did not keep the page out of the window. `pages/reports/
 * reportRegistry.ts` carries `component: lazyWithRecovery(() =>
 * import('../CustomReports'))`, the hub renders whichever registry entry the
 * `:reportId` names, and `reports/:reportId` is mounted — so the builder has
 * been reachable in this window all along, at `#/reports/custom-reports`, and
 * has been in the desktop bundle's graph the whole time. The exclusion
 * described a state that did not exist.
 *
 * That is the shape of gating failure this file was built to prevent, arriving
 * from the one direction it does not watch: the router's three lists police
 * ADDRESSES, and a page can be reached without one by any surface that imports
 * it directly. An entry in {@link NEVER_ON_A_DESKTOP} is a claim about the whole
 * bundle, not just about `<Routes>`, and the two walks
 * (`desktopEntry.cloudFree.test.ts`, `scripts/desktop-bundle-greps.mjs`) are
 * what make that claim true for the regions where it matters — they would have
 * caught a Clerk button arriving this way. They did not catch this one because
 * there was nothing cloud-shaped to catch: the page reaches no cloud root, which
 * is the same fact that makes mounting it safe now.
 *
 * So this entry is not "a decision reversed and a route added". It is a page
 * that was already here being given the address it was already reachable at,
 * and the storage its edition promises — a report now lives in the ledger FILE
 * (`custom_reports`, four verbs over `@data`) rather than in the WebView's
 * `localStorage`, which is what made mounting it honest rather than merely
 * possible.
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
  // Plan's third page. Detection reads the open ledger's own rows and the
  // verdicts live in `suggestion_dismissals`, which the file holds — so this
  // is as local as the register it reads.
  { path: 'recurring-payments', at: 'recurring-payments', title: 'Recurring payments' },
  // Its old gallery address, kept as a redirect in both editions so a pin or
  // bookmark made before the move under Plan still lands somewhere.
  { path: 'reports/recurring-commitments', at: 'reports/recurring-commitments', title: 'Recurring payments' },
  { path: 'reports', at: 'reports', title: 'Reports' },
  { path: 'reports/:reportId', at: 'reports/:reportId', title: 'Reports' },
  { path: 'custom-reports', at: 'custom-reports', title: 'Custom reports' },
  { path: 'investments', at: 'investments', title: 'Investments' },
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
  { path: 'enhanced-import', at: 'enhanced-import', title: 'Import' },
  { path: 'export-manager', at: 'export-manager', title: 'Export' },
  { path: 'documents', at: 'documents', title: 'Documents' },
  { path: 'performance', at: 'performance', title: 'Dashboard' },
  { path: 'advanced', at: 'advanced', title: 'Dashboard' },
  { path: 'settings', at: 'settings', title: 'Settings' },
  { path: 'app', at: 'settings/app', title: 'App settings' },
  { path: 'categories', at: 'settings/categories', title: 'Categories' },
  { path: 'tags', at: 'settings/tags', title: 'Tags' },
  { path: 'payees', at: 'settings/payees', title: 'Payees' },
  { path: 'data', at: 'settings/data', title: 'Data' },
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
 * ── AND IT IS NOW EMPTY ─────────────────────────────────────────────────────
 *
 * Slice 31 answered the last two problems, which were three routes.
 *
 * `investments` said: *"holdings are the one part of the ledger that never went
 * through the seam, so this page talks to Supabase DIRECTLY rather than through
 * `@data`… The fix is port verbs for holdings and prices, on both engines, with
 * differential coverage — a slice of its own, and the last unported region of
 * the data layer."* That is what happened: five operations
 * (`listInvestments`, `createInvestment`, `updateInvestment`,
 * `deleteInvestment`, `applyInvestmentPrices`), four crate verbs and a read
 * behind them, and the whole contract suite run on both engines.
 *
 * `enhanced-import` and `data` said the preview was the problem rather than the
 * restore, and that *"the fix is a port question ('what can you not hold?')
 * rather than a split, because the answer genuinely differs per engine."* That
 * is `DataPortCapabilities.cannotKeep`, and it was a latent BUG as this entry
 * predicted: a device would have been told a file's budgets could not be kept by
 * a file that keeps all fourteen tables.
 *
 * ── THE LIST IS KEPT, EMPTY, ON PURPOSE ─────────────────────────────────────
 *
 * `contract.ts`'s NOT_YET ratchet was DELETED when it reached zero, and the
 * argument for deleting it does not apply here. That one was an EXCEPTION to a
 * rule — a way for a suite to pass while an engine was unfinished — so an empty
 * one was a hole nobody was using. This is one of three ANSWERS a route can
 * have, and the router's own test requires every path in `src/App.tsx` to carry
 * one of them. `src/App.tsx` gains an address every few months; the next one
 * will arrive blocked by something, and its author needs somewhere to write the
 * chain down that is not a comment.
 */
export const AWAITING_THE_MOUNT: readonly OwedRoute[] = [];
