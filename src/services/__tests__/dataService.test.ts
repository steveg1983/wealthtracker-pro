import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataService, DataService } from '../api/dataService';
import type { Account, Budget, Category, Transaction, TransactionSplit } from '../../types';
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

  it('refuses to edit or un-split a split containing a linked transfer line', async () => {
    // A split whose second line is one leg of a transfer (the counterpart
    // transaction points back at it). Replacing or removing the lines would
    // strand the counterpart, so both must be rejected.
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount()],
      [STORAGE_KEYS.TRANSACTIONS]: [
        baseTransaction({ id: 'split-parent', amount: -100, isSplit: true, category: '' }),
        baseTransaction({
          id: 'counterpart',
          accountId: 'acct-2',
          amount: 30,
          type: 'transfer',
          linkedTransferId: 'split-parent',
          linkedTransferSplitId: 'line-2'
        })
      ],
      [STORAGE_KEYS.TRANSACTION_SPLITS]: [
        { id: 'line-1', transactionId: 'split-parent', category: 'food', amount: -70, sortOrder: 1 },
        {
          id: 'line-2',
          transactionId: 'split-parent',
          category: 'tofrom-acct-2',
          amount: -30,
          sortOrder: 2,
          transferAccountId: 'acct-2',
          linkedTransferId: 'counterpart'
        }
      ]
    });
    const service = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId
    });

    await expect(
      service.setTransactionSplits(
        'split-parent',
        [
          { category: 'food', amount: -50 },
          { category: 'travel', amount: -50 }
        ],
        -100
      )
    ).rejects.toThrow(/linked transfer line/);
    await expect(service.setTransactionSplits('split-parent', [], null)).rejects.toThrow(
      /linked transfer line/
    );
    // nothing was persisted — the split and its leg line survive intact
    expect(storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS)).toHaveLength(2);
  });

  it('never falls back to local storage while a signed-in session is still resolving', async () => {
    // A Clerk session exists (hasCloudSession true) but the database user id
    // hasn't resolved — e.g. during init, or when resolution fails. Local
    // storage holds demo/import data that must NOT leak into the signed-in
    // view, and writes must refuse rather than divert into local storage.
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [
        baseAccount({ id: 'demo-open' }),
        baseAccount({ id: 'demo-closed', isActive: false })
      ],
      [STORAGE_KEYS.TRANSACTIONS]: [baseTransaction()],
      [STORAGE_KEYS.BUDGETS]: [{ id: 'demo-budget' }],
      [STORAGE_KEYS.CATEGORIES]: [{ id: 'demo-cat' }]
    });
    const service = createDataService({
      isSupabaseConfigured: () => true,
      hasCloudSession: () => true,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId // getCurrentDatabaseUserId → null
    });

    expect(await service.getAccounts()).toEqual([]);
    expect(await service.getClosedAccounts()).toEqual([]);
    expect(await service.getTransactions()).toEqual([]);
    expect(await service.getAllTransactionSplits()).toEqual([]);
    expect(await service.getBudgets()).toEqual([]);
    expect(await service.getCategories()).toEqual([]);
    await expect(service.createTransaction(baseTransaction({ id: undefined as never })))
      .rejects.toThrow(/Still connecting/);
    await expect(service.deleteAccount('demo-open')).rejects.toThrow(/Still connecting/);
    expect(storage.set).not.toHaveBeenCalled();

    // No session at all (demo / local-only mode): the local fallback still works.
    const localService = createDataService({
      isSupabaseConfigured: () => true,
      hasCloudSession: () => false,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId
    });
    expect(await localService.getAccounts()).toHaveLength(2);
    expect(await localService.getClosedAccounts()).toHaveLength(1);
  });

  it('archives reconciled transactions on/before the cutoff (local) and can restore them', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'acct-1' })],
      [STORAGE_KEYS.TRANSACTIONS]: [
        baseTransaction({ id: 'old-cleared', date: new Date('2023-01-01'), cleared: true }),   // archive
        baseTransaction({ id: 'old-uncleared', date: new Date('2023-01-01'), cleared: false }),// stays (unreconciled)
        baseTransaction({ id: 'recent', date: new Date('2026-01-01'), cleared: true }),         // stays (after cutoff)
      ]
    });
    const service = createDataService({
      isSupabaseConfigured: () => false, storageAdapter: storage, logger, uuid, now, userIdService: userId
    });

    const archived = await service.archiveTransactionsBefore('acct-1', new Date('2024-01-01'));
    expect(archived).toBe(1);
    let txns = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(txns.find(t => t.id === 'old-cleared')?.archived).toBe(true);
    expect(txns.find(t => t.id === 'old-uncleared')?.archived).toBeFalsy();
    expect(txns.find(t => t.id === 'recent')?.archived).toBeFalsy();
    // account records the cutoff
    const accts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accts[0].archiveThroughDate).toEqual(new Date('2024-01-01'));

    const restored = await service.unarchiveAccount('acct-1');
    expect(restored).toBe(1);
    txns = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(txns.every(t => !t.archived)).toBe(true);
    expect((storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[])[0].archiveThroughDate).toBeNull();
  });

  it('reconcile-sweep: clearing an old transaction under the cutoff archives it (local)', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'acct-1', archiveThroughDate: new Date('2024-01-01') })],
      [STORAGE_KEYS.TRANSACTIONS]: [
        baseTransaction({ id: 'old', date: new Date('2023-06-01'), cleared: false }),   // under cutoff → sweeps
        baseTransaction({ id: 'recent', date: new Date('2026-06-01'), cleared: false }), // after cutoff → stays live
      ]
    });
    const service = createDataService({
      isSupabaseConfigured: () => false, storageAdapter: storage, logger, uuid, now, userIdService: userId
    });

    await service.setTransactionsCleared(['old', 'recent'], true);
    const txns = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(txns.find(t => t.id === 'old')?.archived).toBe(true);       // dropped off the live list
    expect(txns.find(t => t.id === 'recent')?.archived).toBeFalsy();   // still visible
    // un-clearing never un-archives (unarchive is an explicit action)
    await service.setTransactionsCleared(['old'], false);
    expect((storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[]).find(t => t.id === 'old')?.archived).toBe(true);
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


