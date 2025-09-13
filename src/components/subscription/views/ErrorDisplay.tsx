/**
 * Error Display Component
 * Shows error messages with dismiss option
 */

import React, { useEffect } from 'react';
import { logger } from '../../../services/loggingService';

interface ErrorDisplayProps {
  error: string;
  onDismiss: () => void;
}

const ErrorDisplay = React.memo(({ error, onDismiss }: ErrorDisplayProps) => {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
      <p className="text-red-800 dark:text-red-200">{error}</p>
      <button
        onClick={onDismiss}
        className="text-red-600 dark:text-red-400 underline text-sm mt-1 hover:no-underline"
      >
        Dismiss
      </button>
    </div>
  );
});

ErrorDisplay.displayName = 'ErrorDisplay';

export default ErrorDisplay;