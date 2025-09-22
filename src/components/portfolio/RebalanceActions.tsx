import React, { useEffect, memo } from 'react';
import { ArrowRightIcon, TrendingUpIcon, TrendingDownIcon, AlertCircleIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { RebalanceAction } from '../../services/portfolioRebalanceService';
import { useLogger } from '../services/ServiceProvider';

interface RebalanceActionsProps {
  actions: RebalanceAction[];
  onExecute: () => void;
}

export const RebalanceActions = memo(function RebalanceActions({ actions, 
  onExecute 
 }: RebalanceActionsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RebalanceActions component initialized', {
      componentName: 'RebalanceActions'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  if (actions.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 text-center">
        <p className="text-green-700 dark:text-green-300">
          Your portfolio is balanced according to your target allocation.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Rebalancing Actions</h3>
      
      <div className="space-y-3 mb-6">
        {actions.map((action, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-4 rounded-lg border ${
              action.action === 'buy' 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                : action.action === 'sell'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3">
              {action.action === 'buy' ? (
                <TrendingUpIcon size={20} className="text-green-600" />
              ) : action.action === 'sell' ? (
                <TrendingDownIcon size={20} className="text-red-600" />
              ) : (
                <ArrowRightIcon size={20} className="text-gray-600" />
              )}
              
              <div>
                <p className="font-medium">
                  {action.action} {action.symbol}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {action.shares.toFixed(2)} shares
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="font-semibold">
                {formatCurrency(action.amount.toNumber())}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Summary */}
      <div className="border-t dark:border-gray-700 pt-4 mb-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Total Buy</span>
          <span className="text-green-600 font-medium">
            {formatCurrency(
              actions
                .filter(a => a.action === 'buy')
                .reduce((sum, a) => sum + a.amount.toNumber(), 0)
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Total Sell</span>
          <span className="text-red-600 font-medium">
            {formatCurrency(
              actions
                .filter(a => a.action === 'sell')
                .reduce((sum, a) => sum + a.amount.toNumber(), 0)
            )}
          </span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Net Cash Required</span>
          <span>
            {formatCurrency(
              actions
                .filter(a => a.action === 'buy')
                .reduce((sum, a) => sum + a.amount.toNumber(), 0) -
              actions
                .filter(a => a.action === 'sell')
                .reduce((sum, a) => sum + a.amount.toNumber(), 0)
            )}
          </span>
        </div>
      </div>
      
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircleIcon className="text-amber-600 dark:text-amber-400 mt-0.5" size={16} />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            Review these suggested actions carefully. Consider tax implications and trading costs before executing.
          </div>
        </div>
      </div>
      
      <button
        onClick={onExecute}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Generate Rebalance Orders
      </button>
    </div>
  );
});