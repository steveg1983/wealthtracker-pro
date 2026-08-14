import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, Suspense } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';

// THE FRAME'S EDITION-VARYING FURNITURE, through a specifier that names no
// edition. Everything here used to be imported by path — a Clerk button, a bank
// feed's scheduler, a demo banner, and four surfaces that reach the web's state
// layer — and between them they were five of the six cloud roots a walk from
// this file used to find. `editions/chrome.ts` declares what each one is;
// `docs/edition-gating.md` explains why the choice is the build's rather than a
// runtime branch's.
import {
  BackgroundWork,
  DemoBanner,
  GlobalSearch,
  IdentityMenu,
  MobileBreadcrumb,
  NotificationBell,
  OfflineQuickAdd,
  OfflineQueueIndicator,
  QuickAddTransaction,
  RealtimeDot,
  type GlobalSearchHandle
} from '@chrome';
import { HomeIcon, CreditCardIcon, WalletIcon, TrendingUpIcon, SettingsIcon, MenuIcon, XIcon, ArrowRightLeftIcon, BarChart3Icon, ChevronRightIcon, DatabaseIcon, TagIcon, Settings2Icon, TargetIcon, HashIcon, SearchIcon, PieChartIcon, ShieldIcon, UploadIcon, DownloadIcon, FolderIcon, BankIcon, CalendarIcon, UsersIcon } from '../components/icons';
import { SidebarLink, TopNavItem, TopNavDropdown } from './layout/NavComponents';
import { usePreferences } from '../contexts/PreferencesContext';
import { PageTransition, NavigationProgress } from './layout/SimplePageTransition';
import { EnhancedSkipLinks, FocusIndicator, RouteAnnouncer } from './layout/AccessibilityImprovements';
import PullToRefreshIndicator from './PullToRefreshIndicator';
import OfflineIndicator from './OfflineIndicator';
import { OfflineStatus } from './OfflineStatus';
import { SyncConflictResolver } from './SyncConflictResolver';
import PWAInstallPrompt from './PWAInstallPrompt';
import ServiceWorkerUpdateNotification from './ServiceWorkerUpdateNotification';
import { useServiceWorker } from '../hooks/useServiceWorker';
import { EnhancedConflictResolutionModal } from './pwa/EnhancedConflictResolutionModal';
import { useConflictResolution } from '../hooks/useConflictResolution';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import { useKeyboardShortcutsHelp } from '../hooks/useKeyboardShortcutsHelp';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import KeyboardSequenceIndicator from './KeyboardSequenceIndicator';
import MobileBottomNav from './MobileBottomNav';
import ViewportDebugOverlay from './ViewportDebugOverlay';
import SyncStatusIndicator from './SyncStatusIndicator';
import { isDemoModeRuntimeAllowed } from '../utils/runtimeMode';
import { APP_BAR_HEIGHT_VAR, TOP_CHROME_OFFSET } from './layout/chromeOffsets';

/*
 * The top-of-window offsets live in `layout/chromeOffsets.ts` rather than here.
 * A page needs one of them to park its own chrome, and Layout renders the
 * router's Outlet — so importing back from this file closes a cycle that lint
 * and strict TypeScript both accept and the browser does not. See that file.
 */

