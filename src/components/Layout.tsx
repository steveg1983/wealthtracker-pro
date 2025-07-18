import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { HomeIcon, CreditCardIcon, TargetIcon, WalletIcon, TrendingUpIcon, SettingsIcon, MenuIcon, XIcon, ArrowRightLeftIcon, BarChart3Icon, GoalIcon, ChevronRightIcon, DatabaseIcon, TagIcon, Settings2Icon, LineChartIcon, HashIcon, SearchIcon } from '../components/icons';
import { usePreferences } from '../contexts/PreferencesContext';
import { useLayout } from '../contexts/LayoutContext';
import OfflineIndicator from './OfflineIndicator';
import PWAInstallPrompt from './PWAInstallPrompt';
import GlobalSearch, { useGlobalSearchDialog } from './GlobalSearch';
import KeyboardShortcutsHelp, { useKeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import KeyboardSequenceIndicator from './KeyboardSequenceIndicator';
import MobileBottomNav from './MobileBottomNav';
import { useSwipeGestures, useSwipeNavigation } from '../hooks/useSwipeGestures';

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  hasSubItems?: boolean;
  isSubItem?: boolean;
  onNavigate?: () => void;
}

function SidebarLink({ to, icon: Icon, label, isCollapsed, hasSubItems, isSubItem, onNavigate }: SidebarLinkProps) {
  const location = useLocation();
  const { isWideView } = useLayout();
  const isActive = !isWideView && (location.pathname === to || 
    (hasSubItems && location.pathname.startsWith(to)) ||
    (to === '/accounts' && (location.pathname.startsWith('/transactions') || location.pathname.startsWith('/reconciliation'))) ||
    (to === '/forecasting' && (location.pathname.startsWith('/budget') || location.pathname.startsWith('/goals'))));

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
      to={to}
      className={className}
      title={isCollapsed ? label : undefined}
      onClick={handleLinkClick}
      role="menuitem"
      aria-label={`Navigate to ${label}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
    </Link>
  );
}

export default function Layout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [forecastingExpanded, setForecastingExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { showBudget, showGoals, showAnalytics } = usePreferences();
  const { isWideView } = useLayout();
  const { isOpen: isSearchOpen, openSearch, closeSearch } = useGlobalSearchDialog();
  const { isOpen: isHelpOpen, openHelp, closeHelp } = useKeyboardShortcutsHelp();
  const { navigateToPage } = useSwipeNavigation();
  
  // Initialize global keyboard shortcuts
  const { activeSequence } = useGlobalKeyboardShortcuts(openHelp);

  // Swipe navigation for mobile
  const swipeRef = useSwipeGestures({
    onSwipeLeft: () => {
      if (window.innerWidth <= 768) { // Only on mobile
        const nextPage = navigateToPage('next', location.pathname);
        if (nextPage) navigate(nextPage);
      }
    },
    onSwipeRight: () => {
      if (window.innerWidth <= 768) { // Only on mobile
        const prevPage = navigateToPage('prev', location.pathname);
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

  // Auto-expand/collapse sections based on current page
  React.useEffect(() => {
    // Settings section
    if (location.pathname.startsWith('/settings')) {
      setSettingsExpanded(true);
    } else {
      setSettingsExpanded(false);
    }
    
    // Accounts section
    if (location.pathname.startsWith('/accounts') || 
        location.pathname.startsWith('/reconciliation') || 
        location.pathname.startsWith('/transactions')) {
      setAccountsExpanded(true);
    } else {
      setAccountsExpanded(false);
    }
    
    // Forecasting section
    if (location.pathname.startsWith('/forecasting') || 
        location.pathname.startsWith('/budget') || 
        location.pathname.startsWith('/goals')) {
      setForecastingExpanded(true);
    } else {
      setForecastingExpanded(false);
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-tertiary dark:bg-gray-900">
      {/* Skip link for screen readers */}
      <a 
        href="#main-content" 
        className="skip-link"
        tabIndex={1}
      >
        Skip to main content
      </a>
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarCollapsed ? 'w-14' : 'w-52'
        } bg-sidebar dark:bg-gray-800 shadow-2xl rounded-2xl transition-all duration-300 hidden md:block m-4 h-[calc(100vh-2rem)]`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="p-3 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            {!isSidebarCollapsed && (
              <h1 className="text-lg font-bold text-white dark:text-white">Wealth Tracker</h1>
            )}
            <div className="flex items-center space-x-2">
              <button
                onClick={openSearch}
                className="p-1 rounded hover:bg-white/20 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Open global search"
                title="Search (Ctrl+K)"
              >
                <SearchIcon size={18} className="text-white dark:text-gray-400" />
              </button>
              <button
                onClick={toggleSidebar}
                className="p-1 rounded hover:bg-white/20 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={isSidebarCollapsed ? 'Expand sidebar (Alt+S)' : 'Collapse sidebar (Alt+S)'}
              >
                <MenuIcon size={18} className="text-white dark:text-gray-400" />
              </button>
            </div>
          </div>
          <nav className="space-y-1.5 flex-1 overflow-y-auto pr-2" role="menubar" aria-label="Main navigation menu">
            <SidebarLink to="/" icon={HomeIcon} label="Home" isCollapsed={isSidebarCollapsed} />
            <SidebarLink to="/dashboard" icon={BarChart3Icon} label="Dashboard" isCollapsed={isSidebarCollapsed} />
            
            {/* Accounts with Sub-navigation */}
            <div>
              <SidebarLink 
                to="/accounts" 
                icon={WalletIcon} 
                label="Accounts" 
                isCollapsed={isSidebarCollapsed}
                hasSubItems={!isSidebarCollapsed}
              />
              {accountsExpanded && !isSidebarCollapsed && (
                <div className="mt-1 space-y-0.5">
                  <SidebarLink to="/transactions" icon={CreditCardIcon} label="Transactions" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/reconciliation" icon={ArrowRightLeftIcon} label="Reconciliation" isCollapsed={false} isSubItem={true} />
                </div>
              )}
            </div>
            
            <SidebarLink to="/investments" icon={TrendingUpIcon} label="Investments" isCollapsed={isSidebarCollapsed} />
            
            {/* Forecasting with Sub-navigation */}
            {(showBudget || showGoals) && (
              <div>
                <SidebarLink 
                  to="/forecasting" 
                  icon={LineChartIcon} 
                  label="Forecasting" 
                  isCollapsed={isSidebarCollapsed}
                  hasSubItems={!isSidebarCollapsed}
                />
                {forecastingExpanded && !isSidebarCollapsed && (
                  <div className="mt-1 space-y-0.5">
                    {showBudget && <SidebarLink to="/budget" icon={TargetIcon} label="Budget" isCollapsed={false} isSubItem={true} />}
                    {showGoals && <SidebarLink to="/goals" icon={GoalIcon} label="Goals" isCollapsed={false} isSubItem={true} />}
                  </div>
                )}
              </div>
            )}
            
            {showAnalytics && <SidebarLink to="/analytics" icon={BarChart3Icon} label="Analytics" isCollapsed={isSidebarCollapsed} />}
            
            {/* Settings with Sub-navigation */}
            <div>
              <SidebarLink 
                to="/settings" 
                icon={SettingsIcon} 
                label="Settings" 
                isCollapsed={isSidebarCollapsed}
                hasSubItems={!isSidebarCollapsed}
              />
              {settingsExpanded && !isSidebarCollapsed && (
                <div className="mt-1 space-y-0.5">
                  <SidebarLink to="/settings/app" icon={Settings2Icon} label="App Settings" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/data" icon={DatabaseIcon} label="Data Management" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/categories" icon={TagIcon} label="Categories" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/tags" icon={HashIcon} label="Tags" isCollapsed={false} isSubItem={true} />
                </div>
              )}
            </div>
          </nav>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-sidebar dark:bg-gray-800 rounded-xl shadow-2xl hover:shadow-xl transition-shadow min-w-[48px] min-h-[48px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMobileMenuOpen}
        aria-controls="mobile-menu"
        title={isMobileMenuOpen ? 'Close menu (Escape)' : 'Open menu (Alt+M)'}
      >
        {isMobileMenuOpen ? <XIcon size={32} className="text-white dark:text-gray-200" /> : <MenuIcon size={32} className="text-white dark:text-gray-200" />}
      </button>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" 
          onClick={toggleMobileMenu}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-menu-title"
        >
          <aside 
            id="mobile-menu"
            className="w-full max-w-sm h-full bg-sidebar dark:bg-gray-800 shadow-2xl overflow-y-auto rounded-r-2xl" 
            onClick={e => e.stopPropagation()}
            role="navigation"
            aria-label="Mobile navigation"
          >
            <div className="p-4 pb-6">
              {/* Mobile header with close button */}
              <div className="flex justify-between items-center mb-8">
                <h1 id="mobile-menu-title" className="text-2xl font-bold text-white dark:text-white">Wealth Tracker</h1>
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
              </div>
              <nav className="space-y-2" role="menubar" aria-label="Mobile navigation menu">
                <SidebarLink to="/" icon={HomeIcon} label="Home" isCollapsed={false} onNavigate={toggleMobileMenu} />
                <SidebarLink to="/dashboard" icon={BarChart3Icon} label="Dashboard" isCollapsed={false} onNavigate={toggleMobileMenu} />
                
                {/* Accounts with Sub-navigation */}
                <div>
                  <SidebarLink 
                    to="/accounts" 
                    icon={WalletIcon} 
                    label="Accounts" 
                    isCollapsed={false}
                    hasSubItems={true}
                    onNavigate={() => {
                      setAccountsExpanded(true);
                      toggleMobileMenu();
                    }}
                  />
                  {accountsExpanded && (
                    <div className="mt-1 space-y-1">
                      <SidebarLink to="/transactions" icon={CreditCardIcon} label="Transactions" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/reconciliation" icon={ArrowRightLeftIcon} label="Reconciliation" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                    </div>
                  )}
                </div>
                
                <SidebarLink to="/investments" icon={TrendingUpIcon} label="Investments" isCollapsed={false} onNavigate={toggleMobileMenu} />
                
                {/* Forecasting with Sub-navigation */}
                {(showBudget || showGoals) && (
                  <div>
                    <SidebarLink 
                      to="/forecasting" 
                      icon={LineChartIcon} 
                      label="Forecasting" 
                      isCollapsed={false}
                      hasSubItems={true}
                      onNavigate={() => {
                        setForecastingExpanded(true);
                        toggleMobileMenu();
                      }}
                    />
                    {forecastingExpanded && (
                      <div className="mt-1 space-y-1">
                        {showBudget && <SidebarLink to="/budget" icon={TargetIcon} label="Budget" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />}
                        {showGoals && <SidebarLink to="/goals" icon={GoalIcon} label="Goals" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />}
                      </div>
                    )}
                  </div>
                )}
                
                {showAnalytics && <SidebarLink to="/analytics" icon={BarChart3Icon} label="Analytics" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                
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
                    </div>
                  )}
                </div>
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main 
        ref={swipeRef as React.RefObject<HTMLElement>}
        id="main-content"
        className="flex-1 overflow-auto md:pl-0" 
        role="main"
        aria-label="Main content"
        tabIndex={-1}
      >
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pb-20 md:pb-8">
          <Outlet />
        </div>
      </main>
      
      {/* Offline Indicator */}
      <OfflineIndicator />
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
      
      
      {/* Global Search */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      
      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={closeHelp} />
      
      {/* Keyboard Sequence Indicator */}
      <KeyboardSequenceIndicator activeSequence={activeSequence} />
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
