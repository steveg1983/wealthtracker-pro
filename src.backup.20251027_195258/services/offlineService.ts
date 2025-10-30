import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Transaction, Account, Budget, Goal } from '../types';
import { logger } from './loggingService';

export type OfflineEntityType = 'transaction' | 'account' | 'budget' | 'goal';

type QueueOperation = 'create' | 'update' | 'delete';

export type StoredTransaction = Transaction & {
  syncStatus?: 'pending' | 'synced' | 'error';
  syncError?: string;
};

export type OfflineEntityData<T extends OfflineEntityType> = T extends 'transaction'
  ? StoredTransaction
  : T extends 'account'
    ? Account
    : T extends 'budget'
      ? Budget
      : Goal;

interface SyncManager {
  register(tag: string): Promise<void>;
}

export type OfflineQueueEntry<
  TEntity extends OfflineEntityType = OfflineEntityType
> =
  | {
      id: string;
      type: Extract<QueueOperation, 'create' | 'update'>;
      entity: TEntity;
      data: OfflineEntityData<TEntity>;
      timestamp: number;
      retries: number;
      lastError?: string;
    }
  | {
      id: string;
      type: Extract<QueueOperation, 'delete'>;
      entity: TEntity;
      data: { id: string };
      timestamp: number;
      retries: number;
      lastError?: string;
    };

export interface OfflineConflictRecord<
  TEntity extends OfflineEntityType = OfflineEntityType
> {
  id: string;
  entity: TEntity;
  operation: QueueOperation;
  localData: OfflineQueueEntry<TEntity>['data'];
  serverData: OfflineEntityData<TEntity> | null;
  timestamp: number;
  resolved: boolean;
}

const hasBackgroundSync = (
  registration: ServiceWorkerRegistration
): registration is ServiceWorkerRegistration & { sync: SyncManager } =>
  'sync' in registration;

const isIdPayload = (value: unknown): value is { id: string } =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof (value as { id: unknown }).id === 'string';

const isStoredTransactionPayload = (value: unknown): value is StoredTransaction => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredTransaction>;
  const hasRequiredStrings =
    typeof candidate.id === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.accountId === 'string';
  const hasAmount = typeof candidate.amount === 'number';
  const dateValue = candidate.date;
  const hasDate = dateValue instanceof Date || typeof dateValue === 'string';

  return hasRequiredStrings && hasAmount && hasDate;
};

// Define the database schema
interface OfflineDB extends DBSchema {
  transactions: {
    key: string;
    value: StoredTransaction;
    indexes: { 'by-date': string; 'by-sync-status': string };
  };
  accounts: {
    key: string;
    value: Account;
  };
  budgets: {
    key: string;
    value: Budget;
  };
  goals: {
    key: string;
    value: Goal;
  };
  offlineQueue: {
    key: string;
    value: OfflineQueueEntry;
  };
  conflicts: {
    key: string;
    value: OfflineConflictRecord;
  };
}

