import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSimpleAccountService,
  configureSimpleAccountService,
  getAccounts as simpleGetAccounts
} from '../api/simpleAccountService';
import { STORAGE_KEYS } from '../storageAdapter';
import type { Account } from '../../types';

const baseAccount = (): Omit<Account, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Checking',
  type: 'checking',
  balance: 50,
  currency: 'USD',
  institution: 'Test Bank',
  isActive: true
});

const createStorage = (accounts: Account[] = []) => {
  const data = new Map<string, Account[]>([[STORAGE_KEYS.ACCOUNTS, accounts]]);
  return {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: Account[]) => {
      data.set(key, [...value]);
    }),
    snapshot: () => data.get(STORAGE_KEYS.ACCOUNTS) ?? []
  };
};

describe('simpleAccountService (fallback)', () => {
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const uuid = vi.fn(() => 'generated-id');
  const now = vi.fn(() => new Date('2025-10-01T00:00:00.000Z'));
  const userId = {
    getDatabaseUserId: vi.fn(async () => null),
    ensureUserExists: vi.fn(async () => 'db-user')
  };

  beforeEach(() => {
    Object.values(logger).forEach(fn => fn.mockReset());
    uuid.mockClear();
    now.mockClear();
    userId.getDatabaseUserId.mockClear();
    userId.ensureUserExists.mockClear();
  });

  it('falls back to storage when Supabase client is missing', async () => {
    const storage = createStorage([]);
    const service = createSimpleAccountService({
      supabaseClient: null,
      storageAdapter: storage,
      userIdService: userId,
      logger,
      uuid,
      now
    });

    const created = await service.createAccount('user_123', baseAccount());
    expect(created.id).toBe('generated-id');
    expect(storage.set).toHaveBeenCalled();
    expect(storage.snapshot()).toHaveLength(1);
    expect(userId.ensureUserExists).not.toHaveBeenCalled();
  });

  it('returns stored accounts when falling back locally', async () => {
    const storage = createStorage([
      {
        ...baseAccount(),
        id: 'acct-1',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Account
    ]);
    const service = createSimpleAccountService({
      supabaseClient: null,
      storageAdapter: storage,
      userIdService: userId,
      logger,
      uuid,
      now
    });

    const accounts = await service.getAccounts('user_123');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('acct-1');
  });

  it('allows the module-level configure helper to swap implementations', async () => {
    const storage = createStorage([
      {
        ...baseAccount(),
        id: 'configured',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Account
    ]);
    configureSimpleAccountService({
      supabaseClient: null,
      storageAdapter: storage,
      userIdService: userId,
      logger,
      uuid,
      now
    });

    const accounts = await simpleGetAccounts('user_123');
    expect(accounts[0].id).toBe('configured');
  });
});
