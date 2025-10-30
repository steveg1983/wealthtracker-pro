import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { Card } from './common/Card';
import ActivityIcon from './icons/ActivityIcon';
import { AlertCircleIcon as AlertCircle, CheckCircleIcon as CheckCircle, XCircleIcon as XCircle } from './icons';
import { logger } from '../services/loggingService';
import { Decimal, formatPercentageValue, toDecimal } from '@wealthtracker/utils';

interface WebVitalScore {
  metric: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  threshold: { good: number; poor: number };
}

type NavigationTimingMetrics = ReturnType<ReturnType<typeof usePerformanceMonitoring>['getNavigationTiming']>;
type ResourceTimingEntry = ReturnType<ReturnType<typeof usePerformanceMonitoring>['getResourceTiming']>[number];
type MemoryUsageMetrics = ReturnType<ReturnType<typeof usePerformanceMonitoring>['getMemoryUsage']>;
type BundleSizeMetrics = ReturnType<ReturnType<typeof usePerformanceMonitoring>['getBundleSize']>;

interface ResourceMetrics {
  totalResources: number;
  jsCount: number;
  cssCount: number;
  avgJsLoad: number;
  avgCssLoad: number;
}

export const PerformanceDashboard: React.FC = () => {
  const {
    getNavigationTiming,
    getResourceTiming,
    getMemoryUsage,
    getBundleSize
  } = usePerformanceMonitoring();

  const [navigationTiming, setNavigationTiming] = useState<NavigationTimingMetrics>(null);
  const [resourceMetrics, setResourceMetrics] = useState<ResourceMetrics | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<MemoryUsageMetrics>(null);
  const [bundleSize, setBundleSize] = useState<BundleSizeMetrics | null>(null);
  const [webVitals, setWebVitals] = useState<WebVitalScore[]>([]);

  const calculateAverageDuration = useCallback((items: ResourceTimingEntry[]): number => {
    if (items.length === 0) {
      return 0;
    }
    const totalDuration = items.reduce((sum, entry) => sum + entry.duration, 0);
    return totalDuration / items.length;
  }, []);

  useEffect(() => {
    // Collect performance data after page load
    const collectMetrics = () => {
      setNavigationTiming(getNavigationTiming());

      const resources = getResourceTiming();
      const jsResources = resources.filter(resource => resource.type === 'script');
      const cssResources = resources.filter(resource => resource.type === 'link');

      setResourceMetrics({
        totalResources: resources.length,
        jsCount: jsResources.length,
        cssCount: cssResources.length,
        avgJsLoad: calculateAverageDuration(jsResources),
        avgCssLoad: calculateAverageDuration(cssResources)
      });

      setMemoryUsage(getMemoryUsage());
      setBundleSize(getBundleSize());
    };

    let loadListenerAttached = false;
    if (document.readyState === 'complete') {
      collectMetrics();
    } else {
      window.addEventListener('load', collectMetrics);
      loadListenerAttached = true;
    }

    // Monitor web vitals
    const observer = new PerformanceObserver((list: PerformanceObserverEntryList) => {
      const entries = list.getEntries();
      const vitals: WebVitalScore[] = [];

      entries.forEach((entry) => {
        if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
          vitals.push({
            metric: 'FCP',
            value: entry.startTime,
            rating: entry.startTime <= 1800 ? 'good' : entry.startTime <= 3000 ? 'needs-improvement' : 'poor',
            threshold: { good: 1800, poor: 3000 }
          });
        }
      });

      if (vitals.length > 0) {
        setWebVitals(prev => [...prev, ...vitals]);
      }
    });

    try {
      observer.observe({ type: 'paint', buffered: true });
    } catch (error) {
      logger.warn('Paint timing not supported', error);
    }

    return () => {
      if (loadListenerAttached) {
        window.removeEventListener('load', collectMetrics);
      }
      observer.disconnect();
    };
  }, [calculateAverageDuration, getBundleSize, getMemoryUsage, getNavigationTiming, getResourceTiming]);

  const getRatingIcon = useCallback((rating: WebVitalScore['rating']) => {
    switch (rating) {
      case 'good':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'needs-improvement':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'poor':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  }, []);

  const formatBytes = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    const byteValue = toDecimal(bytes);
    const divisor = toDecimal(k).pow(i);
    const normalized = byteValue.dividedBy(divisor).toDecimalPlaces(2);
    return `${normalized.toNumber()} ${sizes[i]}`;
  }, []);

  const formatTime = useCallback((ms: number) => {
    const duration = toDecimal(ms);

    if (duration.lessThan(1000)) {
      return `${duration.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()}ms`;
    }

    const seconds = duration
      .dividedBy(1000)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    const formatted = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(seconds);

    return `${formatted}s`;
  }, []);

  const recommendations = useMemo(() => {
    const items: Array<{ condition: boolean; message: string }> = [];

    if (bundleSize && bundleSize.totalSize > 1_000_000) {
      items.push({
        condition: true,
        message: 'Consider code splitting - total bundle size exceeds 1MB'
      });
    }

    if (resourceMetrics && resourceMetrics.jsCount > 20) {
      items.push({
        condition: true,
        message: `High number of JavaScript files (${resourceMetrics.jsCount}) - consider bundling`
      });
    }

    if (memoryUsage && memoryUsage.percentUsed > 70) {
      items.push({
        condition: true,
        message: 'High memory usage detected - check for memory leaks'
      });
    }

    if (navigationTiming && navigationTiming.loadTime > 3000) {
      items.push({
        condition: true,
        message: 'Page load time exceeds 3 seconds - optimize critical rendering path'
      });
    }

    return items;
  }, [bundleSize, memoryUsage, navigationTiming, resourceMetrics]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <ActivityIcon className="w-8 h-8 text-gray-600" />
        <h2 className="text-2xl font-bold">Performance Dashboard</h2>
      </div>

      {/* Core Web Vitals */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Core Web Vitals</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {webVitals.map((vital, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">{vital.metric}</p>
                <p className="text-xl font-semibold">{formatTime(vital.value)}</p>
              </div>
              {getRatingIcon(vital.rating)}
            </div>
          ))}
        </div>
      </Card>

      {/* Navigation Timing */}
      {navigationTiming && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Page Load Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Load Time</p>
              <p className="text-xl font-semibold">{formatTime(navigationTiming.loadTime)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">DOM Content Loaded</p>
              <p className="text-xl font-semibold">{formatTime(navigationTiming.domContentLoaded)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">DOM Interactive</p>
              <p className="text-xl font-semibold">{formatTime(navigationTiming.domInteractive)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Bundle Size */}
      {bundleSize && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Bundle Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Total JS Size</p>
              <p className="text-xl font-semibold">{formatBytes(bundleSize.totalSize)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Script Count</p>
              <p className="text-xl font-semibold">{bundleSize.scriptCount}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Largest Bundle</p>
              <p className="text-xl font-semibold">
                {bundleSize.largestBundle ? formatBytes(bundleSize.largestBundle.size) : 'N/A'}
              </p>
              {bundleSize.largestBundle?.name && (
                <p className="text-xs text-gray-500">{bundleSize.largestBundle.name}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Resource Loading */}
      {resourceMetrics && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Resource Loading</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">JavaScript Files</p>
              <p className="text-xl font-semibold">{resourceMetrics.jsCount}</p>
              <p className="text-sm text-gray-500">Avg load time: {formatTime(resourceMetrics.avgJsLoad)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">CSS Files</p>
              <p className="text-xl font-semibold">{resourceMetrics.cssCount}</p>
              <p className="text-sm text-gray-500">Avg load time: {formatTime(resourceMetrics.avgCssLoad)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Memory Usage */}
      {memoryUsage && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Memory Usage</h3>
          {(() => {
            const percentUsedDecimal = toDecimal(memoryUsage.percentUsed);
            const percentDisplay = formatPercentageValue(percentUsedDecimal, 1);
            const percentWidth = Decimal.min(percentUsedDecimal, toDecimal(100)).toNumber();

            return (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">JS Heap Usage</span>
                <span className="text-sm font-medium">{percentDisplay}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-gray-600 h-2.5 rounded-full"
                  style={{ width: `${percentWidth}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">{formatBytes(memoryUsage.usedJSHeapSize)}</span>
                <span className="text-xs text-gray-500">{formatBytes(memoryUsage.jsHeapSizeLimit)}</span>
              </div>
            </div>
          </div>
            );
          })()}
        </Card>
      )}

      {/* Performance Tips */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Performance Recommendations</h3>
        <ul className="space-y-2">
          {recommendations.map((item, index) => (
            item.condition ? (
              <li key={index} className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <span className="text-sm">{item.message}</span>
              </li>
            ) : null
          ))}
        </ul>
      </Card>
    </div>
  );
};
