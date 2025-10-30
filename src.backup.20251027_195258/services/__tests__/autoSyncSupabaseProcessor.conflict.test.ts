import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { SupabaseDatabase } from '@wealthtracker/core';
import type { OfflineQueueItem } from '@wealthtracker/types/sync';
import { createWebSupabaseProcessor, __autoSyncTestUtils } from '../autoSyncSupabaseProcessor';
import type { EntityDataMap, ConflictAnalysis } from '../../types/sync-types';
import type { Account, Transaction } from '../../types';
import { analyticsEngine } from '../analyticsEngine';

vi.mock('../storageAdapter', () => {
  const store = new Map<string, unknown>();
  const get = vi.fn(async (key: string) => store.get(key) ?? null);
  const set = vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  });
  const remove = vi.fn(async (key: string) => {
    store.delete(key);
  });
  const clear = vi.fn(async () => {
    store.clear();
  });

  return {
    storageAdapter: {
      isReady: true,
      init: vi.fn(),
      get,
      set,
      remove,
      clear,
    },
    STORAGE_KEYS: {
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
    },
    __testing: {
      store,
      reset: () => store.clear(),
    },
  };
});

import { STORAGE_KEYS } from '../storageAdapter';
// @ts-expect-error Vitest mock exposes __testing for specs
import { __testing } from '../storageAdapter';

const testingHarness = __testing as { store: Map<string, unknown>; reset: () => void };

type ProcessContext = Parameters<ReturnType<typeof createWebSupabaseProcessor>>[1];

const createContext = (): ProcessContext => ({
  userId: 'user-id',
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  enqueueImmediateSync: vi.fn(),
});

