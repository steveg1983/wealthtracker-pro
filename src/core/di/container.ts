/**
 * @module DIContainer
 * @description World-class dependency injection container providing enterprise-grade
 * service management, lifecycle control, and dependency resolution for scalable
 * React applications with TypeScript.
 * 
 * @example
 * ```tsx
 * // Register services
 * container.register('apiService', ApiService, { singleton: true });
 * container.register('authService', AuthService, { dependencies: ['apiService'] });
 * 
 * // Resolve dependencies
 * const authService = container.resolve<AuthService>('authService');
 * ```
 * 
 * @features
 * - Service registration
 * - Automatic dependency resolution
 * - Lifecycle management
 * - Circular dependency detection
 * - Lazy initialization
 * - Scope management
 * 
 * @performance
 * - Singleton caching
 * - Lazy loading
 * - Minimal overhead
 * 
 * @patterns
 * - IoC (Inversion of Control)
 * - Service Locator
 * - Factory Pattern
 */

import { logger } from '../../services/loggingService';

/**
 * Service lifecycle scopes
 */
export const ServiceScope = {
  /** Single instance shared globally */
  Singleton: 'singleton' as const,
  /** New instance per resolution */
  Transient: 'transient' as const,
  /** Single instance per request/context */
  Scoped: 'scoped' as const
};

export type ServiceScopeType = typeof ServiceScope[keyof typeof ServiceScope];

/**
 * Service registration metadata
 */
export interface ServiceMetadata {
  /** Service identifier */
  id: string;
  /** Service constructor or factory */
  factory: ServiceFactory<any>;
  /** Service lifecycle scope */
  scope: ServiceScopeType;
  /** Service dependencies */
  dependencies: string[];
  /** Tags for categorization */
  tags: string[];
  /** Registration timestamp */
  registeredAt: number;
  /** Lazy initialization */
  lazy: boolean;
}

/**
 * Service factory function
 */
export type ServiceFactory<T> = (container: DIContainer) => T;

/**
 * Service registration options
 */
export interface ServiceOptions {
  /** Service scope (default: transient) */
  scope?: ServiceScopeType;
  /** Service dependencies */
  dependencies?: string[];
  /** Service tags */
  tags?: string[];
  /** Lazy initialization (default: true) */
  lazy?: boolean;
  /** Whether to replace existing registration */
  replace?: boolean;
}

/**
 * Dependency injection container
 */
