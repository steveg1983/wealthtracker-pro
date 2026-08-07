// IndexedDB Service for efficient client-side storage
// Handles large data like documents, images, and bulk data

import type { JsonValue } from '../types/common';
import { createScopedLogger } from '../loggers/scopedLogger';

const indexedDBLogger = createScopedLogger('IndexedDBService');

interface DBConfig {
  name: string;
  version: number;
  stores: {
    name: string;
    keyPath: string;
    indexes?: Array<{
      name: string;
      keyPath: string | string[];
      unique?: boolean;
    }>;
  }[];
}

/**
 * How long to wait for indexedDB.open before declaring it unavailable.
 * Generous enough for a cold profile on a slow disk, short enough that a
 * blocked database degrades to the localStorage fallback instead of leaving
 * the user staring at an app that never finishes loading.
 */
const OPEN_TIMEOUT_MS = 10_000;

class IndexedDBService {
  private dbName: string;
  private dbVersion: number;
  private db: IDBDatabase | null = null;
  private dbConfig: DBConfig;
  private safariMode = false;
  private initPromise: Promise<void> | null = null;
  private logger = indexedDBLogger;

  constructor() {
    this.dbName = 'WealthTrackerDB';
    this.dbVersion = 2; // Increment version to trigger upgrade
    this.checkSafari();
    this.dbConfig = {
      name: this.dbName,
      version: this.dbVersion,
      stores: [
        {
          name: 'documents',
          keyPath: 'id',
          indexes: [
            { name: 'transactionId', keyPath: 'transactionId', unique: false },
            { name: 'accountId', keyPath: 'accountId', unique: false },
            { name: 'type', keyPath: 'type', unique: false },
            { name: 'uploadDate', keyPath: 'uploadDate', unique: false }
          ]
        },
        {
          name: 'documentBlobs',
          keyPath: 'documentId'
        },
        {
          name: 'cache',
          keyPath: 'key',
          indexes: [
            { name: 'expiry', keyPath: 'expiry', unique: false }
          ]
        },
        {
          name: 'largeData',
          keyPath: 'key'
        },
        {
          name: 'secureData',
          keyPath: 'key'
        },
        // Add offline stores
        {
          name: 'offline-queue',
          keyPath: 'id'
        },
        {
          name: 'offline-data',
          keyPath: 'id'
        },
        {
          name: 'conflicts',
          keyPath: 'id'
        },
        {
          name: 'sync-meta',
          keyPath: 'key'
        }
      ]
    };
  }

  private checkSafari(): void {
    const ua = navigator.userAgent;
    this.safariMode = ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium');
  }

  // Initialize the database
  async init(): Promise<void> {
    // Prevent multiple simultaneous init calls
    if (this.initPromise) {
      return this.initPromise;
    }

    // A failed open must not be remembered as the answer forever: drop the
    // cached promise so the next caller gets a fresh attempt rather than an
    // instant replay of one bad moment (a blocked delete, a locked profile).
    this.initPromise = this._doInit().catch((error: unknown) => {
      this.initPromise = null;
      throw error;
    });
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      // Safari compatibility: add error handling for private browsing mode
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(this.dbName, this.dbVersion);
      } catch (e) {
        this.logger.error('Failed to open IndexedDB', e as Error);
        reject(new Error('IndexedDB not available (possibly private browsing mode)'));
        return;
      }

