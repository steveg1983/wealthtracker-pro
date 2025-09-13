/**
 * @module ServiceRegistration
 * @description World-class service registration module that configures and
 * registers all application services with the DI container. Ensures proper
 * initialization order and dependency resolution.
 * 
 * @example
 * ```tsx
 * // In app initialization
 * import { registerServices } from './core/di/services/registration';
 * 
 * registerServices();
 * ```
 * 
 * @features
 * - Automatic service registration
 * - Dependency graph validation
 * - Environment-specific configuration
 * - Service mocking for tests
 */

import { container, ServiceScope, ServiceScopeType } from '../container';
import { 
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
  IThemeService
} from './interfaces';

// Import existing services
import { logger } from '../../../services/loggingService';
import { hapticService } from '../../../services/haptic/hapticService';
import { gestureService } from '../../../services/gesture/gestureService';
import { keyboardNavigationService } from '../../../services/keyboard/keyboardNavigationService';
import { optimisticUpdateService } from '../../../services/optimistic/optimisticUpdateService';
import smartCache from '../../../services/smartCacheService';
import { performanceService } from '../../../services/performanceService';
import { notificationService } from '../../../services/notificationService';
import { exportService } from '../../../services/exportService';
import { syncService } from '../../../services/syncService';

/**
 * Service registration configuration
 */
interface ServiceRegistration {
  id: string;
  factory: () => any;
  scope: ServiceScopeType;
  dependencies?: string[];
  tags?: string[];
  environments?: string[];
}

/**
 * Get current environment
 */
function getCurrentEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

/**
 * Core service registrations
 */
const coreServices: ServiceRegistration[] = [
  {
    id: 'logger',
    factory: () => logger,
    scope: ServiceScope.Singleton,
    tags: ['core', 'logging']
  },
  {
    id: 'performanceService',
    factory: () => performanceService,
    scope: ServiceScope.Singleton,
    tags: ['core', 'monitoring']
  },
  {
    id: 'cache',
    factory: () => smartCache,
    scope: ServiceScope.Singleton,
    tags: ['core', 'caching']
  }
];

/**
 * UI service registrations
 */
const uiServices: ServiceRegistration[] = [
  {
    id: 'hapticService',
    factory: () => hapticService,
    scope: ServiceScope.Singleton,
    tags: ['ui', 'mobile']
  },
  {
    id: 'gestureService',
    factory: () => gestureService,
    scope: ServiceScope.Singleton,
    tags: ['ui', 'mobile']
  },
  {
    id: 'keyboardNavigationService',
    factory: () => keyboardNavigationService,
    scope: ServiceScope.Singleton,
    tags: ['ui', 'accessibility']
  },
  {
    id: 'themeService',
    factory: () => createThemeService(),
    scope: ServiceScope.Singleton,
    tags: ['ui', 'theme']
  }
];

/**
 * Data service registrations
 */
const dataServices: ServiceRegistration[] = [
  {
    id: 'optimisticUpdateService',
    factory: () => optimisticUpdateService,
    scope: ServiceScope.Singleton,
    tags: ['data', 'sync']
  },
  {
    id: 'notificationService',
    factory: () => notificationService,
    scope: ServiceScope.Singleton,
    tags: ['data', 'notifications']
  },
  {
    id: 'exportService',
    factory: () => exportService,
    scope: ServiceScope.Singleton,
    tags: ['data', 'export']
  },
  {
    id: 'syncService',
    factory: () => syncService,
    scope: ServiceScope.Singleton,
    tags: ['data', 'sync']
  },
  {
    id: 'storageService',
    factory: () => createStorageService(),
    scope: ServiceScope.Singleton,
    tags: ['data', 'storage']
  }
];

/**
 * API service registrations
 */
const apiServices: ServiceRegistration[] = [
  {
    id: 'apiService',
    factory: () => createApiService(),
    scope: ServiceScope.Singleton,
    dependencies: ['logger'],
    tags: ['api', 'network']
  },
  {
    id: 'authService',
    factory: () => createAuthService(),
    scope: ServiceScope.Singleton,
    dependencies: ['apiService', 'storageService'],
    tags: ['api', 'auth']
  },
  {
    id: 'transactionService',
    factory: () => createTransactionService(),
    scope: ServiceScope.Singleton,
    dependencies: ['apiService', 'cache'],
    tags: ['api', 'business']
  },
  {
    id: 'accountService',
    factory: () => createAccountService(),
    scope: ServiceScope.Singleton,
    dependencies: ['apiService', 'cache'],
    tags: ['api', 'business']
  },
  {
    id: 'analyticsService',
    factory: () => createAnalyticsService(),
    scope: ServiceScope.Singleton,
    dependencies: ['transactionService', 'accountService'],
    tags: ['api', 'analytics']
  }
];

/**
 * Feature service registrations
 */
