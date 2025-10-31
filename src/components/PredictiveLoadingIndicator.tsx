import React, { useState, useEffect } from 'react';
import { usePredictiveLoading, usePrefetchMetrics, useRoutePrefetch } from '../hooks/usePredictiveLoading';
import { 
  ZapIcon, 
  CloudIcon, 
  WifiIcon,
  ActivityIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  RefreshCwIcon
} from './icons';

interface PredictiveLoadingIndicatorProps {
  show?: boolean;
  position?: 'top' | 'bottom';
  compact?: boolean;
}

/**
 * Predictive Loading Indicator Component
 * Shows real-time predictive loading status and metrics
 */
export function PredictiveLoadingIndicator({
  show = true,
  position = 'top',
  compact = true
}: PredictiveLoadingIndicatorProps): React.JSX.Element | null {
  const { isPreloading, preloadProgress } = usePredictiveLoading();
  const metrics = usePrefetchMetrics();
  const { prefetchedRoutes } = useRoutePrefetch();
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentPrefetches, setRecentPrefetches] = useState<string[]>([]);

  // Track recent prefetches
  useEffect(() => {
    if (prefetchedRoutes.size > recentPrefetches.length) {
      const newRoutes = Array.from(prefetchedRoutes).slice(-3);
      setRecentPrefetches(newRoutes);
    }
  }, [prefetchedRoutes, recentPrefetches.length]);

  if (!show) return null;

  const positionClasses = position === 'top' 
    ? 'top-0 left-0 right-0' 
    : 'bottom-0 left-0 right-0';

  // Compact view - just a thin loading bar
  if (compact && !isExpanded) {
    return (
      <>
        {/* Loading bar */}
        {isPreloading && (
          <div className={`fixed ${positionClasses} h-1 bg-gray-200 dark:bg-gray-800 z-50`}>
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 animate-pulse"
              style={{ width: `${preloadProgress * 100}%` }}
            />
          </div>
        )}

        {/* Floating indicator */}
        <button
          onClick={() => setIsExpanded(true)}
          className={`fixed ${position === 'top' ? 'top-4' : 'bottom-4'} right-4 z-50 p-2 bg-white dark:bg-gray-900 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group`}
          aria-label="Show predictive loading details"
        >
          <div className="relative">
            <ZapIcon size={20} className={`${isPreloading ? 'text-yellow-500 animate-pulse' : 'text-gray-400'}`} />
            {prefetchedRoutes.size > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
        </button>
      </>
    );
  }

  // Expanded view
  return (
    <div className={`fixed ${position === 'top' ? 'top-4' : 'bottom-4'} right-4 z-50 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ZapIcon size={18} className="animate-pulse" />
            <span className="font-semibold text-sm">Predictive Loading</span>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Minimize"
          >
            <MinimizeIcon size={16} />
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="p-4 space-y-3">
        {/* Current status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
          <div className="flex items-center gap-2">
            {isPreloading ? (
              <>
                <RefreshCwIcon size={14} className="animate-spin text-blue-500" />
                <span className="text-sm font-medium text-blue-500">Preloading...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon size={14} className="text-green-500" />
                <span className="text-sm font-medium text-green-500">Ready</span>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {isPreloading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{Math.round(preloadProgress * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${preloadProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            icon={<CloudIcon size={14} className="text-blue-500" />}
            label="Prefetched"
            value={prefetchedRoutes.size}
          />
          <MetricCard
            icon={<TrendingUpIcon size={14} className="text-green-500" />}
            label="Success Rate"
            value={`${metrics.totalPrefetches > 0 
              ? Math.round((metrics.successfulPrefetches / metrics.totalPrefetches) * 100) 
              : 100}%`}
          />
          <MetricCard
            icon={<WifiIcon size={14} className="text-purple-500" />}
            label="Bandwidth"
            value={formatBytes(metrics.bandwidthSaved)}
          />
          <MetricCard
            icon={<ActivityIcon size={14} className="text-orange-500" />}
            label="Avg Load"
            value={`${metrics.averageLoadTime}ms`}
          />
        </div>

        {/* Recent prefetches */}
        {recentPrefetches.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Recently Prefetched
            </div>
            <div className="space-y-1">
              {recentPrefetches.map((route, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <CheckCircleIcon size={12} className="text-green-500" />
                  <span className="text-gray-700 dark:text-gray-300">{route}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smart predictions */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold">Smart Mode:</span> Learning from your patterns to predict next actions
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric card component
function MetricCard({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
}) {
  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Minimize icon
const MinimizeIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);

/**
 * Prefetch status badge for individual components
 */
export function PrefetchStatusBadge({ 
  isPrefetched, 
  isPrefetching 
}: { 
  isPrefetched: boolean; 
  isPrefetching: boolean;
}) {
  if (!isPrefetching && !isPrefetched) return null;

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
      {isPrefetching ? (
        <>
          <RefreshCwIcon size={12} className="animate-spin text-blue-500" />
          <span className="text-xs text-blue-600 dark:text-blue-400">Preloading</span>
        </>
      ) : (
        <>
          <CheckCircleIcon size={12} className="text-green-500" />
          <span className="text-xs text-green-600 dark:text-green-400">Ready</span>
        </>
      )}
    </div>
  );
}

/**
 * Network status indicator
 */
export function NetworkStatusIndicator() {
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'slow'>('online');
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    type NetworkInformationWithEvents = NetworkInformation & {
      addEventListener?: (type: string, listener: () => void) => void;
      removeEventListener?: (type: string, listener: () => void) => void;
    };

    type NavigatorWithConnection = Navigator & {
      connection?: NetworkInformationWithEvents;
    };

    const navigatorWithConnection = navigator as NavigatorWithConnection;

    const updateNetworkStatus = () => {
      if (!navigator.onLine) {
        setNetworkStatus('offline');
      } else if (navigatorWithConnection.connection) {
        const connection = navigatorWithConnection.connection;
        const effectiveType = connection?.effectiveType ?? 'unknown';
        setConnectionType(effectiveType);
        
        if (['slow-2g', '2g'].includes(effectiveType)) {
          setNetworkStatus('slow');
        } else {
          setNetworkStatus('online');
        }
      }
    };

    updateNetworkStatus();
    
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    navigatorWithConnection.connection?.addEventListener?.('change', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      navigatorWithConnection.connection?.removeEventListener?.('change', updateNetworkStatus);
    };
  }, []);

  const getStatusColor = () => {
    switch (networkStatus) {
      case 'offline': return 'text-red-500';
      case 'slow': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const getStatusText = () => {
    switch (networkStatus) {
      case 'offline': return 'Offline';
      case 'slow': return `Slow (${connectionType})`;
      default: return `Online (${connectionType})`;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <WifiIcon size={16} className={getStatusColor()} />
      <span className={`text-sm ${getStatusColor()}`}>
        {getStatusText()}
      </span>
    </div>
  );
}
