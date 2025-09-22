/**
 * Performance Monitoring Dashboard - Phase 7.6
 * Comprehensive performance tracking and optimization insights
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ZapIcon,
  ClockIcon,
  AlertTriangleIcon,
  CheckCircleIcon
} from '../icons';
import { bundleSizeMonitor, memoryOptimizer, PERFORMANCE_TARGETS } from '../../utils/performance/bundleOptimizer';
import { intelligentPreloading } from '../../utils/performance/intelligentPreloading';

interface PerformanceMetric {
  name: string;
  value: number;
  target: number;
  status: 'good' | 'warning' | 'critical';
  unit: string;
}

export default function PerformanceMonitoringDashboard(): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Performance metrics
  const metrics = useMemo((): PerformanceMetric[] => {
    void refreshKey; // trigger recomputation when refreshKey updates
    const bundleReport = bundleSizeMonitor.getBundleReport();
    const preloadStats = intelligentPreloading.getPreloadingStats();
    const memoryInfo = memoryOptimizer.getMemoryInfo();

    const coreMetrics: PerformanceMetric[] = [
      {
        name: 'Bundle Size',
        value: bundleReport.totalSize / 1024,
        target: PERFORMANCE_TARGETS.MAX_BUNDLE_SIZE_GZIPPED / 1024,
        status: bundleReport.totalSize > PERFORMANCE_TARGETS.MAX_BUNDLE_SIZE_GZIPPED ? 'critical' : 'good',
        unit: 'KB'
      },
      {
        name: 'Chunk Count',
        value: bundleReport.chunkCount,
        target: 20,
        status: bundleReport.chunkCount > 30 ? 'warning' : 'good',
        unit: 'chunks'
      },
      {
        name: 'Preloaded Resources',
        value: preloadStats.preloadedCount,
        target: 5,
        status: preloadStats.preloadedCount >= 3 ? 'good' : 'warning',
        unit: 'resources'
      }
    ];

    // Add memory metrics if available
    if (memoryInfo) {
      coreMetrics.push({
        name: 'Memory Usage',
        value: memoryInfo.percentage,
        target: 70,
        status: memoryInfo.percentage > 85 ? 'critical' : memoryInfo.percentage > 70 ? 'warning' : 'good',
        unit: '%'
      });
    }

    return coreMetrics;
  }, [refreshKey]);

  // Web Vitals monitoring
  const [webVitals, setWebVitals] = useState<{
    FCP?: number;
    LCP?: number;
    FID?: number;
    CLS?: number;
  }>({});

  useEffect(() => {
    // Monitor Web Vitals if available
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'paint') {
            if (entry.name === 'first-contentful-paint') {
              setWebVitals(prev => ({ ...prev, FCP: entry.startTime }));
            }
          }
          if (entry.entryType === 'largest-contentful-paint') {
            setWebVitals(prev => ({ ...prev, LCP: entry.startTime }));
          }
        });
      });

      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });

      return () => observer.disconnect();
    }
  }, []);

  const refresh = () => setRefreshKey(prev => prev + 1);

  const getStatusColor = (status: PerformanceMetric['status']): string => {
    switch (status) {
      case 'good': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
    }
  };

  const getStatusIcon = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good': return <CheckCircleIcon size={16} className="text-green-500" />;
      case 'warning': return <AlertTriangleIcon size={16} className="text-yellow-500" />;
      case 'critical': return <AlertTriangleIcon size={16} className="text-red-500" />;
    }
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors"
          title="Performance Monitor"
        >
          <ZapIcon size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-96">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ZapIcon size={20} className="text-blue-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Performance Monitor</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Refresh metrics"
            >
              <ClockIcon size={16} className="text-gray-500" />
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Minimize"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {metrics.map((metric) => (
            <div
              key={metric.name}
              className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {metric.name}
                </span>
                {getStatusIcon(metric.status)}
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold ${getStatusColor(metric.status)}`}>
                  {metric.value.toFixed(1)}
                </span>
                <span className="text-xs text-gray-500">
                  {metric.unit}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Target: {metric.target}{metric.unit}
              </div>
            </div>
          ))}
        </div>

        {/* Web Vitals */}
        {Object.keys(webVitals).length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Web Vitals
            </h4>
            <div className="space-y-2">
              {webVitals.FCP && (
                <div className="flex justify-between text-xs">
                  <span>First Contentful Paint</span>
                  <span className={webVitals.FCP > 2000 ? 'text-red-500' : 'text-green-500'}>
                    {Math.round(webVitals.FCP)}ms
                  </span>
                </div>
              )}
              {webVitals.LCP && (
                <div className="flex justify-between text-xs">
                  <span>Largest Contentful Paint</span>
                  <span className={webVitals.LCP > 2500 ? 'text-red-500' : 'text-green-500'}>
                    {Math.round(webVitals.LCP)}ms
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bundle Analysis */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Bundle Analysis
          </h4>
          <div className="space-y-2 text-xs">
            {bundleSizeMonitor.getBundleReport().oversizedChunks.length > 0 && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border-l-2 border-red-500">
                <div className="flex items-center gap-1 text-red-700 dark:text-red-300">
                  <AlertTriangleIcon size={12} />
                  <span className="font-medium">Large Chunks Detected</span>
                </div>
                {bundleSizeMonitor.getBundleReport().oversizedChunks.slice(0, 3).map(chunk => (
                  <div key={chunk.name} className="text-red-600 dark:text-red-400 mt-1">
                    {chunk.name}: {(chunk.size / 1024).toFixed(1)}KB
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preloading Status */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Preloading Strategy
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Connection:</span>
              <span className="font-mono">{intelligentPreloading.getPreloadingStats().connectionSpeed}</span>
            </div>
            <div className="flex justify-between">
              <span>Device:</span>
              <span className="font-mono">{intelligentPreloading.getPreloadingStats().deviceType}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <button
            onClick={() => intelligentPreloading.preloadCriticalResources()}
            className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
          >
            Force Preload
          </button>
          <button
            onClick={() => {
              intelligentPreloading.clearCache();
              refresh();
            }}
            className="flex-1 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium rounded transition-colors"
          >
            Clear Cache
          </button>
        </div>
      </div>
    </div>
  );
}