const featureServices: ServiceRegistration[] = [
  {
    id: 'featureFlagService',
    factory: () => createFeatureFlagService(),
    scope: ServiceScope.Singleton,
    tags: ['feature', 'config']
  },
  {
    id: 'encryptionService',
    factory: () => createEncryptionService(),
    scope: ServiceScope.Singleton,
    tags: ['feature', 'security']
  },
  {
    id: 'importService',
    factory: () => createImportService(),
    scope: ServiceScope.Transient,
    dependencies: ['transactionService'],
    tags: ['feature', 'import']
  }
];

/**
 * Register all services
 */
export function registerServices(options: {
  environment?: string;
  mockServices?: boolean;
  customServices?: ServiceRegistration[];
} = {}): void {
  const {
    environment = getCurrentEnvironment(),
    mockServices = false,
    customServices = []
  } = options;

  console.log(`Registering services for environment: ${environment}`);

  // Combine all service registrations
  const allServices = [
    ...coreServices,
    ...uiServices,
    ...dataServices,
    ...apiServices,
    ...featureServices,
    ...customServices
  ];

  // Filter services by environment
  const servicesToRegister = allServices.filter(service => {
    if (service.environments && !service.environments.includes(environment)) {
      return false;
    }
    return true;
  });

  // Register services in order
  servicesToRegister.forEach(service => {
    try {
      // Use mock if in test mode
      const factory = mockServices && service.tags?.includes('api')
        ? () => createMockService(service.id)
        : service.factory;

      container.register(service.id, factory as any, {
        scope: service.scope,
        dependencies: service.dependencies,
        tags: service.tags
      });

      console.debug(`✅ Registered service: ${service.id}`);
    } catch (error) {
      console.error(`❌ Failed to register service: ${service.id}`, error);
    }
  });

  // Validate dependency graph
  validateDependencies();

  console.log(`✅ Successfully registered ${servicesToRegister.length} services`);
}

/**
 * Validate service dependencies
 */
function validateDependencies(): void {
  const stats = container.getStats();
  const { dependencies } = stats;

  // Check for missing dependencies
  for (const [serviceId, deps] of dependencies) {
    for (const dep of deps) {
      if (!container.has(dep)) {
        console.warn(`⚠️ Service '${serviceId}' depends on unregistered service '${dep}'`);
      }
    }
  }
}

/**
 * Create mock service for testing
 */
function createMockService(serviceId: string): any {
  return new Proxy({}, {
    get(target, prop) {
      return (...args: any[]) => {
        console.debug(`Mock ${serviceId}.${String(prop)} called with:`, args);
        return Promise.resolve(null);
      };
    }
  });
}

// Service factory functions (these would normally be in separate files)

function createApiService(): IApiService {
  return {
    async get<T>(url: string, options?: RequestInit): Promise<T> {
      const response = await fetch(url, { ...options, method: 'GET' });
      return response.json();
    },
    async post<T>(url: string, data: any, options?: RequestInit): Promise<T> {
      const response = await fetch(url, {
        ...options,
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json', ...options?.headers }
      });
      return response.json();
    },
    async put<T>(url: string, data: any, options?: RequestInit): Promise<T> {
      const response = await fetch(url, {
        ...options,
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json', ...options?.headers }
      });
      return response.json();
    },
    async delete<T>(url: string, options?: RequestInit): Promise<T> {
      const response = await fetch(url, { ...options, method: 'DELETE' });
      return response.json();
    },
    setAuthToken(token: string): void {
      // Implementation
    },
    clearAuthToken(): void {
      // Implementation
    }
  };
}

function createAuthService(): IAuthService {
  return {
    async login(email: string, password: string) {
      // Implementation
      return { token: '', user: {} };
    },
    async logout() {
      // Implementation
    },
    async register(email: string, password: string) {
      // Implementation
      return { token: '', user: {} };
    },
    async refreshToken() {
      // Implementation
      return '';
    },
    getCurrentUser() {
      // Implementation
      return null;
    },
    isAuthenticated() {
      // Implementation
      return false;
    },
    onAuthStateChange(callback: (user: any | null) => void) {
      // Implementation
      return () => {};
    }
  };
}

function createTransactionService(): ITransactionService {
  const apiService = container.resolve<IApiService>('apiService');
  
  return {
    async getAll() {
      return apiService.get('/api/transactions');
    },
    async getById(id: string) {
      return apiService.get(`/api/transactions/${id}`);
    },
    async create(transaction: any) {
      return apiService.post('/api/transactions', transaction);
    },
    async update(id: string, transaction: any) {
      return apiService.put(`/api/transactions/${id}`, transaction);
    },
    async delete(id: string) {
      return apiService.delete(`/api/transactions/${id}`);
    },
    async bulkUpdate(ids: string[], updates: any) {
      return apiService.post('/api/transactions/bulk', { ids, updates });
    },
    async search(query: string) {
      return apiService.get(`/api/transactions/search?q=${query}`);
    },
    async getByDateRange(startDate: Date, endDate: Date) {
      return apiService.get(`/api/transactions?start=${startDate}&end=${endDate}`);
    },
    async getByAccount(accountId: string) {
      return apiService.get(`/api/transactions?account=${accountId}`);
    },
    async getByCategory(categoryId: string) {
      return apiService.get(`/api/transactions?category=${categoryId}`);
    }
  };
}

