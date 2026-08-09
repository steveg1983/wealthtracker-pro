import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccountService, AccountService, type AccountServiceOptions } from '../api/accountService';
import type { Account } from '../../types';
import { STORAGE_KEYS } from '../storageAdapter';

const fixedNow = new Date('2025-07-01T10:00:00.000Z');

type InjectedClient = NonNullable<AccountServiceOptions['supabaseClient']>;

/** A stand-in for the Supabase client, narrowed to the one method used here. */
const asInjectedClient = (stub: { from: (table: string) => unknown }): InjectedClient =>
  stub as InjectedClient;

/**
 * A Supabase double covering both halves of a guarded update: the `select('type')`
 * that asks what kind of account this is, and the update itself. It records what
 * was written AND whether the type had to be read at all, so a test can prove
 * both the truncation and that it costs nothing when it is not needed.
 */
const createAccountsClient = (options: {
  storedType?: unknown;
  typeReadFails?: boolean;
} = {}) => {
  const writes: Record<string, unknown>[] = [];
  let typeReads = 0;
  const returnedRow = { id: 'acct-1', name: 'Card', type: 'credit', balance: 0, currency: 'GBP' };

  interface UpdateChain {
    eq: (column: string, value: string) => UpdateChain;
    select: () => { single: () => Promise<{ data: Record<string, unknown>; error: null }> };
  }
  const updateChain: UpdateChain = {
    eq: () => updateChain,
    select: () => ({ single: async () => ({ data: returnedRow, error: null }) })
  };

  // The type read is scoped by id and, when the caller knows it, user_id — so
  // its `eq` chains like the update's does.
  interface ReadChain {
    eq: (column: string, value: string) => ReadChain;
    single: () => Promise<{ data: { type: unknown } | null; error: null | { message: string } }>;
  }
  const readChain: ReadChain = {
    eq: () => readChain,
    single: async () => {
      typeReads += 1;
      return options.typeReadFails
        ? { data: null, error: { message: 'no such row' } }
        : { data: { type: options.storedType }, error: null };
    }
  };

  const stub = {
    from: () => ({
      select: (columns: string) => (columns === 'type'
        ? readChain
        : { eq: () => ({ single: async () => ({ data: returnedRow, error: null }) }) }),
      update: (payload: Record<string, unknown>) => {
        writes.push(payload);
        return updateChain;
      }
    })
  };

  return { client: asInjectedClient(stub), writes, typeReadCount: () => typeReads };
};

/**
 * A stand-in for `accounts` on the CREATE path, behaving the way PostgREST does
 * in the one respect these tests depend on: `.select()` after an insert returns
 * the row as it now stands, which here is the payload that was actually
 * written. That is what makes the round trip below real — the account handed
 * back to the caller is mapped from what reached the table, not from what the
 * caller asked for.
 */
