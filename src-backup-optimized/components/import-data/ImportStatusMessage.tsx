import { memo, useEffect } from 'react';
import { CheckCircleIcon, AlertCircleIcon, FileTextIcon, AlertTriangleIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface ImportStatusMessageProps {
  status: 'idle' | 'success' | 'error';
  message: string;
  warning?: string;
}

/**
 * Import status message component
 * Displays status and warning messages
 */
export const ImportStatusMessage = memo(function ImportStatusMessage({ status,
  message,
  warning
 }: ImportStatusMessageProps): React.JSX.Element | null {
  // Component initialization logging with error handling
  useEffect(() => {
    try {
      logger.info('ImportStatusMessage component initialized', {
        status, hasMessage: !!message, hasWarning: !!warning,
        componentName: 'ImportStatusMessage'
      });
    } catch (error) {
      logger.error('ImportStatusMessage initialization failed:', error);
    }
  }, [status, message, warning]);

  try {
    if (warning) {
      return (
      <div className="mb-4 p-3 rounded-lg flex items-start gap-2 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">
        <AlertTriangleIcon size={20} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold mb-1">Import Notice</p>
          <p className="text-sm">{warning}</p>
        </div>
      </div>
    );
  }

    if (!message) return null;

    return (
      <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
      status === 'success' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
      status === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
      'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
    }`}>
      {status === 'success' ? <CheckCircleIcon size={20} /> :
       status === 'error' ? <AlertCircleIcon size={20} /> :
       <FileTextIcon size={20} />}
      <span>{message}</span>
      </div>
    );
  } catch (error) {
    logger.error('ImportStatusMessage render failed:', error);
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ Status message unavailable
        </div>
      </div>
    );
  }
});
