import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, CreditCardIcon, WalletIcon, TrendingUpIcon, SettingsIcon, MenuIcon, ArrowRightLeftIcon, BarChart3Icon, GoalIcon, ChevronRightIcon, DatabaseIcon, TagIcon, Settings2Icon, LineChartIcon, HashIcon, SearchIcon, MagicWandIcon, PieChartIcon, CalculatorIcon, ShieldIcon, UsersIcon, BriefcaseIcon, UploadIcon, DownloadIcon, FolderIcon, BankIcon, LightbulbIcon, FileTextIcon, ArchiveIcon } from '../../icons';
import { SidebarLink } from './SidebarLink';
import { usePreferences } from '../../../contexts/PreferencesContext';
import { useLogger } from '../services/ServiceProvider';

interface DesktopSidebarProps {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  openSearch: () => void;
}

export function DesktopSidebar({ isSidebarCollapsed, toggleSidebar, openSearch  }: DesktopSidebarProps): React.JSX.Element {
  const logger = useLogger();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [forecastingExpanded, setForecastingExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [investmentsExpanded, setInvestmentsExpanded] = useState(false);
  
  const { 
    showBudget, 
    showGoals, 
    showAnalytics,
    showInvestments,
    showEnhancedInvestments,
    showAIAnalytics,
    showFinancialPlanning,
    showDataIntelligence,
    showSummaries
  } = usePreferences();
  // Legacy flags not present in PreferencesContext; default to false
  const showTaxPlanning = false;
  const showHousehold = false;
  const showBusinessFeatures = false;

  return (
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
          
          {/* Accounts with Sub-navigation */}
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
                    <SidebarLink to="/transfers" icon={ArrowRightLeftIcon} label="Transfer Center" isCollapsed={false} isSubItem={true} />
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
  );
}
