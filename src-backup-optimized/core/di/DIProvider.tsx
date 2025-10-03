/**
 * @component DIProvider
 * @description World-class dependency injection provider for React applications.
 * Provides container context to child components with automatic scope management
 * and lifecycle control.
 * 
 * @example
 * ```tsx
 * <DIProvider>
 *   <App />
 * </DIProvider>
 * ```
 * 
 * @features
 * - React context integration
 * - Automatic scope management
 * - Service lifecycle control
 * - Development tools integration
 * 
 * @performance
 * - Memoized context value
 * - Lazy service initialization
 * - Minimal re-renders
 */

import React, { createContext, useContext, useEffect, useMemo, useRef, useCallback } from 'react';
import { DIContainer, container as defaultContainer } from './container';

/**
 * DI context value
 */
interface DIContextValue {
  container: DIContainer;
  scope: object | null;
}

/**
 * DI context
 */
const DIContext = createContext<DIContextValue | null>(null);

/**
 * DI provider props
 */
interface DIProviderProps {
  /** Child components */
  children: React.ReactNode;
  /** Custom container instance */
  container?: DIContainer;
  /** Whether to create a new scope */
  createScope?: boolean;
  /** Scope name for debugging */
  scopeName?: string;
}

/**
 * Dependency injection provider component
 */
export const DIProvider = React.memo(function DIProvider({
  children,
  container = defaultContainer,
  createScope = false,
  scopeName = 'default'
}: DIProviderProps) {
  const scopeRef = useRef<object | null>(null);

  // Create scope if needed
  useEffect(() => {
    if (createScope && !scopeRef.current) {
      scopeRef.current = container.createScope();
      // Debug: DI scope created
    }

    return () => {
      if (scopeRef.current) {
        // Debug: DI scope destroyed
        scopeRef.current = null;
      }
    };
  }, [container, createScope, scopeName]);

  // Memoize context value
  const contextValue = useMemo<DIContextValue>(() => ({
    container,
    scope: scopeRef.current
  }), [container]);

  return (
    <DIContext.Provider value={contextValue}>
      {children}
    </DIContext.Provider>
  );
});

/**
 * Hook to access DI container
 */
export function useDI(): DIContainer {
  const context = useContext(DIContext);
  
  if (!context) {
    // Return default container if no provider
    return defaultContainer;
  }
  
  return context.container;
}

/**
 * Hook to resolve a service
 */
export function useService<T>(serviceId: string): T {
  const container = useDI();
  
  // Memoize service instance
  const service = useMemo(() => {
    try {
      return container.resolve<T>(serviceId);
    } catch (error) {
      // Error: Failed to resolve service
      throw error;
    }
  }, [container, serviceId]);
  
  return service;
}

/**
 * Hook to resolve multiple services
 */
export function useServices<T extends Record<string, any>>(
  serviceIds: (keyof T)[]
): T {
  const container = useDI();
  
  // Memoize services object
  const services = useMemo(() => {
    const result = {} as T;
    
    for (const id of serviceIds) {
      try {
        result[id] = container.resolve(String(id));
      } catch (error) {
        // Error: Failed to resolve service
        throw error;
      }
    }
    
    return result;
  }, [container, serviceIds.join(',')]);
  
  return services;
}

/**
 * Hook to get services by tag
 */
export function useServicesByTag<T>(tag: string): T[] {
  const container = useDI();
  
  const services = useMemo(() => {
    const serviceIds = container.getByTag(tag);
    return serviceIds.map(id => container.resolve<T>(id));
  }, [container, tag]);
  
  return services;
}

/**
 * Hook for lazy service resolution
 */
export function useLazyService<T>(serviceId: string): () => T {
  const container = useDI();
  
  const resolver = useCallback(() => {
    return container.resolve<T>(serviceId);
  }, [container, serviceId]);
  
  return resolver;
}

/**
 * HOC for service injection
 */
export function withServices<P extends object, S extends Record<string, any>>(
  Component: React.ComponentType<P & S>,
  serviceMap: Record<keyof S, string>
): React.ComponentType<P> {
  return React.memo(function WithServices(props: P) {
    const services = {} as S;
    const container = useDI();
    
    // Resolve all services
    for (const [propName, serviceId] of Object.entries(serviceMap)) {
      services[propName as keyof S] = container.resolve(serviceId as string);
    }
    
    return <Component {...props} {...services} />;
  });
}

/**
 * Service registration hook
 */
export function useServiceRegistration(
  registrations: Array<{
    id: string;
    factory: () => any;
    options?: any;
  }>
): void {
  const container = useDI();
  
  useEffect(() => {
    // Register services
    registrations.forEach(({ id, factory, options }) => {
      if (!container.has(id)) {
        container.register(id, factory as any, options);
      }
    });
    
    // Cleanup function
    return () => {
      // Services persist across component lifecycle
      // Only clean up if needed for specific use cases
    };
  }, [container, registrations]);
}

/**
 * Development tools hook
 */
export function useDIDevTools(): {
  stats: ReturnType<DIContainer['getStats']>;
  hasService: (id: string) => boolean;
  getMetadata: (id: string) => any;
} {
  const container = useDI();
  
  return useMemo(() => ({
    stats: container.getStats(),
    hasService: (id: string) => container.has(id),
    getMetadata: (id: string) => container.getMetadata(id)
  }), [container]);
}

// Export context for advanced use cases
export { DIContext };
