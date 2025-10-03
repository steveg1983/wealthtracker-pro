import React, { useEffect, memo } from 'react';
import { PlusIcon, AlertCircleIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { SharedBudget } from '../../services/sharedFinanceService';
import type { Category } from '../../types';
import type { HouseholdMember } from '../../services/householdService';
import { useLogger } from '../services/ServiceProvider';

interface SharedBudgetsListProps {
  sharedBudgets: SharedBudget[];
  memberSpending: (budget: SharedBudget) => Map<string, number>;
  calculateSpending: (budget: SharedBudget) => number;
  categories: Category[];
  householdMembers: HouseholdMember[];
  canEdit: boolean;
  onCreateBudget: () => void;
}

export const SharedBudgetsList = memo(function SharedBudgetsList({ sharedBudgets,
  memberSpending,
  calculateSpending,
  categories,
  householdMembers,
  canEdit,
  onCreateBudget
 }: SharedBudgetsListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SharedBudgetsList component initialized', {
      componentName: 'SharedBudgetsList'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div className="space-y-4">
      {/* Create Button */}
      {canEdit && (
        <button
          onClick={onCreateBudget}
          className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
        >
          <PlusIcon size={20} />
          Create Shared Budget
        </button>
      )}

      {/* Budgets List */}
      {sharedBudgets.map(budget => {
        const spending = calculateSpending(budget);
        const memberSpendingMap = memberSpending(budget);
        const percentage = (spending / budget.amount) * 100;
        const isExceeded = spending > budget.amount;

        return (
          <div key={budget.id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{budget.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {categories.find(c => c.id === (budget as any).categoryId)?.name || (budget as any).categoryId} • {budget.period}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {formatCurrency(spending)} / {formatCurrency(budget.amount)}
                </p>
                <p className={`text-sm ${isExceeded ? 'text-red-600' : 'text-gray-600'}`}>
                  {percentage.toFixed(0)}% used
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    isExceeded ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>

            {/* Member Breakdown */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Member Spending:</p>
              {householdMembers.map(member => {
                const amount = memberSpendingMap.get(member.id) || 0;
                return (
                  <div key={member.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <span>{member.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                );
              })}
            </div>

            {/* Budget Settings */}
            {budget.approvalRequired && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500">
                  <AlertCircleIcon size={12} className="inline mr-1" />
                  Changes over {formatCurrency(budget.approvalThreshold)} require approval
                </p>
              </div>
            )}
          </div>
        );
      })}

      {sharedBudgets.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No shared budgets yet
        </div>
      )}
    </div>
  );
});
