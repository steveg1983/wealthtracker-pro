import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CloudArrowUpIcon,
  WifiIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import type { Account } from '../../types';
import { supabase } from '../../lib/supabase';
import { logger } from '../../services/loggingService';

interface SyncStatusWidgetProps {
  accounts: Account[];
  formatCurrency?: (value: number) => string;
  navigate?: (path: string) => void;
  settings?: {
    autoRefresh?: boolean;
    showDetails?: boolean;
  };
}

interface AccountSyncStatus {
  accountId: string;
  accountName: string;
  status: 'synced' | 'syncing' | 'error' | 'pending' | 'offline';
  lastSync?: Date;
  nextSync?: Date;
  error?: string;
  itemsSynced?: number;
  totalItems?: number;
}

export default function SyncStatusWidget({ 
  accounts, 
  settings = { autoRefresh: true, showDetails: true }
}: SyncStatusWidgetProps): React.JSX.Element {
  
  const [syncStatuses, setSyncStatuses] = useState<AccountSyncStatus[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastGlobalSync, setLastGlobalSync] = useState<Date | null>(null);
  
  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Initialize sync statuses for accounts
  useEffect(() => {
    const statuses: AccountSyncStatus[] = accounts.map(account => {
      // Get last sync from localStorage or database
      const lastSyncStr = localStorage.getItem(`sync_${account.id}_last`);
      const lastSync = lastSyncStr ? new Date(lastSyncStr) : undefined;
      
      // Calculate next sync (every 5 minutes for auto-sync accounts)
      const nextSync = lastSync 
        ? new Date(lastSync.getTime() + 5 * 60 * 1000)
        : new Date();
      
      return {
        accountId: account.id,
        accountName: account.name,
        status: lastSync && (new Date().getTime() - lastSync.getTime()) < 60000 
          ? 'synced' 
          : 'pending',
        lastSync,
        nextSync,
        itemsSync: 0,
        totalItems: 0
      };
    });
    
    setSyncStatuses(statuses);
  }, [accounts]);
  
  // Auto-refresh sync status
  useEffect(() => {
    if (!settings.autoRefresh) return;
    
    const interval = setInterval(() => {
      checkSyncStatus();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [settings.autoRefresh]);
  
  // Check sync status for all accounts
  const checkSyncStatus = async () => {
    if (!isOnline) return;
    
    try {
      // In a real implementation, this would check actual sync status
      // For now, we'll simulate checking sync status
      const updatedStatuses = await Promise.all(
        syncStatuses.map(async (status) => {
          // Check if account needs sync
          const needsSync = !status.lastSync || 
            new Date().getTime() - status.lastSync.getTime() > 5 * 60 * 1000;
          
          if (needsSync) {
            return {
              ...status,
              status: 'pending' as const
            };
          }
          
          return {
            ...status,
            status: 'synced' as const
          };
        })
      );
      
      setSyncStatuses(updatedStatuses);
    } catch (error) {
      logger.error('Failed to check sync status:', error);
    }
  };
  
  // Trigger manual sync for an account
  const syncAccount = async (accountId: string) => {
    if (!isOnline) {
      logger.warn('Cannot sync while offline');
      return;
    }
    
    // Update status to syncing
    setSyncStatuses(prev => prev.map(s => 
      s.accountId === accountId 
        ? { ...s, status: 'syncing' as const }
        : s
    ));
    
    try {
      // Simulate sync process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update status to synced
      const now = new Date();
      setSyncStatuses(prev => prev.map(s => 
        s.accountId === accountId 
          ? { 
              ...s, 
              status: 'synced' as const,
              lastSync: now,
              nextSync: new Date(now.getTime() + 5 * 60 * 1000),
              itemsSync: Math.floor(Math.random() * 50) + 10,
              totalItems: Math.floor(Math.random() * 50) + 10
            }
          : s
      ));
      
      // Save last sync time
      localStorage.setItem(`sync_${accountId}_last`, now.toISOString());
      
    } catch (error) {
      logger.error(`Failed to sync account ${accountId}:`, error);
      
      // Update status to error
      setSyncStatuses(prev => prev.map(s => 
        s.accountId === accountId 
          ? { 
              ...s, 
              status: 'error' as const,
              error: 'Sync failed. Please try again.'
            }
          : s
      ));
    }
  };
  
  // Sync all accounts
  const syncAll = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    
    try {
      // Sync all accounts in parallel
      await Promise.all(
        accounts.map(account => syncAccount(account.id))
      );
      
      setLastGlobalSync(new Date());
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Calculate overall sync status
  const overallStatus = useMemo(() => {
    if (!isOnline) return 'offline';
    if (isSyncing) return 'syncing';
    
    const hasErrors = syncStatuses.some(s => s.status === 'error');
    const hasPending = syncStatuses.some(s => s.status === 'pending');
    const allSynced = syncStatuses.every(s => s.status === 'synced');
    
    if (hasErrors) return 'error';
    if (hasPending) return 'pending';
    if (allSynced) return 'synced';
    return 'unknown';
  }, [isOnline, isSyncing, syncStatuses]);
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'synced':
        return 'text-green-600 dark:text-green-400';
      case 'syncing':
        return 'text-gray-600 dark:text-gray-500';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'offline':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };
  
  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircleIcon className="h-5 w-5" />;
      case 'syncing':
        return <ArrowPathIcon className="h-5 w-5 animate-spin" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5" />;
      case 'offline':
        return <WifiIcon className="h-5 w-5" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5" />;
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className={`rounded-lg p-4 ${
        overallStatus === 'error' 
          ? 'bg-red-50 dark:bg-red-900/20' 
          : overallStatus === 'synced'
            ? 'bg-green-50 dark:bg-green-900/20'
            : overallStatus === 'offline'
              ? 'bg-gray-50 dark:bg-gray-800'
              : 'bg-blue-50 dark:bg-gray-900/20'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`mr-3 ${getStatusColor(overallStatus)}`}>
              {getStatusIcon(overallStatus)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {overallStatus === 'synced' && 'All Synced'}
                {overallStatus === 'syncing' && 'Syncing...'}
                {overallStatus === 'error' && 'Sync Error'}
                {overallStatus === 'pending' && 'Sync Pending'}
                {overallStatus === 'offline' && 'Offline'}
              </h3>
              {lastGlobalSync && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last sync: {lastGlobalSync.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          
          {/* Sync All Button */}
          <button
            onClick={syncAll}
            disabled={!isOnline || isSyncing}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !isOnline || isSyncing
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            {isSyncing ? (
              <span className="flex items-center">
                <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                Syncing
              </span>
            ) : (
              'Sync All'
            )}
          </button>
        </div>
      </div>
      
      {/* Connection Status */}
      {!isOnline && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div className="flex items-center">
            <WifiIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              You're offline. Changes will sync when connection is restored.
            </p>
          </div>
        </div>
      )}
      
      {/* Account Sync Status List */}
      {settings.showDetails && (
        <div className="space-y-2">
          {syncStatuses.map(status => (
            <div 
              key={status.accountId}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <div className={`mr-2 ${getStatusColor(status.status)}`}>
                    {getStatusIcon(status.status)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                      {status.accountName}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {status.status === 'synced' && status.lastSync && (
                        <>Last sync: {status.lastSync.toLocaleTimeString()}</>
                      )}
                      {status.status === 'syncing' && 'Syncing...'}
                      {status.status === 'error' && (status.error || 'Sync failed')}
                      {status.status === 'pending' && 'Waiting to sync'}
                      {status.status === 'offline' && 'Offline'}
                    </p>
                  </div>
                </div>
                
                {/* Individual Sync Button */}
                {status.status !== 'syncing' && isOnline && (
                  <button
                    onClick={() => syncAccount(status.accountId)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-500 transition-colors"
                    title="Sync this account"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                  </button>
                )}
                
                {/* Progress Indicator */}
                {status.status === 'syncing' && status.totalItems && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {status.itemsSynced}/{status.totalItems}
                  </div>
                )}
              </div>
              
              {/* Sync Progress Bar */}
              {status.status === 'syncing' && status.totalItems && status.totalItems > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div 
                      className="bg-gray-500 h-1 rounded-full transition-all"
                      style={{ 
                        width: `${((status.itemsSynced || 0) / status.totalItems) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Auto-sync Status */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center">
          <CloudArrowUpIcon className="h-4 w-4 mr-1" />
          <span>
            Auto-sync: {settings.autoRefresh ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        {settings.autoRefresh && (
          <span>Every 5 minutes</span>
        )}
      </div>
    </div>
  );
}