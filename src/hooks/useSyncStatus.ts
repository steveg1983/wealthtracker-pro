import { useEffect, useState, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { SyncStatus } from '../components/SyncStatusIndicator';

interface SyncStatusHook {
  status: SyncStatus;
  lastSyncTime: Date | null;
  pendingChanges: number;
  error: string | null;
  triggerSync: () => Promise<void>;
}

// This will be replaced with actual sync service integration
// For now, we'll create a mock implementation
export function useSyncStatus(): SyncStatusHook {
  const isOnline = useOnlineStatus();
  const [status, setStatus] = useState<SyncStatus>(isOnline ? 'synced' : 'offline');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem('lastSyncTime');
    return stored ? new Date(stored) : new Date();
  });
  const [pendingChanges, setPendingChanges] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Define triggerSync first (before useEffects that reference it)
  const triggerSync = useCallback(async (): Promise<void> => {
    if (!isOnline || status === 'syncing') return;

    setStatus('syncing');
    setError(null);

    try {
      // Simulate sync delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In production, this would call the actual sync service
      // For now, we'll just simulate success
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem('lastSyncTime', now.toISOString());
      setPendingChanges(0);
      setStatus('synced');

      // Dispatch sync complete event
      window.dispatchEvent(new CustomEvent('sync-complete', {
        detail: { timestamp: now }
      }));
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Sync failed');
      
      // Dispatch sync error event
      window.dispatchEvent(new CustomEvent('sync-error', {
        detail: { error: err }
      }));
    }
  }, [isOnline, status]);

  // Listen for data changes
  useEffect(() => {
    const handleDataChange = (_event: Event): void => {
      if (isOnline) {
        setPendingChanges(prev => prev + 1);
        setStatus('pending');

        // Auto-sync after a delay
        setTimeout(() => {
          if (isOnline) {
            triggerSync();
          }
        }, 2000);
      } else {
        setPendingChanges(prev => prev + 1);
      }
    };

    window.addEventListener('data-changed', handleDataChange);
    return () => {
      window.removeEventListener('data-changed', handleDataChange);
    };
  }, [isOnline, triggerSync]);

  // Update status when online status changes
  useEffect(() => {
    if (!isOnline) {
      setStatus('offline');
    } else if (pendingChanges > 0) {
      setStatus('pending');
      // Trigger sync when coming back online
      triggerSync();
    } else {
      setStatus('synced');
    }
  }, [isOnline, pendingChanges, triggerSync]);

  return {
    status,
    lastSyncTime,
    pendingChanges,
    error,
    triggerSync
  };
}