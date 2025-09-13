// Converted to .tsx for inline JSX in fallback component
import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { logger } from '../services/loggingService';

/**
 * Enterprise-grade lazy import utility with retry logic
 * Microsoft/Apple/Google standard - resilient code splitting with error recovery
 */

interface LazyImportOptions {
  retries?: number;
  retryDelay?: number;
  chunkName?: string;
  preload?: boolean;
}

/**
 * Enhanced lazy import with retry mechanism and error handling
 */
export function lazyImport<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyImportOptions = {}
): LazyExoticComponent<T> {
  const { 
    retries = 3, 
    retryDelay = 1000,
    chunkName,
    preload = false 
  } = options;

  let retryCount = 0;

  const importWithRetry = async (): Promise<{ default: T }> => {
    try {
      // Add webpack magic comment for chunk naming
      const module = await importFunc();
      
      // Reset retry count on success
      retryCount = 0;
      
      return module;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      if (retryCount < retries) {
        retryCount++;
        logger.warn(`Failed to load component, retrying (${retryCount}/${retries})...`, err);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
        
        // Clear module cache to force re-download
        if (err.message?.includes('Loading chunk')) {
          // Network error - try to recover
          window.location.reload();
        }
        
        return importWithRetry();
      }
      
      logger.error('Failed to load component after retries:', err);
      
      // Return error component - create a component that matches type T
      const ErrorComponent = () => (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="text-center">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Failed to Load Component
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please refresh the page to try again
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
      
      return {
        default: (ErrorComponent as unknown) as T
      };
    }
  };

  const LazyComponent = lazy(importWithRetry);

  // Preload option for critical components
  if (preload && typeof window !== 'undefined') {
    importFunc().catch(error => {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('Preload failed for component:', err);
    });
  }

  return LazyComponent;
}

/**
 * Preload a lazy component
 */
export function preloadComponent(
  importFunc: () => Promise<any>
): Promise<void> {
  return importFunc()
    .then(() => {
      logger.info('Component preloaded successfully');
    })
    .catch(error => {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('Failed to preload component:', err);
    });
}

/**
 * Create a lazy route with code splitting
 */
export function lazyRoute<T extends ComponentType<any>>(
  path: string,
  importFunc: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazyImport(importFunc, {
    chunkName: `route-${path.replace(/\//g, '-')}`,
    retries: 5,
    retryDelay: 500
  });
}

/**
 * Bundle heavy components together for better caching
 */
export const HeavyComponentsBundle = {
  MortgageCalculator: lazyImport(
    () => import(/* webpackChunkName: "heavy-calculators" */ '../components/MortgageCalculatorNew'),
    { preload: false }
  ),
  RetirementPlanner: lazyImport(
    () => import(/* webpackChunkName: "heavy-calculators" */ '../components/RetirementPlanner'),
    { preload: false }
  ),
  DebtManagement: lazyImport(
    () => import(/* webpackChunkName: "heavy-calculators" */ '../components/DebtManagement'),
    { preload: false }
  ),
  InvestmentAnalysis: lazyImport(
    () => import(/* webpackChunkName: "heavy-analytics" */ '../components/PortfolioAnalysis'),
    { preload: false }
  ),
  DataValidation: lazyImport(
    () => import(/* webpackChunkName: "heavy-data" */ '../components/DataValidation'),
    { preload: false }
  ),
  CSVImportWizard: lazyImport(
    () => import(/* webpackChunkName: "heavy-data" */ '../components/CSVImportWizard'),
    { preload: false }
  ),
  BulkTransactionEdit: lazyImport(
    () => import(/* webpackChunkName: "heavy-data" */ '../components/BulkTransactionEdit'),
    { preload: false }
  )
};

/**
 * Preload critical routes based on user behavior
 */
export function setupSmartPreloading(): void {
  // Preload commonly accessed heavy components after main bundle loads
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback for non-blocking preload
    const preloadWhenIdle = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // Preload based on common user paths
          const userRole = localStorage.getItem('userRole');
          
          if (userRole === 'investor') {
            preloadComponent(() => import('../components/PortfolioAnalysis'));
          } else if (userRole === 'planner') {
            preloadComponent(() => import('../components/RetirementPlanner'));
          }
        }, { timeout: 5000 });
      }
    };

    // Start preloading after initial load
    if (document.readyState === 'complete') {
      preloadWhenIdle();
    } else {
      window.addEventListener('load', preloadWhenIdle);
    }
  }
}

/**
 * Route-based code splitting configuration
 */
export const Routes = {
  Dashboard: lazyRoute('dashboard', () => import('../pages/DashboardV2')),
  Accounts: lazyRoute('accounts', () => import('../pages/Accounts')),
  Transactions: lazyRoute('transactions', () => import('../pages/Transactions')),
  Budget: lazyRoute('budget', () => import('../pages/Budget')),
  Goals: lazyRoute('goals', () => import('../pages/Goals')),
  Analytics: lazyRoute('analytics', () => import('../pages/Analytics')),
  Reports: lazyRoute('reports', () => import('../pages/Reports')),
  Investments: lazyRoute('investments', () => import('../pages/Investments')),
  Settings: lazyRoute('settings', () => import('../pages/Settings'))
};
