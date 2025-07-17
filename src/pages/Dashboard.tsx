import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUpIcon, TrendingDownIcon, BanknoteIcon } from '../components/icons';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
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


export default function Dashboard() {
  const { accounts, transactions, hasTestData, clearAllData } = useApp();
  const { firstName, setFirstName, setCurrency } = usePreferences();
  const { formatCurrency, convertAndSum, displayCurrency } = useCurrency();
  const { layouts, updateDashboardLayout, resetDashboardLayout } = useLayoutConfig();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLayoutControls, setShowLayoutControls] = useState(false);
  type ModalData = 
    | Array<{ month: string; netWorth: number }> // NetWorthData[]
    | Array<{ id: string; name: string; value: number }> // AccountDistributionData[]
    | Array<{ account: { id: string; name: string }; unreconciledCount: number; totalToReconcile: number }> // ReconciliationData[]
    | { // IncomeExpenditureData
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
          isHeader?: boolean;
        }>;
        transactions: Array<{
          id: string;
          date: Date;
          amount: number;
          description: string;
          category: string;
          accountId: string;
          type: 'income' | 'expense' | 'transfer';
          tags?: string[];
          notes?: string;
        }>;
        accounts: Account[];
      };

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'networth-chart' | 'account-distribution' | 'income-expenditure' | 'reconciliation' | null;
    title: string;
    data?: ModalData;
  }>({
    isOpen: false,
    type: null,
    title: ''
  });
  const [convertedTotals, setConvertedTotals] = useState({
    assets: 0,
    liabilities: 0,
    netWorth: 0
  });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showAccountBreakdown, setShowAccountBreakdown] = useState<{
    isOpen: boolean;
    type: 'networth' | 'assets' | 'liabilities' | null;
    title: string;
  }>({
    isOpen: false,
    type: null,
    title: ''
  });
  

  // Memoize recent transactions
  const recentTransactions = useMemo(() => 
    transactions.slice(0, 10),
    [transactions]
  );
  
  // Calculate totals with currency conversion
  useEffect(() => {
    let cancelled = false;
    
    const calculateTotals = async () => {
      setIsLoading(true);
      
      try {
        const assetAccounts = accounts.filter(acc => acc.balance > 0);
        const liabilityAccounts = accounts.filter(acc => acc.balance < 0);
        
        const [totalAssets, totalLiabilities] = await Promise.all([
          convertAndSum(assetAccounts.map(acc => ({ amount: acc.balance, currency: acc.currency }))),
          convertAndSum(liabilityAccounts.map(acc => ({ amount: Math.abs(acc.balance), currency: acc.currency })))
        ]);
        
        if (!cancelled) {
          setConvertedTotals({
            assets: totalAssets,
            liabilities: totalLiabilities,
            netWorth: totalAssets - totalLiabilities
          });
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error calculating totals:', error);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    calculateTotals();
    
    return () => {
      cancelled = true;
    };
  }, [accounts, displayCurrency, convertAndSum]);
  
  const { assets: totalAssets, liabilities: totalLiabilities, netWorth } = convertedTotals;
  
  // Check for test data on component mount
  useEffect(() => {
    if (hasTestData) {
      const warningDismissed = localStorage.getItem('testDataWarningDismissed');
      if (warningDismissed !== 'true') {
        setShowTestDataWarning(true);
      }
    }
  }, [hasTestData, accounts.length]);

  // Check if onboarding should be shown
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (!onboardingCompleted && !firstName && !showTestDataWarning) {
      setShowOnboarding(true);
    }
  }, [firstName, showTestDataWarning]);

  // Use reconciliation hook
  // Reconciliation details available if needed later
  useReconciliation(accounts, transactions);


  // Generate net worth data for chart
  const netWorthData = useMemo(() => {
    const last12Months = [];
    const currentDate = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // Calculate net worth for this month
      // For now, using current net worth as placeholder
      // In a real app, you'd calculate historical values
      last12Months.push({
        month,
        netWorth: netWorth * (1 - i * 0.02) // Simulated growth
      });
    }
    
    return last12Months;
  }, [netWorth]);

  // Generate pie chart data for account distribution
  const pieData = useMemo(() => {
    return accounts
      .filter(acc => acc.balance > 0)
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        value: acc.balance
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 accounts
  }, [accounts]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const isDarkMode = document.documentElement.classList.contains('dark');
  
  const chartStyles = useMemo(() => ({
    tooltip: {
      backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB',
      borderRadius: '8px',
      color: isDarkMode ? '#E5E7EB' : '#111827'
    },
    pieTooltip: {
      backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      border: isDarkMode ? '1px solid #374151' : '1px solid #ccc',
      borderRadius: '8px',
      color: isDarkMode ? '#E5E7EB' : '#111827'
    }
  }), [isDarkMode]);

  // Income and expenditure data is now calculated within the IncomeExpenditureReport component itself

  // Handle onboarding completion
  const handleOnboardingComplete = (name: string, currency: string) => {
    setFirstName(name);
    setCurrency(currency);
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  // Handle test data warning close
  const handleTestDataWarningClose = () => {
    setShowTestDataWarning(false);
    // Check if we should show onboarding after warning closes
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (!onboardingCompleted && !firstName) {
      setShowOnboarding(true);
    }
  };

  // Modal helpers
  const closeModal = () => {
    setModalState({
      isOpen: false,
      type: null,
      title: ''
    });
  };

  return (
    <PageWrapper 
      title="Dashboard"
      reducedHeaderWidth={true}
      rightContent={
        <div 
          onClick={() => setShowLayoutControls(!showLayoutControls)}
          className="cursor-pointer"
          title={showLayoutControls ? "Lock Layout" : "Unlock Layout"}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
            className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
          >
            <circle
              cx="24"
              cy="24"
              r="24"
              fill="#D9E1F2"
              className="transition-all duration-200"
              onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C5D3E8')}
              onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D9E1F2')}
            />
            {showLayoutControls ? (
              <g transform="translate(12, 12)">
                <path 
                  d="M7 11V7C7 4.23858 9.23858 2 12 2C14.419 2 16.4367 3.71776 16.9 6M5 11H19C19.5523 11 20 11.4477 20 12V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V12C4 11.4477 4.44772 11 5 11Z" 
                  stroke="#1F2937" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <circle cx="12" cy="16" r="1" fill="#1F2937" />
              </g>
            ) : (
              <g transform="translate(12, 12)">
                <path 
                  d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11M5 11H19C19.5523 11 20 11.4477 20 12V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V12C4 11.4477 4.44772 11 5 11Z" 
                  stroke="#1F2937" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
                <circle cx="12" cy="16" r="1" fill="#1F2937" />
              </g>
            )}
          </svg>
        </div>
      }
    >

      {showLayoutControls && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
            Drag the widgets below to rearrange your dashboard. Resize by dragging the bottom-right corner.
          </p>
          <button
            onClick={resetDashboardLayout}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Reset to Default Layout
          </button>
        </div>
      )}

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Fixed Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div 
          className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 md:p-8 cursor-pointer hover:shadow-xl hover:border-blue-200/50 transition-all"
          onClick={() => setShowAccountBreakdown({ isOpen: true, type: 'networth', title: 'Net Worth Breakdown' })}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Net Worth</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {isLoading ? '...' : formatCurrency(netWorth)}
              </p>
            </div>
            <BanknoteIcon className="text-primary ml-2" size={24} />
          </div>
        </div>

        <div 
          className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 md:p-8 cursor-pointer hover:shadow-xl hover:border-blue-200/50 transition-all"
          onClick={() => setShowAccountBreakdown({ isOpen: true, type: 'assets', title: 'Assets Breakdown' })}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Total Assets</p>
              <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {isLoading ? '...' : formatCurrency(totalAssets)}
              </p>
            </div>
            <TrendingUpIcon className="text-green-500 ml-2" size={24} />
          </div>
        </div>

        <div 
          className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 md:p-8 cursor-pointer hover:shadow-xl hover:border-blue-200/50 transition-all"
          onClick={() => setShowAccountBreakdown({ isOpen: true, type: 'liabilities', title: 'Liabilities Breakdown' })}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Total Liabilities</p>
              <p className="text-2xl md:text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                {isLoading ? '...' : formatCurrency(totalLiabilities)}
              </p>
            </div>
            <TrendingDownIcon className="text-red-500 ml-2" size={24} />
          </div>
        </div>
        </div>

        {/* Draggable Widgets */}
        <div>
          <DraggableGrid
          layouts={{ lg: layouts.dashboard }}
          onLayoutChange={updateDashboardLayout}
          isDraggable={showLayoutControls}
          isResizable={showLayoutControls}
        >

        {/* Net Worth Chart */}
        <div key="asset-chart">
          <GridItem key="net-worth-chart" title="Net Worth Over Time">
            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-2">
              Click title for expanded view • Click any bar to see detailed breakdown
            </p>
            <div className="h-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={netWorthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6B7280"
                    fontSize={12}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    fontSize={12}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                      return value.toString();
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
                    contentStyle={chartStyles.tooltip}
                  />
                  <Bar 
                    dataKey="netWorth" 
                    fill="#8B5CF6" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GridItem>
        </div>

        {/* Recent Transactions */}
        <div key="recent-transactions">
          <GridItem key="recent-transactions-grid" title="Recent Transactions">
            <div className="space-y-1 overflow-auto" style={{ maxHeight: '300px' }}>
              {recentTransactions.map(transaction => (
                <div 
                  key={transaction.id} 
                  className="flex items-center gap-3 py-1.5 border-b dark:border-gray-700/50 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors rounded px-2 -mx-2"
                  onClick={() => setEditingTransaction(transaction)}
                >
                  <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap w-12">
                    {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-400 w-4 text-center">
                    {transaction.cleared ? 'R' : 'N'}
                  </span>
                  <p className="text-sm font-medium dark:text-white truncate flex-1">{transaction.description}</p>
                  <span className={`text-sm font-semibold whitespace-nowrap ${
                    transaction.type === 'income' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
              ))}
              {transactions.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                  No transactions yet
                </p>
              )}
            </div>
          </GridItem>
        </div>

        {/* Investment Performance - placeholder for now */}
        <div key="investment-performance">
          <GridItem key="account-distribution-grid" title="Account Distribution">
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-2">
              Click to view transactions
            </p>
            <div className="h-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={(data) => {
                      navigate(`/transactions?account=${data.id}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={chartStyles.pieTooltip}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GridItem>
        </div>
          </DraggableGrid>

        </div>
        
        {/* Layout Controls */}
        {showLayoutControls && (
          <div className="flex gap-2 justify-center mb-4">
            <button 
              onClick={() => setShowLayoutControls(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done Editing
            </button>
            <button 
              onClick={resetDashboardLayout} 
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Reset Layout
            </button>
          </div>
        )}
      </div>
      
      {/* Test Data Warning Modal */}
      <TestDataWarningModal
        isOpen={showTestDataWarning}
        onClose={handleTestDataWarningClose}
        onClearData={() => {
          clearAllData();
          handleTestDataWarningClose();
        }}
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      {/* Dashboard Modal */}
      <DashboardModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        type={modalState.type}
        data={modalState.data}
        chartStyles={chartStyles}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
      />

      {/* Account Breakdown Modal */}
      {showAccountBreakdown.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#D9E1F2] dark:bg-gray-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden border-2 border-blue-300 dark:border-gray-700">
            <div className="p-6 border-b-2 border-[#5A729A] dark:border-gray-700 bg-[#6B86B3] dark:bg-gray-800">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white dark:text-white">
                  {showAccountBreakdown.title}
                </h2>
                <button
                  onClick={() => setShowAccountBreakdown({ isOpen: false, type: null, title: '' })}
                  className="text-white/70 hover:text-white dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 m-6 rounded-2xl shadow-md border-2 border-blue-200 dark:border-gray-700 overflow-y-auto" style={{ maxHeight: 'calc(60vh - 3rem)' }}>
              {(() => {
                const assetAccounts = accounts.filter(acc => acc.balance > 0);
                const liabilityAccounts = accounts.filter(acc => acc.balance < 0);
                
                let displayAccounts: typeof accounts = [];
                
                if (showAccountBreakdown.type === 'networth') {
                  displayAccounts = accounts;
                } else if (showAccountBreakdown.type === 'assets') {
                  displayAccounts = assetAccounts;
                } else if (showAccountBreakdown.type === 'liabilities') {
                  displayAccounts = liabilityAccounts;
                }

                // Group accounts by type
                const groupedAccounts = displayAccounts.reduce((groups, account) => {
                  const type = account.type || 'other';
                  if (!groups[type]) {
                    groups[type] = [];
                  }
                  groups[type].push(account);
                  return groups;
                }, {} as Record<string, typeof accounts>);

                const getAccountTypeLabel = (type: string) => {
                  switch (type) {
                    case 'current': return 'Current Accounts';
                    case 'savings': return 'Savings Accounts';
                    case 'credit': return 'Credit Cards';
                    case 'loan': return 'Loans';
                    case 'investment': return 'Investments';
                    default: return 'Other Accounts';
                  }
                };

                return (
                  <div className="space-y-6">
                    {Object.entries(groupedAccounts).map(([type, typeAccounts]) => {
                      const typeTotal = (typeAccounts as Account[]).reduce((sum, acc) => sum + acc.balance, 0);
                      
                      return (
                        <div key={type}>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                            {getAccountTypeLabel(type)}
                          </h3>
                          <div className="space-y-2">
                            {(typeAccounts as Account[]).map((account) => (
                              <div
                                key={account.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-2xl hover:bg-[#D9E1F2]/30 dark:hover:bg-gray-600 cursor-pointer transition-colors border border-gray-200 dark:border-gray-600"
                                onClick={() => {
                                  navigate(`/transactions?account=${account.id}`);
                                  setShowAccountBreakdown({ isOpen: false, type: null, title: '' });
                                }}
                              >
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {account.name}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {account.institution || 'No institution'}
                                  </p>
                                </div>
                                <p className={`font-semibold ${
                                  account.balance >= 0 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {formatCurrency(Math.abs(account.balance))}
                                </p>
                              </div>
                            ))}
                            <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                              <div className="flex justify-between items-center">
                                <p className="font-medium text-gray-700 dark:text-gray-300">
                                  Subtotal
                                </p>
                                <p className={`font-bold ${
                                  typeTotal >= 0 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {formatCurrency(Math.abs(typeTotal))}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {showAccountBreakdown.type === 'networth' && (
                      <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4 mt-6">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="font-medium text-gray-700 dark:text-gray-300">
                              Total Assets
                            </p>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(totalAssets)}
                            </p>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="font-medium text-gray-700 dark:text-gray-300">
                              Total Liabilities
                            </p>
                            <p className="font-semibold text-red-600 dark:text-red-400">
                              {formatCurrency(totalLiabilities)}
                            </p>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600">
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                              Net Worth
                            </p>
                            <p className={`text-lg font-bold ${
                              netWorth >= 0 
                                ? 'text-gray-900 dark:text-white' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {formatCurrency(netWorth)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}