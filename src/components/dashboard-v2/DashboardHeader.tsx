import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';
import { 
  CogIcon,
  PlusIcon,
  Squares2X2Icon,
  LockClosedIcon,
  LockOpenIcon,
  BookmarkIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface DashboardHeaderProps {
  firstName: string | null;
  isEditMode: boolean;
  isRefreshing: boolean;
  onToggleEditMode: () => void;
  onRefresh: () => void;
  onAddWidget: () => void;
  onShowTemplates: () => void;
  onExport: () => void;
}

export const DashboardHeader = memo(function DashboardHeader({ firstName,
  isEditMode,
  isRefreshing,
  onToggleEditMode,
  onRefresh,
  onAddWidget,
  onShowTemplates,
  onExport
 }: DashboardHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardHeader component initialized', {
      componentName: 'DashboardHeader'
    });
  }, []);

  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {isEditMode ? 'Customize your dashboard layout' : 'Your financial overview at a glance'}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {isEditMode && (
          <>
            <button
              onClick={onAddWidget}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add Widget
            </button>
            
            <button
              onClick={onShowTemplates}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Squares2X2Icon className="w-4 h-4" />
              Templates
            </button>
            
            <button
              onClick={onExport}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export
            </button>
          </>
        )}
        
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
        
        <button
          onClick={onToggleEditMode}
          className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            isEditMode 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          {isEditMode ? (
            <>
              <LockOpenIcon className="w-4 h-4" />
              Save & Lock
            </>
          ) : (
            <>
              <CogIcon className="w-4 h-4" />
              Edit Layout
            </>
          )}
        </button>
      </div>
    </div>
  );
});