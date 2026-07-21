import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTransactionService, TransactionService } from '../api/transactionService';
import type { Transaction } from '../../types';
import { STORAGE_KEYS } from '../storageAdapter';

const fixedNow = new Date('2025-05-01T12:00:00.000Z');

const createStorage = (initial: Transaction[] = []) => {
  const data = new Map<string, Transaction[]>([[STORAGE_KEYS.TRANSACTIONS, initial]]);

  return {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: Transaction[]) => {
      data.set(key, value);
    }),
    snapshot: () => data.get(STORAGE_KEYS.TRANSACTIONS) ?? []
  };
};

const baseTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1',
  date: new Date('2025-04-15T00:00:00.000Z'),
  amount: 25,
  description: 'Test purchase',
  category: 'coffee',
  accountId: 'acct-1',
  type: 'expense',
  cleared: false,
  ...overrides
});

describe('TransactionService (deterministic fallback)', () => {
  const logger = { error: vi.fn() };
  const now = vi.fn(() => new Date(fixedNow));
  const uuid = vi.fn(() => 'generated-id');

  beforeEach(() => {
    logger.error.mockReset();
    now.mockClear();
    uuid.mockClear();
  });

  it('returns stored transactions when Supabase is disabled', async () => {
    const storage = createStorage([baseTransaction({ id: 'stored-1' })]);
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const transactions = await service.getTransactions('user-1');
    expect(transactions).toHaveLength(1);
    expect(transactions[0].id).toBe('stored-1');
    expect(storage.get).toHaveBeenCalledWith(STORAGE_KEYS.TRANSACTIONS);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('creates a transaction via local storage fallback with deterministic metadata', async () => {
    const storage = createStorage([]);
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...transactionInput } = baseTransaction();
    const created = await service.createTransaction(
      'user-1',
      transactionInput as Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
    );

    expect(created.id).toBe('generated-id');
    expect(created.createdAt?.toISOString()).toBe(fixedNow.toISOString());
    expect(created.updatedAt?.toISOString()).toBe(fixedNow.toISOString());
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.TRANSACTIONS, expect.any(Array));
    expect(storage.snapshot()).toHaveLength(1);
  });

  it('bulk creates transactions locally when Supabase is unavailable', async () => {
    const storage = createStorage([]);
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid: () => 'bulk-id'
    });

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...transactionInput } = baseTransaction({
      date: new Date('2025-04-01T00:00:00.000Z')
    });

    const created = await service.bulkCreateTransactions('user-1', [
      transactionInput as Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
    ]);

    expect(created).toHaveLength(1);
    expect(created[0].id).toBe('bulk-id');
    expect(storage.snapshot()).toHaveLength(1);
    expect(storage.snapshot()[0].id).toBe('bulk-id');
  });

  it('allows the static TransactionService to be reconfigured for tests', async () => {
    const storage = createStorage([baseTransaction({ id: 'static-1' })]);
    TransactionService.configure({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const transactions = await TransactionService.getTransactions('user-1');
    expect(transactions[0].id).toBe('static-1');
  });

  it('uses the authenticated API delete path when a Clerk token is available', async () => {
    const storage = createStorage([]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200
    })) as unknown as typeof fetch;
    const authTokenProvider = vi.fn(async () => 'clerk-token');
    const service = createTransactionService({
      isSupabaseConfigured: () => true,
      storageAdapter: storage,
      logger,
      now,
      uuid,
      fetchImpl: fetchMock,
      authTokenProvider,
      supabaseClient: {
        from: vi.fn()
      } as unknown as never
    });

    await service.deleteTransaction('txn-secure');

    expect(authTokenProvider).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/data/delete-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer clerk-token'
      },
      body: JSON.stringify({ transactionId: 'txn-secure' })
    });
  });

  describe('setTransactionsCleared', () => {
    it('bulk-sets cleared on matching ids in local mode and returns the count', async () => {
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', cleared: false }),
        baseTransaction({ id: 'txn-2', cleared: false }),
        baseTransaction({ id: 'txn-3', cleared: true })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.setTransactionsCleared(['txn-1', 'txn-2'], true);

      expect(count).toBe(2);
      const stored = storage.snapshot();
      expect(stored.find(t => t.id === 'txn-1')?.cleared).toBe(true);
      expect(stored.find(t => t.id === 'txn-2')?.cleared).toBe(true);
      expect(stored.find(t => t.id === 'txn-3')?.cleared).toBe(true);
    });

    it('can mark transactions uncleared without touching others', async () => {
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', cleared: true }),
        baseTransaction({ id: 'txn-2', cleared: true })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.setTransactionsCleared(['txn-2'], false);

      expect(count).toBe(1);
      const stored = storage.snapshot();
      expect(stored.find(t => t.id === 'txn-1')?.cleared).toBe(true);
      expect(stored.find(t => t.id === 'txn-2')?.cleared).toBe(false);
    });

    it('returns 0 and performs no write for an empty id list', async () => {
      const storage = createStorage([baseTransaction({ id: 'txn-1' })]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.setTransactionsCleared([], true);

      expect(count).toBe(0);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('calls the set_transactions_cleared RPC with owner scope in Supabase mode', async () => {
      const rpc = vi.fn(async () => ({ data: 3, error: null }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      const count = await service.setTransactionsCleared(['a', 'b', 'c'], true, 'user-1');

      expect(count).toBe(3);
      expect(rpc).toHaveBeenCalledWith('set_transactions_cleared', {
        p_ids: ['a', 'b', 'c'],
        p_cleared: true,
        p_user_id: 'user-1'
      });
    });

    it('throws when the RPC reports an error', async () => {
      const rpc = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      await expect(service.setTransactionsCleared(['a'], true)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('applyCategoryToUncategorized', () => {
    it('fills blanks on matching ids in local mode and returns the count', async () => {
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', category: '' }),
        baseTransaction({ id: 'txn-2', category: '' }),
        baseTransaction({ id: 'txn-3', category: 'cat-keep' })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.applyCategoryToUncategorized(['txn-1', 'txn-2'], 'cat-mobile');

      expect(count).toBe(2);
      const stored = storage.snapshot();
      expect(stored.find(t => t.id === 'txn-1')?.category).toBe('cat-mobile');
      expect(stored.find(t => t.id === 'txn-2')?.category).toBe('cat-mobile');
      expect(stored.find(t => t.id === 'txn-3')?.category).toBe('cat-keep');
    });

    it('never overwrites an existing category even when its id is passed', async () => {
      // Fill-blanks contract: a stale caller may pass a row that was
      // categorized elsewhere in the meantime — it must be left untouched.
      const storage = createStorage([
        baseTransaction({ id: 'txn-1', category: 'cat-explicit' }),
        baseTransaction({ id: 'txn-2', category: '' })
      ]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.applyCategoryToUncategorized(['txn-1', 'txn-2'], 'cat-mobile');

      expect(count).toBe(1);
      const stored = storage.snapshot();
      expect(stored.find(t => t.id === 'txn-1')?.category).toBe('cat-explicit');
      expect(stored.find(t => t.id === 'txn-2')?.category).toBe('cat-mobile');
    });

    it('returns 0 and performs no write for an empty id list', async () => {
      const storage = createStorage([baseTransaction({ id: 'txn-1' })]);
      const service = createTransactionService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const count = await service.applyCategoryToUncategorized([], 'cat-mobile');

      expect(count).toBe(0);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('calls the apply_category_to_uncategorized RPC with owner scope in Supabase mode', async () => {
      const rpc = vi.fn(async () => ({ data: 2, error: null }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      const count = await service.applyCategoryToUncategorized(['a', 'b'], 'cat-mobile', 'user-1');

      expect(count).toBe(2);
      expect(rpc).toHaveBeenCalledWith('apply_category_to_uncategorized', {
        p_ids: ['a', 'b'],
        p_category: 'cat-mobile',
        p_user_id: 'user-1'
      });
    });

    it('throws when the RPC reports an error', async () => {
      const rpc = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
      const service = createTransactionService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { rpc } as unknown as never
      });

      await expect(service.applyCategoryToUncategorized(['a'], 'cat-x')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});


// Regression: audit 2026-07-21 — the local fallback of setTransactionSplits
// changed the transaction amount when the split total differed but never moved
// the account balance with it (unlike dataService.setTransactionSplits).
describe('TransactionService setTransactionSplits — local balance sync', () => {
  const createKeyedStorage = (initial: Record<string, unknown>) => {
    const data = new Map<string, unknown>(Object.entries(initial));
    return {
      get: vi.fn(async (key: string) => data.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => {
        data.set(key, value);
      }),
      snapshot: (key: string) => data.get(key)
    };
  };

  it('moves the account balance by an exact Decimal delta when the split total changes', async () => {
    const storage = createKeyedStorage({
      [STORAGE_KEYS.TRANSACTIONS]: [baseTransaction({ amount: -70.1 })],
      [STORAGE_KEYS.TRANSACTION_SPLITS]: [],
      [STORAGE_KEYS.ACCOUNTS]: [{ id: 'acct-1', name: 'Checking', type: 'checking', balance: -70.1, currency: 'GBP' }]
    });
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger: { error: vi.fn() },
      now: vi.fn(() => new Date('2025-05-01T12:00:00.000Z')),
      uuid: vi.fn(() => 'generated-id')
    });

    const result = await service.setTransactionSplits(
      'txn-1',
      [
        { category: 'cat-a', amount: -0.2 },
        { category: 'cat-b', amount: -70.1 }
      ],
      null
    );

    expect(result).toEqual({ isSplit: true, splitCount: 2, amount: -70.3 });
    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Array<{ balance: number }>;
    // Exact ledger movement — no IEEE-754 drift, no missing adjustment.
    expect(accounts[0].balance).toBe(-70.3);
  });

  it('leaves the balance untouched when the split total equals the transaction amount', async () => {
    const storage = createKeyedStorage({
      [STORAGE_KEYS.TRANSACTIONS]: [baseTransaction({ amount: -70.3 })],
      [STORAGE_KEYS.TRANSACTION_SPLITS]: [],
      [STORAGE_KEYS.ACCOUNTS]: [{ id: 'acct-1', name: 'Checking', type: 'checking', balance: -70.3, currency: 'GBP' }]
    });
    const service = createTransactionService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger: { error: vi.fn() },
      now: vi.fn(() => new Date('2025-05-01T12:00:00.000Z')),
      uuid: vi.fn(() => 'generated-id')
    });

    await service.setTransactionSplits(
      'txn-1',
      [
        { category: 'cat-a', amount: -0.2 },
        { category: 'cat-b', amount: -70.1 }
      ],
      -70.3
    );

    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Array<{ balance: number }>;
    expect(accounts[0].balance).toBe(-70.3);
  });
});
