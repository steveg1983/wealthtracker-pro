/**
 * Overall Status Component
 * Displays the overall sync status and sync all button
 */

import React, { useEffect } from 'react';
import { 
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  WifiIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { syncStatusService } from '../../services/syncStatusService';
import type { OverallStatus as OverallStatusType } from '../../services/syncStatusService';
import { logger } from '../../services/loggingService';

interface OverallStatusProps {
  status: OverallStatusType;
  lastGlobalSync: Date | null;
  isOnline: boolean;
  isSyncing: boolean;
  onSyncAll: () => void;
}

const StatusIcon = React.memo(({ status }: { status: string }) => {
  switch (status) {
    case 'synced':
      return <CheckCircleIcon className="h-5 w-5" />;
    case 'syncing':
      return <ArrowPathIcon className="h-5 w-5 animate-spin" />;
    case 'error':
      return <XCircleIcon className="h-5 w-5" />;
    case 'pending':
      return <ClockIcon className="h-5 w-5" />;
    case 'offline':
      return <WifiIcon className="h-5 w-5" />;
    default:
      return <ExclamationTriangleIcon className="h-5 w-5" />;
  }
});

StatusIcon.displayName = 'StatusIcon';

const OverallStatus = React.memo(({
  status,
  lastGlobalSync,
  isOnline,
  isSyncing,
  onSyncAll
}: OverallStatusProps) => {
  const statusColor = syncStatusService.getStatusColor(status);
  const statusBackground = syncStatusService.getStatusBackground(status);
  const statusTitle = syncStatusService.getStatusTitle(status);

  return (
    <div className={`rounded-lg p-4 ${statusBackground}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`mr-3 ${statusColor}`}>
            <StatusIcon status={status} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {statusTitle}
            </h3>
            {lastGlobalSync && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last sync: {lastGlobalSync.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        
        <button
          onClick={onSyncAll}
          disabled={!isOnline || isSyncing}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !isOnline || isSyncing
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          {isSyncing ? (
            <span className="flex items-center">
              <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
              Syncing
            </span>
          ) : (
            'Sync All'
          )}
        </button>
      </div>
    </div>
  );
});

OverallStatus.displayName = 'OverallStatus';

export default OverallStatus;