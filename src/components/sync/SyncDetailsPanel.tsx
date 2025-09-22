/**
 * Sync Details Panel Component
 * World-class sync status details with progressive disclosure
 * Implements Apple's clarity and deference principles
 */

import React, { useEffect, memo } from 'react';
import { 
  XIcon as X,
  RefreshCwIcon as RefreshCw
} from '../icons';
import { formatDistanceToNow } from 'date-fns';
import { dataSyncService, type SyncStatus } from '../../services/sync/dataSyncService';
import type { SyncConflict } from '../../services/syncService';
import { useLogger } from '../services/ServiceProvider';

interface SyncDetailsPanelProps {
  syncStatus: SyncStatus;
  conflicts: SyncConflict[];
  onClose: () => void;
  onForceSync: () => void;
  onClearQueue: () => void;
  onShowConflicts: () => void;
}

/**
 * Premium sync details panel with exceptional UX
 */
export const SyncDetailsPanel = memo(function SyncDetailsPanel({ syncStatus,
  conflicts,
  onClose,
  onForceSync,
  onClearQueue,
  onShowConflicts
 }: SyncDetailsPanelProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SyncDetailsPanel component initialized', {
      componentName: 'SyncDetailsPanel'
    });
  }, []);

  const connectionStatus = dataSyncService.getConnectionStatus(syncStatus.isConnected);

  return (
    <div className="fixed top-16 right-4 z-40 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
      <PanelHeader onClose={onClose} />
      <PanelContent
        syncStatus={syncStatus}
        conflicts={conflicts}
        connectionStatus={connectionStatus}
        onShowConflicts={onShowConflicts}
      />
      <PanelActions
        syncStatus={syncStatus}
        onForceSync={onForceSync}
        onClearQueue={onClearQueue}
      />
    </div>
  );
});

/**
 * Panel header
 */
const PanelHeader = memo(function PanelHeader({
  onClose
}: {
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Sync Status
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="Close sync details"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
});

/**
 * Panel content
 */
const PanelContent = memo(function PanelContent({
  syncStatus,
  conflicts,
  connectionStatus,
  onShowConflicts
}: {
  syncStatus: SyncStatus;
  conflicts: SyncConflict[];
  connectionStatus: ReturnType<typeof dataSyncService.getConnectionStatus>;
  onShowConflicts: () => void;
}): React.JSX.Element {
  return (
    <div className="p-4 space-y-4">
      {/* Connection Status */}
      <StatusRow label="Connection">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 ${connectionStatus.indicator} rounded-full ${connectionStatus.animate ? 'animate-pulse' : ''}`} />
          <span className={`text-sm font-medium ${syncStatus.isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {connectionStatus.label}
          </span>
        </div>
      </StatusRow>

      {/* Pending Changes */}
      {syncStatus.pendingOperations > 0 && (
        <StatusRow label="Pending Changes">
          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-sm font-medium rounded-full">
            {syncStatus.pendingOperations}
          </span>
        </StatusRow>
      )}

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <StatusRow label="Conflicts">
          <button
            onClick={onShowConflicts}
            className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium rounded-full hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
          >
            {conflicts.length} - Resolve
          </button>
        </StatusRow>
      )}

      {/* Last Sync */}
      {syncStatus.lastSyncTime && (
        <StatusRow label="Last Sync">
          <span className="text-sm text-gray-900 dark:text-white">
            {formatDistanceToNow(syncStatus.lastSyncTime, { addSuffix: true })}
          </span>
        </StatusRow>
      )}

      {/* Error */}
      {syncStatus.error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            {syncStatus.error}
          </p>
        </div>
      )}
    </div>
  );
});

/**
 * Status row
 */
const StatusRow = memo(function StatusRow({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {label}
      </span>
      {children}
    </div>
  );
});

/**
 * Panel actions
 */
const PanelActions = memo(function PanelActions({
  syncStatus,
  onForceSync,
  onClearQueue
}: {
  syncStatus: SyncStatus;
  onForceSync: () => void;
  onClearQueue: () => void;
}): React.JSX.Element {
  return (
    <div className="p-4 pt-2 border-t border-gray-200 dark:border-gray-700">
      <div className="flex gap-2">
        <button
          onClick={onForceSync}
          disabled={syncStatus.isSyncing || !syncStatus.isConnected}
          className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          aria-label="Force sync now"
        >
          <RefreshCw size={16} className={syncStatus.isSyncing ? 'animate-spin' : ''} />
          Sync Now
        </button>
        {syncStatus.pendingOperations > 0 && (
          <button
            onClick={onClearQueue}
            className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            aria-label="Clear sync queue"
          >
            Clear Queue
          </button>
        )}
      </div>
    </div>
  );
});