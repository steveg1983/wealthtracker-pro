import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { AppProvider } from './contexts/AppContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { Home, Wallet, CreditCard, ArrowRightLeft, TrendingUp, Settings as SettingsIcon, Target, BarChart3, Goal, LineChart, Settings2, Database, Tag } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Transactions from './pages/Transactions';
import Reconciliation from './pages/Reconciliation';
import Investments from './pages/Investments';
import Budget from './pages/Budget';
import Goals from './pages/Goals';
import Analytics from './pages/Analytics';
import SettingsPage from './pages/Settings';
import AppSettings from './pages/settings/AppSettings';
import DataManagement from './pages/settings/DataManagement';
import Categories from './pages/settings/Categories';

type Page = 'dashboard' | 'accounts' | 'transactions' | 'reconciliation' | 'investments' | 'budget' | 'goals' | 'analytics' | 'settings' | 'settings-app' | 'settings-data' | 'settings-categories';

function App() {
  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <AppProvider>
          <LayoutProvider>
            <Router>
              <AppContent />
            </Router>
          </LayoutProvider>
        </AppProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [settingsExpanded, setSettingsExpanded] = useState(true); // Start expanded to test
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'accounts':
        return <Accounts onAccountClick={(accountId: string) => {
          setSelectedAccountId(accountId);
          setCurrentPage('transactions');
        }} />;
      case 'transactions':
        return <Transactions selectedAccountId={selectedAccountId} />;
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
        return <SettingsPage />;
      case 'settings-app':
        return <AppSettings />;
      case 'settings-data':
        return <DataManagement />;
      case 'settings-categories':
        return <Categories />;
      default:
        return <Dashboard />;
    }
  };

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
            
            <button
              onClick={() => setCurrentPage('accounts')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
                currentPage === 'accounts'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
              }`}
            >
              <Wallet size={20} />
              <span>Accounts</span>
            </button>
            
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
            
            <button
              onClick={() => setCurrentPage('budget')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
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
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
                currentPage === 'goals'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-gray-600'
              }`}
            >
              <Goal size={20} />
              <span>Goals</span>
            </button>
            
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
  );
}

export default App;