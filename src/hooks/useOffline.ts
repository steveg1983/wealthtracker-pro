import { useState, useEffect, useCallback } from 'react';
import { offlineService } from '../services/offlineService';
import { lazyLogger as logger } from '../services/serviceFactory';

interface UseOfflineReturn {
  isOffline: boolean;
  isSyncing: boolean;
  pendingChanges: number;
  syncNow: () => Promise<void>;
  clearOfflineData: () => Promise<void>;
}

export function useOffline(): UseOfflineReturn {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);

  // Initialize offline service
  useEffect(() => {
    offlineService.init().catch(console.error);
  }, []);

  // Update pending changes count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await offlineService.getOfflineQueueCount();
      setPendingChanges(count);
    } catch (error) {
      logger.error('Failed to get offline queue count:', error);
    }
  }, []);

  useEffect(() => {
    // Set up online/offline listeners
    const handleOnline = () => {
      setIsOffline(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    // Set up sync event listeners
    const handleSyncStart = () => {
      setIsSyncing(true);
    };

    const handleSyncComplete = () => {
      setIsSyncing(false);
      updatePendingCount();
    };

    const handleSyncConflict = (event: Event) => {
      const customEvent = event as CustomEvent;
      logger.warn('Sync conflict detected:', customEvent.detail);
      // Could show a notification here
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sync-start', handleSyncStart);
    window.addEventListener('offline-sync-complete', handleSyncComplete);
    window.addEventListener('offline-sync-conflict', handleSyncConflict);

    // Initial pending count
    updatePendingCount();

    // Update pending count periodically
    const interval = setInterval(updatePendingCount, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sync-start', handleSyncStart);
      window.removeEventListener('offline-sync-complete', handleSyncComplete);
      window.removeEventListener('offline-sync-conflict', handleSyncConflict);
      clearInterval(interval);
    };
  }, [updatePendingCount]);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) {
      logger.warn('Cannot sync while offline');
      return;
    }

    setIsSyncing(true);
    window.dispatchEvent(new Event('offline-sync-start'));

    try {
      await offlineService.syncOfflineData();
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const clearOfflineData = useCallback(async () => {
    if (confirm('Are you sure you want to clear all offline data? This cannot be undone.')) {
      await offlineService.clearOfflineData();
      setPendingChanges(0);
    }
  }, []);

  return {
    isOffline,
    isSyncing,
    pendingChanges,
    syncNow,
    clearOfflineData,
  };
}

// Hook for offline-capable data operations
interface UseOfflineDataOptions {
  entity: 'transaction' | 'account' | 'budget' | 'goal';
  onConflict?: (conflict: any) => void;
}

export function useOfflineData<T extends { id: string }>(options: UseOfflineDataOptions) {
  const { isOffline } = useOffline();

  const save = useCallback(async (data: T): Promise<void> => {
    // If online, save to API first
    if (!isOffline) {
      try {
        const response = await fetch(`/api/${options.entity}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error('Failed to save');
        }
      } catch (error) {
        logger.error('API save failed, saving offline:', error);
        // Fall through to offline save
      }
    }

    // Always save to offline store
    if (options.entity === 'transaction') {
      await offlineService.saveTransaction(data as any, isOffline);
    }
    // Add other entity types as needed
  }, [isOffline, options.entity]);

  const update = useCallback(async (id: string, updates: Partial<T>): Promise<void> => {
    // If online, update via API first
    if (!isOffline) {
      try {
        const response = await fetch(`/api/${options.entity}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error('Failed to update');
        }
      } catch (error) {
        logger.error('API update failed, updating offline:', error);
        // Fall through to offline update
      }
    }

    // Always update offline store
    if (options.entity === 'transaction') {
      await offlineService.updateTransaction(id, updates as any, isOffline);
    }
    // Add other entity types as needed
  }, [isOffline, options.entity]);

  const remove = useCallback(async (id: string): Promise<void> => {
    // If online, delete via API first
    if (!isOffline) {
      try {
        const response = await fetch(`/api/${options.entity}/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete');
        }
      } catch (error) {
        logger.error('API delete failed, deleting offline:', error);
        // Fall through to offline delete
      }
    }

    // Always delete from offline store
    if (options.entity === 'transaction') {
      await offlineService.deleteTransaction(id, isOffline);
    }
    // Add other entity types as needed
  }, [isOffline, options.entity]);

  return {
    save,
    update,
    remove,
    isOffline,
  };
}