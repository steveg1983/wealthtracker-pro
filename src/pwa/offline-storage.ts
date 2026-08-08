/**
 * Offline Storage Service
 * Manages offline data storage and synchronization for PWA
 */

import React from 'react';
import { indexedDBService } from '../services/indexedDBService';
import type { Transaction, Account, Budget, Goal } from '../types';

const offlineLogger = typeof console !== 'undefined'
  ? console
  : { log: () => {}, error: () => {} };

type OfflineEntityData = Transaction | Account | Budget | Goal | Record<string, unknown>;

export interface OfflineQueueItem {
  id?: string;
  type: 'create' | 'update' | 'delete';
  entity: 'transaction' | 'account' | 'budget' | 'goal';
  data: OfflineEntityData;
  timestamp: number;
  synced: boolean;
  retries: number;
  error?: string;
}

export interface ConflictItem {
  id?: string;
  operationId: string;
  entity: OfflineQueueItem['entity'];
  resolved: boolean;
  resolutionData?: OfflineEntityData;
  localData: OfflineEntityData;
  remoteData: OfflineEntityData;
  timestamp: number;
}

export interface OfflineState {
  isOffline: boolean;
  pendingChanges: number;
  lastSync: Date | null;
  syncInProgress: boolean;
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
      offlineLogger.error('[OfflineStorage] Failed to initialize stores:', error);
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

    await indexedDBService.put(this.OFFLINE_QUEUE_STORE, { ...queueItem });
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
      offlineLogger.log(`[OfflineStorage] Syncing ${operations.length} operations`);

      for (const operation of operations) {
        try {
          await this.syncOperation(operation);
          
          // Mark as synced
          operation.synced = true;
          await indexedDBService.put(this.OFFLINE_QUEUE_STORE, { ...operation });
          
          // Remove from queue after successful sync
          await indexedDBService.delete(this.OFFLINE_QUEUE_STORE, operation.id!);
          this.offlineState.pendingChanges--;
        } catch (error) {
          offlineLogger.error(`[OfflineStorage] Failed to sync operation ${operation.id}:`, error);
          
          const conflictError = error as { status?: number; data?: OfflineEntityData };
          if (conflictError?.status === 409 && conflictError.data) {
            await this.handleConflict(operation, conflictError.data);
            continue;
          }

          // Increment retry count
          operation.retries++;
          operation.error = (error as Error).message;
          
          if (operation.retries >= 3) {
            offlineLogger.error(`[OfflineStorage] Operation ${operation.id} failed after 3 retries`);
          } else {
            await indexedDBService.put(this.OFFLINE_QUEUE_STORE, { ...operation });
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
    
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Offline-Sync': 'true',
        'X-Client-Timestamp': operation.timestamp.toString()
      },
      body: method !== 'DELETE' ? JSON.stringify(operation.data) : undefined
    });

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
    const id = operation.data?.id;

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
   * Record a sync conflict and surface it, for a person to resolve.
   *
   * It used to try to resolve one itself first, and those resolvers were
   * deleted: they merged MONEY with float arithmetic (a balance delta added
   * back onto the server's figure, a budget reduced to the smaller of two
   * amounts) and did it silently, on data the user never saw. Field-level
   * merging with the financial rules spelled out lives in
   * services/conflictResolutionService, which is what the conflict UI uses;
   * this path's job is to keep the conflict and say so.
   */
  private async handleConflict(operation: OfflineQueueItem, serverData: OfflineEntityData) {
    const conflict: ConflictItem = {
      id: crypto.randomUUID(),
      operationId: operation.id ?? crypto.randomUUID(),
      entity: operation.entity,
      localData: operation.data,
      remoteData: serverData,
      timestamp: Date.now(),
      resolved: false
    };

    await indexedDBService.put(this.CONFLICT_STORE, { ...conflict });
    this.notifyConflict(conflict);
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
          const data = await response.json();
          await indexedDBService.put(this.OFFLINE_DATA_STORE, { id: key, ...data });
        }
      } catch (error) {
        offlineLogger.error(`[OfflineStorage] Failed to cache ${key}:`, error);
      }
    }
  }

  /**
   * Get cached data
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    const data = await indexedDBService.get<T>(this.OFFLINE_DATA_STORE, key);
    return data ?? null;
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
  async getConflicts() {
    const allKeys = await indexedDBService.getAllKeys(this.CONFLICT_STORE);
    const conflicts = [];

    for (const key of allKeys) {
      if (key !== 'init') {
        const conflict = await indexedDBService.get<ConflictItem>(this.CONFLICT_STORE, key);
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
  async resolveConflict(conflictId: string, resolution: OfflineEntityData) {
    const conflict = await indexedDBService.get<ConflictItem>(this.CONFLICT_STORE, conflictId);
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
    await indexedDBService.put(this.CONFLICT_STORE, { ...conflict });
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
  private notifyConflict(conflict: ConflictItem) {
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
      setState((event as CustomEvent<OfflineState>).detail);
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
    (conflictId: string, resolution: OfflineEntityData) => 
      offlineStorage.resolveConflict(conflictId, resolution),
    []
  );

  return { queue, sync, getConflicts, resolveConflict };
};
