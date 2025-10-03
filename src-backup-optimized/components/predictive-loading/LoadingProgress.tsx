/**
 * LoadingProgress - World-Class Component
 * Extracted from PredictiveLoadingIndicator architectural disaster
 */

import React, { memo } from 'react';

interface LoadingProgressProps {
  isPreloading: boolean;
  progress: number;
  positionClasses: string;
}

/**
 * Clean loading progress bar
 */
export const LoadingProgress = memo(function LoadingProgress({
  isPreloading,
  progress,
  positionClasses
}: LoadingProgressProps): React.JSX.Element | null {
  if (!isPreloading) return null;

  return (
    <div className={`fixed ${positionClasses} h-1 bg-gray-200 dark:bg-gray-800 z-50`}>
      <div 
        className="h-full bg-gradient-to-r from-gray-500 via-purple-500 to-pink-500 transition-all duration-300 animate-pulse"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
});