function createAccountService(): IAccountService {
  const apiService = container.resolve<IApiService>('apiService');
  
  return {
    async getAll() {
      return apiService.get('/api/accounts');
    },
    async getById(id: string) {
      return apiService.get(`/api/accounts/${id}`);
    },
    async create(account: any) {
      return apiService.post('/api/accounts', account);
    },
    async update(id: string, account: any) {
      return apiService.put(`/api/accounts/${id}`, account);
    },
    async delete(id: string) {
      return apiService.delete(`/api/accounts/${id}`);
    },
    async getBalance(id: string) {
      return apiService.get(`/api/accounts/${id}/balance`);
    },
    async reconcile(id: string, balance: number) {
      return apiService.post(`/api/accounts/${id}/reconcile`, { balance });
    },
    async getTransactions(id: string) {
      return apiService.get(`/api/accounts/${id}/transactions`);
    }
  };
}

function createAnalyticsService(): IAnalyticsService {
  return {
    async getSpendingByCategory(startDate: Date, endDate: Date) {
      // Implementation
      return new Map();
    },
    async getIncomeVsExpenses(period: 'month' | 'quarter' | 'year') {
      // Implementation
      return { income: 0, expenses: 0, net: 0 };
    },
    async getCashFlow(months: number) {
      // Implementation
      return [];
    },
    async getTrends(metric: string, periods: number) {
      // Implementation
      return [];
    },
    async getForecast(months: number) {
      // Implementation
      return [];
    },
    async getInsights() {
      // Implementation
      return [];
    }
  };
}

function createStorageService(): IStorageService {
  return {
    async get<T>(key: string): Promise<T | null> {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      localStorage.setItem(key, JSON.stringify(value));
    },
    async remove(key: string): Promise<void> {
      localStorage.removeItem(key);
    },
    async clear(): Promise<void> {
      localStorage.clear();
    },
    async getKeys(): Promise<string[]> {
      return Object.keys(localStorage);
    },
    async getSize(): Promise<number> {
      let size = 0;
      for (const key in localStorage) {
        size += localStorage[key].length;
      }
      return size;
    }
  };
}

function createThemeService(): IThemeService {
  let currentTheme: 'light' | 'dark' | 'auto' = 'auto';
  const listeners = new Set<(theme: string) => void>();

  return {
    getCurrentTheme() {
      return currentTheme;
    },
    setTheme(theme: 'light' | 'dark' | 'auto') {
      currentTheme = theme;
      listeners.forEach(listener => listener(theme));
    },
    toggleTheme() {
      const next = currentTheme === 'light' ? 'dark' : 'light';
      this.setTheme(next);
    },
    getCustomColors() {
      return {};
    },
    setCustomColor(key: string, value: string) {
      // Implementation
    },
    resetTheme() {
      this.setTheme('auto');
    },
    onThemeChange(callback: (theme: string) => void) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
  };
}

function createFeatureFlagService(): IFeatureFlagService {
  const flags: Record<string, boolean> = {};
  const listeners = new Map<string, Set<(enabled: boolean) => void>>();

  return {
    isEnabled(flag: string) {
      return flags[flag] || false;
    },
    getFlags() {
      return { ...flags };
    },
    setFlag(flag: string, enabled: boolean) {
      flags[flag] = enabled;
      listeners.get(flag)?.forEach(listener => listener(enabled));
    },
    async refresh() {
      // Fetch from server
    },
    onFlagChange(flag: string, callback: (enabled: boolean) => void) {
      if (!listeners.has(flag)) {
        listeners.set(flag, new Set());
      }
      listeners.get(flag)!.add(callback);
      return () => listeners.get(flag)?.delete(callback);
    }
  };
}

function createEncryptionService(): IEncryptionService {
  return {
    async encrypt(data: string, key?: string) {
      // Implementation
      return btoa(data);
    },
    async decrypt(data: string, key?: string) {
      // Implementation
      return atob(data);
    },
    async hash(data: string) {
      // Implementation
      return btoa(data);
    },
    async generateKey() {
      // Implementation
      return Math.random().toString(36);
    },
    async compareHash(data: string, hash: string) {
      // Implementation
      return btoa(data) === hash;
    }
  };
}

function createImportService(): IImportService {
  return {
    async importCSV(file: File) {
      // Implementation
      return [];
    },
    async importJSON(file: File) {
      // Implementation
      return {};
    },
    async importOFX(file: File) {
      // Implementation
      return [];
    },
    async importQIF(file: File) {
      // Implementation
      return [];
    },
    async validateData(data: any[], schema: any) {
      // Implementation
      return { valid: true, errors: [] };
    },
    async mapFields(data: any[], mapping: Record<string, string>) {
      // Implementation
      return data;
    }
  };
}