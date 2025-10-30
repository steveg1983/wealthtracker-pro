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

type BackupFormat = 'json' | 'csv';

interface BackupFileDescriptor {
  format: BackupFormat;
  data: Blob;
  filename: string;
}

interface BackupHistoryEntry {
  timestamp: number;
  success: boolean;
  format?: BackupConfig['format'];
  filesCreated?: number;
  error?: string;
}

interface StoredBackupRecord {
  id?: number;
  filename: string;
  format: BackupFormat;
  data: Blob;
  timestamp: number;
  cloudSynced: boolean;
}

type NewBackupRecord = Omit<StoredBackupRecord, 'id'>;

interface BackupSummary {
  id: number;
  filename: string;
  format: BackupFormat;
  timestamp: number;
  size: number;
  cloudSynced: boolean;
}

type PeriodicSyncManager = {
  register: (tag: string, options: { minInterval: number }) => Promise<void>;
};

interface PeriodicSyncCapableRegistration extends ServiceWorkerRegistration {
  periodicSync: PeriodicSyncManager;
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

    if (!('serviceWorker' in navigator)) {
      this.setupFallbackScheduler();
      return;
    }

    try {
      const [registration, permissionStatus] = await Promise.all([
        navigator.serviceWorker.ready,
        typeof navigator.permissions?.query === 'function'
          ? navigator.permissions.query({
              // TS lib.dom.d.ts does not yet know about periodic background sync
              name: 'periodic-background-sync' as PermissionName,
            })
          : Promise.resolve<PermissionStatus | null>(null),
      ]);

      if (registration && this.hasPeriodicSyncSupport(registration) && permissionStatus?.state === 'granted') {
        await this.registerPeriodicSync(registration);
        return;
      }

      logger.warn('[AutomaticBackup] Periodic sync unavailable or permission denied; using fallback scheduler');
      this.setupFallbackScheduler();
    } catch (error) {
      logger.error('[AutomaticBackup] Failed to configure periodic sync:', error);
      this.setupFallbackScheduler();
    }
  }

  private async registerPeriodicSync(registration: ServiceWorkerRegistration): Promise<void> {
    if (!this.hasPeriodicSyncSupport(registration)) {
      logger.warn('[AutomaticBackup] Service worker does not support periodic sync');
      this.setupFallbackScheduler();
      return;
    }

    const config = this.getBackupConfig();
    
    // Calculate minimum interval based on frequency
    const minInterval = this.getMinInterval(config.frequency);
    
    try {
      await registration.periodicSync.register('automatic-backup', {
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
      void this.performBackup();
    }
    
    // Also check periodically while app is open
    setInterval(() => {
      const now = Date.now();
      const next = this.calculateNextBackupTime(this.getLastBackupTime(), this.getBackupConfig());
      if (now >= next) {
        void this.performBackup();
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
      const backupFiles: BackupFileDescriptor[] = [];
      
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

  private async collectBackupData(): Promise<Record<string, unknown>> {
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
    
    const data: Record<string, unknown> = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      app_version: import.meta.env.VITE_APP_VERSION ?? '1.4.7',
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
    data: Record<string, unknown>, 
    config: BackupConfig
  ): Promise<BackupFileDescriptor> {
    let jsonString = JSON.stringify(data, null, 2);
    
    // Encrypt if enabled
    if (config.encryptionEnabled) {
      jsonString = await this.encryptData(jsonString);
    }
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `wealthtracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    return { format: 'json', data: blob, filename };
  }

  private async createCSVBackup(
    data: Record<string, unknown>
  ): Promise<BackupFileDescriptor> {
    const sections: string[] = [];

    const appendSection = (title: string, rows: Record<string, unknown>[]): void => {
      sections.push(`# ${title}`);
      if (rows.length === 0) {
        sections.push('No records');
        sections.push('');
        return;
      }

      const headers = Array.from(
        rows.reduce<Set<string>>((acc, row) => {
          Object.keys(row).forEach(key => acc.add(key));
          return acc;
        }, new Set<string>())
      );

      sections.push(headers.join(','));
      rows.forEach(row => {
        const values = headers.map(header => {
          const value = (row as Record<string, unknown>)[header];
          if (value === null || value === undefined) {
            return '';
          }
          if (value instanceof Date) {
            return value.toISOString();
          }
          if (typeof value === 'object') {
            return JSON.stringify(value).replace(/"/g, '""');
          }
          const text = String(value);
          return text.includes(',') ? `"${text.replace(/"/g, '""')}"` : text;
        });
        sections.push(values.join(','));
      });
      sections.push('');
    };

    const transactions = Array.isArray(data.transactions)
      ? (data.transactions as Record<string, unknown>[])
      : [];
    const accounts = Array.isArray(data.accounts)
      ? (data.accounts as Record<string, unknown>[])
      : [];
    const investments = Array.isArray(data.investments)
      ? (data.investments as Record<string, unknown>[])
      : [];
    const budgets = Array.isArray(data.budgets)
      ? (data.budgets as Record<string, unknown>[])
      : [];

    appendSection('Transactions', transactions);
    appendSection('Accounts', accounts);
    appendSection('Investments', investments);
    appendSection('Budgets', budgets);

    const csvString = sections.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
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
    backupFiles: BackupFileDescriptor[],
    config: BackupConfig
  ): Promise<void> {
    // Store locally using IndexedDB
    const db = await this.openBackupDB();
    const transaction = db.transaction(['backups'], 'readwrite');
    const store = transaction.objectStore('backups');
    const transactionCompletion = this.waitForTransaction(transaction);
    
    for (const backup of backupFiles) {
      const record: NewBackupRecord = {
        filename: backup.filename,
        format: backup.format,
        data: backup.data,
        timestamp: Date.now(),
        cloudSynced: false,
      };
      await this.waitForRequest(store.add(record));
    }
    await transactionCompletion;
    
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
    backupFiles: BackupFileDescriptor[],
    provider: NonNullable<BackupConfig['cloudProvider']>
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
    const errorMessage = this.resolveErrorMessage(error);

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(
        success ? 'Backup Completed' : 'Backup Failed',
        {
          body: success 
            ? 'Your financial data has been backed up successfully.'
            : `Backup failed: ${errorMessage}`,
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
    nextBackup.setHours(hours || 2, minutes || 0, 0, 0);
    
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

  private getBackupHistory(): BackupHistoryEntry[] {
    const stored = localStorage.getItem(this.BACKUP_HISTORY_KEY);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .map(entry => this.toBackupHistoryEntry(entry))
            .filter((entry): entry is BackupHistoryEntry => entry !== null);
        }
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

  async getStoredBackups(): Promise<BackupSummary[]> {
    const db = await this.openBackupDB();
    const transaction = db.transaction(['backups'], 'readonly');
    const store = transaction.objectStore('backups');
    const rawResult = await this.waitForRequest(store.getAll());
    
    if (!Array.isArray(rawResult)) {
      return [];
    }

    return rawResult
      .map(record => this.toBackupSummary(record))
      .filter((summary): summary is BackupSummary => summary !== null);
  }

  async downloadBackup(backupId: number): Promise<void> {
    const db = await this.openBackupDB();
    const transaction = db.transaction(['backups'], 'readonly');
    const store = transaction.objectStore('backups');
    const backupRecord = await this.waitForRequest(store.get(backupId));
    const summaryWithData = this.toBackupSummary(backupRecord, true);

    if (!summaryWithData?.data) {
      throw new Error('Backup not found');
    }

    const url = URL.createObjectURL(summaryWithData.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = summaryWithData.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async deleteBackup(backupId: number): Promise<void> {
    const db = await this.openBackupDB();
    const transaction = db.transaction(['backups'], 'readwrite');
    const store = transaction.objectStore('backups');
    
    await this.waitForRequest(store.delete(backupId));
    await this.waitForTransaction(transaction);
  }

  private resolveErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }

    return 'Unknown error';
  }

  private hasPeriodicSyncSupport(
    registration: ServiceWorkerRegistration
  ): registration is PeriodicSyncCapableRegistration {
    const candidate = registration as Partial<PeriodicSyncCapableRegistration>;
    return typeof candidate.periodicSync?.register === 'function';
  }

  private waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new DOMException('IndexedDB request failed'));
    });
  }

  private waitForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new DOMException('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error ?? new DOMException('IndexedDB transaction aborted'));
    });
  }

  private toBackupHistoryEntry(value: unknown): BackupHistoryEntry | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const entry = value as Partial<BackupHistoryEntry>;
    if (typeof entry.timestamp !== 'number' || typeof entry.success !== 'boolean') {
      return null;
    }

    const normalized: BackupHistoryEntry = {
      timestamp: entry.timestamp,
      success: entry.success,
    };

    if (entry.format === 'json' || entry.format === 'csv' || entry.format === 'all') {
      normalized.format = entry.format;
    }

    if (typeof entry.filesCreated === 'number') {
      normalized.filesCreated = entry.filesCreated;
    }

    if (typeof entry.error === 'string') {
      normalized.error = entry.error;
    }

    return normalized;
  }

  private toBackupSummary(value: unknown, includeData = false): (BackupSummary & { data?: Blob }) | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const record = value as StoredBackupRecord;
    if (
      typeof record.id !== 'number' ||
      typeof record.filename !== 'string' ||
      !this.isBackupFormat(record.format) ||
      !(record.data instanceof Blob) ||
      typeof record.timestamp !== 'number' ||
      typeof record.cloudSynced !== 'boolean'
    ) {
      return null;
    }

    const summary: BackupSummary & { data?: Blob } = {
      id: record.id,
      filename: record.filename,
      format: record.format,
      timestamp: record.timestamp,
      size: record.data.size,
      cloudSynced: record.cloudSynced,
    };

    if (includeData) {
      summary.data = record.data;
    }

    return summary;
  }

  private isBackupFormat(value: unknown): value is BackupFormat {
    return value === 'json' || value === 'csv';
  }
}

export const automaticBackupService = new AutomaticBackupService();
