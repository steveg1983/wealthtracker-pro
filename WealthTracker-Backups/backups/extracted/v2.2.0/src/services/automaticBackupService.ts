import { exportService } from './exportService';
import type { ExportOptions } from '../types/export';
import { logger } from './loggingService';

export interface BackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  format: 'json' | 'csv' | 'all';
  encryptionEnabled: boolean;
  cloudProvider?: 'google-drive' | 'dropbox' | 'onedrive';
  retentionDays: number;
  includeAttachments: boolean;
}

interface BackupData {
  version: string;
  timestamp: string;
  app_version: string;
  transactions?: unknown[];
  accounts?: unknown[];
  investments?: unknown[];
  budgets?: unknown[];
  categories?: unknown[];
  tags?: unknown[];
  goals?: unknown[];
  recurring_transactions?: unknown[];
  preferences?: unknown;
  import_profiles?: unknown[];
  import_rules?: unknown[];
  scheduled_reports?: unknown[];
  [key: string]: unknown;
}

interface BackupHistoryEntry {
  timestamp: number;
  success: boolean;
  format?: string;
  filesCreated?: number;
  error?: string;
}

class AutomaticBackupService {
  private readonly BACKUP_CONFIG_KEY = 'money_management_backup_config';
  private readonly BACKUP_HISTORY_KEY = 'money_management_backup_history';
  private readonly MAX_HISTORY_ENTRIES = 30;

  async initializeBackups(): Promise<void> {
    const config = this.getBackupConfig();
    
    if (!config.enabled) {
      logger.info('[AutomaticBackup] Backups disabled');
      return;
    }

    // Register periodic background sync if available
    if ('periodicSync' in self.registration) {
      try {
        // Request permission for periodic background sync
        const status = await navigator.permissions.query({
          name: 'periodic-background-sync' as PermissionName,
        });
        
        if (status.state === 'granted') {
          await this.registerPeriodicSync();
        } else {
          logger.warn('[AutomaticBackup] Periodic sync permission not granted');
          // Fall back to regular scheduling
          this.setupFallbackScheduler();
        }
      } catch (error) {
        logger.error('[AutomaticBackup] Failed to setup periodic sync:', error);
        this.setupFallbackScheduler();
      }
    } else {
      // Browser doesn't support periodic sync
      this.setupFallbackScheduler();
    }
  }

  private async registerPeriodicSync(): Promise<void> {
    const config = this.getBackupConfig();
    const registration = await navigator.serviceWorker.ready;
    
    // Calculate minimum interval based on frequency
    const minInterval = this.getMinInterval(config.frequency);
    
    try {
      // TypeScript doesn't have periodicSync in ServiceWorkerRegistration yet
      const extendedRegistration = registration as ServiceWorkerRegistration & {
        periodicSync: {
          register: (tag: string, options: { minInterval: number }) => Promise<void>;
        };
      };
      await extendedRegistration.periodicSync.register('automatic-backup', {
        minInterval,
      });
      logger.info('[AutomaticBackup] Periodic sync registered');
    } catch (error) {
      logger.error('[AutomaticBackup] Failed to register periodic sync:', error);
      throw error;
    }
  }

