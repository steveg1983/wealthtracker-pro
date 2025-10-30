import React, { memo } from 'react';
import { ResponsiveTable } from './common/ResponsiveTable';
import type { Budget } from '../types';
import { formatDecimalFixed } from '@wealthtracker/utils';

interface MobileBudgetTableProps {
  budgets: Budget[];
  formatCurrency: (amount: number) => string;
  onBudgetClick?: (budget: Budget) => void;
  currentPeriod: string;
}

const MobileBudgetTable = memo(function MobileBudgetTable({
  budgets,
  formatCurrency,
  onBudgetClick,
  currentPeriod
}: MobileBudgetTableProps): React.JSX.Element {
  const columns = [
    {
      key: 'name',
      label: 'Category',
      priority: 1,
      render: (budget: Budget) => (
        <div className="flex items-center gap-2">
          {budget.color && (
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: budget.color }}
            />
          )}
          <span className="font-medium">{budget.name || budget.categoryId}</span>
        </div>
      )
    },
    {
      key: 'progress',
      label: 'Progress',
      priority: 2,
      mobileLabel: 'Spent',
      render: (budget: Budget) => {
        const spent = budget.spent || 0;
        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
        const isOverBudget = percentage > 100;
        
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className={isOverBudget ? 'text-red-600 dark:text-red-400' : ''}>
                {formatCurrency(spent)}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                / {formatCurrency(budget.amount)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isOverBudget 
                    ? 'bg-red-500 dark:bg-red-400' 
                    : percentage > 80 
                    ? 'bg-yellow-500 dark:bg-yellow-400' 
                    : 'bg-green-500 dark:bg-green-400'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {formatDecimalFixed(percentage, 0)}%
            </div>
          </div>
        );
      }
    },
    {
      key: 'remaining',
      label: 'Remaining',
      priority: 3,
      hideOnMobile: true,
      render: (budget: Budget) => {
        const remaining = budget.amount - (budget.spent || 0);
        return (
          <span className={remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
            {formatCurrency(Math.abs(remaining))}
            {remaining < 0 && ' over'}
          </span>
        );
      }
    },
    {
      key: 'period',
      label: 'Period',
      priority: 4,
      hideOnMobile: true,
      render: () => currentPeriod
    }
  ];

  return (
    <ResponsiveTable
      data={budgets}
      columns={columns}
      getRowKey={(budget) => budget.id}
      {...(onBudgetClick ? { onRowClick: onBudgetClick } : {})}
      emptyMessage="No budgets configured"
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
      mobileCardClassName="px-4 py-2"
    />
  );
});

export default MobileBudgetTable;
