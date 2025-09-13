/**
 * Search Aggregations Component
 * Displays search result statistics
 */

import React, { useEffect } from 'react';
import { formatCurrency } from '../../utils/formatters';
import type { SearchAggregations } from '../../services/enhancedSearchBarService';
import { logger } from '../../services/loggingService';

interface SearchAggregationsProps {
  aggregations: SearchAggregations | undefined;
  totalResults: number;
  isVisible: boolean;
}

const SearchAggregationsComponent = React.memo(({
  aggregations,
  totalResults,
  isVisible
}: SearchAggregationsProps) => {
  if (!isVisible || !aggregations || totalResults === 0) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Results Count */}
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Results</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {totalResults.toLocaleString()}
        </p>
      </div>

      {/* Total Amount */}
      {aggregations.totalAmount !== undefined && (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatCurrency(aggregations.totalAmount)}
          </p>
        </div>
      )}

      {/* Average Amount */}
      {aggregations.averageAmount !== undefined && (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Average</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatCurrency(aggregations.averageAmount)}
          </p>
        </div>
      )}

      {/* Type Breakdown */}
      {aggregations.countByType && Object.keys(aggregations.countByType).length > 0 && (
        <div className="md:col-span-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">By Type</p>
          <div className="flex gap-4">
            {Object.entries(aggregations.countByType).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                  {type}:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

SearchAggregationsComponent.displayName = 'SearchAggregations';

export default SearchAggregationsComponent;