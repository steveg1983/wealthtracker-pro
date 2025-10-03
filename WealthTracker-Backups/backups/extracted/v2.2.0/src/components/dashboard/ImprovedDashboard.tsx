import React, { useState, useMemo, useEffect, lazy, Suspense, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  TrendingUpIcon, 
  TrendingDownIcon, 
  BanknoteIcon, 
  AlertCircleIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  WalletIcon,
  TargetIcon,
  CreditCardIcon,
  PieChartIcon,
  SettingsIcon,
  CheckIcon,
  XIcon,
  BarChart3Icon
} from '../icons';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { formatCurrency } from '../../utils/currency';
import { preserveDemoParam } from '../../utils/navigation';
import AddTransactionModal from '../AddTransactionModal';
import { useTranslation } from '../../hooks/useTranslation';
import { 
  PieChart as RcPieChart,
  BarChart as RcBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Pie,
  Bar,
  Cell
} from '../charts/OptimizedCharts';
import { SkeletonCard } from '../loading/Skeleton';

/**
 * Improved Dashboard with better information hierarchy
 * Design principles:
 * 1. Progressive disclosure - show most important info first
 * 2. Visual hierarchy - use size, color, and spacing
 * 3. Actionable insights - every section leads somewhere
 * 4. Mobile-optimized - works great on all screen sizes
 */
