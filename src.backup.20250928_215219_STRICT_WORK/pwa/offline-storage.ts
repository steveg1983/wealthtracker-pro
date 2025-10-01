/**
 * Offline Storage Service
 * Manages offline data storage and synchronization for PWA
 */

import React from 'react';
import { indexedDBService } from '../services/indexedDBService';
import type { Transaction, Account, Budget, Goal } from '../types';
import { logger } from '../services/loggingService';

export interface OfflineQueueItem {
  id?: string;
  type: 'create' | 'update' | 'delete';
  entity: 'transaction' | 'account' | 'budget' | 'goal';
  data: unknown;
  timestamp: number;
  synced: boolean;
  retries: number;
  error?: string;
}

interface StoredConflict extends Record<string, unknown> {
  id: string;
  operationId: string;
  clientData: unknown;
  serverData: unknown;
  entity: OfflineQueueItem['entity'];
  timestamp: number;
  resolved: boolean;
  resolutionData?: unknown;
}

export interface OfflineState {
  isOffline: boolean;
  pendingChanges: number;
  lastSync: Date | null;
  syncInProgress: boolean;
}

export interface ConflictResolution<T> {
  client: T;
  server: T;
  resolved: T | null;
  strategy: 'client-wins' | 'server-wins' | 'merge' | 'manual';
}

class OfflineStorageService {
  private readonly OFFLINE_QUEUE_STORE = 'offline-queue';
  private readonly OFFLINE_DATA_STORE = 'offline-data';
  private readonly CONFLICT_STORE = 'conflicts';
  private readonly SYNC_META_STORE = 'sync-metadata';
  
  private syncInProgress = false;
  private offlineState: OfflineState = {
    isOffline: !navigator.onLine,
    pendingChanges: 0,
    lastSync: null,
    syncInProgress: false
  };

  private toRecord(value: object): Record<string, unknown> {
    return value as unknown as Record<string, unknown>;
  }

  constructor() {
    this.initializeOfflineDetection();
    this.initializeStores();
  }

