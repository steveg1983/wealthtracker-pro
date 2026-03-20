import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { HomeIcon, CreditCardIcon, WalletIcon, TrendingUpIcon, SettingsIcon, MenuIcon, XIcon, ArrowRightLeftIcon, BarChart3Icon, GoalIcon, ChevronRightIcon, ChevronDownIcon, DatabaseIcon, TagIcon, Settings2Icon, LineChartIcon, HashIcon, SearchIcon, MagicWandIcon, PieChartIcon, CalculatorIcon, ShieldIcon, UsersIcon, BriefcaseIcon, UploadIcon, DownloadIcon, FolderIcon, BankIcon, LightbulbIcon, FileTextIcon, ArchiveIcon } from '../components/icons';
import { usePreferences } from '../contexts/PreferencesContext';
import { useLayout } from '../contexts/LayoutContext';
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
import { NavigationBadge } from './ActivityBadge';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import KeyboardSequenceIndicator from './KeyboardSequenceIndicator';
import { RealtimeStatusDot } from './RealtimeStatusIndicator';
import MobileBottomNav from './MobileBottomNav';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import DemoModeIndicator from './DemoModeIndicator';
import SyncStatusIndicator from './SyncStatusIndicator';
import { isDemoModeRuntimeAllowed } from '../utils/runtimeMode';

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  hasSubItems?: boolean;
  isSubItem?: boolean;
  onNavigate?: () => void;
}

function SidebarLink({ to, icon: Icon, label, isCollapsed, hasSubItems, isSubItem, onNavigate }: SidebarLinkProps): React.JSX.Element {
  const location = useLocation();
  const { isWideView } = useLayout();
  const isActive = !isWideView && (location.pathname === to ||
    (hasSubItems && location.pathname.startsWith(to)) ||
    (to === '/accounts' && (location.pathname.startsWith('/transactions') || location.pathname.startsWith('/reconciliation'))) ||
    (to === '/forecasting' && (location.pathname.startsWith('/budget') || location.pathname.startsWith('/goals'))));

  // Preserve demo mode parameter in navigation
  const searchParams = new URLSearchParams(location.search);
  const isDemoMode = isDemoModeRuntimeAllowed(import.meta.env) && searchParams.get('demo') === 'true';
  const linkTo = isDemoMode ? `${to}?demo=true` : to;

  const handleLinkClick = () => {
    // For mobile menu, close it
    if (onNavigate) {
      onNavigate();
    }
  };

  const content = (
    <>
      <Icon size={isCollapsed ? 24 : 18} />
      {!isCollapsed && (
        <>
          <span className="flex-1 text-sm">{label}</span>
          {hasSubItems && (
            <ChevronRightIcon size={14} className="text-gray-400" />
          )}
        </>
      )}
    </>
  );

  const className = `flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] ${
    isSubItem ? 'ml-5 text-xs' : ''
  } ${
    isCollapsed ? 'sidebar-link-collapsed' : ''
  } ${
    isActive
      ? isCollapsed
        ? 'text-black dark:text-white'
        : 'bg-sidebar-active dark:bg-gray-900 text-black dark:text-white shadow-lg border-2 border-sidebar dark:border-gray-600'
      : 'bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50'
  }`;

  return (
    <Link
      to={linkTo}
      className={className}
      title={isCollapsed ? label : undefined}
      onClick={handleLinkClick}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
      {!isCollapsed && hasSubItems && <NavigationBadge type={label === 'Accounts' ? 'account' : label === 'Budget' ? 'budget' : undefined} />}
    </Link>
  );
}

// --- Top Navigation Bar Components (Desktop) ---

interface DropdownItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

function TopNavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }): React.JSX.Element {
  const location = useLocation();
  const isActive = location.pathname === to;
  const searchParams = new URLSearchParams(location.search);
  const isDemoMode = isDemoModeRuntimeAllowed(import.meta.env) && searchParams.get('demo') === 'true';
  const linkTo = isDemoMode ? `${to}?demo=true` : to;

  return (
    <Link
      to={linkTo}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
        isActive
          ? 'bg-white/20 text-white font-medium'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={16} />
      <span>{label}</span>
    </Link>
  );
}