      // An open request has no deadline of its own. While a delete or a
      // version upgrade is waiting on some other connection, it fires no event
      // at all — and every storage read in the app is awaiting this promise,
      // so the whole session hangs on an empty screen with a silent console.
      // Time out instead: callers fall back to localStorage and say so.
      let settled = false;
      const openTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.logger.error('IndexedDB open timed out', new Error(
          `Opening ${this.dbName} took longer than ${OPEN_TIMEOUT_MS}ms — ` +
          'another tab or window is most likely holding it open.'
        ));
        reject(new Error('Timed out opening IndexedDB'));
      }, OPEN_TIMEOUT_MS);

      const settle = (finish: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(openTimeout);
        finish();
      };

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        this.logger.error('IndexedDB error', error ?? undefined);
        settle(() => {
          if (this.safariMode) {
            reject(new Error('IndexedDB failed in Safari. This might be due to private browsing mode or storage restrictions.'));
          } else {
            reject(new Error('Failed to open IndexedDB: ' + (error?.message || 'Unknown error')));
          }
        });
      };

      // Another connection is holding the old version open, so this upgrade
      // cannot start. Reject rather than wait for a resolution that may never
      // come — the caller can fall back and try again later.
      request.onblocked = () => {
        this.logger.warn(`Opening ${this.dbName} is blocked by another open connection`);
        settle(() => reject(new Error('IndexedDB upgrade blocked by another tab')));
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Yield the connection the moment another tab wants to upgrade or
        // delete the database. Holding on blocks THEM indefinitely, and a
        // blocked delete then wedges every later open in every tab — which is
        // how clearing site data used to leave the app permanently empty.
        // Each connection closes ITSELF here rather than calling close(),
        // which would only ever close the current one and leave an older
        // connection holding the block.
        db.onversionchange = () => {
          this.logger.warn('Another tab asked to change the database version; closing this connection');
          db.close();
          this.forget(db);
        };
        // The connection can also be closed out from under us (storage
        // pressure, a completed delete). Forget it so the next call re-opens.
        db.onclose = () => this.forget(db);

        this.db = db;
        settle(resolve);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        this.dbConfig.stores.forEach(storeConfig => {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath
            });

            // Create indexes
            storeConfig.indexes?.forEach(index => {
              store.createIndex(index.name, index.keyPath, {
                unique: index.unique || false
              });
            });
          }
        });
      };
    });
  }

  /**
   * Drop a connection this service is no longer using. The cached init promise
   * means "the database is open", so it has to go with the connection —
   * otherwise every later call resolves onto a handle that is already closed.
   */
  private forget(db: IDBDatabase): void {
    if (this.db === db) {
      this.db = null;
      this.initPromise = null;
    }
  }

  // Ensure database is initialized
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      try {
        await this.init();
      } catch (e) {
        this.logger.error('Failed to initialize IndexedDB', e as Error);
        if (this.safariMode) {
          throw new Error('IndexedDB not available in Safari. Please check browser settings or disable private browsing mode.');
        }
        throw e;
      }
    }
    if (!this.db) {
      throw new Error('Database initialization failed');
    }
    return this.db;
  }

  // Generic add operation
  async add<T extends Record<string, unknown>>(storeName: string, data: T): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to add data to ${storeName}`));
    });
  }

  // Generic put operation (add or update)
  async put<T extends Record<string, unknown>>(storeName: string, data: T): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to put data to ${storeName}`));
    });
  }

  // Generic get operation
  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get data from ${storeName}`));
    });
  }

  // Generic getAll operation
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get all data from ${storeName}`));
    });
  }

  // Get by index
  async getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey | IDBKeyRange): Promise<T[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get data by index from ${storeName}`));
    });
  }

  // Generic delete operation
  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete data from ${storeName}`));
    });
  }

  // Clear entire store
  async clear(storeName: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
    });
  }

  // Count items in store
  async count(storeName: string): Promise<number> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count items in ${storeName}`));
    });
  }

  // Store large blob data
  async storeBlob(key: string, blob: Blob): Promise<void> {
    await this.put('documentBlobs', {
      documentId: key,
      blob: blob,
      size: blob.size,
      type: blob.type,
      storedAt: new Date()
    });
  }

  // Retrieve blob data
  async getBlob(key: string): Promise<Blob | undefined> {
    const data = await this.get<{ blob: Blob }>('documentBlobs', key);
    return data?.blob;
  }

  // Cache with expiry
  async setCache<T extends JsonValue>(key: string, value: T, expiryMinutes: number = 60): Promise<void> {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + expiryMinutes);
    
    await this.put('cache', {
      key,
      value,
      expiry: expiry.getTime(),
      createdAt: new Date()
    });
  }

  // Get from cache
  async getCache<T>(key: string): Promise<T | undefined> {
    const data = await this.get<{ value: T; expiry: number }>('cache', key);
    
    if (!data) return undefined;
    
    // Check if expired
    if (data.expiry < Date.now()) {
      await this.delete('cache', key);
      return undefined;
    }
    
    return data.value;
  }

  // Clean expired cache entries
  async cleanCache(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const index = store.index('expiry');
    const now = Date.now();
    
    const request = index.openCursor(IDBKeyRange.upperBound(now));
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  // Get database size
  async getStorageInfo(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    
    // Fallback for browsers that don't support storage.estimate
    return { usage: 0, quota: 0 };
  }

  // Get all keys from a store
  async getAllKeys(storeName: string): Promise<string[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(new Error(`Failed to get keys from ${storeName}`));
    });
  }

  // Bulk put operation
  async putBulk<T extends Record<string, unknown>>(storeName: string, items: Array<{ key: string; value: T }>): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      let hasError = false;
      
      items.forEach(({ key, value }) => {
        const request = store.put({ ...value, key });
        request.onerror = () => {
          hasError = true;
          reject(new Error(`Failed to put item with key ${key}`));
        };
      });
      
      transaction.oncomplete = () => {
        if (!hasError) {
          resolve();
        }
      };
      
      transaction.onerror = () => {
        reject(new Error('Bulk put transaction failed'));
      };
    });
  }

  // Clear a specific store
  async clearStore(storeName: string): Promise<void> {
    return this.clear(storeName);
  }

  // Close database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    // The cached promise means "the database is open"; once it isn't, keeping
    // it would make every later call resolve onto a connection that is gone.
    this.initPromise = null;
  }
}

export const indexedDBService = new IndexedDBService();

// Migration helper for moving from localStorage to IndexedDB
export async function migrateFromLocalStorage<T = JsonValue>(
  localStorageKey: string,
  indexedDBStore: string,
  transformFn?: (data: T) => T
): Promise<void> {
  try {
    const data = localStorage.getItem(localStorageKey);
    if (!data) return;

    const parsed = JSON.parse(data);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of items) {
      const transformed = transformFn ? transformFn(item) : item;
      await indexedDBService.put(indexedDBStore, transformed);
    }

    // Keep localStorage as backup for now
    indexedDBLogger.info?.(`Migrated ${items.length} items from localStorage to IndexedDB`);
  } catch (error) {
    indexedDBLogger.error?.(`Failed to migrate ${localStorageKey}`, error as Error);
  }
}
