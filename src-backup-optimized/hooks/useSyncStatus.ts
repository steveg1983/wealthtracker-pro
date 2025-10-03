/**
 * useSyncStatus Hook - Manages synchronization status between client and server
 *
 * Features:
 * - Real-time sync status monitoring
 * - Connection state tracking
 * - Sync queue management
 * - Error handling
 * - Offline/online detection
 */

import { useState, useEffect, useCallback } from 'react';
import { lazyLogger } from '../services/serviceFactory';

const logger = lazyLogger.getLogger('useSyncStatus');

export interface SyncStatus {
  isOnline: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  queuedChanges: number;
  syncErrors: SyncError[];
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
}

export interface SyncError {
  id: string;
  timestamp: Date;
  type: 'network' | 'server' | 'validation' | 'conflict';
  message: string;
  retryCount: number;
  recoverable: boolean;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: Date;
  priority: 'high' | 'normal' | 'low';
}

export interface UseSyncStatusOptions {
  enableRealTimeUpdates?: boolean;
  syncInterval?: number;
  maxRetries?: number;
  onSyncComplete?: (operations: SyncOperation[]) => void;
  onSyncError?: (error: SyncError) => void;
}

export function useSyncStatus(options: UseSyncStatusOptions = {}) {
  const {
    enableRealTimeUpdates = true,
    syncInterval = 30000, // 30 seconds
    maxRetries = 3,
    onSyncComplete,
    onSyncError
  } = options;

  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isConnected: false,
    isSyncing: false,
    lastSyncTime: null,
    queuedChanges: 0,
    syncErrors: [],
    connectionQuality: navigator.onLine ? 'good' : 'offline'
  });

  const [syncQueue, setSyncQueue] = useState<SyncOperation[]>([]);
  const [syncHistory, setSyncHistory] = useState<{
    timestamp: Date;
    success: boolean;
    operations: number;
  }[]>([]);

  // Check connection quality
  const checkConnectionQuality = useCallback(async (): Promise<'excellent' | 'good' | 'fair' | 'poor' | 'offline'> => {
    if (!navigator.onLine) {
      return 'offline';
    }

    try {
      const startTime = Date.now();
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const endTime = Date.now();
      const latency = endTime - startTime;

      if (response.ok) {
        if (latency < 100) return 'excellent';
        if (latency < 300) return 'good';
        if (latency < 1000) return 'fair';
        return 'poor';
      } else {
        return 'poor';
      }
    } catch (error) {
      logger.warn('Connection quality check failed:', error);
      return 'poor';
    }
  }, []);

  // Perform sync operation
  const performSync = useCallback(async (): Promise<void> => {
    if (!status.isOnline || status.isSyncing || syncQueue.length === 0) {
      return;
    }

    logger.info('Starting sync operation', { queuedOperations: syncQueue.length });

    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      // Sort operations by priority and timestamp
      const sortedOperations = [...syncQueue].sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp.getTime() - b.timestamp.getTime();
      });

      const successfulOperations: SyncOperation[] = [];
      const failedOperations: SyncOperation[] = [];

      // Process operations in batches
      const batchSize = 10;
      for (let i = 0; i < sortedOperations.length; i += batchSize) {
        const batch = sortedOperations.slice(i, i + batchSize);

        try {
          // Mock sync operation - in real implementation, this would call the API
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

          // Simulate occasional failures
          const shouldFail = Math.random() < 0.1; // 10% failure rate
          if (shouldFail) {
            throw new Error('Simulated sync failure');
          }

          successfulOperations.push(...batch);
          logger.debug('Batch synced successfully', { batchSize: batch.length });
        } catch (error) {
          logger.error('Batch sync failed:', error);
          failedOperations.push(...batch);

          // Create sync error
          const syncError: SyncError = {
            id: `error-${Date.now()}`,
            timestamp: new Date(),
            type: 'network',
            message: error instanceof Error ? error.message : 'Unknown sync error',
            retryCount: 0,
            recoverable: true
          };

          setStatus(prev => ({
            ...prev,
            syncErrors: [...prev.syncErrors, syncError].slice(-10) // Keep last 10 errors
          }));

          onSyncError?.(syncError);
        }
      }

      // Remove successful operations from queue
      if (successfulOperations.length > 0) {
        setSyncQueue(prev =>
          prev.filter(op => !successfulOperations.some(success => success.id === op.id))
        );

        // Update sync history
        setSyncHistory(prev => [{
          timestamp: new Date(),
          success: true,
          operations: successfulOperations.length
        }, ...prev].slice(0, 20)); // Keep last 20 sync records

        onSyncComplete?.(successfulOperations);
      }

      // Update status
      const newConnectionQuality = await checkConnectionQuality();
      setStatus(prev => ({
        ...prev,
        isConnected: true,
        lastSyncTime: new Date(),
        queuedChanges: prev.queuedChanges - successfulOperations.length,
        connectionQuality: newConnectionQuality
      }));

      logger.info('Sync operation completed', {
        successful: successfulOperations.length,
        failed: failedOperations.length
      });

    } catch (error) {
      logger.error('Sync operation failed:', error);

      const syncError: SyncError = {
        id: `error-${Date.now()}`,
        timestamp: new Date(),
        type: 'server',
        message: error instanceof Error ? error.message : 'Sync operation failed',
        retryCount: 0,
        recoverable: true
      };

      setStatus(prev => ({
        ...prev,
        isConnected: false,
        syncErrors: [...prev.syncErrors, syncError].slice(-10)
      }));

      onSyncError?.(syncError);

    } finally {
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [status.isOnline, status.isSyncing, syncQueue, checkConnectionQuality, onSyncComplete, onSyncError]);

  // Queue a sync operation
  const queueOperation = useCallback((operation: Omit<SyncOperation, 'id' | 'timestamp'>): void => {
    const newOperation: SyncOperation = {
      ...operation,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    setSyncQueue(prev => [...prev, newOperation]);
    setStatus(prev => ({ ...prev, queuedChanges: prev.queuedChanges + 1 }));

    logger.debug('Operation queued for sync', {
      type: operation.type,
      entity: operation.entity,
      priority: operation.priority
    });
  }, []);

  // Force sync
  const forceSync = useCallback(async (): Promise<void> => {
    if (syncQueue.length === 0) {
      logger.info('No operations to sync');
      return;
    }

    await performSync();
  }, [performSync, syncQueue.length]);

  // Retry failed operations
  const retryFailedOperations = useCallback((): void => {
    const retriableErrors = status.syncErrors.filter(error =>
      error.recoverable && error.retryCount < maxRetries
    );

    if (retriableErrors.length > 0) {
      setStatus(prev => ({
        ...prev,
        syncErrors: prev.syncErrors.map(error =>
          retriableErrors.includes(error)
            ? { ...error, retryCount: error.retryCount + 1 }
            : error
        )
      }));

      // Trigger sync for retry
      performSync();
    }
  }, [status.syncErrors, maxRetries, performSync]);

  // Clear sync errors
  const clearSyncErrors = useCallback((): void => {
    setStatus(prev => ({ ...prev, syncErrors: [] }));
  }, []);

  // Get sync statistics
  const getSyncStats = useCallback(() => {
    const recentHistory = syncHistory.slice(0, 10);
    const successRate = recentHistory.length > 0
      ? recentHistory.filter(h => h.success).length / recentHistory.length
      : 1;

    return {
      totalSynced: syncHistory.reduce((sum, h) => sum + h.operations, 0),
      successRate,
      averageOperationsPerSync: recentHistory.length > 0
        ? recentHistory.reduce((sum, h) => sum + h.operations, 0) / recentHistory.length
        : 0,
      lastSyncDuration: status.lastSyncTime
        ? Date.now() - status.lastSyncTime.getTime()
        : null
    };
  }, [syncHistory, status.lastSyncTime]);

  // Online/offline event handlers
  useEffect(() => {
    const handleOnline = async () => {
      logger.info('Connection restored');
      const quality = await checkConnectionQuality();
      setStatus(prev => ({
        ...prev,
        isOnline: true,
        connectionQuality: quality
      }));

      // Automatically sync when coming back online
      if (syncQueue.length > 0) {
        setTimeout(() => performSync(), 1000);
      }
    };

    const handleOffline = () => {
      logger.info('Connection lost');
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        isConnected: false,
        connectionQuality: 'offline'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnectionQuality, performSync, syncQueue.length]);

  // Periodic sync
  useEffect(() => {
    if (!enableRealTimeUpdates) return;

    const interval = setInterval(() => {
      if (status.isOnline && !status.isSyncing && syncQueue.length > 0) {
        performSync();
      }
    }, syncInterval);

    return () => clearInterval(interval);
  }, [enableRealTimeUpdates, status.isOnline, status.isSyncing, syncQueue.length, syncInterval, performSync]);

  // Initial connection check
  useEffect(() => {
    let mounted = true;

    const initializeConnection = async () => {
      const quality = await checkConnectionQuality();
      if (mounted) {
        setStatus(prev => ({
          ...prev,
          isConnected: quality !== 'offline' && quality !== 'poor',
          connectionQuality: quality
        }));
      }
    };

    initializeConnection();

    return () => {
      mounted = false;
    };
  }, [checkConnectionQuality]);

  return {
    status,
    syncQueue: syncQueue.slice(), // Return copy to prevent mutation
    syncHistory: syncHistory.slice(),
    queueOperation,
    forceSync,
    retryFailedOperations,
    clearSyncErrors,
    getSyncStats,

    // Computed values
    hasQueuedOperations: syncQueue.length > 0,
    hasSyncErrors: status.syncErrors.length > 0,
    canSync: status.isOnline && !status.isSyncing,
    syncHealthScore: (() => {
      const stats = getSyncStats();
      let score = stats.successRate * 50; // Base score from success rate

      // Adjust for connection quality
      const qualityScore = {
        excellent: 50,
        good: 40,
        fair: 25,
        poor: 10,
        offline: 0
      };

      score += qualityScore[status.connectionQuality];

      // Penalize for queued operations
      if (syncQueue.length > 10) score -= 10;
      if (syncQueue.length > 50) score -= 20;

      return Math.max(0, Math.min(100, Math.round(score)));
    })()
  };
}

export default useSyncStatus;