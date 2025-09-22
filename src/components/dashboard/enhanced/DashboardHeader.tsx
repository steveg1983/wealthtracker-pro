import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';
import {
  PlusCircleIcon,
  EditIcon,
  SaveIcon,
  GridIcon as LayoutIcon
} from '../../icons';

interface DashboardHeaderProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onAddWidget: () => void;
  onShowTemplates: () => void;
  onSaveLayout: () => void;
}

/**
 * Dashboard header component with mode controls
 */
export const DashboardHeader = memo(function DashboardHeader({ isEditMode,
  onToggleEditMode,
  onAddWidget,
  onShowTemplates,
  onSaveLayout
 }: DashboardHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardHeader component initialized', {
      componentName: 'DashboardHeader'
    });
  }, []);

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Dashboard
      </h1>
      
      <div className="flex items-center gap-2">
        {isEditMode ? (
          <>
            <button
              onClick={onAddWidget}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <PlusCircleIcon size={20} />
              Add Widget
            </button>
            <button
              onClick={onSaveLayout}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
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
  );
});