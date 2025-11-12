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
});
