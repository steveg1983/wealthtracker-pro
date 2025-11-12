import React, { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { formatDistanceToNow } from 'date-fns';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'offline';

interface SyncStatusIndicatorProps {
  variant?: 'compact' | 'detailed';
  showLastSync?: boolean;
  className?: string;
}

export default function SyncStatusIndicator({ 
  variant = 'compact',
  showLastSync = false,
  className = ''
}: SyncStatusIndicatorProps): React.JSX.Element {
  const isOnline = useOnlineStatus();
  const { status, lastSyncTime, pendingChanges, error, triggerSync } = useSyncStatus();
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async (): Promise<void> => {
    if (isManualSyncing || status === 'syncing') return;
    
    setIsManualSyncing(true);
    try {
      await triggerSync();
    } finally {
      setTimeout(() => setIsManualSyncing(false), 1000);
    }
  };

  const getStatusIcon = (): React.JSX.Element => {
    if (!isOnline) {
      return <CloudOff size={16} className="text-gray-500" />;
    }

    switch (status) {
      case 'synced':
        return <Check size={16} className="text-green-600" />;
      case 'syncing':
        return <RefreshCw size={16} className="text-blue-600 animate-spin" />;
      case 'pending':
        return <Cloud size={16} className="text-yellow-600" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-600" />;
      default:
        return <Cloud size={16} className="text-gray-500" />;
    }
  };

  const getStatusText = (): string => {
    if (!isOnline) return 'Offline';

    switch (status) {
      case 'synced':
        return 'All changes saved';
      case 'syncing':
        return 'Syncing...';
      case 'pending':
        return `${pendingChanges} pending ${pendingChanges === 1 ? 'change' : 'changes'}`;
      case 'error':
        return 'Sync error';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = (): string => {
    if (!isOnline) return 'text-gray-500';

    switch (status) {
      case 'synced':
        return 'text-green-600';
      case 'syncing':
        return 'text-blue-600';
      case 'pending':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={handleManualSync}
        disabled={!isOnline || status === 'syncing' || isManualSyncing}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title={getStatusText()}
        aria-label={`Sync status: ${getStatusText()}`}
      >
        {getStatusIcon()}
        <span className={`text-sm hidden sm:inline ${getStatusColor()}`}>
          {status === 'syncing' || isManualSyncing ? 'Syncing...' : 'Sync'}
        </span>
      </button>
    );
  }

  return (
    <div className={`bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Sync Status
        </h3>
        <button
          onClick={handleManualSync}
          disabled={!isOnline || status === 'syncing' || isManualSyncing}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Sync now"
          aria-label="Trigger manual sync"
        >
          <RefreshCw 
            size={16} 
            className={status === 'syncing' || isManualSyncing ? 'animate-spin' : ''} 
          />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {showLastSync && lastSyncTime && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last synced {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
          </p>
        )}

        {error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {!isOnline && (
          <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-600 dark:text-yellow-400">
            You're offline. Changes will sync when you reconnect.
          </div>
        )}
      </div>
    </div>
  );
}
