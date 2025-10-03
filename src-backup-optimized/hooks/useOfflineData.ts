import { useState, useEffect, useCallback } from 'react';
import { offlineDataService } from '../services/offlineDataService';
import { useLogger } from '../services/ServiceProvider';

interface UseOfflineDataReturn {
  isOnline: boolean;
  syncInProgress: boolean;
  pendingSyncCount: number;
  conflicts: any[];
  addToSyncQueue: (type: 'transaction' | 'account' | 'budget' | 'goal', action: 'create' | 'update' | 'delete', data: any) => Promise<void>;
  resolveConflict: (id: string) => Promise<void>;
  triggerSync: () => Promise<void>;
  clearOfflineData: () => Promise<void>;
}

export function useOfflineData(): UseOfflineDataReturn {
  const logger = useLogger();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [conflicts, setConflicts] = useState<any[]>([]);

  // Update pending sync count
  const updatePendingSyncCount = useCallback(async () => {
    try {
      const syncs = await offlineDataService.getPendingSyncs();
      setPendingSyncCount(syncs.length);
    } catch (error) {
      logger.error('Failed to get pending syncs:', error);
    }
  }, []);

  // Update conflicts
  const updateConflicts = useCallback(async () => {
    try {
      const conflictList = await offlineDataService.getConflicts();
      setConflicts(conflictList);
    } catch (error) {
      logger.error('Failed to get conflicts:', error);
    }
  }, []);

  // Add to sync queue
  const addToSyncQueue = useCallback(async (
    type: 'transaction' | 'account' | 'budget' | 'goal',
    action: 'create' | 'update' | 'delete',
    data: any
  ) => {
    await offlineDataService.addToSyncQueue(type, action, data);
    await updatePendingSyncCount();
  }, [updatePendingSyncCount]);

  // Resolve conflict
  const resolveConflict = useCallback(async (id: string) => {
    await offlineDataService.resolveConflict(id);
    await updateConflicts();
  }, [updateConflicts]);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    setSyncInProgress(true);
    try {
      await offlineDataService.triggerSync();
    } finally {
      setSyncInProgress(false);
      await updatePendingSyncCount();
      await updateConflicts();
    }
  }, [updatePendingSyncCount, updateConflicts]);

  // Clear all offline data
  const clearOfflineData = useCallback(async () => {
    await offlineDataService.clearAllOfflineData();
    setPendingSyncCount(0);
    setConflicts([]);
  }, []);

  useEffect(() => {
    // Set up online/offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for service worker messages
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data.type === 'perform-sync') {
        offlineDataService.performSync().then(() => {
          updatePendingSyncCount();
          updateConflicts();
        });
      } else if (event.data.type === 'sync-complete') {
        updatePendingSyncCount();
        updateConflicts();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    // Initial load
    updatePendingSyncCount();
    updateConflicts();

    // Periodic updates
    const interval = setInterval(() => {
      updatePendingSyncCount();
      updateConflicts();
    }, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
      clearInterval(interval);
    };
  }, [triggerSync, updatePendingSyncCount, updateConflicts]);

  return {
    isOnline,
    syncInProgress,
    pendingSyncCount,
    conflicts,
    addToSyncQueue,
    resolveConflict,
    triggerSync,
    clearOfflineData
  };
}

// Hook for offline-capable data fetching
export function useOfflineQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    ttlMinutes?: number;
    refetchOnReconnect?: boolean;
  }
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { isOnline } = useOfflineData();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (isOnline) {
        // Try to fetch fresh data
        const freshData = await fetcher();
        setData(freshData);
        
        // Cache for offline use
        await offlineDataService.cacheData(key, freshData, options?.ttlMinutes);
      } else {
        // Offline - try to get cached data
        const cachedData = await offlineDataService.getCachedData(key);
        if (cachedData) {
          setData(cachedData);
        } else {
          throw new Error('No cached data available');
        }
      }
    } catch (err) {
      setError(err as Error);
      
      // Try to get cached data as fallback
      try {
        const cachedData = await offlineDataService.getCachedData(key);
        if (cachedData) {
          setData(cachedData);
          setError(null); // Clear error if we got cached data
        }
      } catch {
        // Ignore cache error
      }
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, isOnline, options?.ttlMinutes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch on reconnect
  useEffect(() => {
    if (isOnline && options?.refetchOnReconnect) {
      fetchData();
    }
  }, [isOnline, options?.refetchOnReconnect, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData
  };
}