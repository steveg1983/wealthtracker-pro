import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, Zap } from 'lucide-react';
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
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 ${className}`}>
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

      <div className="space-y-3">
        {/* Connection Status */}
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'} animate-pulse`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {isOnline && (
            <Zap size={14} className="text-green-600 ml-auto" title="Real-time sync active" />
          )}
        </div>

        {/* Sync Status */}
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {showLastSync && lastSyncTime && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Cloud size={12} />
            <span>Last synced {formatDistanceToNow(lastSyncTime, { addSuffix: true })}</span>
          </div>
        )}

        {error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {!isOnline && (
          <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <CloudOff size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Working Offline
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Your changes are being saved locally and will sync automatically when you reconnect.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Changes Indicator */}
        {pendingChanges > 0 && isOnline && (
          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <RefreshCw size={12} className="animate-spin" />
              <span>{pendingChanges} pending {pendingChanges === 1 ? 'change' : 'changes'} to sync</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}