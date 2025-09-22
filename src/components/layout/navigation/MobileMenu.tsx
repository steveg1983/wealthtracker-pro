import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, CreditCardIcon, WalletIcon, TrendingUpIcon, SettingsIcon, XIcon, ArrowRightLeftIcon, BarChart3Icon, GoalIcon, ChevronRightIcon, DatabaseIcon, TagIcon, Settings2Icon, LineChartIcon, HashIcon, SearchIcon, MagicWandIcon, PieChartIcon, CalculatorIcon, ShieldIcon, UsersIcon, BriefcaseIcon, UploadIcon, DownloadIcon, FolderIcon, BankIcon, LightbulbIcon, FileTextIcon, ArchiveIcon } from '../../icons';
import { SidebarLink } from './SidebarLink';
import { usePreferences } from '../../../contexts/PreferencesContext';
import { useLogger } from '../services/ServiceProvider';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  openSearch: () => void;
}

export function MobileMenu({ isOpen, onClose, openSearch  }: MobileMenuProps): React.JSX.Element | null {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [forecastingExpanded, setForecastingExpanded] = useState(false);
  const [investmentsExpanded, setInvestmentsExpanded] = useState(false);
  
  const { 
    showGoals, 
    showAnalytics,
    showInvestments,
    showEnhancedInvestments,
    showAIAnalytics,
    showFinancialPlanning,
    showDataIntelligence,
    showSummaries
  } = usePreferences();
  const showTaxPlanning = false;
  const showHousehold = false;
  const showBusinessFeatures = false;

  if (!isOpen) return null;

  return (
    <div 
      className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" 
      onClick={onClose}
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
                  onClose();
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Open global search"
              >
                <SearchIcon size={24} className="text-white dark:text-gray-300" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Close navigation menu"
              >
                <XIcon size={24} className="text-white dark:text-gray-300" />
              </button>
            </div>
          </header>
          <div className="space-y-2" role="none">
            <SidebarLink to="/" icon={HomeIcon} label="Home" isCollapsed={false} onNavigate={onClose} />
            <SidebarLink to="/dashboard" icon={BarChart3Icon} label="Dashboard" isCollapsed={false} onNavigate={onClose} />
            
            {/* Accounts with Sub-navigation */}
            <div>
              <Link
                to={searchParams.get('demo') === 'true' ? '/accounts?demo=true' : '/accounts'}
                onClick={() => {
                  setAccountsExpanded(!accountsExpanded);
                  onClose();
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
                  <SidebarLink to="/transactions" icon={CreditCardIcon} label="Transactions" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/reconciliation" icon={ArrowRightLeftIcon} label="Reconciliation" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
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
                    onClose();
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
                    {showEnhancedInvestments && <SidebarLink to="/enhanced-investments" icon={BarChart3Icon} label="Investment Analytics" isCollapsed={false} isSubItem={true} onNavigate={onClose} />}
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
                    onClose();
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
                    <SidebarLink to="/goals" icon={GoalIcon} label="Goals" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  </div>
                )}
              </div>
            )}
            
            {showAnalytics && <SidebarLink to="/analytics" icon={BarChart3Icon} label="Analytics" isCollapsed={false} onNavigate={onClose} />}
            {showAIAnalytics && <SidebarLink to="/ai-analytics" icon={MagicWandIcon} label="AI Analytics" isCollapsed={false} onNavigate={onClose} />}
            <SidebarLink to="/custom-reports" icon={FileTextIcon} label="Custom Reports" isCollapsed={false} onNavigate={onClose} />
            {showTaxPlanning && <SidebarLink to="/tax-planning" icon={CalculatorIcon} label="Tax Planning" isCollapsed={false} onNavigate={onClose} />}
            {showHousehold && <SidebarLink to="/household" icon={UsersIcon} label="Household" isCollapsed={false} onNavigate={onClose} />}
            {showBusinessFeatures && <SidebarLink to="/business-features" icon={BriefcaseIcon} label="Business Features" isCollapsed={false} onNavigate={onClose} />}
            {showFinancialPlanning && <SidebarLink to="/financial-planning" icon={CalculatorIcon} label="Financial Planning" isCollapsed={false} onNavigate={onClose} />}
            {showDataIntelligence && <SidebarLink to="/data-intelligence" icon={DatabaseIcon} label="Data Intelligence" isCollapsed={false} onNavigate={onClose} />}
            {showSummaries && <SidebarLink to="/summaries" icon={PieChartIcon} label="Summaries" isCollapsed={false} onNavigate={onClose} />}
            
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
                  <SidebarLink to="/settings/app" icon={Settings2Icon} label="App Settings" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/settings/data" icon={DatabaseIcon} label="Data Management" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/settings/categories" icon={TagIcon} label="Categories" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/settings/tags" icon={HashIcon} label="Tags" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/settings/deleted-accounts" icon={ArchiveIcon} label="Deleted Accounts" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/settings/security" icon={ShieldIcon} label="Security" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/enhanced-import" icon={UploadIcon} label="Enhanced Import" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/export-manager" icon={DownloadIcon} label="Export Manager" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/documents" icon={FolderIcon} label="Documents" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                  <SidebarLink to="/open-banking" icon={BankIcon} label="Open Banking" isCollapsed={false} isSubItem={true} onNavigate={onClose} />
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
