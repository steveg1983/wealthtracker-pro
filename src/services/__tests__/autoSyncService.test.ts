import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AutoSyncServiceOptions } from '../autoSyncService';
import { AutoSyncService } from '../autoSyncService';

const createStorage = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    })
  };
};

const createTimers = () => {
  const callbacks: Array<() => void> = [];
  const intervalHandle = { id: 'interval' } as unknown as ReturnType<typeof setInterval>;
  const setIntervalFn = vi.fn<typeof setInterval>((handler) => {
    callbacks.push(handler as () => void);
    return intervalHandle;
  });
  const clearIntervalFn = vi.fn<typeof clearInterval>();
  return { callbacks, intervalHandle, setIntervalFn, clearIntervalFn };
};

const createService = (overrides: Partial<AutoSyncServiceOptions> = {}) => {
  const storage = overrides.storage ?? createStorage();
  const timers = createTimers();
  const windowRef = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  const service = new AutoSyncService({
    storage,
    windowRef,
    uuidGenerator: overrides.uuidGenerator ?? (() => 'uuid-1'),
    setIntervalFn: overrides.setIntervalFn ?? timers.setIntervalFn,
    clearIntervalFn: overrides.clearIntervalFn ?? timers.clearIntervalFn,
    dateFactory: overrides.dateFactory ?? (() => new Date('2024-01-01T00:00:00Z')),
    now: overrides.now ?? (() => 1_700_000_000_000)
  });

  return { service, storage, timers, windowRef };
};

describe('AutoSyncService (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues operations and triggers processing when online', () => {
    const { service } = createService();
    const processSpy = vi.spyOn(service as unknown as { processSyncQueue: () => Promise<void> }, 'processSyncQueue').mockResolvedValue();
    (service as any).syncStatus.isOnline = true;

    service.queueOperation('CREATE', 'account', { id: 'acc-1' });

    expect(processSpy).toHaveBeenCalledTimes(1);
    service.stopSync();
  });

  it('starts and stops continuous sync using injected timers', () => {
    const { service, timers } = createService();
    (service as any).startContinuousSync();

    expect(timers.setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 5000);

    service.stopSync();
    expect(timers.clearIntervalFn).toHaveBeenCalledWith(timers.intervalHandle);
  });

  it('converts local storage to cache mode using injected storage', async () => {
    const { service, storage } = createService();
    await (service as any).convertLocalToCache();
    expect(storage.setItem).toHaveBeenCalledWith('primaryStorage', 'cloud');
    service.stopSync();
  });
});
