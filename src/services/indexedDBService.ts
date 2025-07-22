// IndexedDB Service for efficient client-side storage
// Handles large data like documents, images, and bulk data

import type { JsonValue } from '../types/common';

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

class IndexedDBService {
  private dbName: string;
  private dbVersion: number;
  private db: IDBDatabase | null = null;
  private dbConfig: DBConfig;

  constructor() {
    this.dbName = 'WealthTrackerDB';
    this.dbVersion = 1;
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
        }
      ]
    };
  }

  // Initialize the database
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
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

  // Ensure database is initialized
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
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
    console.log(`Migrated ${items.length} items from localStorage to IndexedDB`);
  } catch (error) {
    console.error(`Failed to migrate ${localStorageKey}:`, error);
  }
}