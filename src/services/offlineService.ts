import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Transaction, Account, Budget, Goal } from '../types';
import { logger } from './loggingService';

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
    value: {
      id: string;
      type: 'create' | 'update' | 'delete';
      entity: 'transaction' | 'account' | 'budget' | 'goal';
      data: any;
      timestamp: number;
      retries: number;
      lastError?: string;
    };
  };
  conflicts: {
    key: string;
    value: {
      id: string;
      entity: string;
      localData: any;
      serverData: any;
      timestamp: number;
      resolved: boolean;
    };
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
      this.syncOfflineData();
    });

    // Listen for visibility change to sync when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine) {
        this.syncOfflineData();
      }
    });

    // Background sync registration
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        return (registration as any).sync.register('sync-offline-data');
      }).catch((err) => {
        logger.error('Failed to register background sync:', err);
      });
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
        syncStatus: isOffline ? 'pending' : 'synced',
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

  private async syncQueueItem(item: any): Promise<void> {
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

  private async handleSyncConflict(item: any): Promise<void> {
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
    window.dispatchEvent(new CustomEvent('offline-sync-conflict', {
      detail: { entity: item.entity, data: item.data }
    }));
  }

  // Conflict resolution
  async getConflicts(): Promise<any[]> {
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
        entity: conflict.entity,
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
    
    const stores: Array<keyof OfflineDB> = ['transactions', 'accounts', 'budgets', 'goals', 'offlineQueue', 'conflicts'];
    
    const tx = this.db!.transaction(stores, 'readwrite');
    
    for (const store of stores) {
      await tx.objectStore(store).clear();
    }
    
    await tx.done;
  }
}

// Export singleton instance
export const offlineService = new OfflineService();
