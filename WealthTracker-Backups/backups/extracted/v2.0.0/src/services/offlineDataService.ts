/**
 * Offline Data Service
 * Handles offline data synchronization using IndexedDB
 */

interface PendingSync {
  id: string;
  type: 'transaction' | 'account' | 'budget' | 'goal';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
}

interface OfflineCache {
  key: string;
  data: any;
  timestamp: number;
  expiresAt?: number;
}

const DB_NAME = 'WealthTrackerOfflineDB';
const DB_VERSION = 2;

class OfflineDataService {
  private db: IDBDatabase | null = null;
  private syncInProgress = false;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create pending syncs store
        if (!db.objectStoreNames.contains('pendingSyncs')) {
          const syncStore = db.createObjectStore('pendingSyncs', { keyPath: 'id' });
          syncStore.createIndex('type', 'type', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create offline cache store
        if (!db.objectStoreNames.contains('offlineCache')) {
          const cacheStore = db.createObjectStore('offlineCache', { keyPath: 'key' });
          cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Create conflict resolution store
        if (!db.objectStoreNames.contains('conflicts')) {
          const conflictStore = db.createObjectStore('conflicts', { keyPath: 'id' });
          conflictStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Add data to sync queue
  async addToSyncQueue(
    type: PendingSync['type'],
    action: PendingSync['action'],
    data: any
  ): Promise<void> {
    if (!this.db) await this.initialize();

    const sync: PendingSync = {
      id: `${type}_${action}_${Date.now()}_${Math.random()}`,
      type,
      action,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    const transaction = this.db!.transaction(['pendingSyncs'], 'readwrite');
    const store = transaction.objectStore('pendingSyncs');
    await this.promisifyRequest(store.add(sync));

    // Trigger sync if online
    if (navigator.onLine) {
      this.triggerSync();
    }
  }

  // Get all pending syncs
  async getPendingSyncs(): Promise<PendingSync[]> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['pendingSyncs'], 'readonly');
    const store = transaction.objectStore('pendingSyncs');
    const index = store.index('timestamp');
    
    return this.promisifyRequest(index.getAll());
  }

  // Remove sync from queue
  async removeSyncFromQueue(id: string): Promise<void> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['pendingSyncs'], 'readwrite');
    const store = transaction.objectStore('pendingSyncs');
    await this.promisifyRequest(store.delete(id));
  }

  // Update sync retry count
  async updateSyncRetryCount(id: string, retryCount: number): Promise<void> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['pendingSyncs'], 'readwrite');
    const store = transaction.objectStore('pendingSyncs');
    
