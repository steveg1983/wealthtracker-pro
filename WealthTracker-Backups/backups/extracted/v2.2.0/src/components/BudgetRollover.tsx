import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { calculateBudgetSpending, calculateBudgetRemaining } from '../utils/calculations-decimal';
import type { DecimalInstance } from '../utils/decimal';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  RepeatIcon,
  InfoIcon,
  SaveIcon,
  SettingsIcon
} from './icons';

interface RolloverSettings {
  enabled: boolean;
  mode: 'percentage' | 'fixed' | 'all';
  percentage: number; // If mode is percentage
  maxAmount?: number; // Optional cap
  excludeCategories: string[];
  autoApply: boolean;
  carryNegative: boolean; // Whether to carry over overages as debt
}

interface RolloverHistory {
  id: string;
  fromPeriod: {
    month: number;
    year: number;
  };
  toPeriod: {
    month: number;
    year: number;
  };
  rollovers: Array<{
    budgetId: string;
    category: string;
    originalBudget: DecimalInstance;
    spent: DecimalInstance;
    remaining: DecimalInstance;
    rolledOver: DecimalInstance;
  }>;
  totalRolledOver: DecimalInstance;
  appliedAt: Date;
}

export default function BudgetRollover() {
  const { categories, transactions, budgets, updateBudget } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [rolloverSettings, setRolloverSettings] = useLocalStorage<RolloverSettings>('rollover-settings', {
    enabled: false,
    mode: 'all',
    percentage: 100,
    excludeCategories: [],
    autoApply: false,
    carryNegative: false
  });
  
  const [rolloverHistory, setRolloverHistory] = useLocalStorage<RolloverHistory[]>('rollover-history', []);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Calculate previous period
  const previousDate = new Date(currentYear, currentMonth - 1, 1);
  const previousMonth = previousDate.getMonth();
  const previousYear = previousDate.getFullYear();

  // Calculate rollover amounts for each budget
  const rolloverData = useMemo(() => {
    // Get transactions from previous month
    const startDate = new Date(previousYear, previousMonth, 1);
    const endDate = new Date(previousYear, previousMonth + 1, 0);
    
    return budgets.map(budget => {
      // Convert budget to decimal for calculations
      const decimalBudget = {
        ...budget,
        amount: toDecimal(budget.amount)
      };
      
      // Convert transactions to decimal for calculations
      const decimalTransactions = transactions.map(t => ({
        ...t,
        amount: toDecimal(t.amount)
      }));
      
      // Calculate spending for this budget's category
      const spent = decimalTransactions
        .filter(t => 
          t.type === 'expense' && 
          (t.category === (budget.categoryId || budget.category)) &&
          t.date >= startDate &&
          t.date <= endDate
        )
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
      const remaining = decimalBudget.amount.minus(spent);
      
      // Calculate rollover amount based on settings
      let rolloverAmount = toDecimal(0);
      
      if (rolloverSettings.enabled && !rolloverSettings.excludeCategories.includes(budget.categoryId)) {
        if (remaining.greaterThan(0) || (remaining.lessThan(0) && rolloverSettings.carryNegative)) {
          switch (rolloverSettings.mode) {
            case 'all':
              rolloverAmount = remaining;
              break;
            case 'percentage':
              rolloverAmount = remaining.times(rolloverSettings.percentage / 100);
              break;
            case 'fixed':
              rolloverAmount = remaining.greaterThan(0) ? remaining : toDecimal(0);
              break;
          }
          
          // Apply max cap if set
          if (rolloverSettings.maxAmount && rolloverAmount.greaterThan(rolloverSettings.maxAmount)) {
            rolloverAmount = toDecimal(rolloverSettings.maxAmount);
          }
        }
      }
      
      return {
        budgetId: budget.id,
        category: (budget.categoryId ?? budget.category ?? ''),
        originalBudget: decimalBudget.amount,
        spent,
        remaining,
        rolloverAmount,
        isEligible: rolloverSettings.enabled && !rolloverSettings.excludeCategories.includes(budget.categoryId),
        willRollover: rolloverAmount.abs().greaterThan(0)
      };
    }).filter((v): v is NonNullable<typeof v> => Boolean(v));
  }, [budgets, transactions, previousMonth, previousYear, rolloverSettings]);

  const totalRollover = rolloverData.reduce((sum, data) => 
    data ? sum.plus(data.rolloverAmount) : sum, toDecimal(0)
  );

  const eligibleBudgets = rolloverData.filter(data => data?.isEligible).length;
  const budgetsWithSurplus = rolloverData.filter(data => data?.remaining.greaterThan(0)).length;
  const budgetsWithDeficit = rolloverData.filter(data => data?.remaining.lessThan(0)).length;

  const applyRollover = () => {
    const rollovers = rolloverData
      .filter(data => data?.willRollover)
      .map(data => {
        
        // Update budget with rollover
        const currentBudget = budgets.find(b => b.id === data.budgetId);
        if (currentBudget) {
          const newAmount = toDecimal(currentBudget.amount).plus(data.rolloverAmount).toNumber();
          updateBudget(data.budgetId, { amount: newAmount });
        }
        
        return {
          budgetId: data.budgetId,
          category: data.category,
          originalBudget: data.originalBudget,
          spent: data.spent,
          remaining: data.remaining,
          rolledOver: data.rolloverAmount
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    // Save to history
    const historyEntry: RolloverHistory = {
      id: Date.now().toString(),
      fromPeriod: { month: previousMonth, year: previousYear },
      toPeriod: { month: currentMonth, year: currentYear },
      rollovers: rollovers,
      totalRolledOver: totalRollover,
      appliedAt: new Date()
    };
    
    setRolloverHistory([historyEntry, ...rolloverHistory]);
    setShowPreview(false);
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month).toLocaleString('default', { month: 'long' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Budget Rollover</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Carry forward unused budget from {getMonthName(previousMonth)} {previousYear}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <SettingsIcon size={16} />
              Settings
            </button>
            <button
              onClick={() => setShowPreview(true)}
              disabled={!rolloverSettings.enabled || totalRollover.equals(0)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                rolloverSettings.enabled && !totalRollover.equals(0)
                  ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <ArrowRightIcon size={16} />
              Preview Rollover
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${rolloverSettings.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Rollover {rolloverSettings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {rolloverSettings.autoApply && (
            <div className="flex items-center gap-2">
              <RepeatIcon size={14} className="text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-500">Auto-apply</span>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {rolloverSettings.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Rollover</p>
              <p className={`text-lg font-semibold ${
                totalRollover.greaterThan(0) 
                  ? 'text-green-600 dark:text-green-400' 
                  : totalRollover.lessThan(0)
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {formatCurrency(totalRollover)}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">Eligible Budgets</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {eligibleBudgets} of {budgets.length}
              </p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <p className="text-xs text-green-700 dark:text-green-300">With Surplus</p>
              <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                {budgetsWithSurplus}
              </p>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <p className="text-xs text-red-700 dark:text-red-300">With Deficit</p>
              <p className="text-lg font-semibold text-red-700 dark:text-red-300">
                {budgetsWithDeficit}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rollover Details */}
      {rolloverSettings.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rolloverData.map((data) => {
            if (!data || !data.isEligible) return null;
            
            const category = categories.find(c => c.id === data.category);
            
            return (
              <div
                key={data.budgetId}
                className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-lg shadow border border-white/20 dark:border-gray-700/50 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">{category?.name || data.category}</h4>
                  {data.willRollover && (
                    <CheckCircleIcon size={16} className="text-green-500" />
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Previous Budget:</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(data.originalBudget)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Spent:</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(data.spent)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                    <span className={data.remaining.greaterThan(0) ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(data.remaining)}
                    </span>
                  </div>
                  {data.willRollover && (
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">Will Rollover:</span>
                      <span className="font-medium text-gray-600 dark:text-gray-500">
                        {formatCurrency(data.rolloverAmount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {rolloverHistory.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rollover History</h3>
          
          <div className="space-y-3">
            {rolloverHistory.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {getMonthName(entry.fromPeriod.month)} → {getMonthName(entry.toPeriod.month)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {entry.rollovers.length} categories • {new Date(entry.appliedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`font-medium ${
                  entry.totalRolledOver.greaterThan(0) 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(entry.totalRolledOver)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rollover Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Budget Rollover
                </label>
                <input
                  type="checkbox"
                  checked={rolloverSettings.enabled}
                  onChange={(e) => setRolloverSettings({
                    ...rolloverSettings,
                    enabled: e.target.checked
                  })}
                  className="rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rollover Mode
                </label>
                <select
                  value={rolloverSettings.mode}
                  onChange={(e) => setRolloverSettings({
                    ...rolloverSettings,
                    mode: e.target.value as RolloverSettings['mode']
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">Roll over all remaining</option>
                  <option value="percentage">Roll over percentage</option>
                  <option value="fixed">Fixed amount only</option>
                </select>
              </div>

              {rolloverSettings.mode === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Percentage to Roll Over
                  </label>
                  <input
                    type="number"
                    value={rolloverSettings.percentage}
                    onChange={(e) => setRolloverSettings({
                      ...rolloverSettings,
                      percentage: parseInt(e.target.value) || 0
                    })}
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum Rollover Amount (Optional)
                </label>
                <input
                  type="number"
                  value={rolloverSettings.maxAmount || ''}
                  onChange={(e) => setRolloverSettings({
                    ...rolloverSettings,
                    maxAmount: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="No limit"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-apply at month end
                </label>
                <input
                  type="checkbox"
                  checked={rolloverSettings.autoApply}
                  onChange={(e) => setRolloverSettings({
                    ...rolloverSettings,
                    autoApply: e.target.checked
                  })}
                  className="rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Carry negative balances
                </label>
                <input
                  type="checkbox"
                  checked={rolloverSettings.carryNegative}
                  onChange={(e) => setRolloverSettings({
                    ...rolloverSettings,
                    carryNegative: e.target.checked
                  })}
                  className="rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Exclude Categories
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {categories.map(category => (
                    <label key={category.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rolloverSettings.excludeCategories.includes(category.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRolloverSettings({
                              ...rolloverSettings,
                              excludeCategories: [...rolloverSettings.excludeCategories, category.id]
                            });
                          } else {
                            setRolloverSettings({
                              ...rolloverSettings,
                              excludeCategories: rolloverSettings.excludeCategories.filter(c => c !== category.id)
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{category.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Rollover Preview
            </h3>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The following amounts will be added to your {getMonthName(currentMonth)} budgets:
            </p>
            
            <div className="space-y-3 mb-6">
              {rolloverData
                .filter(data => data?.willRollover)
                .map((data) => {
                  if (!data) return null;
                  
                  return (
                    <div
                      key={data.budgetId}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{data.category}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatCurrency(data.originalBudget)} → {formatCurrency(toDecimal(budgets.find(b => b.id === data.budgetId)?.amount || 0).plus(data.rolloverAmount))}
                        </p>
                      </div>
                      <span className={`font-medium ${
                        data.rolloverAmount.greaterThan(0)
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        +{formatCurrency(data.rolloverAmount)}
                      </span>
                    </div>
                  );
                })}
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-gray-900 dark:text-white">Total Rollover:</span>
                <span className={`text-lg font-bold ${
                  totalRollover.greaterThan(0)
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(totalRollover)}
                </span>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={applyRollover}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  Apply Rollover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
