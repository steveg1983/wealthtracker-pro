/**
 * Auto Sync Status Component
 * Shows auto-sync configuration status
 */

import React, { useEffect } from 'react';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { useLogger } from '../services/ServiceProvider';

interface AutoSyncStatusProps {
  autoRefresh: boolean;
}

const AutoSyncStatus = React.memo(({ autoRefresh }: AutoSyncStatusProps) => {
  return (
    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <div className="flex items-center">
        <CloudArrowUpIcon className="h-4 w-4 mr-1" />
        <span>
          Auto-sync: {autoRefresh ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      {autoRefresh && (
        <span>Every 5 minutes</span>
      )}
    </div>
  );
});

AutoSyncStatus.displayName = 'AutoSyncStatus';

export default AutoSyncStatus;