import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDataService, DataService } from '../api/dataService';
import { AccountService } from '../api/accountService';
import { TransactionService } from '../api/transactionService';
import { createSimpleAccountService } from '../api/simpleAccountService';
import { registerSupabaseTokenGetter } from '../../lib/supabaseToken';
import { buildBackupBundle } from '../backupService';
import { LOCAL_WIPE_CONFIRMATION } from '../localBackupService';
import type { Account, Budget, Category, Goal, Transaction, TransactionSplit } from '../../types';
import { STORAGE_KEYS } from '../storageAdapter';

const createStorage = (initial: Record<string, unknown> = {}) => {
  const store = new Map<string, unknown>(Object.entries(initial));
  const put = (key: string, value: unknown): void => {
    store.set(key, Array.isArray(value) ? [...value] : value);
  };
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      put(key, value);
    }),
    /** Several keys as one unit — what the real adapter promises the bulk import. */
    setMany: vi.fn(async (entries: ReadonlyArray<{ key: string; value: unknown }>) => {
      for (const { key, value } of entries) put(key, value);
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

/**
 * The sentence a write refuses with while a signed-in session is still
 * resolving its database id — the one every other write on the class already
 * uses.
 *
 * Written out in full, and compared in full, because it is what the person
 * reads. `rejects.toThrow('…')` matches a SUBSTRING, so it would stay green on
 * "Failed to save budget: Still connecting…" — exactly the wrapping the seam
 * forbids, since a sentence that says only that something went wrong is not
 * one anybody can act on.
 */
const STILL_CONNECTING = 'Still connecting to your account — please try again in a moment.';

/** The whole refusal, or a sentence saying there wasn't one. */
const refusalMessage = async (write: Promise<unknown>): Promise<string> => {
  try {
    await write;
    return 'the write was not refused';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * A signed-in (Clerk) session whose database user id has not resolved yet —
 * still connecting, or resolution failed. The state the guard is about.
 */
const pendingUserIdService = () => ({
  ensureUserExists: vi.fn(),
  getCurrentDatabaseUserId: vi.fn(() => null),
  getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-user-1', databaseId: null }))
});

/**
 * A comparable picture of one stored collection, for "the refusal changed
 * nothing at all" — the contract suite's `asComparable`, narrowed to the store
 * a planning write could have touched.
 */
const asComparable = (storage: ReturnType<typeof createStorage>, key: string): string =>
  JSON.stringify(storage.snapshot(key) ?? null);

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

  it('keeps only the last four of a card number on the local account paths', async () => {
    // Local storage is what the backup file and the JSON export are built from,
    // so a full card number is no safer here than in the database.
    const pan = '1111222233334444';
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'card-1', type: 'credit' })]
    });
    const service = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId
    });

    const updated = await service.updateAccount('card-1', { accountNumber: pan });
    expect(updated.accountNumber).toBe('4444');

    const created = await service.createAccount(
      baseAccount({ id: undefined as never, type: 'credit', accountNumber: pan })
    );
    expect(created.accountNumber).toBe('4444');

    expect(JSON.stringify(storage.snapshot(STORAGE_KEYS.ACCOUNTS))).not.toContain(pan);
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

  it('loads the boot transactions from storage fallback, and says where they came from', async () => {
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

    const boot = await service.loadBootTransactions();
    expect(boot.transactions).toHaveLength(1);
    expect(boot.stats).toEqual({ cached: 0, fetched: 0, total: 1, fullFetchReason: 'local mode' });
  });

  it('reads the account list ONCE across a boot, not once per reader', async () => {
    // What the retired loadAppData cost: it pulled accounts, budgets, goals and
    // categories alongside the transactions, and the boot had ALREADY read the
    // accounts a moment earlier. On a signed-in load that second read was a
    // whole network round trip whose answer was thrown away unread; here, where
    // the store is the browser's, it is one storage read per boot and this
    // counts them.
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount()],
      [STORAGE_KEYS.TRANSACTIONS]: [baseTransaction()],
      [STORAGE_KEYS.TRANSACTION_SPLITS]: []
    });
    const service = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId
    });

    // The boot's own read sequence, in the order AppContext runs it.
    await service.listAccounts();
    await service.loadBootTransactions();
    await service.listTransactionSplits();

    const accountReads = storage.get.mock.calls.filter(
      ([key]) => key === STORAGE_KEYS.ACCOUNTS
    ).length;
    expect(accountReads).toBe(1);
  });

  it('asks the account service once, with the resolved database id', async () => {
    // The boot used to pass the id it had just resolved to a second service by
    // hand. Routing it through the seam moves that lookup inside, so this pins
    // the call shape it must produce: one query, scoped to the database user,
    // never to a Clerk id.
    const accountService = {
      getAccounts: vi.fn(async () => [baseAccount({ id: 'acct-cloud' })]),
      getClosedAccounts: vi.fn(async () => []),
      createAccount: vi.fn(),
      updateAccount: vi.fn(),
      deleteAccount: vi.fn()
    };
    const service = createDataService({
      isSupabaseConfigured: () => true,
      hasCloudSession: () => true,
      accountService,
      storageAdapter: createStorage(),
      logger,
      uuid,
      now,
      userIdService: {
        ensureUserExists: vi.fn(),
        getCurrentDatabaseUserId: vi.fn(() => 'db-user-1'),
        getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-user-1', databaseId: 'db-user-1' }))
      }
    });

    await expect(service.listAccounts()).resolves.toHaveLength(1);
    expect(accountService.getAccounts).toHaveBeenCalledTimes(1);
    expect(accountService.getAccounts).toHaveBeenCalledWith('db-user-1');
  });

  it('asks the planning service for budgets and goals with the resolved database id, never with null', async () => {
    // THE test of this slice, and the reason budgets/goals were worth a
    // separate review from the writes beside them.
    //
    // PlanningService.getBudgets(null) does not throw, does not warn and does
    // not return empty: it silently reads the BROWSER's budgets instead
    // (planningService.ts — `if (this.cloudReady && userId)` … else
    // readLocal). So a null owner is not a crash, it is a signed-in person
    // being shown demo or imported budgets as if they were theirs, in a
    // perfectly well-formed list with nothing anywhere to say the wrong store
    // answered. The seam takes no user id precisely so no caller can make that
    // mistake — and this pins that the seam itself does not make it either.
    const planningService = {
      mergeCategories: vi.fn(),
      getBudgets: vi.fn(async () => [] as Budget[]),
      getGoals: vi.fn(async () => [] as Goal[]),
      ensureCategories: vi.fn(async () => [] as Category[])
    };
    const storage = createStorage({
      // Present, and it must NOT be what comes back: a cloud read that fell
      // through to the local store would otherwise pass this test unnoticed.
      [STORAGE_KEYS.BUDGETS]: [{ id: 'budget-from-the-browser' }],
      [STORAGE_KEYS.GOALS]: [{ id: 'goal-from-the-browser' }]
    });
    const service = createDataService({
      isSupabaseConfigured: () => true,
      hasCloudSession: () => true,
      planningService,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: {
        ensureUserExists: vi.fn(),
        getCurrentDatabaseUserId: vi.fn(() => 'db-user-1'),
        getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-user-1', databaseId: 'db-user-1' }))
      }
    });

    await expect(service.listBudgets()).resolves.toEqual([]);
    await expect(service.listGoals()).resolves.toEqual([]);

    expect(planningService.getBudgets).toHaveBeenCalledTimes(1);
    expect(planningService.getBudgets).toHaveBeenCalledWith('db-user-1');
    expect(planningService.getGoals).toHaveBeenCalledTimes(1);
    expect(planningService.getGoals).toHaveBeenCalledWith('db-user-1');
    // Said twice on purpose: `toHaveBeenCalledWith('db-user-1')` would still
    // pass if a SECOND call arrived with null, and the second call is exactly
    // the bug being guarded against.
    expect(planningService.getBudgets.mock.calls).toEqual([['db-user-1']]);
    expect(planningService.getGoals.mock.calls).toEqual([['db-user-1']]);
    // The browser's copies stayed where they were.
    expect(storage.get).not.toHaveBeenCalledWith(STORAGE_KEYS.BUDGETS);
    expect(storage.get).not.toHaveBeenCalledWith(STORAGE_KEYS.GOALS);
  });

  describe('budget writes', () => {
    // THE tests of this slice. A read that resolves the wrong owner shows the
    // wrong numbers until the next refresh; a WRITE that resolves the wrong
    // owner puts a signed-in person's budget in browser storage, shows it to
    // them as saved, and loses it at the next boot — because the read beside it
    // goes to the cloud, where the row never landed. Nothing throws, nothing
    // logs, and there is no way back. So each write gets the same two
    // questions: with a cloud session, was the RESOLVED id passed on (and never
    // a null)? With no cloud, did the browser's own store take it, without the
    // cloud service being touched at all?

    const budgetInput = (
      overrides: Partial<Omit<Budget, 'id' | 'spent'>> = {}
    ): Omit<Budget, 'id' | 'spent'> => ({
      // The shape the budget modal actually submits.
      categoryId: 'cat-everyday',
      amount: 70.1,
      period: 'monthly',
      isActive: true,
      createdAt: new Date('2025-08-01T00:00:00.000Z'),
      updatedAt: new Date('2025-08-01T00:00:00.000Z'),
      ...overrides
    });

    /** A stand-in for the cloud half, answering plausibly so the call SHAPE is what fails. */
    const cloudPlanningService = () => ({
      mergeCategories: vi.fn(),
      createBudget: vi.fn(
        async (_userId: string | null, budget: Omit<Budget, 'id' | 'spent'>): Promise<Budget> => ({
          ...budget,
          id: 'budget-from-the-cloud',
          spent: 0
        })
      ),
      updateBudget: vi.fn(
        async (_userId: string | null, id: string, updates: Partial<Budget>): Promise<Budget> => ({
          ...budgetInput(),
          ...updates,
          id,
          spent: 0
        })
      ),
      deleteBudget: vi.fn(async (): Promise<void> => {}),
      getBudgets: vi.fn(async () => [] as Budget[]),
      getGoals: vi.fn(async () => [] as Goal[]),
      ensureCategories: vi.fn(async () => [] as Category[])
    });

    const signedIn = (planningService: ReturnType<typeof cloudPlanningService>, storage: ReturnType<typeof createStorage>) =>
      createDataService({
        isSupabaseConfigured: () => true,
        hasCloudSession: () => true,
        planningService,
        storageAdapter: storage,
        logger,
        uuid,
        now,
        userIdService: {
          ensureUserExists: vi.fn(),
          getCurrentDatabaseUserId: vi.fn(() => 'db-user-1'),
          getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-user-1', databaseId: 'db-user-1' }))
        }
      });

    /** The same session one step earlier: signed in, database id not resolved. */
    const stillConnecting = (
      planningService: ReturnType<typeof cloudPlanningService>,
      storage: ReturnType<typeof createStorage>
    ) =>
      createDataService({
        isSupabaseConfigured: () => true,
        hasCloudSession: () => true,
        planningService,
        storageAdapter: storage,
        logger,
        uuid,
        now,
        userIdService: pendingUserIdService()
      });

    /** A budget already in the browser's copy, so "nothing changed" has something to say. */
    const storedBudget = { id: 'budget-already-here', categoryId: 'cat-everyday', amount: 200, spent: 0 };

    it('creates a budget under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.BUDGETS]: [] });
      const service = signedIn(planningService, storage);
      const input = budgetInput();

      const created = await service.createBudget(input);

      expect(created.id).toBe('budget-from-the-cloud');
      // The whole call log, not just "was called with": a SECOND call carrying
      // null is exactly the bug, and `toHaveBeenCalledWith` alone would pass
      // straight through it.
      expect(planningService.createBudget.mock.calls).toEqual([['db-user-1', input]]);
      // And it went to the cloud INSTEAD of the browser, not as well as.
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('updates a budget under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.BUDGETS]: [] });
      const service = signedIn(planningService, storage);

      const updated = await service.updateBudget('budget-1', { amount: 0.3 });

      expect(updated.amount).toBe(0.3);
      expect(planningService.updateBudget.mock.calls).toEqual([['db-user-1', 'budget-1', { amount: 0.3 }]]);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('deletes a budget under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.BUDGETS]: [] });
      const service = signedIn(planningService, storage);

      await service.deleteBudget('budget-1');

      expect(planningService.deleteBudget.mock.calls).toEqual([['db-user-1', 'budget-1']]);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('hands the cloud failure back word for word', async () => {
      // The budget modal renders `error.message` straight into the dialog. A
      // wrapper here — "Failed to save budget" — would replace a sentence that
      // says what went wrong with one that says only that something did, and
      // the seam's rule 4 says the wording is part of the contract. So the
      // cloud branch returns the promise unwrapped, and this is what proves it.
      const planningService = cloudPlanningService();
      planningService.createBudget.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "budgets_user_category_period_key"')
      );
      const service = signedIn(planningService, createStorage({ [STORAGE_KEYS.BUDGETS]: [] }));

      await expect(service.createBudget(budgetInput())).rejects.toThrow(
        'duplicate key value violates unique constraint "budgets_user_category_period_key"'
      );
    });

    it('writes to the browser store, and does not touch the cloud service, with no cloud session', async () => {
      // The other half of every test above: with no cloud, the write is this
      // class's own, and the fields it fills in mirror PlanningService's local
      // half exactly (`spent` at zero, both timestamps stamped now, a generated
      // id) — because the two halves write the SAME browser collection, and a
      // budget that came out of one must be indistinguishable from a budget
      // that came out of the other.
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.BUDGETS]: [] });
      const service = createDataService({
        isSupabaseConfigured: () => false,
        hasCloudSession: () => false,
        planningService,
        storageAdapter: storage,
        logger,
        uuid: () => 'budget-generated',
        now,
        userIdService: userId
      });

      const created = await service.createBudget(budgetInput({ amount: 0.3 }));
      expect(created).toMatchObject({
        id: 'budget-generated',
        categoryId: 'cat-everyday',
        amount: 0.3,
        spent: 0,
        createdAt: new Date('2025-09-01T00:00:00.000Z'),
        updatedAt: new Date('2025-09-01T00:00:00.000Z')
      });

      const edited = await service.updateBudget('budget-generated', { amount: 70.1 });
      expect(edited.amount).toBe(70.1);
      expect(await service.listBudgets()).toEqual([edited]);

      // A budget that is not there is refused by name rather than created, and
      // the refusal leaves the store exactly as it was — the lookup happens
      // before the first write. (This assertion moved here from
      // planningService.test.ts when that class's local half was retired: the
      // rule now lives on this class, so this is where it is held.)
      await expect(service.updateBudget('budget-nowhere', { amount: 1 }))
        .rejects.toThrow('Budget not found');
      expect(await service.listBudgets()).toEqual([edited]);

      await service.deleteBudget('budget-generated');
      expect(await service.listBudgets()).toEqual([]);

      expect(planningService.createBudget).not.toHaveBeenCalled();
      expect(planningService.updateBudget).not.toHaveBeenCalled();
      expect(planningService.deleteBudget).not.toHaveBeenCalled();
    });

    // THE DELIBERATE BEHAVIOUR CHANGE, one test per operation, here and in the
    // goal and category blocks below.
    //
    // A signed-in session whose database id has not resolved yet — the seconds
    // after a boot, or a resolution that failed outright — used to fall through
    // to the local branch, because neither half of `userId && configured` is a
    // refusal on its own. The budget landed in browser storage, the modal
    // showed it as saved, and it was gone at the next boot: the read beside it
    // goes to the cloud, where the row never was. Nothing threw and nothing
    // logged, so there was no way to even know it had happened.
    //
    // Now the write refuses, in words the person can act on twenty seconds
    // later — and refuses BEFORE reading or writing the store, so there is
    // nothing half-done left behind either. That second half is what the
    // byte-identical check below is for.

    it('refuses to create a budget while the session is still resolving, and writes nothing', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.BUDGETS]: [storedBudget] });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.BUDGETS);

      expect(await refusalMessage(service.createBudget(budgetInput()))).toBe(STILL_CONNECTING);

      // Refused, not re-routed: neither store was asked to take it.
      expect(planningService.createBudget).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.BUDGETS)).toBe(before);
    });

    it('refuses to update a budget while the session is still resolving, and writes nothing', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.BUDGETS]: [storedBudget] });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.BUDGETS);

      expect(await refusalMessage(service.updateBudget('budget-already-here', { amount: 70.1 })))
        .toBe(STILL_CONNECTING);

      expect(planningService.updateBudget).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.BUDGETS)).toBe(before);
    });

    it('refuses to delete a budget while the session is still resolving, and writes nothing', async () => {
      // The delete is the one where falling through was worst: the local branch
      // would have removed a budget from the browser's copy that the cloud —
      // the store this session is about to read from — still has.
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.BUDGETS]: [storedBudget] });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.BUDGETS);

      expect(await refusalMessage(service.deleteBudget('budget-already-here'))).toBe(STILL_CONNECTING);

      expect(planningService.deleteBudget).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.BUDGETS)).toBe(before);
    });
  });

  describe('goal writes', () => {
    // The budget block above says why these tests exist; the hazard is the
    // same one, operation for operation. `PlanningService.createGoal(null, …)`
    // does not throw and does not warn — it writes the browser's copy and
    // hands back an ordinary Goal — so a signed-in person would see the goal
    // they just set appear on the page, and find the page empty at the next
    // boot, when the cloud read it never reached answers instead. The compiler
    // cannot catch it, because null is a legal argument there. These can.

    const goalInput = (
      overrides: Partial<Omit<Goal, 'id' | 'progress'>> = {}
    ): Omit<Goal, 'id' | 'progress'> => ({
      // The shape the goal modal actually submits.
      name: 'New boiler',
      type: 'savings',
      targetAmount: 1500,
      currentAmount: 0,
      targetDate: new Date('2026-01-01T00:00:00.000Z'),
      isActive: true,
      createdAt: new Date('2025-08-01T00:00:00.000Z'),
      updatedAt: new Date('2025-08-01T00:00:00.000Z'),
      ...overrides
    });

    /** A stand-in for the cloud half, answering plausibly so the call SHAPE is what fails. */
    const cloudPlanningService = () => ({
      mergeCategories: vi.fn(),
      createBudget: vi.fn(),
      updateBudget: vi.fn(),
      deleteBudget: vi.fn(),
      createGoal: vi.fn(
        async (_userId: string | null, goal: Omit<Goal, 'id' | 'progress'>): Promise<Goal> => ({
          ...goal,
          id: 'goal-from-the-cloud',
          progress: goal.currentAmount ?? 0
        })
      ),
      updateGoal: vi.fn(
        async (_userId: string | null, id: string, updates: Partial<Goal>): Promise<Goal> => ({
          ...goalInput(),
          progress: 0,
          ...updates,
          id
        })
      ),
      deleteGoal: vi.fn(async (): Promise<void> => {}),
      getBudgets: vi.fn(async () => [] as Budget[]),
      getGoals: vi.fn(async () => [] as Goal[]),
      ensureCategories: vi.fn(async () => [] as Category[])
    });

    const signedIn = (planningService: ReturnType<typeof cloudPlanningService>, storage: ReturnType<typeof createStorage>) =>
      createDataService({
        isSupabaseConfigured: () => true,
        hasCloudSession: () => true,
        planningService,
        storageAdapter: storage,
        logger,
        uuid,
        now,
        userIdService: {
          ensureUserExists: vi.fn(),
          getCurrentDatabaseUserId: vi.fn(() => 'db-user-1'),
          getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-user-1', databaseId: 'db-user-1' }))
        }
      });

    /** The same session one step earlier: signed in, database id not resolved. */
    const stillConnecting = (
      planningService: ReturnType<typeof cloudPlanningService>,
      storage: ReturnType<typeof createStorage>
    ) =>
      createDataService({
        isSupabaseConfigured: () => true,
        hasCloudSession: () => true,
        planningService,
        storageAdapter: storage,
        logger,
        uuid,
        now,
        userIdService: pendingUserIdService()
      });

    /** A goal already in the browser's copy, so "nothing changed" has something to say. */
    const storedGoal = {
      id: 'goal-already-here',
      name: 'New boiler',
      targetAmount: 1500,
      progress: 250.05
    };

    it('creates a goal under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.GOALS]: [] });
      const service = signedIn(planningService, storage);
      const input = goalInput({ currentAmount: 250.05 });

      const created = await service.createGoal(input);

      expect(created.id).toBe('goal-from-the-cloud');
      // The whole call log, not just "was called with": a SECOND call carrying
      // null is exactly the bug, and `toHaveBeenCalledWith` alone would pass
      // straight through it.
      expect(planningService.createGoal.mock.calls).toEqual([['db-user-1', input]]);
      // And it went to the cloud INSTEAD of the browser, not as well as.
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('updates a goal under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.GOALS]: [] });
      const service = signedIn(planningService, storage);

      // The shape a contribution takes: the caller has already added it up and
      // capped it at the target, and hands over the figure to store.
      const updated = await service.updateGoal('goal-1', { progress: 1500, currentAmount: 1500 });

      expect(updated.progress).toBe(1500);
      expect(planningService.updateGoal.mock.calls)
        .toEqual([['db-user-1', 'goal-1', { progress: 1500, currentAmount: 1500 }]]);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('deletes a goal under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.GOALS]: [] });
      const service = signedIn(planningService, storage);

      await service.deleteGoal('goal-1');

      expect(planningService.deleteGoal.mock.calls).toEqual([['db-user-1', 'goal-1']]);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('hands the cloud failure back word for word', async () => {
      // Same reason as the budget one: the goals page renders `error.message`,
      // and a wrapper here would replace a sentence that says what went wrong
      // with one that says only that something did. The cloud branch returns
      // the promise unwrapped, and this is what proves it.
      const planningService = cloudPlanningService();
      planningService.updateGoal.mockRejectedValueOnce(
        new Error('new row for relation "goals" violates check constraint "goals_target_amount_check"')
      );
      const service = signedIn(planningService, createStorage({ [STORAGE_KEYS.GOALS]: [] }));

      await expect(service.updateGoal('goal-1', { targetAmount: -1 })).rejects.toThrow(
        'new row for relation "goals" violates check constraint "goals_target_amount_check"'
      );
    });

    it('writes to the browser store, and does not touch the cloud service, with no cloud session', async () => {
      // The other half of every test above. The fields this class fills in
      // mirror PlanningService's local half exactly — because the two write the
      // SAME browser collection, and a goal that came out of one must be
      // indistinguishable from a goal that came out of the other.
      //
      // Including the one that is easy to get wrong: `progress` starts at the
      // money already put by, not at zero. £250.05 set aside before the goal
      // was written down is £250.05 of progress, and hard-coding a zero here
      // would silently bank it.
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.GOALS]: [] });
      const service = createDataService({
        isSupabaseConfigured: () => false,
        hasCloudSession: () => false,
        planningService,
        storageAdapter: storage,
        logger,
        uuid: () => 'goal-generated',
        now,
        userIdService: userId
      });

      const created = await service.createGoal(goalInput({ currentAmount: 250.05 }));
      expect(created).toMatchObject({
        id: 'goal-generated',
        name: 'New boiler',
        targetAmount: 1500,
        progress: 250.05,
        createdAt: new Date('2025-09-01T00:00:00.000Z'),
        updatedAt: new Date('2025-09-01T00:00:00.000Z')
      });

      const edited = await service.updateGoal('goal-generated', { progress: 1500, currentAmount: 1500 });
      expect(edited.progress).toBe(1500);
      expect(await service.listGoals()).toEqual([edited]);

      // Same refusal as the budget block above, for the same reason, and the
      // same reason it is asserted here: the rule moved onto this class when
      // PlanningService's local half was retired.
      await expect(service.updateGoal('goal-nowhere', { progress: 1 }))
        .rejects.toThrow('Goal not found');
      expect(await service.listGoals()).toEqual([edited]);

      await service.deleteGoal('goal-generated');
      expect(await service.listGoals()).toEqual([]);

      expect(planningService.createGoal).not.toHaveBeenCalled();
      expect(planningService.updateGoal).not.toHaveBeenCalled();
      expect(planningService.deleteGoal).not.toHaveBeenCalled();
    });

    // The behaviour change, operation for operation. The budget block above
    // argues it; a goal loses the same way, and the update carries a
    // contribution, so a fall-through would bank real money in a store the next
    // boot never reads.

    it('refuses to create a goal while the session is still resolving, and writes nothing', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.GOALS]: [storedGoal] });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.GOALS);

      expect(await refusalMessage(service.createGoal(goalInput()))).toBe(STILL_CONNECTING);

      expect(planningService.createGoal).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.GOALS)).toBe(before);
    });

    it('refuses to update a goal while the session is still resolving, and writes nothing', async () => {
      // Including the update that IS a contribution: £250 put towards the
      // boiler, banked in the browser's copy and gone by morning, is money the
      // person believes they have set aside.
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.GOALS]: [storedGoal] });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.GOALS);

      expect(await refusalMessage(
        service.updateGoal('goal-already-here', { progress: 500.05, currentAmount: 500.05 })
      )).toBe(STILL_CONNECTING);

      expect(planningService.updateGoal).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.GOALS)).toBe(before);
    });

    it('refuses to delete a goal while the session is still resolving, and writes nothing', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.GOALS]: [storedGoal] });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.GOALS);

      expect(await refusalMessage(service.deleteGoal('goal-already-here'))).toBe(STILL_CONNECTING);

      expect(planningService.deleteGoal).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.GOALS)).toBe(before);
    });
  });

  describe('category writes', () => {
    // The budget and goal blocks above say why these tests exist; the hazard is
    // the same one, operation for operation, and it is arguably worse here.
    // `PlanningService.createCategory(null, …)` does not throw and does not
    // warn — it writes the browser's copy and hands back an ordinary Category —
    // so a signed-in person would name a category, file three transactions
    // under the id it gave them, and find all three uncategorised at the next
    // boot, because the cloud read it never reached knows nothing about either.
    // The compiler cannot catch it, because null is a legal argument there.
    // These can.

    const categoryInput = (
      overrides: Partial<Omit<Category, 'id'>> = {}
    ): Omit<Category, 'id'> => ({
      // The shape the category modal actually submits.
      name: 'Fuel',
      type: 'expense',
      level: 'detail',
      isActive: true,
      ...overrides
    });

    /** A stand-in for the cloud half, answering plausibly so the call SHAPE is what fails. */
    const cloudPlanningService = () => ({
      mergeCategories: vi.fn(),
      createBudget: vi.fn(),
      updateBudget: vi.fn(),
      deleteBudget: vi.fn(),
      createCategory: vi.fn(
        async (_userId: string | null, category: Omit<Category, 'id'>): Promise<Category> => ({
          ...category,
          id: 'category-from-the-cloud'
        })
      ),
      createCategories: vi.fn(
        async (
          _userId: string | null,
          categories: Array<Omit<Category, 'id'>>
        ): Promise<Category[]> =>
          categories.map((category, index) => ({ ...category, id: `cloud-category-${index}` }))
      ),
      updateCategory: vi.fn(
        async (
          _userId: string | null,
          id: string,
          updates: Partial<Category>
        ): Promise<Category> => ({ ...categoryInput(), ...updates, id })
      ),
      deleteCategory: vi.fn(async (): Promise<void> => {}),
      // Deliberately not `ids.length`: the cloud RPC re-verifies every row and
      // may delete fewer, and the seam promises the caller what actually went.
      deleteUnusedCategories: vi.fn(async (): Promise<number> => 1),
      getBudgets: vi.fn(async () => [] as Budget[]),
      getGoals: vi.fn(async () => [] as Goal[]),
      ensureCategories: vi.fn(async () => [] as Category[])
    });

    const cloudUserIdService = () => ({
      ensureUserExists: vi.fn(),
      getCurrentDatabaseUserId: vi.fn(() => 'db-user-1' as string | null),
      getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-user-1', databaseId: 'db-user-1' }))
    });

    const signedIn = (
      planningService: ReturnType<typeof cloudPlanningService>,
      storage: ReturnType<typeof createStorage>,
      ids: ReturnType<typeof cloudUserIdService> = cloudUserIdService()
    ) =>
      createDataService({
        isSupabaseConfigured: () => true,
        hasCloudSession: () => true,
        planningService,
        storageAdapter: storage,
        logger,
        uuid,
        now,
        userIdService: ids
      });

    /** The same session one step earlier: signed in, database id not resolved. */
    const stillConnecting = (
      planningService: ReturnType<typeof cloudPlanningService>,
      storage: ReturnType<typeof createStorage>
    ) =>
      createDataService({
        isSupabaseConfigured: () => true,
        hasCloudSession: () => true,
        planningService,
        storageAdapter: storage,
        logger,
        uuid,
        now,
        userIdService: pendingUserIdService()
      });

    /** A group and its child, already in the browser's copy. */
    const storedCategories = [
      { id: 'cat-group', name: 'Motoring', type: 'expense', level: 'sub', isActive: true },
      {
        id: 'cat-child',
        name: 'Fuel',
        type: 'expense',
        level: 'detail',
        parentId: 'cat-group',
        isActive: true
      }
    ];

    it('creates a category under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: [] });
      const service = signedIn(planningService, storage);
      const input = categoryInput();

      const created = await service.createCategory(input);

      expect(created.id).toBe('category-from-the-cloud');
      // The whole call log, not just "was called with": a SECOND call carrying
      // null is exactly the bug, and `toHaveBeenCalledWith` alone would pass
      // straight through it.
      expect(planningService.createCategory.mock.calls).toEqual([['db-user-1', input]]);
      // And it went to the cloud INSTEAD of the browser, not as well as.
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('creates categories in bulk under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: [] });
      const service = signedIn(planningService, storage);
      const rows = [categoryInput({ name: 'Fuel' }), categoryInput({ name: 'Parking' })];

      const created = await service.createCategories(rows);

      expect(created.map(category => category.id)).toEqual(['cloud-category-0', 'cloud-category-1']);
      expect(planningService.createCategories.mock.calls).toEqual([['db-user-1', rows]]);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('asks nobody at all — not even for the owner — when a bulk create is given nothing', async () => {
      // The empty check runs BEFORE the owner is resolved, which is the
      // behaviour rather than a saving: a tree import that adds only detail
      // plans no new groups and asks anyway, and neither the cloud nor the
      // browser should be opened to answer that.
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: [] });
      const ids = cloudUserIdService();
      const service = signedIn(planningService, storage, ids);

      await expect(service.createCategories([])).resolves.toEqual([]);
      await expect(service.deleteUnusedCategories([])).resolves.toBe(0);

      expect(planningService.createCategories).not.toHaveBeenCalled();
      expect(planningService.deleteUnusedCategories).not.toHaveBeenCalled();
      expect(ids.getCurrentDatabaseUserId).not.toHaveBeenCalled();
      expect(storage.get).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('updates a category under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: [] });
      const service = signedIn(planningService, storage);

      const updated = await service.updateCategory('cat-1', { name: 'Motor fuel' });

      expect(updated.name).toBe('Motor fuel');
      expect(planningService.updateCategory.mock.calls)
        .toEqual([['db-user-1', 'cat-1', { name: 'Motor fuel' }]]);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('deletes a category under the resolved database id, and never under null', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: [] });
      const service = signedIn(planningService, storage);

      await service.deleteCategory('cat-1');

      expect(planningService.deleteCategory.mock.calls).toEqual([['db-user-1', 'cat-1']]);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('prunes under the resolved database id, and hands back the count the cloud gave', async () => {
      // Two ids in, one row out: the RPC re-verifies and may keep a category
      // something has since been filed against. The seam passes that figure
      // through untouched — the caller prints it.
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: [] });
      const service = signedIn(planningService, storage);

      const removed = await service.deleteUnusedCategories(['cat-1', 'cat-2']);

      expect(removed).toBe(1);
      expect(planningService.deleteUnusedCategories.mock.calls)
        .toEqual([['db-user-1', ['cat-1', 'cat-2']]]);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('hands the cloud failure back word for word', async () => {
      // Same reason as the budget and goal ones: the category screens render
      // `error.message`, and the sentences the database produces here name the
      // rule that stopped the write — a duplicate name under the same parent is
      // the one users actually hit. A wrapper here would replace it with
      // "Failed to save category".
      const planningService = cloudPlanningService();
      planningService.createCategory.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "categories_user_name_parent_key"')
      );
      const service = signedIn(planningService, createStorage({ [STORAGE_KEYS.CATEGORIES]: [] }));

      await expect(service.createCategory(categoryInput())).rejects.toThrow(
        'duplicate key value violates unique constraint "categories_user_name_parent_key"'
      );
    });

    it('writes to the browser store, and does not touch the cloud service, with no cloud session', async () => {
      // The other half of every test above. The fields this class fills in
      // mirror PlanningService's local half exactly — the id and nothing else —
      // because the two write the SAME browser collection, and a category that
      // came out of one must be indistinguishable from a category that came out
      // of the other.
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: [] });
      let sequence = 0;
      const service = createDataService({
        isSupabaseConfigured: () => false,
        hasCloudSession: () => false,
        planningService,
        storageAdapter: storage,
        logger,
        uuid: () => `category-${++sequence}`,
        now,
        userIdService: userId
      });

      const group = await service.createCategory(categoryInput({ name: 'Motoring', level: 'sub' }));
      expect(group).toEqual({
        name: 'Motoring',
        type: 'expense',
        level: 'sub',
        isActive: true,
        id: 'category-1'
      });

      const details = await service.createCategories([
        categoryInput({ name: 'Fuel', parentId: group.id }),
        categoryInput({ name: 'Parking', parentId: group.id })
      ]);
      expect(details.map(category => category.id)).toEqual(['category-2', 'category-3']);

      const renamed = await service.updateCategory('category-2', { name: 'Petrol' });
      expect(renamed).toMatchObject({ id: 'category-2', name: 'Petrol', parentId: 'category-1' });
      await expect(service.updateCategory('category-nowhere', { name: 'Nothing' }))
        .rejects.toThrow('Category not found');

      // The cascade: the group goes and takes its children with it.
      await service.deleteCategory('category-1');
      expect(await service.listCategories()).toEqual([]);

      expect(planningService.createCategory).not.toHaveBeenCalled();
      expect(planningService.createCategories).not.toHaveBeenCalled();
      expect(planningService.updateCategory).not.toHaveBeenCalled();
      expect(planningService.deleteCategory).not.toHaveBeenCalled();
    });

    it('counts what a local prune actually removed, not what it was asked to remove', async () => {
      // B-6 against the browser's own store. Neither figure below is the size
      // of the request: an id that names nothing removes nothing, and an id
      // that names a group removes the group's children with it. The caller
      // shows this number to the user.
      const storage = createStorage({
        [STORAGE_KEYS.CATEGORIES]: [
          { id: 'cat-group', name: 'Motoring', type: 'expense', level: 'sub', isActive: true },
          { id: 'cat-child', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'cat-group', isActive: true },
          { id: 'cat-keep', name: 'Groceries', type: 'expense', level: 'detail', isActive: true }
        ]
      });
      const service = createDataService({
        isSupabaseConfigured: () => false,
        hasCloudSession: () => false,
        planningService: cloudPlanningService(),
        storageAdapter: storage,
        logger,
        uuid,
        now,
        userIdService: userId
      });

      // Two asked for, one of them nowhere: one actually went.
      await expect(service.deleteUnusedCategories(['cat-keep', 'cat-nowhere'])).resolves.toBe(1);
      // One asked for, and it took its child with it: two actually went.
      await expect(service.deleteUnusedCategories(['cat-group'])).resolves.toBe(2);
      expect(await service.listCategories()).toEqual([]);
    });

    // The behaviour change on all five category writes — and the asymmetry that
    // has to survive review. `prepareCategories` deliberately has NO pending
    // gate, because a category list is not money: serving the browser's copy of
    // the NAMES to a session still resolving its id costs nothing, and
    // withholding them would blank the register's category column for no gain.
    // That argument does not reach a WRITE. A write mints an id in a store the
    // cloud will never hear about; the person names "Fuel", files three
    // transactions under that id, and finds all three uncategorised in the
    // morning. Reading names and writing rows are different questions, and
    // making the two "consistent" in either direction breaks one of them.

    it('refuses to create a category while the session is still resolving, and writes nothing', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: storedCategories });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.CATEGORIES);

      expect(await refusalMessage(service.createCategory(categoryInput()))).toBe(STILL_CONNECTING);

      expect(planningService.createCategory).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.CATEGORIES)).toBe(before);
    });

    it('refuses a bulk create while the session is still resolving, and writes nothing', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: storedCategories });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.CATEGORIES);

      expect(await refusalMessage(
        service.createCategories([categoryInput({ name: 'Parking' })])
      )).toBe(STILL_CONNECTING);

      expect(planningService.createCategories).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.CATEGORIES)).toBe(before);

      // And the empty case still asks nobody and refuses nobody: there is no
      // write to lose, so an error message here would be about nothing.
      await expect(service.createCategories([])).resolves.toEqual([]);
      await expect(service.deleteUnusedCategories([])).resolves.toBe(0);
    });

    it('refuses to update a category while the session is still resolving, and writes nothing', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: storedCategories });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.CATEGORIES);

      expect(await refusalMessage(service.updateCategory('cat-child', { name: 'Petrol' })))
        .toBe(STILL_CONNECTING);

      expect(planningService.updateCategory).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.CATEGORIES)).toBe(before);
    });

    it('refuses to delete a category while the session is still resolving, and writes nothing', async () => {
      // A delete that fell through took the group's children with it — out of
      // the browser's copy only, while the cloud kept all three. The next boot
      // would put them straight back, so the person deletes twice and believes
      // the app is ignoring them.
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: storedCategories });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.CATEGORIES);

      expect(await refusalMessage(service.deleteCategory('cat-group'))).toBe(STILL_CONNECTING);

      expect(planningService.deleteCategory).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.CATEGORIES)).toBe(before);
    });

    it('refuses a prune while the session is still resolving, and writes nothing', async () => {
      const planningService = cloudPlanningService();
      const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: storedCategories });
      const service = stillConnecting(planningService, storage);
      const before = asComparable(storage, STORAGE_KEYS.CATEGORIES);

      expect(await refusalMessage(service.deleteUnusedCategories(['cat-group', 'cat-child'])))
        .toBe(STILL_CONNECTING);

      expect(planningService.deleteUnusedCategories).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(asComparable(storage, STORAGE_KEYS.CATEGORIES)).toBe(before);
    });
  });

  it('does not swallow an unreadable account list — exactly as the call it replaced did not', async () => {
    // The boot's two reads that promise never to reject (its transactions and
    // its split lines) resolve empty when the store will not open. The ACCOUNT
    // read deliberately does not join them: an empty account list is not a
    // missing optimisation, it is a signed-in person being shown a ledger with
    // no accounts in it, and an honest error page is the better answer.
    //
    // This pins that the routing change kept that behaviour rather than
    // introducing it: both the retired direct call and the seam's read reject
    // when their fallback store refuses, because both reach for stored accounts
    // from inside their own catch.
    const refuse = async (): Promise<never> => {
      throw new Error('The store could not be opened');
    };
    const unreadable = { get: vi.fn(refuse), set: vi.fn(refuse) };

    const retiredCall = createSimpleAccountService({
      supabaseClient: null,
      storageAdapter: unreadable,
      logger,
      now,
      uuid
    });
    await expect(retiredCall.getAccounts('db-user-1')).rejects.toThrow(/could not be opened/);

    const throughTheSeam = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: unreadable,
      logger,
      uuid,
      now,
      userIdService: userId
    });
    await expect(throughTheSeam.listAccounts()).rejects.toThrow(/could not be opened/);
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

    expect(await service.listAccounts()).toEqual([]);
    expect(await service.listClosedAccounts()).toEqual([]);
    expect(await service.listTransactions()).toEqual([]);
    expect(await service.listTransactionSplits()).toEqual([]);
    expect(await service.listBudgets()).toEqual([]);
    expect(await service.listCategories()).toEqual([]);
    await expect(service.createTransaction(baseTransaction({ id: undefined as never })))
      .rejects.toThrow(/Still connecting/);
    await expect(service.closeAccount('demo-open')).rejects.toThrow(/Still connecting/);
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
    expect(await localService.listAccounts()).toHaveLength(2);
    expect(await localService.listClosedAccounts()).toHaveLength(1);
  });

  it('still names the categories while a signed-in session is resolving — the one read without the gate', async () => {
    // A deliberate exception to the test above, pinned so that "consistency"
    // cannot quietly delete it.
    //
    // Everything the pending gate withholds is MONEY: accounts, transactions,
    // budgets, split lines. A category list is not money — it is the set of
    // NAMES rows are filed under, and this browser's copy is the same list the
    // account's own copy was migrated from. Withholding it would buy nothing
    // and cost the boot its category names: blank cells down the register's
    // category column, an empty category filter, for as long as the database id
    // takes to resolve.
    //
    // The retired boot called PlanningService.ensureCategories(null) at exactly
    // this point and got exactly this. If this test ever fails because someone
    // added the guard for symmetry, the answer is to delete the guard.
    const storedCategory: Category = {
      id: 'cat-everyday',
      name: 'Everyday',
      type: 'expense',
      level: 'detail',
      isActive: true
    };
    const storage = createStorage({ [STORAGE_KEYS.CATEGORIES]: [storedCategory] });
    const service = createDataService({
      isSupabaseConfigured: () => true,
      hasCloudSession: () => true,
      storageAdapter: storage,
      logger,
      uuid,
      now,
      userIdService: userId // getCurrentDatabaseUserId → null: still resolving
    });

    // The gated read says nothing, as it must.
    expect(await service.listCategories()).toEqual([]);
    // The boot's read still names them.
    expect((await service.prepareCategories()).map(category => category.id))
      .toEqual(['cat-everyday']);
  });

  it('boots on the default categories when nothing is stored, rather than on none', async () => {
    // Never empty: whatever this returns IS the list the register, the budgets
    // page and every category filter are built from, and the boot does not ask
    // twice. A brand-new local-mode ledger with [] here would have nowhere to
    // file anything and no way to make somewhere.
    const service = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: createStorage(),
      logger,
      uuid,
      now,
      userIdService: userId
    });

    const prepared = await service.prepareCategories();
    expect(prepared.length).toBeGreaterThan(0);
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

    const accounts = await DataService.listAccounts();
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
/**
 * Re-pointing a linked transfer — the demo/offline half of repoint_transfer
 * (migration 20260810140000).
 *
 * The invariants worth stating: the counterpart MOVES rather than being
 * recreated, both sides are re-filed from the new pairing (each naming the
 * OTHER account), amounts and dates are untouched, and the money goes with the
 * row — the account it left is down by exactly what the account it joined is
 * up by.
 */
