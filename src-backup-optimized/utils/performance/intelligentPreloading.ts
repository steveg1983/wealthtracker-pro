/**
 * Intelligent Resource Preloading - Phase 7.4
 * Smart preloading based on user behavior and navigation patterns
 */

import { lazyLogger as logger } from '../../services/serviceFactory';

interface NavigatorConnectionInfo {
  effectiveType?: string;
}

type NavigatorWithConnection = Navigator & {
  connection?: NavigatorConnectionInfo;
};

interface NavigationPattern {
  fromRoute: string;
  toRoute: string;
  frequency: number;
  avgTimeOnPage: number;
}

interface UserBehaviorMetrics {
  sessionStartTime: number;
  pagesVisited: string[];
  navigationPatterns: NavigationPattern[];
  preferredFeatures: string[];
  deviceType: 'mobile' | 'tablet' | 'desktop';
  connectionSpeed: 'slow' | 'fast' | 'unknown';
}

/**
 * Intelligent Preloading Service
 * Learns user patterns and preloads accordingly
 */
export class IntelligentPreloadingService {
  private metrics: UserBehaviorMetrics;
  private preloadQueue = new Set<string>();
  private preloadedResources = new Set<string>();

  constructor() {
    this.metrics = this.initializeMetrics();
    this.detectConnectionSpeed();
    this.detectDeviceType();
  }

