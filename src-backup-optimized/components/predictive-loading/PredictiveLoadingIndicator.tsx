/**
 * Predictive Loading Indicator - World-Class Component
 * Decomposed from 410-line monster into clean architecture
 */

import React, { useState, useEffect, memo, useCallback } from 'react';
import { usePredictiveLoading, usePrefetchMetrics, useRoutePrefetch } from '../../hooks/usePredictiveLoading';
import { useLogger } from '../services/ServiceProvider';
import { ZapIcon, RefreshCwIcon, CheckCircleIcon, MinimizeIcon } from '../icons';
import { MetricCard } from './MetricCard';
import { LoadingProgress } from './LoadingProgress';

interface PredictiveLoadingIndicatorProps {
  show?: boolean;
  position?: 'top' | 'bottom';
  compact?: boolean;
}

/**
 * Enterprise-grade predictive loading indicator
 * Decomposed from 410-line architectural disaster
 */
export const PredictiveLoadingIndicator = memo(function PredictiveLoadingIndicator({ show = true,
  position = 'top',
  compact = true
 }: PredictiveLoadingIndicatorProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('PredictiveLoadingIndicator initialized', {
        show, position, compact,
        componentName: 'PredictiveLoadingIndicator'
      });
    } catch (error) {
      logger.error('PredictiveLoadingIndicator initialization failed:', error);
    }
  }, [show, position, compact]);

  // Hooks with error handling
  const { isPreloading, preloadProgress } = useSafeHook(
    usePredictiveLoading,
    { isPreloading: false, preloadProgress: 0 }
  );
  const metrics = useSafeHook(usePrefetchMetrics, {
    totalPrefetches: 0,
    successfulPrefetches: 0,
    failedPrefetches: 0,
    bandwidthSaved: 0,
    averageLoadTime: 0
  });
  const { prefetchedRoutes } = useSafeHook(
    useRoutePrefetch,
    { prefetchedRoutes: new Set<string>(), isPrefetched: (route: string) => false }
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [recentPrefetches, setRecentPrefetches] = useState<string[]>([]);

  // Track recent prefetches with error handling
  useEffect(() => {
    try {
      if (prefetchedRoutes.size > recentPrefetches.length) {
        const newRoutes = Array.from(prefetchedRoutes).slice(-3);
        setRecentPrefetches(newRoutes);
      }
    } catch (error) {
      logger.error('Error tracking recent prefetches:', error);
    }
  }, [prefetchedRoutes, recentPrefetches.length]);

  const handleExpand = useCallback(() => {
    try {
      setIsExpanded(true);
    } catch (error) {
      logger.error('Error expanding indicator:', error);
    }
  }, []);

  const handleMinimize = useCallback(() => {
    try {
      setIsExpanded(false);
    } catch (error) {
      logger.error('Error minimizing indicator:', error);
    }
  }, []);

  if (!show) return null;

  const positionClasses = position === 'top' 
    ? 'top-0 left-0 right-0' 
    : 'bottom-0 left-0 right-0';

  // Compact view
  if (compact && !isExpanded) {
    return (
      <>
        <LoadingProgress 
          isPreloading={isPreloading}
          progress={preloadProgress}
          positionClasses={positionClasses}
        />
        <CompactIndicator
          position={position}
          isPreloading={isPreloading}
          prefetchedCount={prefetchedRoutes.size}
          onExpand={handleExpand}
        />
      </>
    );
  }

  // Expanded view
  try {
    return (
      <ExpandedView
        position={position}
        isPreloading={isPreloading}
        preloadProgress={preloadProgress}
        metrics={metrics}
        prefetchedRoutes={prefetchedRoutes}
        recentPrefetches={recentPrefetches}
        onMinimize={handleMinimize}
      />
    );
  } catch (error) {
    logger.error('Failed to render PredictiveLoadingIndicator:', error);
    return <ErrorFallback />;
  }
});

/**
 * Safe hook wrapper with error handling
 */
function useSafeHook<T>(hook: () => T, fallback: T): T {
  try {
    return hook();
  } catch (error) {
    logger.error(`Hook failed:`, error);
    return fallback;
  }
}

/**
 * Compact floating indicator
 */