export const ImprovedDashboard = memo(function ImprovedDashboard() {
  const { accounts, transactions, budgets } = useApp();
  const { formatCurrency: formatCurrencyWithSymbol, displayCurrency } = useCurrencyDecimal();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  
  // Load saved preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dashboardKeyAccounts');
    if (saved) {
      setSelectedAccountIds(JSON.parse(saved));
    } else {
      // Default to showing first 4 accounts
      setSelectedAccountIds(accounts.slice(0, 4).map(a => a.id));
    }
  }, [accounts]);

  // Calculate key metrics
  const metrics = useMemo(() => {
    const totalAssets = accounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum + acc.balance, 0);
    
    const totalLiabilities = accounts
      .filter(acc => acc.balance < 0)
      .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    
    const netWorth = totalAssets - totalLiabilities;
    
    // Calculate monthly change (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = transactions.filter(t => 
      new Date(t.date) >= thirtyDaysAgo
    );
    
    const monthlyIncome = recentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const monthlyExpenses = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
    
    // Get recent activity
    const recentActivity = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    
    // Identify accounts needing attention
    const accountsNeedingAttention = accounts.filter(acc => {
      // Check for low balances in checking/current accounts
      if ((acc.type === 'current' || acc.type === 'checking') && acc.balance < 500) {
        return true;
      }
      // Check for high credit utilization
      if (acc.type === 'credit' && acc.creditLimit) {
        const utilization = Math.abs(acc.balance) / acc.creditLimit;
        return utilization > 0.7;
      }
      return false;
    });
    
    // Calculate budget status for active budgets
    const currentMonth = new Date().toISOString().slice(0, 7);
    const activeBudgets = budgets.filter(b => b.isActive);
    
    const budgetStatus = activeBudgets.map(budget => {
      const categoryTransactions = recentTransactions.filter(t => 
        t.category === budget.category && t.type === 'expense'
      );
      const spent = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const remaining = budget.amount - spent;
      const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      
      return {
        ...budget,
        spent,
        remaining,
        percentUsed,
        isOverBudget: spent > budget.amount
      };
    });
    
    const totalBudgeted = activeBudgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpentOnBudgets = budgetStatus.reduce((sum, b) => sum + b.spent, 0);
    const overallBudgetPercent = totalBudgeted > 0 ? (totalSpentOnBudgets / totalBudgeted) * 100 : 0;
    
    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      monthlyIncome,
      monthlyExpenses,
      monthlySavings,
      savingsRate,
      recentActivity,
      accountsNeedingAttention,
      budgetStatus,
      totalBudgeted,
      totalSpentOnBudgets,
      overallBudgetPercent,
      netWorthChange: 0, // Will be calculated from actual historical data when available
      netWorthChangePercent: 0 // Will be calculated from actual historical data when available
    };
  }, [accounts, transactions, budgets]);
  
  // Generate net worth data for chart - ONLY REAL DATA
  const netWorthData = useMemo(() => {
    // Only show current month's actual data
    // In the future, this will pull from historical snapshots
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    // For now, we only have current data
    // As the user uses the app over time, we'll build up historical data
    return [{
      month: currentMonth,
      netWorth: metrics.netWorth
    }];
  }, [metrics.netWorth]);
  
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

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds(prev => {
      const newSelection = prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId];
      
      // Save to localStorage
      localStorage.setItem('dashboardKeyAccounts', JSON.stringify(newSelection));
      return newSelection;
    });
  };
  
  const displayedAccounts = accounts.filter(a => selectedAccountIds.includes(a.id));

  return (
    <div className="space-y-6">
      {/* Primary Focus: Net Worth Hero Card */}
      <div 
        className="rounded-2xl p-6 sm:p-8 text-gray-600 dark:text-gray-300 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(59, 130, 246, 0.1)'
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-medium text-gray-700 dark:text-gray-200">{t('dashboard.yourNetWorth', 'Your Net Worth')}</h2>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyWithSymbol(metrics.netWorth)}
              </span>
              {/* Only show change when we have historical data */}
              {metrics.netWorthChange !== 0 && (
                metrics.netWorthChange > 0 ? (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm sm:text-base">
                    <ArrowUpIcon size={16} />
                    +{metrics.netWorthChangePercent.toFixed(1)}%
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm sm:text-base">
                    <ArrowDownIcon size={16} />
                    {metrics.netWorthChangePercent.toFixed(1)}%
                  </span>
                )
              )}
            </div>
            {metrics.netWorthChange !== 0 && (
              <p className="mt-3 text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                {t('dashboard.vsLastMonth', 'vs last month')}: {formatCurrencyWithSymbol(metrics.netWorthChange)}
              </p>
            )}
          </div>
          <BanknoteIcon size={48} className="text-gray-500 dark:text-gray-400 opacity-50 hidden sm:block" />
        </div>
        
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200/20 dark:border-gray-700/20">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.assets', 'Assets')}</p>
            <p className="text-xl font-semibold text-green-600 dark:text-green-400">
              {formatCurrencyWithSymbol(metrics.totalAssets)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.liabilities', 'Liabilities')}</p>
            <p className="text-xl font-semibold text-red-600 dark:text-red-400">
              {formatCurrencyWithSymbol(metrics.totalLiabilities)}
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Focus: This Month's Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('dashboard.thisMonthPerformance', "This Month's Performance")}
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.income', 'Income')}</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrencyWithSymbol(metrics.monthlyIncome)}
              </p>
            </div>
            <TrendingUpIcon size={24} className="text-green-500" />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('transactions.expenses', 'Expenses')}</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatCurrencyWithSymbol(metrics.monthlyExpenses)}
              </p>
            </div>
            <TrendingDownIcon size={24} className="text-red-500" />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.saved', 'Saved')}</p>
              <p className="text-xl font-bold text-gray-600 dark:text-gray-500">
                {formatCurrencyWithSymbol(metrics.monthlySavings)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {metrics.savingsRate.toFixed(1)}% {t('dashboard.rate', 'rate')}
              </p>
            </div>
            <TargetIcon size={24} className="text-gray-500" />
          </div>
        </div>
      </div>

      {/* Budget Status Section - Shows current budget progress */}
      {metrics.budgetStatus.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6" data-testid="budget-status">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChartIcon size={24} className="text-gray-500" />
            {t('dashboard.budgetStatus', 'Budget Status')}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({metrics.overallBudgetPercent.toFixed(0)}% {t('dashboard.used', 'used')})
            </span>
          </h3>
          
          <div className="space-y-3">
            {metrics.budgetStatus.slice(0, 3).map(budget => (
              <div key={budget.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {budget.category}
                  </span>
                  <span className={`font-medium ${
                    budget.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {formatCurrencyWithSymbol(budget.spent)} / {formatCurrencyWithSymbol(budget.amount)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      budget.percentUsed > 100 ? 'bg-red-500' :
                      budget.percentUsed > 80 ? 'bg-yellow-500' :
                      budget.percentUsed > 60 ? 'bg-gray-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            
            {metrics.budgetStatus.length > 3 && (
              <button 
                onClick={() => navigate(preserveDemoParam('/budget', location.search))}
                className="w-full mt-2 py-2 text-gray-600 dark:text-gray-500 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                View All Budgets ({metrics.budgetStatus.length}) →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Account Balances Section - Customizable by user */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <WalletIcon size={24} className="text-gray-500" />
            Key Account Balances
            {displayedAccounts.length > 0 && (
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({displayedAccounts.length} of {accounts.length})
              </span>
            )}
          </h3>
          <button
            onClick={() => setShowAccountSettings(!showAccountSettings)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Customize accounts"
          >
            <SettingsIcon size={20} className="text-gray-500" />
          </button>
        </div>
        
        {/* Account Selection Panel */}
        {showAccountSettings && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select accounts to display on dashboard:
              </p>
              <button
                onClick={() => setShowAccountSettings(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                <XIcon size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {accounts.map(account => (
                <label
                  key={account.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer"
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={selectedAccountIds.includes(account.id)}
                      onChange={() => toggleAccountSelection(account.id)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      selectedAccountIds.includes(account.id)
                        ? 'border-gray-600 dark:border-gray-400'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {selectedAccountIds.includes(account.id) && (
                        <div className="w-3 h-3 rounded-full bg-gray-600 dark:bg-gray-400 m-0.5" />
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {account.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {formatCurrencyWithSymbol(account.balance)}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Tip: Select your most important accounts for quick access
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayedAccounts.length > 0 ? (
            displayedAccounts.map(account => (
              <div 
                key={account.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                data-testid="account-balance-card"
                onClick={() => navigate(preserveDemoParam(`/accounts/${account.id}`, location.search))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(preserveDemoParam(`/accounts/${account.id}`, location.search));
                  }
                }}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {account.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {account.institution || account.subtype}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    account.balance < 0
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {formatCurrencyWithSymbol(account.balance)}
                  </p>
                  {account.creditLimit && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Limit: {formatCurrencyWithSymbol(account.creditLimit)}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : accounts.length > 0 ? (
            <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
              <SettingsIcon size={48} className="mx-auto mb-3 opacity-50" />
              <p className="font-medium">No accounts selected</p>
              <p className="text-sm mt-1">Click the settings icon above to select accounts to display</p>
            </div>
          ) : (
            <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
              <WalletIcon size={48} className="mx-auto mb-3 opacity-50" />
              <p className="font-medium">No accounts added yet</p>
              <p className="text-sm mt-1">Add your first account to start tracking</p>
            </div>
          )}
        </div>
      </div>

      {/* Attention Required Section */}
      {metrics.accountsNeedingAttention.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircleIcon size={24} className="text-yellow-600 dark:text-yellow-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Needs Your Attention
            </h3>
          </div>
          
          <div className="space-y-3">
            {metrics.accountsNeedingAttention.map(account => (
              <div 
                key={account.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <WalletIcon size={20} className="text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {account.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(account.type === 'current' || account.type === 'checking') && account.balance < 500 && 'Low balance'}
                      {account.type === 'credit' && account.creditLimit && 
                        Math.abs(account.balance) / account.creditLimit > 0.7 && 'High utilization'}
                    </p>
                  </div>
                </div>
                <ChevronRightIcon size={20} className="text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Net Worth Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3Icon size={24} className="text-gray-500" />
          Net Worth Over Time
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {netWorthData.length === 1 
            ? "Current month's net worth (historical data will build up over time)"
            : "Your wealth progression over time"
          }
        </p>
        <div className="h-64">
          {netWorthData.length === 1 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <BarChart3Icon size={48} className="opacity-20 mb-3" />
              <p className="text-lg font-medium mb-2">Current Net Worth</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyWithSymbol(metrics.netWorth, displayCurrency)}
              </p>
              <p className="text-sm mt-3 text-center max-w-md">
                As you continue using WealthTracker, we'll track your net worth over time 
                to show you trends and progress towards your financial goals.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RcBarChart data={netWorthData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value: number) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return String(value);
                }} />
                <Tooltip 
                  contentStyle={chartStyles.tooltip} 
                  formatter={(value: number) => [
                    formatCurrencyWithSymbol(Number(value), displayCurrency),
                    'Net Worth'
                  ]}
                />
                <Bar dataKey="netWorth" fill="#8B5CF6" radius={[4,4,0,0]} />
              </RcBarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Account Distribution Chart */}
      {pieData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChartIcon size={24} className="text-gray-500" />
            Account Distribution
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your top 5 accounts by balance
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RcPieChart>
                <Tooltip 
                  contentStyle={chartStyles.pieTooltip}
                  formatter={(value: number) => [
                    formatCurrencyWithSymbol(Number(value), displayCurrency),
                    ''
                  ]}
                />
                <Pie 
                  data={pieData} 
                  dataKey="value" 
                  nameKey="name" 
                  innerRadius="60%"
                  onClick={(data: { payload?: { id?: string } }) => {
                    if (data?.payload?.id) {
                      navigate(`/transactions?account=${data.payload.id}`);
                    }
                  }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </RcPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CreditCardIcon size={24} className="text-gray-500" />
          Recent Transactions
        </h3>
        <div className="space-y-1 overflow-auto" style={{ maxHeight: '400px' }}>
          {metrics.recentActivity.length > 0 ? (
            metrics.recentActivity.slice(0, 10).map(transaction => (
              <div 
                key={transaction.id} 
                className="flex items-center gap-2 sm:gap-3 py-2 sm:py-1.5 border-b dark:border-gray-700/50 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors rounded px-2 -mx-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-3 flex-1">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-400 w-4 text-center">
                      {transaction.cleared ? 'R' : 'N'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium dark:text-white truncate flex-1">{transaction.description}</p>
                </div>
                <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${
                  transaction.type === 'income' || (transaction.type === 'transfer' && transaction.amount > 0)
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {transaction.type === 'expense' || (transaction.type === 'transfer' && transaction.amount < 0)
                    ? formatCurrencyWithSymbol(-Math.abs(transaction.amount))
                    : `+${formatCurrencyWithSymbol(Math.abs(transaction.amount))}`}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-6">
              No transactions yet
            </p>
          )}
          {metrics.recentActivity.length > 10 && (
            <button 
              onClick={() => navigate(preserveDemoParam('/transactions', location.search))}
              className="w-full mt-4 py-2 text-gray-600 dark:text-gray-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              View All Transactions →
            </button>
          )}
        </div>
      </div>


      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button 
          onClick={() => setShowAddTransactionModal(true)}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center"
        >
          <CreditCardIcon size={24} className="mx-auto mb-2 text-gray-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Add Transaction
          </span>
        </button>
        
        <button 
          onClick={() => navigate(preserveDemoParam('/accounts', location.search))}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center"
        >
          <WalletIcon size={24} className="mx-auto mb-2 text-green-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            View Accounts
          </span>
        </button>
        
        <button 
          onClick={() => navigate(preserveDemoParam('/budget', location.search))}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center"
        >
          <TargetIcon size={24} className="mx-auto mb-2 text-purple-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Set Budget
          </span>
        </button>
        
        <button 
          onClick={() => navigate(preserveDemoParam('/analytics', location.search))}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center"
        >
          <TrendingUpIcon size={24} className="mx-auto mb-2 text-orange-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Analytics
          </span>
        </button>
      </div>
      
      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showAddTransactionModal}
        onClose={() => setShowAddTransactionModal(false)}
      />
    </div>
  );
});
