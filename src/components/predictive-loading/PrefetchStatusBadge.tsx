/**
 * PrefetchStatusBadge - World-Class Component
 * Extracted from PredictiveLoadingIndicator architectural disaster
 */

import React, { memo } from 'react';
import { RefreshCwIcon, CheckCircleIcon } from '../icons';

interface PrefetchStatusBadgeProps {
  isPrefetched: boolean;
  isPrefetching: boolean;
}

/**
 * Prefetch status badge for individual components
 */
export const PrefetchStatusBadge = memo(function PrefetchStatusBadge({ 
  isPrefetched, 
  isPrefetching 
}: PrefetchStatusBadgeProps): React.JSX.Element | null {
  if (!isPrefetching && !isPrefetched) return null;

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-gray-900/30 rounded-full">
      {isPrefetching ? (
        <>
          <RefreshCwIcon size={12} className="animate-spin text-gray-500" />
          <span className="text-xs text-gray-600 dark:text-gray-500">Preloading</span>
        </>
      ) : (
        <>
          <CheckCircleIcon size={12} className="text-green-500" />
          <span className="text-xs text-green-600 dark:text-green-400">Ready</span>
        </>
      )}
    </div>
  );
});