import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';

const AddTransactionModal = lazy(() => import('./AddTransactionModal'));
import { UserButton } from '@clerk/clerk-react';
import { HomeIcon, CreditCardIcon, WalletIcon, TrendingUpIcon, SettingsIcon, MenuIcon, XIcon, ArrowRightLeftIcon, BarChart3Icon, GoalIcon, ChevronRightIcon, DatabaseIcon, TagIcon, Settings2Icon, LineChartIcon, HashIcon, SearchIcon, PieChartIcon, ShieldIcon, UploadIcon, DownloadIcon, FolderIcon, BankIcon, CalendarIcon } from '../components/icons';
import { SidebarLink, TopNavItem, TopNavDropdown } from './layout/NavComponents';
import { usePreferences } from '../contexts/PreferencesContext';
import { PageTransition, NavigationProgress } from './layout/SimplePageTransition';
import { Breadcrumbs, MobileBreadcrumb } from './layout/Breadcrumbs';
import { EnhancedSkipLinks, FocusIndicator, RouteAnnouncer } from './layout/AccessibilityImprovements';
import OfflineIndicator from './OfflineIndicator';
import { OfflineStatus } from './OfflineStatus';
import { SyncConflictResolver } from './SyncConflictResolver';
import PWAInstallPrompt from './PWAInstallPrompt';
import ServiceWorkerUpdateNotification from './ServiceWorkerUpdateNotification';
import { useServiceWorker } from '../hooks/useServiceWorker';
import { OfflineIndicator as PWAOfflineIndicator } from './pwa/OfflineIndicator';
import { MobilePullToRefreshWrapper } from './MobilePullToRefreshWrapper';
import { QuickAddOfflineButton } from './pwa/QuickAddOfflineButton';
import { EnhancedConflictResolutionModal } from './pwa/EnhancedConflictResolutionModal';
import { useConflictResolution } from '../hooks/useConflictResolution';
import GlobalSearch, { type GlobalSearchHandle } from './GlobalSearch';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import { useKeyboardShortcutsHelp } from '../hooks/useKeyboardShortcutsHelp';
import EnhancedNotificationBell from './EnhancedNotificationBell';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import KeyboardSequenceIndicator from './KeyboardSequenceIndicator';
import { RealtimeStatusDot } from './RealtimeStatusIndicator';
import MobileBottomNav from './MobileBottomNav';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import DemoModeIndicator from './DemoModeIndicator';
import SyncStatusIndicator from './SyncStatusIndicator';
import { isDemoModeRuntimeAllowed } from '../utils/runtimeMode';

