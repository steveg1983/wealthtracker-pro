import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { ConflictResolutionService } from './conflictResolutionService';
import type { ConflictAnalysis } from './conflictResolutionService';

// Types for sync operations
export type SyncPayload = Record<string, unknown>;

export interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'transaction' | 'account' | 'budget' | 'goal' | 'category';
  entityId: string;
  data: SyncPayload;
  timestamp: number;
  clientId: string;
  version: number;
}

export interface SyncConflict {
  id: string;
  localOperation: SyncOperation;
  remoteOperation: SyncOperation;
  resolution?: 'local' | 'remote' | 'merge';
  mergedData?: SyncPayload;
}

export interface SyncStatus {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime?: Date;
  pendingOperations: number;
  conflicts: SyncConflict[];
  error?: string;
}

// Vector clock for conflict resolution
interface VectorClock {
  [clientId: string]: number;
}

// Sync queue item
interface QueueItem {
  operation: SyncOperation;
  retryCount: number;
  maxRetries: number;
}

type SyncEventCallback = (payload?: unknown) => void;

type OperationAck = { success: true; operationId?: string } | { success: false; error: string };

const isStoredQueueItem = (value: unknown): value is { operation: SyncOperation } => {
  if (typeof value !== 'object' || value === null || !('operation' in value)) {
    return false;
  }

  const operation = (value as { operation: unknown }).operation;
  return typeof operation === 'object' && operation !== null;
};

class SyncService {
  private socket: Socket | null = null;
  private clientId: string;
  private syncQueue: QueueItem[] = [];
  private conflicts: SyncConflict[] = [];
  private vectorClocks: Map<string, VectorClock> = new Map();
  private listeners: Map<string, Set<SyncEventCallback>> = new Map();
  private syncStatus: SyncStatus = {
    isConnected: false,
    isSyncing: false,
    pendingOperations: 0,
    conflicts: []
  };
  private syncInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;

  constructor() {
    this.clientId = this.getOrCreateClientId();
    this.loadQueueFromStorage();
    this.initializeSync();
  }

  private getOrCreateClientId(): string {
    let clientId = localStorage.getItem('syncClientId');
    if (!clientId) {
      clientId = uuidv4();
      localStorage.setItem('syncClientId', clientId);
    }
    return clientId;
  }

  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem('syncQueue');
      if (stored) {
        const queue = JSON.parse(stored);
        if (Array.isArray(queue)) {
          this.syncQueue = queue
            .filter(isStoredQueueItem)
            .map((item) => ({
              operation: item.operation,
              retryCount: 0,
              maxRetries: 3
            }));
          this.syncStatus.pendingOperations = this.syncQueue.length;
        }
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private saveQueueToStorage(): void {
    try {
      localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private initializeSync(): void {
    // Only initialize if we have a backend URL configured
    const syncUrl = import.meta.env.VITE_SYNC_URL;
    if (!syncUrl) {
      console.log('Sync service: No backend URL configured, running in offline mode');
      return;
    }

    this.connect();
    this.startSyncInterval();
  }

  private connect(): void {
    const syncUrl = import.meta.env.VITE_SYNC_URL;
    if (!syncUrl) return;

    try {
      this.socket = io(syncUrl, {
        auth: {
          clientId: this.clientId,
          token: this.getAuthToken()
        },
        reconnection: true,
        reconnectionDelay: this.baseReconnectDelay,
        reconnectionDelayMax: 10000,
        timeout: 20000
      });

      this.setupSocketListeners();
    } catch (error) {
      console.error('Failed to connect to sync server:', error);
      this.handleConnectionError();
    }
  }

  private getAuthToken(): string | null {
    // Get auth token from your auth service
    return localStorage.getItem('authToken');
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Sync service connected');
      this.syncStatus.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('status-changed', this.syncStatus);
      this.processSyncQueue();
    });

    this.socket.on('disconnect', () => {
      console.log('Sync service disconnected');
      this.syncStatus.isConnected = false;
      this.emit('status-changed', this.syncStatus);
    });

    this.socket.on('sync-update', (operation: SyncOperation) => {
      this.handleRemoteUpdate(operation);
    });

    this.socket.on('sync-conflict', (conflict: SyncConflict) => {
      this.handleConflict(conflict);
    });

    this.socket.on('sync-ack', (operationId: string) => {
      this.handleSyncAck(operationId);
    });

    this.socket.on('error', (error: unknown) => {
      console.error('Sync socket error:', error);
      const message = error instanceof Error ? error.message : 'Unknown socket error';
      this.syncStatus.error = message;
      this.emit('status-changed', this.syncStatus);
    });
  }

  private handleConnectionError(): void {
    this.reconnectAttempts++;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else {
      console.error('Max reconnection attempts reached, running in offline mode');
      this.syncStatus.error = 'Unable to connect to sync server';
      this.emit('status-changed', this.syncStatus);
    }
  }

  private startSyncInterval(): void {
    // Process queue every 5 seconds if there are pending operations
    this.syncInterval = setInterval(() => {
      if (this.syncQueue.length > 0 && this.syncStatus.isConnected && !this.syncStatus.isSyncing) {
        this.processSyncQueue();
      }
    }, 5000);
  }

  // Public API

  public async queueOperation(
    type: SyncOperation['type'],
    entity: SyncOperation['entity'],
    entityId: string,
    data: SyncPayload
  ): Promise<void> {
    const operation: SyncOperation = {
      id: uuidv4(),
      type,
      entity,
      entityId,
      data,
      timestamp: Date.now(),
      clientId: this.clientId,
      version: this.getNextVersion(entityId)
    };

    const queueItem: QueueItem = {
      operation,
      retryCount: 0,
      maxRetries: 3
    };

    this.syncQueue.push(queueItem);
    this.syncStatus.pendingOperations = this.syncQueue.length;
    this.saveQueueToStorage();
    this.emit('status-changed', this.syncStatus);

    // Try to process immediately if connected
    if (this.syncStatus.isConnected && !this.syncStatus.isSyncing) {
      this.processSyncQueue();
    }
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0 || !this.socket || !this.syncStatus.isConnected) {
      return;
    }

    this.syncStatus.isSyncing = true;
    this.emit('status-changed', this.syncStatus);

    const batch = this.syncQueue.slice(0, 10); // Process up to 10 items at a time

    for (const item of batch) {
      try {
        await this.sendOperation(item.operation);
        // Remove from queue after successful send
        this.syncQueue = this.syncQueue.filter(q => q.operation.id !== item.operation.id);
      } catch (error) {
        console.error('Failed to send operation:', error);
        item.retryCount++;
        
        if (item.retryCount >= item.maxRetries) {
          // Move to failed operations
          console.error('Operation failed after max retries:', item.operation);
          this.syncQueue = this.syncQueue.filter(q => q.operation.id !== item.operation.id);
          this.emit('sync-failed', item.operation);
        }
      }
    }

    this.syncStatus.isSyncing = false;
    this.syncStatus.pendingOperations = this.syncQueue.length;
    this.syncStatus.lastSyncTime = new Date();
    this.saveQueueToStorage();
    this.emit('status-changed', this.syncStatus);
  }

