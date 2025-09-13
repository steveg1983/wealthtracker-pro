/**
 * @module dashboardPerformanceService
 * @description Enterprise-grade dashboard performance monitoring and optimization service
 * providing metrics collection, caching, and performance utilities.
 * 
 * @features
 * - Performance metrics collection
 * - Intelligent caching system
 * - FPS monitoring
 * - Memory tracking
 * - Performance warnings
 * - Utility functions
 * 
 * @performance
 * - LRU cache with TTL
 * - Batch updates
 * - Debounced operations
 */

import { logger } from '../loggingService';

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  renderTime: number;
  dataFetchTime: number;
  widgetLoadTimes: Map<string, number>;
  totalMemoryUsage?: number;
  fps?: number;
  cacheHitRate?: number;
  apiCallCount?: number;
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
}

/**
 * Performance thresholds
 */
interface PerformanceThresholds {
  renderTime: number;
  dataFetchTime: number;
  widgetLoadTime: number;
  minFPS: number;
  maxMemoryMB: number;
}

/**
 * Dashboard performance service
 */
class DashboardPerformanceService {
  private static instance: DashboardPerformanceService;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    dataFetchTime: 0,
    widgetLoadTimes: new Map(),
    totalMemoryUsage: 0,
    fps: 60,
    cacheHitRate: 0,
    apiCallCount: 0
  };
  private thresholds: PerformanceThresholds = {
    renderTime: 100,
    dataFetchTime: 500,
    widgetLoadTime: 200,
    minFPS: 30,
    maxMemoryMB: 100
  };
  private performanceObserver: PerformanceObserver | null = null;
  private renderStartTime: number = 0;
  private dataFetchStartTime: number = 0;
  private widgetLoadStartTimes: Map<string, number> = new Map();
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private animationFrameId: number | null = null;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 10 * 1024 * 1024; // 10MB
  private currentCacheSize: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  private constructor() {
    this.initializePerformanceObserver();
    this.startFPSMonitoring();
    this.startMemoryMonitoring();
    this.startCacheCleanup();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DashboardPerformanceService {
    if (!DashboardPerformanceService.instance) {
      DashboardPerformanceService.instance = new DashboardPerformanceService();
    }
    return DashboardPerformanceService.instance;
  }

  /**
   * Initialize performance observer
   */
  private initializePerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      this.performanceObserver = new PerformanceObserver((entries) => {
        entries.getEntries().forEach((entry) => {
          if (entry.entryType === 'measure') {
            this.processMeasure(entry as PerformanceMeasure);
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      logger.warn('PerformanceObserver not available', error);
    }
  }

  /**
   * Process performance measure
   */
  private processMeasure(measure: PerformanceMeasure): void {
    if (measure.name.startsWith('widget-')) {
      const widgetId = measure.name.replace('widget-', '');
      this.metrics.widgetLoadTimes.set(widgetId, measure.duration);
      
      if (measure.duration > this.thresholds.widgetLoadTime) {
        logger.warn(`Widget ${widgetId} load time is slow: ${measure.duration.toFixed(2)}ms`);
      }
    }
  }

  /**
   * Start FPS monitoring
   */
  private startFPSMonitoring(): void {
    if (typeof window === 'undefined') return;

    const measureFPS = (timestamp: number) => {
      if (this.lastFrameTime) {
        const delta = timestamp - this.lastFrameTime;
        const fps = Math.round(1000 / delta);
        
        this.frameCount++;
        if (this.frameCount % 60 === 0) { // Update FPS every 60 frames
          this.metrics.fps = fps;
          
          if (fps < this.thresholds.minFPS) {
            logger.warn(`Low FPS detected: ${fps}`);
          }
        }
      }
      
      this.lastFrameTime = timestamp;
      this.animationFrameId = requestAnimationFrame(measureFPS);
    };
    
    this.animationFrameId = requestAnimationFrame(measureFPS);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (typeof window === 'undefined') return;

    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        if (memory) {
          const memoryUsageMB = memory.usedJSHeapSize / 1048576;
          this.metrics.totalMemoryUsage = memoryUsageMB;
          
          if (memoryUsageMB > this.thresholds.maxMemoryMB) {
            logger.warn(`High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
          }
        }
      }
    };

    this.memoryCheckInterval = setInterval(measureMemory, 5000);
    measureMemory(); // Initial measurement
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Every minute
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let entriesRemoved = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.currentCacheSize -= entry.size;
        this.cache.delete(key);
        entriesRemoved++;
      }
    }

    // LRU eviction if cache is too large
    if (this.currentCacheSize > this.MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].hits - b[1].hits);

      while (this.currentCacheSize > this.MAX_CACHE_SIZE * 0.8 && sortedEntries.length > 0) {
        const [key, entry] = sortedEntries.shift()!;
        this.currentCacheSize -= entry.size;
        this.cache.delete(key);
        entriesRemoved++;
      }
    }

    if (entriesRemoved > 0) {
      logger.debug(`Cache cleanup: removed ${entriesRemoved} entries`);
    }

    this.updateCacheHitRate();
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(): void {
    const total = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.cacheHits / total : 0;
  }

  /**
   * Start render measurement
   */
  startRenderMeasure(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * End render measurement
   */
  endRenderMeasure(): void {
    const renderTime = performance.now() - this.renderStartTime;
    this.metrics.renderTime = renderTime;
    
    if (renderTime > this.thresholds.renderTime) {
      logger.warn(`Dashboard render time is slow: ${renderTime.toFixed(2)}ms`);
    }
  }

  /**
   * Start data fetch measurement
   */
  startDataFetchMeasure(): void {
    this.dataFetchStartTime = performance.now();
    if (this.metrics.apiCallCount !== undefined) {
      this.metrics.apiCallCount++;
    }
  }

  /**
   * End data fetch measurement
   */
  endDataFetchMeasure(): void {
    const dataFetchTime = performance.now() - this.dataFetchStartTime;
    this.metrics.dataFetchTime = dataFetchTime;
    
    if (dataFetchTime > this.thresholds.dataFetchTime) {
      logger.warn(`Data fetch time is slow: ${dataFetchTime.toFixed(2)}ms`);
    }
  }

  /**
   * Start widget load measurement
   */
  startWidgetLoadMeasure(widgetId: string): void {
    this.widgetLoadStartTimes.set(widgetId, performance.now());
    
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`widget-${widgetId}-start`);
    }
  }

  /**
   * End widget load measurement
   */
  endWidgetLoadMeasure(widgetId: string): void {
    const startTime = this.widgetLoadStartTimes.get(widgetId);
    if (!startTime) return;

    const loadTime = performance.now() - startTime;
    this.metrics.widgetLoadTimes.set(widgetId, loadTime);
    
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`widget-${widgetId}-end`);
      performance.measure(
        `widget-${widgetId}`,
        `widget-${widgetId}-start`,
        `widget-${widgetId}-end`
      );
    }
    
    if (loadTime > this.thresholds.widgetLoadTime) {
      logger.warn(`Widget ${widgetId} load time is slow: ${loadTime.toFixed(2)}ms`);
    }
  }

  /**
   * Get from cache
   */
  getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.cacheMisses++;
      this.updateCacheHitRate();
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.currentCacheSize -= entry.size;
      this.cache.delete(key);
      this.cacheMisses++;
      this.updateCacheHitRate();
      return null;
    }

    entry.hits++;
    this.cacheHits++;
    this.updateCacheHitRate();
    return entry.data;
  }

  /**
   * Set in cache
   */
  setInCache<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const size = JSON.stringify(data).length;
    
    // Remove old entry if exists
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.currentCacheSize -= oldEntry.size;
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size
    });
    
    this.currentCacheSize += size;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.info('Dashboard cache cleared');
  }

  /**
   * Get metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get cache status
   */
  getCacheStatus(): {
    size: number;
    maxSize: number;
    entries: number;
    hitRate: number;
  } {
    return {
      size: this.currentCacheSize,
      maxSize: this.MAX_CACHE_SIZE,
      entries: this.cache.size,
      hitRate: this.metrics.cacheHitRate || 0
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): void {
    if (typeof (global as any).gc === 'function') {
      (global as any).gc();
      logger.info('Forced garbage collection');
    }
  }
}

// Export singleton instance
export const dashboardPerformanceService = DashboardPerformanceService.getInstance();