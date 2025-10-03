/**
 * Dashboard Controls Component
 * Control buttons for dashboard management
 */

import React, { useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';
import { 
  PlusIcon, 
  SettingsIcon, 
  GridIcon, 
  RefreshCwIcon
} from '../icons';

interface DashboardControlsProps {
  isDragMode: boolean;
  isRefreshing: boolean;
  onRefreshAll: () => void;
  onToggleDragMode: () => void;
  onShowSettings: () => void;
  onShowAddWidget: () => void;
}

const DashboardControls = React.memo(({
  isDragMode,
  isRefreshing,
  onRefreshAll,
  onToggleDragMode,
  onShowSettings,
  onShowAddWidget
}: DashboardControlsProps) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Customize your financial overview
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={onRefreshAll}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
        >
          <RefreshCwIcon size={16} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh All
        </button>
        
        <button
          onClick={onToggleDragMode}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isDragMode 
              ? 'bg-[var(--color-primary)] text-white' 
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <GridIcon size={16} />
          {isDragMode ? 'Exit Edit' : 'Edit Layout'}
        </button>
        
        <button
          onClick={onShowSettings}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <SettingsIcon size={16} />
          Settings
        </button>
        
        <button
          onClick={onShowAddWidget}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Add Widget
        </button>
      </div>
    </div>
  );
});

DashboardControls.displayName = 'DashboardControls';

export default DashboardControls;