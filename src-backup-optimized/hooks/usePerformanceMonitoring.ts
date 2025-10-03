import { useEffect, useCallback } from 'react';
import { useLogger } from '../services/ServiceProvider';

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

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface PerformanceLongTaskTiming extends PerformanceEntry {
  duration: number;
  startTime: number;
}

export const usePerformanceMonitoring = () => {
  // Track Core Web Vitals
  const trackWebVitals = useCallback(() => {
    const metrics: PerformanceMetrics = {};
    
    try {
      logger.debug('Initializing performance monitoring', {
        componentName: 'usePerformanceMonitoring'
      });

      // Observe Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          try {
            const entries = entryList.getEntries();
            if (entries.length > 0) {
              const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
              metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
              logger.info('LCP measured:', metrics.lcp, 'usePerformanceMonitoring');
            }
          } catch (error) {
            logger.error('Error processing LCP entry:', error, 'usePerformanceMonitoring');
          }
        });

        
        if ('observe' in lcpObserver) {
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        }
      } catch (error) {
        logger.error('Failed to setup LCP observer:', error, 'usePerformanceMonitoring');
      }

      // Observe First Input Delay
      try {
        const fidObserver = new PerformanceObserver((entryList) => {
          try {
            const entries = entryList.getEntries();
            entries.forEach((entry) => {
              try {
                const fidEntry = entry as PerformanceEventTiming;
                if (fidEntry.processingStart && fidEntry.startTime) {
                  metrics.fid = fidEntry.processingStart - fidEntry.startTime;
                  logger.info('FID measured:', metrics.fid, 'usePerformanceMonitoring');
                }
              } catch (entryError) {
                logger.error('Error processing FID entry:', entryError, 'usePerformanceMonitoring');
              }
            });
          } catch (error) {
            logger.error('Error processing FID entries:', error, 'usePerformanceMonitoring');
          }
        });
        
        if ('observe' in fidObserver) {
          fidObserver.observe({ type: 'first-input', buffered: true });
        }
      } catch (error) {
        logger.error('Failed to setup FID observer:', error, 'usePerformanceMonitoring');
      }

      // Observe Cumulative Layout Shift
      try {
        const clsObserver = new PerformanceObserver((entryList) => {
          try {
            let cls = 0;
            entryList.getEntries().forEach((entry) => {
              try {
                const layoutEntry = entry as LayoutShift;
                if (typeof layoutEntry.value === 'number' && !layoutEntry.hadRecentInput) {
                  cls += layoutEntry.value;
                }
              } catch (entryError) {
                logger.error('Error processing CLS entry:', entryError, 'usePerformanceMonitoring');
              }
            });
            metrics.cls = cls;
            logger.info('CLS measured:', metrics.cls, 'usePerformanceMonitoring');
          } catch (error) {
            logger.error('Error processing CLS entries:', error, 'usePerformanceMonitoring');
          }
        });
        
        if ('observe' in clsObserver) {
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        }
      } catch (error) {
        logger.error('Failed to setup CLS observer:', error, 'usePerformanceMonitoring');
      }

      // Observe Interaction to Next Paint
      try {
        const inpObserver = new PerformanceObserver((entryList) => {
          try {
            const entries = entryList.getEntries();
            entries.forEach((entry) => {
              try {
                const inpEntry = entry as PerformanceEventTiming;
                if (typeof inpEntry.duration === 'number') {
                  metrics.inp = inpEntry.duration;
                  logger.info('INP measured:', metrics.inp, 'usePerformanceMonitoring');
                }
              } catch (entryError) {
                logger.error('Error processing INP entry:', entryError, 'usePerformanceMonitoring');
              }
            });
          } catch (error) {
            logger.error('Error processing INP entries:', error, 'usePerformanceMonitoring');
          }
        });
        
        if ('observe' in inpObserver) {
          inpObserver.observe({ type: 'event', buffered: true });
        }
      } catch (error) {
        logger.error('Failed to setup INP observer:', error, 'usePerformanceMonitoring');
      }
      
    } catch (error) {
      logger.error('Failed to initialize performance monitoring:', error, 'usePerformanceMonitoring');
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
        list.getEntries().forEach((entry) => {
          const longTask = entry as PerformanceLongTaskTiming;
          logger.warn('Long task detected:', {
            duration: longTask.duration,
            startTime: longTask.startTime,
            attribution: (entry as any)?.attribution
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
      const memory = (performance as Performance & { 
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        }
      }).memory;
      if (!memory) return null;
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
  const sendMetrics = useCallback((metrics: Record<string, unknown>) => {
    // In production, send to analytics service
    if (process.env.NODE_ENV === 'production') {
      // Example: send to Google Analytics
      if (typeof (window as any).gtag !== 'undefined') {
        (window as any).gtag('event', 'performance', {
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