// Regression: audit 2026-07-21 — local-mode balance deltas must be Decimal.
// Raw float subtraction drifted the ledger: -70.3 - (-70.1) is
// -0.19999999999999574 in IEEE-754, and toDecimal() faithfully preserved the
// drift into the stored balance.
describe('DataService Decimal balance deltas (local mode)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
  const uuid = vi.fn(() => 'generated-id');
  const now = vi.fn(() => new Date('2025-09-01T00:00:00.000Z'));
  const userId = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
  };

  const buildService = (storage: ReturnType<typeof createStorage>): DataService =>
    createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId
    });

  it('updateTransaction applies an exact Decimal delta to the balance', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ balance: -70.1 })],
      [STORAGE_KEYS.TRANSACTIONS]: [baseTransaction({ amount: -70.1 })]
    });
    const service = buildService(storage);

    await service.updateTransaction('txn-1', { amount: -70.3 });

    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    // Float delta gave -70.29999999999999; the ledger must hold exactly -70.3.
    expect(accounts[0].balance).toBe(-70.3);
  });

  it('setTransactionSplits applies an exact Decimal delta when the total changes', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ balance: -70.1 })],
      [STORAGE_KEYS.TRANSACTIONS]: [baseTransaction({ amount: -70.1 })],
      [STORAGE_KEYS.TRANSACTION_SPLITS]: []
    });
    const service = buildService(storage);

    await service.setTransactionSplits(
      'txn-1',
      [
        { category: 'cat-a', amount: -0.2 },
        { category: 'cat-b', amount: -70.1 }
      ],
      null
    );

    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts[0].balance).toBe(-70.3);
  });
});