const CompactIndicator = memo(function CompactIndicator({
  position,
  isPreloading,
  prefetchedCount,
  onExpand
}: {
  position: 'top' | 'bottom';
  isPreloading: boolean;
  prefetchedCount: number;
  onExpand: () => void;
}) {
  return (
    <button
      onClick={onExpand}
      className={`fixed ${position === 'top' ? 'top-4' : 'bottom-4'} right-4 z-50 p-2 bg-white dark:bg-gray-900 rounded-full shadow-lg hover:shadow-xl transition-all duration-200`}
      aria-label="Show predictive loading details"
    >
      <div className="relative">
        <ZapIcon 
          size={20} 
          className={isPreloading ? 'text-yellow-500 animate-pulse' : 'text-gray-400'}
        />
        {prefetchedCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>
    </button>
  );
});

/**
 * Expanded detailed view
 */
const ExpandedView = memo(function ExpandedView({
  position,
  isPreloading,
  preloadProgress,
  metrics,
  prefetchedRoutes,
  recentPrefetches,
  onMinimize
}: {
  position: 'top' | 'bottom';
  isPreloading: boolean;
  preloadProgress: number;
  metrics: any;
  prefetchedRoutes: Set<string>;
  recentPrefetches: string[];
  onMinimize: () => void;
}) {
  return (
    <div className={`fixed ${position === 'top' ? 'top-4' : 'bottom-4'} right-4 z-50 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-gray-500 via-purple-500 to-pink-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ZapIcon size={18} className="animate-pulse" />
            <span className="font-semibold text-sm">Predictive Loading</span>
          </div>
          <button
            onClick={onMinimize}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Minimize"
          >
            <MinimizeIcon size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Status */}
        <StatusIndicator isPreloading={isPreloading} />
        
        {/* Progress */}
        {isPreloading && (
          <ProgressBar progress={preloadProgress} />
        )}

        {/* Metrics */}
        <MetricsGrid 
          metrics={metrics}
          prefetchedCount={prefetchedRoutes.size}
        />

        {/* Recent prefetches */}
        {recentPrefetches.length > 0 && (
          <RecentPrefetches prefetches={recentPrefetches} />
        )}

        {/* Smart predictions note */}
        <SmartModeNote />
      </div>
    </div>
  );
});

/**
 * Status indicator component
 */
const StatusIndicator = memo(function StatusIndicator({
  isPreloading
}: {
  isPreloading: boolean;
}) {
  const logger = useLogger();
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
      <div className="flex items-center gap-2">
        {isPreloading ? (
          <>
            <RefreshCwIcon size={14} className="animate-spin text-gray-500" />
            <span className="text-sm font-medium text-gray-500">Preloading...</span>
          </>
        ) : (
          <>
            <CheckCircleIcon size={14} className="text-green-500" />
            <span className="text-sm font-medium text-green-500">Ready</span>
          </>
        )}
      </div>
    </div>
  );
});

/**
 * Progress bar component
 */
const ProgressBar = memo(function ProgressBar({
  progress
}: {
  progress: number;
}) {
  const logger = useLogger();
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Progress</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-gray-500 to-purple-500 transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
});

/**
 * Error fallback component
 */
const ErrorFallback = memo(function ErrorFallback() {
  return (
    <div className="fixed top-4 right-4 z-50 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
      <div className="text-red-600 dark:text-red-400 text-sm">
        ⚠️ Loading indicator unavailable
      </div>
    </div>
  );
});

/**
 * Metrics grid component
 */
const MetricsGrid = memo(function MetricsGrid({
  metrics,
  prefetchedCount
}: {
  metrics: any;
  prefetchedCount: number;
}) {
  const logger = useLogger();
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-500">Prefetched:</span>
        <span className="font-medium">{metrics.totalPrefetches}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Routes:</span>
        <span className="font-medium">{prefetchedCount}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Success:</span>
        <span className="font-medium text-green-500">{metrics.successfulPrefetches}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Bandwidth:</span>
        <span className="font-medium">{Math.round(metrics.bandwidthSaved / 1024)}KB</span>
      </div>
    </div>
  );
});

/**
 * Recent prefetches component
 */
const RecentPrefetches = memo(function RecentPrefetches({
  prefetches
}: {
  prefetches: string[];
}) {
  const logger = useLogger();
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500">Recent prefetches:</p>
      <div className="flex flex-wrap gap-1">
        {prefetches.map((route, index) => (
          <span 
            key={index}
            className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded"
          >
            {route}
          </span>
        ))}
      </div>
    </div>
  );
});

/**
 * Smart mode note component
 */
const SmartModeNote = memo(function SmartModeNote() {
  return (
    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-750 rounded text-xs text-gray-600 dark:text-gray-400">
      Smart predictions based on your navigation patterns
    </div>
  );
});

export default PredictiveLoadingIndicator;
