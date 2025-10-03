import { useCallback, useRef } from 'react';
import { PreloadableComponent } from '../utils/lazyWithPreload';
import { ComponentType } from 'react';

// Import the lazy-loaded route components
// These are defined in App.tsx with lazyWithPreload
const routeComponents: Record<string, () => Promise<{ default: ComponentType<unknown> }>> = {
  '/dashboard': () => import('../pages/DashboardV2').then(module => ({ default: module.default })),
  '/dashboard-v2': () => import('../pages/DashboardV2').then(module => ({ default: module.default })),
  '/accounts': () => import('../pages/Accounts').then(module => ({ default: module.default as ComponentType<unknown> })),
  '/transactions': () => import('../pages/Transactions').then(module => ({ default: module.default as ComponentType<unknown> })),
  '/reconciliation': () => import('../pages/Reconciliation').then(module => ({ default: module.default })),
  '/investments': () => import('../pages/Investments').then(module => ({ default: module.default })),
  '/budget': () => import('../pages/Budget').then(module => ({ default: module.default })),
  '/goals': () => import('../pages/Goals').then(module => ({ default: module.default })),
  '/analytics': () => import('../pages/Analytics').then(module => ({ default: module.default })),
  '/advanced-analytics': () => import('../pages/AdvancedAnalytics').then(module => ({ default: module.default })),
  '/ai-features': () => import('../pages/AIFeatures').then(module => ({ default: module.default })),
  '/custom-reports': () => import('../pages/CustomReports').then(module => ({ default: module.default })),
  '/settings': () => import('../pages/Settings').then(module => ({ default: module.default })),
  '/financial-planning': () => import('../pages/FinancialPlanning').then(module => ({ default: module.default })),
  '/data-intelligence': () => import('../pages/DataIntelligence').then(module => ({ default: module.default })),
  '/export-manager': () => import('../pages/ExportManager').then(module => ({ default: module.default })),
  '/transfer-center': () => import('../pages/TransferCenter').then(module => ({ default: module.default })),
};

// Related route prefetch mapping
const relatedRoutes: Record<string, string[]> = {
  '/dashboard': ['/transactions', '/accounts', '/budget'],
  '/accounts': ['/transactions', '/reconciliation'],
  '/transactions': ['/accounts', '/reconciliation', '/budget'],
  '/reconciliation': ['/transactions', '/accounts'],
  '/budget': ['/goals', '/transactions'],
  '/goals': ['/budget', '/financial-planning'],
  '/analytics': ['/custom-reports', '/advanced-analytics'],
  '/investments': ['/financial-planning'],
};

export function useRoutePrefetch() {
  const prefetchedRoutes = useRef(new Set<string>());
  const prefetchTimeouts = useRef(new Map<string, NodeJS.Timeout>());

  const prefetch = useCallback((route: string) => {
    // Clean up the route path
    const cleanRoute = route.split('?')[0]; // Remove query params
    
    // Skip if already prefetched
    if (prefetchedRoutes.current.has(cleanRoute)) {
      return;
    }

    // Clear any existing timeout for this route
    const existingTimeout = prefetchTimeouts.current.get(cleanRoute);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Debounce prefetch by 100ms to avoid triggering on quick hover
    const timeoutId = setTimeout(async () => {
      const componentLoader = routeComponents[cleanRoute];
      if (componentLoader) {
        try {
          // Mark as prefetched before loading to avoid duplicates
          prefetchedRoutes.current.add(cleanRoute);
          
          // Prefetch the main route
          await componentLoader();
          
          // Prefetch related routes in idle time
          const related = relatedRoutes[cleanRoute] || [];
          if (related.length > 0 && 'requestIdleCallback' in window) {
            requestIdleCallback(() => {
              related.forEach(async (relatedRoute) => {
                if (!prefetchedRoutes.current.has(relatedRoute)) {
                  const relatedLoader = routeComponents[relatedRoute];
                  if (relatedLoader) {
                    prefetchedRoutes.current.add(relatedRoute);
                    await relatedLoader();
                  }
                }
              });
            });
          }
        } catch (error) {
          // Remove from prefetched set if loading failed
          prefetchedRoutes.current.delete(cleanRoute);
          console.error(`Failed to prefetch route ${cleanRoute}:`, error);
        }
      }
      
      // Clean up the timeout reference
      prefetchTimeouts.current.delete(cleanRoute);
    }, 100);

    prefetchTimeouts.current.set(cleanRoute, timeoutId);
  }, []);

  // Clean up function to clear timeouts
  const cleanup = useCallback(() => {
    prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout));
    prefetchTimeouts.current.clear();
  }, []);

  return prefetch;
}

// Utility to prefetch critical routes on app start
export function prefetchCriticalRoutes() {
  const criticalRoutes = ['/dashboard', '/transactions', '/accounts'];
  
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      criticalRoutes.forEach(route => {
        const loader = routeComponents[route];
        if (loader) {
          loader();
        }
      });
    });
  }
}