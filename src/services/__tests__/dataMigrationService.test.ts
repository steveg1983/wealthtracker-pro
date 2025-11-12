import { describe, it, expect, vi } from 'vitest';
import { DataMigrationService } from '../dataMigrationService';
import type { Account, Transaction } from '../../types';
import type { SerializedAccount, SerializedTransaction, SerializedBudget, SerializedGoal } from '../../types/redux-types';

const createLogger = () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

const createStorage = () => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

const fixedNow = Date.UTC(2025, 0, 1);

describe('DataMigrationService (deterministic DI)', () => {
  it('maps account IDs via injected supabase client for transactions', async () => {
    const insertedTransactions: any[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'accounts') {
          return {
            insert: vi.fn((rows: any[]) => ({
              select: vi.fn(async () => ({
                data: rows.map((row, idx) => ({ ...row, id: `remote-${idx}` })),
                error: null
              }))
            }))
          };
        }
        if (table === 'transactions') {
          return {
            insert: vi.fn((rows: any[]) => {
              insertedTransactions.push(...rows);
              return {
                select: vi.fn(async () => ({ data: rows, error: null }))
              };
            })
          };
        }
        throw new Error(`Unhandled table ${table}`);
      })
    };

    const service = new DataMigrationService({
      supabaseClient: supabase,
      logger: createLogger(),
      storage: createStorage(),
      now: () => fixedNow
    });

    const accounts: Account[] = [
      {
        id: 'acc-local',
        name: 'Checking',
        type: 'current',
        balance: 1000,
        institution: 'Bank',
        accountNumber: '',
        currency: 'USD',
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      }
    ] as Account[];

    await service.migrateAccounts('user-1', accounts);

    const transactions: Transaction[] = [
      {
        id: 'txn-1',
        date: new Date(),
        amount: -50,
        description: 'Groceries',
        category: 'cat',
        accountId: 'acc-local',
        type: 'expense',
        accountName: 'Checking'
      }
    ];

    await service.migrateTransactions('user-1', transactions);

    expect(insertedTransactions[0].account_id).toBe('remote-0');
  });

  it('logs errors when account migration fails', async () => {
    const logger = createLogger();
    const supabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(async () => ({ data: null, error: { message: 'failed' } }))
        }))
      }))
    };

    const service = new DataMigrationService({
      supabaseClient: supabase,
      logger,
      storage: createStorage(),
      now: () => fixedNow
    });

    const result = await service.migrateAccounts('user-1', [] as unknown as Account[]);
    expect(result).toBe(true); // empty payload short-circuits

    const resultWithData = await service.migrateAccounts('user-1', [
      {
        id: 'acc',
        name: 'Acc',
        type: 'current',
        balance: 0,
        institution: '',
        accountNumber: '',
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      } as Account
    ]);

    expect(logger.error).toHaveBeenCalled();
    expect(resultWithData).toBe(false);
  });

  it('runs full migrateToSupabase flow using injected store, supabase, and storage', async () => {
    const insertRecords: Record<string, any[]> = {};
    const builders: Record<string, any> = {};
    const supabase = {
      from: vi.fn((table: string) => {
        if (!builders[table]) {
          if (table === 'user_profiles') {
            builders[table] = {
              select: vi.fn(() => builders[table]),
              eq: vi.fn(() => builders[table]),
              single: vi.fn(async () => ({ data: { id: 'db-user-1' }, error: null }))
            };
          } else if (table === 'accounts') {
            builders[table] = {
              select: vi.fn(() => builders[table]),
              eq: vi.fn(() => builders[table]),
              limit: vi.fn(async () => ({ data: [], error: null })),
              insert: vi.fn((rows: any[]) => ({
                select: vi.fn(async () => {
                  insertRecords[table] = rows;
                  return {
                    data: rows.map((row, idx) => ({ ...row, id: `remote-${idx}` })),
                    error: null
                  };
                })
              }))
            };
          } else {
            builders[table] = {
              insert: vi.fn((rows: any[]) => {
                insertRecords[table] = rows;
                return {
                  select: vi.fn(async () => ({ data: rows, error: null }))
                };
              })
            };
          }
        }
        return builders[table];
      })
    };

    const serializedAccount: SerializedAccount = {
      id: 'acc-1',
      name: 'Checking',
      type: 'current',
      balance: 100,
      currency: 'USD',
      institution: 'Bank',
      isActive: true,
      accountNumber: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      openingBalanceDate: new Date().toISOString()
    };

    const serializedTransaction: SerializedTransaction = {
      id: 'txn-1',
      accountId: 'acc-1',
      date: new Date().toISOString(),
      amount: -50,
      description: 'Test',
      category: 'cat',
      type: 'expense',
      accountName: 'Checking',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const serializedBudget: SerializedBudget = {
      id: 'bud-1',
      categoryId: 'cat',
      amount: 200,
      period: 'monthly',
      startDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    const serializedGoal: SerializedGoal = {
      id: 'goal-1',
      name: 'Save',
      description: '',
      targetAmount: 1000,
      currentAmount: 100,
      targetDate: new Date().toISOString(),
      category: 'general',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      achieved: false
    };

    const store = {
      getState: vi.fn(() => ({
        accounts: { accounts: [serializedAccount] },
        transactions: { transactions: [serializedTransaction] },
        budgets: { budgets: [serializedBudget] },
        goals: { goals: [serializedGoal] }
      }))
    };

    const storage = createStorage();
    const logger = createLogger();

    const service = new DataMigrationService({
      supabaseClient: supabase,
      store,
      storage,
      logger,
      userIdService: { ensureUserExists: vi.fn(async () => 'db-user-1') },
      now: () => fixedNow
    });

    const status = await service.migrateToSupabase('clerk-user');

    expect(status.completed).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith('supabaseMigrationCompleted', 'true');
    expect(insertRecords.accounts?.length).toBe(1);
    expect(insertRecords.transactions?.length).toBe(1);
    expect(store.getState).toHaveBeenCalled();
  });
});
