import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccountService, AccountService } from '../api/accountService';
import type { Account } from '../../types';
import { STORAGE_KEYS } from '../storageAdapter';

const fixedNow = new Date('2025-07-01T10:00:00.000Z');

const createStorage = (initial: Account[] = []) => {
  const store = new Map<string, Account[]>([[STORAGE_KEYS.ACCOUNTS, initial]]);
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: Account[]) => {
      store.set(key, value);
    }),
    snapshot: () => store.get(STORAGE_KEYS.ACCOUNTS) ?? []
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
  lastUpdated: new Date('2025-06-01T00:00:00.000Z'),
  ...overrides
});

describe('AccountService (deterministic fallback)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
  const now = vi.fn(() => new Date(fixedNow));
  const uuid = vi.fn(() => 'account-id');

  beforeEach(() => {
    Object.values(logger).forEach(fn => fn.mockReset());
    now.mockClear();
    uuid.mockClear();
  });

  it('reads accounts from injected storage when Supabase is disabled', async () => {
    const storage = createStorage([baseAccount({ id: 'stored' })]);
    const service = createAccountService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const accounts = await service.getAccounts('user');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('stored');
    expect(storage.get).toHaveBeenCalledWith(STORAGE_KEYS.ACCOUNTS);
  });

  it('creates an account locally with deterministic metadata', async () => {
    const storage = createStorage([]);
    const service = createAccountService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const { id: _id, lastUpdated: _lastUpdated, ...input } = baseAccount();
    const created = await service.createAccount('user', input as Omit<Account, 'id' | 'created_at' | 'updated_at'>);

    expect(created.id).toBe('account-id');
    expect(created.lastUpdated?.toISOString()).toBe(fixedNow.toISOString());
    expect(storage.snapshot()).toHaveLength(1);
  });

  it('updates an account and persists the changes locally', async () => {
    const storage = createStorage([baseAccount()]);
    const service = createAccountService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const updated = await service.updateAccount('acct-1', { balance: 250 });
    expect(updated.balance).toBe(250);
    expect(updated.lastUpdated?.toISOString()).toBe(fixedNow.toISOString());
    expect(storage.snapshot()[0].balance).toBe(250);
  });

  it('allows static AccountService reconfiguration for tests', async () => {
    const storage = createStorage([baseAccount({ id: 'static' })]);
    AccountService.configure({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      now,
      uuid
    });

    const accounts = await AccountService.getAccounts('user');
    expect(accounts[0].id).toBe('static');
  });
});
