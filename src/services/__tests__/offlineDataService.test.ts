import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { OfflineDataService } from '../offlineDataService';

const createService = () => {
  const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
  const service = new OfflineDataService({
    indexedDB,
    navigatorRef: { onLine: true },
    windowRef: {},
    fetchFn
  });
  return { service, fetchFn };
};

describe('OfflineDataService (DI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues sync items and performs sync via injected fetch', async () => {
    const { service, fetchFn } = createService();
    await service.addToSyncQueue('transaction', 'create', { id: 'txn-1', amount: 10 });
    await service.performSync();
    expect(fetchFn).toHaveBeenCalledWith('/api/transactions', expect.any(Object));
  });

  it('caches and retrieves data via injected indexedDB', async () => {
    const { service } = createService();
    await service.cacheData('test-key', { value: 42 }, 1);
    const cached = await service.getCachedData('test-key');
    expect(cached).toEqual({ value: 42 });
  });
});
