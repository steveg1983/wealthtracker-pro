/**
 * IndexedDB Service - Client-side database management for offline functionality
 *
 * Features:
 * - Offline data storage
 * - Transaction caching
 * - Document storage
 * - Synchronization queue
 * - Data versioning
 */

import { lazyLogger } from './serviceFactory';

const logger = lazyLogger.getLogger('IndexedDBService');

export interface IndexedDBConfig {
  dbName: string;
  version: number;
  stores: StoreConfig[];
}

export interface StoreConfig {
  name: string;
  keyPath?: string;
  autoIncrement?: boolean;
  indexes?: IndexConfig[];
}

export interface IndexConfig {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
}

export interface StorageItem<T = any> {
  id: string;
  data: T;
  timestamp: number;
  version: number;
  synced: boolean;
}

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  storeName: string;
  data: any;
  timestamp: number;
  retryCount: number;
  lastAttempt?: number;
}

class IndexedDBService {
  private static instance: IndexedDBService;
  private db: IDBDatabase | null = null;
  private dbName = 'WealthTrackerDB';
  private version = 1;
  private isInitialized = false;

  private constructor() {
    logger.info('IndexedDBService initializing');
  }

  public static getInstance(): IndexedDBService {
    if (!IndexedDBService.instance) {
      IndexedDBService.instance = new IndexedDBService();
    }
    return IndexedDBService.instance;
  }

