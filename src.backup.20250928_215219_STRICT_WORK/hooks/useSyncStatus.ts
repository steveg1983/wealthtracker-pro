import { useEffect, useState, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import type { SyncStatus } from '../components/SyncStatusIndicator';

interface SyncStatusHook {
  status: SyncStatus;
  lastSyncTime: Date | null;
  pendingChanges: number;
  error: string | null;
  triggerSync: () => Promise<void>;
  syncProgress: number; // 0-100
  syncMessage: string;
  conflictCount: number;
  syncHistory: SyncHistoryEntry[];
  clearError: () => void;
  resolveConflict: (id: string, resolution: 'local' | 'remote') => Promise<void>;
}

interface SyncHistoryEntry {
  id: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'partial';
  itemsSynced: number;
  conflicts: number;
  duration: number;
  error?: string;
}

interface SyncConflict {
  id: string;
  type: 'account' | 'transaction' | 'budget' | 'category';
  localValue: any;
  remoteValue: any;
  timestamp: Date;
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
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>(() => {
    const stored = localStorage.getItem('syncHistory');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      })).slice(0, 50); // Keep last 50 entries
    }
    return [];
  });

  // Listen for data changes
  useEffect(() => {
    const handleDataChange = (event: CustomEvent): void => {
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

    window.addEventListener('data-changed' as any, handleDataChange);
    return () => {
      window.removeEventListener('data-changed' as any, handleDataChange);
    };
  }, [isOnline]);

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
  }, [isOnline, pendingChanges]);

  const triggerSync = useCallback(async (): Promise<void> => {
    if (!isOnline || status === 'syncing') return;

    const startTime = Date.now();
    setStatus('syncing');
    setError(null);
    setSyncProgress(0);
    setSyncMessage('Preparing to sync...');

    try {
      // Simulate progressive sync stages
      const stages = [
        { progress: 20, message: 'Fetching remote changes...', delay: 300 },
        { progress: 40, message: 'Comparing data...', delay: 400 },
        { progress: 60, message: 'Merging changes...', delay: 500 },
        { progress: 80, message: 'Updating local data...', delay: 400 },
        { progress: 100, message: 'Finalizing sync...', delay: 200 }
      ];

      for (const stage of stages) {
        setSyncProgress(stage.progress);
        setSyncMessage(stage.message);
        await new Promise(resolve => setTimeout(resolve, stage.delay));
      }

      // Check for conflicts (simulate randomly for demo)
      const hasConflicts = Math.random() > 0.8;
      if (hasConflicts) {
        const mockConflict: SyncConflict = {
          id: `conflict-${Date.now()}`,
          type: 'transaction',
          localValue: { amount: 100, description: 'Local change' },
          remoteValue: { amount: 105, description: 'Remote change' },
          timestamp: new Date()
        };
        setConflicts([mockConflict]);
        setSyncMessage('Sync completed with conflicts');
      } else {
        setSyncMessage('All changes synced successfully');
      }

      const now = new Date();
      const duration = Date.now() - startTime;
      
      // Add to sync history
      const historyEntry: SyncHistoryEntry = {
        id: `sync-${Date.now()}`,
        timestamp: now,
        status: hasConflicts ? 'partial' : 'success',
        itemsSynced: pendingChanges,
        conflicts: hasConflicts ? 1 : 0,
        duration
      };
      
      setSyncHistory(prev => {
        const updated = [historyEntry, ...prev].slice(0, 50);
        localStorage.setItem('syncHistory', JSON.stringify(updated));
        return updated;
      });

      setLastSyncTime(now);
      localStorage.setItem('lastSyncTime', now.toISOString());
      setPendingChanges(hasConflicts ? 1 : 0);
      setStatus(hasConflicts ? 'error' : 'synced');
      
      if (hasConflicts) {
        setError('Sync completed with conflicts. Please resolve them.');
      }

      // Dispatch sync complete event
      window.dispatchEvent(new CustomEvent('sync-complete', {
        detail: { timestamp: now, hasConflicts, duration }
      }));
    } catch (err) {
      const duration = Date.now() - startTime;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Sync failed');
      setSyncProgress(0);
      setSyncMessage('Sync failed');
      
      // Add failed entry to history
      const historyEntry: SyncHistoryEntry = {
        id: `sync-${Date.now()}`,
        timestamp: new Date(),
        status: 'failed',
        itemsSynced: 0,
        conflicts: 0,
        duration,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
      
      setSyncHistory(prev => {
        const updated = [historyEntry, ...prev].slice(0, 50);
        localStorage.setItem('syncHistory', JSON.stringify(updated));
        return updated;
      });
      
      // Dispatch sync error event
      window.dispatchEvent(new CustomEvent('sync-error', {
        detail: { error: err, duration }
      }));
    }
  }, [isOnline, status, pendingChanges]);

  const clearError = useCallback((): void => {
    setError(null);
    if (status === 'error' && conflicts.length === 0) {
      setStatus(pendingChanges > 0 ? 'pending' : 'synced');
    }
  }, [status, conflicts.length, pendingChanges]);

  const resolveConflict = useCallback(async (id: string, resolution: 'local' | 'remote'): Promise<void> => {
    setSyncMessage(`Resolving conflict (${resolution})...`);
    
    // Simulate conflict resolution
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setConflicts(prev => prev.filter(c => c.id !== id));
    
    // If all conflicts resolved, clear error state
    if (conflicts.length <= 1) {
      setError(null);
      setStatus('synced');
      setSyncMessage('All conflicts resolved');
    }
    
    // Dispatch conflict resolved event
    window.dispatchEvent(new CustomEvent('conflict-resolved', {
      detail: { id, resolution }
    }));
  }, [conflicts.length]);

  return {
    status,
    lastSyncTime,
    pendingChanges,
    error,
    triggerSync,
    syncProgress,
    syncMessage,
    conflictCount: conflicts.length,
    syncHistory,
    clearError,
    resolveConflict
  };
}