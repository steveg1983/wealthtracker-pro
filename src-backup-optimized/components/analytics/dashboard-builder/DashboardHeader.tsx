import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';
import {
  GridIcon,
  LockIcon,
  UnlockIcon,
  PlusIcon,
  SaveIcon,
  DownloadIcon,
  SettingsIcon,
  XIcon
} from '../../icons';

interface DashboardHeaderProps {
  dashboardName: string;
  dashboardDescription: string;
  isEditMode: boolean;
  readOnly: boolean;
  onNameChange: (name: string) => void;
  onToggleEditMode: () => void;
  onAddWidget: () => void;
  onSave: () => void;
  onExport: () => void;
  onSettings: () => void;
  onClose?: () => void;
}

/**
 * Dashboard header component with title and action buttons
 */
export const DashboardHeader = memo(function DashboardHeader({ dashboardName,
  dashboardDescription,
  isEditMode,
  readOnly,
  onNameChange,
  onToggleEditMode,
  onAddWidget,
  onSave,
  onExport,
  onSettings,
  onClose
 }: DashboardHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardHeader component initialized', {
      componentName: 'DashboardHeader'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-t-lg border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <GridIcon size={24} className="text-primary" />
          <div>
            {isEditMode ? (
              <input
                type="text"
                value={dashboardName}
                onChange={(e) => onNameChange(e.target.value)}
                className="text-xl font-bold bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-primary focus:outline-none"
                placeholder="Dashboard Name"
              />
            ) : (
              <h1 className="text-xl font-bold">{dashboardName}</h1>
            )}
            {dashboardDescription && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {dashboardDescription}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={onToggleEditMode}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                  isEditMode 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {isEditMode ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
                {isEditMode ? 'Editing' : 'View Only'}
              </button>
              
              {isEditMode && (
                <>
                  <button
                    onClick={onAddWidget}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
                  >
                    <PlusIcon size={16} />
                    Add Widget
                  </button>
                  
                  <button
                    onClick={onSave}
                    className="px-3 py-1.5 bg-gray-600 text-white rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors"
                  >
                    <SaveIcon size={16} />
                    Save
                  </button>
                </>
              )}
              
              <button
                onClick={onExport}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <DownloadIcon size={16} />
                Export
              </button>
              
              <button
                onClick={onSettings}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <SettingsIcon size={20} />
              </button>
            </>
          )}
          
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <XIcon size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});