class OfflineService {
  private db: IDBPDatabase<OfflineDB> | null = null;
  private syncInProgress = false;
  private readonly DB_NAME = 'WealthTrackerOffline';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<OfflineDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Create object stores
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
          transactionStore.createIndex('by-date', 'date');
          transactionStore.createIndex('by-sync-status', 'syncStatus');
        }

        if (!db.objectStoreNames.contains('accounts')) {
          db.createObjectStore('accounts', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('budgets')) {
          db.createObjectStore('budgets', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('goals')) {
          db.createObjectStore('goals', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('offlineQueue')) {
          db.createObjectStore('offlineQueue', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('conflicts')) {
          db.createObjectStore('conflicts', { keyPath: 'id' });
        }
      },
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      logger.info('Back online - starting sync');
      void this.syncOfflineData();
    });

    // Listen for visibility change to sync when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine) {
        void this.syncOfflineData();
      }
    });

    // Background sync registration
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((registration) => {
          if (hasBackgroundSync(registration)) {
            return registration.sync.register('sync-offline-data');
          }
          return void 0;
        })
        .catch((err) => {
          logger.error('Failed to register background sync:', err);
        });
    }
  }

  // Transaction operations
  async saveTransaction(transaction: Transaction | StoredTransaction, isOffline = false): Promise<void> {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(['transactions', 'offlineQueue'], 'readwrite');
    const storedTransaction: StoredTransaction = {
      ...transaction,
      syncStatus: isOffline ? 'pending' : 'synced',
    };

    // Save to local store
    await tx.objectStore('transactions').put(storedTransaction);

    // If offline, add to queue
    if (isOffline) {
      await tx.objectStore('offlineQueue').put({
        id: `transaction-${transaction.id}-${Date.now()}`,
        type: 'create',
        entity: 'transaction',
        data: storedTransaction,
        timestamp: Date.now(),
        retries: 0,
      });
    }

    await tx.done;
  }

  async getTransactions(accountId?: string): Promise<Transaction[]> {
    if (!this.db) await this.init();
    
    const transactions = await this.db!.getAll('transactions');
    
    if (accountId) {
      return transactions.filter(t => t.accountId === accountId);
    }
    
    return transactions;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>, isOffline = false): Promise<void> {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(['transactions', 'offlineQueue'], 'readwrite');
    const existing = await tx.objectStore('transactions').get(id);

    if (existing) {
      const updated: StoredTransaction = {
        ...existing,
        ...updates,
        syncStatus: isOffline ? 'pending' as const : 'synced' as const,
      };
      
      await tx.objectStore('transactions').put(updated);
      
      if (isOffline) {
        await tx.objectStore('offlineQueue').put({
          id: `transaction-${id}-${Date.now()}`,
          type: 'update',
          entity: 'transaction',
          data: updated,
          timestamp: Date.now(),
          retries: 0,
        });
      }
    }
    
    await tx.done;
  }

  async deleteTransaction(id: string, isOffline = false): Promise<void> {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(['transactions', 'offlineQueue'], 'readwrite');
    
    await tx.objectStore('transactions').delete(id);
    
    if (isOffline) {
      await tx.objectStore('offlineQueue').put({
        id: `transaction-${id}-${Date.now()}`,
        type: 'delete',
        entity: 'transaction',
        data: { id },
        timestamp: Date.now(),
        retries: 0,
      });
    }
    
    await tx.done;
  }

  // Sync operations
  async syncOfflineData(): Promise<void> {
    if (this.syncInProgress || !navigator.onLine) return;
    
    this.syncInProgress = true;
    
    try {
      if (!this.db) await this.init();
      
      // Get all pending items from queue
      const queue = await this.db!.getAll('offlineQueue');
      
      // Sort by timestamp to maintain order
      queue.sort((a, b) => a.timestamp - b.timestamp);
      
      logger.info('Syncing offline items', { count: queue.length });
      
      for (const item of queue) {
        try {
          await this.syncQueueItem(item);
          // Remove from queue on success
          await this.db!.delete('offlineQueue', item.id);
        } catch (error) {
          logger.error(`Failed to sync item ${item.id}:`, error);
          
          // Update retry count and error
          item.retries += 1;
          item.lastError = error instanceof Error ? error.message : 'Unknown error';
          
          // If too many retries, move to conflicts
          if (item.retries > 3) {
            await this.handleSyncConflict(item);
            await this.db!.delete('offlineQueue', item.id);
          } else {
          await this.db!.put('offlineQueue', item);
          }
        }
      }
      
      // Emit sync complete event
      window.dispatchEvent(new CustomEvent('offline-sync-complete', {
        detail: { itemsSynced: queue.length }
      }));
      
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncQueueItem(item: OfflineQueueEntry): Promise<void> {
    // This would call your actual API endpoints
    // For now, we'll simulate the sync
    
    const endpoint = `/api/${item.entity}${item.type === 'delete' ? `/${item.data.id}` : ''}`;
    const method = item.type === 'create' ? 'POST' : item.type === 'update' ? 'PUT' : 'DELETE';
    
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (item.type !== 'delete') {
      fetchOptions.body = JSON.stringify(item.data);
    }

    const response = await fetch(endpoint, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
    
    // Update local sync status
    if (
      item.entity === 'transaction' &&
      item.type !== 'delete' &&
      isStoredTransactionPayload(item.data)
    ) {
      const { syncError: _discardedSyncError, ...transactionWithoutError } = item.data;
      const syncedTransaction: StoredTransaction = {
        ...transactionWithoutError,
        syncStatus: 'synced',
      };
      await this.db!.put('transactions', syncedTransaction);
    }
  }

  private async handleSyncConflict(item: OfflineQueueEntry): Promise<void> {
    if (!this.db) await this.init();
    
    const conflict: OfflineConflictRecord = {
      id: `conflict-${item.id}`,
      entity: item.entity,
      operation: item.type,
      localData: item.data,
      serverData: null, // Would be populated from server response
      timestamp: Date.now(),
      resolved: false,
    };

    await this.db!.put('conflicts', conflict);
    
    // Emit conflict event
    window.dispatchEvent(new CustomEvent('offline-sync-conflict', {
      detail: { entity: item.entity, data: item.data }
    }));
  }

  // Conflict resolution
  async getConflicts(): Promise<OfflineConflictRecord[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('conflicts');
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'server'): Promise<void> {
    if (!this.db) await this.init();
    
    const conflict = await this.db!.get('conflicts', conflictId);
    if (!conflict) return;

    if (resolution === 'local') {
      const baseEntry = {
        id: `resolved-${conflictId}`,
        entity: conflict.entity,
        timestamp: Date.now(),
        retries: 0,
      } as const;

      if (conflict.operation === 'delete') {
        if (!isIdPayload(conflict.localData)) {
          logger.warn('Conflict local data missing id for delete operation', conflict);
        } else {
          await this.db!.put('offlineQueue', {
            ...baseEntry,
            type: 'delete',
            data: { id: conflict.localData.id },
          });
        }
      } else {
        await this.db!.put('offlineQueue', {
          ...baseEntry,
          type: conflict.operation,
          data: conflict.localData as OfflineEntityData<typeof conflict.entity>,
        });
      }
    }
    
    // Mark conflict as resolved
    conflict.resolved = true;
    await this.db!.put('conflicts', conflict);
  }

  // Cache management
  async clearOldData(daysToKeep = 30): Promise<void> {
    if (!this.db) await this.init();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const tx = this.db!.transaction(['transactions'], 'readwrite');
    const transactions = await tx.objectStore('transactions').getAll();
    
    for (const transaction of transactions) {
      if (new Date(transaction.date) < cutoffDate && transaction.syncStatus === 'synced') {
        await tx.objectStore('transactions').delete(transaction.id);
      }
    }
    
    await tx.done;
  }

  // Utility methods
  async getOfflineQueueCount(): Promise<number> {
    if (!this.db) await this.init();
    return this.db!.count('offlineQueue');
  }

  async clearOfflineData(): Promise<void> {
    if (!this.db) await this.init();
    
    const stores = ['transactions', 'accounts', 'budgets', 'goals', 'offlineQueue', 'conflicts'] as const;
    
    const tx = this.db!.transaction(stores, 'readwrite');
    
    for (const store of stores) {
      await tx.objectStore(store).clear();
    }
    
    await tx.done;
  }
}

// Export singleton instance
export const offlineService = new OfflineService();
