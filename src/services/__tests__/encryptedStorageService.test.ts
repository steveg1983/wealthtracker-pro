/**
 * Encrypted Storage Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EncryptedStorageService } from '../encryptedStorageService';
import { indexedDBService } from '../indexedDBService';

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

const createStorageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    dump: () => store
  };
};

describe('EncryptedStorageService', () => {
  let service: EncryptedStorageService;
  let sessionStorageMock: ReturnType<typeof createStorageMock>;
  let localStorageMock: ReturnType<typeof createStorageMock>;
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  const now = Date.now();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock = createStorageMock();
    localStorageMock = createStorageMock();
    logger = { error: vi.fn(), warn: vi.fn() };

    service = new EncryptedStorageService({
      sessionStorage: sessionStorageMock,
      localStorage: localStorageMock,
      logger,
      now: () => now
    });
  });

  describe('Basic Operations', () => {
    it('encrypts and stores data', async () => {
      const testData = { account: '12345', balance: 1000 };

      await service.setItem('test-key', testData);

      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        expect.objectContaining({
          key: 'test-key',
          data: expect.any(String),
          timestamp: now,
          encrypted: true,
          compressed: false
        })
      );
    });

    it('retrieves and decrypts data', async () => {
      const testData = { account: '12345', balance: 1000 };
      await service.setItem('test-key', testData);

      const storedCall = vi.mocked(indexedDBService.put).mock.calls[0];
      const encryptedData = storedCall[1];
      vi.mocked(indexedDBService.get).mockResolvedValueOnce(encryptedData);

      const retrieved = await service.getItem('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('handles non-encrypted storage', async () => {
      const testData = { preference: 'dark-mode' };

      await service.setItem('preference', testData, { encrypted: false });

      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        expect.objectContaining({
          key: 'preference',
          data: testData,
          encrypted: false
        })
      );
    });

    it('compresses large data', async () => {
      const largeData = { content: 'x'.repeat(15000) };

      await service.setItem('large-data', largeData, {
        encrypted: false,
        compress: true
      });

      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        expect.objectContaining({
          key: 'large-data',
          compressed: true
        })
      );
    });

    it('handles expiry dates', async () => {
      const testData = { temp: 'data' };
      const expiryDays = 7;

      await service.setItem('temp-key', testData, { expiryDays });

      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        expect.objectContaining({
          key: 'temp-key',
          expiry: now + expiryDays * 24 * 60 * 60 * 1000
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

      await service.setItems(items);

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
      localStorageMock.setItem('test-key-1', JSON.stringify({ old: 'data1' }));
      localStorageMock.setItem('test-key-2', JSON.stringify({ old: 'data2' }));

      await service.migrateFromLocalStorage(['test-key-1', 'test-key-2']);

      expect(indexedDBService.putBulk).toHaveBeenCalled();
      expect(localStorageMock.getItem('test-key-1')).toBeNull();
      expect(localStorageMock.getItem('test-key-2')).toBeNull();
    });

    it('handles invalid localStorage data during migration', async () => {
      localStorageMock.setItem('invalid-key', 'not-json');

      await service.migrateFromLocalStorage(['invalid-key']);

      expect(indexedDBService.putBulk).toHaveBeenCalled();
      expect(localStorageMock.getItem('invalid-key')).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('removes expired data', async () => {
      const expiredData = {
        data: 'old',
        timestamp: now - 1000,
        expiry: now - 500,
        encrypted: false
      };

      const validData = {
        data: 'new',
        timestamp: now,
        expiry: now + 10000,
        encrypted: false
      };

      vi.mocked(indexedDBService.getAllKeys).mockResolvedValueOnce(['expired', 'valid']);
      vi.mocked(indexedDBService.get)
        .mockResolvedValueOnce(expiredData)
        .mockResolvedValueOnce(validData);

      await service.cleanupExpiredData();

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
        .mockResolvedValueOnce({
          data: mockData.key1,
          encrypted: false,
          compressed: false,
          timestamp: now
        })
        .mockResolvedValueOnce({
          data: mockData.key2,
          encrypted: false,
          compressed: false,
          timestamp: now
        });

      const exported = await service.exportData();
      expect(exported).toEqual(mockData);
    });

    it('imports data', async () => {
      const importData = {
        key1: { value: 'data1' },
        key2: { value: 'data2' }
      };

      await service.importData(importData);
      expect(indexedDBService.putBulk).toHaveBeenCalled();
    });
  });

  describe('Storage info', () => {
    it('returns zero usage when navigator storage unavailable', async () => {
      const info = await service.getStorageInfo();
      expect(info).toEqual({ usage: 0, quota: 0, percentUsed: 0 });
    });
  });
});