  private getMinInterval(frequency: string): number {
    switch (frequency) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      default:
        return 24 * 60 * 60 * 1000; // Default to daily
    }
  }

  private setupFallbackScheduler(): void {
    // Check if it's time to backup when the app loads
    const lastBackup = this.getLastBackupTime();
    const config = this.getBackupConfig();
    const nextBackupTime = this.calculateNextBackupTime(lastBackup, config);
    
    if (Date.now() >= nextBackupTime) {
      this.performBackup();
    }
    
    // Also check periodically while app is open
    setInterval(() => {
      const now = Date.now();
      const next = this.calculateNextBackupTime(this.getLastBackupTime(), this.getBackupConfig());
      if (now >= next) {
        this.performBackup();
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  async performBackup(): Promise<void> {
    const config = this.getBackupConfig();
    
    if (!config.enabled) {
      return;
    }

    try {
      logger.info('[AutomaticBackup] Starting backup...');
      
      // Get all data for backup
      const data = await this.collectBackupData();
      
      // Create backups in specified formats
      const backupFiles: Array<{ format: string; data: Blob; filename: string }> = [];
      
      if (config.format === 'json' || config.format === 'all') {
        const jsonBackup = await this.createJSONBackup(data, config);
        backupFiles.push(jsonBackup);
      }
      
      if (config.format === 'csv' || config.format === 'all') {
        const csvBackup = await this.createCSVBackup(data);
        backupFiles.push(csvBackup);
      }
      
      // Store backups
      await this.storeBackups(backupFiles, config);
      
      // Update backup history
      this.updateBackupHistory({
        timestamp: Date.now(),
        success: true,
        format: config.format,
        filesCreated: backupFiles.length,
      });
      
      // Clean up old backups
      await this.cleanupOldBackups(config.retentionDays);
      
      // Send notification
      this.sendBackupNotification(true);
      
      logger.info('[AutomaticBackup] Backup completed successfully');
    } catch (error) {
      logger.error('[AutomaticBackup] Backup failed:', error);
      
      this.updateBackupHistory({
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.sendBackupNotification(false, error);
    }
  }

  private async collectBackupData(): Promise<BackupData> {
    // Collect all app data from localStorage
    const keys = [
      'money_management_transactions',
      'money_management_accounts',
      'money_management_categories',
      'money_management_tags',
      'money_management_budgets',
      'money_management_goals',
      'money_management_investments',
      'money_management_recurring_transactions',
      'money_management_preferences',
      'money_management_import_profiles',
      'money_management_import_rules',
      'money_management_scheduled_reports',
    ];
    
    const data: BackupData = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      app_version: process.env.REACT_APP_VERSION || '1.4.7',
    };
    
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          data[key.replace('money_management_', '')] = JSON.parse(value);
        } catch (error) {
          logger.warn(`Failed to parse ${key}:`, error);
        }
      }
    }
    
    return data;
  }

  private async createJSONBackup(
    data: BackupData, 
    config: BackupConfig
  ): Promise<{ format: string; data: Blob; filename: string }> {
    let jsonString = JSON.stringify(data, null, 2);
    
    // Encrypt if enabled
    if (config.encryptionEnabled) {
      jsonString = await this.encryptData(jsonString);
    }
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `wealthtracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    return { format: 'json', data: blob, filename };
  }

  private async createCSVBackup(data: BackupData): Promise<{ format: string; data: Blob; filename: string }> {
    // Use existing export service to create CSV
    const options: ExportOptions = {
      startDate: new Date(0), // Beginning of time
      endDate: new Date(), // Now
      includeTransactions: true,
      includeAccounts: true,
      includeInvestments: true,
      includeBudgets: true,
      format: 'csv',
    };
    
    const csvData = await exportService.exportData(
      {
        transactions: data.transactions || [],
        accounts: data.accounts || [],
        investments: data.investments || [],
        budgets: data.budgets || [],
      },
      options
    );
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const filename = `wealthtracker-backup-${new Date().toISOString().split('T')[0]}.csv`;
    
    return { format: 'csv', data: blob, filename };
  }

  private async encryptData(data: string): Promise<string> {
    // Simple encryption using Web Crypto API
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate a key (in production, this should be derived from user password)
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  }

  private async storeBackups(
    backupFiles: Array<{ format: string; data: Blob; filename: string }>,
    config: BackupConfig
  ): Promise<void> {
    // Store locally using IndexedDB
    const db = await this.openBackupDB();
    const transaction = db.transaction(['backups'], 'readwrite');
    const store = transaction.objectStore('backups');
    
    for (const backup of backupFiles) {
      await store.add({
        filename: backup.filename,
        format: backup.format,
        data: backup.data,
        timestamp: Date.now(),
        cloudSynced: false,
      });
    }
    
    // If cloud provider is configured, sync to cloud
    if (config.cloudProvider) {
      await this.syncToCloud(backupFiles, config.cloudProvider);
    }
  }

  private async openBackupDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WealthTrackerBackups', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('backups')) {
          const store = db.createObjectStore('backups', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('format', 'format', { unique: false });
        }
      };
    });
  }

  private async syncToCloud(
    backupFiles: Array<{ format: string; data: Blob; filename: string }>,
    provider: string
  ): Promise<void> {
    // This would integrate with cloud storage APIs
    // For now, we'll just log the intention
    logger.info('[AutomaticBackup] Would sync to provider', { files: backupFiles.length, provider });
    
    // In a real implementation, this would:
    // 1. Authenticate with the cloud provider
    // 2. Upload the backup files
    // 3. Update the cloudSynced flag in IndexedDB
  }

  private async cleanupOldBackups(retentionDays: number): Promise<void> {
    const db = await this.openBackupDB();
    const transaction = db.transaction(['backups'], 'readwrite');
    const store = transaction.objectStore('backups');
    const index = store.index('timestamp');
    
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const range = IDBKeyRange.upperBound(cutoffTime);
    
    const request = index.openCursor(range);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private sendBackupNotification(success: boolean, error?: unknown): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(
        success ? 'Backup Completed' : 'Backup Failed',
        {
          body: success 
            ? 'Your financial data has been backed up successfully.'
            : `Backup failed: ${error?.message || 'Unknown error'}`,
          icon: '/icon-192.png',
          tag: 'backup-notification',
        }
      );
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }

  getBackupConfig(): BackupConfig {
    const stored = localStorage.getItem(this.BACKUP_CONFIG_KEY);
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        logger.error('Failed to parse backup config:', error);
      }
    }
    
    // Default config
    return {
      enabled: false,
      frequency: 'daily',
      time: '02:00',
      format: 'json',
      encryptionEnabled: true,
      retentionDays: 30,
      includeAttachments: false,
    };
  }

  updateBackupConfig(config: Partial<BackupConfig>): void {
    const current = this.getBackupConfig();
    const updated = { ...current, ...config };
    
    localStorage.setItem(this.BACKUP_CONFIG_KEY, JSON.stringify(updated));
    
    // Re-initialize if enabled state changed
    if (config.enabled !== undefined) {
      this.initializeBackups();
    }
  }

  private getLastBackupTime(): number {
    const history = this.getBackupHistory();
    const successfulBackups = history.filter(h => h.success);
    
    if (successfulBackups.length === 0) {
      return 0;
    }
    
    return Math.max(...successfulBackups.map(h => h.timestamp));
  }

  private calculateNextBackupTime(lastBackup: number, config: BackupConfig): number {
    const [hours, minutes] = config.time.split(':').map(Number);
    const nextBackup = new Date(lastBackup);
    
    // Set to configured time
    nextBackup.setHours(hours, minutes, 0, 0);
    
    // If we've already passed that time today, move to next occurrence
    if (nextBackup.getTime() <= lastBackup) {
      switch (config.frequency) {
        case 'daily':
          nextBackup.setDate(nextBackup.getDate() + 1);
          break;
        case 'weekly':
          nextBackup.setDate(nextBackup.getDate() + 7);
          break;
        case 'monthly':
          nextBackup.setMonth(nextBackup.getMonth() + 1);
          break;
      }
    }
    
    return nextBackup.getTime();
  }

  private getBackupHistory(): Array<BackupHistoryEntry> {
    const stored = localStorage.getItem(this.BACKUP_HISTORY_KEY);
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        logger.error('Failed to parse backup history:', error);
      }
    }
    
    return [];
  }

  private updateBackupHistory(entry: BackupHistoryEntry): void {
    const history = this.getBackupHistory();
    history.unshift(entry);
    
    // Keep only recent entries
    if (history.length > this.MAX_HISTORY_ENTRIES) {
      history.splice(this.MAX_HISTORY_ENTRIES);
    }
    
    localStorage.setItem(this.BACKUP_HISTORY_KEY, JSON.stringify(history));
  }

  async getStoredBackups(): Promise<Array<{
    id: number;
    filename: string;
    format: string;
    timestamp: number;
    size: number;
    cloudSynced: boolean;
  }>> {
    const db = await this.openBackupDB();
    const transaction = db.transaction(['backups'], 'readonly');
    const store = transaction.objectStore('backups');
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const backups = request.result.map(backup => ({
          id: backup.id,
          filename: backup.filename,
          format: backup.format,
          timestamp: backup.timestamp,
          size: backup.data.size,
          cloudSynced: backup.cloudSynced,
        }));
        resolve(backups);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async downloadBackup(backupId: number): Promise<void> {
    const db = await this.openBackupDB();
    const transaction = db.transaction(['backups'], 'readonly');
    const store = transaction.objectStore('backups');
    const request = store.get(backupId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const backup = request.result;
        if (backup) {
          // Create download link
          const url = URL.createObjectURL(backup.data);
          const a = document.createElement('a');
          a.href = url;
          a.download = backup.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        } else {
          reject(new Error('Backup not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteBackup(backupId: number): Promise<void> {
    const db = await this.openBackupDB();
    const transaction = db.transaction(['backups'], 'readwrite');
    const store = transaction.objectStore('backups');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(backupId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const automaticBackupService = new AutomaticBackupService();
