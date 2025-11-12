import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataService, DataService } from '../api/dataService';
import type { Account, Transaction } from '../../types';
import { STORAGE_KEYS } from '../storageAdapter';

const createStorage = (initial: Record<string, unknown> = {}) => {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, Array.isArray(value) ? [...value] : value);
    }),
    snapshot: (key: string) => store.get(key)
  };
};

const baseAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acct-1',
  name: 'Checking',
  type: 'checking',
  balance: 100,
  currency: 'USD',
  institution: 'Test Bank',
  isActive: true,
  lastUpdated: new Date('2025-01-01T00:00:00.000Z'),
  ...overrides
});

const baseTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1',
  accountId: 'acct-1',
  amount: 25,
  date: new Date('2025-01-10T00:00:00.000Z'),
  description: 'Coffee',
  category: 'food',
  type: 'expense',
  ...overrides
});

describe('DataService (deterministic fallback)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
  const uuid = vi.fn(() => 'generated-id');
  const now = vi.fn(() => new Date('2025-09-01T00:00:00.000Z'));
  const userId = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
  };

  beforeEach(() => {
    Object.values(logger).forEach(fn => fn.mockReset());
    uuid.mockClear();
    now.mockClear();
    userId.ensureUserExists.mockReset();
    userId.getCurrentDatabaseUserId.mockImplementation(() => null);
  });

  it('creates accounts locally when Supabase is disabled', async () => {
    const storage = createStorage({ [STORAGE_KEYS.ACCOUNTS]: [] });
    const service = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId
    });

    const account = await service.createAccount(baseAccount({ id: undefined as never }));
    expect(account.id).toBe('generated-id');
    expect(storage.set).toHaveBeenCalledWith(
      STORAGE_KEYS.ACCOUNTS,
      expect.arrayContaining([expect.objectContaining({ id: 'generated-id' })])
    );
  });

  it('creates transactions locally and updates account balances', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount()],
      [STORAGE_KEYS.TRANSACTIONS]: []
    });
    const service = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      uuid: () => 'txn-generated',
      now,
      userIdService: userId
    });

    const transaction = await service.createTransaction(
      baseTransaction({ id: undefined as never })
    );

    expect(transaction.id).toBe('txn-generated');
    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts?.[0].balance).toBe(125);
  });

  it('loads app data from storage fallback', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount()],
      [STORAGE_KEYS.TRANSACTIONS]: [baseTransaction()],
      [STORAGE_KEYS.BUDGETS]: [{ id: 'budget-1' }],
      [STORAGE_KEYS.GOALS]: [{ id: 'goal-1' }],
      [STORAGE_KEYS.CATEGORIES]: [{ id: 'cat-1' }]
    });
    const service = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId
    });

    const data = await service.loadAppData();
    expect(data.accounts).toHaveLength(1);
    expect(data.transactions).toHaveLength(1);
    expect(data.budgets).toHaveLength(1);
    expect(data.goals).toHaveLength(1);
    expect(data.categories).toHaveLength(1);
  });

  it('allows static DataService reconfiguration for tests', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'static-account' })]
    });
    DataService.configure({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId
    });

    const accounts = await DataService.getAccounts();
    expect(accounts[0].id).toBe('static-account');
  });
});
