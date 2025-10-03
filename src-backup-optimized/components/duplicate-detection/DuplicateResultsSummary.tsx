import { memo, useEffect } from 'react';
import { AlertTriangleIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface DuplicateResultsSummaryProps {
  groupsCount: number;
  isImport: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

/**
 * Duplicate results summary component
 * Shows summary of detected duplicates with bulk actions
 */
export const DuplicateResultsSummary = memo(function DuplicateResultsSummary({ groupsCount,
  isImport,
  onSelectAll,
  onDeselectAll
 }: DuplicateResultsSummaryProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DuplicateResultsSummary component initialized', {
      componentName: 'DuplicateResultsSummary'
    });
  }, []);

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon className="text-orange-600 dark:text-orange-400 mt-0.5" size={20} />
        <div className="flex-1">
          <h4 className="font-medium text-orange-900 dark:text-orange-300">
            {isImport 
              ? `Found ${groupsCount} potential duplicates in import`
              : `Found ${groupsCount} duplicate groups`
            }
          </h4>
          <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
            {isImport 
              ? "Review and deselect any transactions you want to import anyway."
              : "Review and select which duplicates to remove."
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            className="px-3 py-1 text-sm border border-orange-600 text-orange-600 
                     dark:text-orange-400 dark:border-orange-400 rounded hover:bg-orange-50
                     dark:hover:bg-orange-900/20"
          >
            Deselect All
          </button>
        </div>
      </div>
    </div>
  );
});