
import type { StructuredLogger } from './serviceFactory';

export type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike | undefined };

export interface EncryptedStorageOptions {
  encrypted?: boolean;
  compress?: boolean;
  expiryDays?: number;
}

export interface EncryptedStorage {
  migrateFromLocalStorage(keys: string[]): Promise<void>;
  getItem(key: string): Promise<JsonLike | null>;
  setItem(key: string, value: JsonLike, options?: EncryptedStorageOptions): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  cleanupExpiredData(): Promise<void>;
}

export interface IndexedDbService {
  init(): Promise<void>;
  cleanCache(): Promise<void>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  length?: number;
  key?(index: number): string | null;
  clear?(): void;
}

export interface StorageAdapterLogger extends Pick<StructuredLogger, 'info' | 'warn' | 'error'> {}

export interface CreateStorageAdapterOptions {
  storageKeys: Record<string, string>;
  encryptedStorage: EncryptedStorage;
  indexedDb: IndexedDbService;
  logger?: StorageAdapterLogger;
  sessionStorage?: StorageLike | null | undefined;
  localStorage?: StorageLike | null | undefined;
  scheduleCleanup?: (handler: () => void, intervalMs: number) => number;
}

export interface StorageAdapter {
  readonly isReady: boolean;
  init(): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

const noopLogger: StorageAdapterLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLEANUP_INTERVAL = 60 * 60 * 1000;

export function createStorageAdapter(options: CreateStorageAdapterOptions): StorageAdapter {
  const {
    storageKeys,
    encryptedStorage,
    indexedDb,
    logger = typeof console !== 'undefined'
      ? {
          info: console.info?.bind(console) ?? noopLogger.info,
          warn: console.warn?.bind(console) ?? noopLogger.warn,
          error: console.error?.bind(console) ?? noopLogger.error,
        }
      : noopLogger,
    sessionStorage = typeof window !== 'undefined' ? window.sessionStorage : undefined,
    localStorage = typeof window !== 'undefined' ? window.localStorage : undefined,
    scheduleCleanup,
  } = options;

  let isReady = false;
  let migrationCompleted = false;

  const getSessionItem = (key: string): string | null => {
    try {
      return sessionStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };

  const setSessionItem = (key: string, value: string): void => {
    try {
      sessionStorage?.setItem(key, value);
    } catch {
      // ignore session storage failures
    }
  };

  const getLocalItem = (key: string): string | null => {
    try {
      return localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };

  const setLocalItem = (key: string, value: string): void => {
    try {
      localStorage?.setItem(key, value);
    } catch {
      // ignore fallback write failures
    }
  };

  const removeLocalItem = (key: string): void => {
    try {
      localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  };

  const listLocalKeys = (): string[] => {
    const keys: string[] = [];
    if (!localStorage || typeof localStorage.length !== 'number') {
      return keys;
    }
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key ? localStorage.key(i) : null;
      if (key) {
        keys.push(key);
      }
    }
    return keys;
  };

  const toJsonValue = (value: unknown): JsonLike => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map(item => toJsonValue(item));
    }

    if (typeof value === 'object') {
      const result: Record<string, JsonLike | undefined> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        result[key] = toJsonValue(nested);
      }
      return result;
    }

    return String(value);
  };

  const storeInLocalStorageFallback = (key: string, value: JsonLike): void => {
    const serialized = JSON.stringify(value);
    if (serialized !== undefined) {
      setLocalItem(key, serialized);
    }
  };

