import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useNotifications } from '../contexts/NotificationContext';
import { useToast } from '../contexts/ToastContext';
import { TrendingUpIcon, TrendingDownIcon, BanknoteIcon, RepeatIcon, PiggyBankIcon, ArrowRightIcon, BellIcon, CalculatorIcon } from '../components/icons';
import { EditIcon, DeleteIcon } from '../components/icons';
import { IconButton } from '../components/icons/IconButton';
import BudgetModal from '../components/BudgetModal';
import EnvelopeBudgeting from '../components/EnvelopeBudgeting';
import RecurringBudgetTemplates from '../components/RecurringBudgetTemplates';
import BudgetRollover from '../components/BudgetRollover';
import SpendingAlerts from '../components/SpendingAlerts';
import ZeroBasedBudgeting from '../components/ZeroBasedBudgeting';
import type { Budget } from '../types';
import { getEffectiveBudgetAmount } from '../utils/budgetAmounts';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import { calculateBudgetPercentage } from '../utils/calculations-decimal';
import {
  buildCategoryChildIndex,
  calculateBudgetSpend,
  collectBudgetCategoryIds,
  foreignCurrencyAccountIds,
  prepareBudgetTransactions
} from '../utils/budgetSpending';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { SkeletonCard, SkeletonText } from '../components/loading/Skeleton';

