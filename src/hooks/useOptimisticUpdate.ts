import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppDispatch } from '../store';

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
  const [_isProcessing, _setIsProcessing] = useState(false);
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = retryTimeouts.current;
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
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
      originalData,
      optimisticData,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    setUpdates(prev => new Map(prev).set(id, update));
    return update;
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
      return next;
    });

    // Clean up successful updates after a delay
    setTimeout(() => {
      setUpdates(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }, 5000);

    const update = updates.get(id);
    if (update?.optimisticData && onSuccess) {
      onSuccess(update.optimisticData);
    }
  }, [updates, onSuccess]);

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
      return next;
    });

    const update = updates.get(id);
    if (update && onError) {
      onError(new Error(error), update.originalData);
    }
  }, [updates, onError]);

  // Retry failed update
  const retryUpdate = useCallback((id: string, apiCall: () => Promise<T>) => {
    const update = updates.get(id);
    if (!update || update.retryCount >= maxRetries) {
      markFailed(id, 'Max retries exceeded');
      return;
    }

    const delay = retryDelay * Math.pow(2, update.retryCount); // Exponential backoff
    
    const timeout = setTimeout(async () => {
      try {
        setUpdates(prev => {
          const next = new Map(prev);
          const update = next.get(id);
          if (update) {
            update.retryCount++;
            next.set(id, update);
          }
          return next;
        });

        const result = await apiCall();
        markSuccess(id, result);
      } catch {
        retryUpdate(id, apiCall);
      }
    }, delay);

    retryTimeouts.current.set(id, timeout);
  }, [updates, maxRetries, retryDelay, markSuccess, markFailed]);

  // Execute optimistic create
  const optimisticCreate = useCallback(async <TCreate extends T>(
    data: TCreate,
    apiCall: () => Promise<TCreate>
  ): Promise<TCreate> => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticData = { ...data, id: tempId };
    
    addOptimisticUpdate(tempId, 'create', optimisticData);

    try {
      const result = await apiCall();
      
      // Replace temp ID with real ID
      setUpdates(prev => {
        const next = new Map(prev);
        next.delete(tempId);
        next.set(result.id, {
          ...next.get(tempId)!,
          id: result.id,
          optimisticData: result
        });
        return next;
      });
      
      markSuccess(result.id, result);
      return result;
    } catch (error) {
      markFailed(tempId, (error as Error).message);
      retryUpdate(tempId, apiCall);
      throw error;
    }
  }, [addOptimisticUpdate, markSuccess, markFailed, retryUpdate]);

  // Execute optimistic update
  const optimisticUpdate = useCallback(async (
    id: string,
    updates: Partial<T>,
    currentData: T,
    apiCall: () => Promise<T>
  ): Promise<T> => {
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
    }
  }, [addOptimisticUpdate, markSuccess, markFailed, retryUpdate, conflictResolver]);

  // Execute optimistic delete
  const optimisticDelete = useCallback(async (
    id: string,
    currentData: T,
    apiCall: () => Promise<void>
  ): Promise<void> => {
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
    }
  }, [addOptimisticUpdate, markSuccess, markFailed, retryUpdate]);

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
    const update = updates.get(id);
    return update?.status === 'pending' || false;
  }, [updates]);

  // Get update status for an item
  const getUpdateStatus = useCallback((id: string): OptimisticUpdate<T>['status'] | null => {
    return updates.get(id)?.status || null;
  }, [updates]);

  // Clear all updates
  const clearUpdates = useCallback(() => {
    retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    retryTimeouts.current.clear();
    setUpdates(new Map());
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
    optimisticUpdate: (data: T) => { type: string; payload: T };
    rollback: (originalData: T) => { type: string; payload: T };
    confirm: (data: T) => { type: string; payload: T };
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
  private onUpdate?: (queue: OptimisticUpdate<T>[]) => void;

  constructor(onUpdate?: (queue: OptimisticUpdate<T>[]) => void) {
    this.onUpdate = onUpdate;
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
      
      try {
        await processor(update);
        update.status = 'success';
      } catch (error) {
        update.status = 'failed';
        update.error = (error as Error).message;
        
        if (update.retryCount < 3) {
          update.retryCount++;
          // Move to end of queue for retry
          this.queue.push(this.queue.shift()!);
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
    if (this.onUpdate) {
      this.onUpdate([...this.queue]);
    }
  }

  get length() {
    return this.queue.length;
  }

  get isProcessing() {
    return this.processing;
  }
}