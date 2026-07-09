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

  it('maps low-balance-alert fields to snake_case columns on a cloud update (with an overdrawn opening balance)', async () => {
    // Regression: these camelCase fields used to be sent to PostgREST verbatim
    // (no column) which rejected the whole update — so unrelated edits like the
    // opening balance silently failed. They must now map to snake_case columns.
    let capturedUpdate: Record<string, unknown> = {};
    const single = vi.fn(async () => ({
      data: {
        id: 'acct-1',
        name: 'GREEN S A',
        type: 'checking',
        initial_balance: -18243.14,
        is_active: true,
        low_balance_alert_enabled: true,
        low_balance_threshold: '150.00'
      },
      error: null
    }));
    const select = vi.fn(() => ({ single }));
    const eqId = vi.fn(() => ({ select, eq: vi.fn(() => ({ select })) }));
    const update = vi.fn((payload: Record<string, unknown>) => {
      capturedUpdate = payload;
      return { eq: eqId };
    });
    const from = vi.fn(() => ({ update }));

    const service = createAccountService({
      isSupabaseConfigured: () => true,
      storageAdapter: createStorage(),
      logger,
      now,
      uuid,
      supabaseClient: { from } as unknown as never
    });

    const result = await service.updateAccount('acct-1', {
      lowBalanceAlertEnabled: true,
      lowBalanceThreshold: 150,
      openingBalance: -18243.14
    });

    // Write side: camelCase → snake_case; the overdrawn balance is fine.
    expect(from).toHaveBeenCalledWith('accounts');
    expect(capturedUpdate).toMatchObject({
      low_balance_alert_enabled: true,
      low_balance_threshold: 150,
      initial_balance: -18243.14
    });
    expect(capturedUpdate).not.toHaveProperty('lowBalanceAlertEnabled');

    // Read side: snake_case → camelCase, numeric threshold coerced to a number.
    expect(result.lowBalanceAlertEnabled).toBe(true);
    expect(result.lowBalanceThreshold).toBe(150);
    expect(result.openingBalance).toBe(-18243.14);
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

  describe('getClosedAccounts', () => {
    it('returns only closed (isActive false) accounts in local mode', async () => {
      const storage = createStorage([
        baseAccount({ id: 'open-1', isActive: true }),
        baseAccount({ id: 'closed-1', isActive: false }),
        baseAccount({ id: 'legacy-no-flag', isActive: undefined })
      ]);
      const service = createAccountService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const closed = await service.getClosedAccounts('user');

      // Legacy rows without the flag count as open — only explicit closes hide.
      expect(closed.map(a => a.id)).toEqual(['closed-1']);
    });

    it('queries Supabase for is_active=false rows in cloud mode', async () => {
      const order = vi.fn(async () => ({ data: [], error: null }));
      const eqActive = vi.fn(() => ({ order }));
      const eqUser = vi.fn(() => ({ eq: eqActive }));
      const select = vi.fn(() => ({ eq: eqUser }));
      const from = vi.fn(() => ({ select }));
      const service = createAccountService({
        isSupabaseConfigured: () => true,
        storageAdapter: createStorage(),
        logger,
        now,
        uuid,
        supabaseClient: { from } as unknown as never
      });

      await service.getClosedAccounts('user-1');

      expect(from).toHaveBeenCalledWith('accounts');
      expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
      expect(eqActive).toHaveBeenCalledWith('is_active', false);
    });
  });
});
