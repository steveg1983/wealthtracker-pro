import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { HomeIcon, CreditCardIcon, TargetIcon, WalletIcon, TrendingUpIcon, SettingsIcon, MenuIcon, XIcon, ArrowRightLeftIcon, BarChart3Icon, GoalIcon, ChevronRightIcon, DatabaseIcon, TagIcon, Settings2Icon, LineChartIcon, HashIcon } from '../components/icons';
import { usePreferences } from '../contexts/PreferencesContext';
import { useLayout } from '../contexts/LayoutContext';

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
      <Icon size={20} />
      {!isCollapsed && (
        <>
          <span className="flex-1">{label}</span>
          {hasSubItems && (
            <ChevronRightIcon size={16} className="text-gray-400" />
          )}
        </>
      )}
    </>
  );

  const className = `flex items-center gap-3 px-4 py-4 md:py-3 rounded-lg transition-colors min-h-[48px] md:min-h-[auto] ${
    isSubItem ? 'ml-6 text-sm' : ''
  } ${
    isCollapsed ? 'sidebar-link-collapsed' : ''
  } ${
    isActive
      ? isCollapsed
        ? 'text-black dark:text-white'
        : 'bg-[#B8D4F1] dark:bg-gray-900 text-black dark:text-white shadow-lg border-2 border-[#4A6FA5] dark:border-gray-600'
      : 'bg-[#6B86B3] text-white dark:text-gray-300 hover:bg-[#5A729A] dark:hover:bg-gray-800/50'
  }`;

  return (
    <Link
      to={to}
      className={className}
      title={isCollapsed ? label : undefined}
      onClick={handleLinkClick}
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
  const { showBudget, showGoals, showAnalytics } = usePreferences();
  const { isWideView } = useLayout();

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
    <div className="flex h-screen bg-[#D9E1F2] dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        } bg-[#8EA9DB] dark:bg-gray-800 shadow-2xl rounded-2xl transition-all duration-300 hidden md:block m-4 h-[calc(100vh-2rem)]`}
      >
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold text-white dark:text-white">Wealth Tracker</h1>
            )}
            <button
              onClick={toggleSidebar}
              className="p-1 rounded hover:bg-white/20 dark:hover:bg-gray-600"
            >
              <MenuIcon size={20} className="text-white dark:text-gray-400" />
            </button>
          </div>
          <nav className="space-y-2 flex-1 overflow-y-auto pr-2">
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
                <div className="mt-1 space-y-1">
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
                  <div className="mt-1 space-y-1">
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
                <div className="mt-1 space-y-1">
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
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-[#8EA9DB] dark:bg-gray-800 rounded-xl shadow-2xl hover:shadow-xl transition-shadow min-w-[48px] min-h-[48px] flex items-center justify-center"
      >
        {isMobileMenuOpen ? <XIcon size={32} className="text-white dark:text-gray-200" /> : <MenuIcon size={32} className="text-white dark:text-gray-200" />}
      </button>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={toggleMobileMenu}>
          <aside className="w-full max-w-sm h-full bg-[#8EA9DB] dark:bg-gray-800 shadow-2xl overflow-y-auto rounded-r-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 pb-6">
              {/* Mobile header with close button */}
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-white dark:text-white">Wealth Tracker</h1>
                <button
                  onClick={toggleMobileMenu}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  <XIcon size={24} className="text-white dark:text-gray-300" />
                </button>
              </div>
              <nav className="space-y-2">
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
      <main className="flex-1 overflow-auto md:pl-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