  private sendOperation(operation: SyncOperation): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, 10000);

      this.socket.emit('sync-operation', operation, (ack: OperationAck) => {
        clearTimeout(timeout);
        if (ack.success) {
          resolve();
        } else {
          reject(new Error(ack.error));
        }
      });
    });
  }

  private handleRemoteUpdate(operation: SyncOperation): void {
    // Check for conflicts using vector clocks
    const localVersion = this.getVersion(operation.entityId);
    
    if (localVersion && localVersion >= operation.version) {
      // Potential conflict
      const conflict: SyncConflict = {
        id: uuidv4(),
        localOperation: {
          ...operation,
          version: localVersion
        },
        remoteOperation: operation
      };
      this.handleConflict(conflict);
    } else {
      // Apply remote update
      this.applyRemoteOperation(operation);
      this.updateVectorClock(operation.entityId, operation.clientId, operation.version);
    }
  }

  private handleConflict(conflict: SyncConflict): void {
    // Use intelligent conflict resolution
    const analysis: ConflictAnalysis = ConflictResolutionService.analyzeConflict(
      conflict.localOperation.entity,
      conflict.localOperation.data,
      conflict.remoteOperation.data,
      conflict.localOperation.timestamp,
      conflict.remoteOperation.timestamp
    );

    // Check if we need user intervention
    const requiresUser = ConflictResolutionService.requiresUserIntervention(analysis);

    if (!requiresUser && analysis.canAutoResolve) {
      // Auto-resolve with merged data
      console.log(`Auto-resolving conflict for ${conflict.localOperation.entity} with ${analysis.confidence}% confidence`);
      
      if (analysis.mergedData) {
        // Apply the merged data
        this.applyMergedData(
          conflict.localOperation.entity,
          conflict.localOperation.entityId,
          analysis.mergedData
        );
        
        // Update vector clock
        this.updateVectorClock(
          conflict.localOperation.entityId,
          conflict.remoteOperation.clientId,
          Math.max(conflict.localOperation.version, conflict.remoteOperation.version) + 1
        );
      }
      
      // Emit resolution event
      this.emit('conflict-auto-resolved', {
        conflict,
        analysis,
        resolution: 'merge'
      });
    } else {
      // Requires user intervention
      this.conflicts.push(conflict);
      this.syncStatus.conflicts = this.conflicts;
      this.emit('status-changed', this.syncStatus);
      this.emit('conflict-detected', { conflict, analysis });
      
      // If we have a suggested resolution with high confidence, apply it
      if (analysis.confidence >= 50 && analysis.suggestedResolution !== 'manual') {
        const resolution = this.autoResolveConflict(conflict, analysis);
        if (resolution) {
          this.resolveConflict(conflict.id, resolution, analysis.mergedData);
        }
      }
    }
  }

  private autoResolveConflict(
    conflict: SyncConflict,
    analysis?: ConflictAnalysis
  ): 'local' | 'remote' | 'merge' | null {
    // If we have analysis, use it
    if (analysis && analysis.suggestedResolution) {
      switch (analysis.suggestedResolution) {
        case 'client':
          return 'local';
        case 'server':
          return 'remote';
        case 'merge':
          return analysis.mergedData ? 'merge' : null;
        default:
          return null;
      }
    }
    
    // Fallback to timestamp-based resolution
    if (conflict.localOperation.timestamp > conflict.remoteOperation.timestamp) {
      return 'local';
    } else if (conflict.remoteOperation.timestamp > conflict.localOperation.timestamp) {
      return 'remote';
    }
    
    // If timestamps are equal, prefer remote (server authority)
    return 'remote';
  }

  public resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: SyncPayload
  ): void {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    conflict.resolution = resolution;
    
    switch (resolution) {
      case 'local':
        // Re-queue local operation
        this.queueOperation(
          conflict.localOperation.type,
          conflict.localOperation.entity,
          conflict.localOperation.entityId,
          conflict.localOperation.data
        );
        break;
      
      case 'remote':
        // Apply remote operation
        this.applyRemoteOperation(conflict.remoteOperation);
        break;
      
      case 'merge':
        // Apply merged data
        if (mergedData) {
          conflict.mergedData = mergedData;
          this.applyMergedData(conflict.remoteOperation.entity, conflict.remoteOperation.entityId, mergedData);
        }
        break;
    }

    // Remove resolved conflict
    this.conflicts = this.conflicts.filter(c => c.id !== conflictId);
    this.syncStatus.conflicts = this.conflicts;
    this.emit('status-changed', this.syncStatus);
  }

  private applyRemoteOperation(operation: SyncOperation): void {
    // Emit event for the app to handle the update
    this.emit(`remote-${operation.type.toLowerCase()}`, {
      entity: operation.entity,
      entityId: operation.entityId,
      data: operation.data
    });
  }

  private applyMergedData(entity: string, entityId: string, data: SyncPayload): void {
    this.emit('remote-merge', {
      entity,
      entityId,
      data
    });
  }

  private handleSyncAck(operationId: string): void {
    // Remove acknowledged operation from queue
    this.syncQueue = this.syncQueue.filter(item => item.operation.id !== operationId);
    this.syncStatus.pendingOperations = this.syncQueue.length;
    this.saveQueueToStorage();
    this.emit('status-changed', this.syncStatus);
  }

  private getVersion(entityId: string): number | null {
    const clock = this.vectorClocks.get(entityId);
    if (!clock) return null;
    
    let maxVersion = 0;
    for (const version of Object.values(clock)) {
      maxVersion = Math.max(maxVersion, version);
    }
    return maxVersion;
  }

  private getNextVersion(entityId: string): number {
    const currentVersion = this.getVersion(entityId) || 0;
    return currentVersion + 1;
  }

  private updateVectorClock(entityId: string, clientId: string, version: number): void {
    let clock = this.vectorClocks.get(entityId);
    if (!clock) {
      clock = {};
      this.vectorClocks.set(entityId, clock);
    }
    clock[clientId] = version;
  }

  // Event handling
  public on(event: string, callback: SyncEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: string, callback: SyncEventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  private emit(event: string, data?: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Public status methods
  public getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  public forceSync(): void {
    if (this.syncStatus.isConnected && !this.syncStatus.isSyncing) {
      this.processSyncQueue();
    }
  }

  public clearQueue(): void {
    this.syncQueue = [];
    this.syncStatus.pendingOperations = 0;
    this.saveQueueToStorage();
    this.emit('status-changed', this.syncStatus);
  }

  public getConflicts(): SyncConflict[] {
    return [...this.conflicts];
  }

  // Cleanup
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.syncStatus.isConnected = false;
    this.emit('status-changed', this.syncStatus);
  }
}

// Singleton instance
export const syncService = new SyncService();

// Hook for React components
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = React.useState(syncService.getStatus());

  React.useEffect(() => {
    const handleStatusChange = (newStatus: SyncStatus) => {
      setStatus(newStatus);
    };

    syncService.on('status-changed', handleStatusChange);
    
    return () => {
      syncService.off('status-changed', handleStatusChange);
    };
  }, []);

  return status;
}

// React imports for the hook
import React from 'react';
