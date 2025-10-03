import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUpIcon, TrendingDownIcon, BanknoteIcon, GridIcon, BarChart3Icon, DatabaseIcon } from '../components/icons';
import { useAppRedux } from '../store/hooks/useAppRedux';
import { usePreferencesRedux } from '../store/hooks/usePreferencesRedux';
import { DynamicPieChart, DynamicBarChart } from '../components/charts/ChartMigration';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useReconciliation } from '../hooks/useReconciliation';
import { useLayoutConfig } from '../hooks/useLayoutConfig';
import { DraggableGrid } from '../components/layout/DraggableGrid';
import { GridItem } from '../components/layout/GridItem';
import type { Account } from '../types';
import TestDataWarningModal from '../components/TestDataWarningModal';
import OnboardingModal from '../components/OnboardingModal';
import DashboardModal from '../components/DashboardModal';
import EditTransactionModal from '../components/EditTransactionModal';
import type { Transaction } from '../types';
import type { ReportSettings } from '../components/IncomeExpenditureReport';
import PageWrapper from '../components/PageWrapper';
import CustomizableDashboard from '../components/CustomizableDashboard';
import DataImportExport from '../components/DataImportExport';
import { ReduxExampleWidget } from '../components/ReduxExampleWidget';

/**
 * Redux version of the Dashboard component
 * Uses Redux hooks through migration hooks for compatibility
 */
export default function DashboardRedux() {
  // Use Redux through migration hooks
  const { accounts, transactions, clearAllData } = useAppRedux();
  const { firstName, setFirstName, setCurrency } = usePreferencesRedux();
  const { formatCurrency, convertAndSum, displayCurrency } = useCurrencyDecimal();
  const { layouts, updateDashboardLayout, resetDashboardLayout } = useLayoutConfig();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'classic' | 'modern' | 'import-export' | 'redux'>('redux');
  const [isLoading, setIsLoading] = useState(true);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLayoutControls, setShowLayoutControls] = useState(false);
  
  type ModalData = 
    | Array<{ month: string; netWorth: number }>
    | Array<{ id: string; name: string; value: number }>
    | Array<{ account: { id: string; name: string }; unreconciledCount: number; totalToReconcile: number }>
    | {
        settings: ReportSettings;
        setSettings: (settings: ReportSettings | ((prev: ReportSettings) => ReportSettings)) => void;
        categories: Array<{
          id: string;
          name: string;
          type: 'income' | 'expense' | 'both';
          level: 'type' | 'sub' | 'detail';
          parentId?: string;
          color?: string;
          icon?: string;
          isSystem?: boolean;
        }>;
      };

  const [dashboardModal, setDashboardModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'netWorth' | 'accounts' | 'reconciliation' | 'incomeExpenditure';
    data: ModalData;
  }>({
    isOpen: false,
    title: '',
    type: 'netWorth',
    data: []
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      if (!firstName) {
        setShowOnboarding(true);
      } else if (accounts.length > 0) {
        setShowTestDataWarning(true);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [firstName, accounts.length]);

  const handleOnboardingComplete = (name: string, currency: string) => {
    setFirstName(name);
    setCurrency(currency);
    setShowOnboarding(false);
  };

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, account) => sum + (account.balance || 0), 0);
  }, [accounts]);

  const monthlyIncome = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions
      .filter(t => t.type === 'income' && new Date(t.date) >= startOfMonth)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions
      .filter(t => t.type === 'expense' && new Date(t.date) >= startOfMonth)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const netIncome = monthlyIncome - monthlyExpenses;

  return (
    <PageWrapper
      title="Dashboard"
      rightContent={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('classic')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                activeTab === 'classic'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Classic
            </button>
            <button
              onClick={() => setActiveTab('modern')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'modern'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Modern
            </button>
            <button
              onClick={() => setActiveTab('import-export')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'import-export'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <DatabaseIcon size={16} className="inline mr-1" />
              Import/Export
            </button>
            <button
              onClick={() => setActiveTab('redux')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                activeTab === 'redux'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Redux Demo
            </button>
          </div>
        </div>
      }
    >
      <TestDataWarningModal
        isOpen={showTestDataWarning}
        onClose={() => setShowTestDataWarning(false)}
        onClearData={clearAllData}
      />
      
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      {activeTab === 'redux' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-gray-900/20 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Redux Integration Demo
            </h3>
            <p className="text-blue-700 dark:text-gray-300">
              This dashboard is using Redux through migration hooks. The data is synced between Context API and Redux store.
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Balance</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(totalBalance)}
                  </p>
                </div>
                <BanknoteIcon size={24} className="text-gray-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Income</p>
                  <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                    +{formatCurrency(monthlyIncome)}
                  </p>
                </div>
                <TrendingUpIcon size={24} className="text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Expenses</p>
                  <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                    -{formatCurrency(monthlyExpenses)}
                  </p>
                </div>
                <TrendingDownIcon size={24} className="text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Redux Example Widget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReduxExampleWidget />
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 dark:text-white">Migration Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Context API</span>
                  <span className="text-sm font-medium text-green-600">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Redux Store</span>
                  <span className="text-sm font-medium text-green-600">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Data Sync</span>
                  <span className="text-sm font-medium text-green-600">Enabled</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Data is automatically synced between Context API and Redux during the migration period.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => navigate('/transactions')}
                className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <BarChart3Icon size={24} className="mx-auto mb-2 text-gray-600" />
                <span className="text-sm">View Transactions</span>
              </button>
              <button
                onClick={() => navigate('/accounts')}
                className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <BanknoteIcon size={24} className="mx-auto mb-2 text-green-600" />
                <span className="text-sm">Manage Accounts</span>
              </button>
              <button
                onClick={() => navigate('/budget')}
                className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <TrendingUpIcon size={24} className="mx-auto mb-2 text-purple-600" />
                <span className="text-sm">View Budget</span>
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <BarChart3Icon size={24} className="mx-auto mb-2 text-orange-600" />
                <span className="text-sm">Analytics</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'classic' && (
        // Original classic dashboard content
        <div>Classic Dashboard Content (using Context API)</div>
      )}

      {activeTab === 'modern' && (
        <CustomizableDashboard />
      )}

      {activeTab === 'import-export' && (
        <DataImportExport />
      )}
    </PageWrapper>
  );
}