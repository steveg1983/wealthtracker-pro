/**
 * Account Sync Item Component
 * Displays individual account sync status
 */

import React, { useEffect } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { syncStatusService } from '../../services/syncStatusService';
import type { AccountSyncStatus } from '../../services/syncStatusService';
import StatusIcon from './StatusIcon';
import { useLogger } from '../services/ServiceProvider';

interface AccountSyncItemProps {
  status: AccountSyncStatus;
  isOnline: boolean;
  onSync: (accountId: string) => void;
}

const AccountSyncItem = React.memo(({
  status,
  isOnline,
  onSync
}: AccountSyncItemProps) => {
  const statusColor = syncStatusService.getStatusColor(status.status);
  const statusMessage = syncStatusService.getAccountStatusMessage(status);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div className={`mr-2 ${statusColor}`}>
            <StatusIcon status={status.status} />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
              {status.accountName}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {statusMessage}
            </p>
          </div>
        </div>
        
        {/* Individual Sync Button */}
        {status.status !== 'syncing' && isOnline && (
          <button
            onClick={() => onSync(status.accountId)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-500 transition-colors"
            title="Sync this account"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        )}
        
        {/* Progress Indicator */}
        {status.status === 'syncing' && status.totalItems && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {status.itemsSynced}/{status.totalItems}
          </div>
        )}
      </div>
      
      {/* Sync Progress Bar */}
      {status.status === 'syncing' && status.totalItems && status.totalItems > 0 && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
            <div 
              className="bg-gray-500 h-1 rounded-full transition-all"
              style={{ 
                width: `${((status.itemsSynced || 0) / status.totalItems) * 100}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

AccountSyncItem.displayName = 'AccountSyncItem';

export default AccountSyncItem;