describe('DataService repointTransfer (local mode)', () => {
  /** A → B: −500 in acct-a linked to +500 in acct-b. */
  const linkedPair = (): Transaction[] => [
    baseTransaction({
      id: 'src', accountId: 'acct-a', amount: -500, type: 'transfer',
      category: 'tofrom-b', transferAccountId: 'acct-b', linkedTransferId: 'cp',
      date: new Date('2026-06-10T00:00:00.000Z'), description: 'TRANSFER OUT'
    }),
    baseTransaction({
      id: 'cp', accountId: 'acct-b', amount: 500, type: 'transfer',
      category: 'tofrom-a', transferAccountId: 'acct-a', linkedTransferId: 'src',
      date: new Date('2026-06-10T00:00:00.000Z'), description: 'TRANSFER OUT'
    })
  ];

  const transferCategories: Category[] = [
    { id: 'tofrom-a', name: 'To/From A', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acct-a' },
    { id: 'tofrom-b', name: 'To/From B', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acct-b' },
    { id: 'tofrom-c', name: 'To/From C', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acct-c' }
  ];

  const buildService = (storage: ReturnType<typeof createStorage>) =>
    createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
      uuid: vi.fn(() => 'generated-id'),
      now: vi.fn(() => new Date('2026-06-11T00:00:00.000Z')),
      userIdService: {
        ensureUserExists: vi.fn(),
        getCurrentDatabaseUserId: vi.fn(() => null),
        getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
      }
    });

  const withPair = (transactions: Transaction[] = linkedPair()) => createStorage({
    [STORAGE_KEYS.ACCOUNTS]: [
      baseAccount({ id: 'acct-a', currency: 'GBP' }),
      baseAccount({ id: 'acct-b', currency: 'GBP' }),
      baseAccount({ id: 'acct-c', currency: 'GBP' })
    ],
    [STORAGE_KEYS.TRANSACTIONS]: transactions,
    [STORAGE_KEYS.CATEGORIES]: transferCategories
  });

  it('moves the counterpart: same row, new account, both sides re-filed', async () => {
    const storage = withPair();
    const result = await buildService(storage).repointTransfer('src', 'acct-c');

    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    const byId = new Map(stored.map(t => [t.id, t]));

    // The SAME row moved — nothing was created and nothing removed.
    expect(stored).toHaveLength(2);
    expect(result.displaced).toEqual({ kind: 'moved', fromAccountId: 'acct-b' });
    expect(byId.get('cp')?.accountId).toBe('acct-c');

    // Each side's To/From names the OTHER account. This is the whole rule.
    expect(byId.get('src')?.category).toBe('tofrom-c');
    expect(byId.get('cp')?.category).toBe('tofrom-a');
    expect(byId.get('src')?.transferAccountId).toBe('acct-c');
    expect(byId.get('cp')?.transferAccountId).toBe('acct-a');

    // The link is intact, both ways round.
    expect(byId.get('src')?.linkedTransferId).toBe('cp');
    expect(byId.get('cp')?.linkedTransferId).toBe('src');
  });

  it('leaves amounts and dates exactly as they were', async () => {
    const storage = withPair();
    await buildService(storage).repointTransfer('src', 'acct-c');

    const byId = new Map((storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[]).map(t => [t.id, t]));
    expect(byId.get('src')?.amount).toBe(-500);
    expect(byId.get('cp')?.amount).toBe(500);
    expect(byId.get('src')?.date).toEqual(new Date('2026-06-10T00:00:00.000Z'));
    expect(byId.get('cp')?.date).toEqual(new Date('2026-06-10T00:00:00.000Z'));
    expect(byId.get('cp')?.description).toBe('TRANSFER OUT');
  });

  it('takes the money with the row: the old account down by what the new one is up by', async () => {
    const storage = withPair();
    await buildService(storage).repointTransfer('src', 'acct-c');

    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    const balance = (id: string): number => accounts.find(a => a.id === id)?.balance ?? NaN;
    expect(balance('acct-b')).toBe(100 - 500);
    expect(balance('acct-c')).toBe(100 + 500);
    // The row being edited never moved, so its account never did either.
    expect(balance('acct-a')).toBe(100);
  });

  it('re-files without moving money when the target has not changed', async () => {
    // The case that makes it safe to send after the row's OWN account moved:
    // the counterpart is already in the right place, only its category is stale.
    const stale = linkedPair();
    stale[0] = { ...stale[0], accountId: 'acct-c' };
    const storage = withPair(stale);
    await buildService(storage).repointTransfer('src', 'acct-b');

    const byId = new Map((storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[]).map(t => [t.id, t]));
    expect(byId.get('cp')?.category).toBe('tofrom-c');
    expect(byId.get('cp')?.accountId).toBe('acct-b');
    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts.every(a => a.balance === 100)).toBe(true);
  });

  it('releases the displaced row where it is, and creates a fresh other side', async () => {
    const storage = withPair();
    const result = await buildService(storage).repointTransfer('src', 'acct-c', 'release');

    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    const byId = new Map(stored.map(t => [t.id, t]));

    // The real row stays put, stripped of everything that made it a transfer.
    expect(byId.get('cp')).toMatchObject({
      accountId: 'acct-b', amount: 500, category: '', type: 'income', needsReview: true
    });
    expect(byId.get('cp')?.linkedTransferId).toBeUndefined();
    expect(byId.get('cp')?.transferAccountId).toBeUndefined();
    expect(result.displaced.kind).toBe('released');

    // A brand-new other side in the target, linked both ways.
    expect(byId.get('generated-id')).toMatchObject({
      accountId: 'acct-c', amount: 500, type: 'transfer', linkedTransferId: 'src'
    });
    expect(byId.get('src')?.linkedTransferId).toBe('generated-id');

    // Balances: the released row did not move, so only the target changes.
    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts.find(a => a.id === 'acct-b')?.balance).toBe(100);
    expect(accounts.find(a => a.id === 'acct-c')?.balance).toBe(600);
  });

  it('deletes the displaced row, reversing its account, and creates a fresh other side', async () => {
    const storage = withPair();
    const result = await buildService(storage).repointTransfer('src', 'acct-c', 'delete');

    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(stored.find(t => t.id === 'cp')).toBeUndefined();
    expect(result.displaced).toEqual({
      kind: 'deleted', id: 'cp', accountId: 'acct-b', amount: 500
    });

    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts.find(a => a.id === 'acct-b')?.balance).toBe(100 - 500);
    expect(accounts.find(a => a.id === 'acct-c')?.balance).toBe(100 + 500);
  });

  it('refuses a row that is not half of a linked transfer, writing nothing', async () => {
    const unlinked = [baseTransaction({ id: 'lone', accountId: 'acct-a', amount: -500 })];
    const storage = withPair(unlinked);
    await expect(buildService(storage).repointTransfer('lone', 'acct-c'))
      .rejects.toThrow(/not half of a linked transfer/);
    const accounts = storage.snapshot(STORAGE_KEYS.ACCOUNTS) as Account[];
    expect(accounts.every(a => a.balance === 100)).toBe(true);
  });

  it('refuses a pair that no longer names each other', async () => {
    const stale = linkedPair();
    stale[1] = { ...stale[1], linkedTransferId: 'someone-else' };
    const storage = withPair(stale);
    await expect(buildService(storage).repointTransfer('src', 'acct-c'))
      .rejects.toThrow(/not linked to each other any more/);
  });

  it('refuses to point a transfer at the account it already sits in', async () => {
    const storage = withPair();
    await expect(buildService(storage).repointTransfer('src', 'acct-a'))
      .rejects.toThrow(/two different accounts/);
  });

  it('refuses when the other half is a split LINE', async () => {
    const legPair = linkedPair();
    legPair[0] = { ...legPair[0], linkedTransferSplitId: 'split-line-1' };
    const storage = withPair(legPair);
    await expect(buildService(storage).repointTransfer('src', 'acct-c'))
      .rejects.toThrow(/one line of a split/);
  });

  it('refuses across currencies, writing nothing', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [
        baseAccount({ id: 'acct-a', currency: 'GBP' }),
        baseAccount({ id: 'acct-b', currency: 'GBP' }),
        baseAccount({ id: 'acct-c', currency: 'USD' })
      ],
      [STORAGE_KEYS.TRANSACTIONS]: linkedPair(),
      [STORAGE_KEYS.CATEGORIES]: transferCategories
    });
    await expect(buildService(storage).repointTransfer('src', 'acct-c'))
      .rejects.toThrow(/different currencies.*GBP and USD/);
    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(stored.find(t => t.id === 'cp')?.accountId).toBe('acct-b');
  });
});

