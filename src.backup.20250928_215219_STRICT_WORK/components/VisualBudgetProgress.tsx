import React, { useMemo, useState } from 'react';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CalendarIcon,
  DollarSignIcon,
  ClockIcon,
  InfoIcon,
  StarIcon as SparklesIcon
} from './icons';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { Budget, Transaction } from '../types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const PERIOD_FALLBACK_DAYS: Record<Budget['period'], number> = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
  custom: 30,
  quarterly: 91
};

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

  const now = new Date();
  const fallbackDays = PERIOD_FALLBACK_DAYS[budget.period] ?? 30;
  const fallbackStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  fallbackStart.setDate(fallbackStart.getDate() - (fallbackDays - 1));
  const fallbackEnd = new Date(fallbackStart.getTime() + (fallbackDays - 1) * MS_PER_DAY);

  const parsedStart = budget.startDate ? new Date(budget.startDate) : null;
  const parsedEnd = budget.endDate ? new Date(budget.endDate) : null;
  const hasValidStart = parsedStart instanceof Date && !Number.isNaN(parsedStart.getTime());
  const hasValidEnd = parsedEnd instanceof Date && !Number.isNaN(parsedEnd.getTime());

  const periodStart = hasValidStart ? parsedStart! : fallbackStart;
  const periodEnd = hasValidEnd ? parsedEnd! : fallbackEnd;
  const normalizedStart = periodStart.getTime() <= periodEnd.getTime() ? periodStart : fallbackStart;
  const normalizedEnd = periodStart.getTime() <= periodEnd.getTime() ? periodEnd : fallbackEnd;

  // Calculate spending for this budget
  const periodStartMs = normalizedStart.getTime();
  const periodEndMs = normalizedEnd.getTime();

  const spent = useMemo(() => {
    return transactions
      .filter((transaction) => {
        if (transaction.type !== 'expense') return false;
        if (transaction.category !== budget.categoryId) return false;

        const transactionTime = transaction.date instanceof Date
          ? transaction.date.getTime()
          : new Date(transaction.date).getTime();

        if (Number.isNaN(transactionTime)) {
          return false;
        }

        return transactionTime >= periodStartMs && transactionTime <= periodEndMs;
      })
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }, [transactions, budget.categoryId, periodEndMs, periodStartMs]);

  // Calculate spending velocity and predictions
  const velocity = useMemo((): SpendingVelocity => {
    const totalDurationMs = Math.max(0, normalizedEnd.getTime() - normalizedStart.getTime());
    const totalDays = Math.max(1, Math.ceil(totalDurationMs / MS_PER_DAY));
    const elapsedMs = Math.max(0, now.getTime() - normalizedStart.getTime());
    const rawDaysElapsed = Math.ceil(elapsedMs / MS_PER_DAY);
    const daysElapsed = Math.min(totalDays, Math.max(0, rawDaysElapsed));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    
    const percentOfPeriodElapsed = totalDays === 0
      ? 0
      : Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
    const dailyAverage = daysElapsed > 0 ? spent / daysElapsed : 0;
    
    // Project total spending at current rate
    const projectedTotal = dailyAverage * totalDays;
    
    const budgetAmount = Math.max(0, budget.amount);
    const expectedSpending = (budgetAmount * percentOfPeriodElapsed) / 100;
    const isOnTrack = budgetAmount === 0
      ? true
      : spent <= expectedSpending * 1.1;
    const willExceed = budgetAmount > 0 && projectedTotal > budgetAmount;
    
    const remainingBudget = Math.max(0, budgetAmount - spent);
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
  const budgetAmount = Math.max(0, budget.amount);
  const percentage = budgetAmount > 0
    ? Math.min(100, (spent / budgetAmount) * 100)
    : 0;
  
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
      return `Over budget by ${formatCurrency(spent - budgetAmount)}`;
    }
    if (velocity.willExceed) {
      return `Projected to exceed by ${formatCurrency(Math.max(0, velocity.projectedTotal - budgetAmount))}`;
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
              className="absolute inset-y-0 w-1 bg-gray-500 dark:bg-blue-400 opacity-70"
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
          <span>{formatCurrency(budgetAmount / 2)}</span>
          <span>{formatCurrency(budgetAmount)}</span>
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
                      you'll exceed this budget by {formatCurrency(Math.max(0, velocity.projectedTotal - budgetAmount))}. 
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
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'monthly' | 'weekly' | 'yearly' | 'custom'>('all');
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
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      }
      // Sort by percentage spent
      const aSpent = transactions
        .filter((transaction) => transaction.category === a.categoryId && transaction.type === 'expense')
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
      const bSpent = transactions
        .filter((transaction) => transaction.category === b.categoryId && transaction.type === 'expense')
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
      const aPercent = a.amount > 0 ? (aSpent / a.amount) * 100 : 0;
      const bPercent = b.amount > 0 ? (bSpent / b.amount) * 100 : 0;
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
              {(['all', 'monthly', 'weekly', 'yearly', 'custom'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
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
              onChange={(e) => setSortBy(e.target.value as any)}
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

/* Add to your global CSS for the shimmer animation */
const shimmerStyle = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
`;
