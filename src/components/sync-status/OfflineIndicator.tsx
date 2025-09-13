/**
 * Offline Indicator Component
 * Shows warning when the app is offline
 */

import React, { useEffect } from 'react';
import { WifiIcon } from '@heroicons/react/24/outline';
import { logger } from '../../services/loggingService';

const OfflineIndicator = React.memo(() => {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
      <div className="flex items-center">
        <WifiIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          You're offline. Changes will sync when connection is restored.
        </p>
      </div>
    </div>
  );
});

OfflineIndicator.displayName = 'OfflineIndicator';

export default OfflineIndicator;