/**
 * Deleting one leg of a transfer must leave the survivor UNLINKED.
 *
 * The cloud gets this from transactions_linked_transfer_id_fkey (ON DELETE SET
 * NULL). Browser storage has to do it by hand, and until this was fixed it did
 * not — the survivor kept a pointer to a row that no longer existed, so the
 * editor went on refusing to move it and the register went on offering to jump
 * to a transaction that was gone.
 */
describe('DataService deleteTransaction unlinks the survivor (local mode)', () => {
  it('clears the dangling link and leaves everything else alone', async () => {
    const storage = createStorage({
      [STORAGE_KEYS.ACCOUNTS]: [baseAccount({ id: 'acct-a' }), baseAccount({ id: 'acct-b' })],
      [STORAGE_KEYS.TRANSACTIONS]: [
        baseTransaction({
          id: 'src', accountId: 'acct-a', amount: -500, type: 'transfer',
          category: 'tofrom-b', transferAccountId: 'acct-b', linkedTransferId: 'cp'
        }),
        baseTransaction({
          id: 'cp', accountId: 'acct-b', amount: 500, type: 'transfer',
          category: 'tofrom-a', transferAccountId: 'acct-a', linkedTransferId: 'src'
        })
      ],
      [STORAGE_KEYS.CATEGORIES]: []
    });
    const service = createDataService({
      isSupabaseConfigured: () => false,
      storageAdapter: storage,
      logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
      uuid: vi.fn(() => 'generated-id'),
      now: vi.fn(() => new Date('2026-06-11T00:00:00.000Z')),
      userIdService: {
        ensureUserExists: vi.fn(),
        getCurrentDatabaseUserId: vi.fn(() => null),
        getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
      }
    });

    await service.deleteTransaction('cp');

    const stored = storage.snapshot(STORAGE_KEYS.TRANSACTIONS) as Transaction[];
    expect(stored).toHaveLength(1);
    const survivor = stored[0];
    expect(survivor.id).toBe('src');
    // THE FIX: the link is gone, so the row is re-pointable again.
    expect(survivor.linkedTransferId).toBeUndefined();
    // …and nothing else is: it is an UNMATCHED leg, which is a real state with
    // a repair flow, not something to re-type on the user's behalf.
    expect(survivor.type).toBe('transfer');
    expect(survivor.category).toBe('tofrom-b');
    expect(survivor.transferAccountId).toBe('acct-b');
    expect(survivor.amount).toBe(-500);
  });
});

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

