import { memo, useEffect } from 'react';
import { GridIcon as LayoutIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

interface EmptyStateProps {
  onAddWidget: () => void;
}

/**
 * Empty state when no widgets are present
 */
export const EmptyState = memo(function EmptyState({
  onAddWidget
}: EmptyStateProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyState component initialized', {
      componentName: 'EmptyState'
    });
  }, []);

  return (
    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <LayoutIcon size={48} className="mx-auto text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        No widgets added
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Start customizing your dashboard by adding widgets
      </p>
      <button
        onClick={onAddWidget}
        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        Add Your First Widget
      </button>
    </div>
  );
});