// The demo/offline half of the stranded-transfer re-pair. Cloud mode is one
// atomic RPC (repair_claimed_transfer, migration 20260805145035); local mode
// has no server to be atomic on, so it validates EVERYTHING before its single
// persist — mirroring the RPC's invariants and its outcome, which is what
// keeps demo mode honest about what the real thing will do.
describe('DataService repairClaimedTransfer (local mode)', () => {
  const ADJUSTMENT = 'revaluation-adjustment';

  const adjustmentCategory: Category = {
    id: ADJUSTMENT,
    name: 'Account Adjustment',
    type: 'both',
    level: 'detail',
    isRevaluationCategory: true
  };

  /** A wrong pairing: the counterpart is linked to `partner`, not to the row that matches it. */
  const claimedHistory = (): Transaction[] => [
    baseTransaction({ id: 'stranded', accountId: 'acct-b', amount: 200, category: '', type: 'income' }),
    baseTransaction({
      id: 'counterpart', accountId: 'acct-a', amount: -200, type: 'transfer',
      category: 'cat-transfer', transferAccountId: 'acct-c', linkedTransferId: 'partner'
    }),
    baseTransaction({
      id: 'partner', accountId: 'acct-c', amount: 200, type: 'transfer',
      category: 'cat-transfer', transferAccountId: 'acct-a', linkedTransferId: 'counterpart'
    })
  ];

  const buildService = (storage: ReturnType<typeof createStorage>) =>
    createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
      uuid: vi.fn(() => 'generated-id'),
      now: vi.fn(() => new Date('2025-09-01T00:00:00.000Z')),
      userIdService: {
        ensureUserExists: vi.fn(),
        getCurrentDatabaseUserId: vi.fn(() => null),
        getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
      }
    });

  it('breaks the wrong pairing, files the displaced row by its sign, and links the right pair', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'acct-a' }), baseAccount({ id: 'acct-b' }), baseAccount({ id: 'acct-c' })],
      [STORAGE_KEYS.TRANSACTIONS]: claimedHistory(),
      [STORAGE_KEYS.CATEGORIES]: [adjustmentCategory]
    });
    const service = buildService(storage);

    await service.repairClaimedTransfer('stranded', 'counterpart', 'partner', ADJUSTMENT);

    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    const byId = new Map(stored.map(t => [t.id, t]));

    // The displaced row is no longer half of anything: filed as the
    // adjustment, typed by its own sign (+200 → income), scaffolding gone.
    expect(byId.get('partner')).toMatchObject({ category: ADJUSTMENT, type: 'income' });
    expect(byId.get('partner')?.linkedTransferId).toBeUndefined();
    expect(byId.get('partner')?.transferAccountId).toBeUndefined();

    // The right pair is linked, each side facing the other's account.
    expect(byId.get('counterpart')).toMatchObject({
      type: 'transfer', linkedTransferId: 'stranded', transferAccountId: 'acct-b'
    });
    expect(byId.get('stranded')).toMatchObject({
      type: 'transfer', linkedTransferId: 'counterpart', transferAccountId: 'acct-a'
    });

    // Balance-neutral: no amount moved, so no account did either.
    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts.every(a => a.balance === 100)).toBe(true);
  });

  it('files a negative displaced row as an expense', async () => {
    const history = claimedHistory();
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'acct-a' }), baseAccount({ id: 'acct-b' }), baseAccount({ id: 'acct-c' })],
      [STORAGE_KEYS.TRANSACTIONS]: [
        { ...history[0], amount: -200, type: 'expense' },
        { ...history[1], amount: 200 },
        { ...history[2], amount: -200 }
      ],
      [STORAGE_KEYS.CATEGORIES]: [adjustmentCategory]
    });
    const service = buildService(storage);

    await service.repairClaimedTransfer('stranded', 'counterpart', 'partner', ADJUSTMENT);

    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(stored.find(t => t.id === 'partner')).toMatchObject({ category: ADJUSTMENT, type: 'expense' });
  });

  it('refuses a stale list — and writes nothing at all', async () => {
    // Somebody re-arranged the pair since the finding was built: the
    // counterpart no longer points at the partner. Acting on that would
    // unlink a pairing the user never reviewed.
    const history = claimedHistory();
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'acct-a' })],
      [STORAGE_KEYS.TRANSACTIONS]: [
        history[0],
        { ...history[1], linkedTransferId: 'somebody-else' },
        history[2]
      ],
      [STORAGE_KEYS.CATEGORIES]: [adjustmentCategory]
    });
    const service = buildService(storage);

    await expect(service.repairClaimedTransfer('stranded', 'counterpart', 'partner', ADJUSTMENT))
      .rejects.toThrow(/not linked to each other any more/);

    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(stored.find(t => t.id === 'partner')?.category).toBe('cat-transfer');
    expect(stored.find(t => t.id === 'stranded')?.linkedTransferId).toBeUndefined();
  });

  it('refuses when the amounts are not exact opposites', async () => {
    const history = claimedHistory();
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'acct-a' })],
      [STORAGE_KEYS.TRANSACTIONS]: [{ ...history[0], amount: 199.99 }, history[1], history[2]],
      [STORAGE_KEYS.CATEGORIES]: [adjustmentCategory]
    });
    const service = buildService(storage);

    await expect(service.repairClaimedTransfer('stranded', 'counterpart', 'partner', ADJUSTMENT))
      .rejects.toThrow(/exactly opposite/);
  });

  it('refuses a category that is not the user’s own', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'acct-a' })],
      [STORAGE_KEYS.TRANSACTIONS]: claimedHistory(),
      [STORAGE_KEYS.CATEGORIES]: []
    });
    const service = buildService(storage);

    await expect(service.repairClaimedTransfer('stranded', 'counterpart', 'partner', ADJUSTMENT))
      .rejects.toThrow(/Unknown or transfer category/);
  });
});


