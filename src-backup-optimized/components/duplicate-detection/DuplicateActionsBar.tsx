import { memo, useEffect } from 'react';
import { CheckIcon, TrashIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface DuplicateActionsBarProps {
  hasGroups: boolean;
  isImport: boolean;
  selectedCount: number;
  totalCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Actions bar component for duplicate detection
 * Provides confirm/cancel actions
 */
export const DuplicateActionsBar = memo(function DuplicateActionsBar({ hasGroups,
  isImport,
  selectedCount,
  totalCount,
  onClose,
  onConfirm
 }: DuplicateActionsBarProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DuplicateActionsBar component initialized', {
      componentName: 'DuplicateActionsBar'
    });
  }, []);

  return (
    <div className="flex justify-between mt-6">
      <button
        onClick={onClose}
        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                 dark:hover:bg-gray-700 rounded-lg"
      >
        Cancel
      </button>
      {hasGroups && (
        <button
          onClick={onConfirm}
          disabled={isImport && selectedCount === totalCount}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                   hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImport ? (
            <>
              <CheckIcon size={20} />
              Import {totalCount - selectedCount} Unique Transactions
            </>
          ) : (
            <>
              <TrashIcon size={20} />
              Remove {selectedCount} Duplicates
            </>
          )}
        </button>
      )}
    </div>
  );
});