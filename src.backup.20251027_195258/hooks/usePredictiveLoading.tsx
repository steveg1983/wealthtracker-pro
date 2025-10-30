import { useEffect, useCallback, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import predictiveLoader from '../services/predictiveLoadingService';
import { logger } from '../services/loggingService';
import type { NavigationContext } from '../services/predictiveLoadingService';

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

interface IdleCallbackWindow extends Window {
  requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback: (handle: number) => void;
}

const hasIdleCallback = (target: Window): target is IdleCallbackWindow =>
  'requestIdleCallback' in target && 'cancelIdleCallback' in target;

const PRELOAD_REFRESH_DELAY = 5000;

/**
 * Hook for predictive loading based on navigation context
 */
export function usePredictiveLoading() {
  const location = useLocation();
  const previousPath = useRef<string>();
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);

  useEffect(() => {
    const context = predictiveLoader.getCurrentContext();
    const contextWithHistory: NavigationContext = previousPath.current
      ? { ...context, previousPath: previousPath.current }
      : context;

    let isMounted = true;

    const runPredictions = async () => {
      setIsPreloading(true);
      setPreloadProgress(0);
      try {
        await predictiveLoader.executePredictions(contextWithHistory);
      } catch (error) {
        logger.warn('Predictive loading failed', error);
      } finally {
        if (isMounted) {
          setIsPreloading(false);
          setPreloadProgress(1);
        }
      }
    };

    void runPredictions();

    if (previousPath.current && previousPath.current !== location.pathname) {
      predictiveLoader.recordNavigation(previousPath.current, location.pathname);
    }

    previousPath.current = location.pathname;

    const refreshTimer: TimeoutHandle = globalThis.setTimeout(() => {
      void predictiveLoader.refreshStaleData();
    }, PRELOAD_REFRESH_DELAY);

    return () => {
      isMounted = false;
      globalThis.clearTimeout(refreshTimer);
    };
  }, [location]);

  return {
    isPreloading,
    preloadProgress
  };
}

/**
 * Hook for preloading on hover
 */
export function useHoverPreload(
  target: string,
  type: 'page' | 'data' = 'page'
) {
  const elementRef = useRef<HTMLElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (elementRef.current) {
      cleanupRef.current = predictiveLoader.preloadOnHover(
        elementRef.current,
        target,
        type
      );
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [target, type]);

  return elementRef;
}

/**
 * Hook for viewport-based prefetching
 */
export function useViewportPrefetch(
  targets: Array<{ element: HTMLElement | null; url: string }>
) {
  useEffect(() => {
    targets.forEach(({ element, url }) => {
      if (element) {
        element.dataset.prefetch = url;
        predictiveLoader.observeForPrefetch(element);
      }
    });

    return () => {
      targets.forEach(({ element }) => {
        if (element) {
          predictiveLoader.unobserveForPrefetch(element);
          delete element.dataset.prefetch;
        }
      });
    };
  }, [targets]);
}

/**
 * Hook for smart data prefetching based on user patterns
 */
export function useSmartPrefetch<TData>(
  dataType: string,
  fetcher: () => Promise<TData>,
  options: {
    prefetchOn?: 'mount' | 'hover' | 'viewport' | 'idle';
    priority?: number;
    ttl?: number;
  } = {}
) {
  const {
    prefetchOn = 'mount',
    priority = 2,
    ttl = 5 * 60 * 1000
  } = options;

  const [isPrefetching, setIsPrefetching] = useState(false);
  const [prefetchComplete, setPrefetchComplete] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  const triggerPrefetch = useCallback(async () => {
    setIsPrefetching(true);
    try {
      await predictiveLoader.requestPreload({
        type: 'data',
        target: dataType,
        loader: fetcher,
        priority,
        ttl,
      });
      setPrefetchComplete(true);
    } catch (error) {
      logger.warn(`Smart prefetch failed for ${dataType}`, error);
    } finally {
      setIsPrefetching(false);
    }
  }, [dataType, fetcher, priority, ttl]);

  useEffect(() => {
    if (prefetchOn === 'mount') {
      void triggerPrefetch();
      return undefined;
    }

    if (prefetchOn === 'idle') {
      if (hasIdleCallback(window)) {
        const idleHandle = window.requestIdleCallback(() => {
          void triggerPrefetch();
        });

        return () => {
          window.cancelIdleCallback(idleHandle);
        };
      }

      const fallbackTimeout: TimeoutHandle = globalThis.setTimeout(() => {
        void triggerPrefetch();
      }, 0);

      return () => {
        globalThis.clearTimeout(fallbackTimeout);
      };
    }
    return undefined;
  }, [prefetchOn, triggerPrefetch]);

  // Handle hover prefetch
  useEffect(() => {
    if (prefetchOn === 'hover' && elementRef.current) {
      const cleanup = predictiveLoader.preloadOnHover(
        elementRef.current,
        dataType,
        'data'
      );
      return cleanup;
    }
    return undefined;
  }, [prefetchOn, dataType]);

  // Handle viewport prefetch
  useEffect(() => {
    if (prefetchOn === 'viewport' && elementRef.current) {
      const element = elementRef.current;
      predictiveLoader.observeForPrefetch(element);
      return () => {
        predictiveLoader.unobserveForPrefetch(element);
      };
    }
    return undefined;
  }, [prefetchOn]);

  return {
    ref: elementRef,
    isPrefetching,
    prefetchComplete
  };
}

