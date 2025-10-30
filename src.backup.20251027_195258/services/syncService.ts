import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { ConflictResolutionService } from './conflictResolutionService';
import type {
  SyncOperation,
  SyncConflict,
  SyncStatus,
  VectorClock,
  SyncQueueItem as QueueItem,
  EntityType,
  SyncEventPayload,
  SocketAckResponse,
  ConflictAnalysis,
  SyncData,
  ConflictResolutionEvent
} from '../types/sync-types';

// Re-export for backward compatibility
export type { SyncOperation, SyncConflict, SyncStatus } from '../types/sync-types';

type IntervalHandle = ReturnType<typeof globalThis.setInterval>;
type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

type SyncServiceEventMap = {
  'status-changed': SyncStatus;
  'sync-failed': SyncOperation<EntityType>;
  'conflict-detected': ConflictResolutionEvent<EntityType>;
  'conflict-auto-resolved': ConflictResolutionEvent<EntityType>;
  'remote-create': SyncEventPayload<EntityType>;
  'remote-update': SyncEventPayload<EntityType>;
  'remote-delete': SyncEventPayload<EntityType>;
  'remote-merge': SyncEventPayload<EntityType>;
};

type SyncServiceEvent = keyof SyncServiceEventMap;
type SyncServiceRemoteEvent = Extract<SyncServiceEvent, `remote-${string}`>;

type SyncListener<K extends SyncServiceEvent> = (payload: SyncServiceEventMap[K]) => void | Promise<void>;
type SyncListenerAny = (payload: SyncServiceEventMap[SyncServiceEvent]) => void | Promise<void>;

const REMOTE_EVENT_MAP: Record<SyncOperation['type'], SyncServiceRemoteEvent> = {
  CREATE: 'remote-create',
  UPDATE: 'remote-update',
  DELETE: 'remote-delete'
};