/**
 * The realtime block's one door.
 *
 * The provider used to open its account channel through a second service and
 * hold two handles; it now passes `onAccountUpdate` to this method and holds
 * one. That makes the routing below load-bearing in a way it was not before —
 * nothing else proves the account channel is opened at all, because the suite
 * that covers the provider stubs this method out entirely.
 *
 * The services are spied rather than injected: what is under test is the
 * DEFAULT wiring the app runs with, not a double's ability to be called.
 */
describe('DataService.subscribeToUpdates', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };

  const cloudService = () => createDataService({
    isSupabaseConfigured: () => true,
    storageAdapter: createStorage(),
    logger,
    userIdService: {
      ensureUserExists: vi.fn(),
      getCurrentDatabaseUserId: vi.fn(() => 'db-user-1'),
      getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-1', databaseId: 'db-user-1' }))
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens both channels for the resolved owner, and one handle closes both', () => {
    const closeAccounts = vi.fn();
    const closeTransactions = vi.fn();
    const accounts = vi.spyOn(AccountService, 'subscribeToAccounts').mockReturnValue(closeAccounts);
    const transactions = vi.spyOn(TransactionService, 'subscribeToTransactions')
      .mockReturnValue(closeTransactions);

    const onAccountUpdate = vi.fn();
    const onTransactionUpdate = vi.fn();
    const stop = cloudService().subscribeToUpdates({ onAccountUpdate, onTransactionUpdate });

    // The owner is the id the seam resolved for itself — never one a caller
    // passed in — and each callback reaches its OWN channel. A swap here would
    // reload the accounts on a transaction event and nothing on an account one.
    expect(accounts).toHaveBeenCalledWith('db-user-1', onAccountUpdate);
    expect(transactions).toHaveBeenCalledWith('db-user-1', onTransactionUpdate);

    // One handle, both channels: the provider registers exactly this function
    // as its teardown, and a channel it does not close outlives the login.
    stop();
    expect(closeAccounts).toHaveBeenCalledTimes(1);
    expect(closeTransactions).toHaveBeenCalledTimes(1);
  });

  it('opens only what it was asked for', () => {
    const accounts = vi.spyOn(AccountService, 'subscribeToAccounts').mockReturnValue(vi.fn());
    const transactions = vi.spyOn(TransactionService, 'subscribeToTransactions')
      .mockReturnValue(vi.fn());

    cloudService().subscribeToUpdates({ onTransactionUpdate: vi.fn() });

    expect(transactions).toHaveBeenCalledTimes(1);
    expect(accounts).not.toHaveBeenCalled();
  });

  it('opens nothing, and still hands back a handle, when no owner is resolved', () => {
    const accounts = vi.spyOn(AccountService, 'subscribeToAccounts').mockReturnValue(vi.fn());
    const transactions = vi.spyOn(TransactionService, 'subscribeToTransactions')
      .mockReturnValue(vi.fn());

    // B-8: an engine with nothing to listen to answers with a no-op rather than
    // with nothing at all. The provider stores it and calls it on cleanup.
    const service = createDataService({
      isSupabaseConfigured: () => true,
      storageAdapter: createStorage(),
      logger,
      userIdService: {
        ensureUserExists: vi.fn(),
        getCurrentDatabaseUserId: vi.fn(() => null),
        getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-1', databaseId: null }))
      }
    });

    const stop = service.subscribeToUpdates({
      onAccountUpdate: vi.fn(),
      onTransactionUpdate: vi.fn()
    });

    expect(accounts).not.toHaveBeenCalled();
    expect(transactions).not.toHaveBeenCalled();
    expect(typeof stop).toBe('function');
    expect(() => {
      stop();
      stop();
    }).not.toThrow();
  });
});

