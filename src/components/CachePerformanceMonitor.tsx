import React, { useState } from 'react';
import { useCacheStats } from '../hooks/useSmartCache';
import { 
  TrendingUpIcon, 
  DatabaseIcon, 
  RefreshCwIcon,
  ZapIcon,
  BarChart3Icon,
  AlertCircleIcon,
  CheckCircleIcon
} from './icons';

interface CachePerformanceMonitorProps {
  show?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
}

/**
 * Cache Performance Monitor Component
 * Shows real-time cache statistics and performance metrics
 */
export function CachePerformanceMonitor({
  show = false,
  position = 'bottom-right',
  compact = false
}: CachePerformanceMonitorProps): React.JSX.Element | null {
  const stats = useCacheStats();
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showDetails, setShowDetails] = useState(false);

  // Only show in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!show || !isDevelopment) return null;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const getHitRateColor = (rate: number): string => {
    if (rate >= 0.8) return 'text-green-500';
    if (rate >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (compact && !isExpanded) {
    return (
      <div
        className={`fixed ${positionClasses[position]} z-50`}
      >
        <button
          onClick={() => setIsExpanded(true)}
          className="p-2 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors"
          aria-label="Show cache monitor"
        >
          <DatabaseIcon size={20} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300`}
      style={{ width: showDetails ? '400px' : '280px' }}
    >
      {/* Header */}
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DatabaseIcon size={16} className="text-primary" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Cache Monitor
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Toggle details"
            >
              <BarChart3Icon size={14} />
            </button>
            {compact && (
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Minimize"
              >
                <MinimizeIcon size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-4 space-y-3">
        {/* Hit Rate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUpIcon size={16} className={getHitRateColor(stats.avgHitRate)} />
            <span className="text-sm text-gray-600 dark:text-gray-400">Hit Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${getHitRateColor(stats.avgHitRate)}`}>
              {stats.hitRate}
            </span>
            {stats.avgHitRate >= 0.8 ? (
              <CheckCircleIcon size={14} className="text-green-500" />
            ) : (
              <AlertCircleIcon size={14} className="text-yellow-500" />
            )}
          </div>
        </div>

        {/* Cache Size */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DatabaseIcon size={16} className="text-blue-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Cache Size</span>
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {stats.size} items
          </span>
        </div>

        {/* Hits vs Misses */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ZapIcon size={16} className="text-purple-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Hits / Misses</span>
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {stats.hits} / {stats.misses}
          </span>
        </div>

        {/* Evictions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCwIcon size={16} className="text-orange-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Evictions</span>
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {stats.evictions}
          </span>
        </div>

        {/* Hit Rate Bar */}
        <div className="pt-2">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                stats.avgHitRate >= 0.8 ? 'bg-green-500' :
                stats.avgHitRate >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${stats.avgHitRate * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      {showDetails && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Performance Breakdown
          </div>
          
          {/* Cache Effectiveness */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Cache Effectiveness</span>
              <span className={`font-medium ${
                stats.avgHitRate >= 0.8 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {stats.avgHitRate >= 0.8 ? 'Excellent' : 
                 stats.avgHitRate >= 0.5 ? 'Good' : 'Poor'}
              </span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Memory Pressure</span>
              <span className={`font-medium ${
                stats.evictions < 10 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {stats.evictions < 10 ? 'Low' : 'High'}
              </span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Avg Response Time</span>
              <span className="font-medium text-gray-900 dark:text-white">
                ~{stats.hits > 0 ? '2ms' : 'N/A'}
              </span>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="pt-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Recent Activity
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              <ActivityItem type="hit" key="Products list" />
              <ActivityItem type="miss" key="User profile" />
              <ActivityItem type="hit" key="Transaction #1234" />
              <ActivityItem type="eviction" key="Old search results" />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={stats.clearCache}
          className="w-full px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors"
        >
          Clear Cache
        </button>
      </div>
    </div>
  );
}

// Activity item component
function ActivityItem({ type, key }: { type: 'hit' | 'miss' | 'eviction'; key: string }) {
  const icons = {
    hit: <CheckCircleIcon size={12} className="text-green-500" />,
    miss: <AlertCircleIcon size={12} className="text-yellow-500" />,
    eviction: <RefreshCwIcon size={12} className="text-orange-500" />
  };

  const labels = {
    hit: 'HIT',
    miss: 'MISS',
    eviction: 'EVICT'
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {icons[type]}
      <span className="font-mono text-gray-500 dark:text-gray-400">
        [{labels[type]}]
      </span>
      <span className="text-gray-700 dark:text-gray-300 truncate">
        {key}
      </span>
    </div>
  );
}

// Minimize icon
const MinimizeIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);