  /**
   * Initialize user behavior metrics
   */
  private initializeMetrics(): UserBehaviorMetrics {
    const stored = localStorage.getItem('userBehaviorMetrics');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        logger.warn('Failed to parse stored user metrics:', error);
      }
    }

    return {
      sessionStartTime: Date.now(),
      pagesVisited: [],
      navigationPatterns: [],
      preferredFeatures: [],
      deviceType: 'desktop',
      connectionSpeed: 'unknown'
    };
  }

  /**
   * Detect connection speed for adaptive preloading
   */
  private detectConnectionSpeed(): void {
    if (typeof navigator !== 'undefined') {
      const connection = (navigator as NavigatorWithConnection).connection;
      if (connection?.effectiveType) {
        this.metrics.connectionSpeed = ['slow-2g', '2g', '3g'].includes(connection.effectiveType)
          ? 'slow'
          : 'fast';
      }
    }
  }

  /**
   * Detect device type for adaptive preloading
   */
  private detectDeviceType(): void {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      if (width < 768) {
        this.metrics.deviceType = 'mobile';
      } else if (width < 1024) {
        this.metrics.deviceType = 'tablet';
      } else {
        this.metrics.deviceType = 'desktop';
      }
    }
  }

  /**
   * Record navigation for pattern learning
   */
  recordNavigation(fromRoute: string, toRoute: string, timeOnPage: number): void {
    this.metrics.pagesVisited.push(toRoute);

    // Update navigation patterns
    const existingPattern = this.metrics.navigationPatterns.find(
      p => p.fromRoute === fromRoute && p.toRoute === toRoute
    );

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.avgTimeOnPage = (existingPattern.avgTimeOnPage + timeOnPage) / 2;
    } else {
      this.metrics.navigationPatterns.push({
        fromRoute,
        toRoute,
        frequency: 1,
        avgTimeOnPage: timeOnPage
      });
    }

    // Save updated metrics
    this.saveMetrics();

    // Trigger intelligent preloading
    this.smartPreload(toRoute);
  }

  /**
   * Smart preloading based on learned patterns
   */
  private smartPreload(currentRoute: string): void {
    // Don't preload on slow connections
    if (this.metrics.connectionSpeed === 'slow') {
      logger.debug('Skipping preload on slow connection');
      return;
    }

    // Get likely next routes based on patterns
    const likelyNext = this.getPredictedNextRoutes(currentRoute);

    // Preload top 2 most likely routes
    likelyNext.slice(0, 2).forEach(route => {
      this.preloadRoute(route);
    });

    // Preload based on user preferences
    this.preloadPreferredFeatures();
  }

  /**
   * Predict next routes based on user patterns
   */
  private getPredictedNextRoutes(currentRoute: string): string[] {
    const patterns = this.metrics.navigationPatterns
      .filter(p => p.fromRoute === currentRoute)
      .sort((a, b) => b.frequency - a.frequency);

    return patterns.map(p => p.toRoute);
  }

  /**
   * Preload user's preferred features
   */
  private preloadPreferredFeatures(): void {
    // Analyze most visited pages to determine preferences
    const routeFrequency = this.metrics.pagesVisited.reduce((acc, route) => {
      acc[route] = (acc[route] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topRoutes = Object.entries(routeFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([route]) => route);

    topRoutes.forEach(route => {
      if (route.includes('analytics')) {
        this.preloadResource('charts');
        this.preloadResource('data-visualization');
      }
      if (route.includes('investments')) {
        this.preloadResource('portfolio-analysis');
        this.preloadResource('stock-data');
      }
      if (route.includes('planning')) {
        this.preloadResource('financial-calculators');
        this.preloadResource('projections');
      }
    });
  }

  /**
   * Preload a specific route
   */
  private preloadRoute(route: string): void {
    if (this.preloadedResources.has(route)) return;

    // Map routes to their chunk names
    const routeChunkMap: Record<string, string> = {
      '/transactions': 'page-transactions',
      '/accounts': 'page-accounts',
      '/budget': 'page-budget',
      '/analytics': 'page-analytics',
      '/investments': 'page-investments',
      '/goals': 'page-goals',
      '/reports': 'page-reports',
      '/financial-planning': 'page-financial-planning',
      '/data-intelligence': 'page-data-intelligence'
    };

    const chunkName = routeChunkMap[route];
    if (chunkName) {
      this.preloadChunk(chunkName);
    }
  }

  /**
   * Preload a specific resource/chunk
   */
  private preloadResource(resourceType: string): void {
    if (this.preloadedResources.has(resourceType)) return;

    const resourceChunkMap: Record<string, string> = {
      'charts': 'recharts',
      'data-visualization': 'd3',
      'portfolio-analysis': 'page-investments',
      'stock-data': 'financial-apis',
      'financial-calculators': 'decimal',
      'projections': 'page-financial-planning'
    };

    const chunkName = resourceChunkMap[resourceType];
    if (chunkName) {
      this.preloadChunk(chunkName);
    }
  }

  /**
   * Preload a chunk using link prefetch
   */
  private preloadChunk(chunkName: string): void {
    if (typeof document === 'undefined') return;
    if (this.preloadedResources.has(chunkName)) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `/assets/${chunkName}.js`;

    link.onload = () => {
      this.preloadedResources.add(chunkName);
      logger.debug('Chunk prefetched:', chunkName);
    };

    link.onerror = () => {
      logger.warn('Failed to prefetch chunk:', chunkName);
    };

    document.head.appendChild(link);
  }

  /**
   * Save metrics to localStorage
   */
  private saveMetrics(): void {
    try {
      localStorage.setItem('userBehaviorMetrics', JSON.stringify(this.metrics));
    } catch (error) {
      logger.warn('Failed to save user metrics:', error);
    }
  }

  /**
   * Get preloading statistics
   */
  getPreloadingStats(): {
    preloadedCount: number;
    queuedCount: number;
    navigationPatterns: number;
    connectionSpeed: string;
    deviceType: string;
  } {
    return {
      preloadedCount: this.preloadedResources.size,
      queuedCount: this.preloadQueue.size,
      navigationPatterns: this.metrics.navigationPatterns.length,
      connectionSpeed: this.metrics.connectionSpeed,
      deviceType: this.metrics.deviceType
    };
  }

  /**
   * Force preload critical resources
   */
  preloadCriticalResources(): void {
    // Always preload core financial features
    this.preloadRoute('/transactions');
    this.preloadRoute('/accounts');

    // Preload based on device type
    if (this.metrics.deviceType === 'desktop') {
      this.preloadRoute('/analytics');
      this.preloadResource('charts');
    }
  }

  /**
   * Clear preloading cache
   */
  clearCache(): void {
    this.preloadedResources.clear();
    this.preloadQueue.clear();
    localStorage.removeItem('userBehaviorMetrics');
    this.metrics = this.initializeMetrics();
  }
}

// Export singleton instance
export const intelligentPreloading = new IntelligentPreloadingService();

/**
 * React hook for intelligent preloading
 */
export function useIntelligentPreloading(_currentRoute: string) {
  const recordNavigation = (fromRoute: string, toRoute: string, timeOnPage: number) => {
    intelligentPreloading.recordNavigation(fromRoute, toRoute, timeOnPage);
  };

  const getStats = () => intelligentPreloading.getPreloadingStats();

  const preloadCritical = () => intelligentPreloading.preloadCriticalResources();

  return {
    recordNavigation,
    getStats,
    preloadCritical
  };
}
