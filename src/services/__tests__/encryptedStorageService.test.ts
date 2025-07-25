/**
 * Encrypted Storage Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encryptedStorage } from '../encryptedStorageService';
import { indexedDBService } from '../indexedDBService';

// Mock IndexedDB service
vi.mock('../indexedDBService', () => ({
  indexedDBService: {
    init: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    clearStore: vi.fn(),
    getAllKeys: vi.fn(() => Promise.resolve([])),
    putBulk: vi.fn(),
    cleanCache: vi.fn()
  }
}));

describe('EncryptedStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('Basic Operations', () => {
    it('encrypts and stores data', async () => {
      const testData = { account: '12345', balance: 1000 };
      
      await encryptedStorage.setItem('test-key', testData);
      
      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        'test-key',
        expect.objectContaining({
          data: expect.any(String), // Encrypted string
          timestamp: expect.any(Number),
          encrypted: true,
          compressed: false
        })
      );
    });

    it('retrieves and decrypts data', async () => {
      const testData = { account: '12345', balance: 1000 };
      
      // First store the data
      await encryptedStorage.setItem('test-key', testData);
      
      // Get the encrypted data that was stored
      const storedCall = vi.mocked(indexedDBService.put).mock.calls[0];
      const encryptedData = storedCall[2];
      
      // Mock the retrieval
      vi.mocked(indexedDBService.get).mockResolvedValueOnce(encryptedData);
      
      // Retrieve the data
      const retrieved = await encryptedStorage.getItem('test-key');
      
      expect(retrieved).toEqual(testData);
    });

    it('handles non-encrypted storage', async () => {
      const testData = { preference: 'dark-mode' };
      
      await encryptedStorage.setItem('preference', testData, { encrypted: false });
      
      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        'preference',
        expect.objectContaining({
          data: testData,
          encrypted: false
        })
      );
    });

    it('compresses large data', async () => {
      const largeData = { 
        content: 'x'.repeat(15000) // Large string to trigger compression
      };
      
      await encryptedStorage.setItem('large-data', largeData, { 
        encrypted: false,
        compress: true 
      });
      
      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        'large-data',
        expect.objectContaining({
          compressed: true
        })
      );
    });

    it('handles expiry dates', async () => {
      const testData = { temp: 'data' };
      const expiryDays = 7;
      
      await encryptedStorage.setItem('temp-key', testData, { expiryDays });
      
      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        'temp-key',
        expect.objectContaining({
          expiry: expect.any(Number)
        })
      );
    });
  });

  describe('Bulk Operations', () => {
    it('stores multiple items efficiently', async () => {
      const items = [
        { key: 'item1', value: { data: 'value1' } },
        { key: 'item2', value: { data: 'value2' } },
        { key: 'item3', value: { data: 'value3' } }
      ];
      
      await encryptedStorage.setItems(items);
      
      expect(indexedDBService.putBulk).toHaveBeenCalledWith(
        'secureData',
        expect.arrayContaining([
          expect.objectContaining({ key: 'item1' }),
          expect.objectContaining({ key: 'item2' }),
          expect.objectContaining({ key: 'item3' })
        ])
      );
    });
  });

  describe('Migration', () => {
    it('migrates data from localStorage', async () => {
      // Set up localStorage data
      localStorage.setItem('test-key-1', JSON.stringify({ old: 'data1' }));
      localStorage.setItem('test-key-2', JSON.stringify({ old: 'data2' }));
      
      await encryptedStorage.migrateFromLocalStorage(['test-key-1', 'test-key-2']);
      
      expect(indexedDBService.putBulk).toHaveBeenCalled();
      expect(localStorage.getItem('test-key-1')).toBeNull();
      expect(localStorage.getItem('test-key-2')).toBeNull();
    });

    it('handles invalid localStorage data during migration', async () => {
      // Set invalid JSON in localStorage
      localStorage.setItem('invalid-key', 'not-json');
      
      await encryptedStorage.migrateFromLocalStorage(['invalid-key']);
      
      // Should not throw, but also shouldn't migrate invalid data
      expect(localStorage.getItem('invalid-key')).toBe('not-json');
    });
  });

  describe('Cleanup', () => {
    it('removes expired data', async () => {
      const expiredData = {
        data: 'old',
        timestamp: Date.now() - 1000,
        expiry: Date.now() - 500, // Expired
        encrypted: false
      };
      
      const validData = {
        data: 'new',
        timestamp: Date.now(),
        expiry: Date.now() + 10000, // Not expired
        encrypted: false
      };
      
      vi.mocked(indexedDBService.getAllKeys).mockResolvedValueOnce(['expired', 'valid']);
      vi.mocked(indexedDBService.get)
        .mockResolvedValueOnce(expiredData)
        .mockResolvedValueOnce(validData);
      
      await encryptedStorage.cleanupExpiredData();
      
      expect(indexedDBService.delete).toHaveBeenCalledWith('secureData', 'expired');
      expect(indexedDBService.delete).not.toHaveBeenCalledWith('secureData', 'valid');
    });
  });

  describe('Export/Import', () => {
    it('exports all data', async () => {
      const mockData = {
        key1: { value: 'data1' },
        key2: { value: 'data2' }
      };
      
      vi.mocked(indexedDBService.getAllKeys).mockResolvedValueOnce(['key1', 'key2']);
      vi.mocked(indexedDBService.get)
        .mockResolvedValueOnce({ data: mockData.key1, encrypted: false, timestamp: Date.now() })
        .mockResolvedValueOnce({ data: mockData.key2, encrypted: false, timestamp: Date.now() });
      
      const exported = await encryptedStorage.exportData();
      
      expect(exported).toEqual(mockData);
    });

    it('imports data', async () => {
      const importData = {
        key1: { value: 'data1' },
        key2: { value: 'data2' }
      };
      
      await encryptedStorage.importData(importData);
      
      expect(indexedDBService.putBulk).toHaveBeenCalledWith(
        'secureData',
        expect.arrayContaining([
          expect.objectContaining({ key: 'key1' }),
          expect.objectContaining({ key: 'key2' })
        ])
      );
    });
  });

  describe('Storage Info', () => {
    it('returns storage estimates when available', async () => {
      // Mock navigator.storage.estimate
      const mockEstimate = {
        usage: 1000000,
        quota: 10000000
      };
      
      global.navigator = {
        ...global.navigator,
        storage: {
          estimate: vi.fn().mockResolvedValue(mockEstimate)
        }
      } as any;
      
      const info = await encryptedStorage.getStorageInfo();
      
      expect(info).toEqual({
        usage: 1000000,
        quota: 10000000,
        percentUsed: 10
      });
    });

    it('returns default values when storage API not available', async () => {
      global.navigator = {} as any;
      
      const info = await encryptedStorage.getStorageInfo();
      
      expect(info).toEqual({
        usage: 0,
        quota: 0,
        percentUsed: 0
      });
    });
  });
});