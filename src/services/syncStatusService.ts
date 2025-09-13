/**
 * Sync Status Service
 * Handles all business logic for sync status management
 */

import { logger } from './loggingService';
import type { Account } from '../types';

export interface AccountSyncStatus {
  accountId: string;
  accountName: string;
  status: 'synced' | 'syncing' | 'error' | 'pending' | 'offline';
  lastSync?: Date;
  nextSync?: Date;
  error?: string;
  itemsSynced?: number;
  totalItems?: number;
}

export type OverallStatus = 'synced' | 'syncing' | 'error' | 'pending' | 'offline' | 'unknown';

class SyncStatusService {
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly SYNC_FRESH_THRESHOLD = 60000; // 1 minute
  private readonly CHECK_INTERVAL = 30000; // 30 seconds

  /**
   * Initialize sync statuses for accounts
   */
  initializeSyncStatuses(accounts: Account[]): AccountSyncStatus[] {
    return accounts.map(account => {
      const lastSyncStr = this.getLastSyncTime(account.id);
      const lastSync = lastSyncStr ? new Date(lastSyncStr) : undefined;
      
      const nextSync = lastSync 
        ? new Date(lastSync.getTime() + this.SYNC_INTERVAL)
        : new Date();
      
      return {
        accountId: account.id,
        accountName: account.name,
        status: this.determineInitialStatus(lastSync),
        lastSync,
        nextSync,
        itemsSynced: 0,
        totalItems: 0
      };
    });
  }

  /**
   * Determine initial status based on last sync time
   */
  private determineInitialStatus(lastSync?: Date): AccountSyncStatus['status'] {
    if (!lastSync) return 'pending';
    
    const timeSinceSync = new Date().getTime() - lastSync.getTime();
    return timeSinceSync < this.SYNC_FRESH_THRESHOLD ? 'synced' : 'pending';
  }

  /**
   * Get last sync time from localStorage
   */
  private getLastSyncTime(accountId: string): string | null {
    return localStorage.getItem(`sync_${accountId}_last`);
  }

  /**
   * Save last sync time to localStorage
   */
  saveLastSyncTime(accountId: string, time: Date): void {
    localStorage.setItem(`sync_${accountId}_last`, time.toISOString());
  }

  /**
   * Check sync status for all accounts
   */
  async checkSyncStatus(
    currentStatuses: AccountSyncStatus[],
    isOnline: boolean
  ): Promise<AccountSyncStatus[]> {
    if (!isOnline) {
      return currentStatuses.map(status => ({
        ...status,
        status: 'offline'
      }));
    }

    try {
      return await Promise.all(
        currentStatuses.map(async (status) => {
          const needsSync = this.accountNeedsSync(status.lastSync);
          
          return {
            ...status,
            status: needsSync ? 'pending' : 'synced'
          } as AccountSyncStatus;
        })
      );
    } catch (error) {
      logger.error('Failed to check sync status:', error);
      throw error;
    }
  }

  /**
   * Check if account needs sync
   */
  private accountNeedsSync(lastSync?: Date): boolean {
    if (!lastSync) return true;
    return new Date().getTime() - lastSync.getTime() > this.SYNC_INTERVAL;
  }

  /**
   * Update sync status for an account
   */
  updateSyncStatus(
    statuses: AccountSyncStatus[],
    accountId: string,
    update: Partial<AccountSyncStatus>
  ): AccountSyncStatus[] {
    return statuses.map(s => 
      s.accountId === accountId 
        ? { ...s, ...update }
        : s
    );
  }

  /**
   * Simulate sync process for an account
   */
  async syncAccount(accountId: string): Promise<Partial<AccountSyncStatus>> {
    try {
      // Simulate sync process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const now = new Date();
      const itemsSynced = Math.floor(Math.random() * 50) + 10;
      
      return {
        status: 'synced',
        lastSync: now,
        nextSync: new Date(now.getTime() + this.SYNC_INTERVAL),
        itemsSynced,
        totalItems: itemsSynced,
        error: undefined
      };
    } catch (error) {
      logger.error(`Failed to sync account ${accountId}:`, error);
      return {
        status: 'error',
        error: 'Sync failed. Please try again.'
      };
    }
  }

  /**
   * Calculate overall sync status
   */
  calculateOverallStatus(
    statuses: AccountSyncStatus[],
    isOnline: boolean,
    isSyncing: boolean
  ): OverallStatus {
    if (!isOnline) return 'offline';
    if (isSyncing) return 'syncing';
    
    const hasErrors = statuses.some(s => s.status === 'error');
    const hasPending = statuses.some(s => s.status === 'pending');
    const allSynced = statuses.every(s => s.status === 'synced');
    
    if (hasErrors) return 'error';
    if (hasPending) return 'pending';
    if (allSynced) return 'synced';
    return 'unknown';
  }

  /**
   * Get status color classes
   */
  getStatusColor(status: string): string {
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
  }

  /**
   * Get status icon name
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'synced':
        return 'check-circle';
      case 'syncing':
        return 'arrow-path-spin';
      case 'error':
        return 'x-circle';
      case 'pending':
        return 'clock';
      case 'offline':
        return 'wifi';
      default:
        return 'exclamation-triangle';
    }
  }

  /**
   * Get status background color classes
   */
  getStatusBackground(status: OverallStatus): string {
    switch (status) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'synced':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'offline':
        return 'bg-gray-50 dark:bg-gray-800';
      default:
        return 'bg-blue-50 dark:bg-gray-900/20';
    }
  }

  /**
   * Get status title
   */
  getStatusTitle(status: OverallStatus): string {
    switch (status) {
      case 'synced':
        return 'All Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync Error';
      case 'pending':
        return 'Sync Pending';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown Status';
    }
  }

  /**
   * Get status message for account
   */
  getAccountStatusMessage(status: AccountSyncStatus): string {
    switch (status.status) {
      case 'synced':
        return status.lastSync ? `Last sync: ${status.lastSync.toLocaleTimeString()}` : 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return status.error || 'Sync failed';
      case 'pending':
        return 'Waiting to sync';
      case 'offline':
        return 'Offline';
      default:
        return '';
    }
  }

  /**
   * Get config values
   */
  getConfig() {
    return {
      syncInterval: this.SYNC_INTERVAL,
      checkInterval: this.CHECK_INTERVAL,
      syncFreshThreshold: this.SYNC_FRESH_THRESHOLD
    };
  }
}

export const syncStatusService = new SyncStatusService();