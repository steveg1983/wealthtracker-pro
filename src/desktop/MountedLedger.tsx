/**
 * THE APPLICATION, IN A WINDOW. `src/App.tsx`'s opposite number.
 *
 * This is the second half of the mount, and the best way to read it is beside
 * `App.tsx`, because almost every line is the same line. The two differ in
 * exactly three ways and each of them is a decision recorded somewhere else:
 *
 *     App.tsx                          here
 *     ─────────────────────────────    ────────────────────────────────────────
 *     SentryErrorBoundary + Error…     ErrorBoundary alone; `@telemetry` is what
 *                                      makes the shared one safe to mount, and
 *                                      the Sentry one is a hosted-service thing
 *     ClerkProvider (in main.tsx)      nothing. `deviceIdentity.ts` is the answer
 *     AuthProvider                     nothing. Nobody signed in
 *     SubscriptionProvider             nothing. Nothing is sold from this router
 *     SupabaseDataLoader               `LedgerReady`, six lines below. The web's
 *                                      reads `useAuth()` from a context this
 *                                      edition does not have; the QUESTION it
 *                                      asks — "has the boot finished?" — is
 *                                      edition-blind and is asked here too
 *     BrowserRouter                    HashRouter. `DesktopApp` says why
 *     ProtectedSuspense per route      Suspense. The premium and signed-in gates
 *                                      are the two regions `NEVER_ON_A_DESKTOP`
 *                                      rules out; a gate with nothing to gate
 *                                      would be a redirect to a login screen
 *                                      that is not in the bundle
 *     SafariWarning, ConsentBanner     nothing. One WebView, no third parties
 *     <Routes> written out             DESKTOP_ROUTES, mapped
 *
 * Everything else — CombinedProvider, ThemeProvider, AppProvider, ToastProvider,
 * NotificationProvider, ActivityLoggerProvider, ScrollResetOnNavigate, Layout,
 * and every page — is the SAME MODULE, not a copy. That is the whole point of
 * the phase: two editions, one source tree, and a frame that cannot drift from
 * itself because there is only one of it.
 *
 * ── WHY THIS FILE IS ONLY EVER IMPORTED LAZILY ──────────────────────────────
 *
 * Because everything below reaches `@data`, and in this build `@data` is a
 * module whose scope demands an open ledger. `DesktopApp` holds that boundary
 * and its header carries the argument; the one thing to know here is that
 * moving this to a static import turns the chooser into a blank window.
 *
 * ── THE PAGES ARE LAZY FOR THE REASON THEY ARE LAZY IN THE WEB APP ──────────
 *
 * A renderer embedded in a binary downloads nothing, so a chunk is not a
 * network saving here. It is still a PARSE saving: WKWebView parses what it is
 * given, and a window that opens on a chooser has no reason to have parsed the
 * reports hub. Same declarations, same chunk names, same `lazyWithPreload` the
 * web app uses — which also means the two builds' page graphs stay comparable.
 */