const createInsertClient = () => {
  const inserts: Record<string, unknown>[] = [];

  const stub = {
    from: () => ({
      insert: (payload: Record<string, unknown>) => {
        inserts.push(payload);
        return {
          select: () => ({
            single: async () => ({
              data: { id: 'acct-created', created_at: '2025-07-01T10:00:00.000Z', ...payload },
              error: null
            })
          })
        };
      }
    })
  };

  return { client: asInjectedClient(stub), inserts };
};

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
        name: 'Everyday Account',
        type: 'checking',
        initial_balance: -125.40,
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
      openingBalance: -125.40
    });

    // Write side: camelCase → snake_case; the overdrawn balance is fine.
    expect(from).toHaveBeenCalledWith('accounts');
    expect(capturedUpdate).toMatchObject({
      low_balance_alert_enabled: true,
      low_balance_threshold: 150,
      initial_balance: -125.40
    });
    expect(capturedUpdate).not.toHaveProperty('lowBalanceAlertEnabled');

    // Read side: snake_case → camelCase, numeric threshold coerced to a number.
    expect(result.lowBalanceAlertEnabled).toBe(true);
    expect(result.lowBalanceThreshold).toBe(150);
    expect(result.openingBalance).toBe(-125.40);
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

  describe('creating an account in the cloud', () => {
    // Invented throughout: no real bank, no real sort code, no real number.
    const newAccount = (overrides: Partial<Account> = {}): Omit<Account, 'id'> => {
      const { id: _id, ...rest } = baseAccount({
        name: 'Rainy day',
        type: 'current',
        balance: 250.5,
        currency: 'GBP',
        institution: 'Invented Bank',
        isActive: true,
        openingBalance: 200,
        openingBalanceDate: new Date('2025-01-01T00:00:00.000Z'),
        sortCode: '12-34-56',
        accountNumber: '12345678',
        notes: 'Set aside for the boiler',
        ...overrides
      });
      return rest;
    };

    const cloudService = (client: InjectedClient) => createAccountService({
      isSupabaseConfigured: () => true,
      storageAdapter: createStorage(),
      logger,
      now,
      uuid,
      supabaseClient: client
    });

    it('sends the bank details, the opening balance date and the notes', async () => {
      // The regression this test exists for: the insert sent ten columns and
      // named none of these four, so an account created through this writer
      // arrived in the database with its sort code, account number, opening
      // balance date and notes missing — fields the person had just typed.
      const { client, inserts } = createInsertClient();

      await cloudService(client).createAccount(
        'db-user-1',
        newAccount()
      );

      expect(inserts).toHaveLength(1);
      expect(inserts[0]).toMatchObject({
        sort_code: '12-34-56',
        account_number: '12345678',
        opening_balance_date: '2025-01-01T00:00:00.000Z',
        notes: 'Set aside for the boiler'
      });
    });

    it('names all four columns even when the account carries none of them', async () => {
      // Sent as explicit NULLs rather than left out. None of the four columns
      // has a database default, so NULL and "not mentioned" store the same
      // thing — and naming them keeps the payload one shape whatever it holds.
      const { client, inserts } = createInsertClient();

      await cloudService(client).createAccount(
        'db-user-1',
        newAccount({
          sortCode: undefined,
          accountNumber: undefined,
          openingBalanceDate: undefined,
          notes: undefined
        })
      );

      expect(inserts[0]).toMatchObject({
        sort_code: null,
        account_number: null,
        opening_balance_date: null,
        notes: null
      });
    });

    it('B-7: hands back every field it was given', async () => {
      // The write twin of the seam's read promise: what the app supplied to a
      // create is what the create answers with, because the caller puts this
      // object straight into app state and the account settings modal seeds
      // its form from it. A field dropped on the way in is a field the user
      // finds blank when they reopen the account.
      const { client } = createInsertClient();

      const created = await cloudService(client).createAccount(
        'db-user-1',
        newAccount()
      );

      expect(created).toMatchObject({
        name: 'Rainy day',
        // Stored as 'checking' and read back as the app's word for it.
        type: 'current',
        balance: 250.5,
        openingBalance: 200,
        currency: 'GBP',
        institution: 'Invented Bank',
        isActive: true,
        sortCode: '12-34-56',
        accountNumber: '12345678',
        notes: 'Set aside for the boiler'
      });
      expect(created.openingBalanceDate?.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect(created.id).toBe('acct-created');
    });

    it('B-7: cuts a card number to its last four on the way in', async () => {
      // A create knows the account type, so nothing has to be read to decide:
      // a credit account's number is a card number, and a full one written
      // here would live on in every backup and export taken afterwards.
      const pan = '1111222233334444';
      const { client, inserts } = createInsertClient();

      const created = await cloudService(client).createAccount(
        'db-user-1',
        newAccount({
          type: 'credit',
          accountNumber: pan,
          sortCode: undefined
        })
      );

      expect(inserts[0].account_number).toBe('4444');
      // Not merely truncated in one field — the number is nowhere in the write.
      expect(JSON.stringify(inserts[0])).not.toContain(pan);
      expect(created.accountNumber).toBe('4444');
    });
  });

  describe('card numbers reaching accounts.account_number', () => {
    // Card-shaped but invented. A full one stored anywhere lives on in every
    // backup, JSON export and audit row taken afterwards.
    const pan = '1111222233334444';

    const cloudService = (client: InjectedClient) => createAccountService({
      isSupabaseConfigured: () => true,
      storageAdapter: createStorage(),
      logger,
      now,
      uuid,
      supabaseClient: client
    });

    it('stores only the last four when a CARD is updated through the service layer', async () => {
      // The path the account forms do NOT cover: no modal here, just a caller
      // handing the service a full card number, which is what an importer or a
      // script does.
      const { client, writes, typeReadCount } = createAccountsClient({ storedType: 'credit' });

      await cloudService(client).updateAccount('acct-1', { accountNumber: pan });

      expect(typeReadCount()).toBe(1);
      expect(writes).toHaveLength(1);
      expect(writes[0].account_number).toBe('4444');
      // Not merely truncated in one field — the number is nowhere in the write.
      expect(JSON.stringify(writes[0])).not.toContain(pan);
    });

    it('leaves a bank account number whole — 8 digits IS the number', async () => {
      const { client, writes } = createAccountsClient({ storedType: 'checking' });

      await cloudService(client).updateAccount('acct-1', { accountNumber: '12345678' });

      expect(writes[0].account_number).toBe('12345678');
    });

    it('treats a payload that switches the account to a card as a card write', async () => {
      const { client, writes, typeReadCount } = createAccountsClient({ storedType: 'checking' });

      await cloudService(client).updateAccount('acct-1', { type: 'credit', accountNumber: pan });

      // The payload answers the question, so the stored type is never read.
      expect(typeReadCount()).toBe(0);
      expect(writes[0].account_number).toBe('4444');
    });

    it('reads nothing extra for an update that does not touch the account number', async () => {
      const { client, writes, typeReadCount } = createAccountsClient({ storedType: 'credit' });

      await cloudService(client).updateAccount('acct-1', { name: 'Renamed' });

      expect(typeReadCount()).toBe(0);
      expect(writes[0]).not.toHaveProperty('account_number');
    });

    it('refuses the write when the stored type cannot be read', async () => {
      // Truncating on a guess would destroy a real 8-digit bank number; storing
      // on a guess is the leak this exists to stop. So neither happens.
      const { client, writes } = createAccountsClient({ typeReadFails: true });

      await expect(cloudService(client).updateAccount('acct-1', { accountNumber: pan }))
        .rejects.toThrow(/account type/i);
      expect(writes).toHaveLength(0);
    });

    it('truncates on the local path too, which is what backups are built from', async () => {
      const storage = createStorage([baseAccount({ id: 'acct-1', type: 'credit' })]);
      const service = createAccountService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const updated = await service.updateAccount('acct-1', { accountNumber: pan });

      expect(updated.accountNumber).toBe('4444');
      expect(storage.snapshot()[0].accountNumber).toBe('4444');
    });

    it('truncates a card number handed to a local create', async () => {
      const storage = createStorage([]);
      const service = createAccountService({
        isSupabaseConfigured: () => false,
        storageAdapter: storage,
        logger,
        now,
        uuid
      });

      const { id: _id, lastUpdated: _lastUpdated, ...input } = baseAccount({
        type: 'credit',
        accountNumber: pan
      });
      const created = await service.createAccount(
        'user',
        input as Omit<Account, 'id' | 'created_at' | 'updated_at'>
      );

      expect(created.accountNumber).toBe('4444');
      expect(storage.snapshot()[0].accountNumber).toBe('4444');
    });
  });
});