export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, ServiceMetadata> = new Map();
  private singletons: Map<string, any> = new Map();
  private scopedInstances: WeakMap<object, Map<string, any>> = new WeakMap();
  private resolving: Set<string> = new Set();
  private currentScope: object | null = null;

  private constructor() {
    this.registerCoreServices();
  }

  /**
   * Get container instance
   */
  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Register a service
   */
  register<T>(
    id: string,
    implementation: new (...args: any[]) => T | ServiceFactory<T>,
    options: ServiceOptions = {}
  ): void {
    const {
      scope = ServiceScope.Transient,
      dependencies = [],
      tags = [],
      lazy = true,
      replace = false
    } = options;

    // Check if already registered
    if (this.services.has(id) && !replace) {
      logger.warn(`Service '${id}' is already registered. Use replace: true to override.`);
      return;
    }

    // Create factory function
    const factory: ServiceFactory<T> = 
      typeof implementation === 'function' && implementation.prototype
        ? (container) => {
            const deps = dependencies.map(dep => container.resolve(dep));
            return new (implementation as new (...args: any[]) => T)(...deps);
          }
        : implementation as unknown as ServiceFactory<T>;

    // Register service metadata
    const metadata: ServiceMetadata = {
      id,
      factory,
      scope,
      dependencies,
      tags,
      registeredAt: Date.now(),
      lazy
    };

    this.services.set(id, metadata);

    // Clear singleton cache if replacing
    if (replace && this.singletons.has(id)) {
      this.singletons.delete(id);
    }

    logger.debug(`Service '${id}' registered`, { scope, dependencies, tags });
  }

  /**
   * Register multiple services
   */
  registerBatch(registrations: Array<{
    id: string;
    implementation: any;
    options?: ServiceOptions;
  }>): void {
    registrations.forEach(({ id, implementation, options }) => {
      this.register(id, implementation, options);
    });
  }

  /**
   * Resolve a service
   */
  resolve<T>(id: string): T {
    const metadata = this.services.get(id);
    
    if (!metadata) {
      throw new Error(`Service '${id}' is not registered`);
    }

    // Check for circular dependencies
    if (this.resolving.has(id)) {
      throw new Error(`Circular dependency detected: ${Array.from(this.resolving).join(' -> ')} -> ${id}`);
    }

    // Handle different scopes
    switch (metadata.scope) {
      case ServiceScope.Singleton:
        return this.resolveSingleton<T>(metadata);
      
      case ServiceScope.Scoped:
        return this.resolveScoped<T>(metadata);
      
      case ServiceScope.Transient:
      default:
        return this.resolveTransient<T>(metadata);
    }
  }

  /**
   * Resolve singleton service
   */
  private resolveSingleton<T>(metadata: ServiceMetadata): T {
    if (!this.singletons.has(metadata.id)) {
      this.resolving.add(metadata.id);
      try {
        const instance = metadata.factory(this);
        this.singletons.set(metadata.id, instance);
        logger.debug(`Singleton '${metadata.id}' instantiated`);
      } finally {
        this.resolving.delete(metadata.id);
      }
    }
    return this.singletons.get(metadata.id);
  }

  /**
   * Resolve scoped service
   */
  private resolveScoped<T>(metadata: ServiceMetadata): T {
    if (!this.currentScope) {
      throw new Error(`No scope active for scoped service '${metadata.id}'`);
    }

    if (!this.scopedInstances.has(this.currentScope)) {
      this.scopedInstances.set(this.currentScope, new Map());
    }

    const scopeMap = this.scopedInstances.get(this.currentScope)!;
    
    if (!scopeMap.has(metadata.id)) {
      this.resolving.add(metadata.id);
      try {
        const instance = metadata.factory(this);
        scopeMap.set(metadata.id, instance);
        logger.debug(`Scoped service '${metadata.id}' instantiated`);
      } finally {
        this.resolving.delete(metadata.id);
      }
    }

    return scopeMap.get(metadata.id);
  }

  /**
   * Resolve transient service
   */
  private resolveTransient<T>(metadata: ServiceMetadata): T {
    this.resolving.add(metadata.id);
    try {
      const instance = metadata.factory(this);
      logger.debug(`Transient service '${metadata.id}' instantiated`);
      return instance;
    } finally {
      this.resolving.delete(metadata.id);
    }
  }

  /**
   * Create a new scope
   */
  createScope(): object {
    const scope = {};
    this.currentScope = scope;
    return scope;
  }

  /**
   * Execute within scope
   */
  withScope<T>(callback: () => T): T {
    const previousScope = this.currentScope;
    const scope = this.createScope();
    
    try {
      return callback();
    } finally {
      this.currentScope = previousScope;
      // Clean up scoped instances
      this.scopedInstances.delete(scope);
    }
  }

  /**
   * Check if service is registered
   */
  has(id: string): boolean {
    return this.services.has(id);
  }

  /**
   * Get all services with tag
   */
  getByTag(tag: string): string[] {
    const services: string[] = [];
    
    for (const [id, metadata] of this.services) {
      if (metadata.tags.includes(tag)) {
        services.push(id);
      }
    }
    
    return services;
  }

  /**
   * Get service metadata
   */
  getMetadata(id: string): ServiceMetadata | undefined {
    return this.services.get(id);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.services.clear();
    this.singletons.clear();
    this.scopedInstances = new WeakMap();
    this.resolving.clear();
    this.currentScope = null;
    
    // Re-register core services
    this.registerCoreServices();
    
    logger.info('DI container cleared');
  }

  /**
   * Register core services
   */
  private registerCoreServices(): void {
    // Register the container itself
    this.register('container', (() => this) as any, {
      scope: ServiceScope.Singleton,
      tags: ['core']
    });

    // Register logger
    this.register('logger', (() => logger) as any, {
      scope: ServiceScope.Singleton,
      tags: ['core', 'logging']
    });
  }

  /**
   * Create child container
   */
  createChild(): DIContainer {
    const child = new (DIContainer as any)();
    
    // Copy parent registrations
    for (const [id, metadata] of this.services) {
      if (!['container', 'logger'].includes(id)) {
        child.services.set(id, { ...metadata });
      }
    }
    
    return child;
  }

  /**
   * Get container statistics
   */
  getStats(): {
    registeredServices: number;
    singletons: number;
    tags: string[];
    dependencies: Map<string, string[]>;
  } {
    const tags = new Set<string>();
    const dependencies = new Map<string, string[]>();
    
    for (const [id, metadata] of this.services) {
      metadata.tags.forEach(tag => tags.add(tag));
      if (metadata.dependencies.length > 0) {
        dependencies.set(id, metadata.dependencies);
      }
    }
    
    return {
      registeredServices: this.services.size,
      singletons: this.singletons.size,
      tags: Array.from(tags),
      dependencies
    };
  }
}

// Export singleton instance
export const container = DIContainer.getInstance();