import React, { useState } from 'react';
import { 
  XIcon as X,
  AlertTriangleIcon as AlertTriangle,
  CheckIcon as Check,
  RefreshCwIcon as RefreshCw,
  FileTextIcon as FileText,
  CalendarIcon as Calendar,
  DollarSignIcon as DollarSign
} from '../icons';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';

interface SyncConflict {
  id: string;
  type: 'account' | 'transaction' | 'budget' | 'category';
  localValue: any;
  remoteValue: any;
  timestamp: Date;
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: SyncConflict[];
  onResolve: (id: string, resolution: 'local' | 'remote') => Promise<void>;
  onResolveAll: (resolution: 'local' | 'remote') => Promise<void>;
}

export default function ConflictResolutionModal({
  isOpen,
  onClose,
  conflicts,
  onResolve,
  onResolveAll
}: ConflictResolutionModalProps): React.JSX.Element | null {
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolvingAll, setResolvingAll] = useState<'local' | 'remote' | null>(null);

  if (!isOpen || conflicts.length === 0) return null;

  const handleResolve = async (id: string, resolution: 'local' | 'remote'): Promise<void> => {
    setResolving(id);
    try {
      await onResolve(id, resolution);
    } finally {
      setResolving(null);
    }
  };

  const handleResolveAll = async (resolution: 'local' | 'remote'): Promise<void> => {
    setResolvingAll(resolution);
    try {
      await onResolveAll(resolution);
    } finally {
      setResolvingAll(null);
    }
  };

  const getTypeIcon = (type: SyncConflict['type']): React.JSX.Element => {
    switch (type) {
      case 'account':
        return <FileText size={16} />;
      case 'transaction':
        return <DollarSign size={16} />;
      case 'budget':
        return <Calendar size={16} />;
      case 'category':
        return <FileText size={16} />;
    }
  };

  const renderValue = (value: any, type: SyncConflict['type']): React.JSX.Element => {
    if (type === 'transaction') {
      return (
        <div className="space-y-1">
          <div className="font-medium">{value.description || 'No description'}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatCurrency(value.amount)}
          </div>
          {value.date && (
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {format(new Date(value.date), 'MMM d, yyyy')}
            </div>
          )}
        </div>
      );
    }

    if (type === 'account') {
      return (
        <div className="space-y-1">
          <div className="font-medium">{value.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Balance: {formatCurrency(value.balance)}
          </div>
        </div>
      );
    }

    if (type === 'budget') {
      return (
        <div className="space-y-1">
          <div className="font-medium">{value.categoryName || 'Budget'}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatCurrency(value.amount)} / {value.period}
          </div>
        </div>
      );
    }

    return (
      <div className="text-sm">
        {JSON.stringify(value, null, 2)}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} className="text-amber-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Resolve Sync Conflicts
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {conflicts.length} {conflicts.length === 1 ? 'conflict' : 'conflicts'} need your attention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Actions */}
        {conflicts.length > 1 && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Resolve all conflicts at once?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResolveAll('local')}
                  disabled={resolvingAll !== null}
                  className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resolvingAll === 'local' ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    'Keep All Local'
                  )}
                </button>
                <button
                  onClick={() => handleResolveAll('remote')}
                  disabled={resolvingAll !== null}
                  className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resolvingAll === 'remote' ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    'Keep All Remote'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conflicts List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {conflicts.map((conflict) => (
              <div 
                key={conflict.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Conflict Header */}
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex items-center gap-2">
                  {getTypeIcon(conflict.type)}
                  <span className="font-medium capitalize">
                    {conflict.type} Conflict
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {format(conflict.timestamp, 'MMM d, h:mm a')}
                  </span>
                </div>

                {/* Conflict Content */}
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Local Version */}
                    <div className="relative">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-500 rounded-t-lg"></div>
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 pt-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Your Local Changes
                          </span>
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-gray-900/50 text-blue-700 dark:text-gray-300 rounded">
                            Local
                          </span>
                        </div>
                        {renderValue(conflict.localValue, conflict.type)}
                        <button
                          onClick={() => handleResolve(conflict.id, 'local')}
                          disabled={resolving === conflict.id || resolvingAll !== null}
                          className="mt-4 w-full px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resolving === conflict.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <>
                              <Check size={16} />
                              Keep Local
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Remote Version */}
                    <div className="relative">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-green-500 rounded-t-lg"></div>
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 pt-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Remote Server Changes
                          </span>
                          <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                            Remote
                          </span>
                        </div>
                        {renderValue(conflict.remoteValue, conflict.type)}
                        <button
                          onClick={() => handleResolve(conflict.id, 'remote')}
                          disabled={resolving === conflict.id || resolvingAll !== null}
                          className="mt-4 w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resolving === conflict.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <>
                              <Check size={16} />
                              Keep Remote
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <AlertTriangle size={16} />
            <p>
              Choose carefully - this action cannot be undone. Your selection will overwrite the other version.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}