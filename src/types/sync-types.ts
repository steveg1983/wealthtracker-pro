import type { Account, Transaction, Budget, Goal, Category } from './index';
import type {
  AutoSyncConfig,
  ConflictAnalysis as BaseConflictAnalysis,
  ConflictResolutionEvent as BaseConflictResolutionEvent,
  OfflineQueueItem as BaseOfflineQueueItem,
  SyncEventPayload as BaseSyncEventPayload,
  SyncEventType,
  SyncMetrics,
  SyncOperation as BaseSyncOperation,
  SyncQueueItem as BaseSyncQueueItem,
  SyncStatus as BaseSyncStatus,
  SyncStatusLabel,
  SyncConflict as BaseSyncConflict,
  SyncData as BaseSyncData,
  SyncEntityType,
  VectorClock,
  SocketAckResponse,
} from '@wealthtracker/types/sync';

export type EntityDataMap = {
  transaction: Transaction;
  account: Account;
  budget: Budget;
  goal: Goal;
  category: Category;
};

export type EntityType = SyncEntityType<EntityDataMap>;

export type SyncData<T extends EntityType> = BaseSyncData<EntityDataMap, T>;

export type SyncOperation<T extends EntityType = EntityType> = BaseSyncOperation<EntityDataMap, T>;

export type SyncConflict<T extends EntityType = EntityType> = BaseSyncConflict<EntityDataMap, T>;

export type SyncStatus = BaseSyncStatus<EntityDataMap>;

export type SyncQueueItem<T extends EntityType = EntityType> = BaseSyncQueueItem<EntityDataMap, T>;

export type SyncEventPayload<T extends EntityType = EntityType> = BaseSyncEventPayload<EntityDataMap, T>;

export type ConflictResolutionEvent<T extends EntityType = EntityType> =
  BaseConflictResolutionEvent<EntityDataMap, T>;

export type ConflictAnalysis<T extends EntityType = EntityType> = BaseConflictAnalysis<EntityDataMap, T>;

export type OfflineQueueItem<T extends EntityType = EntityType> = BaseOfflineQueueItem<EntityDataMap, T>;

export type { SyncEventType, AutoSyncConfig, SyncMetrics, SyncStatusLabel, VectorClock, SocketAckResponse };

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

export function getTypeGuard<T extends EntityType>(entity: T) {
  const guards = {
    transaction: isTransactionData,
    account: isAccountData,
    budget: isBudgetData,
    goal: isGoalData,
    category: isCategoryData,
  } as const;
  return guards[entity];
}
