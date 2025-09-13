/**
 * Recurring Empty State Component
 * World-class empty state following Apple's design principles
 * Provides clear guidance and encourages user action
 */

import React, { useEffect, memo } from 'react';
import { Repeat } from '../icons';
import { logger } from '../../services/loggingService';

interface RecurringEmptyStateProps {
  onAddNew: () => void;
}

/**
 * Elegant empty state with clear call-to-action
 */
export const RecurringEmptyState = memo(function RecurringEmptyState({
  onAddNew
}: RecurringEmptyStateProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RecurringEmptyState component initialized', {
      componentName: 'RecurringEmptyState'
    });
  }, []);

  return (
    <section 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center"
      aria-labelledby="empty-state-title"
    >
      <Repeat 
        size={48} 
        className="mx-auto text-gray-300 dark:text-gray-600 mb-4" 
        aria-hidden="true"
      />
      <h3 
        id="empty-state-title"
        className="text-lg font-medium text-gray-900 dark:text-white mb-2"
      >
        No Recurring Transactions
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
        Set up recurring transactions for regular bills, subscriptions, and income. 
        We'll automatically create them on schedule.
      </p>
      <button
        onClick={onAddNew}
        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        aria-label="Create your first recurring transaction template"
      >
        Create Your First Template
      </button>
    </section>
  );
});