/**
 * Which writer a file goes to, and what it is given.
 *
 * This decision used to be made TWICE, in two React components, each reading
 * `isUsingSupabase` off the context and each holding its own Clerk token to
 * hand the cloud client. Both are now one call to the seam, so this is where
 * the fork lives and this is where it is tested: the components no longer have
 * an opinion to get wrong.
 *
 * Both writers are injected doubles. What they DO is already proved against
 * real behaviour elsewhere (transactionImportService.test.ts,
 * localTransactionImportService.test.ts, and the contract suite, which drives
 * the real device importer through a real store); what is at stake here is the
 * routing, the call shape, and the fact that a wrongly-routed statement is a
 * register that disagrees with a bank.
 */
describe('DataService.importTransactions (which writer gets the file)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };

  /** Two rows of an invented statement, as a parser hands them over. */
  const statement = (): Array<Omit<Transaction, 'id'>> => [
    {
      accountId: 'acct-1',
      amount: -12.75,
      date: new Date('2025-02-03T00:00:00.000Z'),
      description: 'DIRECT DEBIT THAMES WATER',
      category: 'bills',
      type: 'expense'
    },
    {
      accountId: 'acct-1',
      amount: 312.75,
      date: new Date('2025-02-04T00:00:00.000Z'),
      description: 'TWO WAY SWEEP IN',
      category: 'transfer',
      type: 'income'
    }
  ];

  const landed = (rows: ReadonlyArray<unknown>) => ({
    inserted: rows.length,
    alreadyPresent: 0,
    total: rows.length,
    complete: true as const
  });

  const cloudClient = () => ({
    setAuthTokenProvider: vi.fn(),
    importInChunks: vi.fn(async (_accountId: string, rows: ReadonlyArray<unknown>) => landed(rows))
  });

  const deviceWriter = () =>
    vi.fn(async (_accountId: string, rows: ReadonlyArray<unknown>) => landed(rows));

  const resolvedOwner = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => 'db-user-1' as string | null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-1', databaseId: 'db-user-1' }))
  };
  const noOwner = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
  };

  afterEach(() => {
    // The registry is module state shared with every other suite in this file.
    registerSupabaseTokenGetter(null);
  });

  it('signed in: posts the file through the chunked cloud client, and nothing goes to the device', async () => {
    const client = cloudClient();
    const device = deviceWriter();
    const service = createDataService({
      isSupabaseConfigured: () => true,
      userIdService: resolvedOwner,
      storageAdapter: createStorage(),
      logger,
      bulkImportService: client,
      localBulkImport: device
    });
    const rows = statement();

    await service.importTransactions('acct-1', rows);

    expect(client.importInChunks).toHaveBeenCalledTimes(1);
    expect(client.importInChunks).toHaveBeenCalledWith('acct-1', rows, {});
    expect(device).not.toHaveBeenCalled();
  });

  it('installs the session token on the client BEFORE the first chunk is posted', async () => {
    // Order is the whole point: the client posts with whatever provider it is
    // holding, so installing one after the call would authenticate the SECOND
    // import of a session and 401 the first.
    const order: string[] = [];
    const client = {
      setAuthTokenProvider: vi.fn(() => { order.push('token'); }),
      importInChunks: vi.fn(async (_accountId: string, rows: ReadonlyArray<unknown>) => {
        order.push('post');
        return landed(rows);
      })
    };
    const service = createDataService({
      isSupabaseConfigured: () => true,
      userIdService: resolvedOwner,
      storageAdapter: createStorage(),
      logger,
      bulkImportService: client
    });

    await service.importTransactions('acct-1', statement());

    expect(order).toEqual(['token', 'post']);
  });

  it('authenticates with the very token AuthContext registered for the session', async () => {
    // The relocation, end to end. The CSV wizard used to pass Clerk's own
    // `getToken` from a React hook; the seam takes the same session's token
    // from the registry AuthContext fills, so nothing in the UI has to know
    // that an import is authenticated at all.
    registerSupabaseTokenGetter(async () => 'jwt-from-the-session');
    const client = cloudClient();
    const service = createDataService({
      isSupabaseConfigured: () => true,
      userIdService: resolvedOwner,
      storageAdapter: createStorage(),
      logger,
      bulkImportService: client
    });

    await service.importTransactions('acct-1', statement());

    const provider = client.setAuthTokenProvider.mock.calls[0][0];
    expect(typeof provider).toBe('function');
    expect(await provider()).toBe('jwt-from-the-session');
  });

  it('on a device: writes through the atomic store import, with this service\'s own store and ids', async () => {
    // The store matters as much as the route. The device importer defaults to
    // the app's real adapter when handed nothing, so a service told to use a
    // different store must hand that store over — otherwise a demo import
    // would write the signed-out user's encrypted store instead.
    const client = cloudClient();
    const device = deviceWriter();
    const storage = createStorage();
    const service = createDataService({
      isSupabaseConfigured: () => false,
      userIdService: noOwner,
      storageAdapter: storage,
      logger,
      uuid: () => 'generated-id',
      bulkImportService: client,
      localBulkImport: device
    });
    const rows = statement();

    await service.importTransactions('acct-1', rows);

    expect(client.importInChunks).not.toHaveBeenCalled();
    expect(device).toHaveBeenCalledTimes(1);
    const [accountId, given, options] = device.mock.calls[0];
    expect(accountId).toBe('acct-1');
    expect(given).toBe(rows);
    expect(options?.uuid?.()).toBe('generated-id');
    await options?.store?.setMany?.([{ key: 'k', value: [1] }]);
    expect(storage.setMany).toHaveBeenCalledWith([{ key: 'k', value: [1] }]);
  });

  it('carries what the caller said about the rows to the writer that ran', async () => {
    // `source: 'ofx'` is what lets a re-posted chunk be refused instead of
    // paid for twice, and `onProgress` is what the progress bar is drawn from.
    // Both are the caller's statement about the rows, not the route's.
    const client = cloudClient();
    const service = createDataService({
      isSupabaseConfigured: () => true,
      userIdService: resolvedOwner,
      storageAdapter: createStorage(),
      logger,
      bulkImportService: client
    });
    const onProgress = vi.fn();

    await service.importTransactions('acct-1', statement(), { source: 'ofx', onProgress });

    expect(client.importInChunks).toHaveBeenCalledWith(
      'acct-1',
      expect.any(Array),
      { source: 'ofx', onProgress }
    );
  });

  it('hands the writer\'s answer back exactly as it came, prefix count and all', async () => {
    // B-9. The caller slices the rows it handed in at `inserted` to name the
    // payments that are missing, so a route that rounded this up — or lost the
    // sentence saying what stopped it — would report rows as landed that are
    // not in the account.
    const client = cloudClient();
    client.importInChunks.mockResolvedValueOnce({
      inserted: 1,
      alreadyPresent: 0,
      total: 2,
      complete: false,
      error: 'Import request failed (503)'
    });
    const service = createDataService({
      isSupabaseConfigured: () => true,
      userIdService: resolvedOwner,
      storageAdapter: createStorage(),
      logger,
      bulkImportService: client
    });

    const outcome = await service.importTransactions('acct-1', statement());

    expect(outcome).toEqual({
      inserted: 1,
      alreadyPresent: 0,
      total: 2,
      complete: false,
      error: 'Import request failed (503)'
    });
  });

  it('refuses rather than writing elsewhere when the store cannot write as one unit', async () => {
    // Unreachable in the app — the real adapter writes many keys as one — and
    // reachable from a test double that does not. Falling through to the
    // importer's default would put the rows in the app's real store while the
    // test watched an empty double.
    const client = cloudClient();
    const device = deviceWriter();
    const partialAdapter = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {})
    };
    const service = createDataService({
      isSupabaseConfigured: () => false,
      userIdService: noOwner,
      storageAdapter: partialAdapter,
      logger,
      bulkImportService: client,
      localBulkImport: device
    });

    const outcome = await service.importTransactions('acct-1', statement());

    expect(outcome).toEqual({
      inserted: 0,
      alreadyPresent: 0,
      total: 2,
      complete: false,
      error: 'This device cannot store the import as one piece, so nothing was written.'
    });
    expect(device).not.toHaveBeenCalled();
    expect(client.importInChunks).not.toHaveBeenCalled();
  });
});

