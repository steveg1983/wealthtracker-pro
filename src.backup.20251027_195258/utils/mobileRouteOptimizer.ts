import { lazy } from 'react';
import type { LazyExoticComponent, ComponentType } from 'react';

// Define priority routes that should load immediately on mobile
const MOBILE_PRIORITY_ROUTES = ['Dashboard', 'Transactions', 'Accounts'];

// Create optimized lazy loading for mobile
export function lazyLoadForMobile<T extends ComponentType<unknown>>(
  importFunc: () => Promise<{ default: T }>,
  componentName: string
): LazyExoticComponent<T> {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile && !MOBILE_PRIORITY_ROUTES.includes(componentName)) {
    // On mobile, delay non-priority routes
    return lazy(() => 
      new Promise(resolve => {
        // Use requestIdleCallback if available, otherwise setTimeout
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => {
            importFunc().then(resolve);
          });
        } else {
          setTimeout(() => {
            importFunc().then(resolve);
          }, 100);
        }
      })
    );
  }
  
  return lazy(importFunc);
}

// Preload critical routes on mobile after initial render
export function preloadMobileCriticalRoutes() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Wait for initial render to complete
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
      // Preload only the most critical routes
      import('../pages/Dashboard');
      import('../pages/Transactions');
      import('../pages/Accounts');
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        import('../pages/Dashboard');
        import('../pages/Transactions');
        import('../pages/Accounts');
      }, 2000);
    }
  }
}