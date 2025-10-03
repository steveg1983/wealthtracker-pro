/**
 * Service Registration Configuration
 * Phase 4: Advanced architectural patterns implementation
 * Registers all services with the ServiceRegistry for dependency injection
 */

import { serviceRegistry, registerSingleton } from '../patterns/ServiceRegistry';
import { dashboardWidgetService } from './dashboardWidgetService';
import { lazyLogger as logger } from './serviceFactory';
import { userIdService } from './userIdService';
import { analyticsEngine } from './analyticsEngine';
import { advancedAnalyticsService } from './advancedAnalyticsService';
// Lazy load exportService to prevent bundling heavy dependencies
// import { exportService } from './exportService';
import { errorTaxonomyService } from './ErrorTaxonomyService';
import { productionMonitoring } from './ProductionMonitoringService';

/**
 * Register all application services
 * Should be called during app initialization
 */
export function registerAllServices(): void {
  try {
    // Register core services first (no dependencies)
    registerSingleton(
      'loggingService',
      () => logger
    );

    registerSingleton(
      'userIdService',
      () => userIdService
    );

    // Register services with dependencies
    registerSingleton(
      'dashboardWidgetService',
      () => dashboardWidgetService,
      ['userIdService', 'loggingService']
    );

    // Register analytics engine (heavy computation service)
    registerSingleton(
      'analyticsEngine',
      () => analyticsEngine,
      ['loggingService']
    );

    // Register advanced analytics service
    registerSingleton(
      'advancedAnalyticsService',
      () => advancedAnalyticsService,
      ['loggingService']
    );

    // Register export service (file processing) - lazy loaded
    registerSingleton(
      'exportService',
      async () => {
        const module = await import('./exportService');
        return module.exportService;
      },
      ['loggingService']
    );

    // Register error taxonomy service (Phase 5)
    registerSingleton(
      'errorTaxonomyService',
      () => errorTaxonomyService,
      ['loggingService']
    );

    // Register production monitoring service (Phase 8)
    registerSingleton(
      'productionMonitoring',
      () => productionMonitoring,
      ['loggingService', 'errorTaxonomyService']
    );

    logger.info('All services registered successfully in ServiceRegistry');
  } catch (error) {
    logger.error('Failed to register services:', error);
    throw new Error('Service registration failed during app initialization');
  }
}

/**
 * Get service initialization status for debugging
 */
export function getServiceRegistryStatus(): {
  registeredServices: string[];
  initializationOrder: string[];
} {
  return {
    registeredServices: serviceRegistry.getServiceNames(),
    initializationOrder: serviceRegistry.getInitializationOrder()
  };
}

/**
 * Clean up all services (for testing)
 */
export function disposeAllServices(): void {
  serviceRegistry.dispose();
  logger.info('All services disposed');
}