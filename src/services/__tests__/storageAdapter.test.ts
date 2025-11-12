import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecureStorageAdapter } from '../storageAdapter';
import { encryptedStorage } from '../encryptedStorageService';
import { indexedDBService } from '../indexedDBService';

vi.mock('../encryptedStorageService', () => {
  const createResolved = () => vi.fn().mockResolvedValue(undefined);
  return {
    encryptedStorage: {
      migrateFromLocalStorage: createResolved(),
      getItem: vi.fn().mockResolvedValue(null),
      setItem: createResolved(),
      removeItem: createResolved(),
      clear: createResolved(),
      cleanupExpiredData: createResolved(),
      exportData: vi.fn().mockResolvedValue({}),
      importData: createResolved(),
      getStorageInfo: vi.fn().mockResolvedValue({ usage: 0, quota: 100, percentUsed: 0 })
    },
    STORAGE_KEYS: {
      ACCOUNTS: 'accounts',
      TRANSACTIONS: 'transactions',
      BUDGETS: 'budgets',
      GOALS: 'goals'
    }
  };
});

vi.mock('../indexedDBService', () => ({
  indexedDBService: {
    init: vi.fn().mockResolvedValue(undefined),
    cleanCache: vi.fn().mockResolvedValue(undefined)
  }
}));

type StorageWithData = Storage & { data: Map<string, string> };

const createMemoryStorage = (): StorageWithData => {
  const data = new Map<string, string>();
  const storage: Partial<Storage> & { data: Map<string, string> } = {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
    clear: vi.fn(() => {
      data.clear();
    }),
    key: vi.fn((index: number) => Array.from(data.keys())[index] ?? null)
  };

  Object.defineProperty(storage, 'length', {
    get: () => data.size
  });

  return storage as StorageWithData;
};

const createTimerHarness = () => {
  const intervalCallbacks: Array<() => Promise<void> | void> = [];
  const timeoutCallbacks: Array<() => Promise<void> | void> = [];
  const intervalHandle = { id: 'interval' } as unknown as ReturnType<typeof setInterval>;
  const timeoutHandle = { id: 'timeout' } as unknown as ReturnType<typeof setTimeout>;

  const setIntervalFn = vi.fn<typeof setInterval>((handler) => {
    intervalCallbacks.push(handler as () => void);
    return intervalHandle;
  });
  const clearIntervalFn = vi.fn<typeof clearInterval>();

  const setTimeoutFn = vi.fn<typeof setTimeout>((handler) => {
    timeoutCallbacks.push(handler as () => void);
    return timeoutHandle;
  });
  const clearTimeoutFn = vi.fn<typeof clearTimeout>();

  return {
    intervalCallbacks,
    timeoutCallbacks,
    intervalHandle,
    timeoutHandle,
    setIntervalFn,
    clearIntervalFn,
    setTimeoutFn,
    clearTimeoutFn
  };
};

const mockedEncryptedStorage = vi.mocked(encryptedStorage, true);
const mockedIndexedDb = vi.mocked(indexedDBService, true);

describe('SecureStorageAdapter (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules cleanup using injected timers and executes callbacks', async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const timers = createTimerHarness();

    const adapter = new SecureStorageAdapter({
      localStorage,
      sessionStorage,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    });

    await adapter.init();

    expect(mockedIndexedDb.init).toHaveBeenCalled();
    expect(mockedEncryptedStorage.migrateFromLocalStorage).toHaveBeenCalled();
    expect(timers.setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);
    expect(timers.setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 5000);

    // Execute interval and timeout callbacks to ensure cleanup runs
    await timers.intervalCallbacks[0]?.();
    await timers.timeoutCallbacks[0]?.();

    expect(mockedEncryptedStorage.cleanupExpiredData).toHaveBeenCalledTimes(2);
    expect(mockedIndexedDb.cleanCache).toHaveBeenCalledTimes(2);

    adapter.destroy();
    expect(timers.clearIntervalFn).toHaveBeenCalledWith(timers.intervalHandle);
    expect(timers.clearTimeoutFn).toHaveBeenCalledWith(timers.timeoutHandle);
  });

  it('falls back to localStorage when encrypted storage misses', async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    sessionStorage.setItem('wt_migration_completed', 'true');
    const timers = createTimerHarness();

    const payload = { foo: 'bar' };
    localStorage.setItem('test-key', JSON.stringify(payload));

    const adapter = new SecureStorageAdapter({
      localStorage,
      sessionStorage,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    });

    await adapter.init();

    const result = await adapter.get<typeof payload>('test-key');
    expect(result).toEqual(payload);
  });

  it('skips migration when session storage already marked complete', async () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    sessionStorage.setItem('wt_migration_completed', 'true');
    const timers = createTimerHarness();

    const adapter = new SecureStorageAdapter({
      localStorage,
      sessionStorage,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    });

    await adapter.init();

    expect(mockedEncryptedStorage.migrateFromLocalStorage).not.toHaveBeenCalled();
  });
});
