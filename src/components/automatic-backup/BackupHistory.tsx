import React, { useEffect, memo } from 'react';
import { ClockIcon, CheckCircleIcon, XCircleIcon, DownloadIcon, TrashIcon, RefreshCwIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface BackupHistoryProps {
  backupHistory: any[];
  onDownload: (backupId: number) => void;
  onDelete: (backupId: number) => void;
  onRestore: (backupId: number) => void;
}

export const BackupHistory = memo(function BackupHistory({
  backupHistory,
  onDownload,
  onDelete,
  onRestore
}: BackupHistoryProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BackupHistory component initialized', {
      componentName: 'BackupHistory'
    });
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <div className="flex items-center gap-3 mb-6">
        <ClockIcon size={24} className="text-primary" />
        <h2 className="text-xl font-semibold text-theme-heading dark:text-white">
          Backup History
        </h2>
      </div>

      {backupHistory.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No backup history available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Create your first backup to start building history
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {backupHistory.map((backup: any, index: number) => (
            <div
              key={backup.id || index}
              className="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center gap-3">
                {backup.status === 'success' ? (
                  <CheckCircleIcon size={20} className="text-green-500" />
                ) : (
                  <XCircleIcon size={20} className="text-red-500" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(backup.timestamp).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatRelativeTime(backup.timestamp)} • {formatFileSize(backup.size || 0)}
                    {backup.error && (
                      <span className="text-red-500 ml-2">{backup.error}</span>
                    )}
                  </p>
                </div>
              </div>
              
              {backup.status === 'success' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onDownload(backup.id)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Download backup"
                  >
                    <DownloadIcon size={16} />
                  </button>
                  <button
                    onClick={() => onRestore(backup.id)}
                    className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Restore from backup"
                  >
                    <RefreshCwIcon size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(backup.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Delete backup"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});