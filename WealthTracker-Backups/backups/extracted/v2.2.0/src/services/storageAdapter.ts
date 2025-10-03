import { encryptedStorage, STORAGE_KEYS } from './encryptedStorageService';
import { indexedDBService } from './indexedDBService';
import type { ExportableData } from '../types/export';

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

class SecureStorageAdapter implements StorageAdapter {
  private _isReady = false;
  private migrationCompleted = false;

  get isReady(): boolean {
    return this._isReady;
  }

  async init(): Promise<void> {
    try {
      // Initialize IndexedDB
      await indexedDBService.init();
      
      // Check if migration is needed
      const migrationFlag = sessionStorage.getItem('wt_migration_completed');
      if (!migrationFlag) {
        await this.migrateFromLocalStorage();
        sessionStorage.setItem('wt_migration_completed', 'true');
      }
      
      this._isReady = true;
      
      // Schedule periodic cleanup
      this.scheduleCleanup();
    } catch (error) {
      logger.error('Failed to initialize secure storage:', error);
      // Fallback to localStorage if IndexedDB fails
      this._isReady = true;
    }
  }

  private async migrateFromLocalStorage(): Promise<void> {
    logger.info('Starting migration from localStorage to encrypted IndexedDB...');
    
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
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('wealthtracker_') || key.startsWith('money_management_'))) {
        if (!keysToMigrate.includes(key)) {
          keysToMigrate.push(key);
        }
      }
    }

    try {
      await encryptedStorage.migrateFromLocalStorage(keysToMigrate);
      logger.info('Migration completed successfully');
      this.migrationCompleted = true;
    } catch (error) {
      logger.error('Migration failed:', error);
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
        const localData = localStorage.getItem(key);
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
      logger.error(`Error getting ${key}:`, error);
      // Final fallback to localStorage
      const localData = localStorage.getItem(key);
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
      
      const isFinancialData = sensitiveKeys.some(k => k === key) || 
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
        localStorage.removeItem(key);
      }
    } catch (error) {
      logger.error(`Error setting ${key}:`, error);
      // Fallback to localStorage
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await encryptedStorage.removeItem(key);
      localStorage.removeItem(key); // Also remove from localStorage
    } catch (error) {
      logger.error(`Error removing ${key}:`, error);
      localStorage.removeItem(key);
    }
  }

  async clear(): Promise<void> {
    try {
      await encryptedStorage.clear();
      // Clear related localStorage keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('wealthtracker_') || key.startsWith('money_management_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      logger.error('Error clearing storage:', error);
    }
  }

  // Schedule periodic cleanup of expired data
  private scheduleCleanup(): void {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        await encryptedStorage.cleanupExpiredData();
        await indexedDBService.cleanCache();
      } catch (error) {
        logger.error('Cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Run initial cleanup after 5 seconds
    setTimeout(async () => {
      try {
        await encryptedStorage.cleanupExpiredData();
        await indexedDBService.cleanCache();
      } catch (error) {
        logger.error('Initial cleanup error:', error);
      }
    }, 5000);
  }

  // Export data for backup
  async exportData(): Promise<ExportableData> {
    return await encryptedStorage.exportData();
  }

  // Import data from backup
  async importData(data: ExportableData): Promise<void> {
    await encryptedStorage.importData(data, { encrypted: true });
  }

  // Get storage usage info
  async getStorageInfo(): Promise<{ usage: number; quota: number; percentUsed: number }> {
    return await encryptedStorage.getStorageInfo();
  }
}

// Create singleton instance
export const storageAdapter = new SecureStorageAdapter();

// Hook for React components
import { useEffect, useState } from 'react';
import { logger } from './loggingService';

export function useSecureStorage<T>(key: string, initialValue: T): [T, (value: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadValue = async () => {
      try {
        const stored = await storageAdapter.get<T>(key);
        if (stored !== null) {
          setValue(stored);
        }
      } catch (error) {
        logger.error(`Error loading ${key}:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    if (storageAdapter.isReady) {
      loadValue();
    }
  }, [key, storageAdapter.isReady]);

  const setStoredValue = async (newValue: T) => {
    setValue(newValue);
    await storageAdapter.set(key, newValue);
  };

  return [value, setStoredValue, isLoading];
}

export default storageAdapter;