import { Suspense, useEffect, type ReactElement, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary';
import { CombinedProvider } from '../contexts/CombinedProvider';
import { ThemeProvider } from '../design-system';
import { AppProvider, useApp } from '../contexts/AppContextSupabase';
import { ToastProvider } from '../contexts/ToastContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ActivityLoggerProvider } from '../components/ActivityLoggerProvider';
import Layout from '../components/Layout';
import PageLoader from '../components/PageLoader';
import ScrollResetOnNavigate from '../components/ScrollResetOnNavigate';
import LegacyTransactionsRedirect from '../components/LegacyTransactionsRedirect';
import { lazyWithPreload } from '../utils/lazyWithPreload';
import { currentDeviceIdentity } from '../services/local/deviceIdentity';
import { DESKTOP_ROUTES, type DesktopPath } from './routes';
import { LicenceStatusLine } from './LicenceScreen';
import { useShellInvoke } from './shellInvoke';
import { formatCount } from '../utils/localeFormat';

const Dashboard = lazyWithPreload(() => import(/* webpackChunkName: "dashboard" */ '../pages/Dashboard'));
const Accounts = lazyWithPreload(() => import(/* webpackChunkName: "accounts" */ '../pages/Accounts'));
const AccountTransactions = lazyWithPreload(() => import(/* webpackChunkName: "account-transactions" */ '../pages/AccountTransactions'));
const Find = lazyWithPreload(() => import(/* webpackChunkName: "find" */ '../pages/Find'));
const Reconciliation = lazyWithPreload(() => import(/* webpackChunkName: "reconciliation" */ '../pages/Reconciliation'));
const Categorisation = lazyWithPreload(() => import(/* webpackChunkName: "categorisation" */ '../pages/Categorisation'));
const TransferLinks = lazyWithPreload(() => import(/* webpackChunkName: "transfer-links" */ '../pages/TransferLinks'));
const Budget = lazyWithPreload(() => import(/* webpackChunkName: "budget" */ '../pages/Budget'));
const Calendar = lazyWithPreload(() => import(/* webpackChunkName: "calendar" */ '../pages/Calendar'));
const RecurringPayments = lazyWithPreload(() => import(/* webpackChunkName: "recurring-payments" */ '../pages/RecurringPayments'));
const Forecast = lazyWithPreload(() => import(/* webpackChunkName: "forecast" */ '../pages/Forecast'));
const ReportsHub = lazyWithPreload(() => import(/* webpackChunkName: "reports-hub" */ '../pages/ReportsHub'));
// Mounted rather than excluded as of the gating decision `routes.ts` records:
// the local edition is a one-time purchase and its buyer is on the only tier
// there is. The page was already reachable in this window through the hub's
// registry, so this gives it the address it was already answering at.
const CustomReports = lazyWithPreload(() => import(/* webpackChunkName: "custom-reports" */ '../pages/CustomReports'));
const FinancialSummaries = lazyWithPreload(() => import(/* webpackChunkName: "financial-summaries" */ '../pages/FinancialSummaries'));
// The three slice 31 took off `AWAITING_THE_MOUNT`. Each was blocked by a
// MEASURED import chain rather than by a decision, and each chain is gone: the
// Investments page asks `@data` instead of `services/api/investmentService`, and
// the restore dialog behind the other two asks `capabilities().cannotKeep`
// instead of describing the browser's store from outside it.
const Investments = lazyWithPreload(() => import(/* webpackChunkName: "investments" */ '../pages/Investments'));
const EnhancedImport = lazyWithPreload(() => import(/* webpackChunkName: "enhanced-import" */ '../pages/EnhancedImport'));
const DataManagement = lazyWithPreload(() => import(/* webpackChunkName: "data-management" */ '../pages/settings/DataManagement'));
const Duplicates = lazyWithPreload(() => import(/* webpackChunkName: "duplicates" */ '../pages/settings/Duplicates'));
const ExportManager = lazyWithPreload(() => import(/* webpackChunkName: "export-manager" */ '../pages/ExportManager'));
const Documents = lazyWithPreload(() => import(/* webpackChunkName: "documents" */ '../pages/Documents'));
const SettingsPage = lazyWithPreload(() => import(/* webpackChunkName: "settings" */ '../pages/Settings'));
const AppSettings = lazyWithPreload(() => import(/* webpackChunkName: "app-settings" */ '../pages/settings/AppSettings'));
const Categories = lazyWithPreload(() => import(/* webpackChunkName: "categories" */ '../pages/settings/Categories'));
const Tags = lazyWithPreload(() => import(/* webpackChunkName: "tags" */ '../pages/settings/Tags'));
const PayeeCleanup = lazyWithPreload(() => import(/* webpackChunkName: "payee-cleanup" */ '../pages/settings/PayeeCleanup'));
const SecuritySettings = lazyWithPreload(() => import(/* webpackChunkName: "security-settings" */ '../pages/settings/SecuritySettings'));
const AuditLogs = lazyWithPreload(() => import(/* webpackChunkName: "audit-logs" */ '../pages/settings/AuditLogs'));

/** A page, inside the boundary the frame's `<Outlet>` renders it in. */
const page = (element: ReactNode): ReactElement => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
);

