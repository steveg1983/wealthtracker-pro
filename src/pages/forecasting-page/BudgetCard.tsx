import { memo } from 'react';
import { EditIcon, DeleteIcon } from '../../components/icons';
import { IconButton } from '../../components/icons/IconButton';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal } from '../../utils/decimal';
import type { BudgetWithSpent } from './types';
import type { Category } from '../../types';

interface BudgetCardProps {
  budget: BudgetWithSpent;
  category: Category | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

/**
 * Individual budget card component
 * Displays budget information with progress bar and actions
 */
export const BudgetCard = memo(function BudgetCard({
  budget,
  category,
  onEdit,
  onDelete,
  onToggleActive
}: BudgetCardProps) {
  const { formatCurrency } = useCurrencyDecimal();

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPeriodLabel = () => {
    switch (budget.period) {
      case 'monthly':
        return 'Monthly';
      case 'weekly':
        return 'Weekly';
      case 'yearly':
        return 'Yearly';
      default:
        return budget.period;
    }
  };

  return (
    <div
      className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 ${
        budget.isActive === false ? 'opacity-60' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {category?.name || 'Unknown Category'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {getPeriodLabel()} Budget
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            icon={<EditIcon className="w-4 h-4" />}
            onClick={onEdit}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Edit budget"
            title="Edit budget"
          />
          <IconButton
            icon={<DeleteIcon className="w-4 h-4" />}
            onClick={onDelete}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"
            aria-label="Delete budget"
            title="Delete budget"
          />
          <button
            onClick={onToggleActive}
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
            <span>
              {budget.remaining >= 0 
                ? `${formatCurrency(toDecimal(budget.remaining))} left` 
                : 'Over budget'
              }
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${getProgressColor(budget.percentage)}`}
              style={{ width: `${Math.min(budget.percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});