export default function Budget() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [activeTab, setActiveTab] = useState<'traditional' | 'envelope' | 'templates' | 'rollover' | 'alerts' | 'zero-based'>('traditional');
  const [isLoading, setIsLoading] = useState(true);
  const { formatCurrency, displayCurrency } = useCurrencyDecimal();
  const formatPercentage = (value: number | DecimalInstance, decimals: number = 0) => {
    return formatDecimal(value, decimals);
  };

  // Get data from context
  const { budgets, updateBudget, deleteBudget, transactions, transactionSplits, categories, accounts } = useApp();
  const { checkEnhancedBudgetAlerts, checkBudgetAlerts, alertThreshold } = useNotifications();
  const { showError } = useToast();

  // One evaluation instant for the whole page: every card, caption and total
  // describes the same "now".
  const evaluatedAt = useMemo(() => new Date(), []);

  // Parent → children, so a group budget can roll its descendants up.
  const categoryChildIndex = useMemo(() => buildCategoryChildIndex(categories), [categories]);

  // Rows on accounts held in another currency cannot join this total without a
  // rate; they are left out and the card says so.
  const foreignAccountIds = useMemo(
    () => foreignCurrencyAccountIds(accounts, displayCurrency),
    [accounts, displayCurrency]
  );

  // Legacy healing for the SPEND path, not just the modal: budgets saved by
  // the old picker carry a category NAME where the id belongs, and matched
  // nothing until each was opened and re-saved. Resolve a name-keyed (or
  // legacy `category`-field) budget to its real category id before matching.
  const categoryIdByName = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(category => {
      if (category?.name && category.id) map.set(category.name, category.id);
    });
    return map;
  }, [categories]);
  const categoryIdSet = useMemo(() => new Set(categories.map(c => c.id)), [categories]);
  const resolveBudgetCategoryId = useCallback((budget: Budget): string => {
    if (budget.categoryId && categoryIdSet.has(budget.categoryId)) return budget.categoryId;
    const legacy = (budget as Budget & { category?: string }).category ?? budget.categoryId;
    return (legacy && categoryIdByName.get(legacy)) || budget.categoryId;
  }, [categoryIdSet, categoryIdByName]);

  // Calculate spent amounts for each budget with memoization
  const budgetsWithSpent = useMemo(() => {
    // Split parents expand into their per-line rows first, so a split line
    // spends against ITS category's budget. Converted to decimal once, not
    // per budget.
    const prepared = prepareBudgetTransactions(transactions, transactionSplits);

    return budgets
      .filter(budget => budget !== null && budget !== undefined)
      .map((budget) => {
        // Effective amount = base budget plus any rollover carried in — the
        // same figure the Envelope, Rollover and Alerts tabs use, so the five
        // tabs can never disagree.
        const effectiveAmount = getEffectiveBudgetAmount(budget);

        // A budget on a GROUP category counts every detail category beneath
        // it. A detail budget's set is just itself, so it keeps the plain
        // equality match it has always used.
        const resolvedCategoryId = resolveBudgetCategoryId(budget);
        const categoryIds = collectBudgetCategoryIds(resolvedCategoryId, categoryChildIndex);
        const { spent, window, excludedForeignCount } = calculateBudgetSpend(
          { ...budget, categoryId: resolvedCategoryId },
          prepared,
          {
            now: evaluatedAt,
            categoryIds: categoryIds.size > 1 ? categoryIds : undefined,
            foreignAccountIds
          }
        );

        const percentage = calculateBudgetPercentage({ amount: effectiveAmount }, spent);
        // UNCLAMPED, unlike calculateBudgetRemaining's floored figure: an
        // overspent budget must read "over budget by £30.00" rather than
        // "£0.00 remaining" while the page total says something else.
        const remaining = effectiveAmount.minus(spent);

        return {
          ...budget,
          effectiveAmount,
          spent: spent.toNumber(),
          percentage,
          remaining: remaining.toNumber(),
          periodLabel: window.label,
          excludedForeignCount
        };
      });
  }, [budgets, transactions, transactionSplits, categoryChildIndex, foreignAccountIds, evaluatedAt, resolveBudgetCategoryId]);

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

  type BudgetWithLegacyCategory = Budget & { category?: string };
  const getBudgetCategoryLabel = useCallback((budget: Budget) => {
    const legacyCategory = (budget as BudgetWithLegacyCategory).category;
    const categoryKey = budget.categoryId ?? legacyCategory ?? '';
    return categoryNameById.get(categoryKey) ?? budget.name ?? (categoryKey || 'Budget');
  }, [categoryNameById]);

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
        const categoryLabel = getBudgetCategoryLabel(budget);
        if (budget.percentage >= 100) {
          return {
            budgetId: budget.id,
            categoryName: categoryLabel || 'Unknown',
            percentage: Math.round(budget.percentage),
            spent: budget.spent,
            // The figure the card shows — the plan plus any carry — so an
            // alert can never quote a limit the page does not display.
            budget: budget.effectiveAmount.toNumber(),
            period: budget.period,
            type: 'danger' as const
          };
        } else if (budget.percentage >= alertThreshold) {
          return {
            budgetId: budget.id,
            categoryName: categoryLabel || 'Unknown',
            percentage: Math.round(budget.percentage),
            spent: budget.spent,
            budget: budget.effectiveAmount.toNumber(),
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
  }, [budgetsWithSpent, categoryNameById, alertThreshold, checkBudgetAlerts, getBudgetCategoryLabel]);

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingBudget(null);
  };

  /**
   * Awaited, with the failure shown.
   *
   * These two are page actions rather than a form, so there is no modal to
   * hold open — but the silence was the same: the write was launched and
   * forgotten, and a refusal left the row looking exactly as it had before,
   * with nothing said. The context leaves its own state alone when the write
   * throws, so the card still shows the truth; the toast supplies the reason
   * it did not change.
   */
  const handleToggleActive = async (budgetId: string, currentStatus: boolean | undefined): Promise<void> => {
    try {
      await updateBudget(budgetId, { isActive: !currentStatus });
    } catch (error) {
      showError(error);
    }
  };

  const handleDelete = async (budgetId: string): Promise<void> => {
    try {
      await deleteBudget(budgetId);
    } catch (error) {
      showError(error);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Calculate totals with memoization
  const { totalBudgeted, totalSpent, totalRemaining, totalRemainingValue } = useMemo(() => {
    const active = budgetsWithSpent.filter(b => b && b.isActive !== false);
    // Summed from exactly what the cards show — the effective amount (plan plus
    // carry) and the same spend — so the header can never contradict them.
    const budgeted = active.reduce((sum, b) => sum.plus(b.effectiveAmount), toDecimal(0));
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
      // Same inputs the cards use: split lines count, and rows in another
      // currency do not — an alert that disagrees with the card behind it is
      // worse than no alert.
      checkEnhancedBudgetAlerts(budgets, transactions, categories, {
        transactionSplits,
        foreignAccountIds
      });
    }
  }, [budgets, transactions, categories, transactionSplits, foreignAccountIds, checkEnhancedBudgetAlerts]);

  return (
    <PageWrapper 
      title="Budget"
      rightContent={
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white text-body font-medium rounded-lg hover:bg-[#2d3a4d] transition-colors shadow-sm"
          title="Add Budget"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Budget
        </button>
      }
    >

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('traditional')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-body font-medium rounded-md transition-colors ${
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-body">Total Budgeted</p>
              <p className="text-page font-bold text-gray-900 dark:text-white">
                {isLoading ? <SkeletonText className="w-32 h-8" /> : totalBudgeted}
              </p>
            </div>
            <BanknoteIcon className="text-gray-400" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-body">Total Spent</p>
              <p className="text-page font-bold text-gray-900 dark:text-white">
                {isLoading ? <SkeletonText className="w-32 h-8" /> : totalSpent}
              </p>
            </div>
            <TrendingDownIcon className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-body">Total Remaining</p>
              <p className={`text-page font-bold ${
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
            className={`bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6 ${
              budget.isActive === false ? 'opacity-60' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-card font-semibold text-gray-900 dark:text-white">
                  {getBudgetCategoryLabel(budget)}
                </h3>
                <p className="text-body text-gray-600 dark:text-gray-400">
                  {/* The budget's ACTUAL period — a weekly or quarterly budget
                      used to be captioned "Yearly" because anything that was
                      not monthly fell through to the same branch. */}
                  {budget.periodLabel} budget
                  {budget.isActive === false && ' (Inactive)'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => void handleToggleActive(budget.id, budget.isActive)}
                  className={`px-3 py-1 text-body rounded ${
                    budget.isActive !== false
                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
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
                      void handleDelete(budget.id);
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
              <div className="flex justify-between text-body">
                <span className="text-gray-600 dark:text-gray-400">Spent</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(budget.spent)} of {formatCurrency(budget.effectiveAmount)}
                </span>
              </div>

              {/* The BAR stops at full — there is no more room to draw — while
                  the figures below it keep telling the truth past 100%. */}
              <div
                className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(budget.percentage, 100))}
                aria-valuetext={`${formatPercentage(budget.percentage, 0)}% of ${getBudgetCategoryLabel(budget)} budget used`}
              >
                <div
                  className={`h-2 rounded-full transition-all ${getProgressColor(budget.percentage)}`}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-body">
                <span className="text-gray-600 dark:text-gray-400">
                  {`${formatPercentage(budget.percentage, 0)}% used`}
                </span>
                <span className={`font-medium ${
                  budget.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {budget.remaining >= 0
                    ? `${formatCurrency(budget.remaining)} remaining`
                    : `over budget by ${formatCurrency(Math.abs(budget.remaining))}`}
                </span>
              </div>

              {/* Named where the wrong figure is read, and by its consequence:
                  no rate is applied to another currency in this wave, so the
                  spend shown is short of what was actually spent. */}
              {/* Neutral, permanent, no tint and no icon — the ruling on
                  caveats. "Spending on accounts in another currency is left
                  out" is a standing truth about what this figure can cover, the
                  same species as the uncategorised note on the Reports gallery.
                  Amber made it look like a transient problem with the data,
                  which is the opposite of what it is. */}
              {budget.excludedForeignCount > 0 && (
                <p className="text-dense text-gray-500 dark:text-gray-400">
                  Spending on accounts in another currency is left out, so you have spent more than this.
                </p>
              )}
            </div>
          </div>
        ))}
          </div>

          {budgets.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700">
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
        // One line per category (Money's model): when the chosen category
        // already has a budget, the modal offers to edit THAT one instead of
        // adding a second that would double-count.
        onEditExisting={setEditingBudget}
      />

      <PageTip
        id="budget-intro"
        title="Track your spending with budgets"
        description="Set monthly, weekly, or yearly budgets for each category. The progress bars show how much you've spent versus your limit. Try envelope budgeting or zero-based budgeting for different approaches."
      />
    </PageWrapper>
  );
}