function TopNavDropdown({
  label,
  icon: Icon,
  items,
  activePaths,
  openDropdown,
  setOpenDropdown
}: {
  label: string;
  icon: React.ElementType;
  items: DropdownItem[];
  activePaths?: string[];
  openDropdown: string | null;
  setOpenDropdown: (name: string | null) => void;
}): React.JSX.Element {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const searchParams = new URLSearchParams(location.search);
  const isDemoMode = isDemoModeRuntimeAllowed(import.meta.env) && searchParams.get('demo') === 'true';
  const isOpen = openDropdown === label;

  const isActive = activePaths
    ? activePaths.some(p => location.pathname === p || location.pathname.startsWith(p))
    : false;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setOpenDropdown]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpenDropdown(isOpen ? null : label)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
          isActive || isOpen
            ? 'bg-white/20 text-white font-medium'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="true"
      >
        <Icon size={16} />
        <span>{label}</span>
        <ChevronDownIcon size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px] z-50">
          {items.map(item => {
            const itemTo = isDemoMode ? `${item.to}?demo=true` : item.to;
            const itemActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={itemTo}
                className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                  itemActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setOpenDropdown(null)}
                aria-current={itemActive ? 'page' : undefined}
              >
                <item.icon size={16} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
    showAnalytics,
    showInvestments,
    showEnhancedInvestments,
    showAIAnalytics,
    showTaxPlanning,
    showHousehold,
    showBusinessFeatures,
    showFinancialPlanning,
    showDataIntelligence,
    showSummaries
  } = usePreferences();
  const { isOpen: isHelpOpen, openHelp, closeHelp } = useKeyboardShortcutsHelp();

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
    const pages = ['/dashboard', '/accounts', '/transactions', '/investments', '/analytics'];
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
    <div className="flex min-h-screen bg-[#f0f7ff] dark:bg-gray-900">
      <DemoModeIndicator />
      <EnhancedSkipLinks />
      <FocusIndicator />
      <RouteAnnouncer />
      
      {/* Skip links for keyboard navigation */}
      <div className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50">
        <a 
          href="#main-content" 
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <a 
          href="#main-navigation" 
          className="inline-block px-4 py-2 ml-2 bg-blue-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Skip to navigation
        </a>
      </div>
      {/* Desktop Top Navigation Bar */}
      <nav
        id="main-navigation"
        className="hidden md:block fixed top-0 left-0 right-0 z-40 bg-sidebar dark:bg-gray-800 shadow-md"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="px-4 flex items-center h-12">
          {/* Brand */}
          <Link
            to={isDemoModeRoutingEnabled ? '/dashboard?demo=true' : '/dashboard'}
            className="text-white font-bold text-base mr-6 shrink-0 hover:text-white/90 transition-colors flex items-center h-full"
          >
            Wealth Tracker
          </Link>

          {/* Nav Items */}
          <div className="flex items-center gap-0.5 flex-1 min-w-0">
            <TopNavItem to="/dashboard" icon={BarChart3Icon} label="Dashboard" />

            <TopNavDropdown
              label="Accounts"
              icon={WalletIcon}
              items={[
                { to: '/accounts', icon: WalletIcon, label: 'All Accounts' },
                { to: '/transactions', icon: CreditCardIcon, label: 'Transactions' },
                { to: '/reconciliation', icon: ArrowRightLeftIcon, label: 'Reconciliation' },
                { to: '/settings/deleted-accounts', icon: ArchiveIcon, label: 'Archived' },
              ]}
              activePaths={['/accounts', '/transactions', '/reconciliation']}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
            />

            {(showInvestments || showEnhancedInvestments) && (
              <TopNavDropdown
                label="Investments"
                icon={TrendingUpIcon}
                items={[
                  { to: '/investments', icon: TrendingUpIcon, label: 'Investments' },
                  ...(showEnhancedInvestments ? [{ to: '/enhanced-investments', icon: BarChart3Icon, label: 'Investment Analytics' }] : []),
                ]}
                activePaths={['/investments', '/enhanced-investments']}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
              />
            )}

            {showGoals && (
              <TopNavDropdown
                label="Forecasting"
                icon={LineChartIcon}
                items={[
                  { to: '/forecasting', icon: LineChartIcon, label: 'Forecasting' },
                  { to: '/goals', icon: GoalIcon, label: 'Goals' },
                ]}
                activePaths={['/forecasting', '/budget', '/goals']}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
              />
            )}

            {showAnalytics && (
              <TopNavItem to="/analytics" icon={BarChart3Icon} label="Analytics" />
            )}

            <TopNavDropdown
              label="Advanced"
              icon={MagicWandIcon}
              items={[
                { to: '/advanced', icon: MagicWandIcon, label: 'Advanced' },
                ...(showAIAnalytics ? [{ to: '/ai-analytics', icon: MagicWandIcon, label: 'AI Analytics' }] : []),
                { to: '/ai-features', icon: LightbulbIcon, label: 'AI Features' },
                { to: '/custom-reports', icon: FileTextIcon, label: 'Custom Reports' },
                ...(showTaxPlanning ? [{ to: '/tax-planning', icon: CalculatorIcon, label: 'Tax Planning' }] : []),
                ...(showHousehold ? [{ to: '/household', icon: UsersIcon, label: 'Household' }] : []),
                ...(showBusinessFeatures ? [{ to: '/business-features', icon: BriefcaseIcon, label: 'Business Features' }] : []),
                ...(showFinancialPlanning ? [{ to: '/financial-planning', icon: CalculatorIcon, label: 'Financial Planning' }] : []),
                ...(showDataIntelligence ? [{ to: '/data-intelligence', icon: DatabaseIcon, label: 'Data Intelligence' }] : []),
                ...(showSummaries ? [{ to: '/summaries', icon: PieChartIcon, label: 'Summaries' }] : []),
              ]}
              activePaths={['/advanced', '/ai-analytics', '/ai-features', '/custom-reports', '/tax-planning', '/household', '/business-features', '/financial-planning', '/data-intelligence', '/summaries']}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
            />

            <TopNavDropdown
              label="Settings"
              icon={SettingsIcon}
              items={[
                { to: '/settings', icon: SettingsIcon, label: 'Settings' },
                { to: '/settings/app', icon: Settings2Icon, label: 'App Settings' },
                { to: '/settings/data', icon: DatabaseIcon, label: 'Data Management' },
                { to: '/settings/categories', icon: TagIcon, label: 'Categories' },
                { to: '/settings/tags', icon: HashIcon, label: 'Tags' },
                { to: '/settings/deleted-accounts', icon: ArchiveIcon, label: 'Deleted Accounts' },
                { to: '/settings/security', icon: ShieldIcon, label: 'Security' },
                { to: '/enhanced-import', icon: UploadIcon, label: 'Enhanced Import' },
                { to: '/export-manager', icon: DownloadIcon, label: 'Export Manager' },
                { to: '/documents', icon: FolderIcon, label: 'Documents' },
                { to: '/open-banking', icon: BankIcon, label: 'Open Banking' },
              ]}
              activePaths={['/settings', '/enhanced-import', '/export-manager', '/documents', '/open-banking']}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
            />
          </div>

          {/* Right side: Search + Notifications + User */}
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <div className="w-80 [&_input]:!py-0.5 [&_input]:!text-sm [&_input]:!h-7 [&_input]:!min-h-0 [&>div>div]:!border-0 [&>div>div]:!shadow-none [&>div>div]:!bg-transparent [&>div>div]:!rounded-none">
              <div className="bg-white/10 rounded-lg border border-white/20 focus-within:bg-white/20 transition-colors overflow-hidden">
                <GlobalSearch
                  ref={desktopSearchRef}
                  placeholder="Search..."
                />
              </div>
            </div>
            <EnhancedNotificationBell />
            <RealtimeStatusDot />
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
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card-bg-light dark:bg-card-bg-dark shadow-md" role="banner">
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
          
          <h1 className="text-lg font-bold text-gray-900 dark:text-white" id="mobile-app-title">Wealth Tracker</h1>
          
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
          className="md:hidden px-4 pb-3 bg-card-bg-light dark:bg-card-bg-dark shadow-sm"
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
            className="w-full max-w-sm h-full bg-sidebar dark:bg-gray-800 shadow-2xl overflow-y-auto rounded-r-2xl" 
            onClick={e => e.stopPropagation()}
            role="navigation"
            aria-label="Mobile navigation menu"
          >
            <div className="p-4 pb-6">
              {/* Mobile header with close button */}
              <header className="flex justify-between items-center mb-8" role="banner">
                <h2 id="mobile-menu-title" className="text-2xl font-bold text-white dark:text-white">Wealth Tracker</h2>
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
                      <SidebarLink to="/settings/deleted-accounts" icon={ArchiveIcon} label="Archived" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
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
                
                {showAnalytics && <SidebarLink to="/analytics" icon={BarChart3Icon} label="Analytics" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                {showAIAnalytics && <SidebarLink to="/ai-analytics" icon={MagicWandIcon} label="AI Analytics" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                <SidebarLink to="/custom-reports" icon={FileTextIcon} label="Custom Reports" isCollapsed={false} onNavigate={toggleMobileMenu} />
                {showTaxPlanning && <SidebarLink to="/tax-planning" icon={CalculatorIcon} label="Tax Planning" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                {showHousehold && <SidebarLink to="/household" icon={UsersIcon} label="Household" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                {showBusinessFeatures && <SidebarLink to="/business-features" icon={BriefcaseIcon} label="Business Features" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                {showFinancialPlanning && <SidebarLink to="/financial-planning" icon={CalculatorIcon} label="Financial Planning" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                {showDataIntelligence && <SidebarLink to="/data-intelligence" icon={DatabaseIcon} label="Data Intelligence" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                {showSummaries && <SidebarLink to="/summaries" icon={PieChartIcon} label="Summaries" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                
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
                      <SidebarLink to="/settings/deleted-accounts" icon={ArchiveIcon} label="Deleted Accounts" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
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
        <div className="fixed top-20 right-4 z-50 bg-green-100 dark:bg-green-900/90 p-3 rounded-lg shadow-lg animate-fade-in-out">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-green-800 dark:text-green-200">
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
