import { memo, useEffect } from 'react';
import type { ReconciliationResult } from '../../services/reconciliationService';
import { logger } from '../../services/loggingService';

interface ReconciliationResultsProps {
  results: ReconciliationResult | null;
}

/**
 * Reconciliation results component
 * Shows the results of auto-reconciliation
 */
export const ReconciliationResults = memo(function ReconciliationResults({
  results
}: ReconciliationResultsProps): React.JSX.Element {
  // Component initialization logging with error handling
  useEffect(() => {
    try {
      logger.info('ReconciliationResults component initialized', {
        hasResults: !!results,
        componentName: 'ReconciliationResults'
      });
    } catch (error) {
      logger.error('ReconciliationResults initialization failed:', error);
    }
  }, [results]);

  if (!results) return <></>;

  try {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
        Reconciliation Results
      </h4>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Matched:</span>
          <span className="ml-2 font-medium">{results.matched}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Suggestions:</span>
          <span className="ml-2 font-medium">{results.suggestions}</span>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Unmatched:</span>
          <span className="ml-2 font-medium">{results.unmatched}</span>
        </div>
      </div>
      </div>
    );
  } catch (error) {
    logger.error('ReconciliationResults render failed:', error);
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ Reconciliation results unavailable
        </div>
      </div>
    );
  }
});