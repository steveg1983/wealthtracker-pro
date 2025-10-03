/**
 * @module predictiveLoadingService
 * @description Enterprise-grade predictive loading service providing intelligent
 * preloading, route prediction, and resource optimization for superior performance.
 * 
 * @features
 * - Route prediction based on navigation patterns
 * - Hover-based preloading
 * - Viewport-based prefetching
 * - Image optimization
 * - Cache management
 * - Performance metrics
 * 
 * @performance
 * - LRU cache for predictions
 * - Debounced preloading
 * - Priority-based loading
 */

import { lazyLogger as logger } from '../serviceFactory';

/**
 * Preload types
 */
export type PreloadType = 'page' | 'data' | 'image' | 'component';

/**
 * Preload priority levels
 */
export const PreloadPriority = {
  Critical: 1,
  High: 2,
  Normal: 3,
  Low: 4,
  Idle: 5,
} as const;
export type PreloadPriority = typeof PreloadPriority[keyof typeof PreloadPriority];

/**
 * Preload configuration
 */
export interface PreloadConfig {
  type: PreloadType;
  target: string;
  loader?: () => Promise<unknown>;
  priority?: PreloadPriority;
  ttl?: number;
  metadata?: Record<string, any>;
}

/**
 * Navigation context
 */
export interface NavigationContext {
  currentPath: string;
  previousPath?: string;
  userId?: string;
  timestamp: number;
  viewport?: {
    width: number;
    height: number;
  };
  connection?: {
    effectiveType: string;
    downlink: number;
  };
}

/**
 * Prediction result
 */
export interface PredictionResult {
  route: string;
  confidence: number;
  priority: PreloadPriority;
}

/**
 * Preload metrics
 */
export interface PreloadMetrics {
  totalPrefetches: number;
  successfulPrefetches: number;
  failedPrefetches: number;
  averageLoadTime: number;
  bandwidthSaved: number;
  cacheHitRate: number;
}

/**
 * Route patterns for prediction
 */
interface RoutePattern {
  from: string;
  to: string[];
  confidence: number;
}

/**
 * Cached resource
 */
interface CachedResource {
  data: any;
  timestamp: number;
  ttl: number;
  size: number;
  hits: number;
}

/**
 * Predictive loading service
 */
class PredictiveLoadingService {
  private static instance: PredictiveLoadingService;
  private cache: Map<string, CachedResource> = new Map();
  private navigationHistory: Array<{ from: string; to: string; timestamp: number }> = [];
  private routePatterns: Map<string, RoutePattern> = new Map();
  private preloadQueue: Map<string, PreloadConfig> = new Map();
  private activePreloads: Set<string> = new Set();
  private intersectionObserver: IntersectionObserver | null = null;
  private metrics: PreloadMetrics = {
    totalPrefetches: 0,
    successfulPrefetches: 0,
    failedPrefetches: 0,
    averageLoadTime: 0,
    bandwidthSaved: 0,
    cacheHitRate: 0
  };
  private loadTimes: number[] = [];
  private maxCacheSize: number = 50 * 1024 * 1024; // 50MB
  private currentCacheSize: number = 0;

