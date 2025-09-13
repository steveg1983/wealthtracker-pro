import React, { useEffect, memo } from 'react';
import Decimal from 'decimal.js';
import { TrendingUpIcon, TrendingDownIcon, DollarSignIcon } from '../icons';
import type { AccountBreakdown } from './types';
import { logger } from '../../services/loggingService';

type DecimalValue = InstanceType<typeof Decimal>;

interface CurrentStatusCardProps {
  currentNetWorth: DecimalValue;
  assetsBreakdown: AccountBreakdown[];
  liabilitiesBreakdown: AccountBreakdown[];
  monthlyTrend: number;
  formatCurrency: (value: number) => string;
}

export const CurrentStatusCard = memo(function CurrentStatusCard({
  currentNetWorth,
  assetsBreakdown,
  liabilitiesBreakdown,
  monthlyTrend,
  formatCurrency
}: CurrentStatusCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CurrentStatusCard component initialized', {
      componentName: 'CurrentStatusCard'
    });
  }, []);

  const totalAssets = assetsBreakdown.reduce((sum, acc) => sum + acc.balance, 0);
  const totalLiabilities = liabilitiesBreakdown.reduce((sum, acc) => sum + acc.balance, 0);
  const netWorthValue = currentNetWorth.toNumber();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <DollarSignIcon size={20} />
        Current Financial Status
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Worth</p>
          <p className={`text-2xl font-bold ${
            netWorthValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(netWorthValue)}
          </p>
          {monthlyTrend !== 0 && (
            <div className="flex items-center justify-center gap-1 mt-2">
              {monthlyTrend > 0 ? (
                <TrendingUpIcon size={16} className="text-green-500" />
              ) : (
                <TrendingDownIcon size={16} className="text-red-500" />
              )}
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {formatCurrency(Math.abs(monthlyTrend))}/mo
              </span>
            </div>
          )}
        </div>

        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalAssets)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {assetsBreakdown.length} accounts
          </p>
        </div>

        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totalLiabilities)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {liabilitiesBreakdown.length} accounts
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Assets Breakdown */}
        {assetsBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assets</h4>
            <div className="space-y-2">
              {assetsBreakdown.slice(0, 3).map((account, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center gap-2">
                    {account.icon}
                    <span className="text-sm text-gray-900 dark:text-white">{account.name}</span>
                  </div>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liabilities Breakdown */}
        {liabilitiesBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Liabilities</h4>
            <div className="space-y-2">
              {liabilitiesBreakdown.slice(0, 3).map((account, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center gap-2">
                    {account.icon}
                    <span className="text-sm text-gray-900 dark:text-white">{account.name}</span>
                  </div>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});