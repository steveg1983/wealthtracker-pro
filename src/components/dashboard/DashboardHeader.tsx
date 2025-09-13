import { memo, useEffect } from 'react';
import { logger } from '../../services/loggingService';
import {
  PlusCircleIcon,
  EditIcon,
  SaveIcon,
  GridIcon as LayoutIcon
} from '../icons';

interface DashboardHeaderProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onAddWidget: () => void;
  onShowTemplates: () => void;
}

/**
 * Dashboard header with edit controls
 * Extracted from OptimizedDashboard for single responsibility
 */
export const DashboardHeader = memo(function DashboardHeader({
  isEditMode,
  onToggleEditMode,
  onAddWidget,
  onShowTemplates
}: DashboardHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardHeader component initialized', {
      componentName: 'DashboardHeader'
    });
  }, []);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <div className="flex items-center gap-4">
          {isEditMode ? (
            <>
              <button
                onClick={onAddWidget}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <PlusCircleIcon size={20} />
                Add Widget
              </button>
              <button
                onClick={onToggleEditMode}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <SaveIcon size={20} />
                Save Layout
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onShowTemplates}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <LayoutIcon size={20} />
                Templates
              </button>
              <button
                onClick={onToggleEditMode}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <EditIcon size={20} />
                Edit Dashboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Mode Instructions */}
      {isEditMode && (
        <div className="bg-blue-50 dark:bg-gray-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <LayoutIcon size={20} />
            <span className="font-medium">Edit Mode Active</span>
          </div>
          <p className="text-sm text-blue-700 dark:text-gray-300 mt-1">
            Drag widgets to reorder, click settings to configure, or remove widgets you don't need.
          </p>
        </div>
      )}
    </>
  );
});