// The demo/offline half of the category merge. Cloud mode is one atomic RPC
// (merge_categories, migration 20260805214322); local mode has no server to be
// atomic on, so it validates EVERYTHING before its single set of writes — which
// is what keeps demo mode honest about what the real thing will do.
//
// The point of these tests is the SURFACES: the old delete-and-reassign moved
// transactions and split lines and silently stranded budgets, which is exactly
// the class of bug that survives a "looks fine" manual check.
describe('DataService mergeCategories (local mode)', () => {
  const expenseCategory = (over: Partial<Category> & { id: string }): Category => ({
    name: over.id,
    type: 'expense',
    level: 'detail',
    parentId: 'sub-food',
    ...over
  });

  const SOURCE = expenseCategory({ id: 'cat-food-shopping', name: 'Food Shopping' });
  const TARGET = expenseCategory({ id: 'cat-groceries', name: 'Groceries' });

  const buildService = (storage: ReturnType<typeof createStorage>) =>
    createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
      uuid: vi.fn(() => 'generated-id'),
      now: vi.fn(() => new Date('2025-09-01T00:00:00.000Z')),
      userIdService: {
        ensureUserExists: vi.fn(),
        getCurrentDatabaseUserId: vi.fn(() => null),
        getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
      }
    });

  /** One of every reference surface pointing at the source. */
  const fullHistory = (extraCategories: Category[] = []) => createStorage({
    [STORAGE_KEYS.ACCOUNTS]: [baseAccount()],
    [STORAGE_KEYS.CATEGORIES]: [SOURCE, TARGET, ...extraCategories],
    [STORAGE_KEYS.TRANSACTIONS]: [
      baseTransaction({ id: 'txn-a', category: SOURCE.id }),
      baseTransaction({ id: 'txn-b', category: SOURCE.id }),
      baseTransaction({ id: 'txn-other', category: TARGET.id }),
      baseTransaction({ id: 'txn-split', category: '', isSplit: true, amount: 60 })
    ],
    [STORAGE_KEYS.TRANSACTION_SPLITS]: [
      { id: 's1', transactionId: 'txn-split', category: SOURCE.id, amount: 40, sortOrder: 1, memo: 'wine' },
      { id: 's2', transactionId: 'txn-split', category: 'cat-other', amount: 20, sortOrder: 2 }
    ],
    [STORAGE_KEYS.BUDGETS]: [
      { id: 'bud-1', categoryId: SOURCE.id, amount: 400, period: 'monthly', isActive: true, spent: 0 },
      { id: 'bud-2', categoryId: 'cat-other', amount: 50, period: 'monthly', isActive: true, spent: 0 }
    ]
  });

  it('moves every reference surface — transactions, split lines AND budgets — then removes the source', async () => {
    const storage = fullHistory();
    const service = buildService(storage);

    const result = await service.mergeCategories(SOURCE.id, TARGET.id);

    expect(result).toMatchObject({
      transactions: 2,
      splitLines: 1,
      splitTransactions: 1,
      budgets: 1
    });

    const transactions = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(transactions.filter(t => t.category === TARGET.id).map(t => t.id))
      .toEqual(['txn-a', 'txn-b', 'txn-other']);
    // The split parent's category stays blank — that blank means "split", not
    // "uncategorised", and filling it in is what the database refuses outright.
    expect(transactions.find(t => t.id === 'txn-split')?.category).toBe('');

    const splits = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
    expect(splits.find(s => s.id === 's1')).toMatchObject({
      category: TARGET.id, amount: 40, memo: 'wine'
    });
    expect(splits.find(s => s.id === 's2')?.category).toBe('cat-other');

    // The surface the old delete-and-reassign left behind.
    const budgets = storage.snapshot(STORAGE_KEYS.BUDGETS) as Budget[];
    expect(budgets.find(b => b.id === 'bud-1')?.categoryId).toBe(TARGET.id);
    expect(budgets.find(b => b.id === 'bud-2')?.categoryId).toBe('cat-other');

    const categories = storage.snapshot(STORAGE_KEYS.CATEGORIES) as Category[];
    expect(categories.map(c => c.id)).toEqual([TARGET.id]);

    // Balance-neutral: not one amount moved, so no account did either.
    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts[0].balance).toBe(100);
  });

  it('merges an empty category without touching anything else', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.CATEGORIES]: [SOURCE, TARGET],
      [STORAGE_KEYS.TRANSACTIONS]: [baseTransaction({ category: TARGET.id })],
      [STORAGE_KEYS.TRANSACTION_SPLITS]: [],
      [STORAGE_KEYS.BUDGETS]: []
    });
    const service = buildService(storage);

    const result = await service.mergeCategories(SOURCE.id, TARGET.id);

    expect(result).toMatchObject({ transactions: 0, splitLines: 0, budgets: 0 });
    expect((storage.snapshot(STORAGE_KEYS.CATEGORIES) as Category[]).map(c => c.id))
      .toEqual([TARGET.id]);
  });

  // Every refusal below must leave browser storage EXACTLY as it was: the
  // validations all run before the first write, so a rejected merge is not a
  // partial merge.
  describe('refusals write nothing at all', () => {
    const expectUntouched = (storage: ReturnType<typeof createStorage>): void => {
      const transactions = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
      expect(transactions.filter(t => t.category === SOURCE.id)).toHaveLength(2);
      const splits = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
      expect(splits.find(s => s.id === 's1')?.category).toBe(SOURCE.id);
      const budgets = storage.snapshot(STORAGE_KEYS.BUDGETS) as Budget[];
      expect(budgets.find(b => b.id === 'bud-1')?.categoryId).toBe(SOURCE.id);
      const categories = storage.snapshot(STORAGE_KEYS.CATEGORIES) as Category[];
      expect(categories.some(c => c.id === SOURCE.id)).toBe(true);
    };

    it('refuses a category that is not there', async () => {
      const storage = fullHistory();
      await expect(buildService(storage).mergeCategories(SOURCE.id, 'nope'))
        .rejects.toThrow('Category not found');
      expectUntouched(storage);
    });

    it('refuses merging a category into itself', async () => {
      const storage = fullHistory();
      await expect(buildService(storage).mergeCategories(SOURCE.id, SOURCE.id))
        .rejects.toThrow(/cannot be merged into itself/);
      expectUntouched(storage);
    });

    it('refuses a transfer category on either side', async () => {
      const transfer = expenseCategory({
        id: 'cat-transfer', name: 'To/From Joint', type: 'both', isTransferCategory: true
      });
      const storage = fullHistory([transfer]);
      await expect(buildService(storage).mergeCategories(transfer.id, TARGET.id))
        .rejects.toThrow(/managed automatically from their account/);
      await expect(buildService(storage).mergeCategories(SOURCE.id, transfer.id))
        .rejects.toThrow(/invent transfers that never happened/);
      expectUntouched(storage);
    });

    it('refuses to merge away a built-in category the app files under itself', async () => {
      const adjustment = expenseCategory({
        id: 'cat-adjustment', name: 'Account Adjustment', type: 'both',
        isSystem: true, isRevaluationCategory: true
      });
      const storage = fullHistory([adjustment]);
      await expect(buildService(storage).mergeCategories(adjustment.id, TARGET.id))
        .rejects.toThrow(/built-in category/);
      expectUntouched(storage);
    });

    it('refuses the import’s unassigned bucket on either side', async () => {
      const bucket = expenseCategory({
        id: 'cat-unassigned', name: 'Unassigned (MS Money import)', type: 'both',
        isUnassignedBucket: true
      });
      const storage = fullHistory([bucket]);
      await expect(buildService(storage).mergeCategories(bucket.id, TARGET.id))
        .rejects.toThrow(/file them from the review band/);
      await expect(buildService(storage).mergeCategories(SOURCE.id, bucket.id))
        .rejects.toThrow(/un-file transactions that are already filed/);
      expectUntouched(storage);
    });

    it('refuses a group on either side — v1 is leaf to leaf', async () => {
      const group = expenseCategory({ id: 'sub-food', name: 'Food', level: 'sub', parentId: 'type-expense' });
      const storage = fullHistory([group]);
      await expect(buildService(storage).mergeCategories(group.id, TARGET.id))
        .rejects.toThrow(/merging a whole group is not supported yet|has categories under it/i);
      await expect(buildService(storage).mergeCategories(SOURCE.id, group.id))
        .rejects.toThrow(/is a group/);
      expectUntouched(storage);
    });

    it('refuses to merge an expense category into an income one', async () => {
      const salary = expenseCategory({
        id: 'cat-salary', name: 'Salary', type: 'income', parentId: 'sub-earnings'
      });
      const storage = fullHistory([salary]);
      await expect(buildService(storage).mergeCategories(SOURCE.id, salary.id))
        .rejects.toThrow(/wrong side of every report/);
      expectUntouched(storage);
    });

    it('accepts a direction-neutral target, which carries no side of its own', async () => {
      // A revaluation leaf is 'both': "this was a balance correction, not
      // spending" is a legitimate re-filing of an expense category.
      const neutral = expenseCategory({ id: 'cat-neutral', name: 'Other', type: 'both', parentId: undefined });
      const storage = fullHistory([neutral]);

      await expect(buildService(storage).mergeCategories(SOURCE.id, neutral.id)).resolves.toMatchObject({
        transactions: 2
      });
    });

    it('refuses a hidden target', async () => {
      const closed = expenseCategory({ id: 'cat-closed', name: 'Old Shop', isActive: false });
      const storage = fullHistory([closed]);
      await expect(buildService(storage).mergeCategories(SOURCE.id, closed.id))
        .rejects.toThrow(/is hidden/);
      expectUntouched(storage);
    });
  });
});


