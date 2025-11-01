import React, { useMemo, useState } from 'react';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CalendarIcon,
  DollarSignIcon,
  ClockIcon,
  SparklesIcon
} from './icons';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { Budget, Transaction } from '../types';

interface BudgetProgressProps {
  budget: Budget;
  transactions: Transaction[];
  showDetails?: boolean;
  compact?: boolean;
}

interface SpendingVelocity {
  dailyAverage: number;
  projectedTotal: number;
  daysRemaining: number;
  percentOfPeriodElapsed: number;
  isOnTrack: boolean;
  willExceed: boolean;
  recommendedDailyLimit: number;
}

/**
 * Visual Budget Progress Component
 * Design principles:
 * 1. Beautiful animated progress bars
 * 2. Color-coded status (green/yellow/red)
 * 3. Spending velocity indicators
 * 4. Predictive overspend warnings
 * 5. Mobile-optimized display
 */
export function VisualBudgetProgress({ 
  budget, 
  transactions,
  showDetails = true,
  compact = false
}: BudgetProgressProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  // Calculate spending for this budget
  const spent = useMemo(() => {
    return transactions
      .filter(t =>
        t.category === budget.categoryId &&
        t.type === 'expense' &&
        new Date(t.date) >= new Date(budget.startDate) &&
        new Date(t.date) <= new Date(budget.endDate)
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [transactions, budget]);

  // Calculate spending velocity and predictions
  const velocity = useMemo((): SpendingVelocity => {
    const now = new Date();
    const start = new Date(budget.startDate);
    const end = new Date(budget.endDate);
    
    // Calculate days
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    
    // Calculate percentages
    const percentOfPeriodElapsed = Math.min(100, (daysElapsed / totalDays) * 100);
    const dailyAverage = daysElapsed > 0 ? spent / daysElapsed : 0;
    
    // Project total spending at current rate
    const projectedTotal = dailyAverage * totalDays;
    
    // Calculate if on track
    const expectedSpending = (budget.amount * percentOfPeriodElapsed) / 100;
    const isOnTrack = spent <= expectedSpending * 1.1; // 10% buffer
    const willExceed = projectedTotal > budget.amount;
    
    // Calculate recommended daily limit for remaining days
    const remainingBudget = Math.max(0, budget.amount - spent);
    const recommendedDailyLimit = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;
    
    return {
      dailyAverage,
      projectedTotal,
      daysRemaining,
      percentOfPeriodElapsed,
      isOnTrack,
      willExceed,
      recommendedDailyLimit
    };
  }, [budget, spent]);

  // Calculate percentage and status
  const percentage = Math.min(100, (spent / budget.amount) * 100);
  
  // Determine color based on spending
  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 60 && !velocity.isOnTrack) return 'bg-yellow-400';
    return 'bg-green-500';
  };

  const getStatusColor = () => {
    if (percentage >= 100) return 'text-red-600 dark:text-red-400';
    if (percentage >= 90) return 'text-orange-600 dark:text-orange-400';
    if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getStatusIcon = () => {
    if (percentage >= 100) return <AlertTriangleIcon size={16} />;
    if (velocity.willExceed) return <TrendingUpIcon size={16} />;
    if (!velocity.isOnTrack) return <TrendingDownIcon size={16} />;
    return <CheckCircleIcon size={16} />;
  };

  const getStatusMessage = () => {
    if (percentage >= 100) {
      return `Over budget by ${formatCurrency(spent - budget.amount)}`;
    }
    if (velocity.willExceed) {
      return `Projected to exceed by ${formatCurrency(velocity.projectedTotal - budget.amount)}`;
    }
    if (!velocity.isOnTrack) {
      return 'Spending faster than planned';
    }
    return 'On track';
  };

  if (compact) {
    return (
      <div className="relative">
        {/* Compact Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {budget.name}
              </span>
              <span className={`text-sm font-semibold ${getStatusColor()}`}>
                {formatCurrency(spent)} / {formatCurrency(budget.amount)}
              </span>
            </div>
            <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 ${getProgressColor()} transition-all duration-500 ease-out rounded-full`}
                style={{ width: `${percentage}%` }}
              >
                {/* Animated shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
              {/* Velocity indicator line */}
              {velocity.percentOfPeriodElapsed > 0 && (
                <div
                  className="absolute inset-y-0 w-0.5 bg-gray-800 dark:bg-gray-300 opacity-50"
                  style={{ left: `${velocity.percentOfPeriodElapsed}%` }}
                  title="Expected progress"
                />
              )}
            </div>
          </div>
          <div className={getStatusColor()}>
            {getStatusIcon()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {budget.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {budget.categoryId} • {budget.period}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${getStatusColor()}`}>
            {percentage.toFixed(0)}%
          </div>
          <div className="flex items-center gap-1 mt-1">
            {getStatusIcon()}
            <span className={`text-sm ${getStatusColor()}`}>
              {getStatusMessage()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="relative mb-6">
        <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${getProgressColor()} transition-all duration-700 ease-out rounded-lg flex items-center justify-end pr-2`}
            style={{ width: `${percentage}%` }}
          >
            {percentage > 20 && (
              <span className="text-white text-sm font-semibold">
                {formatCurrency(spent)}
              </span>
            )}
            {/* Animated pulse effect when over budget */}
            {percentage >= 100 && (
              <div className="absolute inset-0 bg-red-400 opacity-30 animate-pulse" />
            )}
          </div>
          
          {/* Expected progress line */}
          {velocity.percentOfPeriodElapsed > 0 && velocity.percentOfPeriodElapsed < 100 && (
            <div
              className="absolute inset-y-0 w-1 bg-blue-500 dark:bg-blue-400 opacity-70"
              style={{ left: `${velocity.percentOfPeriodElapsed}%` }}
              onMouseEnter={() => setShowTooltip('expected')}
              onMouseLeave={() => setShowTooltip(null)}
            >
              {showTooltip === 'expected' && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  Expected: {velocity.percentOfPeriodElapsed.toFixed(0)}% of period elapsed
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Scale labels */}
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatCurrency(0)}</span>
          <span>{formatCurrency(budget.amount / 2)}</span>
          <span>{formatCurrency(budget.amount)}</span>
        </div>
      </div>

      {showDetails && (
        <>
          {/* Velocity Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <CalendarIcon size={12} />
                <span>Days Remaining</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {velocity.daysRemaining}
              </p>
            </div>
            
            <div>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <ClockIcon size={12} />
                <span>Daily Average</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(velocity.dailyAverage)}
              </p>
            </div>
            
            <div>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <TrendingUpIcon size={12} />
                <span>Projected Total</span>
              </div>
              <p className={`text-lg font-semibold ${velocity.willExceed ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {formatCurrency(velocity.projectedTotal)}
              </p>
            </div>
            
            <div>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <DollarSignIcon size={12} />
                <span>Recommended Daily</span>
              </div>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(velocity.recommendedDailyLimit)}
              </p>
            </div>
          </div>

          {/* Smart Insights */}
          {(velocity.willExceed || !velocity.isOnTrack || percentage >= 90) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <SparklesIcon size={16} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    Budget Insight
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    {velocity.willExceed && (
                      <>At your current spending rate of {formatCurrency(velocity.dailyAverage)}/day, 
                      you'll exceed this budget by {formatCurrency(velocity.projectedTotal - budget.amount)}. 
                      Try to limit daily spending to {formatCurrency(velocity.recommendedDailyLimit)}.</>
                    )}
                    {!velocity.willExceed && !velocity.isOnTrack && (
                      <>You're spending faster than planned. You've used {percentage.toFixed(0)}% of your budget 
                      but only {velocity.percentOfPeriodElapsed.toFixed(0)}% of the period has elapsed.</>
                    )}
                    {!velocity.willExceed && velocity.isOnTrack && percentage >= 90 && (
                      <>You're close to your budget limit with {velocity.daysRemaining} days remaining. 
                      Consider limiting spending to {formatCurrency(velocity.recommendedDailyLimit)}/day.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Budget Dashboard Component
 * Shows all budgets with visual progress
 */
interface BudgetDashboardProps {
  compact?: boolean;
}

export function BudgetDashboard({ compact = false }: BudgetDashboardProps): React.JSX.Element {
  const { budgets, transactions } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'monthly' | 'weekly' | 'yearly'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'percentage' | 'amount'>('percentage');

  // Filter budgets by period
  const filteredBudgets = useMemo(() => {
    if (selectedPeriod === 'all') return budgets;
    return budgets.filter(b => b.period.toLowerCase() === selectedPeriod);
  }, [budgets, selectedPeriod]);

  // Sort budgets
  const sortedBudgets = useMemo(() => {
    const sorted = [...filteredBudgets];
    sorted.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      }
      // Sort by percentage spent
      const aSpent = transactions
        .filter(t => t.category === a.categoryId && t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const bSpent = transactions
        .filter(t => t.category === b.categoryId && t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const aPercent = (aSpent / a.amount) * 100;
      const bPercent = (bSpent / b.amount) * 100;
      return bPercent - aPercent;
    });
    return sorted;
  }, [filteredBudgets, sortBy, transactions]);

  if (budgets.length === 0) {
    return (
      <div className="text-center py-12">
        <DollarSignIcon size={48} className="text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          No budgets set up yet
        </p>
        <button className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">
          Create Your First Budget
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      {!compact && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Budget Overview
          </h2>
          <div className="flex flex-wrap gap-2">
            {/* Period Filter */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['all', 'monthly', 'weekly', 'yearly'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    selectedPeriod === period
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'percentage' | 'amount')}
              className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <option value="percentage">Sort by Usage</option>
              <option value="amount">Sort by Amount</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>
      )}

      {/* Budget List */}
      <div className={compact ? 'space-y-3' : 'space-y-4'}>
        {sortedBudgets.map(budget => (
          <VisualBudgetProgress
            key={budget.id}
            budget={budget}
            transactions={transactions}
            showDetails={!compact}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
