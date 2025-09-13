/**
 * Reconciliation Balance Summary Component
 * World-class balance visualization with target matching
 */

import React, { useEffect, memo, useCallback } from 'react';
import { RefreshCwIcon as RefreshCw, AlertCircleIcon as AlertCircle } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { logger } from '../../services/loggingService';

interface ReconciliationBalanceSummaryProps {
  currentBalance: number;
  projectedBalance: number;
  targetBalance: string;
  onTargetChange: (value: string) => void;
  onAutoMatch: () => void;
}

/**
 * Premium balance summary with auto-matching
 */
export const ReconciliationBalanceSummary = memo(function ReconciliationBalanceSummary({
  currentBalance,
  projectedBalance,
  targetBalance,
  onTargetChange,
  onAutoMatch
}: ReconciliationBalanceSummaryProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ReconciliationBalanceSummary component initialized', {
      componentName: 'ReconciliationBalanceSummary'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();
  
  const handleTargetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onTargetChange(e.target.value);
  }, [onTargetChange]);

  const targetDifference = targetBalance 
    ? Math.abs(parseFloat(targetBalance) - projectedBalance)
    : 0;
  
  const showWarning = targetBalance && targetDifference > 0.01;

  return (
    <div className="px-6 py-4 bg-blue-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BalanceCard
          label="Current Balance"
          value={formatCurrency(currentBalance)}
          variant="primary"
        />
        
        <BalanceCard
          label="After Reconciliation"
          value={formatCurrency(projectedBalance)}
          variant="secondary"
        />
        
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
            Target Balance (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={targetBalance}
              onChange={handleTargetChange}
              placeholder="0.00"
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              aria-label="Target balance"
            />
            <button
              onClick={onAutoMatch}
              disabled={!targetBalance}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              title="Auto-select transactions to match target"
              aria-label="Auto-match transactions"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>
      
      {showWarning && (
        <DifferenceWarning difference={formatCurrency(targetDifference)} />
      )}
    </div>
  );
});

/**
 * Balance card
 */
const BalanceCard = memo(function BalanceCard({
  label,
  value,
  variant
}: {
  label: string;
  value: string;
  variant: 'primary' | 'secondary';
}): React.JSX.Element {
  const textClass = variant === 'primary' 
    ? 'text-gray-900 dark:text-white'
    : 'text-gray-600 dark:text-gray-500';

  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${textClass}`}>{value}</p>
    </div>
  );
});

/**
 * Difference warning
 */
const DifferenceWarning = memo(function DifferenceWarning({
  difference
}: {
  difference: string;
}): React.JSX.Element {
  return (
    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Difference of {difference} from target
        </p>
      </div>
    </div>
  );
});