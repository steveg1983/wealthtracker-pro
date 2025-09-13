import React, { useEffect, memo } from 'react';
import { PiggyBankIcon, TargetIcon, CreditCardIcon, ShieldIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface QuickStatsProps {
  retirementPlansCount: number;
  financialGoalsCount: number;
  debtPlansCount: number;
  insuranceNeedsCount: number;
}

const QuickStats = memo(function QuickStats({
  retirementPlansCount,
  financialGoalsCount,
  debtPlansCount,
  insuranceNeedsCount
}: QuickStatsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('QuickStats component initialized', {
      componentName: 'QuickStats'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Retirement Plans</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {retirementPlansCount}
            </p>
          </div>
          <PiggyBankIcon size={24} className="text-purple-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Goals</p>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
              {financialGoalsCount}
            </p>
          </div>
          <TargetIcon size={24} className="text-blue-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Debt Plans</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {debtPlansCount}
            </p>
          </div>
          <CreditCardIcon size={24} className="text-red-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Insurance Items</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {insuranceNeedsCount}
            </p>
          </div>
          <ShieldIcon size={24} className="text-green-500" />
        </div>
      </div>
    </div>
  );
});

export default QuickStats;