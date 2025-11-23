import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Transaction, Account, Budget, Goal } from '../types';

// Define the database schema
interface OfflineDB extends DBSchema {
  transactions: {
    key: string;
    value: Transaction & { syncStatus?: 'pending' | 'synced' | 'error'; syncError?: string };
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
    value: OfflineQueueItem;
  };
  conflicts: {
    key: string;
    value: ConflictRecord;
  };
}

interface WindowLike {
  addEventListener?: Window['addEventListener'];
  removeEventListener?: Window['removeEventListener'];
  dispatchEvent?: Window['dispatchEvent'];
}

interface DocumentLike {
  addEventListener?: Document['addEventListener'];
  removeEventListener?: Document['removeEventListener'];
  hidden?: boolean;
}

interface NavigatorLike {
  onLine?: boolean;
  serviceWorker?: Pick<typeof navigator.serviceWorker, 'ready'>;
}

type DbFactory = () => Promise<IDBPDatabase<OfflineDB>>;
type Logger = Pick<Console, 'log' | 'warn' | 'error'>;
type OfflineEntity = Transaction | Account | Budget | Goal | Record<string, unknown>;

interface OfflineQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'transaction' | 'account' | 'budget' | 'goal';
  data: OfflineEntity;
  timestamp: number;
  retries: number;
  lastError?: string;
}

interface ConflictRecord {
  id: string;
  entity: OfflineQueueItem['entity'];
  localData: OfflineEntity;
  serverData: OfflineEntity | null;
  timestamp: number;
  resolved: boolean;
}

export interface OfflineServiceOptions {
  windowRef?: WindowLike | null;
  documentRef?: DocumentLike | null;
  navigatorRef?: NavigatorLike | null;
  dbFactory?: DbFactory;
  logger?: Logger;
}

export class OfflineService {
  private db: IDBPDatabase<OfflineDB> | null = null;
  private syncInProgress = false;
  private readonly DB_NAME = 'WealthTrackerOffline';
  private readonly DB_VERSION = 1;
  private windowRef: WindowLike | null;
  private documentRef: DocumentLike | null;
  private navigatorRef: NavigatorLike | null;
  private onlineHandler?: () => void;
  private visibilityHandler?: () => void;
  private readonly dbFactory: DbFactory;
  private readonly logger: Logger;