/**
 * A redirect that keeps the query string.
 *
 * `App.tsx`'s `RedirectWithSearch`, and deliberately a second four-line copy
 * rather than an import: that one is declared inside `App.tsx`, which is the
 * WEB router — a module with a ClerkProvider in it — so importing it would put
 * a sign-in provider in this window to save four lines. The retired addresses
 * that use it are the same ones, and the rule they obey (`?demo=true` and
 * `?testMode` must survive a redirect) is a hosted-app rule that costs a device
 * nothing to keep.
 */
function RedirectWithSearch({ to }: { to: string }): ReactElement {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

/**
 * The window's own title bar, kept in step with where you are.
 *
 * This is what makes `DesktopRoute.title` load-bearing rather than
 * documentation. A browser tab has a strip and an address bar; a window has one
 * line of chrome, and if it always says "WealthTracker" then the application has
 * declined to tell you which of its thirty screens you are looking at.
 *
 * Matched on `at` against the hash path, longest first, so `settings/security/
 * audit-logs` wins over `settings/security` and `settings`. Parameterised
 * segments are compared segment-wise; a `:name` matches anything.
 */
const titleFor = (pathname: string): string => {
  const wanted = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const candidates = [...DESKTOP_ROUTES]
    .filter(route => route.at !== '*')
    .sort((a, b) => b.at.length - a.at.length);
  for (const route of candidates) {
    const parts = route.at.split('/').filter(Boolean);
    if (parts.length !== wanted.length) continue;
    if (parts.every((part, index) => part.startsWith(':') || part === wanted[index])) {
      return route.title;
    }
  }
  return 'WealthTracker';
};

function WindowTitle(): null {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = titleFor(pathname);
  }, [pathname]);
  return null;
}

/**
 * The ledger this window has open, as a screen.
 *
 * The index route, and what `LedgerScreen.tsx`'s second arm used to be. It reads
 * its counts out of the state layer now rather than out of a boot snapshot read
 * specially for it — which is why `bootDeviceLedger` stopped reading the file at
 * all, and is worth a whole 50,000-row read per launch.
 */
const count = (n: number, one: string, many: string): string =>
  `${formatCount(n)} ${n === 1 ? one : many}`;

function OpenLedgerScreen(): ReactElement {
  const { accounts, transactions, categories, capabilities } = useApp();
  const identity = currentDeviceIdentity();
  const shell = useShellInvoke();

  return (
    <main className="ledger-screen">
      <h1>{identity?.path ?? 'WealthTracker'}</h1>
      <p>
        {count(accounts.length, 'account', 'accounts')},{' '}
        {count(transactions.length, 'transaction', 'transactions')},{' '}
        {count(categories.length, 'category', 'categories')}. This ledger is open and this
        window holds it.
      </p>
      {/* The one sentence `capabilities` is here for, and it is COPY: `edition`
          may be rendered and never branched on (dataPort.ts states the rule and
          editionIsCopyOnly.test.ts greps for it). `backupTarget` is the capability
          the sentence is actually ABOUT, and branching on that is the point of
          having it — a person is owed a different sentence when the file in front
          of them is the only copy that exists. */}
      <p className="whose-copy">
        {capabilities.backupTarget === 'device'
          ? 'This file is the only copy. Back it up the way you back up anything else you cannot lose.'
          : 'A copy of these rows is held by your account as well as by this file.'}{' '}
        {capabilities.edition === 'device' ? 'Local edition.' : 'Cloud edition.'}
      </p>
      {/* THE WINDOW'S SETTINGS SURFACE, and the reason the licence line is here
          rather than on the shared Settings page: `pages/Settings` is the same
          module the cloud edition serves, and a licence is a thing only this
          edition has. This screen is already where the window says what it IS
          rather than what your money is — which copy of the file this is, which
          edition is running — so it is where "and whose licence" belongs. It
          renders nothing at all when there is no shell to ask. */}
      <LicenceStatusLine invoke={shell} />
    </main>
  );
}

/**
 * Hold the app behind a loader until the state layer's boot has finished.
 *
 * `components/SupabaseDataLoader` is the web's, and it cannot be used here: it
 * asks `useAuth()` from `contexts/AuthContext`, a Clerk session. The question it
 * really answers is `isLoading`, which is the same question in both editions,
 * and this is six lines rather than a seventh seam because there is nothing
 * edition-shaped left in it once the auth is gone.
 *
 * It matters more here than it looks. `AppContextSupabase`'s note says the boot
 * used to publish partly-filled states and that "a signed-in session: nobody"
 * could see them because this loader existed. A device session renders straight
 * through, so without this the register would paint empty and fill in.
 */
