import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { AppProvider } from './contexts/AppContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { Home, Wallet, CreditCard, ArrowRightLeft, TrendingUp, Settings as SettingsIcon, Target, BarChart3, Goal, LineChart, Database, Tag, Settings2 } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Transactions from './pages/Transactions';
import Reconciliation from './pages/Reconciliation';
import SettingsPage from './pages/Settings';
import Budget from './pages/Budget';
import Goals from './pages/Goals';
import Analytics from './pages/Analytics';
import Investments from './pages/Investments';
import { usePreferences } from './contexts/PreferencesContext';

type Page = 'dashboard' | 'accounts' | 'transactions' | 'reconciliation' | 'settings' | 'budget' | 'goals' | 'analytics' | 'investments' | 'forecasting' | 'settings-app' | 'settings-data' | 'settings-categories';

function SimpleApp() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [forecastingExpanded, setForecastingExpanded] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'accounts':
        return <Accounts />;
      case 'transactions':
        return <Transactions />;
      case 'reconciliation':
        return <Reconciliation />;
      case 'investments':
        return <Investments />;
      case 'budget':
        return <Budget />;
      case 'goals':
        return <Goals />;
      case 'analytics':
        return <Analytics />;
      case 'settings':
      case 'settings-app':
      case 'settings-data':
      case 'settings-categories':
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <AppProvider>
          <LayoutProvider>
            <Router>
              <AppContent 
                currentPage={currentPage} 
                setCurrentPage={setCurrentPage}
                accountsExpanded={accountsExpanded}
                setAccountsExpanded={setAccountsExpanded}
                forecastingExpanded={forecastingExpanded}
                setForecastingExpanded={setForecastingExpanded}
                settingsExpanded={settingsExpanded}
                setSettingsExpanded={setSettingsExpanded}
                renderPage={renderPage}
              />
            </Router>
          </LayoutProvider>
        </AppProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}

function AppContent({ 
  currentPage, 
  setCurrentPage, 
  accountsExpanded, 
  setAccountsExpanded,
  forecastingExpanded,
  setForecastingExpanded,
  settingsExpanded,
  setSettingsExpanded,
  renderPage 
}: {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  accountsExpanded: boolean;
  setAccountsExpanded: (expanded: boolean) => void;
  forecastingExpanded: boolean;
  setForecastingExpanded: (expanded: boolean) => void;
  settingsExpanded: boolean;
  setSettingsExpanded: (expanded: boolean) => void;
  renderPage: () => React.ReactNode;
}) {
  // const { showBudget, showGoals, showAnalytics } = usePreferences();
  // Hardcode to true for now to troubleshoot
  const showBudget = true;
  const showGoals = true; 
  const showAnalytics = true;

  return (
              <div className="flex h-screen bg-[#D9E1F2] dark:bg-gray-900">
                {/* Sidebar */}
                <aside className="w-64 bg-[#8EA9DB] dark:bg-gray-800 shadow-lg border-r border-blue-200 dark:border-gray-700">
                  <div className="p-4">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent dark:text-white mb-8">
                      Wealth Tracker
                    </h1>
                    <nav className="space-y-2">
                      <button
                        onClick={() => setCurrentPage('dashboard')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
                          currentPage === 'dashboard'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                        }`}
                      >
                        <Home size={20} />
                        <span>Dashboard</span>
                      </button>
                      
                      {/* Accounts with Sub-navigation */}
                      <div>
                        <button
                          onClick={() => {
                            setCurrentPage('accounts');
                            setAccountsExpanded(!accountsExpanded);
                          }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
                            currentPage === 'accounts'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                          }`}
                        >
                          <Wallet size={20} />
                          <span className="flex-1">Accounts</span>
                        </button>
                        {accountsExpanded && (
                          <div className="mt-1 space-y-1">
                            <button
                              onClick={() => setCurrentPage('transactions')}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ml-6 text-sm ${
                                currentPage === 'transactions'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                              }`}
                            >
                              <CreditCard size={20} />
                              <span>Transactions</span>
                            </button>
                            <button
                              onClick={() => setCurrentPage('reconciliation')}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ml-6 text-sm ${
                                currentPage === 'reconciliation'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                              }`}
                            >
                              <ArrowRightLeft size={20} />
                              <span>Reconciliation</span>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage('investments')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
                          currentPage === 'investments'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                        }`}
                      >
                        <TrendingUp size={20} />
                        <span>Investments</span>
                      </button>
                      
                      {/* Forecasting with Sub-navigation */}
                      {/* Forecasting with Sub-navigation */}
                      <div>
                        <button
                          onClick={() => setForecastingExpanded(!forecastingExpanded)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
                            currentPage === 'budget' || currentPage === 'goals'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                          }`}
                        >
                          <LineChart size={20} />
                          <span className="flex-1">Forecasting</span>
                        </button>
                        {forecastingExpanded && (
                          <div className="mt-1 space-y-1">
                            <button
                              onClick={() => setCurrentPage('budget')}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ml-6 text-sm ${
                                currentPage === 'budget'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                              }`}
                            >
                              <Target size={20} />
                              <span>Budget</span>
                            </button>
                            <button
                              onClick={() => setCurrentPage('goals')}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ml-6 text-sm ${
                                currentPage === 'goals'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                              }`}
                            >
                              <Goal size={20} />
                              <span>Goals</span>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage('analytics')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
                          currentPage === 'analytics'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                        }`}
                      >
                        <BarChart3 size={20} />
                        <span>Analytics</span>
                      </button>
                      
                      {/* Settings with Sub-navigation */}
                      <div>
                        <button
                          onClick={() => {
                            setCurrentPage('settings');
                            setSettingsExpanded(!settingsExpanded);
                          }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
                            currentPage.startsWith('settings')
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                          }`}
                        >
                          <SettingsIcon size={20} />
                          <span className="flex-1">Settings</span>
                        </button>
                        {settingsExpanded && (
                          <div className="mt-1 space-y-1">
                            <button
                              onClick={() => setCurrentPage('settings-app')}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ml-6 text-sm ${
                                currentPage === 'settings-app'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                              }`}
                            >
                              <Settings2 size={20} />
                              <span>App Settings</span>
                            </button>
                            <button
                              onClick={() => setCurrentPage('settings-data')}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ml-6 text-sm ${
                                currentPage === 'settings-data'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                              }`}
                            >
                              <Database size={20} />
                              <span>Data Management</span>
                            </button>
                            <button
                              onClick={() => setCurrentPage('settings-categories')}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ml-6 text-sm ${
                                currentPage === 'settings-categories'
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
                              }`}
                            >
                              <Tag size={20} />
                              <span>Categories</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </nav>
                  </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                  <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
                    {renderPage()}
                  </div>
                </main>
              </div>
            </Router>
          </LayoutProvider>
        </AppProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}

export default SimpleApp;