import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { financialSummaryService, type SummaryData } from '../services/financialSummaryService';
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, PieChartIcon, TargetIcon } from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { format } from 'date-fns';

interface FinancialSummaryProps {
  period: 'weekly' | 'monthly';
}

export default function FinancialSummary({ period }: FinancialSummaryProps) {
  const { transactions, accounts, budgets, goals } = useApp();
  const { formatCurrency, getCurrencySymbol, displayCurrency } = useCurrencyDecimal();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Generate summary
    const summaryData = period === 'weekly'
      ? financialSummaryService.generateWeeklySummary(transactions, accounts, budgets, goals)
      : financialSummaryService.generateMonthlySummary(transactions, accounts, budgets, goals);
    
    setSummary(summaryData);
  }, [transactions, accounts, budgets, goals, period]);

  if (!summary) return null;

  const isPositiveChange = (value: number) => value >= 0;
  const formatChange = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {period === 'weekly' ? 'Weekly' : 'Monthly'} Summary
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
            <CalendarIcon size={14} />
            {format(summary.startDate, 'MMM d')} - {format(summary.endDate, 'MMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Income */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Income</p>
            {summary.comparison.incomeChange !== 0 && (
              <span className={`text-xs flex items-center gap-1 ${
                isPositiveChange(summary.comparison.incomeChange)
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {isPositiveChange(summary.comparison.incomeChange) ? (
                  <TrendingUpIcon size={12} />
                ) : (
                  <TrendingDownIcon size={12} />
                )}
                {formatChange(summary.comparison.incomeChange)}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(summary.totalIncome)}
          </p>
        </div>

        {/* Expenses */}
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Expenses</p>
            {summary.comparison.expenseChange !== 0 && (
              <span className={`text-xs flex items-center gap-1 ${
                !isPositiveChange(summary.comparison.expenseChange)
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {isPositiveChange(summary.comparison.expenseChange) ? (
                  <TrendingUpIcon size={12} />
                ) : (
                  <TrendingDownIcon size={12} />
                )}
                {formatChange(summary.comparison.expenseChange)}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(summary.totalExpenses)}
          </p>
        </div>

        {/* Net Income */}
        <div className={`rounded-xl p-4 ${
          summary.netIncome.greaterThanOrEqualTo(0)
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-orange-50 dark:bg-orange-900/20'
        }`}>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Net Income</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(summary.netIncome)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {summary.savingsRate.toFixed(1)}% savings rate
          </p>
        </div>
      </div>

      {/* Details Section */}
      {showDetails && (
        <div className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          {/* Top Categories */}
          {summary.topCategories.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <PieChartIcon size={16} />
                Top Spending Categories
              </h4>
              <div className="space-y-2">
                {summary.topCategories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {category.category}
                      </span>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${category.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white ml-3">
                      {formatCurrency(category.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget Alerts */}
          {summary.budgetPerformance.filter(b => b.percentage > 80).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Budget Status
              </h4>
              <div className="space-y-2">
                {summary.budgetPerformance
                  .filter(b => b.percentage > 80)
                  .map((budget, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {budget.budgetName}
                      </span>
                      <span className={`text-sm font-medium ${
                        budget.percentage > 100
                          ? 'text-red-600 dark:text-red-400'
                          : budget.percentage > 90
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
                        <span className="text-xs ml-1">({budget.percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Goal Progress */}
          {summary.goalProgress.filter(g => g.amountAdded.greaterThan(0)).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <TargetIcon size={16} />
                Goal Progress
              </h4>
              <div className="space-y-2">
                {summary.goalProgress
                  .filter(g => g.amountAdded.greaterThan(0))
                  .map((goal, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {goal.goalName}
                      </span>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        +{formatCurrency(goal.amountAdded)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Unusual Transactions */}
          {summary.unusualTransactions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Notable Transactions
              </h4>
              <div className="space-y-2">
                {summary.unusualTransactions.map((transaction, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      {transaction.description}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            const summaryText = financialSummaryService.formatSummaryText(summary, getCurrencySymbol(displayCurrency));
            navigator.clipboard.writeText(summaryText);
            // Could add a toast notification here
          }}
          className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
        >
          Copy Summary
        </button>
        <button
          onClick={() => {
            // Save summary
            financialSummaryService.saveSummary(summary);
            // Could add a toast notification here
          }}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Save to History
        </button>
      </div>
    </div>
  );
}