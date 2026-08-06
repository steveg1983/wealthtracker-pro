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

  it('refuses an edit that would drop a linked transfer line, and refuses to un-split', async () => {
    // A split whose second line is one leg of a transfer (the counterpart
    // transaction points back at it). A line set that does not name that line
    // by id is asking for it to be deleted — which would leave the counterpart
    // pointing at nothing — and un-splitting deletes every line. Both refused.
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount(), baseAccount({ id: 'acct-2', name: 'Savings' })],
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
    ).rejects.toThrow(/transferring to "Savings" is one half of a transfer/);
    await expect(service.setTransactionSplits('split-parent', [], null)).rejects.toThrow(
      /transferring to "Savings" is one half of a transfer/
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


// The demo/offline half of the split-leg write path — the mirror of
// set_transaction_splits_with_legs (migration 20260806094058). Two jobs:
// creating a leg (Steve's case: one payment that both settles a loan and pays
// interest), and letting the REST of a split that contains a leg be edited,
// which the old replace-the-whole-set writer had to refuse wholesale.
describe('DataService split transfer legs (local mode)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
  const now = vi.fn(() => new Date('2025-09-01T00:00:00.000Z'));
  const userId = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
  };

  /** Sequential ids: a leg write mints a line AND a counterpart in one call. */
  const buildService = (storage: ReturnType<typeof createStorage>): DataService => {
    let n = 0;
    return createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      uuid: () => `new-${++n}`,
      now,
      userIdService: userId
    });
  };

  const transferCategory = (accountId: string): Category => ({
    id: `tofrom-${accountId}`,
    name: `To/From ${accountId}`,
    type: 'both',
    level: 'detail',
    isTransferCategory: true,
    accountId
  });

  // ── Creating a leg: £35,000 arrives, £30,000 of it settles a loan ─────────
  describe('creating a leg', () => {
    const lendingHistory = () => createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [
        baseAccount({ id: 'current', name: 'Current', balance: 35000, currency: 'GBP' }),
        baseAccount({ id: 'loan', name: 'Friend Loan', balance: 30000, currency: 'GBP' })
      ],
      [STORAGE_KEYS.TRANSACTIONS]: [
        baseTransaction({
          id: 'repayment', accountId: 'current', amount: 35000,
          type: 'income', category: 'interest', description: 'Repaid in full'
        })
      ],
      [STORAGE_KEYS.TRANSACTION_SPLITS]: [],
      [STORAGE_KEYS.CATEGORIES]: [
        transferCategory('loan'),
        { id: 'interest', name: 'Interest', type: 'income', level: 'detail' } as Category
      ]
    });

    const repaymentSplit = [
      { category: 'tofrom-loan', amount: 30000, transferAccountId: 'loan' },
      { category: 'interest', amount: 5000 }
    ];

    it('creates the counterpart with the opposite LINE amount and links both ways', async () => {
      const storage = lendingHistory();
      const service = buildService(storage);

      const result = await service.setTransactionSplits('repayment', repaymentSplit, 35000);

      expect(result.counterparts).toHaveLength(1);
      const [counterpart] = result.counterparts;
      // Opposite of the LINE (30,000), NOT of the parent (35,000) — the whole
      // point of a mixed split.
      expect(counterpart).toMatchObject({
        amount: -30000,
        accountId: 'loan',
        type: 'transfer',
        transferAccountId: 'current',
        linkedTransferId: 'repayment'
      });

      const lines = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
      const leg = lines.find(l => l.transferAccountId === 'loan');
      expect(leg).toMatchObject({ amount: 30000, linkedTransferId: counterpart.id });
      // The counterpart pins the exact LINE, so the pair is navigable from
      // either end.
      expect(counterpart.linkedTransferSplitId).toBe(leg?.id);
      // The other line is untouched by any of this.
      expect(lines.find(l => l.category === 'interest')).toMatchObject({ amount: 5000 });
    });

    it('leaves the parent total alone and moves only the target account', async () => {
      const storage = lendingHistory();
      const service = buildService(storage);

      await service.setTransactionSplits('repayment', repaymentSplit, 35000);

      const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
      expect(stored.find(t => t.id === 'repayment')).toMatchObject({
        isSplit: true, amount: 35000, category: ''
      });
      const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
      // The loan is settled: 30,000 owed, 30,000 repaid.
      expect(accounts.find(a => a.id === 'loan')?.balance).toBe(0);
      // The receiving account already carried the 35,000; nothing moved there.
      expect(accounts.find(a => a.id === 'current')?.balance).toBe(35000);
    });

    it('refuses a leg pointing back at the transaction\'s own account', async () => {
      const storage = lendingHistory();
      const service = buildService(storage);

      await expect(service.setTransactionSplits('repayment', [
        { category: 'tofrom-current', amount: 30000, transferAccountId: 'current' },
        { category: 'interest', amount: 5000 }
      ], 35000)).rejects.toThrow(/two different accounts/);
      expect(storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS)).toHaveLength(0);
    });

    it('refuses a leg across currencies, and writes nothing at all', async () => {
      const storage = lendingHistory();
      const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
      await storage.set(STORAGE_KEYS.ACCOUNTS, accounts.map(a =>
        a.id === 'loan' ? { ...a, currency: 'USD' } : a
      ));
      const service = buildService(storage);

      await expect(service.setTransactionSplits('repayment', repaymentSplit, 35000))
        .rejects.toThrow(/different currencies/);

      // All-or-nothing: no lines, no counterpart, no balance moved.
      expect(storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS)).toHaveLength(0);
      expect(storage.snapshot(STORAGE_KEYS.TRANSACTIONS)).toHaveLength(1);
      const after = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
      expect(after.find(a => a.id === 'loan')?.balance).toBe(30000);
    });

    it('refuses a leg whose lines do not sum to the transaction, writing nothing', async () => {
      const storage = lendingHistory();
      const service = buildService(storage);

      await expect(service.setTransactionSplits('repayment', [
        { category: 'tofrom-loan', amount: 30000, transferAccountId: 'loan' },
        { category: 'interest', amount: 4000 }
      ], 35000)).rejects.toThrow(/must sum to the transaction amount/);

      expect(storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS)).toHaveLength(0);
      expect(storage.snapshot(STORAGE_KEYS.TRANSACTIONS)).toHaveLength(1);
      const after = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
      expect(after.find(a => a.id === 'loan')?.balance).toBe(30000);
    });

    it('refuses a To/From category that names a different account from the line', async () => {
      const storage = lendingHistory();
      const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
      const categories = storage.snapshot(STORAGE_KEYS.CATEGORIES) as Category[];
      await storage.set(STORAGE_KEYS.ACCOUNTS, [...accounts, baseAccount({ id: 'isa', name: 'ISA' })]);
      await storage.set(STORAGE_KEYS.CATEGORIES, [...categories, transferCategory('isa')]);
      const service = buildService(storage);

      // Filed under the ISA's To/From category, but transferring to the loan:
      // the category names the account, so the two cannot disagree.
      await expect(service.setTransactionSplits('repayment', [
        { category: 'tofrom-isa', amount: 30000, transferAccountId: 'loan' },
        { category: 'interest', amount: 5000 }
      ], 35000)).rejects.toThrow(/transfers to a different account/);

      // And a To/From category with no target at all says "transfer" without
      // saying where to.
      await expect(service.setTransactionSplits('repayment', [
        { category: 'tofrom-loan', amount: 30000 },
        { category: 'interest', amount: 5000 }
      ], 35000)).rejects.toThrow(/which account is on the other side/);
      expect(storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS)).toHaveLength(0);
    });
  });

  // ── The owner's case: file a NEIGHBOUR of a leg ───────────────────────────
  // 78 of his split parents contain a linked leg and 33 still carry an
  // unfiled line. Categorising one of those strands nothing, and must work.
  describe('editing a split that already contains a leg', () => {
    const splitWithLeg = () => createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [
        baseAccount({ id: 'current', name: 'Current', balance: -400 }),
        baseAccount({ id: 'savings', name: 'Savings', balance: 100 })
      ],
      [STORAGE_KEYS.TRANSACTIONS]: [
        baseTransaction({
          id: 'parent', accountId: 'current', amount: -400,
          type: 'expense', category: '', isSplit: true
        }),
        baseTransaction({
          id: 'counterpart', accountId: 'savings', amount: 100, type: 'transfer',
          category: 'tofrom-current', transferAccountId: 'current',
          linkedTransferId: 'parent', linkedTransferSplitId: 'leg-line'
        })
      ],
      [STORAGE_KEYS.TRANSACTION_SPLITS]: [
        {
          id: 'leg-line', transactionId: 'parent', category: 'tofrom-savings',
          amount: -100, sortOrder: 1, transferAccountId: 'savings',
          linkedTransferId: 'counterpart'
        },
        { id: 'unfiled', transactionId: 'parent', category: 'unassigned', amount: -300, sortOrder: 2 }
      ],
      [STORAGE_KEYS.CATEGORIES]: [
        transferCategory('savings'),
        { id: 'unassigned', name: 'Unassigned', type: 'both', level: 'detail', isUnassignedBucket: true } as Category,
        { id: 'rent', name: 'Rent', type: 'expense', level: 'detail' } as Category
      ]
    });

    /** The leg exactly as stored, carried back out untouched. */
    const legAsStored = {
      id: 'leg-line', category: 'tofrom-savings', amount: -100, transferAccountId: 'savings'
    };

    it('re-files the ordinary line and leaves the leg byte-identical', async () => {
      const storage = splitWithLeg();
      const service = buildService(storage);

      const result = await service.setTransactionSplits('parent', [
        legAsStored,
        { id: 'unfiled', category: 'rent', amount: -300 }
      ], -400);

      // Nothing was created: an edit beside a leg is not a new transfer.
      expect(result.counterparts).toEqual([]);

      const lines = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
      expect(lines.find(l => l.id === 'unfiled')).toMatchObject({ category: 'rent', amount: -300 });
      // Same line, same amount, same target, same link — the counterpart on
      // the other side still points at something real.
      expect(lines.find(l => l.id === 'leg-line')).toEqual({
        id: 'leg-line',
        transactionId: 'parent',
        category: 'tofrom-savings',
        amount: -100,
        sortOrder: 1,
        transferAccountId: 'savings',
        linkedTransferId: 'counterpart'
      });
      const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
      expect(stored.find(t => t.id === 'counterpart')).toMatchObject({
        amount: 100, linkedTransferId: 'parent', linkedTransferSplitId: 'leg-line'
      });
      // Balance-neutral: the total is what it always was.
      expect(stored.find(t => t.id === 'parent')?.amount).toBe(-400);
      const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
      expect(accounts.map(a => a.balance)).toEqual([-400, 100]);
    });

    it('lets the ordinary line change amount, as long as the total still adds up', async () => {
      const storage = splitWithLeg();
      const service = buildService(storage);

      await service.setTransactionSplits('parent', [
        legAsStored,
        { id: 'unfiled', category: 'rent', amount: -250 }
      ], -350);

      const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
      expect(stored.find(t => t.id === 'parent')?.amount).toBe(-350);
      // Only the parent's own account moves; the leg (and so the other
      // account) is exactly as it was.
      const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
      expect(accounts.find(a => a.id === 'current')?.balance).toBe(-350);
      expect(accounts.find(a => a.id === 'savings')?.balance).toBe(100);
    });

    it('adds a new ordinary line beside the leg', async () => {
      const storage = splitWithLeg();
      const service = buildService(storage);

      await service.setTransactionSplits('parent', [
        legAsStored,
        { id: 'unfiled', category: 'rent', amount: -250 },
        { category: 'rent', amount: -50, memo: 'the rest' }
      ], -400);

      const lines = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
      expect(lines).toHaveLength(3);
      expect(lines.find(l => l.id === 'leg-line')?.linkedTransferId).toBe('counterpart');
    });

    it.each([
      ['its amount', { ...legAsStored, amount: -120 }, /has to stay as it is/],
      ['its target', { ...legAsStored, transferAccountId: 'current' }, /two different accounts/],
      ['its category', { ...legAsStored, category: 'rent' }, /names the account on the other side/],
    ])('refuses to change a linked leg: %s', async (_what, leg, message) => {
      const storage = splitWithLeg();
      const service = buildService(storage);

      await expect(service.setTransactionSplits('parent', [
        leg,
        { id: 'unfiled', category: 'rent', amount: -300 }
      ], -400)).rejects.toThrow(message);

      // Nothing at all was written, so the counterpart is never orphaned.
      const lines = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
      expect(lines.find(l => l.id === 'leg-line')).toMatchObject({
        amount: -100, transferAccountId: 'savings', linkedTransferId: 'counterpart'
      });
      expect(lines.find(l => l.id === 'unfiled')?.category).toBe('unassigned');
    });

    it('refuses an edit that drops the leg, naming the account it would strand', async () => {
      const storage = splitWithLeg();
      const service = buildService(storage);

      await expect(service.setTransactionSplits('parent', [
        { id: 'unfiled', category: 'rent', amount: -300 },
        { category: 'rent', amount: -100 }
      ], -400)).rejects.toThrow(/transferring to "Savings" is one half of a transfer/);

      const lines = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
      expect(lines).toHaveLength(2);
      expect(lines.find(l => l.id === 'leg-line')?.linkedTransferId).toBe('counterpart');
    });

    it('never mints a second counterpart for a leg it already has', async () => {
      const storage = splitWithLeg();
      const service = buildService(storage);

      const result = await service.setTransactionSplits('parent', [
        legAsStored,
        { id: 'unfiled', category: 'rent', amount: -300 }
      ], -400);

      expect(result.counterparts).toEqual([]);
      const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
      expect(stored.filter(t => t.type === 'transfer')).toHaveLength(1);
    });

    it('does not invent a counterpart for a leg whose other side was deleted', async () => {
      // linked_transfer_id goes (ON DELETE SET NULL), transfer_account_id
      // stays. The row that matches it may still be sitting in Savings
      // unmatched, so re-saving must leave the line alone rather than double
      // the movement.
      const storage = splitWithLeg();
      const lines = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
      await storage.set(STORAGE_KEYS.TRANSACTION_SPLITS, lines.map(l =>
        l.id === 'leg-line' ? { ...l, linkedTransferId: undefined } : l
      ));
      const service = buildService(storage);

      const result = await service.setTransactionSplits('parent', [
        legAsStored,
        { id: 'unfiled', category: 'rent', amount: -300 }
      ], -400);

      expect(result.counterparts).toEqual([]);
      const after = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
      expect(after.find(l => l.id === 'leg-line')).toMatchObject({ transferAccountId: 'savings' });
      expect(after.find(l => l.id === 'leg-line')?.linkedTransferId).toBeUndefined();
      const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
      expect(accounts.find(a => a.id === 'savings')?.balance).toBe(100);
    });

    it('refuses a line claiming to be one this split does not have', async () => {
      const storage = splitWithLeg();
      const service = buildService(storage);

      await expect(service.setTransactionSplits('parent', [
        legAsStored,
        { id: 'somebody-elses-line', category: 'rent', amount: -300 }
      ], -400)).rejects.toThrow(/not part of this split any more/);
      expect(storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS)).toHaveLength(2);
    });
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


