import React, { useEffect, memo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import { useLogger } from '../services/ServiceProvider';
import {
  ZapIcon,
  TrendingDownIcon,
  CalculatorIcon,
  BarChart3Icon
} from '../icons';

interface StrategySelectionProps {
  strategy: 'avalanche' | 'snowball' | 'custom';
  extraPayment: number;
  availableMonthlyPayment: number;
  onStrategyChange: (strategy: 'avalanche' | 'snowball' | 'custom') => void;
  onExtraPaymentChange: (amount: number) => void;
  onCalculate: () => void;
  onSave: () => void;
}

export const StrategySelection = memo(function StrategySelection({ strategy,
  extraPayment,
  availableMonthlyPayment,
  onStrategyChange,
  onExtraPaymentChange,
  onCalculate,
  onSave
 }: StrategySelectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('StrategySelection component initialized', {
      componentName: 'StrategySelection'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        Payoff Strategy
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => onStrategyChange('avalanche')}
          className={`p-4 rounded-lg border-2 transition-all ${
            strategy === 'avalanche'
              ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <ZapIcon size={24} className="mb-2 text-gray-600 dark:text-gray-500" />
          <h4 className="font-medium text-gray-900 dark:text-white">Avalanche</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Pay highest interest rate first (saves most money)
          </p>
        </button>
        
        <button
          onClick={() => onStrategyChange('snowball')}
          className={`p-4 rounded-lg border-2 transition-all ${
            strategy === 'snowball'
              ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <TrendingDownIcon size={24} className="mb-2 text-green-600 dark:text-green-400" />
          <h4 className="font-medium text-gray-900 dark:text-white">Snowball</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Pay smallest balance first (quick wins)
          </p>
        </button>
        
        <button
          onClick={() => onStrategyChange('custom')}
          className={`p-4 rounded-lg border-2 transition-all ${
            strategy === 'custom'
              ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <CalculatorIcon size={24} className="mb-2 text-purple-600 dark:text-purple-400" />
          <h4 className="font-medium text-gray-900 dark:text-white">Custom</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Choose your own order
          </p>
        </button>
      </div>
      
      {/* Extra Payment Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Extra Monthly Payment
        </label>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={extraPayment}
            onChange={(e) => onExtraPaymentChange(Number(e.target.value))}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            step="50"
          />
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Suggested: {formatCurrency(availableMonthlyPayment)}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Adding extra payments can significantly reduce your payoff time and interest paid
        </p>
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-between items-center mt-6">
        <button
          onClick={onCalculate}
          className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <BarChart3Icon size={16} />
          Calculate Projection
        </button>
        
        <button
          onClick={onSave}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Save Plan
        </button>
      </div>
    </div>
  );
});