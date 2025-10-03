import { useEffect, useRef, useCallback, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';

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
    const entry = this.cache.get(key);
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
        const fps = Math.round(1000 / delta);
        
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
      if ('memory' in performance) {
        const memory = (performance as Performance & {
          memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
          }
        }).memory;
        if (!memory) return;
        const memoryUsage = memory.usedJSHeapSize / 1048576; // Convert to MB
        setMetrics(prev => ({ ...prev, totalMemoryUsage: memoryUsage }));
      }
    };

    const intervalId = setInterval(measureMemory, 5000); // Check every 5 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  // Log performance warnings
  useEffect(() => {
    if (metrics.renderTime > 100) {
      console.warn(`Dashboard render time is slow: ${metrics.renderTime.toFixed(2)}ms`);
    }
    
    if (metrics.dataFetchTime > 500) {
      console.warn(`Data fetch time is slow: ${metrics.dataFetchTime.toFixed(2)}ms`);
    }
    
    if (metrics.fps && metrics.fps < 30) {
      console.warn(`Low FPS detected: ${metrics.fps}`);
    }
    
    metrics.widgetLoadTimes.forEach((time, widgetId) => {
      if (time > 200) {
        console.warn(`Widget ${widgetId} load time is slow: ${time.toFixed(2)}ms`);
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
    const fetchData = async () => {
      // Check cache first
      const cachedData = cache.get<T>(key);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        return;
      }

      // Fetch fresh data
      setLoading(true);
      try {
        const freshData = await fetcher();
        cache.set(key, freshData, ttl);
        setData(freshData);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error(`Error fetching data for key ${key}:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [key, ttl]); // Intentionally omitting fetcher to avoid re-fetching

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
  }, [key, fetcher, ttl]);

  return { data, loading, error, refresh };
}

// Performance optimization utilities
export const performanceUtils = {
  // Debounce function for expensive operations
  debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        func(...args);
      }, wait);
    };
  },

  // Throttle function for rate-limiting
  throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    
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
  batchUpdates<T>(updates: Array<() => void>): void {
    // Use React's unstable_batchedUpdates if available
    if ('unstable_batchedUpdates' in require('react-dom')) {
      const { unstable_batchedUpdates } = require('react-dom');
      unstable_batchedUpdates(() => {
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
    if (typeof (global as { gc?: () => void }).gc === 'function') {
      (global as { gc?: () => void }).gc?.();
    }
  }
};

// Export cache instance for direct access if needed
export { dashboardCache };