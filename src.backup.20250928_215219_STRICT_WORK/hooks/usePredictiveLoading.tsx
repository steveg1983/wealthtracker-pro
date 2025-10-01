import { useEffect, useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import predictiveLoader from '../services/predictiveLoadingService';
import { logger } from '../services/loggingService';

/**
 * Hook for predictive loading based on navigation context
 */
export function usePredictiveLoading() {
  const location = useLocation();
  const previousPath = useRef<string>();
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);

  useEffect(() => {
    // Get current context
    const context = predictiveLoader.getCurrentContext();
    
    // Add previous path if available
    if (previousPath.current) {
      (context as any).previousPath = previousPath.current;
    }

    // Execute predictions
    setIsPreloading(true);
    predictiveLoader.executePredictions(context)
      .finally(() => {
        setIsPreloading(false);
        setPreloadProgress(1);
      });

    // Record navigation pattern
    if (previousPath.current && previousPath.current !== location.pathname) {
      predictiveLoader.recordNavigation(previousPath.current, location.pathname);
    }

    // Update previous path
    previousPath.current = location.pathname;

    // Refresh stale data in background
    const refreshTimer = setTimeout(() => {
      predictiveLoader.refreshStaleData();
    }, 5000);

    return () => clearTimeout(refreshTimer);
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
        (element as any).dataset.prefetch = url;
        predictiveLoader.observeForPrefetch(element);
      }
    });
  }, [targets]);
}

/**
 * Component for predictive link
 */
export function PredictiveLink({
  to,
  children,
  className = '',
  preloadDelay = 100,
  ...props
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  preloadDelay?: number;
  [key: string]: any;
}) {
  const navigate = useNavigate();
  const hoverTimeout = useRef<NodeJS.Timeout>();
  const [isPreloading, setIsPreloading] = useState(false);

  const handleMouseEnter = useCallback(() => {
    hoverTimeout.current = setTimeout(() => {
      setIsPreloading(true);
      predictiveLoader.requestPreload({
        type: 'page',
        target: to,
        loader: async () => {
          // Preload route components
          const route = to.split('/')[1];
          switch (route) {
            case 'transactions':
              await import('../pages/Transactions');
              break;
            case 'accounts':
              await import('../pages/Accounts');
              break;
            case 'analytics':
              await import('../pages/Analytics');
              break;
            case 'investments':
              await import('../pages/Investments');
              break;
            default:
              break;
          }
        },
        priority: 2
      });
    }, preloadDelay);
  }, [to, preloadDelay]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    setIsPreloading(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    navigate(to);
  }, [navigate, to]);

  return (
    <a
      href={to}
      className={`${className} ${isPreloading ? 'cursor-wait' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      {...props}
    >
      {children}
      {isPreloading && (
        <span className="ml-1 text-xs text-gray-400">(preloading...)</span>
      )}
    </a>
  );
}

/**
 * Hook for smart data prefetching based on user patterns
 */
export function useSmartPrefetch(
  dataType: string,
  fetcher: () => Promise<any>,
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

  useEffect(() => {
    if (prefetchOn === 'mount') {
      setIsPrefetching(true);
      predictiveLoader.requestPreload({
        type: 'data',
        target: dataType,
        loader: fetcher,
        priority,
        ttl
      }).then(() => {
        setIsPrefetching(false);
        setPrefetchComplete(true);
      });
    } else if (prefetchOn === 'idle' && 'requestIdleCallback' in window) {
      const idleCallback = (window as any).requestIdleCallback(() => {
        setIsPrefetching(true);
        predictiveLoader.requestPreload({
          type: 'data',
          target: dataType,
          loader: fetcher,
          priority,
          ttl
        }).then(() => {
          setIsPrefetching(false);
          setPrefetchComplete(true);
        });
      });

      return () => {
        if ('cancelIdleCallback' in window) {
          (window as any).cancelIdleCallback(idleCallback);
        }
      };
    }
  }, [dataType, fetcher, prefetchOn, priority, ttl]);

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
  }, [prefetchOn, dataType]);

  // Handle viewport prefetch
  useEffect(() => {
    if (prefetchOn === 'viewport' && elementRef.current) {
      predictiveLoader.observeForPrefetch(elementRef.current);
    }
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
    const timer = setTimeout(() => {
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

    return () => clearTimeout(timer);
  }, [location, prefetchedRoutes]);

  return {
    prefetchedRoutes,
    isPrefetched: (route: string) => prefetchedRoutes.has(route)
  };
}

/**
 * Hook for monitoring prefetch performance
 */
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
    const interval = setInterval(() => {
      // Get metrics from predictive loader
      // This would need to be implemented in the service
      setMetrics(prev => ({
        ...prev,
        totalPrefetches: prev.totalPrefetches + 1
      }));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

