/**
 * Bundle Optimizer - Phase 7
 * Advanced code splitting and bundle optimization for Apple/Google/Microsoft performance standards
 */

import { lazyLogger as logger } from '../../services/serviceFactory';

interface PerformanceMemoryLike {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
}

type PerformanceWithMemory = Performance & {
  memory?: PerformanceMemoryLike;
};

const getPerformanceMemory = (): PerformanceMemoryLike | null => {
  if (typeof performance === 'undefined') {
    return null;
  }

  const performanceWithMemory = performance as PerformanceWithMemory;
  return performanceWithMemory.memory ?? null;
};

// Bundle size targets (CLAUDE.md: <200KB gzipped)
export const PERFORMANCE_TARGETS = {
  MAX_BUNDLE_SIZE_GZIPPED: 200 * 1024, // 200KB
  MAX_CHUNK_SIZE_GZIPPED: 50 * 1024,   // 50KB per chunk
  MAX_INITIAL_LOAD: 100 * 1024,        // 100KB initial load
  TARGET_FIRST_PAINT: 1500,            // 1.5s
  TARGET_FIRST_CONTENTFUL_PAINT: 2000, // 2s
  TARGET_LARGEST_CONTENTFUL_PAINT: 2500 // 2.5s
} as const;

// Heavy dependencies that should be code split
export const HEAVY_DEPENDENCIES = {
  XLSX: () => import(/* webpackChunkName: "xlsx" */ 'xlsx'),
  CHART_JS: () => import(/* webpackChunkName: "charts" */ 'chart.js'),
  HTML2CANVAS: () => import(/* webpackChunkName: "html2canvas" */ 'html2canvas'),
  PLOTLY: () => import(/* webpackChunkName: "plotly" */ 'react-plotly.js'),
  AG_GRID: () => import(/* webpackChunkName: "ag-grid" */ 'ag-grid-react'),
  CRYPTO_JS: () => import(/* webpackChunkName: "crypto" */ 'crypto-js'),
  DATE_FNS: () => import(/* webpackChunkName: "date-fns" */ 'date-fns'),
  DECIMAL_JS: () => import(/* webpackChunkName: "decimal" */ 'decimal.js')
} as const;

// Route-based code splitting configuration
export const ROUTE_CHUNKS = {
  // Core routes (loaded immediately)
  CORE: ['/', '/dashboard', '/login'],

  // Financial routes (preloaded)
  FINANCIAL: ['/transactions', '/accounts', '/budget'],

  // Analytics routes (lazy loaded)
  ANALYTICS: ['/analytics', '/reports', '/data-intelligence'],

  // Advanced routes (lazy loaded)
  ADVANCED: ['/investments', '/financial-planning', '/goals'],

  // Settings routes (lazy loaded on demand)
  SETTINGS: ['/settings/*', '/preferences/*'],

  // Admin routes (lazy loaded on demand)
  ADMIN: ['/admin/*', '/debug/*']
} as const;

/**
 * Dynamic import wrapper with performance monitoring
 */
export function createOptimizedImport<T>(
  importFn: () => Promise<T>,
  chunkName: string,
  priority: 'high' | 'medium' | 'low' = 'medium'
): () => Promise<T> {
  return async (): Promise<T> => {
    const startTime = performance.now();

    try {
      // Preload hint for high priority chunks
      if (priority === 'high' && typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = `/${chunkName}.js`;
        document.head.appendChild(link);
      }

      const module = await importFn();
      const loadTime = performance.now() - startTime;

      // Log slow loading chunks
      if (loadTime > 1000) {
        logger.warn('Slow chunk loading detected:', {
          chunkName,
          loadTime,
          priority
        });
      }

      return module;
    } catch (error) {
      logger.error('Failed to load chunk:', {
        chunkName,
        error,
        loadTime: performance.now() - startTime
      });
      throw error;
    }
  };
}

/**
 * Bundle size monitoring
 */
export class BundleSizeMonitor {
  private chunks = new Map<string, number>();

