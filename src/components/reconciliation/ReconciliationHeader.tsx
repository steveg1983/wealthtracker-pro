/**
 * Reconciliation Header Component
 * World-class header with clear account information
 */

import React, { useEffect, memo } from 'react';
import { XIcon as X } from '../icons';
import { logger } from '../../services/loggingService';

interface ReconciliationHeaderProps {
  accountName: string;
  unclearedCount: number;
  onClose: () => void;
}

/**
 * Premium header with account context
 */
export const ReconciliationHeader = memo(function ReconciliationHeader({
  accountName,
  unclearedCount,
  onClose
}: ReconciliationHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ReconciliationHeader component initialized', {
      componentName: 'ReconciliationHeader'
    });
  }, []);

  return (
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Reconcile {accountName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {unclearedCount} uncleared transaction{unclearedCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label="Close reconciliation"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
});