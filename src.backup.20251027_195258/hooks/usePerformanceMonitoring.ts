import { useEffect, useCallback } from 'react';
import { logger } from '../services/loggingService';

interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  cls?: number; // Cumulative Layout Shift
  fid?: number; // First Input Delay
  ttfb?: number; // Time to First Byte
  inp?: number; // Interaction to Next Paint
}

interface NavigationTiming {
  loadTime: number;
  domContentLoaded: number;
  domInteractive: number;
}

interface ResourceTiming {
  name: string;
  duration: number;
  size: number;
  type: string;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

type TaskAttributionData = {
  name?: string;
  startTime?: number;
  duration?: number;
  containerSrc?: string;
  containerId?: string;
  containerName?: string;
  entryType?: string;
};

export const usePerformanceMonitoring = () => {
  // Track Core Web Vitals
  const trackWebVitals = useCallback(() => {
    const metrics: PerformanceMetrics = {};

    // Observe Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as PerformanceEntry[];
      const lastEntry = entries.at(-1) as LargestContentfulPaint | undefined;
      if (!lastEntry) {
        return;
      }

      const lcp = lastEntry.renderTime ?? lastEntry.loadTime;
      if (typeof lcp === 'number' && Number.isFinite(lcp)) {
        metrics.lcp = lcp;
        logger.info('LCP', metrics.lcp);
      }
    });

    // Observe First Input Delay
    const fidObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        if (entry.entryType === 'first-input') {
          const eventTiming = entry as PerformanceEventTiming;
          const fid = eventTiming.processingStart - eventTiming.startTime;
          if (Number.isFinite(fid)) {
            metrics.fid = fid;
            logger.info('FID', metrics.fid);
          }
        }
      });
    });

    // Observe Cumulative Layout Shift
    const clsObserver = new PerformanceObserver((entryList) => {
      let cls = 0;
      entryList.getEntries().forEach((entry) => {
        if (entry.entryType === 'layout-shift') {
          const layoutShift = entry as LayoutShiftEntry;
          if (!layoutShift.hadRecentInput) {
            cls += layoutShift.value;
          }
        }
      });
      metrics.cls = cls;
      logger.info('CLS', metrics.cls);
    });

    // Observe Interaction to Next Paint
    const inpObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        if ('duration' in entry && entry.entryType === 'event') {
          const eventTiming = entry as PerformanceEventTiming;
          metrics.inp = eventTiming.duration;
          logger.info('INP', metrics.inp);
        }
      });
    });

    try {
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      fidObserver.observe({ type: 'first-input', buffered: true });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      inpObserver.observe({ type: 'event', buffered: true });
    } catch (error) {
      logger.warn('Performance monitoring not supported:', error);
    }

    // Get First Contentful Paint
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach((entry) => {
      if (entry.name === 'first-contentful-paint') {
        metrics.fcp = entry.startTime;
        logger.info('FCP', metrics.fcp);
      }
    });

    // Get Time to First Byte
    const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navigationEntries.length > 0) {
      const navEntry = navigationEntries[0];
      if (navEntry) {
        metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
        logger.info('TTFB', metrics.ttfb);
      }
    }

    return metrics;
  }, []);

  // Track navigation timing
  const getNavigationTiming = useCallback((): NavigationTiming | null => {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    
    if (!navigationEntry) return null;

    return {
      loadTime: navigationEntry.loadEventEnd - navigationEntry.fetchStart,
      domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
      domInteractive: navigationEntry.domInteractive - navigationEntry.fetchStart
    };
  }, []);

  // Track resource timing
  const getResourceTiming = useCallback((): ResourceTiming[] => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    return resources.map(resource => ({
      name: resource.name,
      duration: resource.duration,
      size: resource.transferSize || 0,
      type: resource.initiatorType
    }));
  }, []);

  // Track custom metrics
  const trackCustomMetric = useCallback((name: string, value: number) => {
    performance.measure(name, {
      start: 0,
      duration: value
    });
    logger.info('Custom metric', { name, value });
  }, []);

  // Track component render time
  const measureComponentRender = useCallback((componentName: string) => {
    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;
    const measureName = `${componentName}-render`;

    return {
      start: () => performance.mark(startMark),
      end: () => {
        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);
        const measure = performance.getEntriesByName(measureName)[0];
        if (!measure) {
          return 0;
        }
        logger.info('Component render time', { componentName, ms: measure.duration });
        return measure.duration;
      }
    };
  }, []);

  // Track long tasks
  const trackLongTasks = useCallback(() => {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'longtask') {
            const longTask = entry as PerformanceEntry & { attribution?: readonly TaskAttributionData[] };
            logger.warn('Long task detected:', {
              duration: longTask.duration,
              startTime: longTask.startTime,
              attribution: longTask.attribution ?? []
            });
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['longtask'] });
      } catch (err) {
        logger.warn('Long task monitoring not supported', err);
      }
    }
  }, []);

  // Memory usage tracking
  const getMemoryUsage = useCallback(() => {
    const performanceWithMemory = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };

    const memory = performanceWithMemory.memory;
    if (!memory) {
      return null;
    }

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      percentUsed: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    };
  }, []);

  // Bundle size tracking
  const getBundleSize = useCallback(() => {
    const scripts = performance.getEntriesByType('resource').filter(
      entry => entry.name.endsWith('.js')
    ) as PerformanceResourceTiming[];

    const totalSize = scripts.reduce((sum, script) => sum + (script.transferSize || 0), 0);
    const largestBundle = scripts.reduce<PerformanceResourceTiming | null>((largest, script) => {
      const scriptSize = script.transferSize || 0;
      const largestSize = largest?.transferSize || 0;
      return scriptSize > largestSize ? script : largest;
    }, null);

    return {
      totalSize,
      scriptCount: scripts.length,
      largestBundle: largestBundle
        ? {
            name: largestBundle.name.split('/').pop() || '',
            size: largestBundle.transferSize || 0
          }
        : null
    };
  }, []);

  // Send metrics to analytics
  const sendMetrics = useCallback((metrics: Record<string, unknown> | Array<Record<string, unknown>>) => {
    // In production, send to analytics service
    if (process.env.NODE_ENV === 'production') {
      // Google Analytics integration would go here
      // Currently disabled to avoid type assertions
    }
    
    // Also log in development for easier debugging
    if (process.env.NODE_ENV === 'development') {
      logger.info('Performance metrics snapshot', metrics);
    }
  }, []);

  // Initialize monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Track web vitals after page load
    const handleLoad = () => {
      trackWebVitals();
      trackLongTasks();

      const navTiming = getNavigationTiming();
      const bundleInfo = getBundleSize();
      const memoryInfo = getMemoryUsage();

      logger.info('Navigation Timing', navTiming);
      logger.info('Bundle Size', bundleInfo);
      logger.info('Memory Usage', memoryInfo);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad, { once: true });
    }
  }, [trackWebVitals, trackLongTasks, getNavigationTiming, getBundleSize, getMemoryUsage]);

  return {
    trackCustomMetric,
    measureComponentRender,
    getNavigationTiming,
    getResourceTiming,
    getMemoryUsage,
    getBundleSize,
    sendMetrics
  };
};