/**
 * Hook for predictive image loading
 */
export function usePredictiveImages(
  images: string[],
  options: {
    priority?: 'high' | 'low' | 'auto';
    lazy?: boolean;
  } = {}
) {
  const { priority = 'auto', lazy = true } = options;
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!lazy || priority === 'high') {
      images.forEach(src => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          setLoadedImages(prev => new Set(prev).add(src));
        };
      });
    }
  }, [images, lazy, priority]);

  const preloadImage = useCallback((src: string) => {
    if (!loadedImages.has(src)) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setLoadedImages(prev => new Set(prev).add(src));
      };
    }
  }, [loadedImages]);

  return {
    loadedImages,
    preloadImage,
    isLoaded: (src: string) => loadedImages.has(src)
  };
}

/**
 * Hook for route prefetching based on likely navigation
 */
export function useRoutePrefetch() {
  const location = useLocation();
  const [prefetchedRoutes, setPrefetchedRoutes] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Define likely next routes based on current location
    const likelyRoutes: Record<string, string[]> = {
      '/dashboard': ['/transactions', '/accounts', '/analytics'],
      '/transactions': ['/transactions/new', '/categories', '/dashboard'],
      '/accounts': ['/accounts/new', '/transactions', '/dashboard'],
      '/analytics': ['/reports', '/dashboard', '/transactions'],
      '/investments': ['/portfolio', '/analytics', '/dashboard']
    };

    const currentPath = location.pathname;
    const routesToPrefetch = likelyRoutes[currentPath] || [];

    // Prefetch likely routes after a delay
    const timer: TimeoutHandle = globalThis.setTimeout(() => {
      routesToPrefetch.forEach(async (route) => {
        if (!prefetchedRoutes.has(route)) {
          try {
            // Dynamic import based on route
            const routeName = route.split('/')[1];
            switch (routeName) {
              case 'transactions':
                await import('../pages/Transactions');
                break;
              case 'accounts':
                await import('../pages/Accounts');
                break;
              case 'analytics':
                await import('../pages/Analytics');
                break;
              case 'reports':
                await import('../components/ScheduledReports');
                break;
              case 'portfolio':
                await import('../components/EnhancedPortfolioView');
                break;
            }
            setPrefetchedRoutes(prev => new Set(prev).add(route));
          } catch (error) {
            logger.warn(`Failed to prefetch route ${route}:`, error);
          }
        }
      });
    }, 2000); // Wait 2 seconds before prefetching

    return () => globalThis.clearTimeout(timer);
  }, [location, prefetchedRoutes]);

  return {
    prefetchedRoutes,
    isPrefetched: (route: string) => prefetchedRoutes.has(route)
  };
}

/**
 * Hook for monitoring prefetch performance
 */
type IntervalHandle = ReturnType<typeof globalThis.setInterval>;

export function usePrefetchMetrics() {
  const [metrics, setMetrics] = useState({
    totalPrefetches: 0,
    successfulPrefetches: 0,
    failedPrefetches: 0,
    averageLoadTime: 0,
    bandwidthSaved: 0
  });

  useEffect(() => {
    // Update metrics periodically
    const interval: IntervalHandle = globalThis.setInterval(() => {
      // Get metrics from predictive loader
      // This would need to be implemented in the service
      setMetrics(prev => ({
        ...prev,
        totalPrefetches: prev.totalPrefetches + 1
      }));
    }, 10000);

    return () => globalThis.clearInterval(interval);
  }, []);

  return metrics;
}
