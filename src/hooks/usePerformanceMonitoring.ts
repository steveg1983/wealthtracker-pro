import { useEffect, useCallback } from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

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

export const usePerformanceMonitoring = () => {
  // Track Core Web Vitals
  const trackWebVitals = useCallback(() => {
    const metrics: PerformanceMetrics = {};

    // Observe Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
      logger.info('LCP', metrics.lcp);
    });

    // Observe First Input Delay
    const fidObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: any) => {
        metrics.fid = entry.processingStart - entry.startTime;
        logger.info('FID', metrics.fid);
      });
    });

    // Observe Cumulative Layout Shift
    const clsObserver = new PerformanceObserver((entryList) => {
      let cls = 0;
      entryList.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      });
      metrics.cls = cls;
      logger.info('CLS', metrics.cls);
    });

    // Observe Interaction to Next Paint
    const inpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: any) => {
        metrics.inp = entry.duration;
        logger.info('INP', metrics.inp);
      });
    });

    try {
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      fidObserver.observe({ type: 'first-input', buffered: true });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 });
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
      metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
      logger.info('TTFB', metrics.ttfb);
    }

    return metrics;
  }, []);

  // Track navigation timing
  const getNavigationTiming = useCallback((): NavigationTiming | null => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (!navigation) return null;

    return {
      loadTime: navigation.loadEventEnd - navigation.fetchStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      domInteractive: navigation.domInteractive - navigation.fetchStart
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
        logger.info('Component render time', { componentName, ms: measure.duration });
        return measure.duration;
      }
    };
  }, []);

  // Track long tasks
  const trackLongTasks = useCallback(() => {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          logger.warn('Long task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
            attribution: entry.attribution
          });
        });
      });

      try {
        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        logger.warn('Long task monitoring not supported');
      }
    }
  }, []);

  // Memory usage tracking
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        percentUsed: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }, []);

  // Bundle size tracking
  const getBundleSize = useCallback(() => {
    const scripts = performance.getEntriesByType('resource').filter(
      entry => entry.name.endsWith('.js')
    ) as PerformanceResourceTiming[];

    const totalSize = scripts.reduce((sum, script) => sum + (script.transferSize || 0), 0);
    const largestBundle = scripts.reduce((largest, script) => 
      (script.transferSize || 0) > (largest.transferSize || 0) ? script : largest
    );

    return {
      totalSize,
      scriptCount: scripts.length,
      largestBundle: {
        name: largestBundle.name.split('/').pop() || '',
        size: largestBundle.transferSize || 0
      }
    };
  }, []);

  // Send metrics to analytics
  const sendMetrics = useCallback((metrics: any) => {
    // In production, send to analytics service
    if (process.env.NODE_ENV === 'production') {
      // Example: send to Google Analytics
      if (typeof gtag !== 'undefined') {
        gtag('event', 'performance', {
          event_category: 'Web Vitals',
          ...metrics
        });
      }
    }
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.table(metrics);
    }
  }, []);

  // Initialize monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Track web vitals after page load
    if (document.readyState === 'complete') {
      trackWebVitals();
      trackLongTasks();
    } else {
      window.addEventListener('load', () => {
        trackWebVitals();
        trackLongTasks();
        
        // Log initial metrics
        const navTiming = getNavigationTiming();
        const bundleInfo = getBundleSize();
        const memoryInfo = getMemoryUsage();
        
        logger.info('Navigation Timing', navTiming);
        logger.info('Bundle Size', bundleInfo);
        logger.info('Memory Usage', memoryInfo);
      });
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