describe('createWebSupabaseProcessor – ID reconciliation', () => {
  let trackSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    testingHarness.reset();
    __autoSyncTestUtils.resetAccountIdCache();
    vi.restoreAllMocks();
    trackSpy = vi.spyOn(analyticsEngine, 'track').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reconciles temporary account IDs and updates dependent storage', async () => {
    const tempAccount: Account = {
      id: 'temp-account',
      name: 'Offline account',
      type: 'current',
      balance: 0,
      openingBalance: 0,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
      currency: 'GBP',
      isActive: true,
    };

    const tx: Transaction = {
      id: 'txn-1',
      accountId: 'temp-account',
      amount: 10,
      type: 'expense',
      category: 'food',
      description: 'Test',
      date: new Date('2024-01-02T00:00:00.000Z'),
      pending: false,
      isReconciled: false,
    };

    testingHarness.store.set(STORAGE_KEYS.ACCOUNTS, [tempAccount]);
    testingHarness.store.set('offline_accounts', [tempAccount]);
    testingHarness.store.set(STORAGE_KEYS.TRANSACTIONS, [tx]);
    testingHarness.store.set('offline_transactions', [{ ...tx, id: 'temp-tx' }]);
    testingHarness.store.set('offline_transaction_updates', [{ id: 'temp-tx', updates: { accountId: 'temp-account' } }]);
    testingHarness.store.set('offline_transaction_deletes', ['temp-tx']);
    testingHarness.store.set('offline_account_updates', [{ id: 'temp-account', updates: { name: 'Offline account' } }]);
    testingHarness.store.set('offline_account_deletes', ['temp-account']);

    const insertSpy = vi.fn(() =>
      ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 'uuid-account-1234-5678-90ab-cdef12345678' },
              error: null,
            }),
        }),
      }) as unknown,
    );

    const client: SupabaseDatabase = {
      from: vi.fn((table: string) => {
        if (table !== 'accounts') {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          insert: insertSpy,
          upsert: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        } as unknown;
      }),
    } as SupabaseDatabase;

    const processor = createWebSupabaseProcessor({
      resolveClient: async () => client,
      resolveDatabaseUserId: async () => 'db-user',
    });

    const context = createContext();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const item: OfflineQueueItem<EntityDataMap, 'account'> = {
      id: 'queue-1',
      status: 'pending',
      retries: 0,
      timestamp: Date.now(),
      operation: {
        id: 'op-1',
        type: 'CREATE',
        entity: 'account',
        entityId: tempAccount.id,
        data: { ...tempAccount },
        timestamp: Date.now(),
        clientId: 'client-1',
        version: 1,
      },
    };

    await processor(item, context);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(context.enqueueImmediateSync).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'auto-sync-id-reconciled',
      }),
    );

    const idMap = testingHarness.store.get('auto_sync_account_id_map') as Record<string, string>;
    expect(idMap).toEqual({
      'temp-account': 'uuid-account-1234-5678-90ab-cdef12345678',
    });

    const cachedAccounts = testingHarness.store.get(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(cachedAccounts[0]?.id).toBe('uuid-account-1234-5678-90ab-cdef12345678');

    expect(testingHarness.store.get('offline_accounts')).toEqual([]);

    const cachedTransactions = testingHarness.store.get(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(cachedTransactions[0]?.accountId).toBe('uuid-account-1234-5678-90ab-cdef12345678');

    const offlineTransactions = testingHarness.store.get('offline_transactions') as Transaction[];
    expect(offlineTransactions[0]?.accountId).toBe('uuid-account-1234-5678-90ab-cdef12345678');

    const offlineTxUpdates = testingHarness.store.get('offline_transaction_updates') as Array<{ id: string; updates: Partial<Transaction> }>;
    expect(offlineTxUpdates[0]?.updates.accountId).toBe('uuid-account-1234-5678-90ab-cdef12345678');

    const offlineTxDeletes = testingHarness.store.get('offline_transaction_deletes') as string[];
    expect(offlineTxDeletes[0]).toBe('temp-tx');

    const offlineAccountUpdates = testingHarness.store.get('offline_account_updates') as Array<{ id: string }>;
    expect(offlineAccountUpdates[0]?.id).toBe('uuid-account-1234-5678-90ab-cdef12345678');

    const offlineAccountDeletes = testingHarness.store.get('offline_account_deletes') as string[];
    expect(offlineAccountDeletes[0]).toBe('uuid-account-1234-5678-90ab-cdef12345678');
  });

  it('defers transaction sync until account IDs are reconciled', async () => {
    const client: SupabaseDatabase = {
      from: vi.fn(() => {
        throw new Error('Transaction sync should not reach Supabase when account ID is unresolved');
      }),
    } as SupabaseDatabase;

    const processor = createWebSupabaseProcessor({
      resolveClient: async () => client,
      resolveDatabaseUserId: async () => 'db-user',
    });

    const context = createContext();

    const item: OfflineQueueItem<EntityDataMap, 'transaction'> = {
      id: 'queue-2',
      status: 'pending',
      retries: 0,
      timestamp: Date.now(),
      operation: {
        id: 'op-2',
        type: 'CREATE',
        entity: 'transaction',
        entityId: 'txn-temp',
        data: {
          id: 'txn-temp',
          accountId: 'temp-account',
          amount: 25,
          type: 'expense',
          category: 'travel',
          description: 'Offline expense',
          date: new Date('2024-01-03T00:00:00.000Z'),
          pending: false,
          isReconciled: false,
        },
        timestamp: Date.now(),
        clientId: 'client-2',
        version: 1,
      },
    };

    await expect(processor(item, context)).rejects.toThrow('Account id pending reconciliation');
    expect(context.enqueueImmediateSync).not.toHaveBeenCalled();
  });

  it('tracks telemetry when manual conflicts are dispatched', () => {
    const analysis: ConflictAnalysis<'budget'> = {
      hasConflict: true,
      conflictingFields: ['amount'],
      nonConflictingFields: [],
      canAutoResolve: false,
      suggestedResolution: 'manual',
      mergedData: undefined,
      confidence: 40,
    };

    __autoSyncTestUtils.dispatchConflictEvent('budget', { id: 'budget-123' }, { id: 'budget-123' }, analysis);

    expect(trackSpy).toHaveBeenCalledWith(
      'conflict_detected',
      expect.objectContaining({
        entity: 'budget',
        conflictId: 'budget-123',
        fields: ['amount'],
      }),
    );
  });
});