describe('DataService backup and restore (which store the file comes from, and goes to)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };

  /**
   * A file, in the shape the format actually has. Nothing here is read by the
   * routing — it is handed straight to whichever engine answers — but a real
   * bundle keeps the test honest about what crosses the seam.
   */
  const bundle = () => buildBackupBundle({
    sourceUserId: 'source-login',
    exportedAt: '2026-03-04T10:00:00.000Z',
    data: {
      accounts: [{ id: 'acct-1', name: 'Everyday', type: 'current', balance: '10.00' }],
      transactions: [
        { id: 'txn-1', account_id: 'acct-1', amount: '-10.00', date: '2026-02-01', description: 'Shop' }
      ]
    },
    preferences: null
  });

  const cloudOutcome = {
    restored: [{ label: 'Accounts', rows: 1 }],
    accountsRelinked: 0,
    transactionsRelinked: 0,
    preferencesRestored: 0,
    preferencesFailure: null,
    danglingRefs: []
  };

  const deviceOutcome = { ...cloudOutcome, notStoredLocally: [] };

  const cloudEngine = () => ({
    userFinancialDataIsEmpty: vi.fn(async () => true),
    collectBackupBundle: vi.fn(async () => bundle()),
    restoreBackupBundle: vi.fn(async () => cloudOutcome),
    wipeUserFinancialData: vi.fn(async () => ({ accounts: 3, transactions: 51_000 }))
  });

  const deviceEngine = () => ({
    localFinancialDataIsEmpty: vi.fn(async () => true),
    collectLocalBackupBundle: vi.fn(async () => bundle()),
    restoreLocalBackupBundle: vi.fn(async () => deviceOutcome),
    wipeLocalFinancialData: vi.fn(async () => ({ accounts: 3, transactions: 12 }))
  });

  const signedIn = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => 'db-user-1' as string | null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-1', databaseId: 'db-user-1' }))
  };
  const signedOut = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
  };

  const service = (
    options: { signedIn: boolean; cloud: ReturnType<typeof cloudEngine>; device: ReturnType<typeof deviceEngine> }
  ) => createDataService({
    isSupabaseConfigured: () => options.signedIn,
    hasCloudSession: () => options.signedIn,
    userIdService: options.signedIn ? signedIn : signedOut,
    storageAdapter: createStorage(),
    logger,
    uuid: () => 'generated-1',
    cloudBackup: options.cloud,
    deviceBackup: options.device
  });

  describe('signed in', () => {
    it('asks the login whether it is empty, and never asks the browser', async () => {
      const cloud = cloudEngine();
      const device = deviceEngine();

      await expect(service({ signedIn: true, cloud, device }).financialDataIsEmpty()).resolves.toBe(true);

      expect(cloud.userFinancialDataIsEmpty).toHaveBeenCalledWith('db-user-1');
      expect(device.localFinancialDataIsEmpty).not.toHaveBeenCalled();
    });

    it('reads the backup out of the login, with BOTH ids the fourteen tables are keyed by', async () => {
      // Thirteen tables hang off the database id; recurring_transactions hangs
      // off the Clerk id. Resolving only one of them writes a file that is
      // missing a table and says nothing about it.
      const cloud = cloudEngine();
      const device = deviceEngine();
      const onProgress = vi.fn();

      await service({ signedIn: true, cloud, device }).collectBackup({ onProgress });

      expect(cloud.collectBackupBundle).toHaveBeenCalledTimes(1);
      expect(cloud.collectBackupBundle).toHaveBeenCalledWith(
        { databaseUserId: 'db-user-1', clerkUserId: 'clerk-1' },
        { onProgress }
      );
      expect(device.collectLocalBackupBundle).not.toHaveBeenCalled();
    });

    it('restores into the login, and says nothing was left behind', async () => {
      const cloud = cloudEngine();
      const device = deviceEngine();
      const onProgress = vi.fn();
      const file = bundle();

      const outcome = await service({ signedIn: true, cloud, device }).restoreBackup(file, { onProgress });

      expect(cloud.restoreBackupBundle).toHaveBeenCalledWith(file, 'db-user-1', { onProgress });
      expect(device.restoreLocalBackupBundle).not.toHaveBeenCalled();
      // A login holds every table the format carries. The empty list is that
      // statement — the dialog renders a warning when it is NOT empty.
      expect(outcome.notStoredLocally).toEqual([]);
      expect(outcome.restored).toEqual(cloudOutcome.restored);
    });
  });

  describe('on a device', () => {
    it('asks the browser, through THIS service\'s store', async () => {
      // The store matters as much as the route: the engine defaults to the
      // app's real adapter when handed nothing, so a service told to use
      // another store must hand that store over or it reads the wrong device.
      const cloud = cloudEngine();
      const device = deviceEngine();

      await expect(service({ signedIn: false, cloud, device }).financialDataIsEmpty()).resolves.toBe(true);

      expect(cloud.userFinancialDataIsEmpty).not.toHaveBeenCalled();
      const [options] = device.localFinancialDataIsEmpty.mock.calls[0];
      expect(typeof options.store.get).toBe('function');
      expect(typeof options.store.setMany).toBe('function');
    });

    it('reads the backup out of the browser, with no owner anywhere in sight', async () => {
      const cloud = cloudEngine();
      const device = deviceEngine();
      const onProgress = vi.fn();

      await service({ signedIn: false, cloud, device }).collectBackup({ onProgress });

      expect(cloud.collectBackupBundle).not.toHaveBeenCalled();
      const [options] = device.collectLocalBackupBundle.mock.calls[0];
      expect(options.onProgress).toBe(onProgress);
      expect(typeof options.store.setMany).toBe('function');
    });

    it('restores into the browser with this service\'s own id generator', async () => {
      // THE REMAP. Every row in a backup gets a fresh id on the way in, because
      // the primary keys in the file are unique across the whole store rather
      // than per owner — so a file restored anywhere but where it came from
      // carries ids belonging to somebody else's rows. Handing the engine this
      // service's generator is what makes that operation reproducible; the
      // engine's own default is crypto.randomUUID, which is what this resolves
      // to in the app.
      const cloud = cloudEngine();
      const device = deviceEngine();
      const onProgress = vi.fn();
      const file = bundle();

      const outcome = await service({ signedIn: false, cloud, device }).restoreBackup(file, { onProgress });

      expect(cloud.restoreBackupBundle).not.toHaveBeenCalled();
      expect(device.restoreLocalBackupBundle).toHaveBeenCalledTimes(1);
      const [restored, options] = device.restoreLocalBackupBundle.mock.calls[0];
      expect(restored).toBe(file);
      expect(options.onProgress).toBe(onProgress);
      expect(typeof options.store.setMany).toBe('function');
      expect(typeof options.newId).toBe('function');
      expect(options.newId()).toBe('generated-1');
      expect(outcome.notStoredLocally).toEqual([]);
    });
  });

  describe('a signed-in session whose database id has not resolved yet', () => {
    const pending = (cloud: ReturnType<typeof cloudEngine>, device: ReturnType<typeof deviceEngine>) =>
      createDataService({
        isSupabaseConfigured: () => true,
        hasCloudSession: () => true,
        userIdService: pendingUserIdService(),
        storageAdapter: createStorage(),
        logger,
        cloudBackup: cloud,
        deviceBackup: device
      });

    const NOTHING_TO_READ =
      'This session has no database identity yet, so there is nothing to read. Reload the page and try again.';
    const NOT_SCOPED =
      'This session has no database identity yet, so a restore cannot be scoped to your login. Reload the page and try again.';

    it('refuses to build a file out of whatever the browser happens to hold', async () => {
      // The failure this closes is not an error message, it is a person keeping
      // a file they believe holds their ledger and finding demo data in it.
      const cloud = cloudEngine();
      const device = deviceEngine();

      expect(await refusalMessage(pending(cloud, device).collectBackup())).toBe(NOTHING_TO_READ);
      expect(cloud.collectBackupBundle).not.toHaveBeenCalled();
      expect(device.collectLocalBackupBundle).not.toHaveBeenCalled();
    });

    it('refuses to answer "is it empty" rather than saying yes about the wrong store', async () => {
      // `true` here unlocks the restore button. Over a login full of data that
      // is the worst answer available.
      const cloud = cloudEngine();
      const device = deviceEngine();

      expect(await refusalMessage(pending(cloud, device).financialDataIsEmpty())).toBe(NOT_SCOPED);
      expect(cloud.userFinancialDataIsEmpty).not.toHaveBeenCalled();
      expect(device.localFinancialDataIsEmpty).not.toHaveBeenCalled();
    });

    it('refuses to pour a file into browser storage the app will never read again', async () => {
      const cloud = cloudEngine();
      const device = deviceEngine();

      expect(await refusalMessage(pending(cloud, device).restoreBackup(bundle()))).toBe(NOT_SCOPED);
      expect(cloud.restoreBackupBundle).not.toHaveBeenCalled();
      expect(device.restoreLocalBackupBundle).not.toHaveBeenCalled();
    });
  });
});