export default function Layout(): React.JSX.Element {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  // advancedExpanded removed — Advanced section now uses TopNavDropdown on desktop and direct links on mobile
  // investmentsExpanded removed with /enhanced-investments — Investments has no
  // sub-pages left, so it is a plain link in the drawer.
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
  const desktopSearchRef = useRef<GlobalSearchHandle | null>(null);
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const mobileHeaderRef = useRef<HTMLElement | null>(null);
  const mobileSearchRef = useRef<GlobalSearchHandle | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const isDemoModeRoutingEnabled =
    isDemoModeRuntimeAllowed(import.meta.env) && searchParams.get('demo') === 'true';
  const { registration } = useServiceWorker();
  const { showInvestments } = usePreferences();
  const { isOpen: isHelpOpen, openHelp, closeHelp } = useKeyboardShortcutsHelp();
  const [showGlobalAddTransaction, setShowGlobalAddTransaction] = useState(false);

  const openMobileSearch = useCallback(() => {
    setIsMobileSearchVisible(true);
    requestAnimationFrame(() => {
      mobileSearchRef.current?.focusInput();
    });
  }, []);

  const focusSearch = useCallback(() => {
    if (window.innerWidth <= 768) {
      openMobileSearch();
    } else {
      desktopSearchRef.current?.focusInput();
    }
  }, [openMobileSearch]);

  // Publishes APP_BAR_HEIGHT_VAR — see the comment on it in
  // `layout/chromeOffsets`, and on BANNER_HEIGHT_VAR in DemoModeIndicator,
  // which this deliberately mirrors. In a LAYOUT effect, before paint, so a
  // page's parked chrome is in the right place on the first frame rather than
  // dropping into position after it.
  useLayoutEffect((): (() => void) => {
    const root = document.documentElement;
    const publishHeight = (): void => {
      // Whichever bar is hidden at this width measures 0, so the larger of the
      // two is the one on screen — which is how this survives a breakpoint
      // change without knowing where the breakpoint is.
      const height = Math.max(
        desktopNavRef.current?.offsetHeight ?? 0,
        mobileHeaderRef.current?.offsetHeight ?? 0
      );
      root.style.setProperty(APP_BAR_HEIGHT_VAR, `${height}px`);
    };

    publishHeight();

    // WATCHING THE TWO BARS IS NOT ENOUGH, and the failure is silent. A
    // ResizeObserver does not report an element that is not being rendered, so
    // the one moment the answer changes — crossing `md`, one bar going
    // `display: none` as the other appears — fires no callback at all.
    // Measured: after 1280→390 the variable still said 48px, the desktop bar's
    // height, and the accounts toolbar parked 28px UNDER a 76px mobile header.
    //
    // So the document element is observed as well — always rendered, always
    // changing with the viewport — and `resize` and `orientationchange` are
    // listened for on top. That is three subscriptions for one fact, and it is
    // deliberate belt-and-braces rather than indecision: every callback runs
    // the same two `offsetHeight` reads, so a duplicate costs nothing and a
    // missing one costs a toolbar parked behind the header.
    //
    // ⚠️ WHAT IS AND IS NOT PROVEN. Verified by measurement: the published
    // value is correct on load at 1280 (48px) and at 390 (76px), and the
    // handler produces the right answer when invoked. The CROSSING itself
    // could not be tested here — the automated browser changes the viewport
    // without dispatching anything, confirmed by counting hits on all three
    // subscriptions across a 1280→390 change: 0, 0 and 0, while `innerWidth`
    // reported the new value. A real browser fires all three. This is the same
    // family of blind spot as the harness being unable to see CSS transitions.
    const observer = new ResizeObserver(publishHeight);
    observer.observe(document.documentElement);
    if (desktopNavRef.current !== null) observer.observe(desktopNavRef.current);
    if (mobileHeaderRef.current !== null) observer.observe(mobileHeaderRef.current);
    window.addEventListener('resize', publishHeight);
    window.addEventListener('orientationchange', publishHeight);

    return (): void => {
      observer.disconnect();
      window.removeEventListener('resize', publishHeight);
      window.removeEventListener('orientationchange', publishHeight);
      root.style.removeProperty(APP_BAR_HEIGHT_VAR);
    };
  }, []);

  // Initialize conflict resolution
  const {
    currentConflict,
    currentAnalysis,
    isModalOpen: isConflictModalOpen,
    resolveConflict,
    dismissConflict,
    conflictState
  } = useConflictResolution();
  
  // Initialize global keyboard shortcuts
  const { activeSequence } = useGlobalKeyboardShortcuts(openHelp);

  /*
   * NO SWIPE-BETWEEN-PAGES. A horizontal swipe anywhere in `main` used to walk
   * /dashboard → /accounts → /investments → /reports, and it is gone rather
   * than narrowed.
   *
   * ─ WHY ─────────────────────────────────────────────────────────────────────
   * A page-level horizontal gesture cannot coexist with horizontally scrollable
   * CONTENT, and it loses the argument every time, because the content is what
   * the user is deliberately reaching for. Reported from a phone: the account
   * rows' settings / reconcile / close buttons sat off to the right, and
   * "if I scroll a little to the right to make them visible, the page thinks I
   * am trying to scroll 'forward' a page and takes me to the investment page."
   * The gesture did not merely conflict with the reach — it PUNISHED it, by
   * throwing the page away mid-reach.
   *
   * It is also a second, worse copy of a gesture the platform already owns:
   * iOS Safari's edge swipe is back/forward, so the same flick meant two
   * different things depending on how near the bezel it started.
   *
   * Nothing is lost. The bottom nav is on every phone screen and goes to these
   * pages directly, by name, in one tap — a discoverable control replacing an
   * invisible one whose main effect was accidental navigation. The owner asked
   * for exactly this: "we disable the ability to 'scroll through pages' by
   * scrolling left and right".
   *
   * `useSwipeGestures` itself stays — BottomSheet and SwipeableTransactionRow
   * use it for gestures scoped to one element, which is where a swipe belongs.
   */

  // Close dropdown on route change
  useEffect(() => {
    setOpenDropdown(null);
  }, [location.pathname]);

  useEffect(() => {
    setIsMobileSearchVisible(false);
  }, [location.pathname]);

  /**
   * `?action=add-transaction`, on ANY page: open the app-wide add-transaction
   * modal.
   *
   * The modal is Layout's, so Layout is what honours the parameter — and it
   * consumes it with a replace, so back or refresh cannot re-open it. It used
   * to insist on `/transactions`, which tied the phone's + and the keyboard's
   * "new transaction" to a page that no longer exists; the parameter is now
   * read wherever it lands, and both of those point at /accounts.
   *
   * ─ WHY NOT `?action=add` ───────────────────────────────────────────────────
   * Because that name is taken, on the very page this now lands on: the
   * Accounts page reads `?action=add` as "add an ACCOUNT" (see Accounts.tsx),
   * and a Layout that also claimed it would open two modals at once for the
   * phone's "Add Account". Two different things cannot share one parameter the
   * moment the parameter stops belonging to one page. Old links that say
   * `add` on `/transactions` are translated on their way through the redirect
   * (see components/legacyTransactionsDestination), where the page they came
   * from still says which of the two they meant.
   */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add-transaction') {
      setShowGlobalAddTransaction(true);
      params.delete('action');
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to open global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        focusSearch();
      }
      
      // ? to open keyboard shortcuts help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openHelp();
      }
      
      // Alt + N to open Add Transaction (global shortcut)
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        setShowGlobalAddTransaction(true);
      }

      // Alt + M to toggle mobile menu
      if (e.altKey && e.key === 'm') {
        e.preventDefault();
        toggleMobileMenu();
      }
      
      // Alt + S — reserved (sidebar removed)
      
      // Escape to close mobile menu
      if (e.key === 'Escape' && isMobileMenuOpen) {
        e.preventDefault();
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, focusSearch, openHelp, toggleMobileMenu]);

  // Removed auto-expand logic - users control collapsible sections manually

  // Handle conflict resolution modal - disabled (state setters not implemented)
  // useEffect(() => {
  //   const handleOpenConflictResolver = (event: Event) => {
  //     const conflict = (event as CustomEvent).detail;
  //     setCurrentConflict(conflict);
  //     setConflictModalOpen(true);
  //   };
  //
  //   window.addEventListener('open-conflict-resolver', handleOpenConflictResolver);
  //   return () => window.removeEventListener('open-conflict-resolver', handleOpenConflictResolver);
  // }, []);

  return (
    // A block, not a flex row. The row layout served a sidebar that no longer
    // exists, and it made <main> share its width with EVERY in-flow sibling.
    // The "invisible 56px sibling" that squeezed main on real iPhones was
    // later identified: a touch-device CSS rule (index.css) was overriding
    // position:fixed on every BUTTON, dropping the w-14 floating + into
    // normal flow beside main. That rule is fixed too — block layout stays
    // because main's width should never be negotiable in the first place.
    <div className="min-h-screen bg-[#f8f9fb] dark:bg-gray-900">
      {/* Whatever this edition starts once and never speaks to again, drawing
          nothing. In a browser it is the scheduled bank-feed refresh (on
          sign-in / daily at a set time — the schedule lives in Settings, and
          signed-out sessions do nothing); on a device there is no feed. */}
      <BackgroundWork />
      {/* Only draws during a pull, and only in an installed app — a browser tab
          has Safari's own. It is here rather than per-page because the gesture
          is about the DOCUMENT, which every page shares. */}
      <PullToRefreshIndicator />
      <DemoBanner />
      <EnhancedSkipLinks />
      <FocusIndicator />
      <RouteAnnouncer />
      
      {/* Skip links for keyboard navigation */}
      <div className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50">
        <a 
          href="#main-content" 
          className="inline-block px-4 py-2 bg-[#1a2332] text-white rounded-md"
        >
          Skip to main content
        </a>
        <a 
          href="#main-navigation" 
          className="inline-block px-4 py-2 ml-2 bg-[#1a2332] text-white rounded-md"
        >
          Skip to navigation
        </a>
      </div>
      {/* Desktop Top Navigation Bar */}
      <nav
        ref={desktopNavRef}
        id="main-navigation"
        className="hidden md:block fixed top-0 left-0 right-0 z-40 bg-[#1a2332] shadow-md"
        // Sits BELOW the demo banner rather than under it. The banner publishes
        // its measured height into this variable while demo mode is on, and
        // removes it otherwise — so outside demo mode this resolves to 0px and
        // is exactly the `top-0` it overrides. The status-bar inset rides with
        // it: on a desktop it is 0px, and this bar is `md:` up anyway, but the
        // two offsets belong together wherever chrome is pinned to the top.
        style={{ top: TOP_CHROME_OFFSET }}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="px-4 flex items-center h-12">
          {/* Brand */}
          <Link
            to={isDemoModeRoutingEnabled ? '/dashboard?demo=true' : '/dashboard'}
            className="text-white font-semibold text-base mr-8 shrink-0 hover:text-white/90 transition-colors flex items-center h-full tracking-tight"
          >
            WealthTracker
          </Link>

          {/* Primary Nav — 5 core pages */}
          <div className="flex items-center gap-0.5 flex-1 min-w-0">
            <TopNavItem to="/dashboard" icon={HomeIcon} label="Dashboard" />
            <TopNavDropdown
              label="Accounts"
              icon={WalletIcon}
              homeTo="/accounts"
              // Investments sits here, under Transactions, and no longer under
              // Manage. A holding IS an account — it has a balance, it moves,
              // it counts towards net worth — so it belongs with the things you
              // OWN, next to the transactions that feed it. Manage is data
              // admin: categories, payees, tags, imports. Same page, same icon;
              // only the menu it hangs off changed.
              // Find, where Transactions used to be. The global transactions
              // page is retired: transactions are worked on in the register of
              // the account they belong to, and the one thing that page did
              // that a register cannot — "which account was that in?" — is
              // what Find answers, by taking you to the row in its register.
              items={[
                { to: '/accounts', icon: WalletIcon, label: 'All Accounts' },
                { to: '/find', icon: SearchIcon, label: 'Find Transactions' },
                { to: '/investments', icon: TrendingUpIcon, label: 'Investments' },
                { to: '/reconciliation', icon: ArrowRightLeftIcon, label: 'Reconciliation' },
                { to: '/categorisation', icon: TagIcon, label: 'Categorisation' },
                { to: '/open-banking', icon: BankIcon, label: 'Bank Feeds' },
              ]}
              // The highlight follows the menu: on /investments it is Accounts
              // that lights up now, not Manage.
              activePaths={['/accounts', '/find', '/investments', '/reconciliation', '/categorisation', '/open-banking']}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
            />
            {/* Plan groups the forward-looking pages the way Money did. Budget
                and Goals were never data admin, which is what Manage is — each
                menu means one thing: what I have, what I plan, what happened,
                my data, the app. */}
            <TopNavDropdown
              label="Plan"
              icon={TargetIcon}
              homeTo="/budget"
              items={[
                { to: '/budget', icon: BarChart3Icon, label: 'Budget' },
                { to: '/calendar', icon: CalendarIcon, label: 'Calendar' },
              ]}
              activePaths={['/budget', '/calendar']}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
            />

            <TopNavItem to="/reports" icon={PieChartIcon} label="Reports" />

            <TopNavDropdown
              label="Manage"
              icon={SettingsIcon}
              homeTo="/settings/categories"
              // Categories, Payees, Tags — in the order they matter to someone
              // tidying up a statement. Every transaction has a category and a
              // payee; tags are the optional third thing, and were sitting in
              // front of the one people open most.
              items={[
                { to: '/settings/categories', icon: TagIcon, label: 'Categories' },
                { to: '/settings/payees', icon: UsersIcon, label: 'Payees' },
                { to: '/settings/tags', icon: HashIcon, label: 'Tags' },
                { to: '/enhanced-import', icon: UploadIcon, label: 'Import Data' },
                { to: '/export-manager', icon: DownloadIcon, label: 'Export Data' },
                { to: '/documents', icon: FolderIcon, label: 'Documents' },
              ]}
              activePaths={['/settings/categories', '/settings/tags', '/settings/payees', '/enhanced-import', '/export-manager', '/documents']}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
            />

            <TopNavDropdown
              label="Settings"
              icon={Settings2Icon}
              homeTo="/settings"
              items={[
                { to: '/settings', icon: SettingsIcon, label: 'General' },
                { to: '/settings/app', icon: Settings2Icon, label: 'App Settings' },
                { to: '/settings/data', icon: DatabaseIcon, label: 'Data Management' },
                { to: '/settings/security', icon: ShieldIcon, label: 'Security' },
                { to: '/subscription', icon: CreditCardIcon, label: 'Subscription' },
              ]}
              activePaths={['/settings', '/subscription']}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
            />
          </div>

          {/* Right side: Search + Notifications + User */}
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <div className="w-72 [&_input]:!py-0.5 [&_input]:!text-sm [&_input]:!h-7 [&_input]:!min-h-0 [&>div>div]:!border-0 [&>div>div]:!shadow-none [&>div>div]:!bg-transparent [&>div>div]:!rounded-none">
              <div className="bg-white/10 rounded-lg border border-white/20 focus-within:bg-white/20 transition-colors overflow-hidden">
                <GlobalSearch
                  ref={desktopSearchRef}
                  placeholder="Search..."
                />
              </div>
            </div>
            <NotificationBell />
            <RealtimeDot />
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'help' ? null : 'help')}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                title="Help"
                aria-label="Help menu"
                aria-expanded={openDropdown === 'help'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>
              {openDropdown === 'help' && (() => {
                const pageHelp: Record<string, string> = {
                  '/dashboard': 'Your financial overview — net worth, income and expenses for the period you choose, your pinned reports, key account balances and budget progress.',
                  '/accounts': 'Manage bank accounts, credit cards, savings, and investments. Toggle between grouping by type or institution.',
                  '/find': 'Search every account at once by description or amount. Click a result to open that transaction in its own account’s register, where you can change it.',
                  '/budget': 'Set and track budgets by category. Try envelope budgeting or zero-based budgeting.',
                  '/calendar': 'See your income and expenses laid out by day on a monthly calendar.',
                  '/reports': 'A gallery of reports — net worth, account balances, spending by category or payee, period comparisons, and your own custom reports. The period you choose follows you between them.',
                  '/investments': 'Portfolio overview with holdings, performance, and allocation analysis.',
                  '/settings': 'App preferences, data management, security, and account configuration.',
                };
                const currentHelp = Object.entries(pageHelp).find(([path]) => location.pathname.startsWith(path));

                return (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 w-72 z-50">
                    {currentHelp && (
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">About this page</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{currentHelp[1]}</p>
                      </div>
                    )}
                    <button
                      onClick={() => { openHelp(); setOpenDropdown(null); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                    >
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">?</span>
                      Keyboard Shortcuts
                    </button>
                    <button
                      onClick={() => { setShowGlobalAddTransaction(true); setOpenDropdown(null); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                    >
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">Alt+N</span>
                      Quick Add Transaction
                    </button>
                  </div>
                );
              })()}
            </div>
            <IdentityMenu />
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <header
        ref={mobileHeaderRef}
        className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 shadow-md"
        // The status bar's room as well as the banner's — see TOP_CHROME_OFFSET.
        // This header carries the identity menu, so getting it wrong took the
        // only way to sign out on a phone behind the battery indicator.
        style={{ top: TOP_CHROME_OFFSET }}
        role="banner"
      >
        <div className="flex items-center justify-between p-4">
          <button
            onClick={toggleMobileMenu}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            title={isMobileMenuOpen ? 'Close menu (Escape)' : 'Open menu (Alt+M)'}
          >
            {isMobileMenuOpen ? <XIcon size={24} className="text-gray-700 dark:text-gray-200" /> : <MenuIcon size={24} className="text-gray-700 dark:text-gray-200" />}
          </button>
          
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight" id="mobile-app-title">WealthTracker</h1>
          
          <div className="flex items-center gap-2">
            <SyncStatusIndicator variant="compact" className="mr-1" />
            <NotificationBell />
            <button
              onClick={() => {
                if (isMobileSearchVisible) {
                  setIsMobileSearchVisible(false);
                } else {
                  openMobileSearch();
                }
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Search"
            >
              <SearchIcon size={20} className="text-gray-700 dark:text-gray-200" />
            </button>
            <IdentityMenu />
          </div>
        </div>
      </header>

      {isMobileSearchVisible && (
        <div
          data-testid="mobile-search-container"
          className="md:hidden px-4 pb-3 bg-white dark:bg-gray-800 shadow-sm"
        >
          <GlobalSearch
            ref={mobileSearchRef}
            placeholder="Search transactions, accounts, budgets..."
            autoFocus
            onResultSelect={() => setIsMobileSearchVisible(false)}
          />
        </div>
      )}
      
      {/* Desktop icons now in search bar - section removed to prevent duplication */}

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" 
          onClick={toggleMobileMenu}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-menu-title"
        >
          <nav 
            id="mobile-menu"
            className="focus-ring-on-dark w-full max-w-sm h-full bg-[#1a2332] dark:bg-gray-800 shadow-2xl overflow-y-auto rounded-r-2xl"
            onClick={e => e.stopPropagation()}
            role="navigation"
            aria-label="Mobile navigation menu"
          >
            <div className="p-4 pb-6">
              {/* Mobile header with close button */}
              <header className="flex justify-between items-center mb-8" role="banner">
                <h2 id="mobile-menu-title" className="text-2xl font-semibold text-white dark:text-white tracking-tight">WealthTracker</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      openMobileSearch();
                      toggleMobileMenu();
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                    aria-label="Open global search"
                  >
                    <SearchIcon size={24} className="text-white dark:text-gray-300" />
                  </button>
                  <button
                    onClick={toggleMobileMenu}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                    aria-label="Close navigation menu"
                  >
                    <XIcon size={24} className="text-white dark:text-gray-300" />
                  </button>
                </div>
              </header>
              <div className="space-y-2" role="none">
                <SidebarLink to="/" icon={HomeIcon} label="Home" isCollapsed={false} onNavigate={toggleMobileMenu} />
                <SidebarLink to="/dashboard" icon={BarChart3Icon} label="Dashboard" isCollapsed={false} onNavigate={toggleMobileMenu} />
                
                {/* Accounts with Sub-navigation (but no "All Accounts" redundancy) */}
                <div>
                  <Link
                    to={isDemoModeRoutingEnabled ? '/accounts?demo=true' : '/accounts'}
                    onClick={() => {
                      setAccountsExpanded(!accountsExpanded);
                      toggleMobileMenu();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50"
                  >
                    <WalletIcon size={18} />
                    <span className="flex-1 text-sm text-left">Accounts</span>
                    <ChevronRightIcon 
                      size={14} 
                      className={`text-gray-400 transition-transform duration-200 ${accountsExpanded ? 'rotate-90' : ''}`} 
                    />
                  </Link>
                  {accountsExpanded && (
                    <div className="mt-1 space-y-1">
                      <SidebarLink to="/find" icon={SearchIcon} label="Find Transactions" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/reconciliation" icon={ArrowRightLeftIcon} label="Reconciliation" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/categorisation" icon={TagIcon} label="Categorisation" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/open-banking" icon={BankIcon} label="Bank Feeds" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                    </div>
                  )}
                </div>

                {/* Investments. A plain link, not a disclosure: the one child
                    it ever had was /enhanced-investments, and a chevron that
                    expands to nothing is a promise the menu cannot keep. */}
                {showInvestments && (
                  <SidebarLink
                    to="/investments"
                    icon={TrendingUpIcon}
                    label="Investments"
                    isCollapsed={false}
                    onNavigate={toggleMobileMenu}
                  />
                )}
                
                {/* Plan (Budget, Goals, Forecasting, Calendar) is desk work
                    and deliberately absent here — the drawer is the phone's
                    menu, and the desktop top-nav keeps the full Plan menu. */}
                <SidebarLink to="/reports" icon={PieChartIcon} label="Reports" isCollapsed={false} onNavigate={toggleMobileMenu} />
                {/* Settings with Sub-navigation */}
                <div>
                  <Link
                    to={isDemoModeRoutingEnabled ? '/settings?demo=true' : '/settings'}
                    onClick={() => setSettingsExpanded(!settingsExpanded)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50"
                  >
                    <SettingsIcon size={18} />
                    <span className="flex-1 text-sm text-left">Settings</span>
                    <ChevronRightIcon
                      size={14}
                      className={`text-gray-400 transition-transform duration-200 ${settingsExpanded ? 'rotate-90' : ''}`}
                    />
                  </Link>
                  {settingsExpanded && (
                    <div className="mt-1 space-y-1">
                      <SidebarLink to="/settings/app" icon={Settings2Icon} label="App Settings" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/settings/data" icon={DatabaseIcon} label="Data Management" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      {/* Same order as the desktop Manage menu — the drawer and
                          the top nav must not teach two different shapes. */}
                      <SidebarLink to="/settings/categories" icon={TagIcon} label="Categories" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/settings/payees" icon={UsersIcon} label="Payees" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/settings/tags" icon={HashIcon} label="Tags" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/settings/security" icon={ShieldIcon} label="Security" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/enhanced-import" icon={UploadIcon} label="Enhanced Import" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      {/* Same destination as the top-level link above, so it
                          carries the same name — one page cannot be two things
                          depending on which menu you found it in. */}
                      <SidebarLink to="/export-manager" icon={DownloadIcon} label="Export Data" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/documents" icon={FolderIcon} label="Documents" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/open-banking" icon={BankIcon} label="Open Banking" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main
        id="main-content"
        // A plain block child now — flex-1/min-w-0 died with the parent's
        // flex row. (Their history: min-w-0 once stopped a non-wrapping row
        // from inflating the layout viewport to 1438px; as a block, main is
        // simply the container's width and cannot be squeezed by siblings.)
        className="mt-16 md:mt-12"
        // The headers moved down by the status bar and the banner, so the
        // content below them has to as well — otherwise the first card slides
        // under a header that is now lower than the margin above assumes.
        // Padding rather than margin because the margin is responsive
        // (mt-16/md:mt-12) and this offset has to add to whichever of the two
        // applies, not replace it.
        style={{ paddingTop: TOP_CHROME_OFFSET }}
        role="main"
        aria-label="Main content"
        tabIndex={-1}
      >
        <NavigationProgress />
        
        {/* Desktop search bar moved into top nav */}
        
        <MobileBreadcrumb />
        {/* `page-bottom-gutter` rather than `pb-20`: the old value cleared the
            bottom nav and left the floating quick-add button sitting on top of
            whatever the page ended with. See index.css — the reservation is one
            number, beside the measurements it is made of. */}
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto page-bottom-gutter md:pb-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </main>
      
      <ViewportDebugOverlay />

      {/* Offline Indicator */}
      <OfflineIndicator />
      <OfflineStatus />
      <SyncConflictResolver />
      
      {/* PWA Offline Indicator - Shows sync status */}
      <OfflineQueueIndicator />
      
      {/* Quick Add Offline Button */}
      <OfflineQuickAdd />
      
      {/* Conflict Resolution Modal */}
      <EnhancedConflictResolutionModal 
        isOpen={isConflictModalOpen}
        onClose={dismissConflict}
        conflict={currentConflict}
        analysis={currentAnalysis || undefined}
        onResolve={resolveConflict}
      />
      
      {/* Service Worker Update Notification */}
      <ServiceWorkerUpdateNotification registration={registration} />
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
      
      
      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={closeHelp} />

      {/* Global Add Transaction Modal (Alt+N from any page) */}
      {showGlobalAddTransaction && (
        <Suspense fallback={null}>
          <QuickAddTransaction
            isOpen={showGlobalAddTransaction}
            onClose={() => setShowGlobalAddTransaction(false)}
          />
        </Suspense>
      )}
      
      {/* Enhanced Conflict Resolution Modal */}
      {currentConflict && (
        <EnhancedConflictResolutionModal
          isOpen={isConflictModalOpen}
          onClose={dismissConflict}
          conflict={currentConflict}
          analysis={currentAnalysis || undefined}
          onResolve={resolveConflict}
        />
      )}
      
      {/* Conflict Status Indicator - Show when there are unresolved conflicts */}
      {conflictState.requiresUserIntervention && (
        <div className="fixed bottom-20 right-4 z-50 bg-amber-100 dark:bg-amber-900/90 p-3 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {conflictState.conflicts.length} conflict{conflictState.conflicts.length !== 1 ? 's' : ''} need attention
            </span>
          </div>
        </div>
      )}
      
      {/* Auto-resolved notification */}
      {conflictState.autoResolvedCount > 0 && (
        <div className="fixed top-20 right-4 z-50 bg-blue-100 dark:bg-blue-900/90 p-3 rounded-lg shadow-lg animate-fade-in-out">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-blue-800 dark:text-blue-200">
              {conflictState.autoResolvedCount} conflict{conflictState.autoResolvedCount !== 1 ? 's' : ''} auto-resolved
            </span>
          </div>
        </div>
      )}
      
      {/* Keyboard Sequence Indicator */}
      <KeyboardSequenceIndicator activeSequence={activeSequence} />
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Floating Action Button removed from dashboard - using action buttons instead */}
    </div>
  );
}
