/**
 * Quick Actions Bar Component
 * World-class action bar for bulk operations
 */

import React, { useEffect, memo } from 'react';
import { logger } from '../../services/loggingService';

interface QuickActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

/**
 * Premium quick actions bar with selection status
 */
export const QuickActionsBar = memo(function QuickActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll
}: QuickActionsBarProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('QuickActionsBar component initialized', {
      componentName: 'QuickActionsBar'
    });
  }, []);

  return (
    <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <SelectionStatus selectedCount={selectedCount} totalCount={totalCount} />
      <SelectionActions onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} />
    </div>
  );
});

/**
 * Selection status
 */
const SelectionStatus = memo(function SelectionStatus({
  selectedCount,
  totalCount
}: {
  selectedCount: number;
  totalCount: number;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {selectedCount} of {totalCount} selected
      </span>
    </div>
  );
});

/**
 * Selection actions
 */
const SelectionActions = memo(function SelectionActions({
  onSelectAll,
  onDeselectAll
}: {
  onSelectAll: () => void;
  onDeselectAll: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onSelectAll}
        className="px-3 py-1 text-sm text-gray-600 dark:text-gray-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Select all transactions"
      >
        Select All
      </button>
      <button
        onClick={onDeselectAll}
        className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
        aria-label="Clear selection"
      >
        Clear Selection
      </button>
    </div>
  );
});