describe('DataService.wipeAllFinancialData (which store gets erased, and how much of it)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };

  const cloudBackup = () => ({
    userFinancialDataIsEmpty: vi.fn(async () => true),
    collectBackupBundle: vi.fn(),
    restoreBackupBundle: vi.fn(),
    wipeUserFinancialData: vi.fn(async () => ({ accounts: 0, transactions: 0 }))
  });

  const deviceBackup = () => ({
    localFinancialDataIsEmpty: vi.fn(async () => true),
    collectLocalBackupBundle: vi.fn(),
    restoreLocalBackupBundle: vi.fn(),
    wipeLocalFinancialData: vi.fn(async () => ({ accounts: 3, transactions: 12 }))
  });

  const moneyEngine = () => ({
    wipeCloudData: vi.fn(async () => {}),
    importToCloud: vi.fn(async () => {}),
    importToLocalStorage: vi.fn(async () => {})
  });

  const signedIn = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => 'db-user-1' as string | null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-1', databaseId: 'db-user-1' }))
  };
  const signedOut = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
  };

  /** A client the wipe is pointed at. Never called here — the engines are doubles. */
  const client = { from: vi.fn() };

  const service = (options: {
    signedIn: boolean;
    cloud: ReturnType<typeof cloudBackup>;
    device: ReturnType<typeof deviceBackup>;
    money: ReturnType<typeof moneyEngine>;
    storage?: ReturnType<typeof createStorage>;
  }) => createDataService({
    isSupabaseConfigured: () => options.signedIn,
    hasCloudSession: () => options.signedIn,
    userIdService: options.signedIn ? signedIn : signedOut,
    storageAdapter: options.storage ?? createStorage(),
    logger,
    uuid: () => 'generated-1',
    cloudBackup: options.cloud,
    deviceBackup: options.device,
    msMoneyEngine: options.money,
    cloudClient: client
  });

  it('signed in: erases in chunks FIRST, then sweeps the tables the chunks cannot reach', async () => {
    // THE ORDER IS THE TEST. The chunked pass is the one with the rows in it,
    // and it is chunked because one `DELETE FROM transactions` over 51,000 rows
    // is cancelled by the database's own statement timeout. The RPC's deletes
    // are one statement per table — exactly that shape — so it has to run when
    // there is nothing large left to do. Reversed, this is the original bug.
    //
    // And it has to run at all: the chunked pass leaves the four tables keyed
    // only by the user (dismissed suggestions, dashboard layouts, widget
    // preferences, notifications), nothing cascades them away, and a backup
    // carries every one of them — so a restore onto the survivors collides
    // part-way through, in front of somebody who has just erased their login.
    const order: string[] = [];
    const cloud = cloudBackup();
    const device = deviceBackup();
    const money = moneyEngine();
    money.wipeCloudData.mockImplementation(async () => { order.push('chunked'); });
    cloud.wipeUserFinancialData.mockImplementation(async () => {
      order.push('sweep');
      return { accounts: 0, transactions: 0 };
    });

    await service({ signedIn: true, cloud, device, money }).wipeAllFinancialData();

    expect(order).toEqual(['chunked', 'sweep']);
    expect(device.wipeLocalFinancialData).not.toHaveBeenCalled();
  });

  it('points the chunked pass at the authenticated client and the owner it resolved itself', async () => {
    const cloud = cloudBackup();
    const device = deviceBackup();
    const money = moneyEngine();
    const onProgress = vi.fn();

    await service({ signedIn: true, cloud, device, money }).wipeAllFinancialData({ onProgress });

    expect(money.wipeCloudData).toHaveBeenCalledTimes(1);
    expect(money.wipeCloudData).toHaveBeenCalledWith(client, 'db-user-1', { onProgress });
    // The phrase is the implementation's, not the caller's: the screen holds
    // the confirmation and will not enable its button without it.
    expect(cloud.wipeUserFinancialData).toHaveBeenCalledWith('DELETE EVERYTHING', 'db-user-1');
  });

  it('says the phrase the database and the device engine both demand — the same one', async () => {
    // Three copies of one string live in this codebase: the literal on this
    // class, the SQL function's own check, and LOCAL_WIPE_CONFIRMATION. That is
    // safe ONLY because both of the others CHECK it, so a drift refuses every
    // wipe rather than quietly weakening one. Proved here against the constant
    // the device engine exports, on both branches, rather than assumed.
    const onDevice = deviceBackup();
    const onLogin = cloudBackup();

    await service({ signedIn: false, cloud: cloudBackup(), device: onDevice, money: moneyEngine() })
      .wipeAllFinancialData();
    await service({ signedIn: true, cloud: onLogin, device: deviceBackup(), money: moneyEngine() })
      .wipeAllFinancialData();

    expect(onDevice.wipeLocalFinancialData.mock.calls[0][0]).toBe(LOCAL_WIPE_CONFIRMATION);
    expect(onLogin.wipeUserFinancialData.mock.calls[0][0]).toBe(LOCAL_WIPE_CONFIRMATION);
  });

  it('on a device: erases through this service\'s own store, and asks the cloud nothing', async () => {
    // The store matters as much as the route, for the reason the bulk import
    // sets out: the engine defaults to the app's real adapter when handed
    // nothing, so a demo session told to use a different store must hand that
    // store over or it erases the wrong one.
    const cloud = cloudBackup();
    const device = deviceBackup();
    const money = moneyEngine();
    const storage = createStorage();

    await service({ signedIn: false, cloud, device, money, storage }).wipeAllFinancialData();

    expect(money.wipeCloudData).not.toHaveBeenCalled();
    expect(cloud.wipeUserFinancialData).not.toHaveBeenCalled();
    expect(device.wipeLocalFinancialData).toHaveBeenCalledTimes(1);
    const [, options] = device.wipeLocalFinancialData.mock.calls[0];
    await options?.store?.setMany?.([{ key: 'k', value: [] }]);
    expect(storage.setMany).toHaveBeenCalledWith([{ key: 'k', value: [] }]);
  });

  it('lets the failure through with its own sentence, so "run it again" can be offered', async () => {
    // The dialog prints this verbatim and adds the recovery beside it. A route
    // that wrapped it would replace the database's own words with its own.
    const cloud = cloudBackup();
    const device = deviceBackup();
    const money = moneyEngine();
    money.wipeCloudData.mockRejectedValueOnce(
      new Error('Failed while clearing transactions: canceling statement due to statement timeout')
    );

    expect(await refusalMessage(service({ signedIn: true, cloud, device, money }).wipeAllFinancialData()))
      .toBe('Failed while clearing transactions: canceling statement due to statement timeout');
    // And it stopped: the sweep must not run over a half-finished chunked pass
    // and report success.
    expect(cloud.wipeUserFinancialData).not.toHaveBeenCalled();
  });

  it('refuses while a signed-in session is still resolving, rather than erasing the browser', async () => {
    // Before the seam, this state fell through to the browser's store: the
    // button reported success, the login was untouched, and the person was
    // told their data was gone when it was not.
    const cloud = cloudBackup();
    const device = deviceBackup();
    const money = moneyEngine();
    const pending = createDataService({
      isSupabaseConfigured: () => true,
      hasCloudSession: () => true,
      userIdService: pendingUserIdService(),
      storageAdapter: createStorage(),
      logger,
      cloudBackup: cloud,
      deviceBackup: device,
      msMoneyEngine: money,
      cloudClient: client
    });

    expect(await refusalMessage(pending.wipeAllFinancialData())).toBe(
      'This session has no database identity yet, so there is nothing here that can safely be erased. Reload the page and try again.'
    );
    expect(money.wipeCloudData).not.toHaveBeenCalled();
    expect(cloud.wipeUserFinancialData).not.toHaveBeenCalled();
    expect(device.wipeLocalFinancialData).not.toHaveBeenCalled();
  });
});

