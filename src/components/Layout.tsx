import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Home, CreditCard, Target, Wallet, TrendingUp, Settings, Menu, X, ArrowRightLeft, BarChart3, Goal, ChevronRight, Database, Tag, Settings2, LineChart } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import { usePreferences } from '../contexts/PreferencesContext';

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  hasSubItems?: boolean;
  isSubItem?: boolean;
  onClick?: () => void;
  onNavigate?: () => void;
}

function SidebarLink({ to, icon: Icon, label, isCollapsed, hasSubItems, isSubItem, onClick, onNavigate }: SidebarLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to || 
    (hasSubItems && location.pathname.startsWith(to)) ||
    (to === '/accounts' && (location.pathname.startsWith('/transactions') || location.pathname.startsWith('/reconciliation'))) ||
    (to === '/forecasting' && (location.pathname.startsWith('/budget') || location.pathname.startsWith('/goals')));

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    // If we're already on this page and it has sub-items, just toggle the expansion
    if (hasSubItems && location.pathname === to && onClick) {
      e.preventDefault();
      onClick();
    } else if (onNavigate) {
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
            <ChevronRight size={16} className="text-gray-400" />
          )}
        </>
      )}
    </>
  );

  const className = `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
    isSubItem ? 'ml-6 text-sm' : ''
  } ${
    isActive
      ? 'bg-blue-600 text-white shadow-md'
      : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600'
  }`;

  if (onClick && !to) {
    return (
      <button
        onClick={handleClick}
        className={className}
        title={isCollapsed ? label : undefined}
      >
        {content}
      </button>
    );
  }

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

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

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
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        } bg-white dark:bg-gray-800 shadow-lg border-r border-blue-100 dark:border-gray-700 transition-all duration-300 hidden md:block`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold text-blue-800 dark:text-white">Wealth Tracker</h1>
            )}
            <button
              onClick={toggleSidebar}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <Menu size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <nav className="space-y-2">
            <SidebarLink to="/" icon={Home} label="Dashboard" isCollapsed={isSidebarCollapsed} />
            
            {/* Accounts with Sub-navigation */}
            <div>
              <SidebarLink 
                to="/accounts" 
                icon={Wallet} 
                label="Accounts" 
                isCollapsed={isSidebarCollapsed}
                hasSubItems={!isSidebarCollapsed}
                onClick={() => setAccountsExpanded(!accountsExpanded)}
                onNavigate={() => !isSidebarCollapsed && setAccountsExpanded(true)}
              />
              {accountsExpanded && !isSidebarCollapsed && (
                <div className="mt-1 space-y-1">
                  <SidebarLink to="/transactions" icon={CreditCard} label="Transactions" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/reconciliation" icon={ArrowRightLeft} label="Reconciliation" isCollapsed={false} isSubItem={true} />
                </div>
              )}
            </div>
            
            <SidebarLink to="/investments" icon={TrendingUp} label="Investments" isCollapsed={isSidebarCollapsed} />
            
            {/* Forecasting with Sub-navigation */}
            {(showBudget || showGoals) && (
              <div>
                <SidebarLink 
                  to="/forecasting" 
                  icon={LineChart} 
                  label="Forecasting" 
                  isCollapsed={isSidebarCollapsed}
                  hasSubItems={!isSidebarCollapsed}
                  onClick={() => setForecastingExpanded(!forecastingExpanded)}
                  onNavigate={() => !isSidebarCollapsed && setForecastingExpanded(true)}
                />
                {forecastingExpanded && !isSidebarCollapsed && (
                  <div className="mt-1 space-y-1">
                    {showBudget && <SidebarLink to="/budget" icon={Target} label="Budget" isCollapsed={false} isSubItem={true} />}
                    {showGoals && <SidebarLink to="/goals" icon={Goal} label="Goals" isCollapsed={false} isSubItem={true} />}
                  </div>
                )}
              </div>
            )}
            
            {showAnalytics && <SidebarLink to="/analytics" icon={BarChart3} label="Analytics" isCollapsed={isSidebarCollapsed} />}
            
            {/* Settings with Sub-navigation */}
            <div>
              <SidebarLink 
                to="/settings" 
                icon={Settings} 
                label="Settings" 
                isCollapsed={isSidebarCollapsed}
                hasSubItems={!isSidebarCollapsed}
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                onNavigate={() => !isSidebarCollapsed && setSettingsExpanded(true)}
              />
              {settingsExpanded && !isSidebarCollapsed && (
                <div className="mt-1 space-y-1">
                  <SidebarLink to="/settings/app" icon={Settings2} label="App Settings" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/data" icon={Database} label="Data Management" isCollapsed={false} isSubItem={true} />
                  <SidebarLink to="/settings/categories" icon={Tag} label="Categories" isCollapsed={false} isSubItem={true} />
                </div>
              )}
            </div>
          </nav>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
      >
        {isMobileMenuOpen ? <X size={28} className="text-gray-600 dark:text-gray-300" /> : <Menu size={28} className="text-gray-600 dark:text-gray-300" />}
      </button>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={toggleMobileMenu}>
          <aside className="w-72 h-full bg-white dark:bg-gray-800 shadow-md overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 pb-6">
              {/* Mobile header with close button */}
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Wealth Tracker</h1>
                <button
                  onClick={toggleMobileMenu}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  <X size={24} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>
              <nav className="space-y-2">
                <SidebarLink to="/" icon={Home} label="Dashboard" isCollapsed={false} onNavigate={toggleMobileMenu} />
                
                {/* Accounts with Sub-navigation */}
                <div>
                  <SidebarLink 
                    to="/accounts" 
                    icon={Wallet} 
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
                      <SidebarLink to="/transactions" icon={CreditCard} label="Transactions" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/reconciliation" icon={ArrowRightLeft} label="Reconciliation" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                    </div>
                  )}
                </div>
                
                <SidebarLink to="/investments" icon={TrendingUp} label="Investments" isCollapsed={false} onNavigate={toggleMobileMenu} />
                
                {/* Forecasting with Sub-navigation */}
                {(showBudget || showGoals) && (
                  <div>
                    <SidebarLink 
                      to="/forecasting" 
                      icon={LineChart} 
                      label="Forecasting" 
                      isCollapsed={false}
                      hasSubItems={true}
                      onClick={() => setForecastingExpanded(!forecastingExpanded)}
                      onNavigate={() => {
                        setForecastingExpanded(true);
                        toggleMobileMenu();
                      }}
                    />
                    {forecastingExpanded && (
                      <div className="mt-1 space-y-1">
                        {showBudget && <SidebarLink to="/budget" icon={Target} label="Budget" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />}
                        {showGoals && <SidebarLink to="/goals" icon={Goal} label="Goals" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />}
                      </div>
                    )}
                  </div>
                )}
                
                {showAnalytics && <SidebarLink to="/analytics" icon={BarChart3} label="Analytics" isCollapsed={false} onNavigate={toggleMobileMenu} />}
                
                {/* Settings with Sub-navigation */}
                <div>
                  <SidebarLink 
                    to="/settings" 
                    icon={Settings} 
                    label="Settings" 
                    isCollapsed={false}
                    hasSubItems={true}
                    onClick={() => setSettingsExpanded(!settingsExpanded)}
                  />
                  {settingsExpanded && (
                    <div className="mt-1 space-y-1">
                      <SidebarLink to="/settings/app" icon={Settings2} label="App Settings" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/settings/data" icon={Database} label="Data Management" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                      <SidebarLink to="/settings/categories" icon={Tag} label="Categories" isCollapsed={false} isSubItem={true} onNavigate={toggleMobileMenu} />
                    </div>
                  )}
                </div>
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 pt-20 md:pt-6 lg:pt-8 max-w-7xl mx-auto">
          <Breadcrumbs />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
