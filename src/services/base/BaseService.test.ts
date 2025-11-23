/**
 * BaseService Tests
 * Comprehensive tests for the base service class
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseService } from './BaseService';
import { storageAdapter } from '../storageAdapter';

// Mock storageAdapter
vi.mock('../storageAdapter', () => ({
  storageAdapter: {
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  }
}));

const mockScopedLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../loggers/scopedLogger', () => ({
  createScopedLogger: vi.fn(() => mockScopedLogger),
}));

// Create a concrete implementation for testing
class TestService extends BaseService {
  constructor() {
    super('TestService');
  }

  // Expose protected methods for testing
  async testSaveToStorage<T>(key: string, data: T): Promise<void> {
    return this.saveToStorage(key, data);
  }

  async testLoadFromStorage<T>(key: string, defaultValue: T): Promise<T> {
    return this.loadFromStorage(key, defaultValue);
  }

  async testClearStorage(key: string): Promise<void> {
    return this.clearStorage(key);
  }

  testLog(message: string, data?: any): void {
    return this.log(message, data);
  }

  testHandleError(operation: string, error: unknown): void {
    return this.handleError(operation, error);
  }
}

describe('BaseService', () => {
  let service: TestService;
  const mockStorageAdapter = storageAdapter as any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('sets service name correctly', () => {
      expect((service as any).serviceName).toBe('TestService');
    });

    it('allows different service names', () => {
      class AnotherService extends BaseService {
        constructor() {
          super('AnotherService');
        }
      }
      
      const anotherService = new AnotherService();
      expect((anotherService as any).serviceName).toBe('AnotherService');
    });
  });

  describe('saveToStorage', () => {
    it('saves data with service-prefixed key', async () => {
      const testData = { foo: 'bar', count: 42 };
      
      await service.testSaveToStorage('settings', testData);
      
      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        'TestService_settings',
        testData
      );
    });

    it('handles different data types', async () => {
      await service.testSaveToStorage('string', 'test string');
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('TestService_string', 'test string');
      
      await service.testSaveToStorage('number', 123);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('TestService_number', 123);
      
      await service.testSaveToStorage('boolean', true);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('TestService_boolean', true);
      
      await service.testSaveToStorage('array', [1, 2, 3]);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('TestService_array', [1, 2, 3]);
    });

    it('handles null and undefined values', async () => {
      await service.testSaveToStorage('nullValue', null);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('TestService_nullValue', null);
      
      await service.testSaveToStorage('undefinedValue', undefined);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('TestService_undefinedValue', undefined);
    });
  });

  describe('loadFromStorage', () => {
    it('loads data with service-prefixed key', async () => {
      const storedData = { foo: 'bar', count: 42 };
      mockStorageAdapter.get.mockResolvedValue(storedData);
      
      const result = await service.testLoadFromStorage('settings', {});
      
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('TestService_settings');
      expect(result).toEqual(storedData);
    });

    it('returns default value when no data exists', async () => {
      mockStorageAdapter.get.mockResolvedValue(null);
      
      const defaultValue = { defaultKey: 'defaultValue' };
      const result = await service.testLoadFromStorage('nonexistent', defaultValue);
      
      expect(result).toEqual(defaultValue);
    });

    it('returns default value when undefined is stored', async () => {
      mockStorageAdapter.get.mockResolvedValue(undefined);
      
      const defaultValue = { defaultKey: 'defaultValue' };
      const result = await service.testLoadFromStorage('undefinedKey', defaultValue);
      
      expect(result).toEqual(defaultValue);
    });

    it('preserves falsy values that are not null/undefined', async () => {
      mockStorageAdapter.get.mockResolvedValue(0);
      const result = await service.testLoadFromStorage('zero', 10);
      expect(result).toBe(0);
      
      mockStorageAdapter.get.mockResolvedValue('');
      const stringResult = await service.testLoadFromStorage('emptyString', 'default');
      expect(stringResult).toBe('');
      
      mockStorageAdapter.get.mockResolvedValue(false);
      const boolResult = await service.testLoadFromStorage('falseBool', true);
      expect(boolResult).toBe(false);
    });
  });

  describe('clearStorage', () => {
    it('removes data with service-prefixed key', async () => {
      await service.testClearStorage('settings');
      
      expect(mockStorageAdapter.remove).toHaveBeenCalledWith('TestService_settings');
    });

    it('handles multiple clear operations', async () => {
      await service.testClearStorage('key1');
      await service.testClearStorage('key2');
      await service.testClearStorage('key3');
      
      expect(mockStorageAdapter.remove).toHaveBeenCalledTimes(3);
      expect(mockStorageAdapter.remove).toHaveBeenNthCalledWith(1, 'TestService_key1');
      expect(mockStorageAdapter.remove).toHaveBeenNthCalledWith(2, 'TestService_key2');
      expect(mockStorageAdapter.remove).toHaveBeenNthCalledWith(3, 'TestService_key3');
    });
  });

  describe('log', () => {
    it('delegates to scoped logger without additional data', () => {
      service.testLog('Test message');
      expect(mockScopedLogger.info).toHaveBeenCalledWith('Test message', undefined);
    });

    it('passes structured data to scoped logger', () => {
      const data = { key: 'value', number: 123 };
      service.testLog('Test message with data', data);
      expect(mockScopedLogger.info).toHaveBeenCalledWith('Test message with data', data);
    });

    it('handles optional data parameter gracefully', () => {
      service.testLog('Message without data');
      expect(mockScopedLogger.info).toHaveBeenCalledWith('Message without data', undefined);
    });
  });

  describe('handleError', () => {
    it('logs errors with operation context', () => {
      const error = new Error('Test error');
      service.testHandleError('saveData', error);
      expect(mockScopedLogger.error).toHaveBeenCalledWith('Error in saveData', error);
    });

    it('handles string errors', () => {
      service.testHandleError('loadData', 'String error message');
      expect(mockScopedLogger.error).toHaveBeenCalledWith('Error in loadData', 'String error message');
    });

    it('handles object errors', () => {
      const errorObj = { code: 'ERR_001', message: 'Custom error object' };
      service.testHandleError('processData', errorObj);
      expect(mockScopedLogger.error).toHaveBeenCalledWith('Error in processData', errorObj);
    });

    it('handles null and undefined errors', () => {
      service.testHandleError('operation1', null);
      expect(mockScopedLogger.error).toHaveBeenCalledWith('Error in operation1', null);

      service.testHandleError('operation2', undefined);
      expect(mockScopedLogger.error).toHaveBeenCalledWith('Error in operation2', undefined);
    });
  });

  describe('integration scenarios', () => {
    it('supports save and load workflow', async () => {
      const testData = { users: ['user1', 'user2'], count: 2 };
      mockStorageAdapter.get.mockResolvedValue(testData);
      
      // Save data
      await service.testSaveToStorage('userList', testData);
      
      // Load data
      const loaded = await service.testLoadFromStorage('userList', { users: [], count: 0 });
      
      expect(loaded).toEqual(testData);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('TestService_userList', testData);
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('TestService_userList');
    });

    it('supports clear and load workflow', async () => {
      mockStorageAdapter.get.mockResolvedValue(null);
      
      // Clear data
      await service.testClearStorage('settings');
      
      // Load should return default
      const defaultSettings = { theme: 'dark', notifications: true };
      const loaded = await service.testLoadFromStorage('settings', defaultSettings);
      
      expect(loaded).toEqual(defaultSettings);
      expect(mockStorageAdapter.remove).toHaveBeenCalledWith('TestService_settings');
    });
  });

  describe('inheritance', () => {
    it('allows multiple services to extend BaseService independently', () => {
      class ServiceA extends BaseService {
        constructor() {
          super('ServiceA');
        }
      }
      
      class ServiceB extends BaseService {
        constructor() {
          super('ServiceB');
        }
      }
      
      const serviceA = new ServiceA();
      const serviceB = new ServiceB();
      
      expect((serviceA as any).serviceName).toBe('ServiceA');
      expect((serviceB as any).serviceName).toBe('ServiceB');
    });

    it('maintains separate storage namespaces for different services', async () => {
      class UserService extends BaseService {
        constructor() {
          super('UserService');
        }
        
        async saveUser(user: any) {
          return this.saveToStorage('currentUser', user);
        }
      }
      
      class ConfigService extends BaseService {
        constructor() {
          super('ConfigService');
        }
        
        async saveConfig(config: any) {
          return this.saveToStorage('currentUser', config);
        }
      }
      
      const userService = new UserService();
      const configService = new ConfigService();
      
      const user = { id: 1, name: 'John' };
      const config = { theme: 'dark' };
      
      await userService.saveUser(user);
      await configService.saveConfig(config);
      
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('UserService_currentUser', user);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith('ConfigService_currentUser', config);
    });
  });
});
