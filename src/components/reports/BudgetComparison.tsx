import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import Decimal from 'decimal.js';
import { formatCurrency } from '../../utils/formatters';

interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'over' | 'under' | 'on-track' | 'warning';
  transactions: number;
}

interface BudgetComparisonProps {
  dateRange?: 'week' | 'month' | 'quarter' | 'year';
  onExport?: (data: CategoryComparison[]) => void;
}

export default function BudgetComparison({ 
  dateRange = 'month',
  onExport 
}: BudgetComparisonProps): React.JSX.Element {
  const { budgets, transactions, categories } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState(dateRange);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showOnlyOverBudget, setShowOnlyOverBudget] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'variance' | 'percent'>('variance');

  // Calculate date range
  const dateRangeFilter = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    
    switch (selectedPeriod) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return { startDate, endDate: now };
  }, [selectedPeriod]);

  // Calculate budget vs actual for each category
  const categoryComparisons = useMemo(() => {
    const comparisons: CategoryComparison[] = [];
    
    // Get active budgets
    const activeBudgets = budgets.filter(b => b.isActive);
    
    // Group transactions by category within date range
    const transactionsByCategory = transactions
      .filter(t => {
        const transDate = new Date(t.date);
        return transDate >= dateRangeFilter.startDate && 
               transDate <= dateRangeFilter.endDate &&
               t.type === 'expense';
      })
      .reduce((acc, t) => {
        const categoryId = t.category || t.category || 'uncategorized';
        if (!acc[categoryId]) {
          acc[categoryId] = {
            total: new Decimal(0),
            transactions: []
          };
        }
        acc[categoryId].total = acc[categoryId].total.plus(t.amount);
        acc[categoryId].transactions.push(t);
        return acc;
      }, {} as Record<string, { total: InstanceType<typeof Decimal>; transactions: any[] }>);

    // Process each budget
    activeBudgets.forEach(budget => {
      const categoryId = budget.categoryId || budget.name || 'unknown';
      const category = categories.find(c => c.id === categoryId);
      const categoryName = category?.name || budget.name || 'Uncategorized';
      
      // Calculate budgeted amount based on period and selected range
      let budgetedAmount = new Decimal(budget.amount || 0);
      
      // Adjust budget amount based on period
      if (budget.period === 'weekly') {
        switch (selectedPeriod) {
          case 'week':
            // Use as is
            break;
          case 'month':
            budgetedAmount = budgetedAmount.times(4.33); // Average weeks per month
            break;
          case 'quarter':
            budgetedAmount = budgetedAmount.times(13); // Weeks per quarter
            break;
          case 'year':
            budgetedAmount = budgetedAmount.times(52); // Weeks per year
            break;
        }
      } else if (budget.period === 'monthly') {
        switch (selectedPeriod) {
          case 'week':
            budgetedAmount = budgetedAmount.div(4.33);
            break;
          case 'month':
            // Use as is
            break;
          case 'quarter':
            budgetedAmount = budgetedAmount.times(3);
            break;
          case 'year':
            budgetedAmount = budgetedAmount.times(12);
            break;
        }
      } else if (budget.period === 'yearly') {
        switch (selectedPeriod) {
          case 'week':
            budgetedAmount = budgetedAmount.div(52);
            break;
          case 'month':
            budgetedAmount = budgetedAmount.div(12);
            break;
          case 'quarter':
            budgetedAmount = budgetedAmount.div(4);
            break;
          case 'year':
            // Use as is
            break;
        }
      }
      
      const actualSpending = transactionsByCategory[categoryId]?.total || new Decimal(0);
      const variance = budgetedAmount.minus(actualSpending);
      const variancePercent = budgetedAmount.gt(0) 
        ? variance.div(budgetedAmount).times(100).toNumber()
        : 0;
      
      // Determine status
      let status: CategoryComparison['status'];
      if (actualSpending.gt(budgetedAmount)) {
        status = 'over';
      } else if (actualSpending.gte(budgetedAmount.times(0.9))) {
        status = 'warning';
      } else if (actualSpending.gte(budgetedAmount.times(0.7))) {
        status = 'on-track';
      } else {
        status = 'under';
      }
      
      comparisons.push({
        categoryId,
        categoryName,
        budgeted: budgetedAmount.toNumber(),
        actual: actualSpending.toNumber(),
        variance: variance.toNumber(),
        variancePercent,
        status,
        transactions: transactionsByCategory[categoryId]?.transactions.length || 0
      });
    });
    
    // Add categories with spending but no budget
    Object.entries(transactionsByCategory).forEach(([categoryId, data]) => {
      if (!activeBudgets.find(b => (b.categoryId || b.name) === categoryId)) {
        const category = categories.find(c => c.id === categoryId);
        const categoryName = category?.name || categoryId;
        
        comparisons.push({
          categoryId,
          categoryName,
          budgeted: 0,
          actual: data.total.toNumber(),
          variance: -data.total.toNumber(),
          variancePercent: -100,
          status: 'over',
          transactions: data.transactions.length
        });
      }
    });
    
    // Sort comparisons
    comparisons.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.categoryName.localeCompare(b.categoryName);
        case 'percent':
          return Math.abs(b.variancePercent) - Math.abs(a.variancePercent);
        case 'variance':
        default:
          return Math.abs(b.variance) - Math.abs(a.variance);
      }
    });
    
    // Filter if needed
    if (showOnlyOverBudget) {
      return comparisons.filter(c => c.status === 'over' || c.status === 'warning');
    }
    
    return comparisons;
  }, [budgets, transactions, categories, dateRangeFilter, sortBy, showOnlyOverBudget, selectedPeriod]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalBudgeted = categoryComparisons.reduce((sum, c) => sum + c.budgeted, 0);
    const totalActual = categoryComparisons.reduce((sum, c) => sum + c.actual, 0);
    const totalVariance = totalBudgeted - totalActual;
    const totalVariancePercent = totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0;
    
    return {
      budgeted: totalBudgeted,
      actual: totalActual,
      variance: totalVariance,
      variancePercent: totalVariancePercent,
      overBudgetCategories: categoryComparisons.filter(c => c.status === 'over').length,
      warningCategories: categoryComparisons.filter(c => c.status === 'warning').length,
      onTrackCategories: categoryComparisons.filter(c => c.status === 'on-track').length,
      underBudgetCategories: categoryComparisons.filter(c => c.status === 'under').length
    };
  }, [categoryComparisons]);

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getStatusColor = (status: CategoryComparison['status']) => {
    switch (status) {
      case 'over':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'on-track':
        return 'text-gray-600 dark:text-gray-500';
      case 'under':
        return 'text-green-600 dark:text-green-400';
    }
  };

  const getStatusIcon = (status: CategoryComparison['status']) => {
    switch (status) {
      case 'over':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      case 'on-track':
      case 'under':
        return <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />;
    }
  };

  const getProgressBarColor = (percent: number) => {
    if (percent > 100) return 'bg-red-600 dark:bg-red-400';
    if (percent > 90) return 'bg-yellow-600 dark:bg-yellow-400';
    if (percent > 70) return 'bg-gray-600 dark:bg-blue-400';
    return 'bg-green-600 dark:bg-green-400';
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ChartBarIcon className="h-6 w-6" />
              Budget vs Actual Comparison
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track your spending against budgeted amounts
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-gray-500" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
              >
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="quarter">Last Quarter</option>
                <option value="year">Last Year</option>
              </select>
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
              >
                <option value="variance">Sort by Variance</option>
                <option value="percent">Sort by Percent</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowOnlyOverBudget(!showOnlyOverBudget)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                showOnlyOverBudget
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {showOnlyOverBudget ? 'Showing Over Budget' : 'Show All'}
            </button>

            {/* Export Button */}
            {onExport && (
              <button
                onClick={() => onExport(categoryComparisons)}
                className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Export Data
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Budgeted</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totals.budgeted)}
              </p>
            </div>
            <ChartBarIcon className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totals.actual)}
              </p>
            </div>
            {totals.actual > totals.budgeted ? (
              <ArrowTrendingUpIcon className="h-8 w-8 text-red-500" />
            ) : (
              <ArrowTrendingDownIcon className="h-8 w-8 text-green-500" />
            )}
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Variance</p>
              <p className={`text-xl font-bold ${
                totals.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
              </p>
            </div>
            <span className={`text-sm font-medium px-2 py-1 rounded-full ${
              totals.variance >= 0 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {Math.abs(totals.variancePercent).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Category Status</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-red-600 dark:text-red-400">Over Budget</span>
              <span className="font-medium">{totals.overBudgetCategories}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-yellow-600 dark:text-yellow-400">Warning</span>
              <span className="font-medium">{totals.warningCategories}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-green-600 dark:text-green-400">On Track</span>
              <span className="font-medium">{totals.onTrackCategories + totals.underBudgetCategories}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Category Breakdown
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {categoryComparisons.map((category) => {
            const spentPercent = category.budgeted > 0 
              ? (category.actual / category.budgeted) * 100 
              : 100;
            const isExpanded = expandedCategories.has(category.categoryId);
            
            return (
              <div key={category.categoryId}>
                <div 
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => toggleCategoryExpansion(category.categoryId)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <button className="p-1">
                        {isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      {getStatusIcon(category.status)}
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {category.categoryName}
                      </h4>
                      {category.transactions > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({category.transactions} transactions)
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatCurrency(category.actual)} / {formatCurrency(category.budgeted)}
                        </p>
                        <p className={`text-sm font-medium ${getStatusColor(category.status)}`}>
                          {category.variance >= 0 ? 'Under' : 'Over'} by {formatCurrency(Math.abs(category.variance))}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="relative">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${getProgressBarColor(spentPercent)}`}
                        style={{ width: `${Math.min(spentPercent, 100)}%` }}
                      />
                      {spentPercent > 100 && (
                        <div 
                          className="absolute top-0 left-0 h-2 bg-red-600 dark:bg-red-400 opacity-50 rounded-full"
                          style={{ width: '100%' }}
                        />
                      )}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">0%</span>
                      <span className={`text-xs font-medium ${getStatusColor(category.status)}`}>
                        {spentPercent.toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">100%</span>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-4 bg-gray-50 dark:bg-gray-700/30">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Budget Period</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}ly
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Average per Transaction</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {category.transactions > 0 
                            ? formatCurrency(category.actual / category.transactions)
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Variance Percentage</p>
                        <p className={`font-medium ${getStatusColor(category.status)}`}>
                          {category.variancePercent >= 0 ? '+' : ''}{category.variancePercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    
                    {category.status === 'over' && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-200">
                          💡 Tip: Review recent transactions in this category to identify areas for potential savings.
                        </p>
                      </div>
                    )}
                    
                    {category.status === 'under' && category.variancePercent > 30 && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm text-green-800 dark:text-green-200">
                          ✨ Great job! You're well under budget. Consider adjusting your budget or allocating savings elsewhere.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {categoryComparisons.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No budget data available for the selected period.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}