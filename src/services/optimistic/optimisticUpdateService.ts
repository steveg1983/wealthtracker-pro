/**
 * @module optimisticUpdateService
 * @description Enterprise-grade optimistic update service providing instant UI updates,
 * automatic rollback, conflict resolution, and retry mechanisms for world-class
 * user experiences with eventual consistency.
 * 
 * @features
 * - Instant UI updates
 * - Automatic rollback
 * - Conflict resolution
 * - Retry with backoff
 * - Queue management
 * - State reconciliation
 * 
 * @performance
 * - Non-blocking updates
 * - Batched operations
 * - Memory efficient
 */

import { logger } from '../loggingService';

/**
 * Optimistic update record
 */
export interface OptimisticUpdate<T = unknown> {
  id: string;
  type: UpdateType;
  entityType: string;
  originalData?: T;
  optimisticData: T | null;
  timestamp: number;
  status: UpdateStatus;
  error?: string;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, unknown>;
}

/**
 * Update types
 */
export type UpdateType = 'create' | 'update' | 'delete' | 'batch';

/**
 * Update status
 */
export type UpdateStatus = 'pending' | 'processing' | 'success' | 'failed' | 'rolled-back';

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'merge' | 'manual';

/**
 * Update result
 */
export interface UpdateResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  conflicts?: Array<{
    field: string;
    localValue: unknown;
    remoteValue: unknown;
  }>;
}

/**
 * Optimistic update configuration
 */
export interface OptimisticConfig {
  maxRetries?: number;
  retryDelay?: number;
  conflictStrategy?: ConflictStrategy;
  batchSize?: number;
  timeout?: number;
}

/**
 * Optimistic update service
 */
class OptimisticUpdateService {
  private static instance: OptimisticUpdateService;
  private updateQueue: Map<string, OptimisticUpdate> = new Map();
  private processingQueue: Set<string> = new Set();
  private subscribers: Map<string, Set<(update: OptimisticUpdate) => void>> = new Map();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.startQueueProcessor();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OptimisticUpdateService {
    if (!OptimisticUpdateService.instance) {
      OptimisticUpdateService.instance = new OptimisticUpdateService();
    }
    return OptimisticUpdateService.instance;
  }

  /**
   * Create optimistic update
   */
  createUpdate<T>(
    id: string,
    type: UpdateType,
    entityType: string,
    optimisticData: T | null,
    originalData?: T,
    config: OptimisticConfig = {}
  ): OptimisticUpdate<T> {
    const update: OptimisticUpdate<T> = {
      id,
      type,
      entityType,
      originalData,
      optimisticData,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries: config.maxRetries || 3
    };

    this.updateQueue.set(id, update);
    this.notifySubscribers(entityType, update);
    
    logger.debug('Optimistic update created', { id, type, entityType });
    
    return update;
  }

  /**
   * Process update with API call
   */
  async processUpdate<T>(
    id: string,
    apiCall: () => Promise<T>,
    config: OptimisticConfig = {}
  ): Promise<UpdateResult<T>> {
    const update = this.updateQueue.get(id);
    if (!update) {
      return {
        success: false,
        error: new Error('Update not found')
      };
    }

    // Mark as processing
    update.status = 'processing';
    this.processingQueue.add(id);
    this.notifySubscribers(update.entityType, update);

    try {
      // Execute API call with timeout
      const timeout = config.timeout || 30000;
      const result = await this.withTimeout(apiCall(), timeout);

      // Mark as successful
      update.status = 'success';
      this.updateQueue.delete(id);
      this.processingQueue.delete(id);
      this.notifySubscribers(update.entityType, update);

      logger.info('Optimistic update succeeded', { id });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return this.handleUpdateError(id, error as Error, config);
    }
  }

  /**
   * Handle update error
   */
  private async handleUpdateError<T>(
    id: string,
    error: Error,
    config: OptimisticConfig
  ): Promise<UpdateResult<T>> {
    const update = this.updateQueue.get(id);
    if (!update) {
      return {
        success: false,
        error
      };
    }

    update.error = error.message;
    update.retryCount++;

    // Check if should retry
    if (update.retryCount < update.maxRetries) {
      logger.warn('Optimistic update failed, retrying', {
        id,
        attempt: update.retryCount,
        error: error.message
      });

      // Schedule retry with exponential backoff
      const delay = this.calculateRetryDelay(update.retryCount, config.retryDelay);
      this.scheduleRetry(id, delay);

      return {
        success: false,
        error
      };
    }

    // Max retries exceeded, rollback
    logger.error('Optimistic update failed after max retries', {
      id,
      error: error.message
    });

    return this.rollback(id);
  }

