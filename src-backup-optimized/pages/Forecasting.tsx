import React, { useState, useMemo, useEffect } from 'react';
import PageWrapper from '../components/PageWrapper';
import CashFlowForecast from '../components/CashFlowForecast';
import SeasonalTrends from '../components/SeasonalTrends';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  LineChartIcon, 
  CalendarIcon, 
  AlertCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  BarChart3Icon,
  BanknoteIcon,
  RepeatIcon,
  PiggyBankIcon,
  ArrowRightIcon,
  BellIcon,
  CalculatorIcon,
  EditIcon,
  DeleteIcon
} from '../components/icons';
import { IconButton } from '../components/icons/IconButton';
import BudgetModal from '../components/BudgetModal';
import EnvelopeBudgeting from '../components/EnvelopeBudgeting';
import RecurringBudgetTemplates from '../components/RecurringBudgetTemplates';
import BudgetRollover from '../components/BudgetRollover';
import SpendingAlerts from '../components/SpendingAlerts';
import ZeroBasedBudgeting from '../components/ZeroBasedBudgeting';
import type { Budget } from '../types';
import { calculateBudgetSpending, calculateBudgetRemaining, calculateBudgetPercentage } from '../utils/calculations-decimal';
import { toDecimal } from '../utils/decimal';
import { SkeletonCard, SkeletonText } from '../components/loading/Skeleton';