    const sync = await this.promisifyRequest(store.get(id));
    if (sync) {
      sync.retryCount = retryCount;
      await this.promisifyRequest(store.put(sync));
    }
  }

  // Cache data for offline access
  async cacheData(key: string, data: any, ttlMinutes?: number): Promise<void> {
    if (!this.db) await this.initialize();

    const cache: OfflineCache = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: ttlMinutes ? Date.now() + (ttlMinutes * 60 * 1000) : undefined
    };

    const transaction = this.db!.transaction(['offlineCache'], 'readwrite');
    const store = transaction.objectStore('offlineCache');
    await this.promisifyRequest(store.put(cache));
  }

  // Get cached data
  async getCachedData(key: string): Promise<any | null> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['offlineCache'], 'readonly');
    const store = transaction.objectStore('offlineCache');
    const cache: OfflineCache = await this.promisifyRequest(store.get(key));

    if (!cache) return null;

    // Check if expired
    if (cache.expiresAt && cache.expiresAt < Date.now()) {
      await this.removeCachedData(key);
      return null;
    }

    return cache.data;
  }

  // Remove cached data
  async removeCachedData(key: string): Promise<void> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['offlineCache'], 'readwrite');
    const store = transaction.objectStore('offlineCache');
    await this.promisifyRequest(store.delete(key));
  }

  // Clean expired cache entries
  async cleanExpiredCache(): Promise<void> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['offlineCache'], 'readwrite');
    const store = transaction.objectStore('offlineCache');
    const index = store.index('expiresAt');
    
    const now = Date.now();
    const range = IDBKeyRange.upperBound(now);
    const cursor = index.openCursor(range);

    return new Promise((resolve, reject) => {
      cursor.onsuccess = () => {
        const cursorResult = cursor.result;
        if (cursorResult) {
          store.delete(cursorResult.primaryKey);
          cursorResult.continue();
        } else {
          resolve();
        }
      };
      cursor.onerror = () => reject(cursor.error);
    });
  }

  // Trigger background sync
  async triggerSync(): Promise<void> {
    if (this.syncInProgress || !navigator.onLine) return;

    this.syncInProgress = true;
    
    try {
      // Register background sync if available
      if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('sync-data');
      } else {
        // Fallback to immediate sync
        await this.performSync();
      }
    } catch (error) {
      console.error('Failed to trigger sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Perform the actual sync
  async performSync(): Promise<void> {
    const pendingSyncs = await this.getPendingSyncs();
    
    for (const sync of pendingSyncs) {
      try {
        // Skip if too many retries
        if (sync.retryCount >= 3) {
          await this.addConflict(sync);
          await this.removeSyncFromQueue(sync.id);
          continue;
        }

        // Perform the sync based on type and action
        const success = await this.syncItem(sync);
        
        if (success) {
          await this.removeSyncFromQueue(sync.id);
        } else {
          await this.updateSyncRetryCount(sync.id, sync.retryCount + 1);
        }
      } catch (error) {
        console.error('Sync failed for item:', sync.id, error);
        await this.updateSyncRetryCount(sync.id, sync.retryCount + 1);
      }
    }
  }

  // Sync individual item
  private async syncItem(sync: PendingSync): Promise<boolean> {
    const endpoint = this.getEndpoint(sync.type);
    const method = this.getHttpMethod(sync.action);
    
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'DELETE' ? JSON.stringify(sync.data) : undefined
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to sync item:', error);
      return false;
    }
  }

  // Add conflict for manual resolution
  private async addConflict(sync: PendingSync): Promise<void> {
    if (!this.db) await this.initialize();

    const conflict = {
      id: sync.id,
      ...sync,
      conflictedAt: Date.now()
    };

    const transaction = this.db!.transaction(['conflicts'], 'readwrite');
    const store = transaction.objectStore('conflicts');
    await this.promisifyRequest(store.put(conflict));
  }

  // Get conflicts
  async getConflicts(): Promise<any[]> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['conflicts'], 'readonly');
    const store = transaction.objectStore('conflicts');
    return this.promisifyRequest(store.getAll());
  }

  // Resolve conflict
  async resolveConflict(id: string): Promise<void> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['conflicts'], 'readwrite');
    const store = transaction.objectStore('conflicts');
    await this.promisifyRequest(store.delete(id));
  }

  // Helper methods
  private getEndpoint(type: PendingSync['type']): string {
    const endpoints: Record<PendingSync['type'], string> = {
      transaction: '/api/transactions',
      account: '/api/accounts',
      budget: '/api/budgets',
      goal: '/api/goals'
    };
    return endpoints[type];
  }

  private getHttpMethod(action: PendingSync['action']): string {
    const methods: Record<PendingSync['action'], string> = {
      create: 'POST',
      update: 'PUT',
      delete: 'DELETE'
    };
    return methods[action];
  }

  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all offline data
  async clearAllOfflineData(): Promise<void> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(
      ['pendingSyncs', 'offlineCache', 'conflicts'],
      'readwrite'
    );

    await Promise.all([
      this.promisifyRequest(transaction.objectStore('pendingSyncs').clear()),
      this.promisifyRequest(transaction.objectStore('offlineCache').clear()),
      this.promisifyRequest(transaction.objectStore('conflicts').clear())
    ]);
  }
}

// Export singleton instance
export const offlineDataService = new OfflineDataService();

// Initialize on module load
if (typeof window !== 'undefined') {
  offlineDataService.initialize().catch(console.error);
  
  // Set up online/offline listeners
  window.addEventListener('online', () => {
    console.log('Back online, triggering sync...');
    offlineDataService.triggerSync();
  });

  // Clean expired cache periodically
  setInterval(() => {
    offlineDataService.cleanExpiredCache().catch(console.error);
  }, 60 * 60 * 1000); // Every hour
}