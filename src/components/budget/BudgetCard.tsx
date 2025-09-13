import { memo, useEffect } from 'react';
import { EditIcon, TrashIcon, ToggleLeftIcon, ToggleRightIcon } from '../../components/icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { BudgetWithSpent } from '../../services/budgetPageService';
import type { Category } from '../../types';
import { logger } from '../../services/loggingService';

interface BudgetCardProps {
  budget: BudgetWithSpent;
  category: Category | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  getProgressColor: (percentage: number) => string;
  formatPeriodLabel: (period: string) => string;
}

export const BudgetCard = memo(function BudgetCard({
  budget,
  category,
  onEdit,
  onDelete,
  onToggleActive,
  getProgressColor,
  formatPeriodLabel
}: BudgetCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetCard component initialized', {
      componentName: 'BudgetCard'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();
  
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 ${
      !budget.isActive ? 'opacity-60' : ''
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {category?.name || 'Unknown Category'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatPeriodLabel(budget.period)}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onToggleActive}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={budget.isActive ? 'Deactivate' : 'Activate'}
          >
            {budget.isActive ? (
              <ToggleRightIcon size={20} className="text-green-600" />
            ) : (
              <ToggleLeftIcon size={20} className="text-gray-400" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Edit"
          >
            <EditIcon size={16} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon size={16} className="text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Budget</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(budget.amount)}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Spent</span>
          <span className={`font-medium ${
            budget.spent > budget.amount 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-gray-900 dark:text-white'
          }`}>
            {formatCurrency(budget.spent)}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Remaining</span>
          <span className={`font-medium ${
            budget.remaining < 0 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-green-600 dark:text-green-400'
          }`}>
            {formatCurrency(budget.remaining)}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">
              {Math.round(budget.percentage)}% used
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`${getProgressColor(budget.percentage)} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(budget.percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});