  const migrateFromLocalStorage = async (): Promise<void> => {
    if (!localStorage) {
      return;
    }

    logger.info('Starting migration from localStorage to encrypted IndexedDB...');

    const initialKeys = [
      storageKeys.ACCOUNTS,
      storageKeys.TRANSACTIONS,
      storageKeys.BUDGETS,
      storageKeys.GOALS,
      storageKeys.TAGS,
      storageKeys.RECURRING,
      storageKeys.CATEGORIES,
      storageKeys.PREFERENCES,
      storageKeys.THEME,
      storageKeys.ACCENT_COLOR,
      storageKeys.NOTIFICATIONS,
      storageKeys.BUDGET_ALERTS,
      storageKeys.ALERT_THRESHOLD,
      storageKeys.LARGE_TRANSACTION_ALERTS,
      storageKeys.LARGE_TRANSACTION_THRESHOLD,
    ].filter((key): key is string => typeof key === 'string' && key.length > 0);

    const keysToMigrate = new Set<string>(initialKeys);

    for (const key of listLocalKeys()) {
      if (key.startsWith('wealthtracker_') || key.startsWith('money_management_')) {
        keysToMigrate.add(key);
      }
    }

    try {
      await encryptedStorage.migrateFromLocalStorage(Array.from(keysToMigrate));
      logger.info('Migration completed successfully');
      migrationCompleted = true;
    } catch (error) {
      logger.error('Migration failed', error);
    }
  };

  const scheduleCleanupTask = (): void => {
    const scheduler = scheduleCleanup ?? (typeof setInterval === 'function' ? setInterval : undefined);
    if (!scheduler) {
      return;
    }

    scheduler(async () => {
      try {
        await encryptedStorage.cleanupExpiredData();
        await indexedDb.cleanCache();
      } catch (error) {
        logger.error('Cleanup error', error);
      }
    }, DEFAULT_CLEANUP_INTERVAL);
  };

  const adapter: StorageAdapter = {
    get isReady(): boolean {
      return isReady;
    },

    async init(): Promise<void> {
      try {
        await indexedDb.init();

        const migrationFlag = getSessionItem('wt_migration_completed');
        if (!migrationFlag) {
          await migrateFromLocalStorage();
          setSessionItem('wt_migration_completed', 'true');
        }

        isReady = true;
        scheduleCleanupTask();
      } catch (error) {
        logger.error('Failed to initialize secure storage', error);
        isReady = true;
      }
    },

    async get<T>(key: string): Promise<T | null> {
      try {
        const data = await encryptedStorage.getItem(key);
        if (data !== null) {
          return data as T;
        }

        if (!migrationCompleted) {
          const localData = getLocalItem(key);
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
        logger.error(`Error getting ${key}`, error);
        const localData = getLocalItem(key);
        if (localData) {
          try {
            return JSON.parse(localData) as T;
          } catch {
            return localData as unknown as T;
          }
        }
        return null;
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      const serializableValue = toJsonValue(value);

      try {
        const sensitiveKeys = new Set<string>([
          storageKeys.ACCOUNTS,
          storageKeys.TRANSACTIONS,
          storageKeys.BUDGETS,
          storageKeys.GOALS,
        ].filter((key): key is string => typeof key === 'string' && key.length > 0));

        const serialized = JSON.stringify(serializableValue);

        const normalizedKey = key.toLowerCase();
        const isFinancialData =
          sensitiveKeys.has(key) ||
          normalizedKey.includes('transaction') ||
          normalizedKey.includes('account') ||
          normalizedKey.includes('budget') ||
          normalizedKey.includes('financial');

        await encryptedStorage.setItem(key, serializableValue, {
          encrypted: isFinancialData,
          compress: serialized.length > 10240,
          ...(isFinancialData ? {} : { expiryDays: 30 }),
        });

        if (migrationCompleted) {
          removeLocalItem(key);
        }
      } catch (error) {
        logger.error(`Error setting ${key}`, error);
        storeInLocalStorageFallback(key, serializableValue);
      }
    },

    async remove(key: string): Promise<void> {
      try {
        await encryptedStorage.removeItem(key);
        removeLocalItem(key);
      } catch (error) {
        logger.error(`Error removing ${key}`, error);
        removeLocalItem(key);
      }
    },

    async clear(): Promise<void> {
      try {
        await encryptedStorage.clear();
        for (const key of listLocalKeys()) {
          if (key.startsWith('wealthtracker_') || key.startsWith('money_management_')) {
            removeLocalItem(key);
          }
        }
      } catch (error) {
        logger.error('Error clearing storage', error);
      }
    },
  };

  return adapter;
}
