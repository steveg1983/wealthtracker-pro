import { memo, useEffect } from 'react';
import { GridIcon, PlusIcon } from '../../icons';
import { useLogger } from '../services/ServiceProvider';

interface EmptyStateProps {
  readOnly: boolean;
  onAddWidget: () => void;
}

/**
 * Empty state component shown when no widgets exist
 */
export const EmptyState = memo(function EmptyState({ readOnly,
  onAddWidget
 }: EmptyStateProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyState component initialized', {
      componentName: 'EmptyState'
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <GridIcon size={64} className="text-gray-300 dark:text-gray-600 mb-4" />
      <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
        No widgets yet
      </h2>
      <p className="text-gray-500 dark:text-gray-500 mb-4">
        Start building your dashboard by adding widgets
      </p>
      {!readOnly && (
        <button
          onClick={onAddWidget}
          className="px-4 py-2 bg-primary text-white rounded-lg flex items-center gap-2 hover:bg-primary-dark transition-colors"
        >
          <PlusIcon size={20} />
          Add Your First Widget
        </button>
      )}
    </div>
  );
});