  private constructor() {
    this.initializePatterns();
    this.setupIntersectionObserver();
    this.startCacheCleanup();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PredictiveLoadingService {
    if (!PredictiveLoadingService.instance) {
      PredictiveLoadingService.instance = new PredictiveLoadingService();
    }
    return PredictiveLoadingService.instance;
  }

  /**
   * Initialize common route patterns
   */
  private initializePatterns(): void {
    this.routePatterns.set('/dashboard', {
      from: '/dashboard',
      to: ['/transactions', '/accounts', '/analytics'],
      confidence: 0.8
    });

    this.routePatterns.set('/transactions', {
      from: '/transactions',
      to: ['/transactions/new', '/categories', '/dashboard'],
      confidence: 0.75
    });

    this.routePatterns.set('/accounts', {
      from: '/accounts',
      to: ['/accounts/new', '/transactions', '/dashboard'],
      confidence: 0.7
    });

    this.routePatterns.set('/analytics', {
      from: '/analytics',
      to: ['/reports', '/dashboard', '/transactions'],
      confidence: 0.75
    });

    this.routePatterns.set('/investments', {
      from: '/investments',
      to: ['/portfolio', '/analytics', '/dashboard'],
      confidence: 0.8
    });
  }

  /**
   * Setup intersection observer for viewport-based prefetching
   */
  private setupIntersectionObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const prefetchUrl = element.dataset.prefetch;
            if (prefetchUrl) {
              this.preload({
                type: 'page',
                target: prefetchUrl,
                priority: PreloadPriority.Low
              });
            }
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );
  }

  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Every minute
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let entriesRemoved = 0;

    for (const [key, resource] of this.cache.entries()) {
      if (now - resource.timestamp > resource.ttl) {
        this.currentCacheSize -= resource.size;
        this.cache.delete(key);
        entriesRemoved++;
      }
    }

    // LRU eviction if cache is too large
    if (this.currentCacheSize > this.maxCacheSize) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      while (this.currentCacheSize > this.maxCacheSize * 0.8 && sortedEntries.length > 0) {
        const [key, resource] = sortedEntries.shift()!;
        this.currentCacheSize -= resource.size;
        this.cache.delete(key);
        entriesRemoved++;
      }
    }

    if (entriesRemoved > 0) {
      logger.debug(`Cache cleanup: removed ${entriesRemoved} entries`);
    }
  }

  /**
   * Get current navigation context
   */
  getCurrentContext(): NavigationContext {
    const context: NavigationContext = {
      currentPath: window.location.pathname,
      timestamp: Date.now()
    };

    // Add viewport info
    if (typeof window !== 'undefined') {
      context.viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      // Add connection info if available
      const nav = navigator as any;
      if (nav.connection) {
        context.connection = {
          effectiveType: nav.connection.effectiveType,
          downlink: nav.connection.downlink
        };
      }
    }

    return context;
  }

  /**
   * Record navigation pattern
   */
  recordNavigation(from: string, to: string): void {
    this.navigationHistory.push({
      from,
      to,
      timestamp: Date.now()
    });

    // Keep only last 100 navigations
    if (this.navigationHistory.length > 100) {
      this.navigationHistory.shift();
    }

    // Update route patterns based on actual usage
    this.updatePatterns(from, to);
  }

  /**
   * Update route patterns based on navigation
   */
  private updatePatterns(from: string, to: string): void {
    const pattern = this.routePatterns.get(from);
    if (pattern && !pattern.to.includes(to)) {
      pattern.to.push(to);
      // Slightly decrease confidence as pattern diverges
      pattern.confidence = Math.max(0.5, pattern.confidence - 0.05);
    }
  }

  /**
   * Execute predictions based on context
   */
  async executePredictions(context: NavigationContext): Promise<void> {
    const predictions = this.predictNextRoutes(context);
    
    // Preload top predictions
    for (const prediction of predictions.slice(0, 3)) {
      await this.preloadRoute(prediction.route, prediction.priority);
    }
  }

  /**
   * Predict next likely routes
   */
  private predictNextRoutes(context: NavigationContext): PredictionResult[] {
    const predictions: PredictionResult[] = [];
    const pattern = this.routePatterns.get(context.currentPath);

    if (pattern) {
      pattern.to.forEach((route, index) => {
        predictions.push({
          route,
          confidence: pattern.confidence * (1 - index * 0.1),
          priority: index < 2 ? PreloadPriority.High : PreloadPriority.Normal
        });
      });
    }

    // Add predictions based on recent history
    const recentNavigations = this.navigationHistory
      .filter(nav => nav.from === context.currentPath)
      .slice(-10);

    const routeCounts = new Map<string, number>();
    recentNavigations.forEach(nav => {
      routeCounts.set(nav.to, (routeCounts.get(nav.to) || 0) + 1);
    });

    routeCounts.forEach((count, route) => {
      const confidence = count / recentNavigations.length;
      if (confidence > 0.3 && !predictions.find(p => p.route === route)) {
        predictions.push({
          route,
          confidence,
          priority: PreloadPriority.Normal
        });
      }
    });

    // Sort by confidence
    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Preload a specific route
   */
  private async preloadRoute(route: string, priority: PreloadPriority): Promise<void> {
    const routeName = route.split('/')[1];
    
    const loader = async () => {
      switch (routeName) {
        case 'transactions':
          return import('../../pages/Transactions');
        case 'accounts':
          return import('../../pages/Accounts');
        case 'analytics':
          return import('../../pages/Analytics');
        case 'investments':
          return import('../../pages/Investments');
        case 'reports':
          return import('../../components/ScheduledReports');
        case 'portfolio':
          return import('../../components/EnhancedPortfolioView');
        default:
          return null;
      }
    };

    await this.preload({
      type: 'page',
      target: route,
      loader,
      priority
    });
  }

  /**
   * Preload resource
   */
  async preload(config: PreloadConfig): Promise<void> {
    const cacheKey = `${config.type}:${config.target}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      cached.hits++;
      this.metrics.cacheHitRate = this.calculateCacheHitRate();
      logger.debug(`Cache hit for ${cacheKey}`);
      return;
    }

    // Check if already preloading
    if (this.activePreloads.has(cacheKey)) {
      logger.debug(`Already preloading ${cacheKey}`);
      return;
    }

    // Add to queue based on priority
    this.preloadQueue.set(cacheKey, config);
    await this.processQueue();
  }

  /**
   * Process preload queue
   */
  private async processQueue(): Promise<void> {
    // Sort queue by priority
    const sortedQueue = Array.from(this.preloadQueue.entries())
      .sort((a, b) => (a[1].priority || 3) - (b[1].priority || 3));

    for (const [key, config] of sortedQueue) {
      if (this.activePreloads.size >= 3) break; // Max 3 concurrent preloads

      this.preloadQueue.delete(key);
      this.activePreloads.add(key);

      const startTime = performance.now();
      this.metrics.totalPrefetches++;

      try {
        let data: any = null;
        
        if (config.loader) {
          data = await config.loader();
        }

        const loadTime = performance.now() - startTime;
        this.loadTimes.push(loadTime);
        this.metrics.averageLoadTime = this.calculateAverageLoadTime();
        
        // Estimate size (rough approximation)
        const size = JSON.stringify(data).length;
        
        // Cache the result
        this.cache.set(key, {
          data,
          timestamp: Date.now(),
          ttl: config.ttl || 5 * 60 * 1000, // 5 minutes default
          size,
          hits: 0
        });
        
        this.currentCacheSize += size;
        this.metrics.successfulPrefetches++;
        
        logger.debug(`Preloaded ${key} in ${loadTime.toFixed(2)}ms`);
      } catch (error) {
        this.metrics.failedPrefetches++;
        logger.error(`Failed to preload ${key}:`, error);
      } finally {
        this.activePreloads.delete(key);
      }
    }
  }

  /**
   * Calculate average load time
   */
  private calculateAverageLoadTime(): number {
    if (this.loadTimes.length === 0) return 0;
    const sum = this.loadTimes.reduce((a, b) => a + b, 0);
    return sum / this.loadTimes.length;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    let totalHits = 0;
    let totalRequests = 0;
    
    this.cache.forEach(resource => {
      totalHits += resource.hits;
      totalRequests += resource.hits + 1; // +1 for initial load
    });
    
    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  /**
   * Preload on hover
   */
  preloadOnHover(element: HTMLElement, target: string, type: PreloadType = 'page'): () => void {
    let hoverTimeout: NodeJS.Timeout | null = null;

    const handleMouseEnter = () => {
      hoverTimeout = setTimeout(() => {
        this.preload({
          type,
          target,
          priority: PreloadPriority.High
        });
      }, 100);
    };

    const handleMouseLeave = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }

  /**
   * Observe element for viewport-based prefetching
   */
  observeForPrefetch(element: HTMLElement): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(element);
    }
  }

  /**
   * Unobserve element
   */
  unobserveForPrefetch(element: HTMLElement): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element);
    }
  }

  /**
   * Refresh stale data
   */
  async refreshStaleData(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 2 * 60 * 1000; // 2 minutes

    for (const [key, resource] of this.cache.entries()) {
      if (now - resource.timestamp > staleThreshold) {
        const [type, target] = key.split(':');
        await this.preload({
          type: type as PreloadType,
          target,
          priority: PreloadPriority.Idle
        });
      }
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): PreloadMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
    logger.info('Predictive loading cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { size: number; maxSize: number; entries: number } {
    return {
      size: this.currentCacheSize,
      maxSize: this.maxCacheSize,
      entries: this.cache.size
    };
  }
}

// Export singleton instance
export const predictiveLoader = PredictiveLoadingService.getInstance();