class SyncService {
  private socket: Socket | null = null;
  private clientId: string;
  private syncQueue: QueueItem[] = [];
  private conflicts: SyncConflict[] = [];
  private vectorClocks: Map<string, VectorClock> = new Map();
  private listeners: Partial<Record<SyncServiceEvent, Set<SyncListenerAny>>> = {};
  private syncStatus: SyncStatus = {
    isConnected: false,
    isSyncing: false,
    pendingOperations: 0,
    conflicts: []
  };
  private syncInterval: IntervalHandle | null = null;
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
        this.syncQueue = queue.map((item: QueueItem) => ({
          operation: item.operation,
          retryCount: 0,
          maxRetries: 3
        }));
        this.syncStatus.pendingOperations = this.syncQueue.length;
      }
    } catch (error) {
      logger.error('Failed to load sync queue:', error);
    }
  }

  private saveQueueToStorage(): void {
    try {
      localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      logger.error('Failed to save sync queue:', error);
    }
  }

  private initializeSync(): void {
    // Only initialize if we have a backend URL configured
    const syncUrl = import.meta.env.VITE_SYNC_URL;
    if (!syncUrl) {
      logger.info('Sync service: No backend URL configured, running in offline mode');
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
      logger.error('Failed to connect to sync server:', error);
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
      logger.info('Sync service connected');
      this.syncStatus.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('status-changed', this.syncStatus);
      this.processSyncQueue();
    });

    this.socket.on('disconnect', () => {
      logger.info('Sync service disconnected');
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

    this.socket.on('error', (error: Error | { message: string }) => {
      logger.error('Sync socket error:', error);
      this.syncStatus.error = error.message;
      this.emit('status-changed', this.syncStatus);
    });
  }

  private handleConnectionError(): void {
    this.reconnectAttempts++;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
      logger.info('Sync service reconnecting', { delay, attempt: this.reconnectAttempts, max: this.maxReconnectAttempts });
      globalThis.setTimeout(() => this.connect(), delay);
    } else {
      logger.error('Max reconnection attempts reached, running in offline mode');
      this.syncStatus.error = 'Unable to connect to sync server';
      this.emit('status-changed', this.syncStatus);
    }
  }

  private startSyncInterval(): void {
    // Process queue every 5 seconds if there are pending operations
    this.syncInterval = globalThis.setInterval(() => {
      if (this.syncQueue.length > 0 && this.syncStatus.isConnected && !this.syncStatus.isSyncing) {
        this.processSyncQueue();
      }
    }, 5000);
  }

  // Public API

  public async queueOperation<T extends EntityType>(
    type: SyncOperation<T>['type'],
    entity: T,
    entityId: string,
    data: SyncOperation<T>['data']
  ): Promise<void> {
    const operation: SyncOperation<T> = {
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
        logger.error('Failed to send operation:', error);
        item.retryCount++;
        
        if (item.retryCount >= item.maxRetries) {
          // Move to failed operations
          logger.error('Operation failed after max retries:', item.operation);
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

      const timeout: TimeoutHandle = globalThis.setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, 10000);

      this.socket.emit('sync-operation', operation, (ack: SocketAckResponse) => {
        globalThis.clearTimeout(timeout);
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
    const analysis = ConflictResolutionService.analyzeConflict(
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
      logger.info('Auto-resolving conflict', { entity: conflict.localOperation.entity, confidence: analysis.confidence });
      
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
        type: 'conflict-auto-resolved',
        conflict,
        analysis,
        resolution: 'merge',
        mergedData: analysis.mergedData
      });
    } else {
      // Requires user intervention
      this.conflicts.push(conflict);
      this.syncStatus.conflicts = this.conflicts;
      this.emit('status-changed', this.syncStatus);
      this.emit('conflict-detected', {
        type: 'conflict-detected',
        conflict,
        analysis
      });
      
      // If we have a suggested resolution with high confidence, apply it
      if (analysis.confidence >= 50 && analysis.suggestedResolution !== 'manual') {
        const resolution = this.autoResolveConflict(conflict, analysis);
        if (resolution) {
          this.resolveConflict(conflict.id, resolution, analysis.mergedData);
        }
      }
    }
  }

  private autoResolveConflict(conflict: SyncConflict, analysis?: ConflictAnalysis): 'local' | 'remote' | 'merge' | null {
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

  public resolveConflict<T extends EntityType>(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: SyncData<T>
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
    const eventType = REMOTE_EVENT_MAP[operation.type];
    this.emit(eventType, {
      type: eventType,
      entity: operation.entity,
      entityId: operation.entityId,
      data: operation.data,
      timestamp: operation.timestamp
    });
  }

  private applyMergedData<T extends EntityType>(
    entity: T,
    entityId: string,
    data: SyncData<T>
  ): void {
    this.emit('remote-merge', {
      type: 'remote-merge',
      entity,
      entityId,
      data,
      timestamp: Date.now()
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
  public on<K extends SyncServiceEvent>(event: K, callback: SyncListener<K>): void {
    let listenersForEvent = this.listeners[event];
    if (!listenersForEvent) {
      listenersForEvent = new Set<SyncListenerAny>();
      this.listeners[event] = listenersForEvent;
    }
    listenersForEvent.add(callback as SyncListenerAny);
  }

  public off<K extends SyncServiceEvent>(event: K, callback: SyncListener<K>): void {
    const listenersForEvent = this.listeners[event];
    if (!listenersForEvent) {
      return;
    }
    listenersForEvent.delete(callback as SyncListenerAny);
  }

  private emit<K extends SyncServiceEvent>(event: K, data: SyncServiceEventMap[K]): void {
    const listenersForEvent = this.listeners[event];
    if (!listenersForEvent) {
      return;
    }
    listenersForEvent.forEach(listener => {
      void (listener as SyncListener<K>)(data);
    });
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
      globalThis.clearInterval(this.syncInterval);
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
import { logger } from './loggingService';
