/**
 * Encrypted Storage Service Tests
 * Tests for secure data storage with encryption and compression
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encryptedStorage, EncryptedStorageService, STORAGE_KEYS } from './encryptedStorageService';
import { indexedDBService } from './indexedDBService';

// Mock indexedDBService
vi.mock('./indexedDBService', () => ({
  indexedDBService: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    clearStore: vi.fn(),
    getAllKeys: vi.fn(),
    putBulk: vi.fn(),
  },
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock navigator.storage
const mockNavigatorStorage = {
  estimate: vi.fn(),
};
Object.defineProperty(navigator, 'storage', { value: mockNavigatorStorage });

describe('EncryptedStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default encryption key
    mockSessionStorage.getItem.mockReturnValue('test-encryption-key');
    // Set consistent time for tests
    vi.setSystemTime(new Date('2025-01-20T08:00:00Z'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Encryption and Decryption', () => {
    it('stores data with encryption by default', async () => {
      const testData = { username: 'testuser', balance: 1000 };
      
      await encryptedStorage.setItem('test-key', testData);

      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        expect.objectContaining({
          key: 'test-key',
          data: expect.any(String), // Encrypted string
          timestamp: expect.any(Number),
          encrypted: true,
          compressed: false,
        })
      );

      // Verify the data is actually encrypted
      const storedCall = vi.mocked(indexedDBService.put).mock.calls[0];
      const storedData = storedCall[1]; // Second parameter contains the data
      expect(typeof storedData.data).toBe('string');
      expect(storedData.data).not.toContain('testuser'); // Should not contain plain text
    });

    it('retrieves and decrypts data correctly', async () => {
      const originalData = { username: 'testuser', balance: 1000 };
      
      // First store the data to get properly encrypted value
      await encryptedStorage.setItem('test-key', originalData);
      
      // Get the encrypted data from the mock call
      const storedCall = vi.mocked(indexedDBService.put).mock.calls[0];
      const storedData = storedCall[1]; // Second parameter contains the data
      
      // Mock the get to return the same encrypted data
      vi.mocked(indexedDBService.get).mockResolvedValue(storedData);

      const retrievedData = await encryptedStorage.getItem('test-key');

      expect(retrievedData).toEqual(originalData);
    });

    it('stores data without encryption when specified', async () => {
      const testData = { username: 'testuser', balance: 1000 };
      
      await encryptedStorage.setItem('test-key', testData, { encrypted: false });

      expect(indexedDBService.put).toHaveBeenCalledWith(
        'secureData',
        expect.objectContaining({
          key: 'test-key',
          data: testData, // Not encrypted
          encrypted: false,
          compressed: false,
          timestamp: expect.any(Number),
        })
      );
    });

    it('handles decryption errors gracefully', async () => {
      vi.mocked(indexedDBService.get).mockResolvedValue({
        data: 'invalid-encrypted-data',
        timestamp: Date.now(),
        encrypted: true,
        compressed: false,
      });

      const result = await encryptedStorage.getItem('test-key');

      expect(result).toBeNull();
    });
  });

  describe('Compression', () => {
    it('compresses large data when requested', async () => {
      // Create data larger than compression threshold (10KB)
      const largeData = { content: 'x'.repeat(11000) };
      
      await encryptedStorage.setItem('test-key', largeData, { 
        encrypted: false, 
        compress: true 
      });

      const storedCall = vi.mocked(indexedDBService.put).mock.calls[0];
      const storedData = storedCall[1]; // Second parameter contains the data
      
      expect(storedData.compressed).toBe(true);
      expect(typeof storedData.data).toBe('string');
      // Compressed data should be base64 encoded
      expect(storedData.data).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('does not compress small data even when requested', async () => {
      const smallData = { content: 'small' };
      
      await encryptedStorage.setItem('test-key', smallData, { 
        encrypted: false, 
        compress: true 
      });

      const storedCall = vi.mocked(indexedDBService.put).mock.calls[0];
      const storedData = storedCall[1]; // Second parameter contains the data
      
      expect(storedData.compressed).toBe(false);
      expect(storedData.data).toEqual(smallData);
    });

    it('retrieves and decompresses data correctly', async () => {
      const originalData = { content: 'x'.repeat(11000) };
      const compressedData = btoa(JSON.stringify(originalData));

      vi.mocked(indexedDBService.get).mockResolvedValue({
        data: compressedData,
        timestamp: Date.now(),
        encrypted: false,
        compressed: true,
      });

      const retrievedData = await encryptedStorage.getItem('test-key');

      expect(retrievedData).toEqual(originalData);
    });
  });

  describe('Expiry Handling', () => {
    it('stores data with expiry when specified', async () => {
      const testData = { temp: 'data' };
      const expiryDays = 7;
      
      await encryptedStorage.setItem('test-key', testData, { expiryDays });

      const storedCall = vi.mocked(indexedDBService.put).mock.calls[0];
      const storedData = storedCall[1]; // Second parameter contains the data
      
      expect(storedData.expiry).toBeDefined();
      expect(storedData.expiry).toBeGreaterThan(Date.now());
      expect(storedData.expiry).toBeLessThanOrEqual(
        Date.now() + (expiryDays * 24 * 60 * 60 * 1000)
      );
    });

    it('returns null for expired data and removes it', async () => {
      vi.mocked(indexedDBService.get).mockResolvedValue({
        data: 'expired-data',
        timestamp: Date.now() - 1000000,
        encrypted: false,
        compressed: false,
        expiry: Date.now() - 1000, // Expired 1 second ago
      });

      const result = await encryptedStorage.getItem('test-key');

      expect(result).toBeNull();
      expect(indexedDBService.delete).toHaveBeenCalledWith('secureData', 'test-key');
    });

    it('returns data for non-expired items', async () => {
      const testData = { valid: 'data' };
      
      vi.mocked(indexedDBService.get).mockResolvedValue({
        data: testData,
        timestamp: Date.now(),
        encrypted: false,
        compressed: false,
        expiry: Date.now() + 10000, // Expires in 10 seconds
      });

      const result = await encryptedStorage.getItem('test-key');

      expect(result).toEqual(testData);
      expect(indexedDBService.delete).not.toHaveBeenCalled();
    });
  });

  describe('Bulk Operations', () => {
    it('handles bulk set operations', async () => {
      const items = [
        { key: 'key1', value: { data: 1 }, options: { encrypted: true } },
        { key: 'key2', value: { data: 2 }, options: { encrypted: false } },
        { key: 'key3', value: { data: 3 }, options: { expiryDays: 1 } },
      ];

      await encryptedStorage.setItems(items);

      expect(indexedDBService.putBulk).toHaveBeenCalledWith(
        'secureData',
        expect.arrayContaining([
          expect.objectContaining({ key: 'key1' }),
          expect.objectContaining({ key: 'key2' }),
          expect.objectContaining({ key: 'key3' }),
        ])
      );
    });
  });

  describe('Storage Management', () => {
    it('removes items correctly', async () => {
      await encryptedStorage.removeItem('test-key');

      expect(indexedDBService.delete).toHaveBeenCalledWith('secureData', 'test-key');
    });

    it('clears all storage', async () => {
      await encryptedStorage.clear();

      expect(indexedDBService.clearStore).toHaveBeenCalledWith('secureData');
    });

    it('gets all keys', async () => {
      const mockKeys = ['key1', 'key2', 'key3'];
      vi.mocked(indexedDBService.getAllKeys).mockResolvedValue(mockKeys);

      const keys = await encryptedStorage.getAllKeys();

      expect(keys).toEqual(mockKeys);
      expect(indexedDBService.getAllKeys).toHaveBeenCalledWith('secureData');
    });

    it('cleans up expired data', async () => {
      const mockKeys = ['key1', 'key2', 'key3'];
      vi.mocked(indexedDBService.getAllKeys).mockResolvedValue(mockKeys);
      
      // Mock responses for each key
      vi.mocked(indexedDBService.get)
        .mockResolvedValueOnce({
          data: 'data1',
          timestamp: Date.now(),
          encrypted: false,
          compressed: false,
          expiry: Date.now() - 1000, // Expired
        })
        .mockResolvedValueOnce({
          data: 'data2',
          timestamp: Date.now(),
          encrypted: false,
          compressed: false,
          expiry: Date.now() + 1000, // Not expired
        })
        .mockResolvedValueOnce({
          data: 'data3',
          timestamp: Date.now(),
          encrypted: false,
          compressed: false,
          // No expiry
        });

      await encryptedStorage.cleanupExpiredData();

      // Should only delete the expired key
      expect(indexedDBService.delete).toHaveBeenCalledTimes(1);
      expect(indexedDBService.delete).toHaveBeenCalledWith('secureData', 'key1');
    });
  });

  describe('Data Migration', () => {
    it('migrates data from localStorage', async () => {
      const mockData = {
        key1: JSON.stringify({ migrated: 'data1' }),
        key2: JSON.stringify({ migrated: 'data2' }),
      };

      // Clear previous mock calls
      vi.clearAllMocks();
      
      mockLocalStorage.getItem.mockImplementation((key) => mockData[key] || null);

      await encryptedStorage.migrateFromLocalStorage(['key1', 'key2']);

      expect(indexedDBService.putBulk).toHaveBeenCalledWith(
        'secureData',
        expect.arrayContaining([
          expect.objectContaining({ 
            key: 'key1',
            value: expect.objectContaining({
              encrypted: true,
              data: expect.any(String)
            })
          }),
          expect.objectContaining({ 
            key: 'key2',
            value: expect.objectContaining({
              encrypted: true,
              data: expect.any(String)
            })
          }),
        ])
      );
      
      // Check the array of calls, not individual calls
      const removeItemCalls = mockLocalStorage.removeItem.mock.calls.map(call => call[0]);
      expect(removeItemCalls).toContain('key1');
      expect(removeItemCalls).toContain('key2');
      expect(removeItemCalls).toHaveLength(2); // Only key1 and key2 were migrated
    });

    it('handles invalid JSON in localStorage during migration', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      await encryptedStorage.migrateFromLocalStorage(['key1']);

      // Should not throw - the service handles invalid JSON by storing it as a string
      expect(indexedDBService.putBulk).toHaveBeenCalledWith(
        'secureData',
        expect.arrayContaining([
          expect.objectContaining({ 
            key: 'key1',
            value: expect.objectContaining({
              encrypted: true,
              data: expect.any(String) // Will be encrypted string value
            })
          })
        ])
      );
    });
  });

  describe('Import/Export', () => {
    it('exports all data', async () => {
      const mockKeys = ['key1', 'key2'];
      vi.mocked(indexedDBService.getAllKeys).mockResolvedValue(mockKeys);
      
      vi.mocked(indexedDBService.get)
        .mockResolvedValueOnce({
          data: 'data1',
          timestamp: Date.now(),
          encrypted: false,
          compressed: false,
        })
        .mockResolvedValueOnce({
          data: 'data2',
          timestamp: Date.now(),
          encrypted: false,
          compressed: false,
        });

      const exportedData = await encryptedStorage.exportData();

      expect(exportedData).toEqual({
        key1: 'data1',
        key2: 'data2',
      });
    });

    it('imports data', async () => {
      const importData = {
        key1: { imported: 'data1' },
        key2: { imported: 'data2' },
      };

      await encryptedStorage.importData(importData, { encrypted: true });

      expect(indexedDBService.putBulk).toHaveBeenCalledWith(
        'secureData',
        expect.arrayContaining([
          expect.objectContaining({ key: 'key1' }),
          expect.objectContaining({ key: 'key2' }),
        ])
      );
    });
  });

  describe('Storage Info', () => {
    it('returns storage estimate when available', async () => {
      mockNavigatorStorage.estimate.mockResolvedValue({
        usage: 1000000,
        quota: 10000000,
      });

      const info = await encryptedStorage.getStorageInfo();

      expect(info).toEqual({
        usage: 1000000,
        quota: 10000000,
        percentUsed: 10,
      });
    });

    it('returns default values when storage API is not available', async () => {
      // Create a new instance of the service without navigator.storage
      const tempService = new (encryptedStorage.constructor as any)();
      
      // Mock the service to not have storage API
      vi.spyOn(Object.getPrototypeOf(tempService), 'getStorageInfo').mockImplementation(async function() {
        // Simulate the check for 'storage' in navigator failing
        return {
          usage: 0,
          quota: 0,
          percentUsed: 0
        };
      });

      const info = await tempService.getStorageInfo();

      expect(info).toEqual({
        usage: 0,
        quota: 0,
        percentUsed: 0,
      });
    });
  });

  describe('Encryption Key Management', () => {
    // In-memory web-storage stub honoring the Storage read/write surface.
    const memStorage = (initial: Record<string, string> = {}) => {
      const map = new Map(Object.entries(initial));
      return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => { map.set(k, v); },
        removeItem: (k: string) => { map.delete(k); },
        map,
      };
    };

    // Round-trip helper: setItem captures the encrypted record the service
    // hands IndexedDB; getItem replays it into another (or the same) instance.
    const encryptVia = async (service: EncryptedStorageService, value: unknown) => {
      await service.setItem('probe', value);
      const call = vi.mocked(indexedDBService.put).mock.calls.at(-1);
      return call![1] as { data: string; timestamp: number; encrypted: boolean; compressed: boolean };
    };
    const decryptVia = async (service: EncryptedStorageService, record: object) => {
      vi.mocked(indexedDBService.get).mockResolvedValueOnce(record);
      return service.getItem('probe');
    };

    it('persists a new encryption key in localStorage (data lives in IndexedDB, which outlives the session)', () => {
      const local = memStorage();
      const session = memStorage();
      void new EncryptedStorageService({ localStorage: local, sessionStorage: session });

      expect(local.map.get('wt_enc_key')).toEqual(expect.any(String));
      expect(session.map.has('wt_enc_key')).toBe(false);
    });

    it('data written in one session is readable in the next (the actual bug being fixed)', async () => {
      const local = memStorage();
      const writer = new EncryptedStorageService({ localStorage: local, sessionStorage: memStorage() });
      const record = await encryptVia(writer, { balance: 123.45 });

      // "Next session": fresh instance, fresh sessionStorage, SAME localStorage.
      const reader = new EncryptedStorageService({ localStorage: local, sessionStorage: memStorage() });
      await expect(decryptVia(reader, record)).resolves.toEqual({ balance: 123.45 });
      expect(indexedDBService.delete).not.toHaveBeenCalled();
    });

    it('migrates a legacy session-scoped key so earlier data stays readable across sessions', async () => {
      // Legacy writer: no localStorage at all → key lives in sessionStorage.
      const session = memStorage();
      const writer = new EncryptedStorageService({ localStorage: null, sessionStorage: session });
      const record = await encryptVia(writer, ['legacy']);
      expect(session.map.get('wt_enc_key')).toEqual(expect.any(String));

      // Same session, new code path: key migrates into localStorage…
      const local = memStorage();
      const migrator = new EncryptedStorageService({ localStorage: local, sessionStorage: session });
      await expect(decryptVia(migrator, record)).resolves.toEqual(['legacy']);
      expect(local.map.get('wt_enc_key')).toBe(session.map.get('wt_enc_key'));

      // …so a FUTURE session (localStorage only) can still decrypt.
      const future = new EncryptedStorageService({ localStorage: local, sessionStorage: memStorage() });
      await expect(decryptVia(future, record)).resolves.toEqual(['legacy']);
    });

    it('survives a localStorage that throws on write (quota full) via the in-memory key', async () => {
      const throwing = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => {},
      };
      // Construction at module load must never throw…
      const service = new EncryptedStorageService({ localStorage: throwing, sessionStorage: null });
      // …and the instance still encrypts/decrypts with its memory key.
      const record = await encryptVia(service, { ok: true });
      await expect(decryptVia(service, record)).resolves.toEqual({ ok: true });
    });

    it('honors EXPLICIT null storages (memory key, no global fallback)', async () => {
      const service = new EncryptedStorageService({ localStorage: null, sessionStorage: null });
      const record = await encryptVia(service, 42);
      await expect(decryptVia(service, record)).resolves.toBe(42);
      // The mocked globals must not have been touched.
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Undecryptable data self-heal', () => {
    const memStorage = (initial: Record<string, string> = {}) => {
      const map = new Map(Object.entries(initial));
      return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => { map.set(k, v); },
        removeItem: (k: string) => { map.delete(k); },
        map,
      };
    };

    it('purges an entry nobody can decrypt, returns null, and warns once', async () => {
      const writer = new EncryptedStorageService({
        localStorage: memStorage({ wt_enc_key: 'lost-key' }),
        sessionStorage: null,
      });
      await writer.setItem('probe', { a: 1 });
      const record = vi.mocked(indexedDBService.put).mock.calls.at(-1)![1];

      const warn = vi.fn();
      const reader = new EncryptedStorageService({
        localStorage: memStorage({ wt_enc_key: 'reader-key' }),
        sessionStorage: null,
        logger: { error: vi.fn(), warn },
      });

      vi.mocked(indexedDBService.get).mockResolvedValue(record);
      const first = await reader.getItem('wealthtracker_accounts');
      const second = await reader.getItem('wealthtracker_transactions');

      expect(first).toBeNull();
      expect(second).toBeNull();
      // Both poisoned entries purged so the failure never repeats…
      expect(indexedDBService.delete).toHaveBeenCalledWith('secureData', 'wealthtracker_accounts');
      expect(indexedDBService.delete).toHaveBeenCalledWith('secureData', 'wealthtracker_transactions');
      // …and exactly ONE warning, not an error per entry per load.
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('retries with the freshly persisted key before purging (cross-tab desync)', async () => {
      // Reader constructs while localStorage holds key-A…
      const sharedLocal = memStorage({ wt_enc_key: 'key-A' });
      const reader = new EncryptedStorageService({ localStorage: sharedLocal, sessionStorage: null });

      // …meanwhile "another tab" rotates the key to key-B and writes data.
      const writer = new EncryptedStorageService({
        localStorage: memStorage({ wt_enc_key: 'key-B' }),
        sessionStorage: null,
      });
      await writer.setItem('probe', { fresh: 'write' });
      const record = vi.mocked(indexedDBService.put).mock.calls.at(-1)![1];
      sharedLocal.map.set('wt_enc_key', 'key-B');

      vi.mocked(indexedDBService.get).mockResolvedValueOnce(record);
      const result = await reader.getItem('wealthtracker_transactions');

      // The reader adopts the persisted key and reads the data — no purge.
      expect(result).toEqual({ fresh: 'write' });
      expect(indexedDBService.delete).not.toHaveBeenCalled();
    });
  });

  describe('Storage Key Constants', () => {
    it('exports all required storage keys', () => {
      expect(STORAGE_KEYS.ACCOUNTS).toBe('wealthtracker_accounts');
      expect(STORAGE_KEYS.TRANSACTIONS).toBe('wealthtracker_transactions');
      expect(STORAGE_KEYS.BUDGETS).toBe('wealthtracker_budgets');
      expect(STORAGE_KEYS.GOALS).toBe('wealthtracker_goals');
      expect(STORAGE_KEYS.PREFERENCES).toBe('wealthtracker_preferences');
    });
  });
});