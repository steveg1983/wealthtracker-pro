import CryptoJS from 'crypto-js';
import { indexedDBService } from './indexedDBService';
import type { JsonValue } from '../types/common';
import type { StorageOptions, StoredData, StorageItem, BulkStorageItem, StorageEstimate, ExportedData } from '../types/storage';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem' | 'removeItem'>;
type Logger = Pick<Console, 'error' | 'warn'>;
type _NavigatorStorage = Pick<NavigatorStorage, 'estimate'>;

export interface EncryptedStorageServiceOptions {
  sessionStorage?: StorageWriter & StorageReader | null;
  localStorage?: StorageWriter & StorageReader | null;
  logger?: Logger;
  now?: () => number;
  keyGenerator?: () => string;
  navigatorRef?: Pick<Navigator, 'storage'> | null;
}

export class EncryptedStorageService {
  private encryptionKey: string;
  private storeName = 'secureData';
  private compressionThreshold = 10240; // 10KB
  private readonly sessionStorageRef: (StorageWriter & StorageReader) | null;
  private readonly localStorageRef: (StorageWriter & StorageReader) | null;
  private readonly logger: Logger;
  private readonly nowProvider: () => number;
  private readonly keyGenerator: () => string;
  private readonly navigatorRef: Pick<Navigator, 'storage'> | null;
  private memoryKey?: string;