export default function Forecasting() {
  const { accounts, budgets, updateBudget, deleteBudget, transactions, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { checkEnhancedBudgetAlerts, checkBudgetAlerts, alertThreshold } = useNotifications();
  const [activeTab, setActiveTab] = useState<'budget' | 'forecast' | 'seasonal'>('budget');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetSubTab, setBudgetSubTab] = useState<'traditional' | 'envelope' | 'templates' | 'rollover' | 'alerts' | 'zero-based'>('traditional');
  const [isLoading, setIsLoading] = useState(true);

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
          category: budget.categoryId,  // Map categoryId to category for DecimalBudget
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
        const category = categories.find(c => c.id === budget.categoryId);
        if (budget.percentage >= 100) {
          return {
            budgetId: budget.id,
            categoryName: category?.name || 'Unknown',
            percentage: toDecimal(budget.percentage).round().toNumber(),
            spent: budget.spent,
            budget: budget.amount,
            period: budget.period,
            type: 'danger' as const
          };
        } else if (budget.percentage >= alertThreshold) {
          return {
            budgetId: budget.id,
            categoryName: category?.name || 'Unknown',
            percentage: toDecimal(budget.percentage).round().toNumber(),
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
  }, [budgetsWithSpent, categories, alertThreshold, checkBudgetAlerts]);

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
  }, [budgetsWithSpent, formatCurrency]);

  // Check for enhanced budget alerts whenever budgets change
  useEffect(() => {
    if (budgets.length > 0 && transactions.length > 0) {
      checkEnhancedBudgetAlerts(budgets, transactions, categories);
    }
  }, [budgets, transactions, categories, checkEnhancedBudgetAlerts]);

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

  return (
    <PageWrapper
      title="Forecasting & Budget"
      rightContent={
        activeTab === 'budget' && (
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
        )
      }
    >
      {/* Main Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('budget')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'budget'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <BanknoteIcon size={16} />
          Budget
        </button>
        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'forecast'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <LineChartIcon size={16} />
          Cash Flow Forecast
        </button>
        <button
          onClick={() => setActiveTab('seasonal')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'seasonal'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <CalendarIcon size={16} />
          Seasonal Trends
        </button>
      </div>

      {/* Budget Tab Content */}
      {activeTab === 'budget' && (
        <>
          {/* Budget Sub-tabs */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
            <button
              onClick={() => setBudgetSubTab('traditional')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                budgetSubTab === 'traditional'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="Traditional category-based budgeting"
            >
              <BanknoteIcon size={16} />
              Traditional
            </button>
            <button
              onClick={() => setBudgetSubTab('envelope')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                budgetSubTab === 'envelope'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="Envelope budgeting - allocate money to virtual envelopes"
            >
              <PiggyBankIcon size={16} />
              Envelope
            </button>
            <button
              onClick={() => setBudgetSubTab('templates')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                budgetSubTab === 'templates'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <RepeatIcon size={16} />
              Templates
            </button>
            <button
              onClick={() => setBudgetSubTab('rollover')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                budgetSubTab === 'rollover'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <ArrowRightIcon size={16} />
              Rollover
            </button>
            <button
              onClick={() => setBudgetSubTab('alerts')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                budgetSubTab === 'alerts'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <BellIcon size={16} />
              Alerts
            </button>
            <button
              onClick={() => setBudgetSubTab('zero-based')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                budgetSubTab === 'zero-based'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <CalculatorIcon size={16} />
              Zero-Based
            </button>
          </div>

          {/* Budget Sub-tab Content */}
          {budgetSubTab === 'traditional' && (
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
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {categories.find(c => c.id === budget.categoryId)?.name || 'Unknown Category'}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {budget.period === 'monthly' ? 'Monthly' : budget.period === 'weekly' ? 'Weekly' : 'Yearly'} Budget
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <IconButton
                            icon={<EditIcon className="w-4 h-4" />}
                            onClick={() => handleEdit(budget)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            aria-label="Edit budget"
                            title="Edit budget"
                          />
                          <IconButton
                            icon={<DeleteIcon className="w-4 h-4" />}
                            onClick={() => deleteBudget(budget.id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"
                            aria-label="Delete budget"
                            title="Delete budget"
                          />
                          <button
                            onClick={() => handleToggleActive(budget.id, budget.isActive)}
                            className={`ml-2 px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                              budget.isActive !== false
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            {budget.isActive !== false ? 'Active' : 'Inactive'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Budget</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(toDecimal(budget.amount))}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Spent</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(toDecimal(budget.spent))}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Remaining</span>
                          <span className={`font-medium ${
                            budget.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {formatCurrency(toDecimal(budget.remaining))}
                          </span>
                        </div>

                        <div className="pt-2">
                          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                            <span>{toDecimal(budget.percentage).round().toString()}% used</span>
                            <span>{budget.remaining >= 0 ? `${formatCurrency(toDecimal(budget.remaining))} left` : 'Over budget'}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full transition-all duration-300 ${getProgressColor(budget.percentage)}`}
                              style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {budgetSubTab === 'envelope' && <EnvelopeBudgeting />}
          {budgetSubTab === 'templates' && <RecurringBudgetTemplates />}
          {budgetSubTab === 'rollover' && <BudgetRollover />}
          {budgetSubTab === 'alerts' && <SpendingAlerts />}
          {budgetSubTab === 'zero-based' && <ZeroBasedBudgeting />}
        </>
      )}

      {/* Forecast Tab Content (with Account Filter) */}
      {(activeTab === 'forecast' || activeTab === 'seasonal') && (
        <div className="mb-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Accounts
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedAccountIds([])}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedAccountIds.length === 0
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All Accounts
            </button>
            {accounts.map(account => (
              <button
                key={account.id}
                onClick={() => {
                  if (selectedAccountIds.includes(account.id)) {
                    setSelectedAccountIds(prev => prev.filter(id => id !== account.id));
                  } else {
                    setSelectedAccountIds(prev => [...prev, account.id]);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedAccountIds.includes(account.id)
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {account.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Forecast Tab Content */}
      {activeTab === 'forecast' && (
        <CashFlowForecast 
          accountIds={selectedAccountIds.length > 0 ? selectedAccountIds : undefined}
        />
      )}

      {/* Seasonal Tab Content */}
      {activeTab === 'seasonal' && (
        <div className="space-y-6">
          <SeasonalTrends />
          
          {/* Tips Section */}
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <TrendingUpIcon className="text-primary" size={24} />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Improve Your Financial Future
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                      Based on Forecast
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Set up automatic savings transfers</li>
                      <li>• Review and adjust recurring expenses</li>
                      <li>• Plan for irregular expenses</li>
                      <li>• Build emergency fund for low months</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                      Seasonal Planning
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Save extra during high-income months</li>
                      <li>• Budget for seasonal expenses</li>
                      <li>• Track holiday spending patterns</li>
                      <li>• Adjust goals based on trends</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Info */}
      <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <div className="flex items-start gap-3">
          <AlertCircleIcon className="text-amber-600 dark:text-amber-400 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              About Financial Forecasting & Budgeting
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Our forecasting engine analyzes your transaction history to identify patterns and predict future cash flow. 
              Combined with comprehensive budgeting tools, you can plan and track your finances effectively.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <h4 className="font-medium mb-1">Budgeting Features:</h4>
                <ul className="space-y-1">
                  <li>• Traditional category budgets</li>
                  <li>• Envelope budgeting system</li>
                  <li>• Budget templates & rollover</li>
                  <li>• Smart spending alerts</li>
                  <li>• Zero-based budgeting</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">Forecasting Features:</h4>
                <ul className="space-y-1">
                  <li>• 12-month cash flow projection</li>
                  <li>• Account balance predictions</li>
                  <li>• Seasonal trend analysis</li>
                  <li>• Income and expense patterns</li>
                  <li>• Custom date range analysis</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Modal */}
      {isModalOpen && (
        <BudgetModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          budget={editingBudget || undefined}
        />
      )}
    </PageWrapper>
  );
}