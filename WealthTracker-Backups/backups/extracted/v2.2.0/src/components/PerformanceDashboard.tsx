import { useState, useEffect } from 'react';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { Card } from './common/Card';
import ActivityIcon from './icons/ActivityIcon';
import { AlertCircleIcon as AlertCircle, CheckCircleIcon as CheckCircle, XCircleIcon as XCircle } from './icons';
import { logger } from '../services/loggingService';

interface NavigationTimingState {
  loadTime: number;
  domContentLoaded: number;
  domInteractive: number;
}

interface ResourceMetrics {
  totalResources: number;
  jsCount: number;
  cssCount: number;
  avgJsLoad: number;
  avgCssLoad: number;
}

interface MemoryUsage {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  percentUsed: number;
}

interface BundleSize {
  totalSize: number;
  scriptCount: number;
  largestBundle: {
    name: string;
    size: number;
  };
}

interface WebVitalScore {
  metric: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  threshold: { good: number; poor: number };
}

export const PerformanceDashboard: React.FC = () => {
  const {
    getNavigationTiming,
    getResourceTiming,
    getMemoryUsage,
    getBundleSize
  } = usePerformanceMonitoring();

  const [navigationTiming, setNavigationTiming] = useState<NavigationTimingState | null>(null);
  const [resourceMetrics, setResourceMetrics] = useState<ResourceMetrics | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<MemoryUsage | null>(null);
  const [bundleSize, setBundleSize] = useState<BundleSize | null>(null);
  const [webVitals, setWebVitals] = useState<WebVitalScore[]>([]);

  useEffect(() => {
    // Collect performance data after page load
    const collectMetrics = () => {
      setNavigationTiming(getNavigationTiming());
      
      const resources = getResourceTiming();
      const jsResources = resources.filter(r => r.type === 'script');
      const cssResources = resources.filter(r => r.type === 'link');
      
      setResourceMetrics({
        totalResources: resources.length,
        jsCount: jsResources.length,
        cssCount: cssResources.length,
        avgJsLoad: jsResources.reduce((sum, r) => sum + r.duration, 0) / jsResources.length || 0,
        avgCssLoad: cssResources.reduce((sum, r) => sum + r.duration, 0) / cssResources.length || 0
      });
      
      setMemoryUsage(getMemoryUsage());
      setBundleSize(getBundleSize());
    };

    if (document.readyState === 'complete') {
      collectMetrics();
    } else {
      window.addEventListener('load', collectMetrics);
    }

    // Monitor web vitals
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const vitals: WebVitalScore[] = [];

      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
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
      logger.warn('Paint timing not supported');
    }

    return () => {
      window.removeEventListener('load', collectMetrics);
    };
  }, [getNavigationTiming, getResourceTiming, getMemoryUsage, getBundleSize]);

  const getRatingIcon = (rating: string) => {
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
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

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
              <p className="text-xl font-semibold">{formatBytes(bundleSize.largestBundle.size)}</p>
              <p className="text-xs text-gray-500">{bundleSize.largestBundle.name}</p>
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
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">JS Heap Usage</span>
                <span className="text-sm font-medium">{memoryUsage.percentUsed.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-gray-600 h-2.5 rounded-full"
                  style={{ width: `${Math.min(memoryUsage.percentUsed, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">{formatBytes(memoryUsage.usedJSHeapSize)}</span>
                <span className="text-xs text-gray-500">{formatBytes(memoryUsage.jsHeapSizeLimit)}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Performance Tips */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Performance Recommendations</h3>
        <ul className="space-y-2">
          {bundleSize && bundleSize.totalSize > 1000000 && (
            <li className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <span className="text-sm">Consider code splitting - total bundle size exceeds 1MB</span>
            </li>
          )}
          {resourceMetrics && resourceMetrics.jsCount > 20 && (
            <li className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <span className="text-sm">High number of JavaScript files ({resourceMetrics.jsCount}) - consider bundling</span>
            </li>
          )}
          {memoryUsage && memoryUsage.percentUsed > 70 && (
            <li className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <span className="text-sm">High memory usage detected - check for memory leaks</span>
            </li>
          )}
          {navigationTiming && navigationTiming.loadTime > 3000 && (
            <li className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <span className="text-sm">Page load time exceeds 3 seconds - optimize critical rendering path</span>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
};