  constructor(options: EncryptedStorageServiceOptions = {}) {
    this.sessionStorageRef =
      options.sessionStorage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    this.localStorageRef =
      options.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? (() => {})),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? (() => {}))
    };
    this.nowProvider = options.now ?? (() => Date.now());
    this.keyGenerator =
      options.keyGenerator ??
      (() => CryptoJS.lib.WordArray.random(256 / 8).toString());
    this.navigatorRef = options.navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : null);
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  private getOrCreateEncryptionKey(): string {
    if (this.sessionStorageRef) {
      let key = this.sessionStorageRef.getItem('wt_enc_key');
      if (!key) {
        key = this.keyGenerator();
        this.sessionStorageRef.setItem('wt_enc_key', key);
      }
      return key;
    }
    if (!this.memoryKey) {
      this.memoryKey = this.keyGenerator();
    }
    return this.memoryKey;
  }

  // Encrypt data
  private encrypt(data: JsonValue): string {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, this.encryptionKey).toString();
  }

  // Decrypt data
  private decrypt(encryptedData: string): JsonValue {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedString) as JsonValue;
    } catch (error) {
      this.logger.error('Decryption failed:', error as Error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Compress data using simple LZ compression
  private compress(data: string): string {
    // Simple compression for demonstration
    // In production, consider using lz-string or similar
    return btoa(data);
  }

  // Decompress data
  private decompress(data: string): string {
    return atob(data);
  }

  // Store data in IndexedDB with optional encryption
  async setItem<T>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
    const { encrypted = true, expiryDays, compress = false } = options;
    
    let processedData: T | string = value;
    let shouldCompress = false;

    // Check if compression is beneficial
    const dataSize = JSON.stringify(value).length;
    if (compress && dataSize > this.compressionThreshold) {
      shouldCompress = true;
    }

    // Encrypt if requested
    if (encrypted) {
      processedData = this.encrypt(value as JsonValue);
    } else if (shouldCompress) {
      processedData = this.compress(JSON.stringify(value));
    }

    const now = this.nowProvider();
    const storedData: StoredData<T> = {
      data: processedData,
      timestamp: now,
      encrypted,
      compressed: shouldCompress && !encrypted
    };

    // Add expiry if specified
    if (expiryDays) {
      storedData.expiry = now + expiryDays * 24 * 60 * 60 * 1000;
    }

    await indexedDBService.put(this.storeName, { key, ...storedData });
  }

  // Retrieve data from IndexedDB
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const storedData = await indexedDBService.get<StoredData<T>>(this.storeName, key);
      
      if (!storedData) {
        return null;
      }

      // Check if data has expired
      if (storedData.expiry && Date.now() > storedData.expiry) {
        await this.removeItem(key);
        return null;
      }

      let data = storedData.data;

      // Decrypt if encrypted
      if (storedData.encrypted && typeof data === 'string') {
        data = this.decrypt(data) as T;
      } else if (storedData.compressed && typeof data === 'string') {
        data = JSON.parse(this.decompress(data)) as T;
      }

      return data as T;
    } catch (error) {
      this.logger.error('Error retrieving data:', error as Error);
      return null;
    }
  }

  // Remove item from storage
  async removeItem(key: string): Promise<void> {
    await indexedDBService.delete(this.storeName, key);
  }

  // Clear all encrypted storage
  async clear(): Promise<void> {
    await indexedDBService.clearStore(this.storeName);
  }

  // Get all keys
  async getAllKeys(): Promise<string[]> {
    return await indexedDBService.getAllKeys(this.storeName);
  }

  // Bulk operations for better performance
  async setItems<T extends JsonValue = JsonValue>(items: Array<StorageItem<T>>): Promise<void> {
    const processedItems = await Promise.all(
      items.map(async ({ key, value, options }) => {
        const { encrypted = true, expiryDays, compress = false } = options || {};
        
        let processedData: T | string = value;
        let shouldCompress = false;

        const dataSize = JSON.stringify(value).length;
        if (compress && dataSize > this.compressionThreshold) {
          shouldCompress = true;
        }

        if (encrypted) {
          processedData = this.encrypt(value);
        } else if (shouldCompress) {
          processedData = this.compress(JSON.stringify(value));
        }

        const now = this.nowProvider();
        const storedData: StoredData<T> = {
          data: processedData,
          timestamp: now,
          encrypted,
          compressed: shouldCompress && !encrypted
        };

        if (expiryDays) {
          storedData.expiry = now + expiryDays * 24 * 60 * 60 * 1000;
        }

        return { key, value: storedData } as BulkStorageItem;
      })
    );

    await indexedDBService.putBulk(this.storeName, processedItems);
  }

  // Migrate data from localStorage to encrypted IndexedDB
  async migrateFromLocalStorage(keys: string[]): Promise<void> {
    const migrationItems: Array<StorageItem> = [];

    if (!this.localStorageRef) return;
    for (const key of keys) {
      const data = this.localStorageRef.getItem(key);
      if (data) {
        try {
          // Try to parse as JSON first
          const parsedData = JSON.parse(data);
          migrationItems.push({
            key,
            value: parsedData,
            options: { encrypted: true }
          });
        } catch {
          // If parsing fails, it might be a raw string value (like 'light' or 'blue')
          // Store it as-is
          migrationItems.push({
            key,
            value: data,
            options: { encrypted: true }
          });
          this.logger.warn(`Migrating non-JSON value for key ${key}: "${data}"`);
        }
      }
    }

    if (migrationItems.length > 0) {
      await this.setItems(migrationItems);
      
      // Remove from localStorage after successful migration
      for (const key of keys) {
        this.localStorageRef.removeItem(key);
      }
    }
  }

  // Clean up expired data
  async cleanupExpiredData(): Promise<void> {
    const keys = await this.getAllKeys();
    
    for (const key of keys) {
      const storedData = await indexedDBService.get<StoredData<JsonValue>>(this.storeName, key);
      
      if (storedData?.expiry && this.nowProvider() > storedData.expiry) {
        await this.removeItem(key);
      }
    }
  }

  // Export all data (for backup)
  async exportData(): Promise<ExportedData> {
    const keys = await this.getAllKeys();
    const exportedData: ExportedData = {};

    for (const key of keys) {
      const data = await this.getItem(key);
      if (data !== null) {
        exportedData[key] = data as JsonValue;
      }
    }

    return exportedData;
  }

  // Import data (from backup)
  async importData(data: ExportedData, options: StorageOptions = {}): Promise<void> {
    const items = Object.entries(data).map(([key, value]) => ({
      key,
      value,
      options
    }));

    await this.setItems(items);
  }

  // Check storage usage
  async getStorageInfo(): Promise<StorageEstimate> {
    if (this.navigatorRef?.storage?.estimate) {
      const estimate = await this.navigatorRef.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        usage,
        quota,
        percentUsed
      };
    }

    return {
      usage: 0,
      quota: 0,
      percentUsed: 0
    };
  }
}

// Create singleton instance
export const encryptedStorage = new EncryptedStorageService();

// Storage key constants
export const STORAGE_KEYS = {
  ACCOUNTS: 'wealthtracker_accounts',
  TRANSACTIONS: 'wealthtracker_transactions',
  BUDGETS: 'wealthtracker_budgets',
  GOALS: 'wealthtracker_goals',
  TAGS: 'wealthtracker_tags',
  RECURRING: 'wealthtracker_recurring',
  CATEGORIES: 'wealthtracker_categories',
  PREFERENCES: 'wealthtracker_preferences',
  THEME: 'money_management_theme',
  ACCENT_COLOR: 'money_management_accent_color',
  NOTIFICATIONS: 'money_management_notifications',
  BUDGET_ALERTS: 'money_management_budget_alerts_enabled',
  ALERT_THRESHOLD: 'money_management_alert_threshold',
  LARGE_TRANSACTION_ALERTS: 'money_management_large_transaction_alerts_enabled',
  LARGE_TRANSACTION_THRESHOLD: 'money_management_large_transaction_threshold',
} as const;

export default encryptedStorage;