  /**
   * Initialize offline detection
   */
  private initializeOfflineDetection() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Check connection periodically
    setInterval(() => this.checkConnectivity(), 30000); // Every 30 seconds
  }

  /**
   * Initialize IndexedDB stores
   */
  private async initializeStores() {
    try {
      // For stores with 'id' as keyPath, include id in the object
      await indexedDBService.put('offline-queue', { id: 'init', initialized: true });
      await indexedDBService.put('offline-data', { id: 'init', initialized: true });
      await indexedDBService.put('conflicts', { id: 'init', initialized: true });
      // For sync-meta store with 'key' as keyPath
      await indexedDBService.put('sync-meta', { key: 'lastSync', timestamp: null });
    } catch (error) {
      logger.error('[OfflineStorage] Failed to initialize stores:', error);
    }
  }

  /**
   * Check connectivity status
   */
  private async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Handle going online
   */
  private async handleOnline() {
    this.offlineState.isOffline = false;
    this.notifyStateChange();
    
    // Start sync process
    await this.syncOfflineData();
  }

  /**
   * Handle going offline
   */
  private handleOffline() {
    this.offlineState.isOffline = true;
    this.notifyStateChange();
    
    // Pre-cache essential data
    this.cacheEssentialData();
  }

  /**
   * Queue an offline operation
   */
  async queueOfflineOperation(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'synced' | 'retries'>) {
    const queueItem: OfflineQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      synced: false,
      retries: 0
    };

    await indexedDBService.put(this.OFFLINE_QUEUE_STORE, this.toRecord(queueItem));
    this.offlineState.pendingChanges++;
    this.notifyStateChange();

    // If online, try to sync immediately
    if (!this.offlineState.isOffline) {
      this.syncOfflineData();
    }

    return queueItem.id;
  }

  /**
   * Get all pending offline operations
   */
  async getPendingOperations(): Promise<OfflineQueueItem[]> {
    const allKeys = await indexedDBService.getAllKeys(this.OFFLINE_QUEUE_STORE);
    const operations: OfflineQueueItem[] = [];

    for (const key of allKeys) {
      if (key !== 'init') {
        const operation = await indexedDBService.get<OfflineQueueItem>(this.OFFLINE_QUEUE_STORE, key);
        if (operation && !operation.synced) {
          operations.push(operation);
        }
      }
    }

    return operations.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Sync offline data with server
   */
  async syncOfflineData(): Promise<void> {
    if (this.syncInProgress || this.offlineState.isOffline) {
      return;
    }

    this.syncInProgress = true;
    this.offlineState.syncInProgress = true;
    this.notifyStateChange();

    try {
      const operations = await this.getPendingOperations();
      logger.info('[OfflineStorage] Syncing operations', { count: operations.length });

      for (const operation of operations) {
        try {
          await this.syncOperation(operation);
          
          // Mark as synced
          operation.synced = true;
          await indexedDBService.put(this.OFFLINE_QUEUE_STORE, this.toRecord(operation));
          
          // Remove from queue after successful sync
          await indexedDBService.delete(this.OFFLINE_QUEUE_STORE, operation.id!);
          this.offlineState.pendingChanges--;
        } catch (error) {
          logger.error(`[OfflineStorage] Failed to sync operation ${operation.id}:`, error);
          
          // Handle conflict
          if ((error as any).status === 409) {
            await this.handleConflict(operation, (error as any).data);
          } else {
            // Increment retry count
            operation.retries++;
            operation.error = (error as Error).message;
            
            if (operation.retries >= 3) {
              // Move to dead letter queue or handle differently
              logger.error(`[OfflineStorage] Operation ${operation.id} failed after 3 retries`);
            } else {
              await indexedDBService.put(this.OFFLINE_QUEUE_STORE, this.toRecord(operation));
            }
          }
        }
      }

      // Update last sync time
      this.offlineState.lastSync = new Date();
      await indexedDBService.put(this.SYNC_META_STORE, { 
        key: 'lastSync',
        timestamp: this.offlineState.lastSync.toISOString() 
      });

    } finally {
      this.syncInProgress = false;
      this.offlineState.syncInProgress = false;
      this.notifyStateChange();
    }
  }

  /**
   * Sync a single operation
   */
  private async syncOperation(operation: OfflineQueueItem): Promise<void> {
    const endpoint = this.getEndpoint(operation);
    const method = this.getMethod(operation);
    
    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Offline-Sync': 'true',
        'X-Client-Timestamp': operation.timestamp.toString()
      }
    };

    if (method !== 'DELETE') {
      requestInit.body = JSON.stringify(operation.data ?? {});
    }

    const response = await fetch(endpoint, requestInit);

    if (!response.ok) {
      const error = await response.json();
      throw { status: response.status, data: error };
    }

    return response.json();
  }

  /**
   * Get API endpoint for operation
   */
  private getEndpoint(operation: OfflineQueueItem): string {
    const baseUrl = '/api';
    const dataRecord = operation.data as { id?: string } | undefined;
    const id = dataRecord?.id;

    switch (operation.entity) {
      case 'transaction':
        return operation.type === 'create' 
          ? `${baseUrl}/transactions`
          : `${baseUrl}/transactions/${id}`;
      
      case 'account':
        return operation.type === 'create'
          ? `${baseUrl}/accounts`
          : `${baseUrl}/accounts/${id}`;
      
      case 'budget':
        return operation.type === 'create'
          ? `${baseUrl}/budgets`
          : `${baseUrl}/budgets/${id}`;
      
      case 'goal':
        return operation.type === 'create'
          ? `${baseUrl}/goals`
          : `${baseUrl}/goals/${id}`;
      
      default:
        throw new Error(`Unknown entity type: ${operation.entity}`);
    }
  }

  /**
   * Get HTTP method for operation
   */
  private getMethod(operation: OfflineQueueItem): string {
    switch (operation.type) {
      case 'create': return 'POST';
      case 'update': return 'PUT';
      case 'delete': return 'DELETE';
      default: throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Handle sync conflicts
   */
  private async handleConflict(operation: OfflineQueueItem, serverData: unknown) {
    const conflict: StoredConflict = {
      id: crypto.randomUUID(),
      operationId: operation.id ?? crypto.randomUUID(),
      clientData: operation.data,
      serverData,
      entity: operation.entity,
      timestamp: Date.now(),
      resolved: false
    };

    await indexedDBService.put(this.CONFLICT_STORE, this.toRecord(conflict));
    
    // Notify about conflict
    this.notifyConflict(conflict);
    
    // Try automatic resolution
    const resolution = await this.autoResolveConflict(operation, serverData);
    if (resolution.resolved) {
      // Update operation with resolved data
      operation.data = resolution.resolved;
      await this.syncOperation(operation);
      
      // Mark conflict as resolved
      conflict.resolved = true;
      await indexedDBService.put(this.CONFLICT_STORE, this.toRecord(conflict));
    }
  }

  /**
   * Auto-resolve conflicts based on strategy
   */
  private async autoResolveConflict(
    operation: OfflineQueueItem, 
    serverData: unknown
  ): Promise<ConflictResolution<unknown>> {
    const clientData = operation.data;
    
    switch (operation.entity) {
      case 'transaction':
        return this.resolveTransactionConflict(
          clientData as Transaction,
          serverData as Transaction
        ) as ConflictResolution<unknown>;
      
      case 'account':
        return this.resolveAccountConflict(
          clientData as Account,
          serverData as Account
        ) as ConflictResolution<unknown>;
      
      case 'budget':
        return this.resolveBudgetConflict(
          clientData as Budget,
          serverData as Budget
        ) as ConflictResolution<unknown>;
      
      default:
        return {
          client: clientData,
          server: serverData,
          resolved: null,
          strategy: 'manual'
        };
    }
  }

  /**
   * Resolve transaction conflicts
   */
  private resolveTransactionConflict(client: Transaction, server: Transaction): ConflictResolution<Transaction> {
    // If timestamps are different, use the most recent
    if (client.date !== server.date) {
      const clientDate = new Date(client.date).getTime();
      const serverDate = new Date(server.date).getTime();
      
      return {
        client,
        server,
        resolved: clientDate > serverDate ? client : server,
        strategy: 'client-wins'
      };
    }
    
    // Otherwise require manual resolution
    return {
      client,
      server,
      resolved: null,
      strategy: 'manual'
    };
  }

  /**
   * Resolve account conflicts
   */
  private resolveAccountConflict(client: Account, server: Account): ConflictResolution<Account> {
    // For balance conflicts, calculate the difference
    const balanceDiff = client.balance - (client as any).originalBalance;
    
    return {
      client,
      server,
      resolved: {
        ...server,
        balance: server.balance + balanceDiff
      },
      strategy: 'merge'
    };
  }

  /**
   * Resolve budget conflicts
   */
  private resolveBudgetConflict(client: Budget, server: Budget): ConflictResolution<Budget> {
    // Use the most restrictive budget
    return {
      client,
      server,
      resolved: {
        ...server,
        amount: Math.min(client.amount, server.amount),
        spent: Math.max(client.spent || 0, server.spent || 0)
      },
      strategy: 'merge'
    };
  }

  /**
   * Cache essential data for offline use
   */
  async cacheEssentialData() {
    const essentialData = [
      { key: 'accounts', url: '/api/accounts' },
      { key: 'transactions', url: '/api/transactions?limit=100' },
      { key: 'categories', url: '/api/categories' },
      { key: 'budgets', url: '/api/budgets' },
      { key: 'tags', url: '/api/tags' }
    ];

    for (const { key, url } of essentialData) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const payload = await response.json();
          if (payload && typeof payload === 'object') {
            await indexedDBService.put(this.OFFLINE_DATA_STORE, {
              id: key,
              ...(payload as Record<string, unknown>)
            });
          }
        }
      } catch (error) {
        logger.error(`[OfflineStorage] Failed to cache ${key}:`, error);
      }
    }
  }

  /**
   * Get cached data
   */
  async getCachedData<T>(key: string): Promise<T | undefined> {
    return indexedDBService.get<T>(this.OFFLINE_DATA_STORE, key);
  }

  /**
   * Get offline state
   */
  getOfflineState(): OfflineState {
    return { ...this.offlineState };
  }

  /**
   * Get conflicts
   */
  async getConflicts(): Promise<StoredConflict[]> {
    const allKeys = await indexedDBService.getAllKeys(this.CONFLICT_STORE);
    const conflicts: StoredConflict[] = [];

    for (const key of allKeys) {
      if (key !== 'init') {
        const conflict = await indexedDBService.get<StoredConflict>(this.CONFLICT_STORE, key);
        if (conflict && !conflict.resolved) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Manually resolve a conflict
   */
  async resolveConflict(conflictId: string, resolution: unknown) {
    const conflict = await indexedDBService.get<StoredConflict>(this.CONFLICT_STORE, conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    // Update the original operation with resolved data
    const operation = await indexedDBService.get<OfflineQueueItem>(
      this.OFFLINE_QUEUE_STORE, 
      conflict.operationId
    );
    
    if (operation) {
      operation.data = resolution;
      await this.syncOperation(operation);
    }

    // Mark conflict as resolved
    conflict.resolved = true;
    conflict.resolutionData = resolution;
    await indexedDBService.put(this.CONFLICT_STORE, this.toRecord(conflict));
  }

  /**
   * Clear all offline data
   */
  async clearOfflineData() {
    await indexedDBService.clearStore(this.OFFLINE_QUEUE_STORE);
    await indexedDBService.clearStore(this.OFFLINE_DATA_STORE);
    await indexedDBService.clearStore(this.CONFLICT_STORE);
    
    this.offlineState.pendingChanges = 0;
    this.offlineState.lastSync = null;
    this.notifyStateChange();
  }

  /**
   * Notify about state changes
   */
  private notifyStateChange() {
    window.dispatchEvent(new CustomEvent('offline-state-change', {
      detail: this.getOfflineState()
    }));
  }

  /**
   * Notify about conflicts
   */
  private notifyConflict(conflict: StoredConflict) {
    window.dispatchEvent(new CustomEvent('sync-conflict', {
      detail: conflict
    }));
  }
}

// Create singleton instance
export const offlineStorage = new OfflineStorageService();

// React hook for offline state
export const useOfflineState = () => {
  const [state, setState] = React.useState(offlineStorage.getOfflineState());

  React.useEffect(() => {
    const handleStateChange = (event: Event) => {
      setState((event as CustomEvent).detail);
    };

    window.addEventListener('offline-state-change', handleStateChange);
    return () => window.removeEventListener('offline-state-change', handleStateChange);
  }, []);

  return state;
};

// React hook for offline operations
export const useOfflineOperations = () => {
  const queue = React.useCallback(
    (item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'synced' | 'retries'>) => 
      offlineStorage.queueOfflineOperation(item),
    []
  );

  const sync = React.useCallback(
    () => offlineStorage.syncOfflineData(),
    []
  );

  const getConflicts = React.useCallback(
    () => offlineStorage.getConflicts(),
    []
  );

  const resolveConflict = React.useCallback(
    (conflictId: string, resolution: any) => 
      offlineStorage.resolveConflict(conflictId, resolution),
    []
  );

  return { queue, sync, getConflicts, resolveConflict };
};
