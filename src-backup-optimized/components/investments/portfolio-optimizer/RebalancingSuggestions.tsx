import { memo, useEffect } from 'react';
import { RefreshCwIcon } from '../../icons';
import { formatCurrency } from '../../../utils/formatters';
import type { Asset } from '../../../services/portfolioOptimizationService';

type RebalancingSuggestion = {
  symbol: string;
  action: 'buy' | 'sell';
  amount: number;
};
import { useLogger } from '../services/ServiceProvider';

interface RebalancingSuggestionsProps {
  suggestions: RebalancingSuggestion[];
  assets: Asset[];
}

/**
 * Rebalancing suggestions component
 * Displays recommended trades to achieve optimal allocation
 */
export const RebalancingSuggestions = memo(function RebalancingSuggestions({ suggestions,
  assets
 }: RebalancingSuggestionsProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('RebalancingSuggestions component initialized', {
      componentName: 'RebalancingSuggestions'
    });
  }, []);

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
      <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-3 flex items-center gap-2">
        <RefreshCwIcon size={16} />
        Rebalancing Suggestions
      </h4>
      <div className="space-y-2">
        {suggestions.map(suggestion => {
          const asset = assets.find(a => a.symbol === suggestion.symbol);
          return (
            <div key={suggestion.symbol} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                {asset?.name || suggestion.symbol}
              </span>
              <span className={`font-medium ${
                suggestion.action === 'buy' ? 'text-green-600' : 'text-red-600'
              }`}>
                {suggestion.action === 'buy' ? '+' : '-'}{formatCurrency(suggestion.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
