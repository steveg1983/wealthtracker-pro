/**
 * indexedDBService Tests
 * Verifies initialization semantics for the shared IndexedDB gateway.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { indexedDBService } from './indexedDBService';

describe('indexedDBService', () => {
  beforeEach(() => {
    // Release whatever a previous test left open, and reset the cached state.
    indexedDBService.close();
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

  it('re-opens after its connection has been closed', async () => {
    await indexedDBService.init();
    indexedDBService.close();

    // Without clearing the cached init promise, this would resolve onto the
    // closed handle and every read after it would throw.
    await expect(indexedDBService.init()).resolves.toBeUndefined();
    await expect(indexedDBService.get('secureData', 'nothing-here')).resolves.toBeUndefined();
  });

  it('gives up its connection so a delete of the database is never blocked', async () => {
    // The dead demo session: a delete (devtools, "clear site data", another
    // tab) blocked on this connection, and every open queued behind it never
    // fired an event again — the app hung mid-boot with an empty screen.
    await indexedDBService.init();

    const blocked = vi.fn();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('WealthTrackerDB');
      request.onblocked = blocked;
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('deleteDatabase failed'));
    });

    expect(blocked).not.toHaveBeenCalled();
  });
});
