import { useState, useCallback, useRef, useEffect } from 'react';
import type { AnyAction } from '@reduxjs/toolkit';
import { useAppDispatch } from '../store/hooks/useAppRedux';

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

interface OptimisticUpdate<T> {
  id: string;
  type: 'create' | 'update' | 'delete';
  originalData?: T;
  optimisticData: T | null;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  retryCount: number;
}

interface UseOptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error, rollbackData?: T) => void;
  maxRetries?: number;
  retryDelay?: number;
  conflictResolver?: (local: T, remote: T) => T;
}

/**
 * Hook for optimistic updates with automatic rollback
 * Design principles:
 * 1. Instant UI updates
 * 2. Automatic rollback on failure
 * 3. Conflict resolution
 * 4. Retry logic with exponential backoff
 * 5. Queue management for multiple updates
 */
export function useOptimisticUpdate<T extends { id: string }>(
  options: UseOptimisticUpdateOptions<T> = {}
) {
  const {
    onSuccess,
    onError,
    maxRetries = 3,
    retryDelay = 1000,
    conflictResolver
  } = options;

  const [updates, setUpdates] = useState<Map<string, OptimisticUpdate<T>>>(new Map());
  const updatesRef = useRef<Map<string, OptimisticUpdate<T>>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const retryTimeouts = useRef<Map<string, TimerHandle>>(new Map());
  const processingCount = useRef(0);

  const beginProcessing = useCallback(() => {
    processingCount.current += 1;
    if (processingCount.current === 1) {
      setIsProcessing(true);
    }
  }, []);

  const endProcessing = useCallback(() => {
    processingCount.current = Math.max(0, processingCount.current - 1);
    if (processingCount.current === 0) {
      setIsProcessing(false);
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = retryTimeouts.current;
    return () => {
      timeouts.forEach(timeout => globalThis.clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  // Add optimistic update
  const addOptimisticUpdate = useCallback((
    id: string,
    type: 'create' | 'update' | 'delete',
    optimisticData: T | null,
    originalData?: T
  ) => {
    const update: OptimisticUpdate<T> = {
      id,
      type,
      optimisticData,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      ...(originalData !== undefined ? { originalData } : {})
    };

    setUpdates(prev => {
      const next = new Map(prev).set(id, update);
      updatesRef.current = next;
      return next;
    });
    return update;
  }, []);

  const clearScheduledRetry = useCallback((id: string) => {
    const existingTimeout = retryTimeouts.current.get(id);
    if (existingTimeout) {
      globalThis.clearTimeout(existingTimeout);
      retryTimeouts.current.delete(id);
    }
  }, []);

  // Mark update as successful
  const markSuccess = useCallback((id: string, finalData?: T) => {
    setUpdates(prev => {
      const next = new Map(prev);
      const update = next.get(id);
      if (update) {
        update.status = 'success';
        if (finalData) {
          update.optimisticData = finalData;
        }
        next.set(id, update);
      }
      updatesRef.current = next;
      return next;
    });

    // Clean up successful updates after a delay
    clearScheduledRetry(id);
    const cleanupTimeout = globalThis.setTimeout(() => {
      setUpdates(prev => {
        const next = new Map(prev);
        next.delete(id);
        updatesRef.current = next;
        return next;
      });
      retryTimeouts.current.delete(id);
    }, 5000);
    retryTimeouts.current.set(id, cleanupTimeout);

    const currentUpdate = updatesRef.current.get(id);
    if (currentUpdate?.optimisticData && onSuccess) {
      onSuccess(currentUpdate.optimisticData);
    }
  }, [clearScheduledRetry, onSuccess]);

  // Mark update as failed and handle rollback
  const markFailed = useCallback((id: string, error: string) => {
    setUpdates(prev => {
      const next = new Map(prev);
      const update = next.get(id);
      if (update) {
        update.status = 'failed';
        update.error = error;
        next.set(id, update);
      }
      updatesRef.current = next;
      return next;
    });

    const currentUpdate = updatesRef.current.get(id);
    if (currentUpdate && onError) {
      onError(new Error(error), currentUpdate.originalData);
    }
  }, [onError]);

  // Retry failed update
  const retryUpdate = useCallback((id: string, apiCall: () => Promise<T>) => {
    const update = updatesRef.current.get(id);
    if (!update) {
      return;
    }

    if (update.retryCount >= maxRetries) {
      markFailed(id, 'Max retries exceeded');
      return;
    }

    const nextRetryCount = update.retryCount + 1;
    const delay = retryDelay * Math.pow(2, update.retryCount); // Exponential backoff

    setUpdates(prev => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) {
        entry.retryCount = nextRetryCount;
        entry.status = 'pending';
        delete entry.error;
        next.set(id, entry);
      }
      updatesRef.current = next;
      return next;
    });

    clearScheduledRetry(id);

    const timeout = globalThis.setTimeout(async () => {
      retryTimeouts.current.delete(id);
      try {
        const result = await apiCall();
        markSuccess(id, result);
      } catch {
        retryUpdate(id, apiCall);
      }
    }, delay);

    retryTimeouts.current.set(id, timeout);
  }, [clearScheduledRetry, markFailed, markSuccess, maxRetries, retryDelay]);

  // Execute optimistic create
  const optimisticCreate = useCallback(async <TCreate extends T>(
    data: TCreate,
    apiCall: () => Promise<TCreate>
  ): Promise<TCreate> => {
    beginProcessing();
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticData = { ...data, id: tempId };
    
    addOptimisticUpdate(tempId, 'create', optimisticData);

    try {
      const result = await apiCall();
      
      // Replace temp ID with real ID
      setUpdates(prev => {
        const next = new Map(prev);
        const existing = next.get(tempId);
        next.delete(tempId);
        if (existing) {
          next.set(result.id, {
            ...existing,
            id: result.id,
            optimisticData: result,
          });
        } else {
          next.set(result.id, {
            id: result.id,
            type: 'create',
            optimisticData: result,
            timestamp: Date.now(),
            status: 'success',
            retryCount: 0,
          });
        }
        updatesRef.current = next;
        return next;
      });
      
      markSuccess(result.id, result);
      return result;
    } catch (error) {
      markFailed(tempId, (error as Error).message);
      retryUpdate(tempId, apiCall);
      throw error;
    } finally {
      endProcessing();
    }
  }, [addOptimisticUpdate, markSuccess, markFailed, retryUpdate, beginProcessing, endProcessing]);

  // Execute optimistic update
  const optimisticUpdate = useCallback(async (
    id: string,
    updates: Partial<T>,
    currentData: T,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    beginProcessing();
    const optimisticData = { ...currentData, ...updates };
    
    addOptimisticUpdate(id, 'update', optimisticData, currentData);

    try {
      const result = await apiCall();
      
      // Handle potential conflicts
      if (conflictResolver && JSON.stringify(result) !== JSON.stringify(optimisticData)) {
        const resolved = conflictResolver(optimisticData, result);
        markSuccess(id, resolved);
        return resolved;
      }
      
      markSuccess(id, result);
      return result;
    } catch (error) {
      markFailed(id, (error as Error).message);
      retryUpdate(id, apiCall);
      throw error;
    } finally {
      endProcessing();
    }
  }, [addOptimisticUpdate, markSuccess, markFailed, retryUpdate, conflictResolver, beginProcessing, endProcessing]);

  // Execute optimistic delete
  const optimisticDelete = useCallback(async (
    id: string,
    currentData: T,
    apiCall: () => Promise<void>
  ): Promise<void> => {
    beginProcessing();
    addOptimisticUpdate(id, 'delete', null, currentData);

    try {
      await apiCall();
      markSuccess(id);
    } catch (error) {
      markFailed(id, (error as Error).message);
      retryUpdate(id, async () => {
        await apiCall();
        return currentData;
      });
      throw error;
    } finally {
      endProcessing();
    }
  }, [addOptimisticUpdate, markSuccess, markFailed, retryUpdate, beginProcessing, endProcessing]);

  // Get current state (with optimistic updates applied)
  const getOptimisticState = useCallback(<TState extends T[]>(
    originalState: TState
  ): TState => {
    let result = [...originalState] as TState;

    updates.forEach((update) => {
      if (update.status !== 'pending') return;

      switch (update.type) {
        case 'create':
          if (update.optimisticData) {
            result.push(update.optimisticData);
          }
          break;
        case 'update':
          if (update.optimisticData) {
            const index = result.findIndex(item => item.id === update.id);
            if (index !== -1) {
              result[index] = update.optimisticData;
            }
          }
          break;
        case 'delete':
          result = result.filter(item => item.id !== update.id) as TState;
          break;
      }
    });

    return result;
  }, [updates]);

  // Check if an item has pending updates
  const hasPendingUpdate = useCallback((id: string): boolean => {
    const update = updatesRef.current.get(id);
    return update?.status === 'pending' || false;
  }, []);

  // Get update status for an item
  const getUpdateStatus = useCallback((id: string): OptimisticUpdate<T>['status'] | null => {
    return updatesRef.current.get(id)?.status ?? null;
  }, []);

  // Clear all updates
  const clearUpdates = useCallback(() => {
    retryTimeouts.current.forEach(timeout => globalThis.clearTimeout(timeout));
    retryTimeouts.current.clear();
    setUpdates(() => {
      const empty = new Map<string, OptimisticUpdate<T>>();
      updatesRef.current = empty;
      return empty;
    });
  }, []);

  return {
    optimisticCreate,
    optimisticUpdate,
    optimisticDelete,
    getOptimisticState,
    hasPendingUpdate,
    getUpdateStatus,
    clearUpdates,
    updates: Array.from(updates.values()),
    isProcessing
  };
}

/**
 * Hook for optimistic Redux updates
 */
export function useOptimisticRedux<T extends { id: string }>(
  slice: string,
  actions: {
    optimisticUpdate: (data: T) => AnyAction;
    rollback: (originalData: T) => AnyAction;
    confirm: (data: T) => AnyAction;
  }
) {
  const dispatch = useAppDispatch();
  const pendingUpdates = useRef<Map<string, T>>(new Map());

  const executeOptimistic = useCallback(async (
    data: T,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    // Store original state
    pendingUpdates.current.set(data.id, data);
    
    // Dispatch optimistic update
    dispatch(actions.optimisticUpdate(data));

    try {
      const result = await apiCall();
      
      // Confirm the update
      dispatch(actions.confirm(result));
      pendingUpdates.current.delete(data.id);
      
      return result;
    } catch (error) {
      // Rollback on failure
      const original = pendingUpdates.current.get(data.id);
      if (original) {
        dispatch(actions.rollback(original));
        pendingUpdates.current.delete(data.id);
      }
      throw error;
    }
  }, [dispatch, actions]);

  return {
    executeOptimistic,
    hasPendingUpdate: (id: string) => pendingUpdates.current.has(id),
    clearPending: () => pendingUpdates.current.clear()
  };
}

/**
 * Optimistic update queue for batch operations
 */
export class OptimisticQueue<T extends { id: string }> {
  private queue: OptimisticUpdate<T>[] = [];
  private processing = false;
  private onUpdate: ((queue: OptimisticUpdate<T>[]) => void) | null;

  constructor(onUpdate?: (queue: OptimisticUpdate<T>[]) => void) {
    this.onUpdate = onUpdate ?? null;
  }

  add(update: OptimisticUpdate<T>) {
    this.queue.push(update);
    this.notifyUpdate();
  }

  async process(
    processor: (update: OptimisticUpdate<T>) => Promise<T | void>
  ) {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const update = this.queue[0];
      if (!update) {
        this.queue.shift();
        continue;
      }

      try {
        await processor(update);
        update.status = 'success';
      } catch (error) {
        update.status = 'failed';
        update.error = (error as Error).message;
        
        if (update.retryCount < 3) {
          update.retryCount++;
          const current = this.queue.shift();
          if (current) {
            this.queue.push(current);
          }
          this.notifyUpdate();
          continue;
        }
      }
      
      this.queue.shift();
      this.notifyUpdate();
    }

    this.processing = false;
  }

  clear() {
    this.queue = [];
    this.notifyUpdate();
  }

  private notifyUpdate() {
    this.onUpdate?.([...this.queue]);
  }

  get length() {
    return this.queue.length;
  }

  get isProcessing() {
    return this.processing;
  }
}