export default function Layout(): React.JSX.Element {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [forecastingExpanded, setForecastingExpanded] = useState(false);
  // advancedExpanded removed — Advanced section now uses TopNavDropdown on desktop and direct links on mobile
  const [investmentsExpanded, setInvestmentsExpanded] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
  const desktopSearchRef = useRef<GlobalSearchHandle | null>(null);
  const mobileSearchRef = useRef<GlobalSearchHandle | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const isDemoModeRoutingEnabled =
    isDemoModeRuntimeAllowed(import.meta.env) && searchParams.get('demo') === 'true';
  const { registration } = useServiceWorker();
  const {
    showGoals,
    showInvestments,
    showEnhancedInvestments,
  } = usePreferences();
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

  // Simple page navigation helper
  const getNextPrevPage = (direction: 'next' | 'prev', currentPath: string): string | null => {
    const pages = ['/dashboard', '/accounts', '/transactions', '/investments', '/reports'];
    const currentIndex = pages.indexOf(currentPath);
    
    if (currentIndex === -1) return null;
    
    if (direction === 'next') {
      return currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;
    } else {
      return currentIndex > 0 ? pages[currentIndex - 1] : null;
    }
  };

  // Swipe navigation for mobile
  const swipeRef = useSwipeGestures({
    onSwipeLeft: () => {
      if (window.innerWidth <= 768) { // Only on mobile
        const nextPage = getNextPrevPage('next', location.pathname);
        if (nextPage) navigate(nextPage);
      }
    },
    onSwipeRight: () => {
      if (window.innerWidth <= 768) { // Only on mobile
        const prevPage = getNextPrevPage('prev', location.pathname);
        if (prevPage) navigate(prevPage);
      }
    }
  });

  // Close dropdown on route change
  useEffect(() => {
    setOpenDropdown(null);
  }, [location.pathname]);

  useEffect(() => {
    setIsMobileSearchVisible(false);
  }, [location.pathname]);

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
    <div className="flex min-h-screen bg-[#f8f9fb] dark:bg-gray-900">
      <DemoModeIndicator />
      <EnhancedSkipLinks />
      <FocusIndicator />
      <RouteAnnouncer />
      
      {/* Skip links for keyboard navigation */}
      <div className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50">
        <a 
          href="#main-content" 
          className="inline-block px-4 py-2 bg-[#1a2332] text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <a 
          href="#main-navigation" 
          className="inline-block px-4 py-2 ml-2 bg-[#1a2332] text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          Skip to navigation
        </a>
      </div>
      {/* Desktop Top Navigation Bar */}
      <nav
        id="main-navigation"
        className="hidden md:block fixed top-0 left-0 right-0 z-40 bg-[#1a2332] shadow-md"
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
              items={[
                { to: '/accounts', icon: WalletIcon, label: 'All Accounts' },
                { to: '/transactions', icon: CreditCardIcon, label: 'Transactions' },
                { to: '/reconciliation', icon: ArrowRightLeftIcon, label: 'Reconciliation' },
                { to: '/open-banking', icon: BankIcon, label: 'Bank Feeds' },
              ]}
              activePaths={['/accounts', '/transactions', '/reconciliation', '/open-banking']}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
            />
            <TopNavItem to="/budget" icon={BarChart3Icon} label="Budget" />
            <TopNavItem to="/calendar" icon={CalendarIcon} label="Calendar" />

            <TopNavItem to="/reports" icon={PieChartIcon} label="Reports" />

            <TopNavDropdown
              label="Manage"
              icon={SettingsIcon}
              items={[
                { to: '/settings/categories', icon: TagIcon, label: 'Categories' },
                { to: '/settings/tags', icon: HashIcon, label: 'Tags' },
                { to: '/enhanced-import', icon: UploadIcon, label: 'Import Data' },
                { to: '/export-manager', icon: DownloadIcon, label: 'Export Data' },
                { to: '/investments', icon: TrendingUpIcon, label: 'Investments' },
                { to: '/goals', icon: GoalIcon, label: 'Goals' },
                { to: '/documents', icon: FolderIcon, label: 'Documents' },
              ]}
              activePaths={['/settings/categories', '/settings/tags', '/enhanced-import', '/export-manager', '/documents', '/investments', '/goals']}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
            />

            <TopNavDropdown
              label="Settings"
              icon={Settings2Icon}
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
            <EnhancedNotificationBell />
            <RealtimeStatusDot />
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
                  '/dashboard': 'Your financial overview — net worth, monthly performance, account balances, and recent activity.',
                  '/accounts': 'Manage bank accounts, credit cards, savings, and investments. Toggle between grouping by type or institution.',
                  '/transactions': 'View, filter, and edit all transactions. Right-click for quick actions. Click categories or amounts to edit inline.',
                  '/budget': 'Set and track budgets by category. Try envelope budgeting or zero-based budgeting.',
                  '/calendar': 'See your income and expenses laid out by day on a monthly calendar.',
                  '/reports': 'Income & expense analysis, net worth tracking, and custom report builder.',
                  '/goals': 'Track savings targets, debt payoff goals, and investment milestones.',
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
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                  userButtonPopoverCard: "shadow-xl",
                  userButtonPopoverActions: "mt-2"
                }
              }}
            />
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 shadow-md" role="banner">
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
            <EnhancedNotificationBell />
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
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                  userButtonPopoverCard: "shadow-xl",
                  userButtonPopoverActions: "mt-2"
                }
              }}
            />
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
            className="w-full max-w-sm h-full bg-[#1a2332] dark:bg-gray-800 shadow-2xl overflow-y-auto rounded-r-2xl"
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
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-white/50"
                    aria-label="Open global search"
                  >
                    <SearchIcon size={24} className="text-white dark:text-gray-300" />
                  </button>
                  <button
                    onClick={toggleMobileMenu}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-white/50"
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
                      <SidebarLink to="/transactions" icon={CreditCardIcon} label="Transactions" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/reconciliation" icon={ArrowRightLeftIcon} label="Reconciliation" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/open-banking" icon={BankIcon} label="Bank Feeds" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                    </div>
                  )}
                </div>

                {/* Investments with Sub-navigation */}
                {(showInvestments || showEnhancedInvestments) && (
                  <div>
                    <Link
                      to={isDemoModeRoutingEnabled ? '/investments?demo=true' : '/investments'}
                      onClick={() => {
                        setInvestmentsExpanded(!investmentsExpanded);
                        toggleMobileMenu();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50"
                    >
                      <TrendingUpIcon size={18} />
                      <span className="flex-1 text-sm text-left">Investments</span>
                      <ChevronRightIcon 
                        size={14} 
                        className={`text-gray-400 transition-transform duration-200 ${investmentsExpanded ? 'rotate-90' : ''}`} 
                      />
                    </Link>
                    {investmentsExpanded && (
                      <div className="mt-1 space-y-1">
                        {showEnhancedInvestments && <SidebarLink to="/enhanced-investments" icon={BarChart3Icon} label="Investment Analytics" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Forecasting with Sub-navigation */}
                {showGoals && (
                  <div>
                    <Link
                      to={isDemoModeRoutingEnabled ? '/forecasting?demo=true' : '/forecasting'}
                      onClick={() => {
                        setForecastingExpanded(!forecastingExpanded);
                        toggleMobileMenu();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50"
                    >
                      <LineChartIcon size={18} />
                      <span className="flex-1 text-sm text-left">Forecasting</span>
                      <ChevronRightIcon 
                        size={14} 
                        className={`text-gray-400 transition-transform duration-200 ${forecastingExpanded ? 'rotate-90' : ''}`} 
                      />
                    </Link>
                    {forecastingExpanded && (
                      <div className="mt-1 space-y-1">
                        <SidebarLink to="/goals" icon={GoalIcon} label="Goals" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      </div>
                    )}
                  </div>
                )}
                
                <SidebarLink to="/calendar" icon={CalendarIcon} label="Calendar" isCollapsed={false} onNavigate={toggleMobileMenu} />
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
                      <SidebarLink to="/settings/categories" icon={TagIcon} label="Categories" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/settings/tags" icon={HashIcon} label="Tags" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/settings/security" icon={ShieldIcon} label="Security" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/enhanced-import" icon={UploadIcon} label="Enhanced Import" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/export-manager" icon={DownloadIcon} label="Export Manager" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
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
        ref={swipeRef.ref}
        id="main-content"
        className="flex-1 mt-16 md:mt-12"
        style={{ WebkitOverflowScrolling: 'touch' }}
        role="main"
        aria-label="Main content"
        tabIndex={-1}
      >
        <NavigationProgress />
        
        {/* Desktop search bar moved into top nav */}
        
        <MobileBreadcrumb />
        <MobilePullToRefreshWrapper>
          <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto pb-20 md:pb-8">
            <div className="hidden sm:block">
              <Breadcrumbs />
            </div>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </MobilePullToRefreshWrapper>
      </main>
      
      {/* Offline Indicator */}
      <OfflineIndicator />
      <OfflineStatus />
      <SyncConflictResolver />
      
      {/* PWA Offline Indicator - Shows sync status */}
      <PWAOfflineIndicator />
      
      {/* Quick Add Offline Button */}
      <QuickAddOfflineButton />
      
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
          <AddTransactionModal
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
