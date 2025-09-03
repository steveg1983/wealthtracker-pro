import React, { useEffect, useState, useCallback } from 'react';
import { 
  CloudIcon as Cloud,
  CloudOffIcon as CloudOff,
  RefreshCwIcon as RefreshCw,
  CheckIcon as Check,
  AlertCircleIcon as AlertCircle,
  ZapIcon as Zap
} from './icons';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { formatDistanceToNow } from 'date-fns';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'offline';

interface SyncStatusIndicatorProps {
  variant?: 'compact' | 'detailed' | 'full';
  showLastSync?: boolean;
  className?: string;
  onShowHistory?: () => void;
  onShowConflicts?: () => void;
}

export default function SyncStatusIndicator({ 
  variant = 'compact',
  showLastSync = false,
  className = '',
  onShowHistory,
  onShowConflicts
}: SyncStatusIndicatorProps): React.JSX.Element {
  const isOnline = useOnlineStatus();
  const { 
    status, 
    lastSyncTime, 
    pendingChanges, 
    error, 
    triggerSync,
    syncProgress,
    syncMessage,
    conflictCount,
    syncHistory,
    clearError
  } = useSyncStatus();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [showProgressDetails, setShowProgressDetails] = useState(false);

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

  // Show sync progress when syncing
  useEffect(() => {
    if (status === 'syncing') {
      setShowProgressDetails(true);
    } else {
      // Hide progress after a delay
      const timer = setTimeout(() => setShowProgressDetails(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (variant === 'compact') {
    return (
      <div className="relative">
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
          {conflictCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {conflictCount}
            </span>
          )}
        </button>
        
        {/* Progress Indicator */}
        {showProgressDetails && status === 'syncing' && (
          <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-50 min-w-[200px]">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {syncMessage}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
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

        {/* Conflict Alert */}
        {conflictCount > 0 && (
          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertCircle size={14} />
                <span className="text-xs font-medium">
                  {conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'} detected
                </span>
              </div>
              {onShowConflicts && (
                <button
                  onClick={onShowConflicts}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sync Progress */}
        {status === 'syncing' && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>{syncMessage}</span>
              <span>{syncProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {variant === 'detailed' && (onShowHistory || onShowConflicts) && (
          <div className="mt-3 flex gap-2">
            {onShowHistory && syncHistory.length > 0 && (
              <button
                onClick={onShowHistory}
                className="flex-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                View History
              </button>
            )}
            {onShowConflicts && conflictCount > 0 && (
              <button
                onClick={onShowConflicts}
                className="flex-1 px-3 py-1.5 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/70 rounded-lg transition-colors"
              >
                Resolve Conflicts
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
