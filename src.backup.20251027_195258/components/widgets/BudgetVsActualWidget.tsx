import React, { useMemo, useState } from 'react';
import { Decimal } from '@wealthtracker/utils';
import { ProfessionalIcon } from '../icons/ProfessionalIcons';
import type { Budget, Transaction } from '../../types';

interface BudgetVsActualWidgetProps {
  budgets: Budget[];
  transactions: Transaction[];
  formatCurrency: (value: number) => string;
  navigate: (path: string) => void;
  settings?: {
    showVariance?: boolean;
    period?: 'current' | 'last' | 'year';
  };
}

interface BudgetComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentUsed: number;
  isOverBudget: boolean;
  remaining: number;
}

type ViewMode = 'summary' | 'detailed';

export default function BudgetVsActualWidget({
  budgets,
  transactions,
  formatCurrency,
  navigate,
  settings = { showVariance: true, period: 'current' }
}: BudgetVsActualWidgetProps): React.JSX.Element {

  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const formatPercentage = (value: number, decimals: number = 0): string =>
    `${new Decimal(value ?? 0).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber()}%`;
  const clampPercentage = (value: number): number =>
    Decimal.min(new Decimal(100), Decimal.max(new Decimal(0), new Decimal(value ?? 0))).toNumber();
  
  // Calculate period dates
  const periodDates = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (settings.period) {
      case 'last':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'current':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
    }
    
    return { startDate, endDate };
  }, [settings.period]);
  
  // Calculate budget vs actual for each category
  const budgetComparisons = useMemo(() => {
    const activeBudgets = budgets.filter(b => b.isActive);
    const comparisons: BudgetComparison[] = [];
    
    activeBudgets.forEach(budget => {
      // Filter transactions for this budget's category and period
      const categoryTransactions = transactions.filter(t => {
        const transDate = new Date(t.date);
        return t.category === budget.categoryId &&
               t.type === 'expense' &&
               transDate >= periodDates.startDate &&
               transDate <= periodDates.endDate;
      });
      
      const actual = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const variance = budget.amount - actual;
      const percentUsed = budget.amount > 0 ? (actual / budget.amount) * 100 : 0;
      
      comparisons.push({
        category: budget.categoryId,
        budgeted: budget.amount,
        actual,
        variance,
        percentUsed,
        isOverBudget: actual > budget.amount,
        remaining: Math.max(0, variance)
      });
    });
    
    // Sort by variance (most over budget first)
    return comparisons.sort((a, b) => a.variance - b.variance);
  }, [budgets, transactions, periodDates]);
  
  // Calculate totals
  const totals = useMemo(() => {
    const totalBudgeted = budgetComparisons.reduce((sum, b) => sum + b.budgeted, 0);
    const totalActual = budgetComparisons.reduce((sum, b) => sum + b.actual, 0);
    const totalVariance = totalBudgeted - totalActual;
    const percentUsed = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;
    
    return {
      budgeted: totalBudgeted,
      actual: totalActual,
      variance: totalVariance,
      percentUsed,
      isOverBudget: totalActual > totalBudgeted
    };
  }, [budgetComparisons]);

  const overBudgetCategories = budgetComparisons.filter(b => b.isOverBudget);

  if (budgetComparisons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <ProfessionalIcon name="chartBar" size={32} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Active Budgets
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Create budgets to track spending by category
        </p>
        <button
          onClick={() => navigate('/budget')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Create Budget
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Budget vs Actual
        </h3>
        <div className="flex items-center space-x-2">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800"
          >
            <option value="summary">Summary</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
      </div>
      
      {/* Overall Summary */}
      <div className={`rounded-lg p-4 ${
        totals.isOverBudget 
          ? 'bg-red-50 dark:bg-red-900/20' 
          : totals.percentUsed > 80
            ? 'bg-yellow-50 dark:bg-yellow-900/20'
            : 'bg-green-50 dark:bg-green-900/20'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Overall Budget Status
          </span>
          <span className={`text-lg font-bold ${
            totals.isOverBudget 
              ? 'text-red-600 dark:text-red-400' 
              : totals.percentUsed > 80
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-green-600 dark:text-green-400'
          }`}>
            {formatPercentage(totals.percentUsed)} Used
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
          <div 
            className={`h-3 rounded-full transition-all ${
              totals.isOverBudget 
                ? 'bg-red-500' 
                : totals.percentUsed > 80
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${clampPercentage(totals.percentUsed)}%` }}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Budgeted</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(totals.budgeted)}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Actual</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(totals.actual)}
            </p>
          </div>
          {settings.showVariance && (
            <div>
              <p className="text-gray-600 dark:text-gray-400">Variance</p>
              <p className={`font-semibold ${
                totals.variance >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Alert Section */}
      {overBudgetCategories.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="flex items-center">
            <ProfessionalIcon name="warning" size={20} className="text-red-600 dark:text-red-400 mr-2" />
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {overBudgetCategories.length} categor{overBudgetCategories.length === 1 ? 'y is' : 'ies are'} over budget
            </p>
          </div>
        </div>
      )}
      
      {/* Category List */}
      {viewMode === 'summary' ? (
        <div className="space-y-2">
          {budgetComparisons.slice(0, 5).map(comparison => (
            <div 
              key={comparison.category}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/budget?category=${encodeURIComponent(comparison.category)}`)}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {comparison.category}
                </h4>
                <div className="flex items-center">
                  {comparison.isOverBudget ? (
                    <ProfessionalIcon name="arrowUp" size={16} className="text-red-500 mr-1" />
                  ) : comparison.percentUsed < 50 ? (
                    <ProfessionalIcon name="success" size={16} className="text-green-500 mr-1" />
                  ) : null}
                  <span className={`text-sm font-semibold ${
                    comparison.isOverBudget 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                  {formatPercentage(comparison.percentUsed)}
                  </span>
                </div>
              </div>
              
              {/* Progress Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        comparison.isOverBudget 
                          ? 'bg-red-500' 
                          : comparison.percentUsed > 90
                            ? 'bg-yellow-500'
                            : 'bg-gray-500'
                      }`}
                      style={{ width: `${clampPercentage(comparison.percentUsed)}%` }}
                    />
                  </div>
              
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatCurrency(comparison.actual)} spent</span>
                <span>{formatCurrency(comparison.budgeted)} budget</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Detailed View - Table Format
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-2 text-gray-600 dark:text-gray-400">Category</th>
                <th className="text-right py-2 text-gray-600 dark:text-gray-400">Budget</th>
                <th className="text-right py-2 text-gray-600 dark:text-gray-400">Actual</th>
                {settings.showVariance && (
                  <th className="text-right py-2 text-gray-600 dark:text-gray-400">Variance</th>
                )}
                <th className="text-right py-2 text-gray-600 dark:text-gray-400">%</th>
              </tr>
            </thead>
            <tbody>
              {budgetComparisons.map(comparison => (
                <tr 
                  key={comparison.category}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => navigate(`/budget?category=${encodeURIComponent(comparison.category)}`)}
                >
                  <td className="py-2 font-medium text-gray-900 dark:text-white">
                    {comparison.category}
                  </td>
                  <td className="text-right py-2 text-gray-600 dark:text-gray-400">
                    {formatCurrency(comparison.budgeted)}
                  </td>
                  <td className="text-right py-2 text-gray-900 dark:text-white">
                    {formatCurrency(comparison.actual)}
                  </td>
                  {settings.showVariance && (
                    <td className={`text-right py-2 ${
                      comparison.variance >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {comparison.variance >= 0 ? '+' : ''}{formatCurrency(comparison.variance)}
                    </td>
                  )}
                  <td className={`text-right py-2 font-semibold ${
                    comparison.isOverBudget 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                  {formatPercentage(comparison.percentUsed)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* View All Link */}
      {budgetComparisons.length > 5 && viewMode === 'summary' && (
        <button
          onClick={() => navigate('/budget')}
          className="w-full text-center text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 font-medium"
        >
          View all {budgetComparisons.length} budget categories →
        </button>
      )}
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate('/budget')}
          className="px-3 py-2 bg-blue-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-500 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          Edit Budgets
        </button>
        <button
          onClick={() => navigate('/reports?type=budget')}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          Budget Report
        </button>
      </div>
    </div>
  );
}
