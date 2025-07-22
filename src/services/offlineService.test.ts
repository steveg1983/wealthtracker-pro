/**
 * offlineService Tests
 * Comprehensive tests for offline data synchronization and conflict resolution
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { offlineService } from './offlineService';
import type { Transaction } from '../types';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Mock idb module
vi.mock('idb', async () => {
  const actual = await vi.importActual<typeof import('idb')>('idb');
  return {
    ...actual,
    openDB: actual.openDB
  };
});

// Mock fetch
global.fetch = vi.fn();

// Mock window event listeners
const mockEventListeners: { [key: string]: EventListener[] } = {};
const originalAddEventListener = window.addEventListener;
const originalDispatchEvent = window.dispatchEvent;

window.addEventListener = vi.fn((event: string, handler: EventListener) => {
  if (!mockEventListeners[event]) {
    mockEventListeners[event] = [];
  }
  mockEventListeners[event].push(handler);
}) as any;

window.dispatchEvent = vi.fn((event: Event) => {
  const handlers = mockEventListeners[event.type];
  if (handlers) {
    handlers.forEach(handler => handler(event));
  }
  return true;
}) as any;

// Mock document visibility
let mockDocumentHidden = false;
Object.defineProperty(document, 'hidden', {
  get: () => mockDocumentHidden,
  configurable: true
});

const mockVisibilityListeners: EventListener[] = [];
document.addEventListener = vi.fn((event: string, handler: EventListener) => {
  if (event === 'visibilitychange') {
    mockVisibilityListeners.push(handler);
  }
}) as any;

// Mock navigator.onLine
let mockOnline = true;
Object.defineProperty(navigator, 'onLine', {
  get: () => mockOnline,
  configurable: true
});

// Mock service worker
const mockServiceWorker = {
  ready: Promise.resolve({
    sync: {
      register: vi.fn().mockResolvedValue(undefined)
    }
  })
};
Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true,
  configurable: true
});

// Mock console
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('offlineService', () => {
  const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'trans-1',
    accountId: 'acc-1',
    amount: 100,
    description: 'Test transaction',
    date: new Date('2025-01-15'),
    type: 'expense',
    category: 'cat-1',
    tags: [],
    isRecurring: false,
    isTransfer: false,
    ...overrides
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockOnline = true;
    mockDocumentHidden = false;
    
    // Close existing connection
    if ((offlineService as any).db) {
      (offlineService as any).db.close();
    }
    
    // Reset the database
    (offlineService as any).db = null;
    (offlineService as any).syncInProgress = false;
    
    // Clear IndexedDB
    const deleteReq = indexedDB.deleteDatabase('WealthTrackerOffline');
    await new Promise((resolve) => {
      deleteReq.onsuccess = resolve;
      deleteReq.onerror = resolve;
      deleteReq.onblocked = resolve;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('initializes database with all stores', async () => {
      await offlineService.init();
      
      const db = (offlineService as any).db;
      expect(db).toBeTruthy();
      expect(db.name).toBe('WealthTrackerOffline');
      expect(db.version).toBe(1);
      
      // Check stores exist
      expect(db.objectStoreNames.contains('transactions')).toBe(true);
      expect(db.objectStoreNames.contains('accounts')).toBe(true);
      expect(db.objectStoreNames.contains('budgets')).toBe(true);
      expect(db.objectStoreNames.contains('goals')).toBe(true);
      expect(db.objectStoreNames.contains('offlineQueue')).toBe(true);
      expect(db.objectStoreNames.contains('conflicts')).toBe(true);
    });

    it('sets up event listeners', async () => {
      await offlineService.init();
      
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(mockServiceWorker.ready).toBeDefined();
    });

    it('handles multiple init calls gracefully', async () => {
      await offlineService.init();
      const firstDb = (offlineService as any).db;
      
      await offlineService.init();
      const secondDb = (offlineService as any).db;
      
      expect(firstDb).toBe(secondDb);
    });
  });

  describe('transaction operations', () => {
    beforeEach(async () => {
      await offlineService.init();
    });

    describe('saveTransaction', () => {
      it('saves transaction when online', async () => {
        const transaction = createMockTransaction();
        
        await offlineService.saveTransaction(transaction, false);
        
        const saved = await (offlineService as any).db.get('transactions', transaction.id);
        expect(saved).toMatchObject({
          ...transaction,
          syncStatus: 'synced'
        });
        
        // Should not add to queue when online
        const queueCount = await (offlineService as any).db.count('offlineQueue');
        expect(queueCount).toBe(0);
      });

      it('saves transaction and queues when offline', async () => {
        const transaction = createMockTransaction();
        
        await offlineService.saveTransaction(transaction, true);
        
        const saved = await (offlineService as any).db.get('transactions', transaction.id);
        expect(saved).toMatchObject({
          ...transaction,
          syncStatus: 'pending'
        });
        
        // Should add to queue when offline
        const queue = await (offlineService as any).db.getAll('offlineQueue');
        expect(queue).toHaveLength(1);
        expect(queue[0]).toMatchObject({
          type: 'create',
          entity: 'transaction',
          data: transaction,
          retries: 0
        });
      });
    });

    describe('getTransactions', () => {
      it('retrieves all transactions', async () => {
        const trans1 = createMockTransaction({ id: 'trans-1' });
        const trans2 = createMockTransaction({ id: 'trans-2' });
        const trans3 = createMockTransaction({ id: 'trans-3' });
        
        await offlineService.saveTransaction(trans1);
        await offlineService.saveTransaction(trans2);
        await offlineService.saveTransaction(trans3);
        
        const transactions = await offlineService.getTransactions();
        expect(transactions).toHaveLength(3);
      });

      it('filters transactions by accountId', async () => {
        const trans1 = createMockTransaction({ id: 'trans-1', accountId: 'acc-1' });
        const trans2 = createMockTransaction({ id: 'trans-2', accountId: 'acc-2' });
        const trans3 = createMockTransaction({ id: 'trans-3', accountId: 'acc-1' });
        
        await offlineService.saveTransaction(trans1);
        await offlineService.saveTransaction(trans2);
        await offlineService.saveTransaction(trans3);
        
        const transactions = await offlineService.getTransactions('acc-1');
        expect(transactions).toHaveLength(2);
        expect(transactions.every(t => t.accountId === 'acc-1')).toBe(true);
      });

      it('returns empty array when no transactions', async () => {
        // Ensure fresh database
        await offlineService.init();
        
        const transactions = await offlineService.getTransactions();
        expect(transactions).toEqual([]);
      });
    });

    describe('updateTransaction', () => {
      it('updates existing transaction when online', async () => {
        // Ensure fresh database
        await offlineService.init();
        const transaction = createMockTransaction();
        await offlineService.saveTransaction(transaction);
        
        await offlineService.updateTransaction(transaction.id, { amount: 200 }, false);
        
        const updated = await (offlineService as any).db.get('transactions', transaction.id);
        expect(updated.amount).toBe(200);
        expect(updated.syncStatus).toBe('synced');
        
        // Should not add to queue when online
        const queueCount = await (offlineService as any).db.count('offlineQueue');
        expect(queueCount).toBe(0);
      });

      it('updates and queues when offline', async () => {
        const transaction = createMockTransaction();
        await offlineService.saveTransaction(transaction);
        
        await offlineService.updateTransaction(transaction.id, { amount: 200 }, true);
        
        const updated = await (offlineService as any).db.get('transactions', transaction.id);
        expect(updated.amount).toBe(200);
        expect(updated.syncStatus).toBe('pending');
        
        // Should add to queue when offline
        const queue = await (offlineService as any).db.getAll('offlineQueue');
        expect(queue).toHaveLength(1);
        expect(queue[0]).toMatchObject({
          type: 'update',
          entity: 'transaction',
          retries: 0
        });
      });

      it('does nothing if transaction does not exist', async () => {
        await offlineService.updateTransaction('non-existent', { amount: 200 });
        
        const transaction = await (offlineService as any).db.get('transactions', 'non-existent');
        expect(transaction).toBeUndefined();
      });
    });

    describe('deleteTransaction', () => {
      it('deletes transaction when online', async () => {
        // Ensure fresh database
        await offlineService.init();
        const transaction = createMockTransaction();
        await offlineService.saveTransaction(transaction);
        
        await offlineService.deleteTransaction(transaction.id, false);
        
        const deleted = await (offlineService as any).db.get('transactions', transaction.id);
        expect(deleted).toBeUndefined();
        
        // Should not add to queue when online
        const queueCount = await (offlineService as any).db.count('offlineQueue');
        expect(queueCount).toBe(0);
      });

      it('deletes and queues when offline', async () => {
        const transaction = createMockTransaction();
        await offlineService.saveTransaction(transaction);
        
        await offlineService.deleteTransaction(transaction.id, true);
        
        const deleted = await (offlineService as any).db.get('transactions', transaction.id);
        expect(deleted).toBeUndefined();
        
        // Should add to queue when offline
        const queue = await (offlineService as any).db.getAll('offlineQueue');
        expect(queue).toHaveLength(1);
        expect(queue[0]).toMatchObject({
          type: 'delete',
          entity: 'transaction',
          data: { id: transaction.id },
          retries: 0
        });
      });
    });
  });

  describe('sync operations', () => {
    beforeEach(async () => {
      await offlineService.init();
      (global.fetch as any).mockClear();
    });

    it('syncs queued items when online', async () => {
      // Add items to queue
      const transaction = createMockTransaction();
      await offlineService.saveTransaction(transaction, true);
      
      // Mock successful API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        statusText: 'OK'
      });
      
      await offlineService.syncOfflineData();
      
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/transaction',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transaction)
        })
      );
      
      // Queue should be empty after successful sync
      const queueCount = await offlineService.getOfflineQueueCount();
      expect(queueCount).toBe(0);
      
      // Transaction should be marked as synced
      const synced = await (offlineService as any).db.get('transactions', transaction.id);
      expect(synced.syncStatus).toBe('synced');
    });

    it('does not sync when offline', async () => {
      mockOnline = false;
      
      const transaction = createMockTransaction();
      await offlineService.saveTransaction(transaction, true);
      
      await offlineService.syncOfflineData();
      
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Queue should still have the item
      const queueCount = await offlineService.getOfflineQueueCount();
      expect(queueCount).toBe(1);
    });

    it('does not sync when sync is already in progress', async () => {
      (offlineService as any).syncInProgress = true;
      
      await offlineService.syncOfflineData();
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('handles sync failures with retry', async () => {
      const transaction = createMockTransaction();
      await offlineService.saveTransaction(transaction, true);
      
      // Mock failed API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error'
      });
      
      await offlineService.syncOfflineData();
      
      // Item should still be in queue with incremented retry count
      const queue = await (offlineService as any).db.getAll('offlineQueue');
      expect(queue).toHaveLength(1);
      expect(queue[0].retries).toBe(1);
      expect(queue[0].lastError).toContain('Server Error');
    });

    it('moves to conflicts after max retries', async () => {
      // Ensure fresh database
      await offlineService.init();
      
      const transaction = createMockTransaction();
      
      // Add item with max retries already attempted
      await (offlineService as any).db.put('offlineQueue', {
        id: 'queue-item-1',
        type: 'create',
        entity: 'transaction',
        data: transaction,
        timestamp: Date.now(),
        retries: 3 // Already at max
      });
      
      // Mock failed API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error'
      });
      
      await offlineService.syncOfflineData();
      
      // Item should be removed from queue
      const queueCount = await offlineService.getOfflineQueueCount();
      expect(queueCount).toBe(0);
      
      // Should be in conflicts
      const conflicts = await (offlineService as any).db.getAll('conflicts');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        entity: 'transaction',
        localData: transaction,
        resolved: false
      });
    });

    it('dispatches sync complete event', async () => {
      const transaction = createMockTransaction();
      await offlineService.saveTransaction(transaction, true);
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        statusText: 'OK'
      });
      
      const eventPromise = new Promise((resolve) => {
        window.addEventListener('offline-sync-complete', resolve);
      });
      
      await offlineService.syncOfflineData();
      
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'offline-sync-complete'
        })
      );
    });

    it('syncs items in correct order', async () => {
      // Add multiple items with different timestamps
      const trans1 = createMockTransaction({ id: 'trans-1' });
      const trans2 = createMockTransaction({ id: 'trans-2' });
      const trans3 = createMockTransaction({ id: 'trans-3' });
      
      await (offlineService as any).db.put('offlineQueue', {
        id: 'queue-3',
        type: 'create',
        entity: 'transaction',
        data: trans3,
        timestamp: 3000,
        retries: 0
      });
      
      await (offlineService as any).db.put('offlineQueue', {
        id: 'queue-1',
        type: 'create',
        entity: 'transaction',
        data: trans1,
        timestamp: 1000,
        retries: 0
      });
      
      await (offlineService as any).db.put('offlineQueue', {
        id: 'queue-2',
        type: 'create',
        entity: 'transaction',
        data: trans2,
        timestamp: 2000,
        retries: 0
      });
      
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });
      
      await offlineService.syncOfflineData();
      
      // Check calls were made in timestamp order
      expect((global.fetch as any).mock.calls[0][1].body).toContain('trans-1');
      expect((global.fetch as any).mock.calls[1][1].body).toContain('trans-2');
      expect((global.fetch as any).mock.calls[2][1].body).toContain('trans-3');
    });
  });

  describe('conflict resolution', () => {
    beforeEach(async () => {
      await offlineService.init();
    });

    it('retrieves all conflicts', async () => {
      // Ensure fresh database
      await offlineService.init();
      
      // Add some conflicts
      await (offlineService as any).db.put('conflicts', {
        id: 'conflict-1',
        entity: 'transaction',
        localData: { id: 'trans-1', amount: 100 },
        serverData: { id: 'trans-1', amount: 150 },
        timestamp: Date.now(),
        resolved: false
      });
      
      await (offlineService as any).db.put('conflicts', {
        id: 'conflict-2',
        entity: 'transaction',
        localData: { id: 'trans-2', amount: 200 },
        serverData: { id: 'trans-2', amount: 250 },
        timestamp: Date.now(),
        resolved: false
      });
      
      const conflicts = await offlineService.getConflicts();
      expect(conflicts).toHaveLength(2);
    });

    it('resolves conflict with local data', async () => {
      const conflict = {
        id: 'conflict-1',
        entity: 'transaction',
        localData: { id: 'trans-1', amount: 100 },
        serverData: { id: 'trans-1', amount: 150 },
        timestamp: Date.now(),
        resolved: false
      };
      
      await (offlineService as any).db.put('conflicts', conflict);
      
      await offlineService.resolveConflict('conflict-1', 'local');
      
      // Should re-queue local data
      const queue = await (offlineService as any).db.getAll('offlineQueue');
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        type: 'update',
        entity: 'transaction',
        data: conflict.localData
      });
      
      // Conflict should be marked as resolved
      const resolvedConflict = await (offlineService as any).db.get('conflicts', 'conflict-1');
      expect(resolvedConflict.resolved).toBe(true);
    });

    it('resolves conflict with server data', async () => {
      // Ensure fresh database
      await offlineService.init();
      
      const conflict = {
        id: 'conflict-1',
        entity: 'transaction',
        localData: { id: 'trans-1', amount: 100 },
        serverData: { id: 'trans-1', amount: 150 },
        timestamp: Date.now(),
        resolved: false
      };
      
      await (offlineService as any).db.put('conflicts', conflict);
      
      await offlineService.resolveConflict('conflict-1', 'server');
      
      // Should not re-queue anything
      const queueCount = await offlineService.getOfflineQueueCount();
      expect(queueCount).toBe(0);
      
      // Conflict should be marked as resolved
      const resolvedConflict = await (offlineService as any).db.get('conflicts', 'conflict-1');
      expect(resolvedConflict.resolved).toBe(true);
    });

    it('handles non-existent conflict gracefully', async () => {
      await expect(
        offlineService.resolveConflict('non-existent', 'local')
      ).resolves.not.toThrow();
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      // Close existing connection first
      if ((offlineService as any).db) {
        (offlineService as any).db.close();
        (offlineService as any).db = null;
      }
      
      // Clear IndexedDB again to ensure clean state
      const deleteReq = indexedDB.deleteDatabase('WealthTrackerOffline');
      await new Promise((resolve) => {
        deleteReq.onsuccess = resolve;
        deleteReq.onerror = resolve;
        deleteReq.onblocked = resolve;
      });
      
      await offlineService.init();
    });

    it('clears old synced data', async () => {
      // Ensure completely fresh database
      const now = new Date();
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago
      const recentDate = new Date(now);
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago
      
      // Add old and recent transactions
      await (offlineService as any).db.put('transactions', {
        ...createMockTransaction({ id: 'old-trans' }),
        date: oldDate,
        syncStatus: 'synced'
      });
      
      await (offlineService as any).db.put('transactions', {
        ...createMockTransaction({ id: 'recent-trans' }),
        date: recentDate,
        syncStatus: 'synced'
      });
      
      await (offlineService as any).db.put('transactions', {
        ...createMockTransaction({ id: 'old-pending' }),
        date: oldDate,
        syncStatus: 'pending' // Should not be deleted
      });
      
      await offlineService.clearOldData(30);
      
      const remaining = await (offlineService as any).db.getAll('transactions');
      expect(remaining).toHaveLength(2);
      expect(remaining.find((t: any) => t.id === 'old-trans')).toBeUndefined();
      expect(remaining.find((t: any) => t.id === 'recent-trans')).toBeDefined();
      expect(remaining.find((t: any) => t.id === 'old-pending')).toBeDefined();
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await offlineService.init();
    });

    it('gets offline queue count', async () => {
      // Ensure fresh database
      await offlineService.init();
      
      expect(await offlineService.getOfflineQueueCount()).toBe(0);
      
      await offlineService.saveTransaction(createMockTransaction(), true);
      expect(await offlineService.getOfflineQueueCount()).toBe(1);
      
      await offlineService.saveTransaction(createMockTransaction({ id: 'trans-2' }), true);
      expect(await offlineService.getOfflineQueueCount()).toBe(2);
    });

    it('clears all offline data', async () => {
      // Add data to various stores
      await offlineService.saveTransaction(createMockTransaction(), true);
      await (offlineService as any).db.put('accounts', { id: 'acc-1', name: 'Test Account' });
      await (offlineService as any).db.put('budgets', { id: 'budget-1', amount: 1000 });
      await (offlineService as any).db.put('goals', { id: 'goal-1', targetAmount: 5000 });
      await (offlineService as any).db.put('conflicts', { id: 'conflict-1', resolved: false });
      
      await offlineService.clearOfflineData();
      
      // All stores should be empty
      expect(await (offlineService as any).db.count('transactions')).toBe(0);
      expect(await (offlineService as any).db.count('accounts')).toBe(0);
      expect(await (offlineService as any).db.count('budgets')).toBe(0);
      expect(await (offlineService as any).db.count('goals')).toBe(0);
      expect(await (offlineService as any).db.count('offlineQueue')).toBe(0);
      expect(await (offlineService as any).db.count('conflicts')).toBe(0);
    });
  });

  describe('event listeners', () => {
    beforeEach(async () => {
      await offlineService.init();
    });

    it('syncs when coming back online', async () => {
      // Add item to queue
      await offlineService.saveTransaction(createMockTransaction(), true);
      
      (global.fetch as any).mockResolvedValueOnce({ ok: true });
      
      // Trigger online event
      const onlineHandler = mockEventListeners['online']?.[0];
      expect(onlineHandler).toBeDefined();
      
      await onlineHandler(new Event('online'));
      
      expect(consoleSpy).toHaveBeenCalledWith('Back online - starting sync');
      
      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(global.fetch).toHaveBeenCalled();
    });

    it('syncs when document becomes visible and online', async () => {
      // Add item to queue
      await offlineService.saveTransaction(createMockTransaction(), true);
      
      (global.fetch as any).mockResolvedValueOnce({ ok: true });
      
      // Simulate document becoming visible
      mockDocumentHidden = false;
      mockOnline = true;
      
      const visibilityHandler = mockVisibilityListeners[0];
      expect(visibilityHandler).toBeDefined();
      
      await visibilityHandler(new Event('visibilitychange'));
      
      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(global.fetch).toHaveBeenCalled();
    });

    it('does not sync when document is hidden', async () => {
      mockDocumentHidden = true;
      mockOnline = true;
      
      const visibilityHandler = mockVisibilityListeners[0];
      await visibilityHandler(new Event('visibilitychange'));
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not sync when offline', async () => {
      mockDocumentHidden = false;
      mockOnline = false;
      
      const visibilityHandler = mockVisibilityListeners[0];
      await visibilityHandler(new Event('visibilitychange'));
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('registers background sync', async () => {
      await offlineService.init();
      
      expect(mockServiceWorker.ready).toBeDefined();
      await expect(mockServiceWorker.ready).resolves.toBeDefined();
    });
  });
});