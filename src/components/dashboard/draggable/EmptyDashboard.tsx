import { memo, useEffect } from 'react';
import { PlusCircleIcon, GridIcon } from '../../icons';
import { useLogger } from '../services/ServiceProvider';

interface EmptyDashboardProps {
  onAddWidget: () => void;
  onOpenTemplates: () => void;
}

/**
 * Empty dashboard state component
 * Shown when no widgets are present
 */
export const EmptyDashboard = memo(function EmptyDashboard({ onAddWidget,
  onOpenTemplates
 }: EmptyDashboardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyDashboard component initialized', {
      componentName: 'EmptyDashboard'
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
      <div className="text-center space-y-4">
        <div className="text-gray-400 dark:text-gray-500">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
        </div>
        
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No widgets added yet
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by adding widgets to your dashboard
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onAddWidget}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center"
          >
            <PlusCircleIcon size={20} />
            Add Your First Widget
          </button>
          
          <button
            onClick={onOpenTemplates}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 justify-center"
          >
            <GridIcon size={20} />
            Use a Template
          </button>
        </div>
      </div>
    </div>
  );
});
