import { useEffect, useRef, useCallback, useState } from 'react';
import { unstable_batchedUpdates as reactDomBatchedUpdates } from 'react-dom';
import { Decimal } from '@wealthtracker/utils';

interface PerformanceMetrics {
  renderTime: number;
  dataFetchTime: number;
  widgetLoadTimes: Map<string, number>;
  totalMemoryUsage?: number;
  fps?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const formatDecimal = (value: number, digits: number = 2): string =>
  new Decimal(value)
    .toDecimalPlaces(digits, Decimal.ROUND_HALF_UP)
    .toNumber()
    .toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

class DashboardCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Singleton cache instance
const dashboardCache = new DashboardCache();

export function useDashboardPerformance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    dataFetchTime: 0,
    widgetLoadTimes: new Map()
  });
  
  const renderStartTime = useRef<number>(0);
  const dataFetchStartTime = useRef<number>(0);
  const widgetLoadStartTimes = useRef<Map<string, number>>(new Map());
  const frameCount = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);

  // Measure render performance
  const startRenderMeasure = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  const endRenderMeasure = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current;
    setMetrics(prev => ({ ...prev, renderTime }));
  }, []);

  // Measure data fetch performance
  const startDataFetchMeasure = useCallback(() => {
    dataFetchStartTime.current = performance.now();
  }, []);

  const endDataFetchMeasure = useCallback(() => {
    const dataFetchTime = performance.now() - dataFetchStartTime.current;
    setMetrics(prev => ({ ...prev, dataFetchTime }));
  }, []);

  // Measure widget load performance
  const startWidgetLoadMeasure = useCallback((widgetId: string) => {
    widgetLoadStartTimes.current.set(widgetId, performance.now());
  }, []);

  const endWidgetLoadMeasure = useCallback((widgetId: string) => {
    const startTime = widgetLoadStartTimes.current.get(widgetId);
    if (startTime) {
      const loadTime = performance.now() - startTime;
      setMetrics(prev => {
        const newLoadTimes = new Map(prev.widgetLoadTimes);
        newLoadTimes.set(widgetId, loadTime);
        return { ...prev, widgetLoadTimes: newLoadTimes };
      });
    }
  }, []);

  // FPS monitoring
  useEffect(() => {
    let animationFrameId: number;
    
    const measureFPS = (timestamp: number) => {
      if (lastFrameTime.current) {
        const delta = timestamp - lastFrameTime.current;
        const fpsDecimal = delta > 0
          ? new Decimal(1000).dividedBy(delta)
          : new Decimal(0);
        const fps = fpsDecimal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
        
        frameCount.current++;
        if (frameCount.current % 60 === 0) { // Update FPS every 60 frames
          setMetrics(prev => ({ ...prev, fps }));
        }
      }
      
      lastFrameTime.current = timestamp;
      animationFrameId = requestAnimationFrame(measureFPS);
    };
    
    animationFrameId = requestAnimationFrame(measureFPS);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  // Memory monitoring (if available)
  useEffect(() => {
    const measureMemory = async () => {
      const nav = performance as Performance & { memory?: { usedJSHeapSize: number } };
      const memoryInfo = nav.memory;
      if (memoryInfo) {
        const memoryUsage = memoryInfo.usedJSHeapSize / 1_048_576;
        setMetrics(prev => ({ ...prev, totalMemoryUsage: memoryUsage }));
      }
    };

    const intervalId = setInterval(measureMemory, 5000); // Check every 5 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  // Log performance warnings
  useEffect(() => {
    if (metrics.renderTime > 100) {
      console.warn(`Dashboard render time is slow: ${formatDecimal(metrics.renderTime)}ms`);
    }
    
    if (metrics.dataFetchTime > 500) {
      console.warn(`Data fetch time is slow: ${formatDecimal(metrics.dataFetchTime)}ms`);
    }
    
    if (metrics.fps && metrics.fps < 30) {
      console.warn(`Low FPS detected: ${metrics.fps}`);
    }
    
    metrics.widgetLoadTimes.forEach((time, widgetId) => {
      if (time > 200) {
        console.warn(`Widget ${widgetId} load time is slow: ${formatDecimal(time)}ms`);
      }
    });
  }, [metrics]);

  return {
    metrics,
    startRenderMeasure,
    endRenderMeasure,
    startDataFetchMeasure,
    endDataFetchMeasure,
    startWidgetLoadMeasure,
    endWidgetLoadMeasure,
    cache: dashboardCache
  };
}

// Custom hook for cached data fetching
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cache = dashboardCache;

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      const cachedData = cache.get<T>(key);
      if (cachedData) {
        if (isMounted) {
          setData(cachedData);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const freshData = await fetcher();
        cache.set(key, freshData, ttl);
        if (isMounted) {
          setData(freshData);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
        }
        console.error(`Error fetching data for key ${key}:`, err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [cache, fetcher, key, ttl]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const freshData = await fetcher();
      cache.set(key, freshData, ttl);
      setData(freshData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [cache, fetcher, key, ttl]);

  return { data, loading, error, refresh };
}

// Performance optimization utilities
export const performanceUtils = {
  // Debounce function for expensive operations
  debounce<T extends (...args: never[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        func(...args);
      }, wait);
    };
  },

  // Throttle function for rate-limiting
  throttle<T extends (...args: never[]) => void>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  },

  // Request idle callback wrapper
  requestIdleCallback(callback: () => void, options?: { timeout?: number }) {
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, options);
    } else {
      // Fallback for browsers that don't support requestIdleCallback
      return setTimeout(callback, 1);
    }
  },

  // Batch updates for multiple state changes
  batchUpdates(updates: Array<() => void>): void {
    // Use React's unstable_batchedUpdates if available
    if (typeof reactDomBatchedUpdates === 'function') {
      reactDomBatchedUpdates(() => {
        updates.forEach(update => update());
      });
    } else {
      // Fallback to sequential updates
      updates.forEach(update => update());
    }
  },

  // Memory cleanup utility
  cleanupMemory(): void {
    dashboardCache.clear();
    
    // Force garbage collection if available (Chrome with --expose-gc flag)
    const gc = (globalThis as { gc?: () => void }).gc;
    if (typeof gc === 'function') {
      gc();
    }
  }
};

// Export cache instance for direct access if needed
export { dashboardCache };