// The demo/offline half of a LINE match. Cloud mode is one atomic RPC
// (link_split_line_transfer, migration 20260806094058); local mode has no
// server to be atomic on, so it validates EVERYTHING before its first persist
// — which is what keeps demo mode honest about what the real thing will do.
//
// The invariant these tests exist for: the amounts are compared against the
// LINE, never the split PARENT, whose total is SUPPOSED to differ.
describe('DataService linkSplitLineTransfer (local mode)', () => {
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

  /** £35,000 arrives; £30,000 of it settles the loan, £5,000 is interest. */
  const lending = (over: { row?: Partial<Transaction>; line?: Partial<TransactionSplit> } = {}) =>
    createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [
        baseAccount({ id: 'current', name: 'Current', balance: 35000 }),
        baseAccount({ id: 'loan', name: 'Friend Loan', balance: 30000 })
      ],
      [STORAGE_KEYS.TRANSACTIONS]: [
        baseTransaction({
          id: 'parent', accountId: 'current', amount: 35000, type: 'income',
          category: '', isSplit: true, description: 'Repaid in full'
        }),
        baseTransaction({
          id: 'loan-row', accountId: 'loan', amount: -30000, type: 'expense',
          category: '', description: 'Repaid in full', ...over.row
        })
      ],
      [STORAGE_KEYS.TRANSACTION_SPLITS]: [
        {
          id: 'leg', transactionId: 'parent', category: 'tofrom-loan',
          amount: 30000, sortOrder: 1, transferAccountId: 'loan', ...over.line
        },
        { id: 'interest', transactionId: 'parent', category: 'interest', amount: 5000, sortOrder: 2 }
      ],
      [STORAGE_KEYS.CATEGORIES]: [
        {
          id: 'tofrom-current', name: 'To/From Current', type: 'both', level: 'detail',
          isTransferCategory: true, accountId: 'current'
        } as Category,
        { id: 'interest', name: 'Interest', type: 'income', level: 'detail' } as Category
      ]
    });

  it('links the LINE to the row, and files the row against the split\'s account', async () => {
    const storage = lending();
    const service = buildService(storage);

    const result = await service.linkSplitLineTransfer('leg', 'loan-row');

    expect(result.split).toMatchObject({ id: 'leg', transferAccountId: 'loan', linkedTransferId: 'loan-row' });
    // The row over there points at BOTH the parent and the exact line, which
    // is what makes the pair navigable from either end.
    expect(result.transaction).toMatchObject({
      id: 'loan-row',
      type: 'transfer',
      category: 'tofrom-current',
      transferAccountId: 'current',
      linkedTransferId: 'parent',
      linkedTransferSplitId: 'leg'
    });

    const lines = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
    expect(lines.find(l => l.id === 'leg')?.linkedTransferId).toBe('loan-row');
    // The other line is untouched, and so is the parent.
    expect(lines.find(l => l.id === 'interest')).toMatchObject({ amount: 5000, category: 'interest' });
    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(stored.find(t => t.id === 'parent')).toMatchObject({ amount: 35000, isSplit: true });

    // Balance-neutral: both rows already existed with these amounts.
    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts.find(a => a.id === 'current')?.balance).toBe(35000);
    expect(accounts.find(a => a.id === 'loan')?.balance).toBe(30000);
  });

  it.each([
    ['the row is a penny out', { row: { amount: -29999.99 } }, /exactly opposite/],
    ['the row matches the PARENT, not the line', { row: { amount: -35000 } }, /exactly opposite/],
    ['the row sits in a different account from the one the line names', { row: { accountId: 'other' } }, /different account/],
    ['the row is in the split\'s own account', { row: { accountId: 'current' } }, /two different accounts/],
    ['the row is already half of a transfer', { row: { linkedTransferId: 'someone' } }, /already part of a linked transfer/],
    ['the row is already some other line\'s opposite', { row: { linkedTransferSplitId: 'other-line' } }, /already part of a linked transfer/],
    ['the row is itself split', { row: { isSplit: true } }, /split transaction cannot become a transfer/],
    ['the row is archived', { row: { archived: true } }, /archived/],
    ['the line is already linked', { line: { linkedTransferId: 'counterpart' } }, /already one half of a transfer/],
  ])('refuses when %s — and writes nothing at all', async (_case, over, message) => {
    const storage = lending(over);
    const service = buildService(storage);

    await expect(service.linkSplitLineTransfer('leg', 'loan-row')).rejects.toThrow(message);

    const lines = storage.snapshot(STORAGE_KEYS.TRANSACTION_SPLITS) as TransactionSplit[];
    expect(lines.find(l => l.id === 'leg')?.linkedTransferId).toBe(over.line?.linkedTransferId);
    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(stored.find(t => t.id === 'loan-row')?.type).not.toBe('transfer');
  });

  it('refuses a line or a row that is not there', async () => {
    const service = buildService(lending());
    await expect(service.linkSplitLineTransfer('nope', 'loan-row'))
      .rejects.toThrow(/split line no longer exists/);
    await expect(service.linkSplitLineTransfer('leg', 'nope'))
      .rejects.toThrow(/Transaction not found/);
  });
});