  // Database Initialization
  public static async initialize(config?: Partial<IndexedDBConfig>): Promise<void> {
    const service = IndexedDBService.getInstance();

    if (service.isInitialized) {
      logger.debug('IndexedDB already initialized');
      return;
    }

    if (config?.dbName) service.dbName = config.dbName;
    if (config?.version) service.version = config.version;

    logger.info('Initializing IndexedDB', {
      dbName: service.dbName,
      version: service.version
    });

    try {
      await service.openDatabase();
      service.isInitialized = true;
      logger.info('IndexedDB initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize IndexedDB:', error);
      throw error;
    }
  }

  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = window.indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        logger.error('Error opening IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.debug('IndexedDB opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        logger.info('Upgrading IndexedDB schema');

        // Create object stores
        this.createObjectStores(db);
      };
    });
  }

  private createObjectStores(db: IDBDatabase): void {
    const stores = [
      {
        name: 'transactions',
        keyPath: 'id',
        indexes: [
          { name: 'date', keyPath: 'date', unique: false },
          { name: 'account_id', keyPath: 'account_id', unique: false },
          { name: 'synced', keyPath: 'synced', unique: false }
        ]
      },
      {
        name: 'accounts',
        keyPath: 'id',
        indexes: [
          { name: 'type', keyPath: 'type', unique: false },
          { name: 'synced', keyPath: 'synced', unique: false }
        ]
      },
      {
        name: 'documents',
        keyPath: 'id',
        indexes: [
          { name: 'type', keyPath: 'type', unique: false },
          { name: 'uploaded_at', keyPath: 'uploaded_at', unique: false }
        ]
      },
      {
        name: 'sync_queue',
        keyPath: 'id',
        indexes: [
          { name: 'operation', keyPath: 'operation', unique: false },
          { name: 'timestamp', keyPath: 'timestamp', unique: false }
        ]
      },
      {
        name: 'preferences',
        keyPath: 'key'
      },
      {
        name: 'cache',
        keyPath: 'key',
        indexes: [
          { name: 'expiry', keyPath: 'expiry', unique: false }
        ]
      }
    ];

    stores.forEach(store => {
      if (!db.objectStoreNames.contains(store.name)) {
        const objectStore = db.createObjectStore(store.name, {
          keyPath: store.keyPath,
          autoIncrement: !store.keyPath
        });

        // Create indexes
        if (store.indexes) {
          store.indexes.forEach(index => {
            objectStore.createIndex(index.name, index.keyPath, {
              unique: index.unique || false
            });
          });
        }

        logger.debug(`Created object store: ${store.name}`);
      }
    });
  }

  // CRUD Operations
  public static async create<T>(
    storeName: string,
    data: T,
    id?: string
  ): Promise<string> {
    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    const item: StorageItem<T> = {
      id: id || this.generateId(),
      data,
      timestamp: Date.now(),
      version: 1,
      synced: false
    };

    logger.debug('Creating item in IndexedDB', { storeName, id: item.id });

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => {
        logger.debug('Item created successfully', { storeName, id: item.id });
        resolve(item.id);
      };

      request.onerror = () => {
        logger.error('Error creating item:', request.error);
        reject(request.error);
      };
    });
  }

  public static async read<T>(
    storeName: string,
    id: string
  ): Promise<StorageItem<T> | null> {
    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    logger.debug('Reading item from IndexedDB', { storeName, id });

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as StorageItem<T> | undefined;
        logger.debug('Item read', { storeName, id, found: !!result });
        resolve(result || null);
      };

      request.onerror = () => {
        logger.error('Error reading item:', request.error);
        reject(request.error);
      };
    });
  }

  public static async update<T>(
    storeName: string,
    id: string,
    data: Partial<T>
  ): Promise<void> {
    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    logger.debug('Updating item in IndexedDB', { storeName, id });

    // First read the existing item
    const existingItem = await this.read<T>(storeName, id);
    if (!existingItem) {
      throw new Error(`Item with id ${id} not found`);
    }

    const updatedItem: StorageItem<T> = {
      ...existingItem,
      data: { ...existingItem.data, ...data },
      timestamp: Date.now(),
      version: existingItem.version + 1,
      synced: false
    };

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(updatedItem);

      request.onsuccess = () => {
        logger.debug('Item updated successfully', { storeName, id });
        resolve();
      };

      request.onerror = () => {
        logger.error('Error updating item:', request.error);
        reject(request.error);
      };
    });
  }

  public static async delete(storeName: string, id: string): Promise<void> {
    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    logger.debug('Deleting item from IndexedDB', { storeName, id });

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        logger.debug('Item deleted successfully', { storeName, id });
        resolve();
      };

      request.onerror = () => {
        logger.error('Error deleting item:', request.error);
        reject(request.error);
      };
    });
  }

  // Query Operations
  public static async getAll<T>(storeName: string): Promise<StorageItem<T>[]> {
    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    logger.debug('Getting all items from store', { storeName });

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as StorageItem<T>[];
        logger.debug('Retrieved all items', { storeName, count: results.length });
        resolve(results);
      };

      request.onerror = () => {
        logger.error('Error getting all items:', request.error);
        reject(request.error);
      };
    });
  }

  public static async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: any
  ): Promise<StorageItem<T>[]> {
    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    logger.debug('Getting items by index', { storeName, indexName, value });

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => {
        const results = request.result as StorageItem<T>[];
        logger.debug('Retrieved items by index', {
          storeName,
          indexName,
          value,
          count: results.length
        });
        resolve(results);
      };

      request.onerror = () => {
        logger.error('Error getting items by index:', request.error);
        reject(request.error);
      };
    });
  }

  // Sync Queue Management
  public static async addToSyncQueue(
    operation: 'create' | 'update' | 'delete',
    storeName: string,
    data: any
  ): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: this.generateId(),
      operation,
      storeName,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.create('sync_queue', queueItem, queueItem.id);
    logger.debug('Added item to sync queue', { operation, storeName });
  }

  public static async getSyncQueue(): Promise<StorageItem<SyncQueueItem>[]> {
    return await this.getAll<SyncQueueItem>('sync_queue');
  }

  public static async removeSyncQueueItem(id: string): Promise<void> {
    await this.delete('sync_queue', id);
    logger.debug('Removed item from sync queue', { id });
  }

  public static async updateSyncQueueItem(
    id: string,
    updates: Partial<SyncQueueItem>
  ): Promise<void> {
    await this.update('sync_queue', id, updates);
  }

  // Cache Management
  public static async setCache<T>(
    key: string,
    data: T,
    expiryMinutes = 60
  ): Promise<void> {
    const cacheItem = {
      key,
      data,
      expiry: Date.now() + (expiryMinutes * 60 * 1000),
      timestamp: Date.now()
    };

    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put(cacheItem);

      request.onsuccess = () => {
        logger.debug('Cache item set', { key, expiryMinutes });
        resolve();
      };

      request.onerror = () => {
        logger.error('Error setting cache item:', request.error);
        reject(request.error);
      };
    });
  }

  public static async getCache<T>(key: string): Promise<T | null> {
    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;

        if (!result) {
          resolve(null);
          return;
        }

        // Check expiry
        if (result.expiry < Date.now()) {
          // Expired - delete and return null
          this.deleteCache(key);
          resolve(null);
          return;
        }

        logger.debug('Cache item retrieved', { key });
        resolve(result.data as T);
      };

      request.onerror = () => {
        logger.error('Error getting cache item:', request.error);
        reject(request.error);
      };
    });
  }

  public static async deleteCache(key: string): Promise<void> {
    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);

      request.onsuccess = () => {
        logger.debug('Cache item deleted', { key });
        resolve();
      };

      request.onerror = () => {
        logger.error('Error deleting cache item:', request.error);
        reject(request.error);
      };
    });
  }

  public static async clearExpiredCache(): Promise<void> {
    const service = IndexedDBService.getInstance();
    await service.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = service.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('expiry');
      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          logger.debug('Cleared expired cache items', { deletedCount });
          resolve();
        }
      };

      request.onerror = () => {
        logger.error('Error clearing expired cache:', request.error);
        reject(request.error);
      };
    });
  }

  // Document Storage
  public static async storeDocument(
    file: File,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const id = this.generateId();

    // Convert file to blob
    const arrayBuffer = await file.arrayBuffer();

    const documentData = {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      data: arrayBuffer,
      metadata,
      uploaded_at: Date.now()
    };

    await this.create('documents', documentData, id);
    logger.info('Document stored', { id, name: file.name, size: file.size });

    return id;
  }

  public static async getDocument(id: string): Promise<{
    file: File;
    metadata: Record<string, any>;
  } | null> {
    const result = await this.read<any>('documents', id);

    if (!result) {
      return null;
    }

    const { data } = result;
    const blob = new Blob([data.data], { type: data.type });
    const file = new File([blob], data.name, { type: data.type });

    return {
      file,
      metadata: data.metadata
    };
  }

  // Utility Methods
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await IndexedDBService.initialize();
    }
  }

  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public static async clearAllData(): Promise<void> {
    const service = IndexedDBService.getInstance();

    if (service.db) {
      service.db.close();
    }

    return new Promise((resolve, reject) => {
      const deleteRequest = window.indexedDB.deleteDatabase(service.dbName);

      deleteRequest.onsuccess = () => {
        service.db = null;
        service.isInitialized = false;
        logger.info('IndexedDB cleared');
        resolve();
      };

      deleteRequest.onerror = () => {
        logger.error('Error clearing IndexedDB:', deleteRequest.error);
        reject(deleteRequest.error);
      };
    });
  }

  public static async getStorageUsage(): Promise<{
    quota: number;
    usage: number;
    available: number;
  }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota || 0,
        usage: estimate.usage || 0,
        available: (estimate.quota || 0) - (estimate.usage || 0)
      };
    }

    return {
      quota: 0,
      usage: 0,
      available: 0
    };
  }
}

// Migration function for localStorage to IndexedDB
export async function migrateFromLocalStorage(): Promise<void> {
  lazyLogger.info('Migrating data from localStorage to IndexedDB');
  // Stub implementation - actual migration logic would go here
}

// Named export for compatibility
export const indexedDBService = IndexedDBService;

export default IndexedDBService;