describe('DataService.importMsMoney (where a whole .mny file lands)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };

  /**
   * A parsed .mny file, invented. Nothing here is read by the routing — it is
   * handed straight to whichever writer answers — but the real shape keeps the
   * test honest about what crosses the seam.
   */
  const migration = () => ({
    accounts: [],
    categories: [],
    transactions: [],
    transactionSplits: [],
    summary: {
      accounts: { total: 0, open: 0, closed: 0, investmentCashPairs: 0 },
      categories: { subs: 0, details: 0, hidden: 0 },
      transactions: { imported: 0, standalone: 0, transfers: 0, splitTransactions: 0, splitLines: 0 },
      simplifications: []
    }
  });

  const moneyEngine = () => ({
    wipeCloudData: vi.fn(async () => {}),
    importToCloud: vi.fn(async () => {}),
    importToLocalStorage: vi.fn(async () => {})
  });

  const signedIn = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => 'db-user-1' as string | null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: 'clerk-1', databaseId: 'db-user-1' }))
  };
  const signedOut = {
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => null),
    getCurrentUserIds: vi.fn(() => ({ clerkId: null, databaseId: null }))
  };

  const client = { from: vi.fn() };

  const service = (options: {
    signedIn: boolean;
    money: ReturnType<typeof moneyEngine>;
    storage?: ReturnType<typeof createStorage>;
  }) => createDataService({
    isSupabaseConfigured: () => options.signedIn,
    hasCloudSession: () => options.signedIn,
    userIdService: options.signedIn ? signedIn : signedOut,
    storageAdapter: options.storage ?? createStorage(),
    logger,
    uuid: () => 'generated-1',
    msMoneyEngine: options.money,
    cloudClient: client
  });

  it('signed in: writes the file into the login, with the owner it resolved itself', async () => {
    const money = moneyEngine();
    const file = migration();
    const onProgress = vi.fn();

    await service({ signedIn: true, money }).importMsMoney(file, { onProgress });

    expect(money.importToLocalStorage).not.toHaveBeenCalled();
    expect(money.importToCloud).toHaveBeenCalledTimes(1);
    const [given, handedClient, userId, newId, options] = money.importToCloud.mock.calls[0];
    expect(given).toBe(file);
    expect(handedClient).toBe(client);
    expect(userId).toBe('db-user-1');
    // An id MAKER, and this service's own: the plan mints one per row, and a
    // test that cannot hold them still cannot assert on a plan.
    expect(newId()).toBe('generated-1');
    expect(options).toEqual({ onProgress });
  });

  it('signed out: writes it into this browser, through this service\'s own store', async () => {
    const money = moneyEngine();
    const storage = createStorage();
    const file = migration();

    await service({ signedIn: false, money, storage }).importMsMoney(file);

    expect(money.importToCloud).not.toHaveBeenCalled();
    expect(money.importToLocalStorage).toHaveBeenCalledTimes(1);
    const [given, keys, options] = money.importToLocalStorage.mock.calls[0];
    expect(given).toBe(file);
    // The keys the app's own readers look under. The version of this that
    // wrote its own key names reported success and changed nothing anybody saw.
    expect(keys).toBe(STORAGE_KEYS);
    await options?.store?.setMany?.([{ key: 'k', value: [] }]);
    expect(storage.setMany).toHaveBeenCalledWith([{ key: 'k', value: [] }]);
  });

  it('refuses while a signed-in session is still resolving, rather than migrating into the browser', async () => {
    // The worst version of the wrong-store bug in the whole app: thirty years
    // of somebody's history written where their signed-in app will never read
    // it again, the page reloading, and nothing of it there. It said it worked.
    const money = moneyEngine();
    const pending = createDataService({
      isSupabaseConfigured: () => true,
      hasCloudSession: () => true,
      userIdService: pendingUserIdService(),
      storageAdapter: createStorage(),
      logger,
      msMoneyEngine: money,
      cloudClient: client
    });

    expect(await refusalMessage(pending.importMsMoney(migration()))).toBe(
      'This session has no database identity yet, so a migration cannot be written to your login. Reload the page and try again.'
    );
    expect(money.importToCloud).not.toHaveBeenCalled();
    expect(money.importToLocalStorage).not.toHaveBeenCalled();
  });

  it('lets the importer\'s own failure through, because the dialog renders it', async () => {
    const money = moneyEngine();
    money.importToCloud.mockRejectedValueOnce(
      new Error('Import failed while writing transactions: duplicate key value violates unique constraint')
    );

    expect(await refusalMessage(service({ signedIn: true, money }).importMsMoney(migration())))
      .toBe('Import failed while writing transactions: duplicate key value violates unique constraint');
  });
});

/**
 * What the engine says it can do — the descriptor that retired the flag.
 *
 * `isUsingSupabase` was one boolean answering four unrelated questions: how
 * many writes may be in flight (the payee rename divides its work by it),
 * whether to open a realtime subscription, where a backup goes, and whether a
 * sentence says "login" or "device". Every one of those readings is now a named
 * field, and this is where the mapping from THIS engine's state to those fields
 * is pinned.
 *
 * The contract suite already asserts the SHAPE against the browser-storage
 * harness — five fields, a batch size of at least one, a session that is one of
 * three things. What it cannot reach is the cloud arrangement or the pending
 * one, because that harness has no cloud by construction. Those are the two
 * that matter most: 8 concurrent writes against a store that would lose updates
 * at 2, and the "still connecting" state that must not be mistaken for a
 * device.
 */
describe('DataService.capabilities (what this engine says it can do)', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };

  const owner = (databaseId: string | null) => ({
    ensureUserExists: vi.fn(),
    getCurrentDatabaseUserId: vi.fn(() => databaseId),
    getCurrentUserIds: vi.fn(() => ({ clerkId: databaseId ? 'clerk-1' : null, databaseId }))
  });

  const service = (options: { configured: boolean; clerkSession: boolean; databaseId: string | null }) =>
    createDataService({
      isSupabaseConfigured: () => options.configured,
      hasCloudSession: () => options.clerkSession,
      userIdService: owner(options.databaseId),
      logger
    });

  it('reports a login that is resolved as a cloud edition, eight writes wide', () => {
    const capabilities = service({ configured: true, clerkSession: true, databaseId: 'db-user-1' })
      .capabilities();

    expect(capabilities).toEqual({
      edition: 'cloud',
      session: 'ready',
      realtime: true,
      maxConcurrentWrites: 8,
      backupTarget: 'login'
    });
  });

  it('reports a session that is still connecting, and refuses to call it a device', () => {
    // The state with the data loss behind it: signed in, no database id yet.
    // 'anonymous' here would tell the restore dialog it was looking at a device
    // and let a file be poured into browser storage the signed-in app will
    // never read again. The backup target stays 'device' — there is no login to
    // name — which is why the dialog checks the SESSION before the target.
    const capabilities = service({ configured: true, clerkSession: true, databaseId: null })
      .capabilities();

    expect(capabilities.session).toBe('connecting');
    expect(capabilities.backupTarget).toBe('device');
    expect(capabilities.realtime).toBe(false);
  });

  it('reports one write at a time when there is no cloud behind it', () => {
    // Not a slow default — a correct one. Browser storage re-reads and
    // re-persists a whole collection per write, so two in flight is a
    // lost-update race in which the second silently overwrites the first.
    const capabilities = service({ configured: false, clerkSession: false, databaseId: null })
      .capabilities();

    expect(capabilities).toEqual({
      edition: 'device',
      session: 'anonymous',
      realtime: false,
      maxConcurrentWrites: 1,
      backupTarget: 'device'
    });
  });

  it('is not a login when the id is stale and the client is gone', () => {
    // A cached database id with no configured client is not a login: nothing
    // can be read from or written to one. Every field follows `isSupabaseReady`
    // rather than the id alone, so the backup target cannot say 'login' while
    // the store behind it is a browser.
    const capabilities = service({ configured: false, clerkSession: false, databaseId: 'db-user-1' })
      .capabilities();

    expect(capabilities.edition).toBe('device');
    expect(capabilities.backupTarget).toBe('device');
    // The owner IS resolved, and the session says so — it is the store that is
    // not a cloud one.
    expect(capabilities.session).toBe('ready');
  });
});
