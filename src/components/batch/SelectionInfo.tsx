/**
 * Selection Info Component
 * Shows selection count and controls
 */

import React, { useEffect, memo } from 'react';
import { CheckIcon as CheckSquareIcon, XIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface SelectionInfoProps {
  selectedCount: number;
  isAllSelected: boolean;
  selectionClasses: string;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export const SelectionInfo = memo(function SelectionInfo({ selectedCount,
  isAllSelected,
  selectionClasses,
  onSelectAll,
  onClearSelection
 }: SelectionInfoProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SelectionInfo component initialized', {
      componentName: 'SelectionInfo'
    });
  }, []);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={isAllSelected ? onClearSelection : onSelectAll}
        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded transition-colors"
        title={isAllSelected ? 'Clear selection' : 'Select all'}
      >
        <CheckSquareIcon className={`h-5 w-5 ${selectionClasses}`} />
      </button>
      <span className="font-medium text-gray-900 dark:text-white">
        {selectedCount} selected
      </span>
      <button
        onClick={onClearSelection}
        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded transition-colors"
        title="Clear selection"
      >
        <XIcon className="h-4 w-4 text-gray-500" />
      </button>
    </div>
  );
});