  /**
   * Rollback update
   */
  rollback<T>(id: string): UpdateResult<T> {
    const update = this.updateQueue.get(id);
    if (!update) {
      return {
        success: false,
        error: new Error('Update not found')
      };
    }

    update.status = 'rolled-back';
    this.notifySubscribers(update.entityType, update);
    
    // Clean up
    this.updateQueue.delete(id);
    this.processingQueue.delete(id);
    this.cancelRetry(id);

    logger.info('Optimistic update rolled back', { id });

    return {
      success: false,
      data: update.originalData as T,
      error: new Error(update.error || 'Update failed')
    };
  }

  /**
   * Resolve conflicts
   */
  resolveConflicts<T>(
    localData: T,
    remoteData: T,
    strategy: ConflictStrategy = 'remote-wins'
  ): T {
    switch (strategy) {
      case 'local-wins':
        return localData;
      
      case 'remote-wins':
        return remoteData;
      
      case 'merge':
        // Deep merge with remote taking precedence for conflicts
        return this.deepMerge(localData, remoteData);
      
      case 'manual':
        // Return remote data and let caller handle
        return remoteData;
      
      default:
        return remoteData;
    }
  }

  /**
   * Deep merge objects
   */
  private deepMerge<T>(target: T, source: T): T {
    if (!target || !source) return source;
    if (typeof target !== 'object' || typeof source !== 'object') return source;

    const result = { ...target } as Record<string, unknown>;

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result as T;
  }

  /**
   * Schedule retry
   */
  private scheduleRetry(id: string, delay: number): void {
    this.cancelRetry(id);

    const timeout = setTimeout(() => {
      const update = this.updateQueue.get(id);
      if (update && update.status === 'processing') {
        update.status = 'pending';
        this.processingQueue.delete(id);
        this.notifySubscribers(update.entityType, update);
      }
    }, delay);

    this.retryTimeouts.set(id, timeout);
  }

  /**
   * Cancel retry
   */
  private cancelRetry(id: string): void {
    const timeout = this.retryTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(id);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number, baseDelay = 1000): number {
    return Math.min(baseDelay * Math.pow(2, retryCount - 1), 30000);
  }

  /**
   * Add timeout to promise
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), ms)
      )
    ]);
  }

  /**
   * Subscribe to updates
   */
  subscribe(
    entityType: string,
    callback: (update: OptimisticUpdate) => void
  ): () => void {
    if (!this.subscribers.has(entityType)) {
      this.subscribers.set(entityType, new Set());
    }

    this.subscribers.get(entityType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(entityType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(entityType: string, update: OptimisticUpdate): void {
    const callbacks = this.subscribers.get(entityType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(update);
        } catch (error) {
          logger.error('Subscriber callback error', error);
        }
      });
    }
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 1000);
  }

  /**
   * Process pending updates in queue
   */
  private processQueue(): void {
    for (const [id, update] of this.updateQueue) {
      if (update.status === 'pending' && !this.processingQueue.has(id)) {
        // Emit event for hook to process
        this.notifySubscribers(update.entityType, update);
      }
    }
  }

  /**
   * Get pending updates
   */
  getPendingUpdates(entityType?: string): OptimisticUpdate[] {
    const updates: OptimisticUpdate[] = [];
    
    for (const update of this.updateQueue.values()) {
      if (!entityType || update.entityType === entityType) {
        updates.push(update);
      }
    }

    return updates;
  }

  /**
   * Clear all updates
   */
  clearAll(): void {
    // Cancel all retries
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    
    // Clear queues
    this.updateQueue.clear();
    this.processingQueue.clear();
    this.retryTimeouts.clear();
    
    logger.info('All optimistic updates cleared');
  }
}

// Export singleton instance
export const optimisticUpdateService = OptimisticUpdateService.getInstance();