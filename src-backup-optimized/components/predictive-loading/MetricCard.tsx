/**
 * MetricCard - World-Class Component
 * Extracted from PredictiveLoadingIndicator architectural disaster
 */

import React, { memo } from 'react';
import { CloudIcon, TrendingUpIcon, WifiIcon, ActivityIcon } from '../icons';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

/**
 * Professional metric display card
 */
export const MetricCard = memo(function MetricCard({ 
  icon, 
  label, 
  value 
}: MetricCardProps): React.JSX.Element {
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
});

/**
 * Metrics grid component
 */
export const MetricsGrid = memo(function MetricsGrid({
  metrics,
  prefetchedCount
}: {
  metrics: any;
  prefetchedCount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricCard
        icon={<CloudIcon size={14} className="text-gray-500" />}
        label="Prefetched"
        value={prefetchedCount}
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
  );
});

/**
 * Helper function to format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}