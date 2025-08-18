import React, { useState, useMemo, useEffect } from 'react';
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
  XIcon
} from '../icons';
import { useApp } from '../../contexts/AppContext';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { formatCurrency } from '../../utils/currency';

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
  const { formatCurrency: formatCurrencyWithSymbol } = useCurrencyDecimal();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  
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
      .filter(acc => acc.type === 'asset')
      .reduce((sum, acc) => sum + acc.balance, 0);
    
    const totalLiabilities = accounts
      .filter(acc => acc.type === 'liability')
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
      // Check for low balances in checking accounts
      if (acc.type === 'asset' && acc.subtype === 'checking' && acc.balance < 500) {
        return true;
      }
      // Check for high credit utilization
      if (acc.type === 'liability' && acc.subtype === 'credit' && acc.creditLimit) {
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
      netWorthChange: netWorth * 0.05, // Placeholder - calculate from historical data
      netWorthChangePercent: 5.2 // Placeholder
    };
  }, [accounts, transactions, budgets]);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };
  
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
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl opacity-90 font-medium">Your Net Worth</h2>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-bold">
                {formatCurrencyWithSymbol(metrics.netWorth)}
              </span>
              {metrics.netWorthChange > 0 ? (
                <span className="flex items-center gap-1 text-green-300 text-sm sm:text-base">
                  <ArrowUpIcon size={16} />
                  +{metrics.netWorthChangePercent.toFixed(1)}%
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-300 text-sm sm:text-base">
                  <ArrowDownIcon size={16} />
                  {metrics.netWorthChangePercent.toFixed(1)}%
                </span>
              )}
            </div>
            <p className="mt-3 opacity-80 text-sm sm:text-base">
              vs last month: {formatCurrencyWithSymbol(metrics.netWorthChange)}
            </p>
          </div>
          <BanknoteIcon size={48} className="opacity-50 hidden sm:block" />
        </div>
        
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/20">
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
      </div>

      {/* Secondary Focus: This Month's Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          This Month's Performance
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Income</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrencyWithSymbol(metrics.monthlyIncome)}
              </p>
            </div>
            <TrendingUpIcon size={24} className="text-green-500" />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Expenses</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatCurrencyWithSymbol(metrics.monthlyExpenses)}
              </p>
            </div>
            <TrendingDownIcon size={24} className="text-red-500" />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Saved</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrencyWithSymbol(metrics.monthlySavings)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {metrics.savingsRate.toFixed(1)}% rate
              </p>
            </div>
            <TargetIcon size={24} className="text-blue-500" />
          </div>
        </div>
      </div>

      {/* Budget Status Section - Shows current budget progress */}
      {metrics.budgetStatus.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6" data-testid="budget-status">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChartIcon size={24} className="text-gray-500" />
            Budget Status
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({metrics.overallBudgetPercent.toFixed(0)}% used)
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
                      budget.percentUsed > 60 ? 'bg-blue-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            
            {metrics.budgetStatus.length > 3 && (
              <button className="w-full mt-2 py-2 text-blue-600 dark:text-blue-400 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                View All Budgets ({metrics.budgetStatus.length}) →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Account Balances Section - Customizable by user */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
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
                  <input
                    type="checkbox"
                    checked={selectedAccountIds.includes(account.id)}
                    onChange={() => toggleAccountSelection(account.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
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
                    account.type === 'liability' 
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
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
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
                      {account.type === 'asset' && account.balance < 500 && 'Low balance'}
                      {account.type === 'liability' && account.creditLimit && 
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

      {/* Recent Activity - Collapsible */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <button
          onClick={() => toggleSection('activity')}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-3">
            <CreditCardIcon size={24} className="text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({metrics.recentActivity.length} transactions)
            </span>
          </div>
          <ChevronRightIcon 
            size={20} 
            className={`text-gray-400 transition-transform ${
              expandedSection === 'activity' ? 'rotate-90' : ''
            }`}
          />
        </button>
        
        {expandedSection === 'activity' && (
          <div className="px-6 pb-6 space-y-2">
            {metrics.recentActivity.map(transaction => (
              <div 
                key={transaction.id}
                className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {transaction.description}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(transaction.date).toLocaleDateString()}
                  </p>
                </div>
                <p className={`font-semibold ${
                  transaction.type === 'income' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrencyWithSymbol(Math.abs(transaction.amount))}
                </p>
              </div>
            ))}
            
            <button className="w-full mt-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
              View All Transactions →
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center">
          <CreditCardIcon size={24} className="mx-auto mb-2 text-blue-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Add Transaction
          </span>
        </button>
        
        <button className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center">
          <WalletIcon size={24} className="mx-auto mb-2 text-green-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            View Accounts
          </span>
        </button>
        
        <button className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center">
          <TargetIcon size={24} className="mx-auto mb-2 text-purple-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Set Budget
          </span>
        </button>
        
        <button className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow text-center">
          <TrendingUpIcon size={24} className="mx-auto mb-2 text-orange-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Analytics
          </span>
        </button>
      </div>
    </div>
  );
}