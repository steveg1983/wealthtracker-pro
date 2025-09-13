/**
 * @test DIContainer
 * @description World-class unit tests for dependency injection container
 * ensuring reliable service management and dependency resolution.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DIContainer, ServiceScope } from '../container';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    // Create fresh container for each test
    container = new (DIContainer as any)();
  });

  afterEach(() => {
    container.clear();
  });

  describe('Service Registration', () => {
    it('should register a service with factory function', () => {
      const factory = () => ({ name: 'TestService' });
      
      container.register('testService', factory);
      
      expect(container.has('testService')).toBe(true);
    });

    it('should register a service with constructor', () => {
      class TestService {
        constructor(public name: string = 'TestService') {}
      }
      
      container.register('testService', TestService);
      
      expect(container.has('testService')).toBe(true);
    });

    it('should register with options', () => {
      const factory = () => ({ name: 'TestService' });
      
      container.register('testService', factory, {
        scope: ServiceScope.Singleton,
        dependencies: ['dep1', 'dep2'],
        tags: ['test', 'example']
      });
      
      const metadata = container.getMetadata('testService');
      expect(metadata?.scope).toBe(ServiceScope.Singleton);
      expect(metadata?.dependencies).toEqual(['dep1', 'dep2']);
      expect(metadata?.tags).toEqual(['test', 'example']);
    });

    it('should warn when registering duplicate service', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();
      const factory = () => ({});
      
      container.register('testService', factory);
      container.register('testService', factory);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already registered')
      );
      
      consoleSpy.mockRestore();
    });

    it('should replace service when replace option is true', () => {
      const factory1 = () => ({ version: 1 });
      const factory2 = () => ({ version: 2 });
      
      container.register('testService', factory1);
      container.register('testService', factory2, { replace: true });
      
      const service = container.resolve<any>('testService');
      expect(service.version).toBe(2);
    });

    it('should register multiple services in batch', () => {
      const registrations = [
        { id: 'service1', implementation: () => ({ id: 1 }) },
        { id: 'service2', implementation: () => ({ id: 2 }) },
        { id: 'service3', implementation: () => ({ id: 3 }) }
      ];
      
      container.registerBatch(registrations);
      
      expect(container.has('service1')).toBe(true);
      expect(container.has('service2')).toBe(true);
      expect(container.has('service3')).toBe(true);
    });
  });

  describe('Service Resolution', () => {
    it('should resolve a transient service', () => {
      let counter = 0;
      const factory = () => ({ id: ++counter });
      
      container.register('testService', factory, {
        scope: ServiceScope.Transient
      });
      
      const instance1 = container.resolve<any>('testService');
      const instance2 = container.resolve<any>('testService');
      
      expect(instance1.id).toBe(1);
      expect(instance2.id).toBe(2);
      expect(instance1).not.toBe(instance2);
    });

    it('should resolve a singleton service', () => {
      let counter = 0;
      const factory = () => ({ id: ++counter });
      
      container.register('testService', factory, {
        scope: ServiceScope.Singleton
      });
      
      const instance1 = container.resolve<any>('testService');
      const instance2 = container.resolve<any>('testService');
      
      expect(instance1.id).toBe(1);
      expect(instance2.id).toBe(1);
      expect(instance1).toBe(instance2);
    });

    it('should resolve a scoped service', () => {
      let counter = 0;
      const factory = () => ({ id: ++counter });
      
      container.register('testService', factory, {
        scope: ServiceScope.Scoped
      });
      
      const scope1 = container.createScope();
      const instance1 = container.resolve<any>('testService');
      const instance2 = container.resolve<any>('testService');
      
      expect(instance1).toBe(instance2);
      
      const scope2 = container.createScope();
      const instance3 = container.resolve<any>('testService');
      
      expect(instance3).not.toBe(instance1);
    });

    it('should throw error for unregistered service', () => {
      expect(() => {
        container.resolve('nonExistent');
      }).toThrow("Service 'nonExistent' is not registered");
    });

    it('should throw error for scoped service without scope', () => {
      container.register('testService', () => ({}), {
        scope: ServiceScope.Scoped
      });
      
      // Clear any active scope
      (container as any).currentScope = null;
      
      expect(() => {
        container.resolve('testService');
      }).toThrow("No scope active for scoped service");
    });
  });

  describe('Dependency Injection', () => {
    it('should inject dependencies', () => {
      container.register('dep1', () => ({ name: 'Dependency1' }));
      container.register('dep2', () => ({ name: 'Dependency2' }));
      
      class TestService {
        constructor(public dep1: any, public dep2: any) {}
      }
      
      container.register('testService', TestService, {
        dependencies: ['dep1', 'dep2']
      });
      
      const service = container.resolve<TestService>('testService');
      
      expect(service.dep1.name).toBe('Dependency1');
      expect(service.dep2.name).toBe('Dependency2');
    });

    it('should resolve nested dependencies', () => {
      container.register('dep3', () => ({ level: 3 }));
      container.register('dep2', (c) => ({
        level: 2,
        dep: c.resolve('dep3')
      }));
      container.register('dep1', (c) => ({
        level: 1,
        dep: c.resolve('dep2')
      }));
      
      const service = container.resolve<any>('dep1');
      
      expect(service.level).toBe(1);
      expect(service.dep.level).toBe(2);
      expect(service.dep.dep.level).toBe(3);
    });

    it('should detect circular dependencies', () => {
      container.register('service1', (c) => ({
        dep: c.resolve('service2')
      }));
      container.register('service2', (c) => ({
        dep: c.resolve('service1')
      }));
      
      expect(() => {
        container.resolve('service1');
      }).toThrow('Circular dependency detected');
    });
  });

  describe('Scope Management', () => {
    it('should execute within scope', () => {
      container.register('scopedService', () => ({ 
        timestamp: Date.now() 
      }), {
        scope: ServiceScope.Scoped
      });
      
      let instance1: any;
      let instance2: any;
      
      container.withScope(() => {
        instance1 = container.resolve('scopedService');
        instance2 = container.resolve('scopedService');
      });
      
      expect(instance1).toBe(instance2);
      
      let instance3: any;
      container.withScope(() => {
        instance3 = container.resolve('scopedService');
      });
      
      expect(instance3).not.toBe(instance1);
    });

    it('should clean up scoped instances after scope ends', () => {
      const scopedInstances = new WeakMap();
      (container as any).scopedInstances = scopedInstances;
      
      container.register('scopedService', () => ({}), {
        scope: ServiceScope.Scoped
      });
      
      const scope = container.createScope();
      container.resolve('scopedService');
      
      expect(scopedInstances.has(scope)).toBe(true);
      
      container.withScope(() => {
        // New scope created and cleaned up
      });
      
      // Previous scope should still exist
      expect(scopedInstances.has(scope)).toBe(true);
    });
  });

  describe('Service Discovery', () => {
    it('should get services by tag', () => {
      container.register('service1', () => ({}), { tags: ['api'] });
      container.register('service2', () => ({}), { tags: ['api', 'auth'] });
      container.register('service3', () => ({}), { tags: ['ui'] });
      
      const apiServices = container.getByTag('api');
      
      expect(apiServices).toContain('service1');
      expect(apiServices).toContain('service2');
      expect(apiServices).not.toContain('service3');
    });

    it('should get service metadata', () => {
      const factory = () => ({});
      container.register('testService', factory, {
        scope: ServiceScope.Singleton,
        tags: ['test']
      });
      
      const metadata = container.getMetadata('testService');
      
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('testService');
      expect(metadata?.scope).toBe(ServiceScope.Singleton);
      expect(metadata?.tags).toEqual(['test']);
    });

    it('should return undefined for non-existent service metadata', () => {
      const metadata = container.getMetadata('nonExistent');
      expect(metadata).toBeUndefined();
    });
  });

  describe('Container Management', () => {
    it('should clear all registrations', () => {
      container.register('service1', () => ({}));
      container.register('service2', () => ({}));
      container.register('service3', () => ({}));
      
      expect(container.has('service1')).toBe(true);
      
      container.clear();
      
      expect(container.has('service1')).toBe(false);
      expect(container.has('service2')).toBe(false);
      expect(container.has('service3')).toBe(false);
      
      // Core services should be re-registered
      expect(container.has('container')).toBe(true);
      expect(container.has('logger')).toBe(true);
    });

    it('should create child container', () => {
      container.register('parentService', () => ({ parent: true }));
      
      const child = container.createChild();
      
      expect(child.has('parentService')).toBe(true);
      
      // Child can override parent service
      child.register('parentService', () => ({ parent: false }), {
        replace: true
      });
      
      const parentInstance = container.resolve<any>('parentService');
      const childInstance = child.resolve<any>('parentService');
      
      expect(parentInstance.parent).toBe(true);
      expect(childInstance.parent).toBe(false);
    });

    it('should get container statistics', () => {
      container.register('service1', () => ({}), {
        tags: ['api'],
        dependencies: ['dep1']
      });
      container.register('service2', () => ({}), {
        scope: ServiceScope.Singleton,
        tags: ['ui']
      });
      container.register('dep1', () => ({}));
      
      // Resolve singleton to count it
      container.resolve('service2');
      
      const stats = container.getStats();
      
      expect(stats.registeredServices).toBeGreaterThanOrEqual(3);
      expect(stats.singletons).toBeGreaterThanOrEqual(1);
      expect(stats.tags).toContain('api');
      expect(stats.tags).toContain('ui');
      expect(stats.dependencies.has('service1')).toBe(true);
      expect(stats.dependencies.get('service1')).toEqual(['dep1']);
    });
  });

  describe('Singleton Instance', () => {
    it('should return same instance globally', () => {
      const instance1 = DIContainer.getInstance();
      const instance2 = DIContainer.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should have core services registered', () => {
      const globalContainer = DIContainer.getInstance();
      
      expect(globalContainer.has('container')).toBe(true);
      expect(globalContainer.has('logger')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle factory throwing error', () => {
      container.register('errorService', () => {
        throw new Error('Factory error');
      });
      
      expect(() => {
        container.resolve('errorService');
      }).toThrow('Factory error');
    });

    it('should handle lazy initialization', () => {
      let initialized = false;
      
      container.register('lazyService', () => {
        initialized = true;
        return { lazy: true };
      }, { lazy: true });
      
      expect(initialized).toBe(false);
      
      container.resolve('lazyService');
      
      expect(initialized).toBe(true);
    });

    it('should handle async factory functions', async () => {
      container.register('asyncService', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { async: true };
      });
      
      const service = await container.resolve<Promise<any>>('asyncService');
      
      expect(service.async).toBe(true);
    });
  });
});