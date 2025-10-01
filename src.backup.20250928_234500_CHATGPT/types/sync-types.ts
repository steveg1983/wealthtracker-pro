/**
 * Professional-grade type definitions for sync operations
 * Zero tolerance for 'any' types - everything is properly typed
 */

import type { Account, Transaction, Budget, Goal, Category } from './index';

// Entity data types map
export type EntityDataMap = {
  transaction: Transaction;
  account: Account;
  budget: Budget;
  goal: Goal;
  category: Category;
};

// Entity type union
export type EntityType = keyof EntityDataMap;

// Generic sync data type that ensures type safety
export type SyncData<T extends EntityType> = EntityDataMap[T];

// Sync operation with proper typing
export interface SyncOperation<T extends EntityType = EntityType> {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: T;
  entityId: string;
  data: SyncData<T>;
  timestamp: number;
  clientId: string;
  version: number;
}

// Sync conflict with proper typing
export interface SyncConflict<T extends EntityType = EntityType> {
  id: string;
  localOperation: SyncOperation<T>;
  remoteOperation: SyncOperation<T>;
  resolution?: 'local' | 'remote' | 'merge';
  mergedData?: SyncData<T>;
}

// Sync status
export interface SyncStatus {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime?: Date;
  pendingOperations: number;
  conflicts: SyncConflict[];
  error?: string;
}

// Vector clock for conflict resolution
export interface VectorClock {
  [clientId: string]: number;
}

// Sync queue item with proper typing
export interface SyncQueueItem<T extends EntityType = EntityType> {
  operation: SyncOperation<T>;
  retryCount: number;
  maxRetries: number;
}

// Sync event types
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

// Sync event payload
export interface SyncEventPayload<T extends EntityType = EntityType> {
  entity: T;
  entityId: string;
  data: SyncData<T>;
  type: string;
  timestamp?: number;
}

export interface ConflictResolutionEvent<T extends EntityType = EntityType> {
  type: 'conflict-detected' | 'conflict-auto-resolved';
  conflict: SyncConflict<T>;
  analysis: ConflictAnalysis<T>;
  resolution?: 'local' | 'remote' | 'merge';
  mergedData?: SyncData<T>;
}

// Socket acknowledgment response
export interface SocketAckResponse {
  success: boolean;
  error?: string;
  conflictId?: string;
  version?: number;
}

// Conflict analysis result
export interface ConflictAnalysis<T extends EntityType = EntityType> {
  hasConflict: boolean;
  conflictingFields: string[];
  nonConflictingFields: string[];
  canAutoResolve: boolean;
  suggestedResolution: 'merge' | 'client' | 'server' | 'manual';
  mergedData?: SyncData<T>;
  confidence: number;
  severity?: 'low' | 'medium' | 'high';
}

// Offline queue item
export interface OfflineQueueItem<T extends EntityType = EntityType> {
  id: string;
  operation: SyncOperation<T>;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  retries: number;
  error?: string;
}

// Auto sync configuration
export interface AutoSyncConfig {
  enabled: boolean;
  intervalMs: number;
  retryDelayMs: number;
  maxRetries: number;
  conflictResolution: 'auto' | 'manual';
  offlineQueueLimit: number;
}

// Sync metrics for monitoring
export interface SyncMetrics {
  totalOperations: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflicts: number;
  averageSyncTimeMs: number;
  lastSyncDuration: number;
  dataTransferredBytes: number;
}

// Type guards for runtime type checking
export function isTransactionData(data: unknown): data is Transaction {
  return typeof data === 'object' && data !== null && 'amount' in data && 'date' in data;
}

export function isAccountData(data: unknown): data is Account {
  return typeof data === 'object' && data !== null && 'balance' in data && 'name' in data;
}

export function isBudgetData(data: unknown): data is Budget {
  return typeof data === 'object' && data !== null && 'categoryId' in data && 'amount' in data;
}

export function isGoalData(data: unknown): data is Goal {
  return typeof data === 'object' && data !== null && 'targetAmount' in data && 'currentAmount' in data;
}

export function isCategoryData(data: unknown): data is Category {
  return typeof data === 'object' && data !== null && 'name' in data && 'type' in data;
}

// Helper to get type guard for entity type
export function getTypeGuard<T extends EntityType>(entity: T) {
  const guards = {
    transaction: isTransactionData,
    account: isAccountData,
    budget: isBudgetData,
    goal: isGoalData,
    category: isCategoryData,
  };
  return guards[entity];
}
