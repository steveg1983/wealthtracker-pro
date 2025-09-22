import React, { useEffect, memo } from 'react';
import { useLogger } from '../services/ServiceProvider';

export type FilterOption = 'all' | 'active' | 'cancelled' | 'trial' | 'paused';
export type SortOption = 'nextPayment' | 'amount' | 'merchant';

interface SubscriptionFiltersProps {
  filter: FilterOption;
  sortBy: SortOption;
  onFilterChange: (filter: FilterOption) => void;
  onSortChange: (sortBy: SortOption) => void;
}

const SubscriptionFilters = memo(function SubscriptionFilters({ filter,
  sortBy,
  onFilterChange,
  onSortChange
 }: SubscriptionFiltersProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SubscriptionFilters component initialized', {
      componentName: 'SubscriptionFilters'
    });
  }, []);

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="filter-select" className="text-sm text-gray-600 dark:text-gray-400">
          Filter:
        </label>
        <select
          id="filter-select"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as FilterOption)}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          aria-label="Filter subscriptions by status"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="sort-select" className="text-sm text-gray-600 dark:text-gray-400">
          Sort by:
        </label>
        <select
          id="sort-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          aria-label="Sort subscriptions by"
        >
          <option value="nextPayment">Next Payment</option>
          <option value="amount">Amount</option>
          <option value="merchant">Merchant</option>
        </select>
      </div>
    </div>
  );
});

export default SubscriptionFilters;