  constructor(options: OfflineServiceOptions = {}) {
    this.windowRef = options.windowRef ?? (typeof window !== 'undefined' ? window : null);
    this.documentRef = options.documentRef ?? (typeof document !== 'undefined' ? document : null);
    this.navigatorRef = options.navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : null);
    this.dbFactory = options.dbFactory ?? (() =>
      openDB<OfflineDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
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
        }
      })
    );
    const defaultLogger = typeof console !== 'undefined'
      ? console
      : { log: () => {}, warn: () => {}, error: () => {} };
    this.logger = options.logger ?? defaultLogger;
  }

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await this.dbFactory();

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    this.onlineHandler = () => {
      this.logger.log('Back online - starting sync');
      void this.syncOfflineData();
    };
    this.windowRef?.addEventListener?.('online', this.onlineHandler);

    this.visibilityHandler = () => {
      if (!this.documentRef?.hidden && this.navigatorRef?.onLine) {
        void this.syncOfflineData();
      }
    };
    this.documentRef?.addEventListener?.('visibilitychange', this.visibilityHandler);

    const hasSyncManager = Boolean((this.windowRef as { SyncManager?: unknown } | null)?.SyncManager);
    if (this.navigatorRef?.serviceWorker?.ready && hasSyncManager) {
      this.navigatorRef.serviceWorker.ready
        .then((registration) => (registration as ServiceWorkerRegistration & {
          sync?: { register?: (tag: string) => Promise<void> };
        }).sync?.register?.('sync-offline-data'))
        .catch((err) => this.logger.error('Failed to register background sync:', err));
    }
  }

  destroy(): void {
    if (this.windowRef && this.onlineHandler) {
      this.windowRef.removeEventListener?.('online', this.onlineHandler);
    }
    if (this.documentRef && this.visibilityHandler) {
      this.documentRef.removeEventListener?.('visibilitychange', this.visibilityHandler);
    }
  }

  // Transaction operations
  async saveTransaction(transaction: Transaction, isOffline = false): Promise<void> {
    if (!this.db) await this.init();
    
    const tx = this.db!.transaction(['transactions', 'offlineQueue'], 'readwrite');
    
    // Save to local store
    await tx.objectStore('transactions').put({
      ...transaction,
      syncStatus: isOffline ? 'pending' : 'synced',
    });

    // If offline, add to queue
    if (isOffline) {
      await tx.objectStore('offlineQueue').put({
        id: `transaction-${transaction.id}-${Date.now()}`,
        type: 'create',
        entity: 'transaction',
        data: transaction,
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
      const updated = {
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
    if (this.syncInProgress || !this.navigatorRef?.onLine) return;
    
    this.syncInProgress = true;
    
    try {
      if (!this.db) await this.init();
      
      // Get all pending items from queue
      const queue = await this.db!.getAll('offlineQueue');
      
      // Sort by timestamp to maintain order
      queue.sort((a, b) => a.timestamp - b.timestamp);
      
      this.logger.log(`Syncing ${queue.length} offline items`);
      
      for (const item of queue) {
        try {
          await this.syncQueueItem(item);
          // Remove from queue on success
          await this.db!.delete('offlineQueue', item.id);
        } catch (error) {
          this.logger.error(`Failed to sync item ${item.id}:`, error);
          
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
      this.windowRef?.dispatchEvent?.(new CustomEvent('offline-sync-complete', {
        detail: { itemsSynced: queue.length }
      }));
      
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncQueueItem(item: OfflineQueueItem): Promise<void> {
    // This would call your actual API endpoints
    // For now, we'll simulate the sync
    
    const endpoint = `/api/${item.entity}${item.type === 'delete' ? `/${item.data.id}` : ''}`;
    const method = item.type === 'create' ? 'POST' : item.type === 'update' ? 'PUT' : 'DELETE';
    
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: item.type !== 'delete' ? JSON.stringify(item.data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
    
    // Update local sync status
    if (item.entity === 'transaction' && item.type !== 'delete') {
      await this.db!.put('transactions', {
        ...item.data,
        syncStatus: 'synced',
      });
    }
  }

  private async handleSyncConflict(item: OfflineQueueItem): Promise<void> {
    if (!this.db) await this.init();
    
    await this.db!.put('conflicts', {
      id: `conflict-${item.id}`,
      entity: item.entity,
      localData: item.data,
      serverData: null, // Would be populated from server response
      timestamp: Date.now(),
      resolved: false,
    });
    
    // Emit conflict event
    this.windowRef?.dispatchEvent?.(new CustomEvent('offline-sync-conflict', {
      detail: { entity: item.entity, data: item.data }
    }));
  }

  // Conflict resolution
  async getConflicts(): Promise<ConflictRecord[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('conflicts');
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'server'): Promise<void> {
    if (!this.db) await this.init();
    
    const conflict = await this.db!.get('conflicts', conflictId);
    if (!conflict) return;
    
    if (resolution === 'local') {
      // Re-queue the local change
      await this.db!.put('offlineQueue', {
        id: `resolved-${conflictId}`,
        type: 'update',
        entity: conflict.entity as 'transaction' | 'account' | 'budget' | 'goal',
        data: conflict.localData,
        timestamp: Date.now(),
        retries: 0,
      });
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

    const tx = this.db!.transaction([...stores], 'readwrite');

    for (const store of stores) {
      await tx.objectStore(store).clear();
    }
    
    await tx.done;
  }
}

// Export singleton instance
export const offlineService = new OfflineService();
