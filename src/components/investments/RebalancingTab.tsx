import React, { useEffect, memo } from 'react';
import { TargetIcon } from '../icons';
import type { RebalancingSuggestion } from '../../services/investmentEnhancementService';
import { logger } from '../../services/loggingService';

interface RebalancingTabProps {
  suggestions: RebalancingSuggestion[];
  formatCurrency: (value: number) => string;
  getActionClass: (action: 'buy' | 'sell') => string;
}

const RebalancingTab = memo(function RebalancingTab({
  suggestions,
  formatCurrency,
  getActionClass
}: RebalancingTabProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RebalancingTab component initialized', {
      componentName: 'RebalancingTab'
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Portfolio Rebalancing</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Keep your portfolio aligned with your target asset allocation.
        </p>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <TargetIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>Your portfolio is well-balanced!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <SuggestionCard
              key={index}
              suggestion={suggestion}
              formatCurrency={formatCurrency}
              getActionClass={getActionClass}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  formatCurrency,
  getActionClass
}: {
  suggestion: RebalancingSuggestion;
  formatCurrency: (value: number) => string;
  getActionClass: (action: 'buy' | 'sell') => string;
}): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionClass(suggestion.action)}`}>
              {suggestion.action.toUpperCase()}
            </span>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {suggestion.name}
            </h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {suggestion.reason}
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-700 dark:text-gray-300">
              Amount: <strong>{formatCurrency(typeof (suggestion as any).amount?.toNumber === 'function' ? (suggestion as any).amount.toNumber() : (suggestion as any).amount)}</strong>
            </span>
            <span className="text-gray-700 dark:text-gray-300">
              Shares: <strong>{suggestion.shares}</strong>
            </span>
          </div>
        </div>
        <button className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 text-sm">
          Execute
        </button>
      </div>
    </div>
  );
});

export default RebalancingTab;
