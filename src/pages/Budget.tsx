import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useNotifications } from '../contexts/NotificationContext';
import { TrendingUpIcon, TrendingDownIcon, BanknoteIcon, RepeatIcon, PiggyBankIcon, ArrowRightIcon, BellIcon, CalculatorIcon } from '../components/icons';
import { EditIcon, DeleteIcon } from '../components/icons';
import { IconButton } from '../components/icons/IconButton';
import { InlineHelp } from '../components/HelpTooltip';
import BudgetModal from '../components/BudgetModal';
import EnvelopeBudgeting from '../components/EnvelopeBudgeting';
import RecurringBudgetTemplates from '../components/RecurringBudgetTemplates';
import BudgetRollover from '../components/BudgetRollover';
import SpendingAlerts from '../components/SpendingAlerts';
import ZeroBasedBudgeting from '../components/ZeroBasedBudgeting';
import type { Budget } from '../types';
import PageWrapper from '../components/PageWrapper';
import { calculateBudgetSpending, calculateBudgetRemaining, calculateBudgetPercentage } from '../utils/calculations-decimal';
import { toDecimal, Decimal } from '../utils/decimal';
import { SkeletonCard, SkeletonText } from '../components/loading/Skeleton';

export default function Budget() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [activeTab, setActiveTab] = useState<'traditional' | 'envelope' | 'templates' | 'rollover' | 'alerts' | 'zero-based'>('traditional');
  const [isLoading, setIsLoading] = useState(true);
  const { formatCurrency } = useCurrencyDecimal();
  const formatPercentage = (value: number | Decimal, decimals: number = 0) => {
    return toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals);
  };
  
  // Get data from context
  const { budgets, updateBudget, deleteBudget, transactions, categories } = useApp();
  const { checkEnhancedBudgetAlerts, checkBudgetAlerts, alertThreshold } = useNotifications();

  // Memoize current date values
  const { currentMonth, currentYear } = useMemo(() => {
    const now = new Date();
    return {
      currentMonth: now.getMonth(),
      currentYear: now.getFullYear()
    };
  }, []);

  // Calculate spent amounts for each budget with memoization
  const budgetsWithSpent = useMemo(() => {
    return budgets
      .filter(budget => budget !== null && budget !== undefined)
      .map((budget) => {
        // Convert to decimal for calculations
        const decimalBudget = {
          ...budget,
          amount: toDecimal(budget.amount),
          spent: toDecimal(0)
        };
        
        // Convert transactions to decimal for calculations
        const decimalTransactions = transactions.map(t => ({
          ...t,
          amount: toDecimal(t.amount)
        }));
        
        // Calculate date range for budget period
        let startDate: Date;
        let endDate: Date;
        
        if (budget.period === 'monthly') {
          startDate = new Date(currentYear, currentMonth, 1);
          endDate = new Date(currentYear, currentMonth + 1, 0);
        } else if (budget.period === 'weekly') {
          // For weekly, use the current week
          const now = new Date();
          const dayOfWeek = now.getDay();
          startDate = new Date(now);
          startDate.setDate(now.getDate() - dayOfWeek);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Yearly
          startDate = new Date(currentYear, 0, 1);
          endDate = new Date(currentYear, 11, 31);
        }

        const spent = calculateBudgetSpending(decimalBudget, decimalTransactions, startDate, endDate);
        const percentage = calculateBudgetPercentage(decimalBudget, spent);
        const remaining = calculateBudgetRemaining(decimalBudget, spent);

        return {
          ...budget,
          spent: spent.toNumber(),
          percentage,
          remaining: remaining.toNumber()
        };
      });
  }, [budgets, transactions, currentMonth, currentYear]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(category => {
      if (category?.id) {
        map.set(category.id, category.name);
      }
      if (category?.name) {
        map.set(category.name, category.name);
      }
    });
    return map;
  }, [categories]);

  // Set loading to false when data is loaded
  useEffect(() => {
    if (budgets !== undefined && transactions !== undefined && categories !== undefined) {
      setIsLoading(false);
    }
  }, [budgets, transactions, categories]);

  // Check for budget alerts
  useEffect(() => {
    const alerts = budgetsWithSpent
      .filter(budget => budget.isActive)
      .map(budget => {
        const category =
          categoryNameById.get(budget.categoryId ?? (budget as any).category) ?? budget.name ?? (budget as any).category;
        if (budget.percentage >= 100) {
          return {
            budgetId: budget.id,
            categoryName: category || 'Unknown',
            percentage: Math.round(budget.percentage),
            spent: budget.spent,
            budget: budget.amount,
            period: budget.period,
            type: 'danger' as const
          };
        } else if (budget.percentage >= alertThreshold) {
          return {
            budgetId: budget.id,
            categoryName: category || 'Unknown',
            percentage: Math.round(budget.percentage),
            spent: budget.spent,
            budget: budget.amount,
            period: budget.period,
            type: 'warning' as const
          };
        }
        return null;
      })
      .filter(alert => alert !== null);

    if (alerts.length > 0) {
      checkBudgetAlerts(alerts);
    }
  }, [budgetsWithSpent, categoryNameById, alertThreshold, checkBudgetAlerts]);

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingBudget(null);
  };

  const handleToggleActive = (budgetId: string, currentStatus: boolean | undefined) => {
    updateBudget(budgetId, { isActive: !currentStatus });
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Calculate totals with memoization
  const { totalBudgeted, totalSpent, totalRemaining, totalRemainingValue } = useMemo(() => {
    const active = budgetsWithSpent.filter(b => b && b.isActive !== false);
    const budgeted = active.reduce((sum, b) => sum.plus(toDecimal(b.amount || 0)), toDecimal(0));
    const spent = active.reduce((sum, b) => sum.plus(toDecimal(b.spent || 0)), toDecimal(0));
    const remaining = budgeted.minus(spent);
    
    return {
      totalBudgeted: formatCurrency(budgeted),
      totalSpent: formatCurrency(spent),
      totalRemaining: formatCurrency(remaining),
      totalRemainingValue: remaining.toNumber()
    };
  }, [budgetsWithSpent]);

  // Check for enhanced budget alerts whenever budgets change
  useEffect(() => {
    if (budgets.length > 0 && transactions.length > 0) {
      checkEnhancedBudgetAlerts(budgets, transactions, categories);
    }
  }, [budgets, transactions, categories, checkEnhancedBudgetAlerts]);

  return (
    <PageWrapper 
      title="Budget"
      rightContent={
        <div 
          onClick={() => setIsModalOpen(true)}
          className="cursor-pointer"
          title="Add Budget"
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
            <g transform="translate(12, 12)">
              <circle cx="12" cy="12" r="10" stroke="#1F2937" strokeWidth="2" fill="none" />
              <path d="M12 8v8M8 12h8" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      }
    >

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('traditional')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'traditional'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          title="Traditional category-based budgeting"
        >
          <BanknoteIcon size={16} />
          Traditional
        </button>
        <button
          onClick={() => setActiveTab('envelope')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'envelope'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          title="Envelope budgeting - allocate money to virtual envelopes"
        >
          <PiggyBankIcon size={16} />
          Envelope
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'templates'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <RepeatIcon size={16} />
          Templates
        </button>
        <button
          onClick={() => setActiveTab('rollover')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'rollover'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <ArrowRightIcon size={16} />
          Rollover
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'alerts'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <BellIcon size={16} />
          Alerts
        </button>
        <button
          onClick={() => setActiveTab('zero-based')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'zero-based'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <CalculatorIcon size={16} />
          Zero-Based
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'traditional' && (
        <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Budgeted</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? <SkeletonText className="w-32 h-8" /> : totalBudgeted}
              </p>
            </div>
            <BanknoteIcon className="text-gray-400" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? <SkeletonText className="w-32 h-8" /> : totalSpent}
              </p>
            </div>
            <TrendingDownIcon className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Remaining</p>
              <p className={`text-2xl font-bold ${
                totalRemainingValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isLoading ? <SkeletonText className="w-32 h-8" /> : totalRemaining}
              </p>
            </div>
            <TrendingUpIcon className={totalRemainingValue >= 0 ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
        </div>
        </div>

        {/* Budgets List */}
        <div className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-48" />
          </>
        ) : budgetsWithSpent.map(budget => budget && (
          <div
            key={budget.id}
            className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 ${
              budget.isActive === false ? 'opacity-60' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {categoryNameById.get(budget.categoryId ?? (budget as any).category) ?? budget.name ?? (budget as any).category ?? 'Budget'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {budget.period === 'monthly' ? 'Monthly' : 'Yearly'} budget
                  {budget.isActive === false && ' (Inactive)'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleToggleActive(budget.id, budget.isActive)}
                  className={`px-3 py-1 text-sm rounded ${
                    budget.isActive !== false
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {budget.isActive !== false ? 'Active' : 'Inactive'}
                </button>
                <IconButton
                  onClick={() => handleEdit(budget)}
                  icon={<EditIcon size={20} />}
                  variant="ghost"
                  size="md"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[44px] min-h-[44px]"
                  title="Edit Budget"
                />
                <IconButton
                  onClick={() => {
                    if (confirm('Delete this budget?')) {
                      deleteBudget(budget.id);
                    }
                  }}
                  icon={<DeleteIcon size={20} />}
                  variant="ghost"
                  size="md"
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 min-w-[44px] min-h-[44px]"
                  title="Delete Budget"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Spent</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(budget.spent)} of {formatCurrency(Number(budget.amount) || 0)}
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${getProgressColor(budget.percentage)}`}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {`${formatPercentage(budget.percentage, 0)}% used`}
                </span>
                <span className={`font-medium ${
                  budget.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(Math.abs(budget.remaining))} {budget.remaining >= 0 ? 'remaining' : 'over budget'}
                </span>
              </div>
            </div>
          </div>
        ))}
          </div>

          {budgets.length === 0 && (
          <div className="text-center py-12 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No budgets set up yet</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-primary hover:underline"
            >
              Create your first budget
            </button>
          </div>
        )}
        </div>
        </div>
      )}

      {/* Envelope Budgeting Tab */}
      {activeTab === 'envelope' && (
        <EnvelopeBudgeting />
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <RecurringBudgetTemplates />
      )}

      {/* Rollover Tab */}
      {activeTab === 'rollover' && (
        <BudgetRollover />
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <SpendingAlerts />
      )}

      {/* Zero-Based Budgeting Tab */}
      {activeTab === 'zero-based' && (
        <ZeroBasedBudgeting />
      )}

      <BudgetModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        budget={editingBudget || undefined}
      />
    </PageWrapper>
  );
}
