/**
 * @module DependencyInjection
 * @description World-class dependency injection system exports providing a complete
 * IoC container implementation for React applications with TypeScript.
 * 
 * @example
 * ```tsx
 * // In your app root
 * import { DIProvider, registerServices } from './core/di';
 * 
 * registerServices();
 * 
 * function App() {
 *   return (
 *     <DIProvider>
 *       <YourApp />
 *     </DIProvider>
 *   );
 * }
 * 
 * // In components
 * import { useService } from './core/di';
 * 
 * function MyComponent() {
 *   const transactionService = useService<ITransactionService>('transactionService');
 *   // Use service...
 * }
 * ```
 */

// Container exports
export {
  DIContainer,
  container,
  ServiceScope,
  type ServiceMetadata,
  type ServiceFactory,
  type ServiceOptions
} from './container';

// Provider and hooks exports
export {
  DIProvider,
  useDI,
  useService,
  useServices,
  useServicesByTag,
  useLazyService,
  withServices,
  useServiceRegistration,
  useDIDevTools,
  DIContext
} from './DIProvider';

// Service interfaces exports
export type {
  IApiService,
  IAuthService,
  ITransactionService,
  IAccountService,
  IAnalyticsService,
  INotificationService,
  IStorageService,
  IExportService,
  IImportService,
  ISyncService,
  IEncryptionService,
  ILoggerService,
  IPerformanceService,
  IFeatureFlagService,
  IThemeService,
  ServiceRegistry
} from './services/interfaces';

// Service registration exports
export {
  registerServices
} from './services/registration';

// Convenience type for service resolution
import { ServiceRegistry } from './services/interfaces';

/**
 * Type-safe service resolver
 */
export type ServiceResolver = <K extends keyof ServiceRegistry>(
  serviceId: K
) => ServiceRegistry[K];

/**
 * Create typed hooks for services
 */
export function createTypedHooks() {
  return {
    useApiService: () => useService<ServiceRegistry['apiService']>('apiService'),
    useAuthService: () => useService<ServiceRegistry['authService']>('authService'),
    useTransactionService: () => useService<ServiceRegistry['transactionService']>('transactionService'),
    useAccountService: () => useService<ServiceRegistry['accountService']>('accountService'),
    useAnalyticsService: () => useService<ServiceRegistry['analyticsService']>('analyticsService'),
    useNotificationService: () => useService<ServiceRegistry['notificationService']>('notificationService'),
    useStorageService: () => useService<ServiceRegistry['storageService']>('storageService'),
    useExportService: () => useService<ServiceRegistry['exportService']>('exportService'),
    useImportService: () => useService<ServiceRegistry['importService']>('importService'),
    useSyncService: () => useService<ServiceRegistry['syncService']>('syncService'),
    useEncryptionService: () => useService<ServiceRegistry['encryptionService']>('encryptionService'),
    useLoggerService: () => useService<ServiceRegistry['loggerService']>('loggerService'),
    usePerformanceService: () => useService<ServiceRegistry['performanceService']>('performanceService'),
    useFeatureFlagService: () => useService<ServiceRegistry['featureFlagService']>('featureFlagService'),
    useThemeService: () => useService<ServiceRegistry['themeService']>('themeService')
  };
}

// Re-export for convenience
import { useService } from './DIProvider';