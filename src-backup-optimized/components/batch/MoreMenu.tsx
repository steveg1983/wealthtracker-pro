/**
 * More Menu Component
 * Dropdown menu for secondary batch operations
 */

import React, { useEffect, memo } from 'react';
import { GripVerticalIcon as MoreVerticalIcon } from '../icons';
import { Button } from '../common/Button';
import type { BatchOperation } from '../../hooks/useBatchOperations';
import { useLogger } from '../services/ServiceProvider';

interface MoreMenuProps {
  operations: BatchOperation[];
  isProcessing: boolean;
  showMenu: boolean;
  onToggleMenu: () => void;
  onOperationClick: (operation: BatchOperation) => void;
  onInvertSelection: () => void;
}

export const MoreMenu = memo(function MoreMenu({ operations,
  isProcessing,
  showMenu,
  onToggleMenu,
  onOperationClick,
  onInvertSelection
 }: MoreMenuProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('MoreMenu component initialized', {
      componentName: 'MoreMenu'
    });
  }, []);

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={onToggleMenu}
        leftIcon={MoreVerticalIcon}
      >
        More
      </Button>
      
      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggleMenu} />
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            <div className="py-1">
              {operations.map(operation => (
                <button
                  key={operation.id}
                  onClick={() => onOperationClick(operation)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  disabled={isProcessing}
                >
                  {operation.label}
                </button>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              <button
                onClick={onInvertSelection}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Invert Selection
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
