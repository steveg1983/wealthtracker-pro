/**
 * Service Registry Pattern for Advanced Architecture
 * Phase 4: Advanced architectural patterns implementation
 * Provides dependency injection and service lifecycle management
 */

import { z } from 'zod';
import { lazyLogger as logger } from '../services/serviceFactory';

// Service configuration schema
const ServiceConfigSchema = z.object({
  name: z.string(),
  scope: z.enum(['singleton', 'transient', 'scoped']),
  dependencies: z.array(z.string()).optional(),
  lazy: z.boolean().optional()
});

type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

// Service factory function type
type ServiceFactory<T = unknown> = (...deps: unknown[]) => T;

// Service registration interface
interface ServiceRegistration<T = unknown> {
  factory: ServiceFactory<T>;
  config: ServiceConfig;
  instance?: T;
  initialized: boolean;
}

/**
 * Professional Service Registry for dependency injection
 * Implements singleton, transient, and scoped service patterns
 */
export class ServiceRegistry {
  private services = new Map<string, ServiceRegistration>();
  private instances = new Map<string, unknown>();
  private initializationOrder: string[] = [];

  /**
   * Register a service with the registry
   */
  register<T>(
    name: string,
    factory: ServiceFactory<T>,
    config: Partial<ServiceConfig> = {}
  ): void {
    try {
      const validatedConfig = ServiceConfigSchema.parse({
        name,
        scope: 'singleton',
        dependencies: [],
        lazy: true,
        ...config
      });

      this.services.set(name, {
        factory: factory as ServiceFactory,
        config: validatedConfig,
        initialized: false
      });

      logger.info('Service registered:', { name, config: validatedConfig });
    } catch (error) {
      logger.error('Failed to register service:', { name, error });
      throw new Error(`Service registration failed: ${name}`);
    }
  }

  /**
   * Resolve a service instance
   */
  resolve<T>(name: string): T {
    const registration = this.services.get(name);
    if (!registration) {
      throw new Error(`Service not found: ${name}`);
    }

    // Return existing instance for singleton
    if (registration.config.scope === 'singleton' && registration.instance) {
      return registration.instance as T;
    }

    try {
      // Resolve dependencies
      const dependencies = this.resolveDependencies(registration.config.dependencies || []);

      // Create instance
      const instance = registration.factory(...dependencies);

      // Store singleton instances
      if (registration.config.scope === 'singleton') {
        registration.instance = instance;
        this.instances.set(name, instance);
      }

      registration.initialized = true;
      this.trackInitializationOrder(name);

      logger.debug('Service resolved:', { name, scope: registration.config.scope });
      return instance as T;
    } catch (error) {
      logger.error('Failed to resolve service:', { name, error });
      throw new Error(`Service resolution failed: ${name}`);
    }
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get service configuration
   */
  getConfig(name: string): ServiceConfig | undefined {
    return this.services.get(name)?.config;
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get initialization order for debugging
   */
  getInitializationOrder(): string[] {
    return [...this.initializationOrder];
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear();
    this.instances.clear();
    this.initializationOrder = [];
  }

  /**
   * Dispose of all singleton instances
   */
  dispose(): void {
    this.instances.forEach((instance, name) => {
      if (instance && typeof (instance as { dispose?: () => void }).dispose === 'function') {
        try {
          (instance as { dispose: () => void }).dispose();
        } catch (error) {
          logger.warn('Failed to dispose service:', { name, error });
        }
      }
    });

    this.instances.clear();
    this.initializationOrder = [];
  }

  private resolveDependencies(dependencies: string[]): unknown[] {
    return dependencies.map(dep => {
      if (!this.services.has(dep)) {
        throw new Error(`Dependency not found: ${dep}`);
      }
      return this.resolve(dep);
    });
  }

  private trackInitializationOrder(name: string): void {
    if (!this.initializationOrder.includes(name)) {
      this.initializationOrder.push(name);
    }
  }
}

// Export singleton registry instance
export const serviceRegistry = new ServiceRegistry();

// Convenience functions for common patterns
export function registerSingleton<T>(
  name: string,
  factory: ServiceFactory<T>,
  dependencies: string[] = []
): void {
  serviceRegistry.register(name, factory, {
    name,
    scope: 'singleton',
    dependencies,
    lazy: true
  });
}

export function registerTransient<T>(
  name: string,
  factory: ServiceFactory<T>,
  dependencies: string[] = []
): void {
  serviceRegistry.register(name, factory, {
    name,
    scope: 'transient',
    dependencies,
    lazy: false
  });
}

export function inject<T>(name: string): T {
  return serviceRegistry.resolve<T>(name);
}