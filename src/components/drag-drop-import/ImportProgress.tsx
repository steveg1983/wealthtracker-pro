import { memo, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, RefreshCwIcon, AlertCircleIcon } from '../icons';
import type { ImportProgress as ImportProgressType } from '../../services/fileImportService';
import { logger } from '../../services/loggingService';

interface ImportProgressProps {
  progress: ImportProgressType;
  onReset: () => void;
}

/**
 * Import progress component
 * Shows the current status and progress of file import
 */
export const ImportProgress = memo(function ImportProgress({
  progress,
  onReset
}: ImportProgressProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ImportProgress component initialized', {
      componentName: 'ImportProgress'
    });
  }, []);

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'complete':
        return <CheckCircleIcon size={48} className="text-green-500" />;
      case 'error':
        return <XCircleIcon size={48} className="text-red-500" />;
      case 'detecting':
      case 'parsing':
      case 'importing':
        return <RefreshCwIcon size={48} className="text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getProgressColor = () => {
    switch (progress.status) {
      case 'complete':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-center mb-4">
        {getStatusIcon()}
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
        {progress.message}
      </h3>
      
      {progress.fileName && (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
          File: {progress.fileName}
        </p>
      )}
      
      {/* Progress Bar */}
      {progress.status !== 'idle' && progress.status !== 'complete' && progress.status !== 'error' && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
            {progress.progress}%
          </p>
        </div>
      )}
      
      {/* Statistics */}
      {(progress.rowCount || progress.successCount !== undefined) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {progress.rowCount && (
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Rows Found</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {progress.rowCount}
              </p>
            </div>
          )}
          {progress.successCount !== undefined && (
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Imported</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                {progress.successCount}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Errors */}
      {progress.errors && progress.errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {progress.errors.length} errors occurred
            </p>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {progress.errors.slice(0, 5).map((error, index) => (
              <p key={index} className="text-xs text-red-700 dark:text-red-300">
                • {error}
              </p>
            ))}
            {progress.errors.length > 5 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                ... and {progress.errors.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Actions */}
      {(progress.status === 'complete' || progress.status === 'error') && (
        <button
          onClick={onReset}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Import Another File
        </button>
      )}
    </div>
  );
});