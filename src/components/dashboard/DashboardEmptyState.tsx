import { memo, useEffect } from 'react';
import { GridIcon as LayoutIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface DashboardEmptyStateProps {
  onAddFirstWidget: () => void;
}

/**
 * Empty state component when no widgets are added
 * Extracted from OptimizedDashboard for single responsibility
 */
export const DashboardEmptyState = memo(function DashboardEmptyState({ 
  onAddFirstWidget 
}: DashboardEmptyStateProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardEmptyState component initialized', {
      componentName: 'DashboardEmptyState'
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
        onClick={onAddFirstWidget}
        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        Add Your First Widget
      </button>
    </div>
  );
});