import React, { useEffect, memo } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '../icons';
import type { DecimalInstance } from '../../types/decimal-types';
import { useLogger } from '../services/ServiceProvider';

export interface RebalancingSuggestion {
  action: 'buy' | 'sell';
  symbol: string;
  shares: number;
  amount: DecimalInstance;
  reason: string;
}

interface RebalancingSuggestionsProps {
  suggestions: RebalancingSuggestion[];
  formatCurrency: (value: DecimalInstance | number) => string;
}

export const RebalancingSuggestions = memo(function RebalancingSuggestions({ suggestions,
  formatCurrency
 }: RebalancingSuggestionsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RebalancingSuggestions component initialized', {
      componentName: 'RebalancingSuggestions'
    });
  }, []);

  if (suggestions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Rebalancing Suggestions
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Your portfolio is well-balanced. No rebalancing actions recommended at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Rebalancing Suggestions
      </h3>
      
      <div className="space-y-4">
        {suggestions.map((suggestion, index) => (
          <div 
            key={`${suggestion.symbol}-${index}`}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <div className={`p-2 rounded-lg ${
                  suggestion.action === 'buy' 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {suggestion.action === 'buy' ? (
                    <ArrowUpIcon className="text-green-600 dark:text-green-400" size={20} />
                  ) : (
                    <ArrowDownIcon className="text-red-600 dark:text-red-400" size={20} />
                  )}
                </div>
                
                <div className="ml-4">
                  <div className="flex items-center">
                    <span className={`text-sm font-medium ${
                      suggestion.action === 'buy' 
                        ? 'text-green-700 dark:text-green-300' 
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {suggestion.action === 'buy' ? 'BUY' : 'SELL'}
                    </span>
                    <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {suggestion.symbol}
                    </span>
                  </div>
                  
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {suggestion.shares} shares • {formatCurrency(suggestion.amount)}
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {suggestion.reason}
                  </div>
                </div>
              </div>
              
              <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                Execute
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <span className="font-medium">Note:</span> These suggestions are based on your target allocation. 
          Always consider transaction costs and tax implications before rebalancing.
        </p>
      </div>
    </div>
  );
});