import React from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  XIcon as X,
  CheckCircleIcon as CheckCircle,
  AlertCircleIcon as AlertCircle,
  AlertTriangleIcon as AlertTriangle,
  ClockIcon as Clock,
  RefreshCwIcon as RefreshCw,
  CloudIcon as Cloud
} from '../icons';

interface SyncHistoryEntry {
  id: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'partial';
  itemsSynced: number;
  conflicts: number;
  duration: number;
  error?: string;
}

interface SyncHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncHistory: SyncHistoryEntry[];
  onClearHistory?: () => void;
}

export default function SyncHistoryModal({ 
  isOpen, 
  onClose, 
  syncHistory,
  onClearHistory
}: SyncHistoryModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  const getStatusIcon = (status: SyncHistoryEntry['status']): React.JSX.Element => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'failed':
        return <AlertCircle size={16} className="text-red-600" />;
      case 'partial':
        return <AlertTriangle size={16} className="text-yellow-600" />;
    }
  };

  const getStatusText = (status: SyncHistoryEntry['status']): string => {
    switch (status) {
      case 'success':
        return 'Successful';
      case 'failed':
        return 'Failed';
      case 'partial':
        return 'Partial';
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const groupByDate = (entries: SyncHistoryEntry[]): Map<string, SyncHistoryEntry[]> => {
    const grouped = new Map<string, SyncHistoryEntry[]>();
    
    entries.forEach(entry => {
      const dateKey = format(entry.timestamp, 'yyyy-MM-dd');
      const existing = grouped.get(dateKey) || [];
      grouped.set(dateKey, [...existing, entry]);
    });
    
    return grouped;
  };

  const groupedHistory = groupByDate(syncHistory);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Cloud size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Sync History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {syncHistory.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No sync history available
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Sync history will appear here after your first sync
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(groupedHistory.entries()).map(([date, entries]) => (
                <div key={date}>
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
                    {date === format(new Date(), 'yyyy-MM-dd') ? 'Today' : 
                     date === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd') ? 'Yesterday' :
                     format(new Date(date), 'EEEE, MMMM d')}
                  </h3>
                  
                  <div className="space-y-2">
                    {entries.map(entry => (
                      <div 
                        key={entry.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {getStatusIcon(entry.status)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {getStatusText(entry.status)}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {format(entry.timestamp, 'h:mm a')}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                                {entry.itemsSynced > 0 && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle size={12} />
                                    {entry.itemsSynced} {entry.itemsSynced === 1 ? 'item' : 'items'}
                                  </span>
                                )}
                                
                                {entry.conflicts > 0 && (
                                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle size={12} />
                                    {entry.conflicts} {entry.conflicts === 1 ? 'conflict' : 'conflicts'}
                                  </span>
                                )}
                                
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {formatDuration(entry.duration)}
                                </span>
                              </div>
                              
                              {entry.error && (
                                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                                  {entry.error}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {syncHistory.length > 0 && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {syncHistory.length} sync {syncHistory.length === 1 ? 'record' : 'records'}
              </p>
              {onClearHistory && (
                <button
                  onClick={onClearHistory}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                >
                  Clear History
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}