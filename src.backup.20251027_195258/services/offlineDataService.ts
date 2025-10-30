import { logger } from './loggingService';
import type { EntityDataMap, EntityType } from '../types/sync-types';

/**
 * Offline Data Service
 * Handles offline data synchronization using IndexedDB
 */

export type OfflineEntityType = Extract<
  EntityType,
  'transaction' | 'account' | 'budget' | 'goal'
>;

export type OfflineSyncAction = 'create' | 'update' | 'delete';

type OfflineSyncPayload<T extends OfflineEntityType> = EntityDataMap[T];

export interface PendingSync<T extends OfflineEntityType = OfflineEntityType> {
  id: string;
  type: T;
  action: OfflineSyncAction;
  data: OfflineSyncPayload<T>;
  timestamp: number;
  retryCount: number;
}

interface OfflineCacheEntry<TData = unknown> {
  key: string;
  data: TData;
  timestamp: number;
  expiresAt?: number;
}

export interface OfflineConflict<
  T extends OfflineEntityType = OfflineEntityType
> extends PendingSync<T> {
  conflictedAt: number;
}

interface SyncManager {
  register(tag: string): Promise<void>;
}

const OFFLINE_ENTITY_TYPES: ReadonlySet<OfflineEntityType> = new Set([
  'transaction',
  'account',
  'budget',
  'goal',
]);

const isOfflineEntityType = (value: unknown): value is OfflineEntityType =>
  typeof value === 'string' && OFFLINE_ENTITY_TYPES.has(value as OfflineEntityType);

const isOfflineSyncAction = (value: unknown): value is OfflineSyncAction =>
  value === 'create' || value === 'update' || value === 'delete';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getTypeGuard = (type: OfflineEntityType) => {
  const guardMap = {
    transaction: (data: unknown): data is OfflineSyncPayload<'transaction'> =>
      isRecord(data) && 'amount' in data && 'date' in data,
    account: (data: unknown): data is OfflineSyncPayload<'account'> =>
      isRecord(data) && 'balance' in data && 'name' in data,
    budget: (data: unknown): data is OfflineSyncPayload<'budget'> =>
      isRecord(data) && 'categoryId' in data && 'amount' in data,
    goal: (data: unknown): data is OfflineSyncPayload<'goal'> =>
      isRecord(data) && 'targetAmount' in data && 'currentAmount' in data,
  } as const;

  return guardMap[type];
};

const isPendingSyncRecord = (
  value: unknown
): value is PendingSync => {
  if (!isRecord(value)) {
    return false;
  }

  const { id, type, action, data, timestamp, retryCount } = value;

  if (typeof id !== 'string') {
    return false;
  }

  if (!isOfflineEntityType(type)) {
    return false;
  }

  if (!isOfflineSyncAction(action)) {
    return false;
  }

  if (typeof timestamp !== 'number' || typeof retryCount !== 'number') {
    return false;
  }

  const guard = getTypeGuard(type);
  return guard(data);
};

const isOfflineConflictRecord = (
  value: unknown
): value is OfflineConflict =>
  isPendingSyncRecord(value) &&
  isRecord(value) &&
  typeof value.conflictedAt === 'number';

const hasBackgroundSync = (
  registration: ServiceWorkerRegistration
): registration is ServiceWorkerRegistration & { sync: SyncManager } =>
  'sync' in registration;

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
  async addToSyncQueue<T extends OfflineEntityType>(
    type: T,
    action: OfflineSyncAction,
    data: OfflineSyncPayload<T>
  ): Promise<void> {
    if (!this.db) await this.initialize();

    const sync: PendingSync<T> = {
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
      void this.triggerSync();
    }
  }

  // Get all pending syncs
  async getPendingSyncs(): Promise<PendingSync[]> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['pendingSyncs'], 'readonly');
    const store = transaction.objectStore('pendingSyncs');
    const index = store.index('timestamp');
    const request = index.getAll() as IDBRequest<unknown[]>;
    const rawResults = await this.promisifyRequest(request);

    return rawResults.filter(isPendingSyncRecord);
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

    const request = store.get(id) as IDBRequest<unknown>;
    const sync = await this.promisifyRequest(request);
    if (isPendingSyncRecord(sync)) {
      const updated: PendingSync = {
        ...sync,
        retryCount,
      };
      await this.promisifyRequest(store.put(updated));
    }
  }

  // Cache data for offline access
  async cacheData<TData>(key: string, data: TData, ttlMinutes?: number): Promise<void> {
    if (!this.db) await this.initialize();

    const cache: OfflineCacheEntry<TData> = {
      key,
      data,
      timestamp: Date.now(),
      ...(ttlMinutes && { expiresAt: Date.now() + (ttlMinutes * 60 * 1000) })
    };

    const transaction = this.db!.transaction(['offlineCache'], 'readwrite');
    const store = transaction.objectStore('offlineCache');
    await this.promisifyRequest(store.put(cache));
  }

  // Get cached data
  async getCachedData<TData>(key: string): Promise<TData | null> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['offlineCache'], 'readonly');
    const store = transaction.objectStore('offlineCache');
    const request = store.get(key) as IDBRequest<OfflineCacheEntry<TData> | undefined>;
    const cache = await this.promisifyRequest(request);

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
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (hasBackgroundSync(registration)) {
          await registration.sync.register('sync-data');
        } else {
          await this.performSync();
        }
      } else {
        await this.performSync();
      }
    } catch (error) {
      logger.error('Failed to trigger sync:', error);
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
        logger.error('Sync failed for item:', sync.id, error instanceof Error ? error.message : String(error));
        await this.updateSyncRetryCount(sync.id, sync.retryCount + 1);
      }
    }
  }

  // Sync individual item
  private async syncItem(sync: PendingSync): Promise<boolean> {
    const endpoint = this.getEndpoint(sync.type);
    const method = this.getHttpMethod(sync.action);
    
    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (method !== 'DELETE') {
        fetchOptions.body = JSON.stringify(sync.data);
      }

      const response = await fetch(endpoint, fetchOptions);

      return response.ok;
    } catch (error) {
      logger.error('Failed to sync item:', error);
      return false;
    }
  }

  // Add conflict for manual resolution
  private async addConflict(sync: PendingSync): Promise<void> {
    if (!this.db) await this.initialize();

    const conflict: OfflineConflict = {
      ...sync,
      conflictedAt: Date.now()
    };

    const transaction = this.db!.transaction(['conflicts'], 'readwrite');
    const store = transaction.objectStore('conflicts');
    await this.promisifyRequest(store.put(conflict));
  }

  // Get conflicts
  async getConflicts(): Promise<OfflineConflict[]> {
    if (!this.db) await this.initialize();

    const transaction = this.db!.transaction(['conflicts'], 'readonly');
    const store = transaction.objectStore('conflicts');
    const request = store.getAll() as IDBRequest<unknown[]>;
    const conflicts = await this.promisifyRequest(request);

    return conflicts.filter(isOfflineConflictRecord);
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
    logger.info('Back online, triggering sync...');
    offlineDataService.triggerSync();
  });

  // Clean expired cache periodically
  setInterval(() => {
    offlineDataService.cleanExpiredCache().catch(console.error);
  }, 60 * 60 * 1000); // Every hour
}