function LedgerReady({ children }: { children: ReactNode }): ReactElement {
  const { isLoading } = useApp();
  if (isLoading) return <PageLoader />;
  return <>{children}</>;
}

export default function MountedLedger(): ReactElement {
  /**
   * A screen for every mounted path, checked by the compiler.
   *
   * `Record<DesktopPath, …>` is what makes `routes.ts` load-bearing rather than
   * documentation: adding a path to the manifest without adding it here does not
   * build, and removing one leaves an error rather than dead code.
   */
  const screens: Record<DesktopPath, ReactElement> = {
    '/': <OpenLedgerScreen />,
    dashboard: page(<Dashboard />),
    accounts: page(<Accounts />),
    'accounts/:accountId': page(<AccountTransactions />),
    find: page(<Find />),
    transactions: <LegacyTransactionsRedirect />,
    'transactions-comparison': <LegacyTransactionsRedirect />,
    reconciliation: page(<Reconciliation />),
    categorisation: page(<Categorisation />),
    'transfer-links': page(<TransferLinks />),
    budget: page(<Budget />),
    calendar: page(<Calendar />),
    'recurring-payments': page(<RecurringPayments />),
    'reports/recurring-commitments': <RedirectWithSearch to="/recurring-payments" />,
    forecast: page(<Forecast />),
    reports: page(<ReportsHub />),
    'reports/:reportId': page(<ReportsHub />),
    'custom-reports': page(<CustomReports />),
    investments: page(<Investments />),
    analytics: <RedirectWithSearch to="/reports" />,
    summaries: page(<FinancialSummaries />),
    'ai-analytics': <RedirectWithSearch to="/reports" />,
    'ai-features': <RedirectWithSearch to="/reports" />,
    'tax-planning': <RedirectWithSearch to="/reports" />,
    household: <RedirectWithSearch to="/settings" />,
    'mobile-features': <RedirectWithSearch to="/dashboard" />,
    'business-features': <RedirectWithSearch to="/dashboard" />,
    'financial-planning': <RedirectWithSearch to="/reports" />,
    'data-intelligence': <RedirectWithSearch to="/reports" />,
    'enhanced-import': page(<EnhancedImport />),
    'export-manager': page(<ExportManager />),
    documents: page(<Documents />),
    performance: <RedirectWithSearch to="/dashboard" />,
    advanced: <RedirectWithSearch to="/dashboard" />,
    settings: page(<SettingsPage />),
    app: page(<AppSettings />),
    categories: page(<Categories />),
    tags: page(<Tags />),
    payees: page(<PayeeCleanup />),
    data: page(<DataManagement />),
    duplicates: page(<Duplicates />),
    security: page(<SecuritySettings />),
    'security/audit-logs': page(<AuditLogs />),
    forecasting: <RedirectWithSearch to="/budget" />,
    '*': <Navigate to="/" replace />
  };

  return (
    <ErrorBoundary>
      <CombinedProvider>
        <ThemeProvider>
          <AppProvider>
            <ToastProvider>
              <NotificationProvider>
                <ActivityLoggerProvider>
                  <LedgerReady>
                    <HashRouter>
                      {/* First children of the router, deliberately: the scroll
                          reset is what makes a new page open at its own heading
                          rather than at the offset the last one was left at, and
                          the title is what a window has instead of a tab. */}
                      <ScrollResetOnNavigate />
                      <WindowTitle />
                      <Routes>
                        <Route path="/" element={<Layout />}>
                          {DESKTOP_ROUTES.map(route =>
                            route.at === '' ? (
                              <Route key={route.path} index element={screens[route.path]} />
                            ) : (
                              <Route
                                key={route.path}
                                path={route.at}
                                element={screens[route.path]}
                              />
                            )
                          )}
                        </Route>
                      </Routes>
                    </HashRouter>
                  </LedgerReady>
                </ActivityLoggerProvider>
              </NotificationProvider>
            </ToastProvider>
          </AppProvider>
        </ThemeProvider>
      </CombinedProvider>
    </ErrorBoundary>
  );
}
