export type SyncEntityType<EntityMap extends Record<string, unknown>> = keyof EntityMap;

export type SyncData<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap>,
> = EntityMap[T];

export interface SyncOperation<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap> = SyncEntityType<EntityMap>,
> {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: T;
  entityId: string;
  data: SyncData<EntityMap, T>;
  timestamp: number;
  clientId: string;
  version: number;
}

export interface SyncConflict<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap> = SyncEntityType<EntityMap>,
> {
  id: string;
  localOperation: SyncOperation<EntityMap, T>;
  remoteOperation: SyncOperation<EntityMap, T>;
  resolution?: 'local' | 'remote' | 'merge';
  mergedData?: SyncData<EntityMap, T>;
}

export interface SyncStatus<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap> = SyncEntityType<EntityMap>,
> {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime?: Date;
  pendingOperations: number;
  conflicts: Array<SyncConflict<EntityMap, T>>;
  error?: string;
}

export type SyncStatusLabel = 'synced' | 'syncing' | 'pending' | 'error' | 'offline';

export interface VectorClock {
  [clientId: string]: number;
}

export interface SyncQueueItem<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap> = SyncEntityType<EntityMap>,
> {
  operation: SyncOperation<EntityMap, T>;
  retryCount: number;
  maxRetries: number;
}

export type SyncEventType =
  | 'connected'
  | 'disconnected'
  | 'sync-start'
  | 'sync-complete'
  | 'sync-failed'
  | 'conflict-detected'
  | 'conflict-resolved'
  | 'remote-create'
  | 'remote-update'
  | 'remote-delete'
  | 'remote-merge';

export interface SyncEventPayload<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap> = SyncEntityType<EntityMap>,
> {
  entity: T;
  entityId: string;
  data: SyncData<EntityMap, T>;
  type: string;
  timestamp?: number;
}

export interface ConflictAnalyticsPayload<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap> = SyncEntityType<EntityMap>,
> {
  entity: T;
  conflictId?: string;
  fields: string[];
  resolution: 'merge' | 'client' | 'server' | 'manual';
  confidence?: number;
  autoResolvable?: boolean;
}

export interface ConflictAnalysis<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap> = SyncEntityType<EntityMap>,
> {
  hasConflict: boolean;
  conflictingFields: string[];
  nonConflictingFields: string[];
  canAutoResolve: boolean;
  suggestedResolution: 'merge' | 'client' | 'server' | 'manual';
  mergedData?: SyncData<EntityMap, T>;
  confidence: number;
  severity?: 'low' | 'medium' | 'high';
}

export interface ConflictResolutionEvent<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap> = SyncEntityType<EntityMap>,
> {
  type: 'conflict-detected' | 'conflict-auto-resolved';
  conflict: SyncConflict<EntityMap, T>;
  analysis: ConflictAnalysis<EntityMap, T>;
  resolution?: 'local' | 'remote' | 'merge';
  mergedData?: SyncData<EntityMap, T>;
}

export interface SocketAckResponse {
  success: boolean;
  error?: string;
  conflictId?: string;
  version?: number;
}

export interface OfflineQueueItem<
  EntityMap extends Record<string, unknown>,
  T extends SyncEntityType<EntityMap> = SyncEntityType<EntityMap>,
> {
  id: string;
  operation: SyncOperation<EntityMap, T>;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  retries: number;
  error?: string;
}

export interface AutoSyncConfig {
  enabled: boolean;
  intervalMs: number;
  retryDelayMs: number;
  maxRetries: number;
  conflictResolution: 'auto' | 'manual';
  offlineQueueLimit: number;
}

export interface SyncMetrics {
  totalOperations: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflicts: number;
  averageSyncTimeMs: number;
  lastSyncDuration: number;
  dataTransferredBytes: number;
}
