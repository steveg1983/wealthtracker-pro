import { encryptedStorage, STORAGE_KEYS } from './encryptedStorageService';
import { indexedDBService } from './indexedDBService';

// Re-export STORAGE_KEYS for external use
export { STORAGE_KEYS } from './encryptedStorageService';

interface StorageAdapter {
  isReady: boolean;
  init(): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
  key?(index: number): string | null;
  length?: number;
}

type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

export interface SecureStorageAdapterOptions {
  localStorage?: StorageLike | null;
  sessionStorage?: StorageLike | null;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  logger?: Logger;
}

export class SecureStorageAdapter implements StorageAdapter {
  private _isReady = false;
  private migrationCompleted = false;
  private readonly localStorageRef: StorageLike | null;
  private readonly sessionStorageRef: StorageLike | null;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly logger: Logger;
  private cleanupInterval?: ReturnType<typeof setInterval>;
  private initialCleanupTimeout?: ReturnType<typeof setTimeout>;

  constructor(options: SecureStorageAdapterOptions = {}) {
    const defaultLocalStorage = typeof window !== 'undefined' ? window.localStorage : null;
    const defaultSessionStorage = typeof window !== 'undefined' ? window.sessionStorage : null;

    this.localStorageRef = options.localStorage ?? defaultLocalStorage;
    this.sessionStorageRef = options.sessionStorage ?? defaultSessionStorage;
    this.setIntervalFn =
      options.setIntervalFn ??
      ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => setInterval(handler, timeout, ...args));
    this.clearIntervalFn =
      options.clearIntervalFn ?? ((id: ReturnType<typeof setInterval>) => clearInterval(id));
    this.setTimeoutFn =
      options.setTimeoutFn ??
      ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => setTimeout(handler, timeout, ...args));
    this.clearTimeoutFn =
      options.clearTimeoutFn ?? ((id: ReturnType<typeof setTimeout>) => clearTimeout(id));
    const defaultLogger = typeof console !== 'undefined'
      ? console
      : { log: () => {}, warn: () => {}, error: () => {} };
    this.logger = options.logger ?? defaultLogger;
  }

  get isReady(): boolean {
    return this._isReady;
  }

  async init(): Promise<void> {
    try {
      // Initialize IndexedDB
      await indexedDBService.init();
      
      // Check if migration is needed
      const migrationFlag = this.sessionStorageRef?.getItem('wt_migration_completed');
      if (!migrationFlag) {
        await this.migrateFromLocalStorage();
        this.sessionStorageRef?.setItem('wt_migration_completed', 'true');
      }
      
      this._isReady = true;
      
      // Schedule periodic cleanup
      this.scheduleCleanup();
    } catch (error) {
      this.logger.error('Failed to initialize secure storage:', error);
      // Fallback to localStorage if IndexedDB fails
      this._isReady = true;
    }
  }

  private async migrateFromLocalStorage(): Promise<void> {
    if (!this.localStorageRef) {
      this.logger.warn('LocalStorage unavailable; skipping migration');
      return;
    }

    this.logger.log('Starting migration from localStorage to encrypted IndexedDB...');
    
    const keysToMigrate: string[] = [
      STORAGE_KEYS.ACCOUNTS,
      STORAGE_KEYS.TRANSACTIONS,
      STORAGE_KEYS.BUDGETS,
      STORAGE_KEYS.GOALS,
      STORAGE_KEYS.TAGS,
      STORAGE_KEYS.RECURRING,
      STORAGE_KEYS.CATEGORIES,
      STORAGE_KEYS.PREFERENCES,
      STORAGE_KEYS.THEME,
      STORAGE_KEYS.ACCENT_COLOR,
      STORAGE_KEYS.NOTIFICATIONS,
      STORAGE_KEYS.BUDGET_ALERTS,
      STORAGE_KEYS.ALERT_THRESHOLD,
      STORAGE_KEYS.LARGE_TRANSACTION_ALERTS,
      STORAGE_KEYS.LARGE_TRANSACTION_THRESHOLD,
    ];

    // Add other keys that start with wealthtracker_ or money_management_
    for (let i = 0; i < (this.localStorageRef?.length ?? 0); i++) {
      const key = this.localStorageRef?.key(i);
      if (key && (key.startsWith('wealthtracker_') || key.startsWith('money_management_'))) {
        if (!keysToMigrate.includes(key)) {
          keysToMigrate.push(key);
        }
      }
    }

    try {
      await encryptedStorage.migrateFromLocalStorage(keysToMigrate);
      this.logger.log('Migration completed successfully');
      this.migrationCompleted = true;
    } catch (error) {
      this.logger.error('Migration failed:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      // Try encrypted storage first
      const data = await encryptedStorage.getItem<T>(key);
      if (data !== null) {
        return data;
      }

      // Fallback to localStorage if not found in IndexedDB
      if (!this.migrationCompleted) {
        const localData = this.localStorageRef?.getItem(key);
        if (localData) {
          try {
            return JSON.parse(localData) as T;
          } catch {
            return localData as unknown as T;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting ${key}:`, error);
      // Final fallback to localStorage
      const localData = this.localStorageRef?.getItem(key);
      if (localData) {
        try {
          return JSON.parse(localData) as T;
        } catch {
          return localData as unknown as T;
        }
      }
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      // Determine if this is sensitive data that should be encrypted
      const sensitiveKeys = [
        STORAGE_KEYS.ACCOUNTS,
        STORAGE_KEYS.TRANSACTIONS,
        STORAGE_KEYS.BUDGETS,
        STORAGE_KEYS.GOALS,
      ];
      
      const isFinancialData = sensitiveKeys.includes(key) || 
                              key.includes('transaction') || 
                              key.includes('account') ||
                              key.includes('budget') ||
                              key.includes('financial');

      // Store in encrypted storage
      await encryptedStorage.setItem(key, value, {
        encrypted: isFinancialData,
        expiryDays: isFinancialData ? undefined : 30, // Financial data doesn't expire
        compress: JSON.stringify(value).length > 10240 // Compress large data
      });

      // Remove from localStorage if migration is complete
      if (this.migrationCompleted) {
        this.localStorageRef?.removeItem(key);
      }
    } catch (error) {
      this.logger.error(`Error setting ${key}:`, error);
      // Fallback to localStorage
      this.localStorageRef?.setItem(key, JSON.stringify(value));
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await encryptedStorage.removeItem(key);
      this.localStorageRef?.removeItem(key); // Also remove from localStorage
    } catch (error) {
      this.logger.error(`Error removing ${key}:`, error);
      this.localStorageRef?.removeItem(key);
    }
  }

  async clear(): Promise<void> {
    try {
      await encryptedStorage.clear();
      // Clear related localStorage keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < (this.localStorageRef?.length ?? 0); i++) {
        const key = this.localStorageRef?.key(i);
        if (key && (key.startsWith('wealthtracker_') || key.startsWith('money_management_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => this.localStorageRef?.removeItem(key));
    } catch (error) {
      this.logger.error('Error clearing storage:', error);
    }
  }

  // Schedule periodic cleanup of expired data
  private scheduleCleanup(): void {
    this.clearCleanupTimers();

    // Run cleanup every hour
    this.cleanupInterval = this.setIntervalFn(async () => {
      try {
        await encryptedStorage.cleanupExpiredData();
        await indexedDBService.cleanCache();
      } catch (error) {
        this.logger.error('Cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Run initial cleanup after 5 seconds
    this.initialCleanupTimeout = this.setTimeoutFn(async () => {
      try {
        await encryptedStorage.cleanupExpiredData();
        await indexedDBService.cleanCache();
      } catch (error) {
        this.logger.error('Initial cleanup error:', error);
      }
    }, 5000);
  }

  private clearCleanupTimers(): void {
    if (this.cleanupInterval) {
      this.clearIntervalFn(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    if (this.initialCleanupTimeout) {
      this.clearTimeoutFn(this.initialCleanupTimeout);
      this.initialCleanupTimeout = undefined;
    }
  }

  // Export data for backup
  async exportData(): Promise<Record<string, unknown>> {
    return await encryptedStorage.exportData();
  }

  // Import data from backup
  async importData(data: Record<string, unknown>): Promise<void> {
    await encryptedStorage.importData(data, { encrypted: true });
  }

  // Get storage usage info
  async getStorageInfo(): Promise<{ usage: number; quota: number; percentUsed: number }> {
    return await encryptedStorage.getStorageInfo();
  }
  destroy(): void {
    this.clearCleanupTimers();
  }
}

// Create singleton instance
export const storageAdapter = new SecureStorageAdapter();

// Hook for React components
import { useEffect, useState } from 'react';
import { createScopedLogger } from '../loggers/scopedLogger';
const uiStorageLogger = createScopedLogger('useSecureStorage');

export function useSecureStorage<T>(key: string, initialValue: T): [T, (value: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const isReady = storageAdapter.isReady;

  useEffect(() => {
    const loadValue = async () => {
      try {
        const stored = await storageAdapter.get<T>(key);
        if (stored !== null) {
          setValue(stored);
        }
      } catch (error) {
        uiStorageLogger.error(`Error loading ${key}`, error as Error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isReady) {
      loadValue();
    }
  }, [key, isReady]);

  const setStoredValue = async (newValue: T) => {
    setValue(newValue);
    await storageAdapter.set(key, newValue);
  };

  return [value, setStoredValue, isLoading];
}

export default storageAdapter;