// Audit 2026-07-21: cross-currency counterpart creation must refuse loudly —
// the counterpart is -amount with no conversion, so a USD source would move a
// GBP ledger by the raw dollar magnitude.
describe('DataService createTransferCounterpart currency guard (local mode)', () => {
  it('refuses to create the other side across currencies', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [
        baseAccount({ id: 'acct-usd', currency: 'USD' }),
        baseAccount({ id: 'acct-gbp', currency: 'GBP' })
      ],
      [STORAGE_KEYS.TRANSACTIONS]: [
        baseTransaction({ id: 'txn-x', accountId: 'acct-usd', amount: -1336.25 })
      ],
      [STORAGE_KEYS.CATEGORIES]: []
    });
    const service = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
      uuid: vi.fn(() => 'generated-id'),
      now: vi.fn(() => new Date('2025-09-01T00:00:00.000Z')),
      userIdService: {
        ensureUserExists: vi.fn(),
        getCurrentDatabaseUserId: vi.fn(() => null),
        getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
      }
    });

    await expect(
      service.createTransferCounterpart('txn-x', 'acct-gbp')
    ).rejects.toThrow(/different currencies.*USD and GBP/);

    // Nothing was written: no counterpart row, no balance movement.
    const transactions = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(transactions).toHaveLength(1);
    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts.find(a => a.id === 'acct-gbp')?.balance).toBe(100);
  });
});
