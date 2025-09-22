/**
 * RecentPrefetches - World-Class Component
 * Extracted from PredictiveLoadingIndicator architectural disaster
 */

import React, { memo } from 'react';
import { CheckCircleIcon } from '../icons';

interface RecentPrefetchesProps {
  prefetches: string[];
}

/**
 * Display recent prefetch activity
 */
export const RecentPrefetches = memo(function RecentPrefetches({
  prefetches
}: RecentPrefetchesProps): React.JSX.Element {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Recently Prefetched
      </div>
      <div className="space-y-1">
        {prefetches.map((route, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <CheckCircleIcon size={12} className="text-green-500" />
            <span className="text-gray-700 dark:text-gray-300">{route}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Smart mode informational note
 */
export const SmartModeNote = memo(function SmartModeNote(): React.JSX.Element {
  return (
    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <span className="font-semibold">Smart Mode:</span> Learning from your patterns to predict next actions
      </div>
    </div>
  );
});