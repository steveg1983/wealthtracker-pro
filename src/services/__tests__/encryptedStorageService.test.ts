/**
 * EncryptedStorageService Tests
 * Tests for secure storage of sensitive financial data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encryptedStorageService } from '../encryptedStorageService';

// Mock crypto for consistent testing
const mockCrypto = {
  getRandomValues: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    generateKey: vi.fn(),
    exportKey: vi.fn(),
    importKey: vi.fn(),
  },
};

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

describe('EncryptedStorageService', () => {
  let mockDB: any;
  let mockTransaction: any;
  let mockObjectStore: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock successful IndexedDB operations
    mockObjectStore = {
      add: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      getAllKeys: vi.fn().mockResolvedValue([]),
    };

    mockTransaction = {
      objectStore: vi.fn().mockReturnValue(mockObjectStore),
      oncomplete: null,
      onerror: null,
      onabort: null,
    };

    mockDB = {
      transaction: vi.fn().mockReturnValue(mockTransaction),
      close: vi.fn(),
      createObjectStore: vi.fn().mockReturnValue(mockObjectStore),
    };

    // Mock IndexedDB open
    const mockOpenRequest = {
      result: mockDB,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    mockIndexedDB.open.mockReturnValue(mockOpenRequest);
    
    // Mock crypto API
    global.crypto = mockCrypto as any;
    global.indexedDB = mockIndexedDB as any;

    // Mock successful encryption/decryption
    mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
    mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode('{"test": "data"}'));
    mockCrypto.subtle.generateKey.mockResolvedValue({});
    mockCrypto.subtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
    mockCrypto.subtle.importKey.mockResolvedValue({});
  });

  afterEach(() => {
    // Clean up
    encryptedStorageService.destroy();
  });

  describe('Initialization', () => {
    it('initializes successfully', async () => {
      const result = await encryptedStorageService.init();
      expect(result).toBe(true);
      expect(mockIndexedDB.open).toHaveBeenCalledWith('WealthTrackerSecure', expect.any(Number));
    });

    it('handles initialization errors gracefully', async () => {
      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
        };
        setTimeout(() => {
          if (request.onerror) {
            request.onerror(new Error('DB open failed'));
          }
        }, 0);
        return request;
      });

      const result = await encryptedStorageService.init();
      expect(result).toBe(false);
    });

    it('creates object stores on upgrade', async () => {
      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          result: mockDB,
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
        };
        
        setTimeout(() => {
          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: { result: mockDB } });
          }
          if (request.onsuccess) {
            request.onsuccess({ target: { result: mockDB } });
          }
        }, 0);
        
        return request;
      });

      await encryptedStorageService.init();
      
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('accounts', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('transactions', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('budgets', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('goals', { keyPath: 'id' });
    });
  });

  describe('Data Storage and Retrieval', () => {
    beforeEach(async () => {
      await encryptedStorageService.init();
    });

    it('stores encrypted data', async () => {
      const testData = { id: '1', name: 'Test Account', balance: 1000 };
      
      const result = await encryptedStorageService.setItem('accounts', testData.id, testData);
      
      expect(result).toBe(true);
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
      expect(mockObjectStore.put).toHaveBeenCalled();
    });

    it('retrieves and decrypts data', async () => {
      const testData = { id: '1', name: 'Test Account', balance: 1000 };
      
      // Mock encrypted data retrieval
      mockObjectStore.get.mockResolvedValue({
        id: '1',
        data: new ArrayBuffer(32),
        iv: new ArrayBuffer(16),
        timestamp: Date.now(),
      });

      const result = await encryptedStorageService.getItem('accounts', '1');
      
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('returns null for non-existent items', async () => {
      mockObjectStore.get.mockResolvedValue(undefined);
      
      const result = await encryptedStorageService.getItem('accounts', 'non-existent');
      
      expect(result).toBeNull();
    });

    it('handles decryption errors', async () => {
      mockObjectStore.get.mockResolvedValue({
        id: '1',
        data: new ArrayBuffer(32),
        iv: new ArrayBuffer(16),
        timestamp: Date.now(),
      });
      
      mockCrypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));
      
      const result = await encryptedStorageService.getItem('accounts', '1');
      
      expect(result).toBeNull();
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      await encryptedStorageService.init();
    });

    it('stores multiple items', async () => {
      const items = [
        { id: '1', name: 'Account 1' },
        { id: '2', name: 'Account 2' },
        { id: '3', name: 'Account 3' },
      ];
      
      const result = await encryptedStorageService.setItems('accounts', items);
      
      expect(result).toBe(true);
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledTimes(3);
      expect(mockObjectStore.put).toHaveBeenCalledTimes(3);
    });

    it('retrieves all items from a store', async () => {
      const mockEncryptedItems = [
        {
          id: '1',
          data: new ArrayBuffer(32),
          iv: new ArrayBuffer(16),
          timestamp: Date.now(),
        },
        {
          id: '2',
          data: new ArrayBuffer(32),
          iv: new ArrayBuffer(16),
          timestamp: Date.now(),
        },
      ];
      
      mockObjectStore.getAll.mockResolvedValue(mockEncryptedItems);
      
      const result = await encryptedStorageService.getAllItems('accounts');
      
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('handles partial failures in bulk operations', async () => {
      mockCrypto.subtle.encrypt
        .mockResolvedValueOnce(new ArrayBuffer(32))
        .mockRejectedValueOnce(new Error('Encryption failed'))
        .mockResolvedValueOnce(new ArrayBuffer(32));
      
      const items = [
        { id: '1', name: 'Account 1' },
        { id: '2', name: 'Account 2' },
        { id: '3', name: 'Account 3' },
      ];
      
      const result = await encryptedStorageService.setItems('accounts', items);
      
      // Should handle partial failure gracefully
      expect(result).toBe(false);
    });
  });

  describe('Data Migration', () => {
    beforeEach(async () => {
      await encryptedStorageService.init();
    });

    it('migrates data from localStorage', async () => {
      const mockLocalStorageData = JSON.stringify([
        { id: '1', name: 'Account 1' },
        { id: '2', name: 'Account 2' },
      ]);
      
      // Mock localStorage
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(mockLocalStorageData),
        removeItem: vi.fn(),
      };
      global.localStorage = mockLocalStorage as any;
      
      const result = await encryptedStorageService.migrateFromLocalStorage('accounts', 'wealthtracker_accounts');
      
      expect(result).toBe(true);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('wealthtracker_accounts');
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('wealthtracker_accounts');
    });

    it('handles migration of invalid JSON', async () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('invalid json'),
        removeItem: vi.fn(),
      };
      global.localStorage = mockLocalStorage as any;
      
      const result = await encryptedStorageService.migrateFromLocalStorage('accounts', 'wealthtracker_accounts');
      
      expect(result).toBe(false);
    });

    it('handles missing localStorage data', async () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(null),
        removeItem: vi.fn(),
      };
      global.localStorage = mockLocalStorage as any;
      
      const result = await encryptedStorageService.migrateFromLocalStorage('accounts', 'wealthtracker_accounts');
      
      expect(result).toBe(true); // No data to migrate is considered success
    });
  });

  describe('Data Cleanup and Expiration', () => {
    beforeEach(async () => {
      await encryptedStorageService.init();
    });

    it('removes expired data', async () => {
      const expiredTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      const validTimestamp = Date.now() - (6 * 24 * 60 * 60 * 1000); // 6 days ago
      
      const mockItems = [
        {
          id: 'expired',
          data: new ArrayBuffer(32),
          iv: new ArrayBuffer(16),
          timestamp: expiredTimestamp,
        },
        {
          id: 'valid',
          data: new ArrayBuffer(32),
          iv: new ArrayBuffer(16),
          timestamp: validTimestamp,
        },
      ];
      
      mockObjectStore.getAll.mockResolvedValue(mockItems);
      
      await encryptedStorageService.cleanupExpiredData();
      
      expect(mockObjectStore.delete).toHaveBeenCalledWith('expired');
      expect(mockObjectStore.delete).not.toHaveBeenCalledWith('valid');
    });

    it('clears all data from a store', async () => {
      const result = await encryptedStorageService.clear('accounts');
      
      expect(result).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });

    it('removes specific items', async () => {
      const result = await encryptedStorageService.removeItem('accounts', '1');
      
      expect(result).toBe(true);
      expect(mockObjectStore.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('Key Management', () => {
    it('generates new encryption key', async () => {
      await encryptedStorageService.init();
      
      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
    });

    it('rotates encryption key', async () => {
      await encryptedStorageService.init();
      
      // Add some data first
      await encryptedStorageService.setItem('accounts', '1', { id: '1', name: 'Test' });
      
      // Mock existing data for re-encryption
      mockObjectStore.getAll.mockResolvedValue([
        {
          id: '1',
          data: new ArrayBuffer(32),
          iv: new ArrayBuffer(16),
          timestamp: Date.now(),
        },
      ]);
      
      const result = await encryptedStorageService.rotateEncryptionKey();
      
      expect(result).toBe(true);
      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledTimes(2); // Once for init, once for rotation
    });
  });

  describe('Performance and Memory Management', () => {
    beforeEach(async () => {
      await encryptedStorageService.init();
    });

    it('handles large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        data: `Large data item ${i}`.repeat(100),
      }));
      
      const startTime = performance.now();
      
      const result = await encryptedStorageService.setItems('accounts', largeDataset);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(result).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('manages memory during bulk operations', async () => {
      const batchSize = 100;
      const totalItems = 500;
      
      const items = Array.from({ length: totalItems }, (_, i) => ({
        id: `item-${i}`,
        data: 'test data',
      }));
      
      // Should process in batches to avoid memory issues
      const result = await encryptedStorageService.setItemsInBatches('accounts', items, batchSize);
      
      expect(result).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledTimes(totalItems);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles database connection errors', async () => {
      mockDB.transaction.mockImplementation(() => {
        throw new Error('Database connection lost');
      });
      
      await encryptedStorageService.init();
      
      const result = await encryptedStorageService.getItem('accounts', '1');
      
      expect(result).toBeNull();
    });

    it('handles encryption key corruption', async () => {
      await encryptedStorageService.init();
      
      // Simulate key corruption by making generateKey fail
      mockCrypto.subtle.generateKey.mockRejectedValue(new Error('Key generation failed'));
      
      const result = await encryptedStorageService.rotateEncryptionKey();
      
      expect(result).toBe(false);
    });

    it('recovers from transaction failures', async () => {
      await encryptedStorageService.init();
      
      // Mock transaction failure
      mockObjectStore.put.mockRejectedValue(new Error('Transaction failed'));
      
      const result = await encryptedStorageService.setItem('accounts', '1', { id: '1', name: 'Test' });
      
      expect(result).toBe(false);
    });

    it('maintains data integrity during failures', async () => {
      await encryptedStorageService.init();
      
      // Mock partial failure during bulk operation
      mockObjectStore.put
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Transaction failed'))
        .mockResolvedValueOnce(undefined);
      
      const items = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' },
      ];
      
      const result = await encryptedStorageService.setItems('accounts', items);
      
      expect(result).toBe(false);
      // Should ensure data consistency - either all succeed or all fail
    });
  });

  describe('Security Features', () => {
    it('uses unique IV for each encryption', async () => {
      await encryptedStorageService.init();
      
      await encryptedStorageService.setItem('accounts', '1', { id: '1', name: 'Test 1' });
      await encryptedStorageService.setItem('accounts', '2', { id: '2', name: 'Test 2' });
      
      // Should generate unique IV for each encryption
      expect(mockCrypto.getRandomValues).toHaveBeenCalledTimes(2);
    });

    it('validates data integrity', async () => {
      await encryptedStorageService.init();
      
      // Mock corrupted data
      mockObjectStore.get.mockResolvedValue({
        id: '1',
        data: new ArrayBuffer(32),
        iv: new ArrayBuffer(16),
        timestamp: Date.now(),
      });
      
      // Mock decryption returning invalid JSON
      mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode('invalid json'));
      
      const result = await encryptedStorageService.getItem('accounts', '1');
      
      expect(result).toBeNull(); // Should return null for corrupted data
    });

    it('protects against timing attacks', async () => {
      await encryptedStorageService.init();
      
      const startTime = performance.now();
      await encryptedStorageService.getItem('accounts', 'existing-key');
      const existingKeyTime = performance.now() - startTime;
      
      const startTime2 = performance.now();
      await encryptedStorageService.getItem('accounts', 'non-existent-key');
      const nonExistentKeyTime = performance.now() - startTime2;
      
      // Times should be similar to prevent timing attacks
      const timeDifference = Math.abs(existingKeyTime - nonExistentKeyTime);
      expect(timeDifference).toBeLessThan(50); // Within 50ms
    });
  });
});