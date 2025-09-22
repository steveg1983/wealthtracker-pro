/**
 * Core type definitions for conflict resolution
 * Enterprise-grade TypeScript for data synchronization conflicts
 */

/**
 * Base conflict data structure with generic type support
 */
export interface ConflictData<T = unknown> {
  id: string;
  entityType: 'transaction' | 'account' | 'category' | 'budget' | 'goal' | 'investment';
  conflictType: 'update' | 'delete' | 'create' | 'merge';
  timestamp: Date;
  clientVersion: T;
  serverVersion: T;
  baseVersion?: T;
  metadata: ConflictMetadata;
}

/**
 * Metadata associated with a conflict
 */
export interface ConflictMetadata {
  userId: string;
  deviceId: string;
  syncSessionId: string;
  detectedAt: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  autoResolvable: boolean;
  affectedFields?: string[];
  relatedConflicts?: string[];
}

/**
 * Resolution strategies for conflicts
 */
export type ResolutionStrategy = 
  | 'client'    // Keep client version
  | 'server'    // Keep server version
  | 'merge'     // Merge both versions
  | 'manual'    // Require user intervention
  | 'newest'    // Keep most recent
  | 'custom';   // Custom resolution logic

/**
 * Merged data result with proper typing
 */
export interface MergedData<T> {
  result: T;
  mergeStrategy: 'automatic' | 'manual' | 'ai-suggested';
  confidence: number; // 0-1 confidence score
  changedFields: Array<{
    field: keyof T;
    clientValue: T[keyof T];
    serverValue: T[keyof T];
    mergedValue: T[keyof T];
    strategy: 'client' | 'server' | 'combined' | 'computed';
  }>;
}

/**
 * Conflict resolution handler with full type safety
 */
export type ConflictResolutionHandler<T = unknown> = (
  resolution: ResolutionStrategy,
  mergedData?: MergedData<T>
) => Promise<void>;

/**
 * Transaction-specific conflict data
 */
export interface TransactionConflict extends ConflictData<Transaction> {
  entityType: 'transaction';
  specificFields?: {
    amount?: { client: number; server: number };
    category?: { client: string; server: string };
    date?: { client: Date; server: Date };
    description?: { client: string; server: string };
  };
}

/**
 * Account-specific conflict data
 */
export interface AccountConflict extends ConflictData<Account> {
  entityType: 'account';
  balanceDiscrepancy?: number;
  transactionCountDiff?: number;
}

/**
 * Type guards for specific conflict types
 */
export const isTransactionConflict = (
  conflict: ConflictData
): conflict is TransactionConflict => {
  return conflict.entityType === 'transaction';
};

export const isAccountConflict = (
  conflict: ConflictData
): conflict is AccountConflict => {
  return conflict.entityType === 'account';
};

/**
 * Conflict resolution result
 */
export interface ResolutionResult {
  success: boolean;
  conflictId: string;
  resolution: ResolutionStrategy;
  finalData: unknown;
  timestamp: Date;
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/**
 * Batch conflict resolution for multiple conflicts
 */
export interface BatchResolution {
  conflicts: ConflictData[];
  strategy: ResolutionStrategy | ((conflict: ConflictData) => ResolutionStrategy);
  options?: {
    stopOnError?: boolean;
    parallel?: boolean;
    maxRetries?: number;
  };
}

// Type imports (these should match your existing types)
interface Transaction {
  id: string;
  amount: number;
  date: Date;
  description: string;
  category: string;
  accountId: string;
  // ... other transaction fields
}

interface Account {
  id: string;
  name: string;
  balance: number;
  type: string;
  // ... other account fields
}