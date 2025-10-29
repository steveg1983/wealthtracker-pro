import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { HomeIcon, CreditCardIcon, TargetIcon, WalletIcon, TrendingUpIcon, SettingsIcon, MenuIcon, XIcon, ArrowRightLeftIcon, BarChart3Icon, GoalIcon, ChevronRightIcon, DatabaseIcon, TagIcon, Settings2Icon, LineChartIcon, HashIcon, SearchIcon, MagicWandIcon, PieChartIcon, CalculatorIcon, ShieldIcon, UsersIcon, BriefcaseIcon, UploadIcon, DownloadIcon, FolderIcon, BankIcon, LightbulbIcon, FileTextIcon, ArchiveIcon } from '../components/icons';
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
import GlobalSearch, { useGlobalSearchDialog } from './GlobalSearch';
import KeyboardShortcutsHelp, { useKeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import EnhancedNotificationBell from './EnhancedNotificationBell';
import { NavigationBadge } from './ActivityBadge';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import KeyboardSequenceIndicator from './KeyboardSequenceIndicator';
import { RealtimeStatusDot } from './RealtimeStatusIndicator';
import MobileBottomNav from './MobileBottomNav';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import ErrorBoundary from './ErrorBoundary';
import { FloatingActionButton } from './FloatingActionButton';
import DemoModeIndicator from './DemoModeIndicator';
import SyncStatusIndicator from './SyncStatusIndicator';

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
  const isDemoMode = searchParams.get('demo') === 'true';
  const linkTo = isDemoMode ? `${to}?demo=true` : to;

  const handleLinkClick = () => {
    // For mobile menu, close it
    if (onNavigate) {
      onNavigate();
    }
  };

  const content = (
    <>
      <Icon size={18} />
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

export default function Layout(): React.JSX.Element {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [forecastingExpanded, setForecastingExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [investmentsExpanded, setInvestmentsExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const { registration } = useServiceWorker();
  const { 
    showBudget, 
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
  const { isWideView } = useLayout();
  const { isOpen: isSearchOpen, openSearch, closeSearch } = useGlobalSearchDialog();
  const { isOpen: isHelpOpen, openHelp, closeHelp } = useKeyboardShortcutsHelp();
  
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
    },
    threshold: 100
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };
  
  // Auto-collapse sidebar when wide view is active
  useEffect(() => {
    if (isWideView) {
      setIsSidebarCollapsed(true);
    }
  }, [isWideView]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to open global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
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
      
      // Alt + S to toggle sidebar (desktop)
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        toggleSidebar();
      }
      
      // Escape to close mobile menu
      if (e.key === 'Escape' && isMobileMenuOpen) {
        e.preventDefault();
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, openSearch, openHelp]);

  // Removed auto-expand logic - users control collapsible sections manually

  // Handle conflict resolution modal
  useEffect(() => {
    const handleOpenConflictResolver = (event: Event) => {
      const conflict = (event as CustomEvent).detail;
      setCurrentConflict(conflict);
      setConflictModalOpen(true);
    };

    window.addEventListener('open-conflict-resolver', handleOpenConflictResolver);
    return () => window.removeEventListener('open-conflict-resolver', handleOpenConflictResolver);
  }, []);

  return (
    <div className="flex min-h-screen bg-tertiary dark:bg-gray-900">
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
      {/* Desktop Sidebar Navigation */}
      <aside
        className={`${
          isSidebarCollapsed ? 'w-14' : 'w-52'
        } bg-sidebar dark:bg-gray-800 shadow-2xl rounded-2xl transition-all duration-300 hidden md:block m-4 h-[calc(100vh-2rem)] fixed`}
        aria-label="Main navigation sidebar"
      >
        <div className="p-3 h-full flex flex-col">
          <header className="flex items-center justify-between mb-6" role="banner">
            {!isSidebarCollapsed && (
              <h1 className="text-lg font-bold text-white dark:text-white">Wealth Tracker</h1>
            )}
            <div className="flex items-center space-x-2">
              {!isSidebarCollapsed && (
                <button
                  onClick={openSearch}
                  className="p-1 rounded hover:bg-white/20 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Open global search"
                  title="Search (Ctrl+K)"
                >
                  <SearchIcon size={18} className="text-white dark:text-gray-400" />
                </button>
              )}
              <button
                onClick={toggleSidebar}
                className="p-1 rounded hover:bg-white/20 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={isSidebarCollapsed ? 'Expand sidebar (Alt+S)' : 'Collapse sidebar (Alt+S)'}
              >
                <MenuIcon size={18} className="text-white dark:text-gray-400" />
              </button>
            </div>
          </header>
          <nav 
            id="main-navigation"
            className="space-y-1.5 flex-1 overflow-y-auto pr-2" 
            role="navigation" 
            aria-label="Main navigation menu"
          >
            <SidebarLink to="/" icon={HomeIcon} label="Home" isCollapsed={isSidebarCollapsed} />
            <SidebarLink to="/dashboard" icon={BarChart3Icon} label="Dashboard" isCollapsed={isSidebarCollapsed} />
            
            {/* Accounts with Sub-navigation (but no "All Accounts" redundancy) */}
            <div>
              {!isSidebarCollapsed ? (
                <div>
                  <Link
                    to={searchParams.get('demo') === 'true' ? '/accounts?demo=true' : '/accounts'}
                    onClick={() => setAccountsExpanded(!accountsExpanded)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] ${
                      location.pathname === '/accounts' || location.pathname.startsWith('/transactions') || location.pathname.startsWith('/reconciliation')
                        ? 'bg-sidebar-active dark:bg-gray-900 text-black dark:text-white shadow-lg border-2 border-sidebar dark:border-gray-600'
                        : 'bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50'
                    }`}
                    aria-expanded={accountsExpanded}
                    aria-label="Accounts"
                  >
                    <WalletIcon size={18} />
                    <span className="flex-1 text-sm text-left">Accounts</span>
                    <ChevronRightIcon 
                      size={14} 
                      className={`text-gray-400 transition-transform duration-200 ${accountsExpanded ? 'rotate-90' : ''}`} 
                    />
                  </Link>
                  {accountsExpanded && (
                    <div className="mt-1 space-y-0.5">
                      <SidebarLink to="/transactions" icon={CreditCardIcon} label="Transactions" isCollapsed={false} isSubItem={true} />
                      <SidebarLink to="/reconciliation" icon={ArrowRightLeftIcon} label="Reconciliation" isCollapsed={false} isSubItem={true} />
                    </div>
                  )}
                </div>
              ) : (
                <SidebarLink to="/accounts" icon={WalletIcon} label="Accounts" isCollapsed={true} />
              )}
            </div>
            
            {/* Investments with Sub-navigation */}
            {(showInvestments || showEnhancedInvestments) && (
              <div>
                {!isSidebarCollapsed ? (
                  <div>
                    <Link
                      to={searchParams.get('demo') === 'true' ? '/investments?demo=true' : '/investments'}
                      onClick={() => setInvestmentsExpanded(!investmentsExpanded)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] ${
                        location.pathname === '/investments' || location.pathname.startsWith('/enhanced-investments')
                          ? 'bg-sidebar-active dark:bg-gray-900 text-black dark:text-white shadow-lg border-2 border-sidebar dark:border-gray-600'
                          : 'bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50'
                      }`}
                      aria-expanded={investmentsExpanded}
                      aria-label="Investments"
                    >
                      <TrendingUpIcon size={18} />
                      <span className="flex-1 text-sm text-left">Investments</span>
                      <ChevronRightIcon 
                        size={14} 
                        className={`text-gray-400 transition-transform duration-200 ${investmentsExpanded ? 'rotate-90' : ''}`} 
                      />
                    </Link>
                    {investmentsExpanded && (
                      <div className="mt-1 space-y-0.5">
                        {showEnhancedInvestments && <SidebarLink to="/enhanced-investments" icon={BarChart3Icon} label="Investment Analytics" isCollapsed={false} isSubItem={true} />}
                      </div>
                    )}
                  </div>
                ) : (
                  <SidebarLink to="/investments" icon={TrendingUpIcon} label="Investments" isCollapsed={true} />
                )}
              </div>
            )}
            
            {/* Forecasting with Sub-navigation */}
            {showGoals && (
              <div>
                {!isSidebarCollapsed ? (
                  <div>
                    <Link
                      to={searchParams.get('demo') === 'true' ? '/forecasting?demo=true' : '/forecasting'}
                      onClick={() => setForecastingExpanded(!forecastingExpanded)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] ${
                        location.pathname === '/forecasting' || location.pathname === '/budget' || location.pathname === '/goals'
                          ? 'bg-sidebar-active dark:bg-gray-900 text-black dark:text-white shadow-lg border-2 border-sidebar dark:border-gray-600'
                          : 'bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50'
                      }`}
                      aria-expanded={forecastingExpanded}
                      aria-label="Forecasting & Budget"
                    >
                      <LineChartIcon size={18} />
                      <span className="flex-1 text-sm text-left">Forecasting</span>
                      <ChevronRightIcon 
                        size={14} 
                        className={`text-gray-400 transition-transform duration-200 ${forecastingExpanded ? 'rotate-90' : ''}`} 
                      />
                    </Link>
                    {forecastingExpanded && (
                      <div className="mt-1 space-y-0.5">
                        <SidebarLink to="/goals" icon={GoalIcon} label="Goals" isCollapsed={false} isSubItem={true} />
                      </div>
                    )}
                  </div>
                ) : (
                  <SidebarLink to="/forecasting" icon={LineChartIcon} label="Forecasting" isCollapsed={true} />
                )}
              </div>
            )}
            
            {showAnalytics && <SidebarLink to="/analytics" icon={BarChart3Icon} label="Analytics" isCollapsed={isSidebarCollapsed} />}
            
            {/* Advanced Features with Sub-navigation */}
            <div>
              {!isSidebarCollapsed ? (
                <Link
                  to={searchParams.get('demo') === 'true' ? '/advanced?demo=true' : '/advanced'}
                  onClick={() => setAdvancedExpanded(!advancedExpanded)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] ${
                    location.pathname === '/advanced' || location.pathname.startsWith('/ai-') || location.pathname === '/custom-reports' || 
                    location.pathname === '/tax-planning' || location.pathname === '/household' || location.pathname === '/business-features' ||
                    location.pathname === '/financial-planning' || location.pathname === '/data-intelligence' || location.pathname === '/summaries'
                      ? 'bg-sidebar-active dark:bg-gray-900 text-black dark:text-white shadow-lg border-2 border-sidebar dark:border-gray-600'
                      : 'bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50'
                  }`}
                  aria-expanded={advancedExpanded}
                  aria-label="Advanced"
                >
                  <MagicWandIcon size={18} />
                  <span className="flex-1 text-sm text-left">Advanced</span>
                  <ChevronRightIcon 
                    size={14} 
                    className={`text-gray-400 transition-transform duration-200 ${advancedExpanded ? 'rotate-90' : ''}`} 
                  />
                </Link>
              ) : (
                <SidebarLink to="/advanced" icon={MagicWandIcon} label="Advanced" isCollapsed={true} />
              )}
              {advancedExpanded && !isSidebarCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {showAIAnalytics && <SidebarLink to="/ai-analytics" icon={MagicWandIcon} label="AI Analytics" isCollapsed={false} isSubItem={true} />}
                  <SidebarLink to="/ai-features" icon={LightbulbIcon} label="AI Features" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/custom-reports" icon={FileTextIcon} label="Custom Reports" isCollapsed={false} isSubItem={true} />
                  {showTaxPlanning && <SidebarLink to="/tax-planning" icon={CalculatorIcon} label="Tax Planning" isCollapsed={false} isSubItem={true} />}
                  {showHousehold && <SidebarLink to="/household" icon={UsersIcon} label="Household" isCollapsed={false} isSubItem={true} />}
                  {showBusinessFeatures && <SidebarLink to="/business-features" icon={BriefcaseIcon} label="Business Features" isCollapsed={false} isSubItem={true} />}
                  {showFinancialPlanning && <SidebarLink to="/financial-planning" icon={CalculatorIcon} label="Financial Planning" isCollapsed={false} isSubItem={true} />}
                  {showDataIntelligence && <SidebarLink to="/data-intelligence" icon={DatabaseIcon} label="Data Intelligence" isCollapsed={false} isSubItem={true} />}
                  {showSummaries && <SidebarLink to="/summaries" icon={PieChartIcon} label="Summaries" isCollapsed={false} isSubItem={true} />}
                </div>
              )}
            </div>
            
            {/* Settings with Sub-navigation */}
            <div>
              {!isSidebarCollapsed ? (
                <Link
                  to={searchParams.get('demo') === 'true' ? '/settings?demo=true' : '/settings'}
                  onClick={() => setSettingsExpanded(!settingsExpanded)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg transition-colors min-h-[40px] md:min-h-[auto] ${
                    location.pathname.startsWith('/settings') || location.pathname === '/enhanced-import' || 
                    location.pathname === '/export-manager' || location.pathname === '/documents' || location.pathname === '/open-banking'
                      ? 'bg-sidebar-active dark:bg-gray-900 text-black dark:text-white shadow-lg border-2 border-sidebar dark:border-gray-600'
                      : 'bg-secondary text-white dark:text-gray-300 hover:bg-secondary dark:hover:bg-gray-800/50'
                  }`}
                  aria-expanded={settingsExpanded}
                  aria-label="Settings"
                >
                  <SettingsIcon size={18} />
                  <span className="flex-1 text-sm text-left">Settings</span>
                  <ChevronRightIcon 
                    size={14} 
                    className={`text-gray-400 transition-transform duration-200 ${settingsExpanded ? 'rotate-90' : ''}`} 
                  />
                </Link>
              ) : (
                <SidebarLink to="/settings" icon={SettingsIcon} label="Settings" isCollapsed={true} />
              )}
              {settingsExpanded && !isSidebarCollapsed && (
                <div className="mt-1 space-y-0.5">
                  <SidebarLink to="/settings/app" icon={Settings2Icon} label="App Settings" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/data" icon={DatabaseIcon} label="Data Management" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/categories" icon={TagIcon} label="Categories" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/tags" icon={HashIcon} label="Tags" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/deleted-accounts" icon={ArchiveIcon} label="Deleted Accounts" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/security" icon={ShieldIcon} label="Security" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/enhanced-import" icon={UploadIcon} label="Enhanced Import" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/export-manager" icon={DownloadIcon} label="Export Manager" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/documents" icon={FolderIcon} label="Documents" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/open-banking" icon={BankIcon} label="Open Banking" isCollapsed={false} isSubItem={true} />
                </div>
              )}
            </div>
          </nav>
        </div>
      </aside>

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
          
          <h1 className="text-lg font-bold text-gray-900 dark:text-white" id="mobile-app-title">Wealth Tracker</h1>
          
          <div className="flex items-center gap-2">
            <SyncStatusIndicator variant="compact" className="mr-1" />
            <EnhancedNotificationBell />
            <button
              onClick={openSearch}
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
      
      {/* Desktop Notification Bell, User Profile and Theme Switcher */}
      <div className="hidden md:flex items-center gap-3 fixed top-4 right-4 z-30" role="toolbar" aria-label="User tools">
        <SyncStatusIndicator variant="compact" />
        <EnhancedNotificationBell />
        <RealtimeStatusDot />
        <UserButton 
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-10 h-10",
              userButtonPopoverCard: "shadow-xl",
              userButtonPopoverActions: "mt-2"
            }
          }}
        />
      </div>

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
                      openSearch();
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
                    to={searchParams.get('demo') === 'true' ? '/accounts?demo=true' : '/accounts'}
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
                    </div>
                  )}
                </div>
                
                {/* Investments with Sub-navigation */}
                {(showInvestments || showEnhancedInvestments) && (
                  <div>
                    <Link
                      to={searchParams.get('demo') === 'true' ? '/investments?demo=true' : '/investments'}
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
                      to={searchParams.get('demo') === 'true' ? '/forecasting?demo=true' : '/forecasting'}
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
                  <SidebarLink 
                    to="/settings" 
                    icon={SettingsIcon} 
                    label="Settings" 
                    isCollapsed={false}
                    hasSubItems={true}
                  />
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
        ref={swipeRef as React.RefObject<HTMLElement>}
        id="main-content"
        className={`flex-1 md:pl-0 mt-16 md:mt-0 ${isSidebarCollapsed ? 'md:ml-[5.5rem]' : 'md:ml-[14.5rem]'} transition-all duration-300`}
        style={{ WebkitOverflowScrolling: 'touch' }}
        role="main"
        aria-label="Main content"
        tabIndex={-1}
      >
        <NavigationProgress />
        
        {/* Desktop Search Bar - Always Visible */}
        <div className="hidden md:block sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex-1 max-w-2xl">
              <button
                onClick={openSearch}
                className="w-full flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-left transition-colors group"
                aria-label="Search transactions, accounts, and more"
              >
                <SearchIcon size={20} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                <span className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                  Search transactions, accounts, budgets...
                </span>
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-mono">
                  Ctrl+K
                </span>
              </button>
            </div>
            <div className="flex items-center gap-4 ml-6">
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
        </div>
        
        <MobileBreadcrumb />
        <MobilePullToRefreshWrapper>
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pb-20 md:pb-8">
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
        analysis={currentAnalysis}
        onResolve={resolveConflict}
      />
      
      {/* Service Worker Update Notification */}
      <ServiceWorkerUpdateNotification registration={registration} />
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
      
      
      {/* Global Search */}
      <ErrorBoundary>
        <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      </ErrorBoundary>
      
      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={closeHelp} />
      
      {/* Enhanced Conflict Resolution Modal */}
      {currentConflict && (
        <EnhancedConflictResolutionModal
          isOpen={isConflictModalOpen}
          onClose={dismissConflict}
          conflict={currentConflict}
          analysis={currentAnalysis}
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
      
      {/* Floating Action Button for quick transaction entry */}
      <FloatingActionButton />
    </div>
  );
}
