/**
 * Offline Indicator Component
 * Shows offline status and pending sync operations
 */

import React from 'react';
import { useOfflineState, useOfflineOperations, type ConflictItem } from '../../pwa/offline-storage';
import { WifiOffIcon, WifiIcon, RefreshCwIcon, AlertCircleIcon } from '../icons';

export const OfflineIndicator: React.FC = () => {
  const offlineState = useOfflineState();
  const { sync, getConflicts } = useOfflineOperations();
  const [conflicts, setConflicts] = React.useState<ConflictItem[]>([]);
  const [showDetails, setShowDetails] = React.useState(false);

  React.useEffect(() => {
    const loadConflicts = async () => {
      const conflictList = await getConflicts();
      setConflicts(conflictList);
    };
    
    loadConflicts();
    
    // Listen for conflict events
    const handleConflict = () => loadConflicts();
    window.addEventListener('sync-conflict', handleConflict);
    
    return () => window.removeEventListener('sync-conflict', handleConflict);
  }, [getConflicts]);

  if (!offlineState.isOffline && offlineState.pendingChanges === 0 && conflicts.length === 0) {
    return null;
  }

  const handleSync = async () => {
    try {
      await sync();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 min-w-[280px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {offlineState.isOffline ? (
              <>
                <WifiOffIcon className="h-5 w-5 text-red-500" />
                <span className="font-medium text-red-700 dark:text-red-400">
                  Offline Mode
                </span>
              </>
            ) : (
              <>
                <WifiIcon className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-700 dark:text-green-400">
                  Online
                </span>
              </>
            )}
          </div>
          
          {offlineState.pendingChanges > 0 && (
            <button
              onClick={handleSync}
              disabled={offlineState.isOffline || offlineState.syncInProgress}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sync now"
            >
              <RefreshCwIcon 
                className={`h-4 w-4 ${offlineState.syncInProgress ? 'animate-spin' : ''}`} 
              />
            </button>
          )}
        </div>

        {/* Status Details */}
        <div className="space-y-2 text-sm">
          {offlineState.isOffline && (
            <p className="text-gray-600 dark:text-gray-400">
              Your changes will be saved locally and synced when you're back online.
            </p>
          )}

          {offlineState.pendingChanges > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Pending changes:
              </span>
              <span className="font-medium text-orange-600 dark:text-orange-400">
                {offlineState.pendingChanges}
              </span>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircleIcon className="h-4 w-4" />
              <span>{conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} need resolution</span>
            </div>
          )}

          {offlineState.lastSync && (
            <div className="text-xs text-gray-500 dark:text-gray-500">
              Last synced: {new Date(offlineState.lastSync).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Expandable Details */}
        {(offlineState.pendingChanges > 0 || conflicts.length > 0) && (
          <>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showDetails ? 'Hide' : 'Show'} details
            </button>

            {showDetails && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                {conflicts.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Conflicts:
                    </h4>
                    <div className="space-y-1">
                      {conflicts.map((conflict) => (
                        <div
                          key={conflict.id ?? conflict.operationId}
                          className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-between"
                        >
                          <span>{conflict.entity} conflict</span>
                          <button
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                            onClick={() => {
                              // Open conflict resolution modal
                              window.dispatchEvent(
                                new CustomEvent<ConflictItem>('open-conflict-resolver', {
                                  detail: conflict
                                })
                              );
                            }}
                          >
                            Resolve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-500">
                  {offlineState.isOffline 
                    ? 'Working offline. Changes saved locally.'
                    : offlineState.syncInProgress
                    ? 'Syncing...'
                    : 'Ready to sync'
                  }
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
