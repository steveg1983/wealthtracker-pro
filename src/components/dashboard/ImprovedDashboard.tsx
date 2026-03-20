import React, { useState, useMemo, useEffect } from 'react';
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
  XIcon,
  BarChart3Icon,
  CheckIcon
} from '../icons';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { preserveDemoParam } from '../../utils/navigation';
import AddTransactionModal from '../AddTransactionModal';
import { Modal, ModalBody } from '../common/Modal';
import { PieChart, BarChart, ResponsiveContainer } from '../charts/ChartJsCharts';
import { formatDecimal } from '../../utils/decimal-format';

/**
 * Improved Dashboard with better information hierarchy
 * Design principles:
 * 1. Progressive disclosure - show most important info first
 * 2. Visual hierarchy - use size, color, and spacing
 * 3. Actionable insights - every section leads somewhere
 * 4. Mobile-optimized - works great on all screen sizes
 */
export function ImprovedDashboard() {
  const { accounts, transactions, budgets } = useApp();
  const { formatCurrency: formatCurrencyWithSymbol, displayCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [breakdownType, setBreakdownType] = useState<'income' | 'expense' | null>(null);
  
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
    // Compute real balance from openingBalance + sum of transactions per account
    const effectiveBalance = (acc: typeof accounts[0]) => {
      const opening = acc.openingBalance ?? 0;
      const txnTotal = transactions
        .filter(t => t.accountId === acc.id)
        .reduce((sum, t) => sum + t.amount, 0);
      return opening + txnTotal;
    };

    const totalAssets = accounts
      .filter(acc => effectiveBalance(acc) > 0)
      .reduce((sum, acc) => sum + effectiveBalance(acc), 0);

    const totalLiabilities = accounts
      .filter(acc => effectiveBalance(acc) < 0)
      .reduce((sum, acc) => sum + Math.abs(effectiveBalance(acc)), 0);

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
    
    // Identify accounts needing attention (only when user has enabled alerts)
    const accountsNeedingAttention = accounts.filter(acc => {
      const bal = effectiveBalance(acc);
      // Per-account low balance alert
      if (acc.lowBalanceAlertEnabled && acc.lowBalanceThreshold != null && bal < acc.lowBalanceThreshold) {
        return true;
      }
      // Check for high credit utilization
      if (acc.type === 'credit' && acc.creditLimit) {
        const utilization = Math.abs(bal) / acc.creditLimit;
        return utilization > 0.7;
      }
      return false;
    });
    
    // Calculate budget status for active budgets
    const activeBudgets = budgets.filter(b => b.isActive);
    
    const budgetStatus = activeBudgets.map(budget => {
      const categoryTransactions = recentTransactions.filter(t => 
        t.category === budget.categoryId && t.type === 'expense'
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
  
  // Pre-compute real balances per account (openingBalance + sum of transactions)
  const accountBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach(acc => {
      const opening = acc.openingBalance ?? 0;
      const txnTotal = transactions
        .filter(t => t.accountId === acc.id)
        .reduce((sum, t) => sum + t.amount, 0);
      map.set(acc.id, opening + txnTotal);
    });
    return map;
  }, [accounts, transactions]);

  const getAccountBalance = (acc: typeof accounts[0]) => accountBalanceMap.get(acc.id) ?? 0;

  // Generate pie chart data for account distribution
  interface AccountDistributionDatum {
    id: string;
    name: string;
    value: number;
  }

  const pieData = useMemo<AccountDistributionDatum[]>(() => {
    return accounts
      .filter(acc => getAccountBalance(acc) > 0)
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        value: getAccountBalance(acc)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 accounts
  }, [accounts, getAccountBalance]);
  
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
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* Primary Focus: Net Worth Hero Card */}
      <section 
        aria-labelledby="net-worth-heading"
        className="bg-[#6b7d98] rounded-2xl p-6 sm:p-8 text-white shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 id="net-worth-heading" className="text-lg sm:text-xl opacity-90 font-medium">Your Net Worth</h2>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-bold">
                {formatCurrencyWithSymbol(metrics.netWorth)}
              </span>
              {/* Only show change when we have historical data */}
              {metrics.netWorthChange !== 0 && (
                metrics.netWorthChange > 0 ? (
                  <span className="flex items-center gap-1 text-green-300 text-sm sm:text-base">
                    <ArrowUpIcon size={16} />
                    +{formatDecimal(metrics.netWorthChangePercent, 1)}%
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-300 text-sm sm:text-base">
                    <ArrowDownIcon size={16} />
                    {formatDecimal(metrics.netWorthChangePercent, 1)}%
                  </span>
                )
              )}
            </div>
            {metrics.netWorthChange !== 0 && (
              <p className="mt-3 opacity-80 text-sm sm:text-base">
                vs last month: {formatCurrencyWithSymbol(metrics.netWorthChange)}
              </p>
            )}
          </div>
          <BanknoteIcon size={48} className="opacity-50 hidden sm:block" />
        </div>
        
        {/* Quick stats */}
        <div 
          data-testid="dashboard-grid" 
          className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/20"
          role="group"
          aria-label="Assets and liabilities summary"
        >
          <div>
            <p className="text-sm opacity-70">Assets</p>
            <p className="text-xl font-semibold text-green-300">
              {formatCurrencyWithSymbol(metrics.totalAssets)}
            </p>
          </div>
          <div>
            <p className="text-sm opacity-70">Liabilities</p>
            <p className="text-xl font-semibold text-red-300">
              {formatCurrencyWithSymbol(metrics.totalLiabilities)}
            </p>
          </div>
        </div>
      </section>

      {/* Secondary Focus: This Month's Performance */}
      <section 
        aria-labelledby="monthly-performance-heading"
        className="bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-lg p-6"
      >
        <h3 id="monthly-performance-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          This Month's Performance
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setBreakdownType('income')}
            className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer text-left"
          >
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Income</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrencyWithSymbol(metrics.monthlyIncome)}
              </p>
            </div>
            <TrendingUpIcon size={24} className="text-green-500" />
          </button>

          <button
            type="button"
            onClick={() => setBreakdownType('expense')}
            className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer text-left"
          >
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Expenses</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatCurrencyWithSymbol(metrics.monthlyExpenses)}
              </p>
            </div>
            <TrendingDownIcon size={24} className="text-red-500" />
          </button>
        </div>
      </section>

      {/* Income/Expense Breakdown Modal */}
      <Modal
        isOpen={breakdownType !== null}
        onClose={() => setBreakdownType(null)}
        title={`${breakdownType === 'income' ? 'Income' : 'Expenses'} This Month`}
        size="md"
      >
        <ModalBody>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left pb-2 font-medium">Date</th>
                <th className="text-left pb-2 font-medium">Description</th>
                <th className="text-right pb-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const monthlyTxns = transactions
                  .filter(t => new Date(t.date) >= thirtyDaysAgo && t.type === breakdownType)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (monthlyTxns.length === 0) {
                  return <tr><td colSpan={3} className="text-center py-8 text-gray-400">No {breakdownType} transactions this month</td></tr>;
                }

                return monthlyTxns.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-2 text-sm text-gray-900 dark:text-white">
                      {t.description}
                    </td>
                    <td className={`py-2 text-sm font-medium text-right whitespace-nowrap ${
                      breakdownType === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrencyWithSymbol(Math.abs(t.amount))}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                <td colSpan={2} className="pt-3 text-sm font-semibold text-gray-900 dark:text-white">Total</td>
                <td className={`pt-3 text-sm font-bold text-right ${
                  breakdownType === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrencyWithSymbol(breakdownType === 'income' ? metrics.monthlyIncome : metrics.monthlyExpenses)}
                </td>
              </tr>
            </tfoot>
          </table>
        </ModalBody>
      </Modal>

      {/* Budget Status Section - Shows current budget progress */}
      {metrics.budgetStatus.length > 0 && (
        <section 
          aria-labelledby="budget-status-heading"
          className="bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-lg p-6" 
          data-testid="budget-status"
        >
          <h3 id="budget-status-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChartIcon size={24} className="text-gray-500" />
            Budget Status
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({formatDecimal(metrics.overallBudgetPercent, 0)}% used)
            </span>
          </h3>
          
          <div className="space-y-3">
            {metrics.budgetStatus.slice(0, 3).map(budget => (
              <div key={budget.id} className="space-y-2" role="group" aria-label={`Budget for ${budget.categoryId}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {budget.categoryId}
                  </span>
                  <span className={`font-medium ${
                    budget.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {formatCurrencyWithSymbol(budget.spent)} / {formatCurrencyWithSymbol(budget.amount)}
                  </span>
                </div>
                <div 
                  className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.min(budget.percentUsed, 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${budget.categoryId} budget: ${Math.min(budget.percentUsed, 100).toFixed(0)}% used`}
                >
                  <div 
                    className={`h-full transition-all duration-300 ${
                      budget.percentUsed > 100 ? 'bg-red-500' :
                      budget.percentUsed > 80 ? 'bg-yellow-500' :
                      budget.percentUsed > 60 ? 'bg-blue-500' :
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
                className="w-full mt-2 py-2 text-blue-600 dark:text-blue-400 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                View All Budgets ({metrics.budgetStatus.length}) →
              </button>
            )}
          </div>
        </section>
      )}

      {/* Account Balances Section - Customizable by user */}
      <section 
        aria-labelledby="key-accounts-heading"
        className="bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-lg p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="key-accounts-heading" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
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
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Customize displayed accounts"
            aria-expanded={showAccountSettings}
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
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close account settings"
              >
                <XIcon size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {accounts.map(account => {
                const isSelected = selectedAccountIds.includes(account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggleAccountSelection(account.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-550'
                    }`}
                    aria-pressed={isSelected ? 'true' : 'false'}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 dark:border-gray-400'
                    }`}>
                      {isSelected && <CheckIcon size={12} />}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {account.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto whitespace-nowrap">
                      {formatCurrencyWithSymbol(getAccountBalance(account))}
                    </span>
                  </button>
                );
              })}
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
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                data-testid="account-balance-card"
                onClick={() => navigate(preserveDemoParam(`/accounts/${account.id}`, location.search))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(preserveDemoParam(`/accounts/${account.id}`, location.search));
                  }
                }}
                aria-label={`View ${account.name} account details. Balance: ${formatCurrencyWithSymbol(getAccountBalance(account))}`}
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
                    (getAccountBalance(account)) < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {formatCurrencyWithSymbol(getAccountBalance(account))}
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
            <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400" role="status" aria-live="polite">
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
      </section>

      {/* Attention Required Section */}
      {metrics.accountsNeedingAttention.length > 0 && (
        <section 
          aria-labelledby="attention-heading"
          className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertCircleIcon size={24} className="text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
            <h3 id="attention-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
              Needs Your Attention
            </h3>
          </div>
          
          <div className="space-y-3">
            {metrics.accountsNeedingAttention.map(account => (
              <div 
                key={account.id}
                className="flex items-center justify-between p-3 bg-card-bg-light dark:bg-card-bg-dark rounded-lg cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                role="button"
                tabIndex={0}
                onClick={() => navigate(preserveDemoParam(`/accounts/${account.id}`, location.search))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(preserveDemoParam(`/accounts/${account.id}`, location.search));
                  }
                }}
                aria-label={`${account.name} needs attention: ${(account.type === 'current' || account.type === 'checking') && account.balance < 500 ? 'Low balance' : 'High utilization'}`}
              >
                <div className="flex items-center gap-3">
                  <WalletIcon size={20} className="text-gray-500" aria-hidden="true" />
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
                <ChevronRightIcon size={20} className="text-gray-400" aria-hidden="true" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Net Worth Chart - only show when there's historical data */}
      {netWorthData.length > 1 && (
        <section
          aria-labelledby="net-worth-chart-heading"
          className="bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-lg p-6"
        >
          <h3 id="net-worth-chart-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3Icon size={24} className="text-gray-500" aria-hidden="true" />
            Net Worth Over Time
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your wealth progression over time
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={netWorthData}
                dataKey="netWorth"
                fill="#8B5CF6"
                label="Net Worth"
                formatter={(value: number) => formatCurrencyWithSymbol(value, displayCurrency)}
                contentStyle={chartStyles.tooltip}
                tickFormatter={(value: number) => {
                  if (value >= 1000000) return `${formatDecimal(value / 1000000, 1)}M`;
                  if (value >= 1000) return `${formatDecimal(value / 1000, 0)}K`;
                  return formatDecimal(value, 0);
                }}
                aria-label="Bar chart showing net worth over time"
              />
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Account Distribution Chart */}
      {pieData.length > 0 && (
        <section 
          aria-labelledby="account-distribution-heading"
          className="bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-lg p-6"
        >
          <h3 id="account-distribution-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChartIcon size={24} className="text-gray-500" aria-hidden="true" />
            Account Distribution
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your top 5 accounts by balance
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    data={pieData}
                    innerRadius={true}
                    colors={COLORS}
                    onClick={(clickedData: AccountDistributionDatum) => {
                      navigate(`/transactions?account=${clickedData.id}`);
                    }}
                formatter={(value: number) => formatCurrencyWithSymbol(value, displayCurrency)}
                contentStyle={chartStyles.pieTooltip}
                aria-label="Pie chart showing distribution of account balances"
              />
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Recent Transactions Table */}
      <section 
        aria-labelledby="recent-transactions-heading"
        className="bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-lg p-6"
      >
        <h3 id="recent-transactions-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CreditCardIcon size={24} className="text-gray-500" aria-hidden="true" />
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
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap w-12">
                      {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
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
              className="w-full mt-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="View all transactions"
            >
              View All Transactions →
            </button>
          )}
        </div>
      </section>


      {/* Quick Actions */}
      <nav aria-label="Quick actions" className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <button
          onClick={() => setShowAddTransactionModal(true)}
          className="p-8 bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-md hover:shadow-xl transition-all text-center min-h-[140px] flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Add a new transaction"
        >
          <CreditCardIcon size={32} className="mx-auto mb-3 text-blue-600" aria-hidden="true" />
          <span className="text-base font-semibold text-gray-900 dark:text-white">
            Add Transaction
          </span>
        </button>

        <button
          onClick={() => navigate(preserveDemoParam('/accounts', location.search))}
          className="p-8 bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-md hover:shadow-xl transition-all text-center min-h-[140px] flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="View all accounts"
        >
          <WalletIcon size={32} className="mx-auto mb-3 text-green-600" aria-hidden="true" />
          <span className="text-base font-semibold text-gray-900 dark:text-white">
            View Accounts
          </span>
        </button>

        <button
          onClick={() => navigate(preserveDemoParam('/budget', location.search))}
          className="p-8 bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-md hover:shadow-xl transition-all text-center min-h-[140px] flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Set up or view budgets"
        >
          <TargetIcon size={32} className="mx-auto mb-3 text-purple-600" aria-hidden="true" />
          <span className="text-base font-semibold text-gray-900 dark:text-white">
            Set Budget
          </span>
        </button>

        <button
          onClick={() => navigate(preserveDemoParam('/analytics', location.search))}
          className="p-8 bg-card-bg-light dark:bg-card-bg-dark rounded-xl shadow-md hover:shadow-xl transition-all text-center min-h-[140px] flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="View financial analytics"
        >
          <TrendingUpIcon size={32} className="mx-auto mb-3 text-orange-600" aria-hidden="true" />
          <span className="text-base font-semibold text-gray-900 dark:text-white">
            Analytics
          </span>
        </button>
      </nav>
      
      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showAddTransactionModal}
        onClose={() => setShowAddTransactionModal(false)}
      />
    </div>
  );
}
