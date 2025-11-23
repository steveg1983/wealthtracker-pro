/**
 * indexedDBService Tests
 * Verifies initialization semantics for the shared IndexedDB gateway.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { indexedDBService } from './indexedDBService';

describe('indexedDBService', () => {
  beforeEach(() => {
    // Reset internal state between tests
    (indexedDBService as unknown as { db: IDBDatabase | null }).db = null;
    (indexedDBService as unknown as { initPromise: Promise<void> | null }).initPromise = null;
  });

  it('initializes successfully and resolves once', async () => {
    await expect(indexedDBService.init()).resolves.toBeUndefined();
    // Calling init again should reuse the same promise and not throw
    await expect(indexedDBService.init()).resolves.toBeUndefined();
  });

  it('only performs initialization work once for concurrent calls', async () => {
    const doInitSpy = vi.spyOn(
      indexedDBService as unknown as { _doInit: () => Promise<void> },
      '_doInit'
    );

    await Promise.all([indexedDBService.init(), indexedDBService.init()]);
    expect(doInitSpy).toHaveBeenCalledTimes(1);
    doInitSpy.mockRestore();
  });
});
