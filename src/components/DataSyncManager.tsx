import React, { useMemo, useState } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertTriangle, 
  X,
  Loader2,
  GitBranch,
  Clock,
  Zap
} from 'lucide-react';
import { useDataSync } from '../hooks/useDataSync';
import { formatDistanceToNow } from 'date-fns';
import { SyncConflict } from '../services/syncService';
import { createScopedLogger } from '../loggers/scopedLogger';

export default function DataSyncManager(): React.JSX.Element {
  const { syncStatus, conflicts, forceSync, resolveConflict, clearSyncQueue } = useDataSync();
  const [showDetails, setShowDetails] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [resolvingConflict, setResolvingConflict] = useState<string | null>(null);
  const logger = useMemo(() => createScopedLogger('DataSyncManager'), []);

  const handleResolveConflict = async (
    conflictId: string, 
    resolution: 'local' | 'remote' | 'merge'
  ) => {
    setResolvingConflict(conflictId);
    try {
      resolveConflict(conflictId, resolution);
      setTimeout(() => setResolvingConflict(null), 500);
    } catch (error) {
      logger.error('Failed to resolve conflict', error as Error);
      setResolvingConflict(null);
    }
  };

  const getSyncIcon = () => {
    if (syncStatus.isSyncing) {
      return <Loader2 size={20} className="animate-spin text-blue-500" />;
    }
    if (!syncStatus.isConnected) {
      return <CloudOff size={20} className="text-gray-400" />;
    }
    if (syncStatus.pendingOperations > 0) {
      return <RefreshCw size={20} className="text-orange-500" />;
    }
    if (conflicts.length > 0) {
      return <AlertTriangle size={20} className="text-red-500" />;
    }
    return <Cloud size={20} className="text-green-500" />;
  };

  const getSyncMessage = () => {
    if (!syncStatus.isConnected) {
      return 'Offline - Changes saved locally';
    }
    if (syncStatus.isSyncing) {
      return 'Syncing...';
    }
    if (syncStatus.pendingOperations > 0) {
      return `${syncStatus.pendingOperations} changes pending`;
    }
    if (conflicts.length > 0) {
      return `${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} to resolve`;
    }
    if (syncStatus.lastSyncTime) {
      return `Synced ${formatDistanceToNow(syncStatus.lastSyncTime)} ago`;
    }
    return 'All changes synced';
  };

  return (
    <>
      {/* Floating Sync Indicator */}
      <div className="fixed top-4 right-4 z-40">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 px-4 py-2 bg-[#d4dce8] dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          {getSyncIcon()}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {getSyncMessage()}
          </span>
        </button>

        {/* Quick Actions */}
        {(syncStatus.pendingOperations > 0 || !syncStatus.isConnected) && (
          <button
            onClick={forceSync}
            className="absolute -bottom-2 -right-2 p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
            title="Sync now"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {/* Sync Details Panel */}
      {showDetails && (
        <div className="fixed top-16 right-4 z-40 w-80 bg-[#d4dce8] dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Sync Status
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Connection
              </span>
              <div className="flex items-center gap-2">
                {syncStatus.isConnected ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Connected
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Offline
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Pending Changes */}
            {syncStatus.pendingOperations > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Pending Changes
                </span>
                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-sm font-medium rounded-full">
                  {syncStatus.pendingOperations}
                </span>
              </div>
            )}

            {/* Conflicts */}
            {conflicts.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Conflicts
                </span>
                <button
                  onClick={() => setShowConflicts(true)}
                  className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium rounded-full hover:bg-red-200 dark:hover:bg-red-900/40"
                >
                  {conflicts.length} - Resolve
                </button>
              </div>
            )}

            {/* Last Sync */}
            {syncStatus.lastSyncTime && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Last Sync
                </span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {formatDistanceToNow(syncStatus.lastSyncTime)} ago
                </span>
              </div>
            )}

            {/* Error */}
            {syncStatus.error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {syncStatus.error}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={forceSync}
                disabled={syncStatus.isSyncing || !syncStatus.isConnected}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} className={syncStatus.isSyncing ? 'animate-spin' : ''} />
                Sync Now
              </button>
              {syncStatus.pendingOperations > 0 && (
                <button
                  onClick={clearSyncQueue}
                  className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Clear Queue
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {showConflicts && conflicts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500 to-orange-500">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <GitBranch size={24} />
                  <div>
                    <h2 className="text-xl font-bold">Resolve Sync Conflicts</h2>
                    <p className="text-sm opacity-90">
                      {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} need your attention
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConflicts(false)}
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Conflicts List */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
              <div className="space-y-4">
                {conflicts.map((conflict) => (
                  <ConflictItem
                    key={conflict.id}
                    conflict={conflict}
                    onResolve={handleResolveConflict}
                    isResolving={resolvingConflict === conflict.id}
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Conflicts are automatically resolved using "last write wins" if not manually resolved
                </p>
                <button
                  onClick={() => setShowConflicts(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Conflict Item Component
interface ConflictItemProps {
  conflict: SyncConflict;
  onResolve: (id: string, resolution: 'local' | 'remote' | 'merge') => void;
  isResolving: boolean;
}

function ConflictItem({ conflict, onResolve, isResolving }: ConflictItemProps): React.JSX.Element {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">
            {conflict.localOperation.entity} Conflict
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Entity ID: {conflict.localOperation.entityId}
          </p>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {showDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Local Version */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Your Changes (Local)
              </span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p>Type: {conflict.localOperation.type}</p>
              <p>Time: {new Date(conflict.localOperation.timestamp).toLocaleString()}</p>
              <p>Version: {conflict.localOperation.version}</p>
            </div>
          </div>

          {/* Remote Version */}
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Cloud size={16} className="text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-900 dark:text-green-300">
                Server Changes (Remote)
              </span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p>Type: {conflict.remoteOperation.type}</p>
              <p>Time: {new Date(conflict.remoteOperation.timestamp).toLocaleString()}</p>
              <p>Version: {conflict.remoteOperation.version}</p>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onResolve(conflict.id, 'local')}
          disabled={isResolving}
          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isResolving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Zap size={16} />
          )}
          Keep Mine
        </button>
        <button
          onClick={() => onResolve(conflict.id, 'remote')}
          disabled={isResolving}
          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isResolving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Cloud size={16} />
          )}
          Use Theirs
        </button>
      </div>
    </div>
  );
}
