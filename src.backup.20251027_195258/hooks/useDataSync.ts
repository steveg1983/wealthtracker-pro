import { useEffect, useCallback, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { syncService } from '../services/syncService';
import type { SyncStatus, SyncConflict } from '../services/syncService';
import type { Transaction, Account } from '../types';
import type { ConflictResolutionEvent, EntityType, SyncEventPayload, SyncData } from '../types/sync-types';

interface DataSyncHook {
  syncStatus: SyncStatus;
  conflicts: SyncConflict[];
  forceSync: () => void;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge', mergedData?: unknown) => void;
  clearSyncQueue: () => void;
  queueChange: (type: 'CREATE' | 'UPDATE' | 'DELETE', entity: EntityType, entityId: string, data: unknown) => void;
}

export function useDataSync(): DataSyncHook {
  const {
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    // dispatch not available in current AppContext
  } = useApp();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncService.getStatus());
  const [conflicts, setConflicts] = useState<SyncConflict[]>(syncService.getConflicts());

  // Listen for sync status changes
  useEffect(() => {
    const handleStatusChange = (status: SyncStatus) => {
      setSyncStatus(status);
    };

    const handleConflict = (event: ConflictResolutionEvent) => {
      setConflicts(prev => [...prev, event.conflict]);
    };

    syncService.on('status-changed', handleStatusChange);
    syncService.on('conflict-detected', handleConflict);

    return () => {
      syncService.off('status-changed', handleStatusChange);
      syncService.off('conflict-detected', handleConflict);
    };
  }, []);

  // Listen for remote updates
  useEffect(() => {
    const handleRemoteCreate = async (event: SyncEventPayload) => {
      const { entity, data } = event;
      
      switch (entity) {
        case 'transaction':
          await addTransaction(data as Transaction);
          break;
        case 'account':
          await addAccount(data as Account);
          break;
        // Add more entities as needed
      }
    };

    const handleRemoteUpdate = async (event: SyncEventPayload) => {
      const { entity, entityId, data } = event;
      
      switch (entity) {
        case 'transaction':
          await updateTransaction(entityId, data as Partial<Transaction>);
          break;
        case 'account':
          await updateAccount(entityId, data as Partial<Account>);
          break;
        // Add more entities as needed
      }
    };

    const handleRemoteDelete = async (event: SyncEventPayload) => {
      const { entity, entityId } = event;
      
      switch (entity) {
        case 'transaction':
          await deleteTransaction(entityId);
          break;
        case 'account':
          await deleteAccount(entityId);
          break;
        // Add more entities as needed
      }
    };

    const handleRemoteMerge = async (event: SyncEventPayload) => {
      const { entity, entityId, data } = event;
      
      // Handle merged data
      switch (entity) {
        case 'transaction':
          await updateTransaction(entityId, data as Partial<Transaction>);
          break;
        case 'account':
          await updateAccount(entityId, data as Partial<Account>);
          break;
        // Add more entities as needed
      }
    };

    syncService.on('remote-create', handleRemoteCreate);
    syncService.on('remote-update', handleRemoteUpdate);
    syncService.on('remote-delete', handleRemoteDelete);
    syncService.on('remote-merge', handleRemoteMerge);

    return () => {
      syncService.off('remote-create', handleRemoteCreate);
      syncService.off('remote-update', handleRemoteUpdate);
      syncService.off('remote-delete', handleRemoteDelete);
      syncService.off('remote-merge', handleRemoteMerge);
    };
  }, [addTransaction, updateTransaction, deleteTransaction, addAccount, updateAccount, deleteAccount]);

  // Queue local changes for sync
  const queueChange = useCallback((
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    entity: EntityType,
    entityId: string,
    data: unknown
  ) => {
    // Sync service expects strongly typed entity; we keep data as unknown here and validate server-side
    syncService.queueOperation(type, entity, entityId, data);
  }, []);

  const forceSync = useCallback(() => {
    syncService.forceSync();
  }, []);

  const resolveConflict = useCallback((
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: unknown
  ) => {
    const merged = mergedData as SyncData<EntityType> | undefined;
    syncService.resolveConflict<EntityType>(conflictId, resolution, merged);
    setConflicts(syncService.getConflicts());
  }, []);

  const clearSyncQueue = useCallback(() => {
    syncService.clearQueue();
  }, []);

  return {
    syncStatus,
    conflicts,
    forceSync,
    resolveConflict,
    clearSyncQueue,
    queueChange
  };
}

// Hook for auto-syncing specific entity types
export function useAutoSync(
  entityType: 'transaction' | 'account' | 'budget' | 'goal'
): void {
  const { queueChange } = useDataSync();
  const { transactions, accounts, budgets, goals } = useApp();

  useEffect(() => {
    // Set up mutation observers or other change detection
    // This is a simplified implementation
    
    let previousData: Array<{ id: string }> = [];
    
    switch (entityType) {
      case 'transaction':
        previousData = [...transactions];
        break;
      case 'account':
        previousData = [...accounts];
        break;
      case 'budget':
        previousData = [...budgets];
        break;
      case 'goal':
        previousData = [...goals];
        break;
    }

    // Check for changes periodically
    const interval = setInterval(() => {
      let currentData: Array<{ id: string }> = [];
      
      switch (entityType) {
        case 'transaction':
          currentData = transactions;
          break;
        case 'account':
          currentData = accounts;
          break;
        case 'budget':
          currentData = budgets;
          break;
        case 'goal':
          currentData = goals;
          break;
      }

      // Detect changes
      const changes = detectChanges(previousData, currentData);
      
      changes.forEach(change => {
        queueChange(change.type, entityType, change.id, change.data);
      });

      previousData = [...currentData];
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [entityType, transactions, accounts, budgets, goals, queueChange]);
}

// Helper function to detect changes
function detectChanges<T extends { id: string }>(oldData: T[], newData: T[]): Array<{
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  id: string;
  data: T | null;
}> {
  const changes: Array<{ type: 'CREATE' | 'UPDATE' | 'DELETE'; id: string; data: T | null; }> = [];

  const oldMap = new Map(oldData.map(item => [item.id, item]));
  const newMap = new Map(newData.map(item => [item.id, item]));

  // Check for creates and updates
  newMap.forEach((item, id) => {
    const oldItem = oldMap.get(id);
    if (!oldItem) {
      changes.push({ type: 'CREATE', id, data: item });
    } else if (JSON.stringify(oldItem) !== JSON.stringify(item)) {
      changes.push({ type: 'UPDATE', id, data: item });
    }
  });

  // Check for deletes
  oldMap.forEach((item, id) => {
    if (!newMap.has(id)) {
      changes.push({ type: 'DELETE', id, data: null });
    }
  });

  return changes;
}