  /**
   * Register a chunk size for monitoring
   */
  registerChunk(chunkName: string, size: number): void {
    this.chunks.set(chunkName, size);

    // Warn if chunk exceeds target
    if (size > PERFORMANCE_TARGETS.MAX_CHUNK_SIZE_GZIPPED) {
      logger.warn('Large chunk detected:', {
        chunkName,
        size,
        target: PERFORMANCE_TARGETS.MAX_CHUNK_SIZE_GZIPPED,
        overage: size - PERFORMANCE_TARGETS.MAX_CHUNK_SIZE_GZIPPED
      });
    }
  }

  /**
   * Get bundle size report
   */
  getBundleReport(): {
    totalSize: number;
    chunkCount: number;
    largestChunk: { name: string; size: number } | null;
    oversizedChunks: Array<{ name: string; size: number }>;
  } {
    const chunks = Array.from(this.chunks.entries());
    const totalSize = chunks.reduce((sum, [, size]) => sum + size, 0);

    const largestChunk = chunks.reduce(
      (largest, [name, size]) => size > largest.size ? { name, size } : largest,
      { name: '', size: 0 }
    );

    const oversizedChunks = chunks
      .filter(([, size]) => size > PERFORMANCE_TARGETS.MAX_CHUNK_SIZE_GZIPPED)
      .map(([name, size]) => ({ name, size }));

    return {
      totalSize,
      chunkCount: chunks.length,
      largestChunk: largestChunk.size > 0 ? largestChunk : null,
      oversizedChunks
    };
  }
}

/**
 * Intelligent preloading strategy
 */
export class PreloadingStrategy {
  private preloadedChunks = new Set<string>();

  /**
   * Preload chunks based on user navigation patterns
   */
  preloadForRoute(currentRoute: string): void {
    const preloadCandidates = this.getPreloadCandidates(currentRoute);

    preloadCandidates.forEach(chunkName => {
      if (!this.preloadedChunks.has(chunkName)) {
        this.preloadChunk(chunkName);
      }
    });
  }

  /**
   * Get chunks that should be preloaded for a route
   */
  private getPreloadCandidates(route: string): string[] {
    // Dashboard route - preload financial pages
    if (route === '/' || route === '/dashboard') {
      return ['transactions', 'accounts', 'budget'];
    }

    // Financial routes - preload analytics
    if (ROUTE_CHUNKS.FINANCIAL.some(r => route.startsWith(r))) {
      return ['analytics', 'reports'];
    }

    // Analytics routes - preload advanced features
    if (ROUTE_CHUNKS.ANALYTICS.some(r => route.startsWith(r))) {
      return ['investments', 'financial-planning'];
    }

    return [];
  }

  /**
   * Preload a specific chunk
   */
  private preloadChunk(chunkName: string): void {
    if (typeof document === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `/${chunkName}.js`;
    link.onload = () => {
      this.preloadedChunks.add(chunkName);
      logger.debug('Chunk preloaded:', chunkName);
    };
    link.onerror = () => {
      logger.warn('Failed to preload chunk:', chunkName);
    };

    document.head.appendChild(link);
  }
}

/**
 * Memory optimization for large data sets
 */
export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private observers = new Map<string, PerformanceObserver>();

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  /**
   * Monitor memory usage for a component
   */
  monitorComponent(componentName: string): void {
    if (typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name.includes(componentName)) {
          logger.debug('Component performance:', {
            component: componentName,
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });
    this.observers.set(componentName, observer);
  }

  /**
   * Stop monitoring a component
   */
  stopMonitoring(componentName: string): void {
    const observer = this.observers.get(componentName);
    if (observer) {
      observer.disconnect();
      this.observers.delete(componentName);
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo(): {
    used: number;
    total: number;
    percentage: number;
  } | null {
    const memory = getPerformanceMemory();
    if (!memory) {
      return null;
    }
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    };
  }
}

// Export singleton instances
export const bundleSizeMonitor = new BundleSizeMonitor();
export const preloadingStrategy = new PreloadingStrategy();
export const memoryOptimizer = MemoryOptimizer.getInstance();
