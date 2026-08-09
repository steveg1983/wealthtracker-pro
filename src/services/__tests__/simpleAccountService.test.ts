import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSimpleAccountService,
  configureSimpleAccountService,
  getAccounts as simpleGetAccounts,
  type SimpleAccountServiceOptions
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
    getDatabaseUserId: vi.fn(async () => null)
  };

  beforeEach(() => {
    Object.values(logger).forEach(fn => fn.mockReset());
    uuid.mockClear();
    now.mockClear();
    userId.getDatabaseUserId.mockClear();
  });

  it('throws when Supabase client is missing', async () => {
    // Asked of the update rather than the create, which has gone: the seam's
    // writer sends every column this one did, so there is no second create
    // left to keep in step. The rule being pinned is unchanged — with no
    // client there is no cloud to write to, and a write must fail rather than
    // divert itself into browser storage.
    const storage = createStorage([]);
    const service = createSimpleAccountService({
      supabaseClient: null,
      storageAdapter: storage,
      userIdService: userId,
      logger,
      uuid,
      now
    });

    await expect(service.updateAccount('acct-1', { name: 'Renamed' }))
      .rejects.toThrow('Supabase not configured');
    expect(storage.set).not.toHaveBeenCalled();
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

  describe('card numbers reaching accounts.account_number', () => {
    // Card-shaped but invented.
    const pan = '1111222233334444';

    type InjectedClient = NonNullable<SimpleAccountServiceOptions['supabaseClient']>;

    /**
     * A Supabase double for both halves of a guarded update: the `select('type')`
     * asking what kind of account this is, and the update itself.
     */
    const createAccountsClient = (storedType: unknown) => {
      const writes: Record<string, unknown>[] = [];
      const returnedRow = { id: 'acct-1', name: 'Card', type: 'credit', balance: 0, currency: 'GBP' };

      interface Chain {
        eq: (column: string, value: string) => Chain;
        select: () => { single: () => Promise<{ data: Record<string, unknown>; error: null }> };
      }
      const chain: Chain = {
        eq: () => chain,
        select: () => ({ single: async () => ({ data: returnedRow, error: null }) })
      };

      const stub = {
        from: () => ({
          select: (columns: string) => ({
            eq: () => ({
              single: async () => ({
                data: columns === 'type' ? { type: storedType } : returnedRow,
                error: null
              })
            })
          }),
          update: (payload: Record<string, unknown>) => {
            writes.push(payload);
            return chain;
          }
        })
      };

      return { client: stub as InjectedClient, writes };
    };

    const cloudService = (client: InjectedClient) => createSimpleAccountService({
      supabaseClient: client,
      storageAdapter: createStorage(),
      userIdService: userId,
      logger,
      uuid,
      now
    });

    it('stores only the last four when a CARD is updated through the service layer', async () => {
      const { client, writes } = createAccountsClient('credit');

      await cloudService(client).updateAccount('acct-1', { accountNumber: pan });

      expect(writes).toHaveLength(1);
      expect(writes[0].account_number).toBe('4444');
      expect(JSON.stringify(writes[0])).not.toContain(pan);
    });

    it('leaves a bank account number whole — 8 digits IS the number', async () => {
      const { client, writes } = createAccountsClient('checking');

      await cloudService(client).updateAccount('acct-1', { accountNumber: '12345678' });

      expect(writes[0].account_number).toBe('12345678');
    });

    it('treats a payload that switches the account to a card as a card write', async () => {
      const { client, writes } = createAccountsClient('checking');

      await cloudService(client).updateAccount('acct-1', { type: 'credit', accountNumber: pan });

      expect(writes[0].account_number).toBe('4444');
    });

    it('leaves an update that does not touch the account number alone', async () => {
      const { client, writes } = createAccountsClient('credit');

      await cloudService(client).updateAccount('acct-1', { name: 'Renamed' });

      expect(writes[0]).not.toHaveProperty('account_number');
    });

    // The create path's copy of this rule moved with the create itself: it is
    // asserted against the surviving writer in accountService.test.ts
    // ('B-7: cuts a card number to its last four on the way in'), which is the
    // insert the app actually makes now.
  });
});
