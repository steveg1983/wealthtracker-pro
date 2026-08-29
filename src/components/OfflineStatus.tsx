import React from 'react';
import { useOffline } from '../hooks/useOffline';
import { WifiOffIcon, RefreshCwIcon, CheckCircleIcon, AlertCircleIcon } from './icons';

export function OfflineStatus(): React.JSX.Element | null {
  const { isOffline, isSyncing, pendingChanges, syncNow } = useOffline();

  if (!isOffline && pendingChanges === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm
        ${/* Work in progress is not a warning and not a success — it is the one
             state here that needs no colour, and the spinning icon already says
             it (stock-blue ruling, 28 Aug 2026). A neutral ground also keeps the
             hard-coded white label legible, which the progress token's near-white
             dark value would not. */
          isOffline ? 'bg-orange-500/90' : isSyncing ? 'bg-gray-700/90' : 'bg-green-500/90'}
        text-white transition-all duration-300
      `}>
        {isOffline ? (
          <>
            <WifiOffIcon className="h-5 w-5" />
            <div className="flex-1">
              <p className="font-medium">Offline Mode</p>
              {pendingChanges > 0 && (
                <p className="text-sm opacity-90">
                  {pendingChanges} change{pendingChanges !== 1 ? 's' : ''} pending
                </p>
              )}
            </div>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCwIcon className="h-5 w-5 animate-spin" />
            <div className="flex-1">
              <p className="font-medium">Syncing...</p>
              <p className="text-sm opacity-90">Uploading your changes</p>
            </div>
          </>
        ) : pendingChanges > 0 ? (
          <>
            <AlertCircleIcon className="h-5 w-5" />
            <div className="flex-1">
              <p className="font-medium">Changes Pending</p>
              <p className="text-sm opacity-90">
                {pendingChanges} change{pendingChanges !== 1 ? 's' : ''} to sync
              </p>
            </div>
            <button
              onClick={syncNow}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors"
              disabled={isSyncing}
            >
              Sync Now
            </button>
          </>
        ) : (
          <>
            <CheckCircleIcon className="h-5 w-5" />
            <div className="flex-1">
              <p className="font-medium">All Synced</p>
              <p className="text-sm opacity-90">Your data is up to date</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}