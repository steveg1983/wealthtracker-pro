import React, { memo } from 'react';
import { logger } from '../../services/loggingService';

interface EmptyStateProps {
  onClearFilters: () => void;
}

/**
 * Empty state component for when no banks match filter criteria
 * Provides action to clear filters and start over
 */
export const EmptyState = memo(function EmptyState({
  onClearFilters
}: EmptyStateProps): React.JSX.Element {
  try {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          No banks found matching your search criteria.
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
          Try adjusting your search terms or clearing the filters to see more options.
        </p>
        <button
          onClick={onClearFilters}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Clear all filters
        </button>
      </div>
    );
  } catch (error) {
    logger.error('EmptyState render error:', error);
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">
          Error displaying empty state
        </p>
      </div>
    );
  }
});