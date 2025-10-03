import { memo, useEffect } from 'react';
import { PiggyBankIcon, DollarSignIcon, CheckCircleIcon, AlertCircleIcon } from '../icons';
import type { DecimalInstance } from '../../types/decimal-types';
import { useLogger } from '../services/ServiceProvider';

interface EnvelopeSummaryProps {
  totalBudgeted: DecimalInstance;
  totalSpent: DecimalInstance;
  totalRemaining: DecimalInstance;
  overbudgetCount: number;
  formatCurrency: (value: DecimalInstance) => string;
}

/**
 * Envelope summary cards component
 * Displays overview statistics for envelope budgeting
 */
export const EnvelopeSummary = memo(function EnvelopeSummary({ totalBudgeted,
  totalSpent,
  totalRemaining,
  overbudgetCount,
  formatCurrency
 }: EnvelopeSummaryProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('EnvelopeSummary component initialized', {
      componentName: 'EnvelopeSummary'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <div className="flex items-center gap-2 mb-2">
          <PiggyBankIcon className="text-amber-600 dark:text-amber-400" size={20} />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Total Budgeted</span>
        </div>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(totalBudgeted)}
        </span>
      </div>
      
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <DollarSignIcon className="text-red-600" size={20} />
          <span className="text-sm font-medium text-red-800 dark:text-red-300">Total Spent</span>
        </div>
        <span className="text-2xl font-bold text-red-900 dark:text-red-100">
          {formatCurrency(totalSpent)}
        </span>
      </div>
      
      <div className={`rounded-lg p-4 ${totalRemaining.greaterThanOrEqualTo(0) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircleIcon className={`${totalRemaining.greaterThanOrEqualTo(0) ? 'text-green-600' : 'text-red-600'}`} size={20} />
          <span className={`text-sm font-medium ${totalRemaining.greaterThanOrEqualTo(0) ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
            Remaining
          </span>
        </div>
        <span className={`text-2xl font-bold ${totalRemaining.greaterThanOrEqualTo(0) ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
          {formatCurrency(totalRemaining)}
        </span>
      </div>
      
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircleIcon className="text-orange-600" size={20} />
          <span className="text-sm font-medium text-orange-800 dark:text-orange-300">Overbudget</span>
        </div>
        <span className="text-2xl font-bold text-orange-900 dark:text-orange-100">
          {overbudgetCount}
        </span>
      </div>
    </div>
  );
});