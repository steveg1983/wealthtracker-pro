/**
 * The DataPort contract suite.
 *
 * One `describe` block, run once per implementation of the seam. It is written
 * against the interface and the app's own types ONLY — no storage keys, no
 * client, no service names — so the local edition can run this same file
 * unchanged by supplying a harness that builds its own store. That
 * reusability, not the assertions, is the deliverable: it is what makes
 * "the local edition behaves like the cloud one" a thing that is proved rather
 * than hoped.
 *
 * What is pinned here is the set of rules that today exist in exactly one
 * implementation and would otherwise be re-derived (or quietly not) by the
 * next one:
 *
 *  - a refused split leaves the store exactly as it was;
 *  - a split line that is half of a transfer may move and be re-memoed, and
 *    nothing else, with the refusal said in words a user can act on;
 *  - transfer pairing invariants, in the order they are judged;
 *  - the category-merge guards, source before target — the order decides which
 *    sentence the user sees;
 *  - every money movement lands on the penny;
 *  - a budget survives a create and an edit to the penny, is refused by name
 *    when it is not there, and is not an error to delete twice — and lands
 *    under the owner the implementation resolved for itself, never another;
 *  - a goal starts at the money already put by rather than at zero, and no
 *    write through the seam carries one past its own target;
 *  - the reconcile-sweep, dismissal pruning and dismissal idempotence;
 *  - and the DECLARED divergences (D-7, M-1), asserted per engine so that a
 *    difference between implementations is recorded rather than discovered.
 *
 * This file is not itself a test: it exports a function. `*.contract.test.ts`
 * files call it.
 */

import { describe, it, expect } from 'vitest';
import type { BackupBundle, BackupEntity, BackupRow, DataPort } from '../dataPort';
import type {
  Account,
  Budget,
  Category,
  Goal,
  SuggestionDismissal,
  Transaction,
  TransactionSplit
} from '../../../types';

/**
 * Which implementation is under test. Divergences are declared against these
 * names, so adding an engine means adding a row to the tables below and
 * finding out immediately which rules it does not yet keep.
 */
export type DataPortEngine = 'browser-storage' | 'supabase' | 'local-core';

/** The seed a test starts from. Plain app data; no engine words in it. */
export interface PortFixture {
  accounts?: Account[];
  transactions?: Transaction[];
  splits?: TransactionSplit[];
  categories?: Category[];
  budgets?: Budget[];
  goals?: Goal[];
  dismissals?: SuggestionDismissal[];
}

/**
 * What the store holds now, however it holds it. The harness reads this back
 * by whatever means fits its engine — a browser-storage snapshot, a set of
 * SELECTs — and the suite compares app-shaped values only.
 */
export interface PortStoreState {
  accounts: Account[];
  transactions: Transaction[];
  splits: TransactionSplit[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  dismissals: SuggestionDismissal[];
}

export interface DataPortUnderTest {
  port: DataPort;
  read(): Promise<PortStoreState>;
}

export interface DataPortContractHarness {
  engine: DataPortEngine;
  /** A fresh, isolated store seeded with the fixture. Never shared between tests. */
  create(fixture: PortFixture): Promise<DataPortUnderTest>;
  /**
   * A port whose STORE IS BROKEN — it refuses every read.
   *
   * Required, not optional, because the rule it proves cannot be proved any
   * other way: the boot's reads must resolve rather than reject, and a store
   * that always works never asks them the question. The boot effect has one
   * outer catch, and reaching it puts a full-page "Failed to load data" in
   * front of somebody whose ledger is fine.
   *
   * How the store is broken is the harness's business: an adapter that throws,
   * a database file that is not there, a connection pointed at nothing.
   */
  createUnreadable(): Promise<DataPort>;
}

/**
 * Every operation the seam names, written out where a RUNTIME check can walk
 * it.
 *
 * WHY A LIST AND NOT THE TYPE. `tsc -b` does not typecheck tests:
 * tsconfig.app.json excludes every `__tests__` directory and every `.test.ts`
 * and `.test.tsx` file, and eslint runs without a project. So the `DataPort`
 * annotation on a test double is documentation, not a proof: a double that
 * answers half the seam compiles, runs and passes, and the day a real
 * implementation is swapped in behind those same tests the missing half is a
 * `TypeError` in front of a user rather than a red line in a diff.
 *
 * What the list buys, in the two places it is used:
 *
 *  - here, that the engine under test really implements every operation it
 *    claims to (a contract suite run against a partial port proves nothing);
 *  - in AppContextBootThroughPort.test.tsx, that the stubbed seam the boot is
 *    proved against has EXACTLY these keys — no fewer, so an operation cannot
 *    join the seam while the one test that boots the app on a bare stub keeps
 *    passing without answering it, and no more, so the stub cannot drift into
 *    inventing a door the interface does not have.
 *
 * It is maintained by hand ON PURPOSE and in the same commit as the interface:
 * the list is the one place a person adding an operation has to say out loud
 * that they have added it. Grouped and ordered as `dataPort.ts` groups them, so
 * the two files can be read side by side.
 */
export const DATA_PORT_OPERATIONS: readonly (keyof DataPort)[] = [
  // Reads
  'listAccounts',
  'listClosedAccounts',
  'listTransactions',
  'loadBootTransactions',
  'getAccountBalances',
  'listTransactionSplits',
  'listTransactionSplitsFor',
  'listBudgets',
  'listGoals',
  'listCategories',
  'listSuggestionDismissals',
  // Account writes
  'createAccount',
  'updateAccount',
  'closeAccount',
  // Transaction writes
  'createTransaction',
  'updateTransaction',
  'deleteTransaction',
  'setTransactionsCleared',
  'applyCategoryToUncategorized',
  'confirmTransactionCategories',
  'setTransactionArchived',
  'archiveTransactionsBefore',
  'unarchiveAccount',
  // Bulk writes
  'importTransactions',
  // Transfer writes
  'linkTransferPair',
  'linkSplitLineTransfer',
  'unlinkTransfers',
  'repairClaimedTransfer',
  'createTransferCounterpart',
  // Split writes
  'setTransactionSplits',
  // Planning writes
  'createBudget',
  'updateBudget',
  'deleteBudget',
  'createGoal',
  'updateGoal',
  'deleteGoal',
  'createCategory',
  'createCategories',
  'updateCategory',
  'deleteCategory',
  'deleteUnusedCategories',
  'mergeCategories',
  // Dismissal writes
  'dismissSuggestion',
  'restoreSuggestion',
  // Backup lifecycle
  'financialDataIsEmpty',
  'collectBackup',
  'restoreBackup',
  'wipeAllFinancialData',
  // Migration
  'importMsMoney',
  // Lifecycle
  'initialize',
  'prepareCategories',
  'subscribeToUpdates',
  // What the engine can do
  'capabilities'
];

// ── Declared divergences ────────────────────────────────────────────────────
// Written as tables rather than as `if (engine === …)` scattered through the
// tests, so the whole difference between implementations can be read in one
// place — the way the crate's own differential specs do it.

/**
 * D-7 — a field outside `updateTransaction`'s honoured set. Every such field
 * has a dedicated operation, and the dedicated operation is the contract; what
 * the three engines do with it when it arrives on an update anyway differs.
 */
const UPDATE_OUTSIDE_ALLOW_LIST: Record<DataPortEngine, 'applies' | 'discards' | 'refuses'> = {
  'browser-storage': 'applies',
  supabase: 'discards',
  'local-core': 'refuses'
};

/**
 * M-1 — an amount with more than two decimal places. A penny is the smallest
 * thing a ledger can hold; the engines disagree about what to do when handed
 * something smaller.
 */
const SUB_PENNY_AMOUNT: Record<DataPortEngine, 'keeps' | 'rounds' | 'refuses'> = {
  'browser-storage': 'keeps',
  supabase: 'rounds',
  'local-core': 'refuses'
};

/**
 * B-1 — where a boot's transactions came from. The ROWS are the same question
 * for every engine; the provenance is not, and it is reported on the
 * boot-timing line rather than hidden, so it is declared here rather than
 * asserted equal.
 *
 * `snapshots` says whether the engine has a cache layer that can make a boot
 * legitimately fast. `reasonWhenUncached` is the words it must use when it does
 * not — never null, because a null there claims a snapshot stood.
 */
const BOOT_PROVENANCE: Record<DataPortEngine, { snapshots: boolean; reasonWhenUncached: string }> = {
  // No snapshot layer: it reads the one store it has, and says so.
  'browser-storage': { snapshots: false, reasonWhenUncached: 'local mode' },
  // Snapshot + delta, so a boot may legitimately report null.
  supabase: { snapshots: true, reasonWhenUncached: 'no cache' },
  // One store read, and honest about it — the rows are already on the device.
  'local-core': { snapshots: false, reasonWhenUncached: 'local mode' }
};

/**
 * B-2 — whether the engine can compute every account's balance itself.
 *
 * The cloud can (one RPC that usually answers BEFORE the transaction pages do,
 * which is the whole point of it); browser storage has no second engine to ask;
 * a local core may answer so fast the window closes to nothing. `empty` is a
 * declared "I don't know", never a map of zeros — see the test below for why
 * that distinction is load-bearing rather than pedantic.
 */
const SERVER_BALANCES: Record<DataPortEngine, 'empty' | 'answers'> = {
  'browser-storage': 'empty',
  supabase: 'answers',
  'local-core': 'answers'
};

/**
 * B-4 — what `prepareCategories` does with a store that has none.
 *
 * All three must hand back a usable set (a ledger with no categories has
 * nowhere to file anything), and that part is asserted equal. Where they differ
 * is whether the set they handed back is also IN the store afterwards, which
 * decides whether the next read sees the same list or the defaults again.
 *
 * `describes` is the sentence the test names itself with, so a new engine's row
 * is a claim someone has to write down rather than a boolean nobody reads.
 */
const PREPARE_CATEGORIES: Record<DataPortEngine, { describes: string; persists: boolean }> = {
  // Hands back the defaults and writes nothing: the browser's copy is a cache,
  // and a cache that invents its own contents is no longer a cache.
  'browser-storage': { describes: 'answers with the defaults and stores nothing', persists: false },
  // Migrates the list it was given (or the defaults) into per-user rows, and
  // remaps every reference to it in the same database transaction.
  supabase: { describes: 'migrates a set into the account and keeps it', persists: true },
  // Seeds its defaults into the one store it has; nothing to remap, ever.
  'local-core': { describes: 'seeds the defaults into the store', persists: true }
};

/**
 * B-3 — what "the owner" is, for an engine being asked to file a write under
 * one.
 *
 * The phrase differs so much between engines that asserting it equal would be
 * asserting a fiction: browser storage has no concept of an owner, the cloud
 * has a column and a policy, a device edition has itself. What is asserted
 * equal is the pair of rules underneath the phrase, and they are the ones that
 * decide whether somebody's budget survives the night — see the test below.
 */
const OWNERSHIP: Record<DataPortEngine, string> = {
  'browser-storage': 'one store and no owner at all',
  supabase: 'an owner the implementation resolves, stamped on the row and enforced by RLS',
  'local-core': 'the device itself'
};

/**
 * B-5 — where a new category's id is MADE.
 *
 * The caller uses the id it gets back on the very next line: as the value of the
 * select it just added an option to, and as the `parentId` of the children a
 * tree import creates in its second pass. So the part that is asserted equal is
 * that the id is final and usable at once. Where it comes from is not the same
 * question — a client mints a uuid, a database column defaults to one — and an
 * engine whose ids are allocated somewhere else entirely (a server that
 * renumbers on sync) would have to declare it here rather than discover it in a
 * register full of rows filed under an id that stopped existing.
 */
const ID_PROVENANCE: Record<DataPortEngine, string> = {
  'browser-storage': 'an id the client mints',
  supabase: 'an id the database column defaults to',
  'local-core': 'an id the client mints'
};

/**
 * B-6 — what a bulk prune does with the list it is handed.
 *
 * An engine that can see the whole ledger re-judges every row AGAINST IT AS IT
 * IS NOW, so a plan computed from a stale snapshot cannot destroy a category
 * somebody filed a transaction under in another tab a second ago; it therefore
 * deletes FEWER rows than it was asked to. Browser storage IS the snapshot it
 * would re-judge against — there is no second opinion available — so it does
 * what it is told.
 *
 * What every engine is held to, and what the test below asks in both branches:
 * the number it returns is the number of rows that ACTUALLY left. Not the size
 * of the request. The caller prints that figure ("pruned 40, kept 12 in use")
 * and re-reads the category set because of it.
 */
const BULK_PRUNE: Record<DataPortEngine, { describes: string; reverifies: boolean }> = {
  'browser-storage': { describes: 'does what the plan says', reverifies: false },
  supabase: { describes: 're-judges every row and keeps the ones still in use', reverifies: true },
  'local-core': { describes: 're-judges every row and keeps the ones still in use', reverifies: true }
};

/**
 * B-9 — how a bulk import can fail, and whether it can say how far it has got.
 *
 * The rule EVERY engine keeps, asserted below rather than declared: `inserted`
 * is a PREFIX count. Rows [0, inserted) of the file are in the account, rows
 * [inserted, total) are not, in file order. Both callers slice the array they
 * handed in at that number to name the missing payments to somebody holding the
 * statement, so a count that merely totalled the rows written — with the gaps
 * anywhere else — would send them looking for the wrong transactions.
 *
 * `partial` is how far a failure can get, and it follows from the size of the
 * unit each engine writes in: the cloud posts chunks that each commit on their
 * own, so it can stop at any chunk boundary; a device write is ONE store
 * transaction, so it is 0 or all of them. Both are prefixes.
 *
 * `reportsProgress` is whether `onProgress` can fire before the answer. An
 * engine that commits in pieces can count them honestly; one atomic write has
 * no fraction to report, and inventing one is the bar-creeping-to-90% lie that
 * keeps somebody waiting on a write that already failed.
 */
const BULK_IMPORT: Record<
  DataPortEngine,
  { partial: 'all-or-nothing' | 'any prefix'; reportsProgress: boolean }
> = {
  // One IndexedDB transaction covering the rows and the balance together.
  'browser-storage': { partial: 'all-or-nothing', reportsProgress: false },
  // Chunks of a thousand, each its own database transaction.
  supabase: { partial: 'any prefix', reportsProgress: true },
  // One store transaction, same as the browser and for the same reason.
  'local-core': { partial: 'all-or-nothing', reportsProgress: false }
};

/**
 * B-11 — WHAT THIS ENGINE CANNOT KEEP.
 *
 * A backup file carries every table the format knows about, and not every
 * engine has somewhere to put all of them: a browser has no investments, no
 * goal contributions and no repeating templates, because local mode has no
 * screen, no writer and no reader for any of them. Restoring a login's file
 * onto a device therefore genuinely loses part of it.
 *
 * That is a fact about the product, so it is written down HERE rather than
 * inferred from a mapping inside one engine. Two things follow from it, and
 * both are asserted below: the rows are never dropped in silence — they come
 * back NAMED, with a reason a person can read and act on — and an engine that
 * holds everything says so with an empty list rather than by staying quiet.
 *
 * A table added to the format with nowhere to live on a device must appear in
 * this row on the same day, or the restore that skips it will say nothing.
 */
const BACKUP_COVERAGE: Record<
  DataPortEngine,
  { notStored: readonly { entity: BackupEntity; label: string }[] }
> = {
  'browser-storage': {
    notStored: [
      { entity: 'goal_contributions', label: 'Goal contributions' },
      { entity: 'investments', label: 'Investments' },
      { entity: 'investment_transactions', label: 'Investment transactions' },
      { entity: 'recurring_transactions', label: 'Recurring transactions' },
      { entity: 'notifications', label: 'Notifications' },
      { entity: 'dashboard_layouts', label: 'Dashboard layouts' },
      { entity: 'widget_preferences', label: 'Widget preferences' }
    ]
  },
  // Every table in the format is a table in the database — the format was read
  // off it.
  supabase: { notStored: [] },
  // A claim the local edition has to meet, not a description of something that
  // exists: it is meant to hold the whole ledger. The day it cannot hold a
  // table, this row says which, and the restore starts saying so too.
  'local-core': { notStored: [] }
};

/**
 * B-8 — what a subscription promises.
 *
 * `subscribeToUpdates` is a watch, not a read: the caller hands over callbacks
 * and gets a handle back. WHAT arrives through those callbacks is the part the
 * engines cannot agree on, so it is declared here rather than asserted equal.
 *
 * `delivers: 'never'` is not a gap to be filled in later. An engine with no
 * other device to hear from has nothing to say: browser storage is one store in
 * one tab, and a local core is one file on one machine. Its handle is a no-op,
 * and the caller already treats a silent channel as normal.
 *
 * What EVERY engine is held to is in the test below, because the boot's cleanup
 * depends on it: the handle is a function, calling it twice is safe (the
 * cleanup drains its handles, and a fast user switch can reach the same one
 * again), and once it has been called nothing further arrives.
 */
const SUBSCRIPTION_DELIVERY: Record<
  DataPortEngine,
  { describes: string; delivers: 'never' | 'at-least-once' }
> = {
  // One store, one tab. Nothing to hear from, so nothing ever fires.
  'browser-storage': { describes: 'never delivers a change', delivers: 'never' },
  // A realtime channel: an event may arrive more than once, events may arrive
  // out of order, and an event may be THIS client's own write coming back —
  // which is why the provider suppresses reloads for a moment after a local
  // write and debounces whatever is left.
  supabase: {
    describes: 'delivers at least once, unordered, and may echo this client’s own writes',
    delivers: 'at-least-once'
  },
  // One file on one machine: same silence, same reason.
  'local-core': { describes: 'never delivers a change', delivers: 'never' }
};

// ── Fixture builders ────────────────────────────────────────────────────────
// Invented data throughout: made-up account names, made-up amounts.

const ACCOUNT_A = 'acct-a';
const ACCOUNT_B = 'acct-b';
const ACCOUNT_C = 'acct-c';

const AT = (day: string): Date => new Date(`${day}T12:00:00.000Z`);

/**
 * Let anything a write scheduled actually run. One macrotask: enough for a
 * callback an engine dispatched for itself, deliberately not enough to wait on
 * a network. See B-8 for what that buys and what it does not.
 */
const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const anAccount = (id: string, name: string, rest: Partial<Account> = {}): Account => ({
  id,
  name,
  type: 'checking',
  balance: 0,
  currency: 'GBP',
  isActive: true,
  lastUpdated: AT('2025-01-01'),
  ...rest
});

const aTransaction = (id: string, rest: Partial<Transaction> = {}): Transaction => ({
  id,
  accountId: ACCOUNT_A,
  amount: -10,
  date: AT('2025-01-10'),
  description: 'Something bought',
  category: 'cat-everyday',
  type: 'expense',
  ...rest
});

const aCategory = (id: string, name: string, rest: Partial<Category> = {}): Category => ({
  id,
  name,
  type: 'expense',
  level: 'detail',
  isActive: true,
  ...rest
});

/**
 * A category as a CALLER supplies one — no id, because the id is the store's to
 * mint and the caller's to use immediately afterwards (B-5).
 */
const aNewCategory = (
  name: string,
  rest: Partial<Omit<Category, 'id'>> = {}
): Omit<Category, 'id'> => ({
  name,
  type: 'expense',
  level: 'detail',
  isActive: true,
  ...rest
});

const aBudget = (id: string, categoryId: string, amount: number): Budget => ({
  id,
  categoryId,
  amount,
  period: 'monthly',
  isActive: true,
  spent: 0,
  createdAt: AT('2025-01-01'),
  updatedAt: AT('2025-01-01')
});

/**
 * A budget as a CALLER supplies one — no id, and no `spent`: what has been
 * spent against a category is summed from the ledger, so it is never the
 * caller's to state. The two timestamps are the caller's own (the budget modal
 * sends them), and every engine is free to stamp its own over them.
 */
const aNewBudget = (
  categoryId: string,
  amount: number,
  rest: Partial<Omit<Budget, 'id' | 'spent'>> = {}
): Omit<Budget, 'id' | 'spent'> => ({
  categoryId,
  amount,
  period: 'monthly',
  isActive: true,
  createdAt: AT('2025-01-01'),
  updatedAt: AT('2025-01-01'),
  ...rest
});

const aGoal = (id: string, name: string, targetAmount: number): Goal => ({
  id,
  name,
  type: 'savings',
  targetAmount,
  currentAmount: 0,
  targetDate: AT('2026-01-01'),
  isActive: true,
  createdAt: AT('2025-01-01'),
  updatedAt: AT('2025-01-01'),
  progress: 0
});

/**
 * A goal as a CALLER supplies one — no id, and no `progress`.
 *
 * `progress` is absent for a DIFFERENT reason than `spent` is absent from a new
 * budget, and the difference is the whole of rule 49 below. A budget's `spent`
 * is summed from the ledger and is never the caller's to state; a goal's
 * progress is money somebody has already put by, which nothing else knows
 * about — so it is not ignored, it is taken from `currentAmount`.
 */
const aNewGoal = (
  name: string,
  targetAmount: number,
  rest: Partial<Omit<Goal, 'id' | 'progress'>> = {}
): Omit<Goal, 'id' | 'progress'> => ({
  name,
  type: 'savings',
  targetAmount,
  currentAmount: 0,
  targetDate: AT('2026-01-01'),
  isActive: true,
  createdAt: AT('2025-01-01'),
  updatedAt: AT('2025-01-01'),
  ...rest
});

/** Three accounts and nothing else — the starting point for most tests. */
const threeAccounts = (): Account[] => [
  anAccount(ACCOUNT_A, 'Everyday', { balance: -70.1 }),
  anAccount(ACCOUNT_B, 'Rainy day', { type: 'savings', balance: 500 }),
  anAccount(ACCOUNT_C, 'Spare', { type: 'savings', balance: 0 })
];

const balanceOf = (state: PortStoreState, accountId: string): number | undefined =>
  state.accounts.find(account => account.id === accountId)?.balance;

const transactionOf = (state: PortStoreState, id: string): Transaction | undefined =>
  state.transactions.find(transaction => transaction.id === id);

/**
 * A comparable picture of the whole store. Used for "a refusal changed
 * nothing": JSON is the one shape both a browser store and a database row can
 * be reduced to without the suite knowing which it is looking at.
 */
const asComparable = (state: PortStoreState): string => JSON.stringify(state);

export function runDataPortContract(name: string, harness: DataPortContractHarness): void {
  const { engine } = harness;

  describe(name, () => {
    describe('the surface itself', () => {
      it('answers every operation the seam names', async () => {
        // The floor under every rule below: a suite run against a port that is
        // missing operations proves only that the operations it HAS behave.
        // Nothing else here would notice the absence — an engine under
        // construction would go green on the half it had finished.
        //
        // Not a type check, deliberately. Tests are not compiled by `tsc -b`,
        // so `implements DataPort` is only checked where the implementation
        // itself is production code; a harness that assembles its port out of
        // parts (which a local edition, being two halves, will) gets no such
        // check at all. This one runs.
        const { port } = await harness.create({ accounts: threeAccounts() });

        const missing = DATA_PORT_OPERATIONS.filter(operation => typeof port[operation] !== 'function');
        expect(missing).toEqual([]);
      });

      it('describes what it can do, synchronously and completely', async () => {
        // The capability descriptor is the one answer every OTHER answer in
        // this suite is allowed to differ on — it is how an engine declares its
        // own divergences instead of the app guessing them. So its shape is a
        // contract in a way none of the data shapes are: a missing field is not
        // a wrong number on a screen, it is `undefined` flowing into a batch
        // size, a subscription gate, or the sentence that tells somebody
        // whether the file they just downloaded is their only copy.
        const { port } = await harness.create({ accounts: [] });

        const capabilities = port.capabilities();

        // Synchronous, and that is load-bearing rather than stylistic: every
        // consumer is a render or the tick of a write. A promise here would put
        // a loading state in front of a sentence.
        expect(capabilities).not.toBeInstanceOf(Promise);

        expect(Object.keys(capabilities).sort()).toEqual([
          'backupTarget',
          'edition',
          'maxConcurrentWrites',
          'realtime',
          'session'
        ]);
        expect(['cloud', 'device']).toContain(capabilities.edition);
        expect(['ready', 'connecting', 'anonymous']).toContain(capabilities.session);
        expect(typeof capabilities.realtime).toBe('boolean');
        expect(['login', 'device']).toContain(capabilities.backupTarget);

        // AT LEAST ONE, ALWAYS. Callers divide work into batches of this
        // number: a 0 is an infinite loop over somebody's transactions, and a
        // fraction is a slice() that never advances. An engine that is unsure
        // says 1 — one write at a time is slow, never wrong.
        expect(Number.isInteger(capabilities.maxConcurrentWrites)).toBe(true);
        expect(capabilities.maxConcurrentWrites).toBeGreaterThanOrEqual(1);

        // A store whose owner has not resolved is not a login. Backups are the
        // operation where naming the wrong store costs the most — the file is
        // the only copy — so the implication is asserted rather than assumed.
        if (capabilities.backupTarget === 'login') {
          expect(capabilities.session).toBe('ready');
        }
      });
    });

    describe('accounts', () => {
      it('gives back every field it was given', async () => {
        // The seam's promise about accounts: what the app wrote is what the
        // app reads. Two mappers that each dropped what the other kept is how
        // a low-balance alert silently switched itself off, so the field set
        // is a contract, not an implementation detail.
        const { port, read } = await harness.create({ accounts: [] });

        await port.createAccount({
          name: 'Rainy day',
          type: 'savings',
          balance: 250.5,
          currency: 'GBP',
          institution: 'Made Up Bank',
          isActive: true,
          lastUpdated: AT('2025-01-01'),
          openingBalance: 200,
          notes: 'Set aside for the boiler',
          sortCode: '00-00-00',
          accountNumber: '12345678',
          creditLimit: 0,
          lowBalanceThreshold: 25,
          lowBalanceAlertEnabled: true
        });

        const [stored] = (await read()).accounts;
        expect(stored).toMatchObject({
          name: 'Rainy day',
          type: 'savings',
          currency: 'GBP',
          institution: 'Made Up Bank',
          openingBalance: 200,
          notes: 'Set aside for the boiler',
          sortCode: '00-00-00',
          accountNumber: '12345678',
          creditLimit: 0,
          lowBalanceThreshold: 25,
          lowBalanceAlertEnabled: true
        });
        expect(stored.id).toBeTruthy();

        const listed = await port.listAccounts();
        expect(listed.find(account => account.id === stored.id)).toMatchObject({
          lowBalanceAlertEnabled: true,
          accountNumber: '12345678',
          sortCode: '00-00-00'
        });
      });

      it('B-7: hands the whole account back to the caller that created it', async () => {
        // The WRITE twin of the rule above, and a different promise: that one
        // is about what the store holds afterwards, this one is about the
        // object the create ANSWERS with. The caller puts it straight into app
        // state without re-reading, and the account settings modal seeds its
        // form from whatever is in state — so a field an engine drops on the
        // way in is a field the user finds blank when they reopen the account,
        // and writes back blank the next time they save something else.
        //
        // It is a rule of the seam rather than of any one engine because the
        // two writers that used to share this job disagreed about it: one sent
        // the bank details, the opening balance date and the notes, the other
        // sent ten columns and none of those four.
        //
        // The card rule rides along here because a create is the one place it
        // can be applied without asking anything: the account type is in the
        // payload. Whatever a caller supplies — a form, an importer, a
        // restored backup — four digits at most are stored, because anything
        // stored reaches that person's backups and their JSON export.
        const { port, read } = await harness.create({ accounts: [] });

        const created = await port.createAccount({
          name: 'Rainy day',
          type: 'savings',
          balance: 250.5,
          currency: 'GBP',
          institution: 'Made Up Bank',
          isActive: true,
          lastUpdated: AT('2025-01-01'),
          openingBalance: 200,
          openingBalanceDate: AT('2024-04-06'),
          notes: 'Set aside for the boiler',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        });

        expect(created.id).toBeTruthy();
        expect(created).toMatchObject({
          name: 'Rainy day',
          type: 'savings',
          balance: 250.5,
          currency: 'GBP',
          institution: 'Made Up Bank',
          isActive: true,
          openingBalance: 200,
          notes: 'Set aside for the boiler',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        });
        // A Date crosses as a Date (rule 3): this one is read straight back
        // into a date input, and a string there shows as an empty field.
        expect(created.openingBalanceDate).toBeInstanceOf(Date);
        expect(created.openingBalanceDate?.toISOString()).toBe(AT('2024-04-06').toISOString());

        // Card-shaped but invented. A card has no sort code at all, and its
        // number is the last four digits and nothing else.
        const card = await port.createAccount({
          name: 'Spending card',
          type: 'credit',
          balance: 0,
          currency: 'GBP',
          isActive: true,
          lastUpdated: AT('2025-01-01'),
          accountNumber: '1111222233334444'
        });

        expect(card.accountNumber).toBe('4444');
        expect(JSON.stringify(await read())).not.toContain('1111222233334444');
      });

      it('closes an account rather than deleting it', async () => {
        // A deleted account is a hole in a ledger: its transactions would have
        // nowhere to belong. Every engine soft-closes.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1')]
        });

        await port.closeAccount(ACCOUNT_A);

        const state = await read();
        expect(state.accounts.find(account => account.id === ACCOUNT_A)?.isActive).toBe(false);
        expect(transactionOf(state, 'txn-1')).toBeDefined();

        const closed = await port.listClosedAccounts();
        expect(closed.map(account => account.id)).toContain(ACCOUNT_A);
      });
    });

    describe('money moves exactly', () => {
      // Every fixture here is chosen so that IEEE-754 gets the sum wrong
      // (0.1 + 0.2 = 0.30000000000000004; -70.3 - -70.1 = -0.19999999999999574).
      // A float slipping into any implementation therefore fails on this
      // screen rather than in someone's balance six months later.
      const openWith = (a: number, b = 0): Account[] => [
        anAccount(ACCOUNT_A, 'Everyday', { balance: a }),
        anAccount(ACCOUNT_B, 'Rainy day', { type: 'savings', balance: b }),
        anAccount(ACCOUNT_C, 'Spare', { type: 'savings', balance: 0 })
      ];

      it('adds a transaction to the balance to the penny', async () => {
        const { port, read } = await harness.create({ accounts: openWith(0.1) });

        await port.createTransaction({
          accountId: ACCOUNT_A,
          amount: 0.2,
          date: AT('2025-01-11'),
          description: 'A small thing',
          category: 'cat-everyday',
          type: 'income'
        });

        expect(balanceOf(await read(), ACCOUNT_A)).toBe(0.3);
      });

      it('moves the balance by the difference when an amount is edited', async () => {
        // Two float traps in one: the difference itself, and adding it on.
        const { port, read } = await harness.create({
          accounts: openWith(1.1),
          transactions: [aTransaction('txn-1', { amount: -70.1 })]
        });

        await port.updateTransaction('txn-1', { amount: -70.3 });

        expect(balanceOf(await read(), ACCOUNT_A)).toBe(0.9);
      });

      it('takes a deleted transaction back out of the balance', async () => {
        const { port, read } = await harness.create({
          accounts: openWith(-70.1),
          transactions: [aTransaction('txn-1', { amount: -0.2 })]
        });

        await port.deleteTransaction('txn-1');

        expect(balanceOf(await read(), ACCOUNT_A)).toBe(-69.9);
      });

      it('moves both balances when a transfer counterpart is created', async () => {
        const { port, read } = await harness.create({
          accounts: openWith(-70.1, 0.1),
          transactions: [aTransaction('txn-1', { amount: -0.2 })]
        });

        const { source, counterpart } = await port.createTransferCounterpart('txn-1', ACCOUNT_B);

        expect(source.type).toBe('transfer');
        expect(source.transferAccountId).toBe(ACCOUNT_B);
        expect(counterpart.amount).toBe(0.2);
        expect(counterpart.accountId).toBe(ACCOUNT_B);
        expect(counterpart.linkedTransferId).toBe('txn-1');

        const state = await read();
        // The source account does not move: its row was already counted.
        expect(balanceOf(state, ACCOUNT_A)).toBe(-70.1);
        expect(balanceOf(state, ACCOUNT_B)).toBe(0.3);
      });

      it('moves the balance when a split changes the transaction total', async () => {
        const { port, read } = await harness.create({
          accounts: openWith(0.1),
          transactions: [aTransaction('txn-1', { amount: 0.1, type: 'income' })]
        });

        const result = await port.setTransactionSplits(
          'txn-1',
          [
            { category: 'cat-everyday', amount: 0.1 },
            { category: 'cat-bills', amount: 0.2 }
          ],
          null
        );

        // The split's own total, and the balance that follows it.
        expect(result.amount).toBe(0.3);
        const state = await read();
        expect(balanceOf(state, ACCOUNT_A)).toBe(0.3);
        expect(transactionOf(state, 'txn-1')?.amount).toBe(0.3);
      });

      it('computes a server-side balance that agrees with the client sum to the penny', async () => {
        // The two figures are stand-ins for each other on the dashboard for the
        // seconds a long history is in flight, so a disagreement between them
        // is money changing on screen. Same float trap as everything above:
        // 0.1 + 0.2 is not 0.3 in IEEE-754.
        const { port } = await harness.create({
          accounts: [anAccount(ACCOUNT_A, 'Everyday', { balance: 0.1, openingBalance: 0.1 })],
          transactions: [aTransaction('txn-1', { amount: 0.2, type: 'income' })]
        });

        const balances = await port.getAccountBalances();

        if (SERVER_BALANCES[engine] === 'empty') {
          expect(balances.size).toBe(0);
          return;
        }
        expect(balances.get(ACCOUNT_A)?.balance).toBe(0.3);
        expect(balances.get(ACCOUNT_A)?.txnCount).toBe(1);
      });
    });

    describe('importing a file', () => {
      /**
       * A statement as a parser hands one over: drafts, no ids — and every row
       * naming the WRONG account, because that is what a real file does. A CSV
       * says "Barclays" in a column and a parser guesses at it; the destination
       * the user picked is the one that must win.
       *
       * The three amounts are another IEEE-754 trap: 10.1 + 20.2 + 0.3 is
       * 30.599999999999998 in float, and this is the largest single balance
       * movement anything in the app makes.
       */
      const statement = (): Array<Omit<Transaction, 'id'>> => [
        {
          accountId: ACCOUNT_A,
          amount: 10.1,
          date: AT('2025-02-03'),
          description: 'CHEQUE PAID IN',
          category: 'cat-everyday',
          type: 'income'
        },
        {
          accountId: ACCOUNT_A,
          amount: 20.2,
          date: AT('2025-02-04'),
          description: 'REFUND FROM SHOP',
          category: 'cat-everyday',
          type: 'income'
        },
        {
          accountId: ACCOUNT_A,
          amount: 0.3,
          date: AT('2025-02-05'),
          description: 'INTEREST',
          category: 'cat-everyday',
          type: 'income'
        }
      ];

      it('files every row into the account it was told, and moves that balance to the penny', async () => {
        const { port, read } = await harness.create({ accounts: threeAccounts() });
        const rows = statement();

        const result = await port.importTransactions(ACCOUNT_C, rows);

        expect(result.inserted).toBe(rows.length);
        expect(result.total).toBe(rows.length);
        expect(result.complete).toBe(true);
        // Never more "already here" than "here": the second number is a subset
        // of the first, not a separate pile added beside it.
        expect(result.alreadyPresent).toBeLessThanOrEqual(result.inserted);

        const state = await read();
        const landed = state.transactions.filter(t => t.accountId === ACCOUNT_C);
        expect(landed.map(t => t.description).sort()).toEqual(
          rows.map(row => row.description).sort()
        );
        // Every row usable at once: an id of its own, and no two the same.
        expect(new Set(landed.map(t => t.id)).size).toBe(rows.length);
        expect(landed.every(t => Boolean(t.id))).toBe(true);

        // The destination beat the parser's guess — for the rows AND for the
        // money. A statement filed into the wrong account is a register that
        // disagrees with the bank by whatever the file was worth.
        expect(balanceOf(state, ACCOUNT_C)).toBe(30.6);
        expect(balanceOf(state, ACCOUNT_A)).toBe(-70.1);
        expect(state.transactions.some(t => t.accountId === ACCOUNT_A)).toBe(false);
      });

      it('B-9: what it says landed is a prefix of the file, and the rest really is absent', async () => {
        // The rule both importers depend on LITERALLY: each slices the array it
        // handed in at `inserted` and shows the remainder as "these payments
        // are missing". So this asks the store what it holds and compares it
        // against exactly that slice. An implementation that reported a count
        // it had not written — or wrote rows it did not count — fails here
        // rather than in front of somebody comparing a paper statement.
        const { port, read } = await harness.create({ accounts: threeAccounts() });
        const rows = statement();
        const before = asComparable(await read());

        // An account that is not there: the one refusal every engine makes for
        // itself (the cloud RPC's account_not_found_or_not_owned, and the same
        // judgement on a device), and the cheapest way to ask for a write that
        // does not happen.
        const result = await port.importTransactions('acct-that-is-not-there', rows);

        expect(result.complete).toBe(false);
        // Prose, because the caller renders it (rule 4 of the seam).
        expect(typeof result.error).toBe('string');
        expect(result.error).not.toBe('');
        expect(result.total).toBe(rows.length);

        const state = await read();
        expect(state.transactions.map(t => t.description))
          .toEqual(rows.slice(0, result.inserted).map(row => row.description));
        // And a write that did not happen changed nothing else either.
        expect(asComparable(state)).toBe(before);
      });

      it(`B-9: when the store fails mid-import, this engine lands ${BULK_IMPORT[engine].partial}`, async () => {
        // REPORTED, NOT THROWN. "412 of 900 landed" is an outcome the caller
        // has to render — the missing rows are named on screen — so a store
        // that will not answer must come back as a result, not as a rejection
        // the import dialog would turn into "Import failed" and nothing else.
        const port = await harness.createUnreadable();
        const rows = statement();

        const result = await port.importTransactions(ACCOUNT_C, rows);

        expect(result.complete).toBe(false);
        expect(result.total).toBe(rows.length);
        if (BULK_IMPORT[engine].partial === 'all-or-nothing') {
          expect([0, rows.length]).toContain(result.inserted);
        } else {
          expect(result.inserted).toBeGreaterThanOrEqual(0);
          expect(result.inserted).toBeLessThanOrEqual(rows.length);
        }
      });

      it('writes nothing at all when the file has no rows', async () => {
        // The ordinary case rather than a caller's mistake: a statement whose
        // every row was already in the register arrives here empty, because the
        // duplicate check ran before anyone knew what would be left.
        const { port, read } = await harness.create({ accounts: threeAccounts() });
        const before = asComparable(await read());

        const result = await port.importTransactions(ACCOUNT_C, []);

        expect(result).toMatchObject({ inserted: 0, alreadyPresent: 0, total: 0, complete: true });
        expect(asComparable(await read())).toBe(before);
      });
    });

    describe('the boot read', () => {
      it('hands over every row, with dates the app can use', async () => {
        // Rule 3 of the seam: a Date crosses as a Date. These rows go straight
        // into app state and into the balance maths, and a store that hands
        // back the string it serialised would put "2025-01-10" where every
        // reader expects to call .getTime().
        const { port } = await harness.create({
          accounts: threeAccounts(),
          transactions: [
            aTransaction('txn-1'),
            aTransaction('txn-2', { amount: -20, date: AT('2025-02-14'), description: 'Something else' })
          ]
        });

        const boot = await port.loadBootTransactions();

        expect(boot.transactions.map(transaction => transaction.id).sort()).toEqual(['txn-1', 'txn-2']);
        boot.transactions.forEach(transaction => {
          expect(transaction.date).toBeInstanceOf(Date);
          expect(Number.isNaN(new Date(transaction.date).getTime())).toBe(false);
        });
      });

      it('reports honestly how many rows it handed over, and where they came from', async () => {
        // The count is printed on the boot-timing line. A figure that does not
        // match the array beside it is worse than no figure at all: the next
        // slowness report starts from it.
        const { port } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1'), aTransaction('txn-2', { amount: -20 })]
        });

        const boot = await port.loadBootTransactions();

        expect(boot.stats.total).toBe(boot.transactions.length);
        const provenance = BOOT_PROVENANCE[engine];
        if (provenance.snapshots) {
          // Either a snapshot stood (null) or it says why it did not.
          if (boot.stats.fullFetchReason !== null) {
            expect(boot.stats.fullFetchReason).not.toBe('');
          }
          expect(boot.stats.cached + boot.stats.fetched).toBeGreaterThanOrEqual(boot.stats.total);
        } else {
          expect(boot.stats.fullFetchReason).toBe(provenance.reasonWhenUncached);
          expect(boot.stats.cached).toBe(0);
        }
      });

      it('answers empty, with the reason said out loud, when the store will not open', async () => {
        // THE rule this slice exists to keep. The boot effect has one outer
        // catch and reaching it replaces the whole app with a "Failed to load
        // data" page — for somebody whose ledger is fine and whose next reload
        // would have worked. A broken store costs an empty list, never a throw.
        const port = await harness.createUnreadable();

        const boot = await port.loadBootTransactions();

        expect(boot.transactions).toEqual([]);
        expect(boot.stats.total).toBe(0);
        expect(typeof boot.stats.fullFetchReason).toBe('string');
        expect(boot.stats.fullFetchReason).not.toBe('');
      });
    });

    describe('server-computed balances', () => {
      it(`B-2: this engine ${SERVER_BALANCES[engine]}`, async () => {
        const { port } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1')]
        });

        const balances = await port.getAccountBalances();

        if (SERVER_BALANCES[engine] === 'empty') {
          // Empty means "I don't know", and the app sums the rows itself.
          // THREE entries of zero would be a different answer entirely: the
          // seeding rule keys off the map being non-empty, so a map of zeros
          // would paint every account at £0.00 and call it real money.
          expect(balances.size).toBe(0);
          return;
        }
        expect([...balances.keys()].sort()).toEqual([ACCOUNT_A, ACCOUNT_B, ACCOUNT_C]);
      });

      it('never rejects, and does not invent zeros, when the store will not open', async () => {
        const port = await harness.createUnreadable();

        const balances = await port.getAccountBalances();

        expect(balances.size).toBe(0);
      });
    });

    describe('preparing the categories', () => {
      it(`B-4: with nothing stored, this engine ${PREPARE_CATEGORIES[engine].describes}`, async () => {
        // Never empty, whatever the store holds. This is the list the register,
        // the budgets page and every category filter are built from, and the
        // boot does not ask twice — an engine that answered [] here would put a
        // person in front of a ledger with nowhere to file anything and no way
        // to make one.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          categories: []
        });

        const prepared = await port.prepareCategories();

        expect(prepared.length).toBeGreaterThan(0);
        expect(prepared.every(category => typeof category.id === 'string' && category.id !== ''))
          .toBe(true);
        expect(prepared.every(category => typeof category.name === 'string' && category.name !== ''))
          .toBe(true);

        // Where the engines part company: whether that set was also written.
        const stored = (await read()).categories;
        if (PREPARE_CATEGORIES[engine].persists) {
          expect(stored.map(category => category.id).sort())
            .toEqual(prepared.map(category => category.id).sort());
        } else {
          expect(stored).toEqual([]);
        }
      });

      it('finishes its work before a transaction read can see the rows', async () => {
        // The ordering the boot depends on, stated where an implementation can
        // be held to it rather than only where it is obeyed.
        //
        // An engine is allowed to renumber categories on first use — the cloud
        // does exactly that, and remaps every transaction and budget reference
        // in the same database transaction. What it is NOT allowed to do is
        // leave that work running behind the promise it just resolved: the app
        // reads its transactions next, and rows carrying the OLD ids would
        // point at categories that no longer exist. Nothing throws when that
        // happens. The register simply comes up with its category column blank.
        //
        // So: whatever prepareCategories resolves with IS the set the rows that
        // follow are filed under, and IS what a later read of the same question
        // gives back.
        const { port } = await harness.create({
          accounts: threeAccounts(),
          categories: [aCategory('cat-everyday', 'Everyday'), aCategory('cat-bills', 'Bills')],
          transactions: [
            aTransaction('txn-1', { category: 'cat-everyday' }),
            aTransaction('txn-2', { amount: -20, category: 'cat-bills' })
          ]
        });

        const prepared = await port.prepareCategories();
        const boot = await port.loadBootTransactions();

        const preparedIds = new Set(prepared.map(category => category.id));
        boot.transactions
          .filter(transaction => transaction.category)
          .forEach(transaction => {
            expect(preparedIds.has(transaction.category)).toBe(true);
          });
        expect((await port.listCategories()).map(category => category.id).sort())
          .toEqual([...preparedIds].sort());
      });
    });

    describe('budgets and goals', () => {
      it('answers for the owner it resolved itself, and only that owner', async () => {
        // Rule 1 of the seam: no read takes a user id, every implementation
        // resolves its own owner. That rule has teeth precisely because
        // getting it wrong is SILENT — the wrong owner's budgets are a
        // perfectly well-formed list of amounts, and nothing on screen says
        // whose. Two isolated stores, asked the same question, is the cheapest
        // way to make a mixed-up owner fail here instead of in front of
        // somebody.
        const mine = await harness.create({
          accounts: threeAccounts(),
          budgets: [aBudget('budget-mine', 'cat-everyday', 200)],
          goals: [aGoal('goal-mine', 'New boiler', 1500)]
        });
        const theirs = await harness.create({
          accounts: threeAccounts(),
          budgets: [aBudget('budget-theirs', 'cat-bills', 75)],
          goals: [aGoal('goal-theirs', 'Someone else’s holiday', 900)]
        });

        expect((await mine.port.listBudgets()).map(budget => budget.id)).toEqual(['budget-mine']);
        expect((await mine.port.listGoals()).map(goal => goal.id)).toEqual(['goal-mine']);
        expect((await theirs.port.listBudgets()).map(budget => budget.id)).toEqual(['budget-theirs']);
        expect((await theirs.port.listGoals()).map(goal => goal.id)).toEqual(['goal-theirs']);
      });

      it('hands back the amounts it was given, to the penny', async () => {
        // A budget and a goal are money on a page. 0.1 + 0.2 territory again:
        // an engine that round-trips these through a float column would be
        // caught here rather than by a limit that is a penny out.
        const { port } = await harness.create({
          accounts: threeAccounts(),
          budgets: [aBudget('budget-1', 'cat-everyday', 70.1)],
          goals: [aGoal('goal-1', 'Rainy day', 0.3)]
        });

        expect((await port.listBudgets())[0].amount).toBe(70.1);
        expect((await port.listGoals())[0].targetAmount).toBe(0.3);
      });
    });

    describe('writing a budget', () => {
      it('round-trips the amount through a create and an edit, to the penny', async () => {
        // A budget is a limit somebody set on purpose, and the page compares
        // it against a Decimal sum of real transactions. An engine that stored
        // it through a float column would put a limit a penny out and then
        // announce it had been exceeded — 0.1 + 0.2 territory, in a place the
        // user is watching. `spent` starts at zero in every engine because it
        // is summed from the ledger, never stored knowledge.
        const { port } = await harness.create({ accounts: threeAccounts() });

        const created = await port.createBudget(aNewBudget('cat-everyday', 70.1));

        expect(created.id).toBeTruthy();
        expect(created.amount).toBe(70.1);
        expect(created.spent).toBe(0);
        expect((await port.listBudgets()).map(budget => [budget.id, budget.amount]))
          .toEqual([[created.id, 70.1]]);

        const edited = await port.updateBudget(created.id, { amount: 0.3 });

        // The whole budget comes back, not just the field that moved: the
        // caller replaces its copy with this answer.
        expect(edited).toMatchObject({ id: created.id, categoryId: 'cat-everyday', amount: 0.3 });
        expect((await port.listBudgets())[0].amount).toBe(0.3);
      });

      it(`B-3: a budget is filed under ${OWNERSHIP[engine]}`, async () => {
        // Two rules, equal for every engine however it spells "owner".
        //
        // FIRST: no operation ACCEPTS an owner. Stated at runtime and not left
        // to the interface because the interface is only compiled where the
        // implementation is production code — and it is a partial, hand-built
        // port that would grow a `(userId, budget)` signature and start
        // trusting its caller for the one value that must never be trusted.
        //
        // SECOND: a write whose owner could not be resolved does not reach
        // another owner's store. Two isolated stores is the cheapest way to
        // ask, and it is not a hypothetical failure: the service behind the
        // cloud branch treats a null owner as "write the browser's copy",
        // which for a signed-in session is a budget that appears on the page
        // and is gone by morning.
        const mine = await harness.create({ accounts: threeAccounts() });
        const theirs = await harness.create({ accounts: threeAccounts() });

        expect(mine.port.createBudget.length).toBe(1);
        expect(mine.port.updateBudget.length).toBe(2);
        expect(mine.port.deleteBudget.length).toBe(1);

        const created = await mine.port.createBudget(aNewBudget('cat-everyday', 200));

        expect((await mine.read()).budgets.map(budget => budget.id)).toEqual([created.id]);
        expect((await theirs.read()).budgets).toEqual([]);
        expect(await theirs.port.listBudgets()).toEqual([]);
      });

      it('refuses to change a budget that is not there, and says which', async () => {
        // Not created-on-the-fly: an id that names nothing is a bug upstream
        // (a stale page, a double submit after a delete), and inventing a
        // budget to satisfy it would put an amount somebody never set on the
        // budgets page. Rule 4 of the seam — the message is what the user
        // reads — so it is asserted, not merely the rejection.
        const { port } = await harness.create({
          accounts: threeAccounts(),
          budgets: [aBudget('budget-1', 'cat-everyday', 200)]
        });

        await expect(port.updateBudget('budget-nowhere', { amount: 300 }))
          .rejects.toThrow(/budget not found/i);
      });

      it('leaves the store exactly as it was when it refuses', async () => {
        // The all-or-nothing rule the splits and the merge already keep, asked
        // of a planning write: everything is judged before anything is
        // written, so a refusal is never a half-applied edit.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          budgets: [aBudget('budget-1', 'cat-everyday', 200)],
          goals: [aGoal('goal-1', 'New boiler', 1500)]
        });
        const before = asComparable(await read());

        await expect(port.updateBudget('budget-nowhere', { amount: 300 })).rejects.toThrow();

        expect(asComparable(await read())).toBe(before);
      });

      it('treats deleting a budget that has already gone as done, not as an error', async () => {
        // Same rule as a dismissal: a double-click, or a second device that
        // got there first, must not turn a decision into an error message.
        // Idempotence is the point — the second call is not a test of the
        // first, it is the case a slow network actually produces.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          budgets: [aBudget('budget-1', 'cat-everyday', 200)]
        });

        await expect(port.deleteBudget('budget-nowhere')).resolves.toBeUndefined();
        expect((await read()).budgets.map(budget => budget.id)).toEqual(['budget-1']);

        await port.deleteBudget('budget-1');
        await port.deleteBudget('budget-1');

        expect((await read()).budgets).toEqual([]);
      });
    });

    describe('writing a goal', () => {
      it('round-trips the amounts through a create and an edit, to the penny', async () => {
        // Same reason as the budget above: a goal's target is a figure
        // somebody typed, and the page draws a bar of progress against it. An
        // engine that stored either through a float column would announce a
        // goal reached a penny early, or refuse to call it reached at all.
        const { port } = await harness.create({ accounts: threeAccounts() });

        const created = await port.createGoal(aNewGoal('New boiler', 1500.05));

        expect(created.id).toBeTruthy();
        expect(created.targetAmount).toBe(1500.05);
        expect((await port.listGoals()).map(goal => [goal.id, goal.targetAmount]))
          .toEqual([[created.id, 1500.05]]);

        const edited = await port.updateGoal(created.id, { targetAmount: 0.3 });

        // The whole goal comes back, not just the field that moved: the caller
        // replaces its copy with this answer.
        expect(edited).toMatchObject({ id: created.id, name: 'New boiler', targetAmount: 0.3 });
        expect((await port.listGoals())[0].targetAmount).toBe(0.3);
      });

      it('starts a goal at the money already put by, not at zero', async () => {
        // Rule 49. `progress` is the accumulated amount, so a goal written
        // down for something already half saved for begins there. The version
        // of this that hard-coded zero did not merely round down — it lost the
        // opening figure DIFFERENTLY in each engine, banking it in one and
        // discarding it in the other, which is exactly the class of difference
        // this suite exists to catch. The rule is "start at what you were
        // given", not "start at something": a goal set for something not yet
        // saved for begins at zero, which is the first half of this test.
        const { port } = await harness.create({ accounts: threeAccounts() });

        const started = await port.createGoal(aNewGoal('New boiler', 1500));
        expect(started.progress).toBe(0);

        const partway = await port.createGoal(
          aNewGoal('Holiday', 2000, { currentAmount: 250.05 })
        );

        expect(partway.progress).toBe(250.05);
        const stored = (await port.listGoals()).find(goal => goal.id === partway.id);
        expect(stored?.progress).toBe(250.05);
      });

      it('never carries a goal past its own target', async () => {
        // Rule 50, and it is a rule about the SHAPE of the write rather than
        // about arithmetic here.
        //
        // Contributing to a goal reaches the seam as an ordinary update
        // carrying the new progress — a figure the caller has already added up
        // and already capped at the target. So this operation must SET what it
        // is handed. An engine that read the field as an increment would undo
        // the cap silently: the second contribution below would take a goal
        // that is full to twice its target, and the bar on the page would draw
        // past its own end.
        const { port } = await harness.create({ accounts: threeAccounts() });
        const created = await port.createGoal(
          aNewGoal('New boiler', 1500, { currentAmount: 1200 })
        );

        // £500 put towards a goal £300 short of its target: capped by the
        // caller, stored verbatim here.
        const filled = await port.updateGoal(created.id, { progress: 1500, currentAmount: 1500 });
        expect(filled.progress).toBe(1500);

        // And again, which is what a second click on a full goal produces.
        const again = await port.updateGoal(created.id, { progress: 1500, currentAmount: 1500 });
        expect(again.progress).toBe(1500);
        expect((await port.listGoals())[0].progress).toBe(1500);
      });

      it(`B-3 for goals: a goal is filed under ${OWNERSHIP[engine]}`, async () => {
        // The same pair of rules the budget writes are held to, asked again of
        // the operations that did not exist when it was asked the first time —
        // because both halves of B-3 are per-operation. The arity check cannot
        // be inherited (a new write is exactly where a `(userId, goal)`
        // signature creeps back in), and neither can the isolation check: the
        // service behind the cloud branch treats a null owner as "write the
        // browser's copy" for goals precisely as it does for budgets.
        const mine = await harness.create({ accounts: threeAccounts() });
        const theirs = await harness.create({ accounts: threeAccounts() });

        expect(mine.port.createGoal.length).toBe(1);
        expect(mine.port.updateGoal.length).toBe(2);
        expect(mine.port.deleteGoal.length).toBe(1);

        const created = await mine.port.createGoal(aNewGoal('New boiler', 1500));

        expect((await mine.read()).goals.map(goal => goal.id)).toEqual([created.id]);
        expect((await theirs.read()).goals).toEqual([]);
        expect(await theirs.port.listGoals()).toEqual([]);
      });

      it('refuses to change a goal that is not there, and leaves the store exactly as it was', async () => {
        // Two rules in one ask, because they are the same moment: an id that
        // names nothing is a bug upstream (a stale page, a contribution
        // submitted after a delete) and must not quietly become a new goal
        // nobody set — and the judgement happens before the first write, so the
        // refusal is never a half-applied edit. Rule 4 of the seam means the
        // sentence is asserted too, not merely the rejection.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          budgets: [aBudget('budget-1', 'cat-everyday', 200)],
          goals: [aGoal('goal-1', 'New boiler', 1500)]
        });
        const before = asComparable(await read());

        await expect(port.updateGoal('goal-nowhere', { progress: 300 }))
          .rejects.toThrow(/goal not found/i);

        expect(asComparable(await read())).toBe(before);
      });

      it('treats deleting a goal that has already gone as done, not as an error', async () => {
        // Same rule as the budget delete and the dismissal before it: a
        // double-click, or a second device that got there first, must not turn
        // a decision into an error message.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          goals: [aGoal('goal-1', 'New boiler', 1500)]
        });

        await expect(port.deleteGoal('goal-nowhere')).resolves.toBeUndefined();
        expect((await read()).goals.map(goal => goal.id)).toEqual(['goal-1']);

        await port.deleteGoal('goal-1');
        await port.deleteGoal('goal-1');

        expect((await read()).goals).toEqual([]);
      });
    });

    describe('writing a category', () => {
      it('removes the categories under a category it removes', async () => {
        // Rule 51. The cascade is a rule of the SEAM, not an artefact of the
        // cloud's foreign key: an engine with no foreign keys to inherit it
        // from would otherwise leave a group's children behind as orphans
        // pointing at a parent that is gone — which reads on the categories
        // page as a set of headings that cannot be expanded and cannot be
        // deleted, because nothing lists them any more.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          categories: [
            aCategory('cat-group', 'Motoring', { level: 'sub' }),
            aCategory('cat-child', 'Fuel', { parentId: 'cat-group' }),
            aCategory('cat-other', 'Groceries')
          ]
        });

        await port.deleteCategory('cat-group');

        expect((await read()).categories.map(category => category.id)).toEqual(['cat-other']);
      });

      it('writes nothing when a bulk create is given nothing, and every row when it is given some', async () => {
        // Rule 52, and the empty half is the ordinary case rather than a
        // caller's mistake: a tree import that only adds detail to groups the
        // account already has plans no new groups at all, and asks anyway,
        // because the plan is computed before it is known to be empty. An
        // engine that opened a transaction, or sent an insert with no rows, to
        // answer that would be doing work — and in some drivers, failing —
        // over nothing.
        //
        // The second half is what stops the first from being satisfied by an
        // operation that always writes nothing.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          categories: [aCategory('cat-1', 'Groceries')]
        });
        const before = asComparable(await read());

        expect(await port.createCategories([])).toEqual([]);
        expect(asComparable(await read())).toBe(before);

        const created = await port.createCategories([
          aNewCategory('Fuel'),
          aNewCategory('Parking')
        ]);

        expect(created.map(category => category.name).sort()).toEqual(['Fuel', 'Parking']);
        expect((await read()).categories.map(category => category.name).sort())
          .toEqual(['Fuel', 'Groceries', 'Parking']);
      });

      it(`B-6: a bulk prune ${BULK_PRUNE[engine].describes}`, async () => {
        // Rule 53. The plan a prune is handed was computed from a snapshot, and
        // the gap between computing it and running it is long enough for
        // somebody to file a transaction under one of the categories in it —
        // in another tab, on a phone, or in the seconds the import spent
        // inserting the new tree. An engine that can see the ledger judges the
        // rows as they are NOW and keeps that one; browser storage IS the
        // snapshot, so it has no second opinion to consult and does what it
        // was told. Both are declared in BULK_PRUNE above rather than
        // discovered here.
        //
        // What is asserted for both, and is the whole of B-6: the number that
        // comes back is the number of rows that actually went.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          categories: [
            aCategory('cat-used', 'Groceries'),
            aCategory('cat-unused', 'Something nobody filed anything under')
          ],
          transactions: [aTransaction('txn-1', { category: 'cat-used' })]
        });
        const before = (await read()).categories.length;

        const removed = await port.deleteUnusedCategories(['cat-unused', 'cat-used']);

        const after = (await read()).categories;
        if (BULK_PRUNE[engine].reverifies) {
          expect(after.map(category => category.id)).toEqual(['cat-used']);
        } else {
          expect(after).toEqual([]);
        }
        expect(removed).toBe(before - after.length);
      });

      it('never invents the count: it is what actually went, not what was asked for', async () => {
        // The other half of B-6, and the one the caller prints. `importCategoryTree`
        // shows this figure to the user ("pruned 40, kept 12 still in use") and
        // re-reads the whole category set BECAUSE it cannot be derived from the
        // request — an id naming nothing removes nothing, and an id naming a
        // group removes the group's children with it. Returning the size of the
        // list would be a guess in the shape of a fact.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          categories: [
            aCategory('cat-group', 'Motoring', { level: 'sub' }),
            aCategory('cat-child', 'Fuel', { parentId: 'cat-group' }),
            aCategory('cat-keep', 'Groceries')
          ]
        });

        const untouched = asComparable(await read());
        expect(await port.deleteUnusedCategories([])).toBe(0);
        expect(asComparable(await read())).toBe(untouched);

        // Two ids, one of which names nothing.
        const beforeNowhere = (await read()).categories.length;
        const removedNowhere = await port.deleteUnusedCategories(['cat-keep', 'cat-nowhere']);
        const afterNowhere = (await read()).categories.length;
        expect(removedNowhere).toBe(beforeNowhere - afterNowhere);

        // One id, which may take more than one row with it.
        const beforeGroup = afterNowhere;
        const removedGroup = await port.deleteUnusedCategories(['cat-group']);
        const afterGroup = (await read()).categories.length;
        expect(removedGroup).toBe(beforeGroup - afterGroup);
      });

      it('gives every new category an id of its own', async () => {
        // Rule 54. Two categories created in a row must not come back sharing
        // an id — an engine that answered with a constant, or that reused the
        // last one, would have the second name silently overwrite the first in
        // every list keyed by id, and the transactions filed under one would
        // appear under the other.
        const { port, read } = await harness.create({ accounts: threeAccounts() });

        const first = await port.createCategory(aNewCategory('Motoring', { level: 'sub' }));
        const second = await port.createCategory(aNewCategory('Household', { level: 'sub' }));

        expect(first.id).toBeTruthy();
        expect(second.id).toBeTruthy();
        expect(second.id).not.toBe(first.id);

        const bulk = await port.createCategories([aNewCategory('Parking'), aNewCategory('Tolls')]);

        expect(bulk).toHaveLength(2);
        expect(new Set(bulk.map(category => category.id)).size).toBe(2);

        const stored = (await read()).categories;
        expect(new Set(stored.map(category => category.id)).size).toBe(stored.length);
      });

      it(`B-5: a new category comes back with ${ID_PROVENANCE[engine]}, usable at once`, async () => {
        // Where the id is minted is declared, not asserted. What is asserted is
        // that it is FINAL: the callers use it on the next line — as the value
        // of the select they just added an option to, and as the parentId of
        // the children a tree import creates in its second pass — so an engine
        // that handed back a placeholder it meant to renumber later would file
        // transactions under an id that stops existing.
        const { port, read } = await harness.create({ accounts: threeAccounts() });

        const parent = await port.createCategory(aNewCategory('Motoring', { level: 'sub' }));
        const child = await port.createCategory(aNewCategory('Fuel', { parentId: parent.id }));

        expect(child.parentId).toBe(parent.id);

        const stored = (await read()).categories;
        expect(stored.find(category => category.id === parent.id)?.name).toBe('Motoring');
        expect(stored.find(category => category.id === child.id)?.parentId).toBe(parent.id);

        // And the id survives an edit made through it, which is the other way
        // the caller uses what it was handed.
        const renamed = await port.updateCategory(parent.id, { name: 'Car' });
        expect(renamed.id).toBe(parent.id);
        expect(renamed.name).toBe('Car');
      });
    });

    describe('splits', () => {
      it('leaves the store untouched when it refuses', async () => {
        // All-or-nothing. Every check runs before the first write, so a
        // refusal is not a half-written split — and the transaction being
        // edited already HAS lines, so a writer that clears them before
        // validating would be caught here rather than by the user.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1', { amount: -30, isSplit: true, category: '' })],
          splits: [
            { id: 'line-1', transactionId: 'txn-1', category: 'cat-everyday', amount: -10, sortOrder: 1 },
            { id: 'line-2', transactionId: 'txn-1', category: 'cat-bills', amount: -20, sortOrder: 2 }
          ]
        });
        const before = asComparable(await read());

        await expect(
          port.setTransactionSplits('txn-1', [{ id: 'line-1', category: 'cat-everyday', amount: -30 }], null)
        ).rejects.toThrow(/at least 2 lines/i);

        expect(asComparable(await read())).toBe(before);
      });

      it('refuses a set that does not sum to the amount it was told to expect', async () => {
        const { port } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1', { amount: -70.1 })]
        });

        await expect(
          port.setTransactionSplits(
            'txn-1',
            [
              { category: 'cat-everyday', amount: -0.2 },
              { category: 'cat-bills', amount: -70.1 }
            ],
            -70.1
          )
        ).rejects.toThrow(/sum to the transaction amount/i);
      });

      it('reads a split back in display order', async () => {
        const { port } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1', { amount: -30, isSplit: true })],
          splits: [
            { id: 'line-2', transactionId: 'txn-1', category: 'cat-bills', amount: -20, sortOrder: 2 },
            { id: 'line-1', transactionId: 'txn-1', category: 'cat-everyday', amount: -10, sortOrder: 1 }
          ]
        });

        const lines = await port.listTransactionSplitsFor('txn-1');
        expect(lines.map(line => line.id)).toEqual(['line-1', 'line-2']);
      });

      describe('a line that is half of a transfer', () => {
        // The rule, precisely: such a line may change its position and its
        // memo. Everything else about it belongs to the row on the other side,
        // and changing it there would strand or falsify that row. Each refusal
        // says which line and which account, because the user has to be able
        // to act on it.
        const splitWithALeg = (): PortFixture => ({
          accounts: threeAccounts(),
          transactions: [
            aTransaction('txn-parent', { amount: -30, isSplit: true, category: '' }),
            aTransaction('txn-leg', {
              accountId: ACCOUNT_B,
              amount: 20,
              type: 'transfer',
              category: 'cat-transfer-a',
              transferAccountId: ACCOUNT_A,
              linkedTransferId: 'txn-parent',
              linkedTransferSplitId: 'line-leg'
            })
          ],
          splits: [
            {
              id: 'line-plain',
              transactionId: 'txn-parent',
              category: 'cat-everyday',
              amount: -10,
              sortOrder: 1
            },
            {
              id: 'line-leg',
              transactionId: 'txn-parent',
              category: 'cat-transfer-b',
              amount: -20,
              sortOrder: 2,
              transferAccountId: ACCOUNT_B,
              linkedTransferId: 'txn-leg'
            }
          ]
        });

        it('refuses to drop it, and changes nothing', async () => {
          const { port, read } = await harness.create(splitWithALeg());
          const before = asComparable(await read());

          await expect(
            port.setTransactionSplits(
              'txn-parent',
              [{ id: 'line-plain', category: 'cat-everyday', amount: -30 }],
              null
            )
          ).rejects.toThrow(/one half of a transfer/i);

          expect(asComparable(await read())).toBe(before);
        });

        it('refuses to change its amount', async () => {
          const { port } = await harness.create(splitWithALeg());

          await expect(
            port.setTransactionSplits(
              'txn-parent',
              [
                { id: 'line-plain', category: 'cat-everyday', amount: -10 },
                { id: 'line-leg', category: 'cat-transfer-b', amount: -25, transferAccountId: ACCOUNT_B }
              ],
              null
            )
          ).rejects.toThrow(/has to stay as it is/i);
        });

        it('refuses to point it at a different account', async () => {
          const { port } = await harness.create(splitWithALeg());

          await expect(
            port.setTransactionSplits(
              'txn-parent',
              [
                { id: 'line-plain', category: 'cat-everyday', amount: -10 },
                { id: 'line-leg', category: 'cat-transfer-b', amount: -20, transferAccountId: ACCOUNT_C }
              ],
              null
            )
          ).rejects.toThrow(/would strand that row/i);
        });

        it('refuses to re-file it under another category', async () => {
          const { port } = await harness.create(splitWithALeg());

          await expect(
            port.setTransactionSplits(
              'txn-parent',
              [
                { id: 'line-plain', category: 'cat-everyday', amount: -10 },
                { id: 'line-leg', category: 'cat-everyday', amount: -20, transferAccountId: ACCOUNT_B }
              ],
              null
            )
          ).rejects.toThrow(/one half of a transfer/i);
        });

        it('lets the line beside it be re-filed', async () => {
          // The whole point of the rule being this narrow: the rest of the
          // split is ordinary and must stay editable.
          const { port, read } = await harness.create(splitWithALeg());

          const result = await port.setTransactionSplits(
            'txn-parent',
            [
              { id: 'line-plain', category: 'cat-bills', amount: -10 },
              { id: 'line-leg', category: 'cat-transfer-b', amount: -20, transferAccountId: ACCOUNT_B }
            ],
            -30
          );

          expect(result.isSplit).toBe(true);
          expect(result.splitCount).toBe(2);
          const lines = (await read()).splits.filter(line => line.transactionId === 'txn-parent');
          expect(lines.find(line => line.id === 'line-plain')?.category).toBe('cat-bills');
          // The leg is exactly as it was, link and all.
          expect(lines.find(line => line.id === 'line-leg')).toMatchObject({
            category: 'cat-transfer-b',
            amount: -20,
            transferAccountId: ACCOUNT_B,
            linkedTransferId: 'txn-leg'
          });
        });
      });
    });

    describe('transfer pairing', () => {
      const twoSides = (rest: Partial<Transaction> = {}): PortFixture => ({
        accounts: threeAccounts(),
        transactions: [
          aTransaction('txn-out', { accountId: ACCOUNT_A, amount: -25 }),
          aTransaction('txn-in', { accountId: ACCOUNT_B, amount: 25, type: 'income', ...rest })
        ]
      });

      it('links two rows without moving a penny', async () => {
        const { port, read } = await harness.create(twoSides());

        const { a, b } = await port.linkTransferPair('txn-out', 'txn-in');

        expect(a.type).toBe('transfer');
        expect(b.type).toBe('transfer');
        expect(a.linkedTransferId).toBe('txn-in');
        expect(b.linkedTransferId).toBe('txn-out');

        const state = await read();
        expect(balanceOf(state, ACCOUNT_A)).toBe(-70.1);
        expect(balanceOf(state, ACCOUNT_B)).toBe(500);
      });

      it('refuses two rows in the same account', async () => {
        const { port } = await harness.create({
          accounts: threeAccounts(),
          transactions: [
            aTransaction('txn-out', { amount: -25 }),
            aTransaction('txn-in', { amount: 25, type: 'income' })
          ]
        });

        await expect(port.linkTransferPair('txn-out', 'txn-in'))
          .rejects.toThrow(/two different accounts/i);
      });

      it('refuses amounts that are not exact opposites', async () => {
        const { port } = await harness.create({
          accounts: threeAccounts(),
          transactions: [
            aTransaction('txn-out', { accountId: ACCOUNT_A, amount: -25 }),
            aTransaction('txn-in', { accountId: ACCOUNT_B, amount: 24, type: 'income' })
          ]
        });

        await expect(port.linkTransferPair('txn-out', 'txn-in'))
          .rejects.toThrow(/opposite non-zero amounts/i);
      });

      it('refuses a split transaction', async () => {
        const { port } = await harness.create(twoSides({ isSplit: true }));

        await expect(port.linkTransferPair('txn-out', 'txn-in'))
          .rejects.toThrow(/split transaction cannot become a transfer/i);
      });

      it('refuses a row that is already linked', async () => {
        const { port } = await harness.create(twoSides({ linkedTransferId: 'txn-elsewhere' }));

        await expect(port.linkTransferPair('txn-out', 'txn-in'))
          .rejects.toThrow(/already part of a linked transfer/i);
      });

      it('unlinks only the rows it can, and counts them', async () => {
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [
            aTransaction('txn-out', { accountId: ACCOUNT_A, amount: -25, type: 'transfer', linkedTransferId: 'txn-in' }),
            aTransaction('txn-in', { accountId: ACCOUNT_B, amount: 25, type: 'transfer', linkedTransferId: 'txn-out' }),
            // The opposite side of a split LINE: its link also lives on the
            // line, so unlinking it here would leave the line pointing at
            // nothing. Skipped, not counted, in every engine.
            aTransaction('txn-leg', {
              accountId: ACCOUNT_B,
              amount: 5,
              type: 'transfer',
              linkedTransferId: 'txn-parent',
              linkedTransferSplitId: 'line-leg'
            })
          ]
        });

        const count = await port.unlinkTransfers(['txn-out', 'txn-in', 'txn-leg']);

        expect(count).toBe(2);
        const state = await read();
        expect(transactionOf(state, 'txn-out')?.linkedTransferId).toBeUndefined();
        expect(transactionOf(state, 'txn-leg')?.linkedTransferId).toBe('txn-parent');
      });
    });

    describe('category merge', () => {
      const mergeFixture = (): PortFixture => ({
        accounts: threeAccounts(),
        categories: [
          aCategory('cat-source', 'Coffee'),
          aCategory('cat-target', 'Eating out'),
          aCategory('cat-heading-source', 'Spending', { level: 'type' }),
          aCategory('cat-heading-target', 'Saving', { level: 'type' })
        ],
        transactions: [
          aTransaction('txn-1', { category: 'cat-source' }),
          aTransaction('txn-2', { category: 'cat-target' }),
          aTransaction('txn-3', { category: 'cat-source', isSplit: true, amount: -30 })
        ],
        splits: [
          { id: 'line-1', transactionId: 'txn-3', category: 'cat-source', amount: -10, sortOrder: 1 },
          { id: 'line-2', transactionId: 'txn-3', category: 'cat-source', amount: -20, sortOrder: 2 }
        ],
        budgets: [
          {
            id: 'budget-1',
            categoryId: 'cat-source',
            amount: 50,
            period: 'monthly',
            isActive: true,
            spent: 0,
            createdAt: AT('2025-01-01'),
            updatedAt: AT('2025-01-01')
          }
        ]
      });

      it('moves every reference, then removes the source', async () => {
        const { port, read } = await harness.create(mergeFixture());

        const result = await port.mergeCategories('cat-source', 'cat-target');

        expect(result).toMatchObject({
          sourceId: 'cat-source',
          targetId: 'cat-target',
          transactions: 2,
          splitLines: 2,
          // Two lines of ONE parent: the lines stay two, because adding them
          // together would destroy the user's own breakdown.
          splitTransactions: 1,
          budgets: 1
        });

        const state = await read();
        expect(state.categories.some(category => category.id === 'cat-source')).toBe(false);
        expect(state.transactions.filter(t => t.category === 'cat-target')).toHaveLength(3);
        expect(state.splits.every(line => line.category === 'cat-target')).toBe(true);
        expect(state.budgets[0].categoryId).toBe('cat-target');
      });

      it('judges the source before the target', async () => {
        // Both sides are top-level headings here, so both guards would fire.
        // Which sentence the user sees is decided by the ORDER, and the order
        // is part of the contract: they are asked to think about what they are
        // merging away first.
        const { port } = await harness.create(mergeFixture());

        await expect(port.mergeCategories('cat-heading-source', 'cat-heading-target'))
          .rejects.toThrow(/not a category things are filed under/i);
      });

      it('refuses to merge a category into itself, and changes nothing', async () => {
        const { port, read } = await harness.create(mergeFixture());
        const before = asComparable(await read());

        await expect(port.mergeCategories('cat-source', 'cat-source'))
          .rejects.toThrow(/cannot be merged into itself/i);

        expect(asComparable(await read())).toBe(before);
      });
    });

    describe('reconciliation and archiving', () => {
      // Dates sit at midday, far from any midnight: which calendar day an
      // instant belongs to is divergence D-8, and these tests are about the
      // sweep, not about the zone.
      it('archives a row that becomes reconciled on or before the account cutoff', async () => {
        const { port, read } = await harness.create({
          accounts: [
            anAccount(ACCOUNT_A, 'Everyday', { archiveThroughDate: AT('2025-02-28') }),
            anAccount(ACCOUNT_B, 'Rainy day', { type: 'savings' })
          ],
          transactions: [
            aTransaction('txn-old', { date: AT('2025-01-15') }),
            aTransaction('txn-new', { date: AT('2025-03-15') })
          ]
        });

        const count = await port.setTransactionsCleared(['txn-old', 'txn-new'], true);

        expect(count).toBe(2);
        const state = await read();
        expect(transactionOf(state, 'txn-old')).toMatchObject({ cleared: true, archived: true });
        expect(transactionOf(state, 'txn-new')?.cleared).toBe(true);
        expect(transactionOf(state, 'txn-new')?.archived).not.toBe(true);
      });

      it('archives reconciled rows up to a cutoff and leaves the rest alone', async () => {
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [
            aTransaction('txn-cleared', { date: AT('2025-01-15'), cleared: true }),
            aTransaction('txn-unreconciled', { date: AT('2025-01-16'), cleared: false }),
            aTransaction('txn-later', { date: AT('2025-03-15'), cleared: true }),
            aTransaction('txn-other-account', {
              accountId: ACCOUNT_B,
              date: AT('2025-01-15'),
              cleared: true
            })
          ]
        });

        const count = await port.archiveTransactionsBefore(ACCOUNT_A, AT('2025-02-28'));

        expect(count).toBe(1);
        const state = await read();
        expect(transactionOf(state, 'txn-cleared')?.archived).toBe(true);
        expect(transactionOf(state, 'txn-unreconciled')?.archived).not.toBe(true);
        expect(transactionOf(state, 'txn-later')?.archived).not.toBe(true);
        expect(transactionOf(state, 'txn-other-account')?.archived).not.toBe(true);
        expect(state.accounts.find(account => account.id === ACCOUNT_A)?.archiveThroughDate).toBeTruthy();
      });

      it('brings an account back out of the archive', async () => {
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [
            aTransaction('txn-1', { cleared: true, archived: true }),
            aTransaction('txn-2', { accountId: ACCOUNT_B, cleared: true, archived: true })
          ]
        });

        const count = await port.unarchiveAccount(ACCOUNT_A);

        expect(count).toBe(1);
        const state = await read();
        expect(transactionOf(state, 'txn-1')?.archived).toBe(false);
        expect(transactionOf(state, 'txn-2')?.archived).toBe(true);
      });

      it('fills only the blanks when a category is applied in bulk', async () => {
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [
            aTransaction('txn-blank', { category: '' }),
            aTransaction('txn-filed', { category: 'cat-bills' })
          ]
        });

        const count = await port.applyCategoryToUncategorized(
          ['txn-blank', 'txn-filed'],
          'cat-everyday'
        );

        expect(count).toBe(1);
        const state = await read();
        // Filed by the user's own decision, so it counts as confirmed, not as
        // another guess for them to agree with later.
        expect(transactionOf(state, 'txn-blank')).toMatchObject({
          category: 'cat-everyday',
          categoryConfirmed: true
        });
        expect(transactionOf(state, 'txn-filed')?.category).toBe('cat-bills');
      });

      it('confirms only the rows still waiting to be agreed with', async () => {
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [
            aTransaction('txn-guessed', { categoryConfirmed: false }),
            aTransaction('txn-known', { categoryConfirmed: true })
          ]
        });

        const count = await port.confirmTransactionCategories(['txn-guessed', 'txn-known']);

        expect(count).toBe(1);
        expect(transactionOf(await read(), 'txn-guessed')?.categoryConfirmed).toBe(true);
      });
    });

    describe('dismissed suggestions', () => {
      it('records a refusal once, however many times it is asked', async () => {
        // A double-click, or a second device, must not turn a decision into an
        // error message.
        const { port, read } = await harness.create({ accounts: threeAccounts() });

        const first = await port.dismissSuggestion('duplicate', 'subject-key', ['txn-1', 'txn-2']);
        const second = await port.dismissSuggestion('duplicate', 'subject-key', ['txn-1', 'txn-2']);

        expect(second.id).toBe(first.id);
        expect((await read()).dismissals).toHaveLength(1);
        expect(await port.listSuggestionDismissals()).toHaveLength(1);
      });

      it('forgets a refusal about a row that no longer exists', async () => {
        // A suggestion about a deleted row can never be offered again, so its
        // refusal is dead weight. The cloud does this with a trigger; every
        // other engine has to do it too, or a restored backup carries junk.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1'), aTransaction('txn-2', { amount: 10 })],
          dismissals: [
            {
              id: 'dismissal-1',
              kind: 'duplicate',
              subjectKey: 'subject-key',
              subjectIds: ['txn-1', 'txn-2'],
              dismissedAt: AT('2025-01-05')
            }
          ]
        });

        await port.deleteTransaction('txn-1');

        expect((await read()).dismissals).toHaveLength(0);
      });

      it('offers a suggestion again once the refusal is undone', async () => {
        const { port } = await harness.create({
          accounts: threeAccounts(),
          dismissals: [
            {
              id: 'dismissal-1',
              kind: 'duplicate',
              subjectKey: 'subject-key',
              subjectIds: ['txn-1'],
              dismissedAt: AT('2025-01-05')
            }
          ]
        });

        await port.restoreSuggestion('duplicate', 'subject-key');

        expect(await port.listSuggestionDismissals()).toHaveLength(0);
      });
    });

    describe('archiving one row', () => {
      it('hides it without deleting it, and can put it back', async () => {
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1', { amount: -0.2 })]
        });

        await port.setTransactionArchived('txn-1', true);
        let state = await read();
        expect(transactionOf(state, 'txn-1')?.archived).toBe(true);
        // Archiving is not deleting: the money is still counted.
        expect(balanceOf(state, ACCOUNT_A)).toBe(-70.1);

        await port.setTransactionArchived('txn-1', false);
        state = await read();
        expect(transactionOf(state, 'txn-1')?.archived).toBe(false);
      });
    });

    describe('watching for changes made elsewhere', () => {
      it(`B-8: the handle is callable, idempotent and final — and this engine ${SUBSCRIPTION_DELIVERY[engine].describes}`, async () => {
        const { port } = await harness.create({ accounts: threeAccounts() });

        const heard: string[] = [];
        const stop = port.subscribeToUpdates({
          onAccountUpdate: () => heard.push('account'),
          onTransactionUpdate: () => heard.push('transaction')
        });

        // The caller stores this and calls it from a React cleanup. A handle
        // that is not a function takes the whole provider down on unmount.
        expect(typeof stop).toBe('function');

        await port.createTransaction({
          accountId: ACCOUNT_A,
          amount: -12.5,
          date: AT('2025-01-12'),
          description: 'Heard or not',
          category: 'cat-everyday',
          type: 'expense'
        });
        await settle();

        // An engine that never delivers must stay silent through a write it
        // made itself. One that does deliver may say anything at all — twice,
        // late, or in the wrong order — so nothing is asserted about it here.
        if (SUBSCRIPTION_DELIVERY[engine].delivers === 'never') {
          expect(heard).toEqual([]);
        }

        // Idempotent, and said twice on purpose: the boot's cleanup drains its
        // handles, and a fast user switch can reach the same one again.
        stop();
        stop();

        // Final. Whatever this engine had to say, it stops saying it. An engine
        // that really delivers needs a wider window than `settle` to make this
        // assertion mean anything — widening it is the harness's business, and
        // the harness that delivers does not exist yet.
        const heardBefore = heard.length;
        await port.createTransaction({
          accountId: ACCOUNT_A,
          amount: -3.25,
          date: AT('2025-01-13'),
          description: 'After the handle was used',
          category: 'cat-everyday',
          type: 'expense'
        });
        await settle();

        expect(heard.length).toBe(heardBefore);
      });
    });

    describe('declared divergences', () => {
      // These are the places the engines are known to differ. Asserting them
      // per engine is the difference between a difference that is recorded and
      // one that is discovered by a user.
      it(`D-7: a field outside the update allow-list — this engine ${UPDATE_OUTSIDE_ALLOW_LIST[engine]} it`, async () => {
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1')]
        });

        // `archived` has a dedicated operation (setTransactionArchived), and
        // the dedicated operation is the contract. Sent on an update anyway,
        // this is what each engine does with it.
        const update = port.updateTransaction('txn-1', { archived: true });

        switch (UPDATE_OUTSIDE_ALLOW_LIST[engine]) {
          case 'applies':
            await update;
            expect(transactionOf(await read(), 'txn-1')?.archived).toBe(true);
            break;
          case 'discards':
            await update;
            expect(transactionOf(await read(), 'txn-1')?.archived).not.toBe(true);
            break;
          case 'refuses':
            await expect(update).rejects.toThrow();
            expect(transactionOf(await read(), 'txn-1')?.archived).not.toBe(true);
            break;
        }
      });

      it(`M-1: an amount below a penny — this engine ${SUB_PENNY_AMOUNT[engine]} it`, async () => {
        const { port, read } = await harness.create({ accounts: threeAccounts() });

        const write = port.createTransaction({
          accountId: ACCOUNT_A,
          amount: -0.125,
          date: AT('2025-01-11'),
          description: 'Sub-penny',
          category: 'cat-everyday',
          type: 'expense'
        });

        switch (SUB_PENNY_AMOUNT[engine]) {
          case 'keeps': {
            const created = await write;
            expect(created.amount).toBe(-0.125);
            break;
          }
          case 'rounds': {
            const created = await write;
            expect(Math.abs(created.amount)).toBeCloseTo(0.13, 10);
            break;
          }
          case 'refuses':
            await expect(write).rejects.toThrow();
            expect((await read()).transactions).toHaveLength(0);
            break;
        }
      });
    });

    // ── The whole ledger out, and back in ─────────────────────────────────
    //
    // The only operations here whose failure costs a person everything rather
    // than one row. The rules are the same three in every engine: "empty"
    // means the same question, a file poured into an empty store reproduces
    // the ledger it came from, and anything the store cannot keep comes back
    // named instead of vanishing.
    describe('backup and restore', () => {
      /**
       * A ledger with something in every table this suite can seed.
       *
       * The SPLIT and the DISMISSAL are not padding. They are the two tables a
       * partial job is most likely to miss and least likely to be noticed
       * missing: a split hangs off a transaction rather than off the store, and
       * a dismissal hangs off nothing at all — no account to cascade from, no
       * screen that would look empty if it survived. Both are carried by a
       * backup file, so both decide whether "wiped" is true enough for the
       * restore that follows. A fixture without them lets an engine that clears
       * the obvious five pass every assertion below.
       */
      const aWholeLedger = (): PortFixture => ({
        accounts: threeAccounts(),
        categories: [aCategory('cat-everyday', 'Everyday spending')],
        transactions: [
          aTransaction('txn-1', { amount: -10.1, description: 'Corner shop' }),
          aTransaction('txn-2', {
            accountId: ACCOUNT_B,
            amount: 500,
            description: 'Payday',
            type: 'income'
          }),
          aTransaction('txn-3', {
            amount: -30,
            description: 'Weekly shop',
            isSplit: true,
            category: ''
          })
        ],
        splits: [
          { id: 'line-1', transactionId: 'txn-3', category: 'cat-everyday', amount: -10, sortOrder: 1 },
          { id: 'line-2', transactionId: 'txn-3', category: 'cat-bills', amount: -20, sortOrder: 2 }
        ],
        budgets: [aBudget('budget-1', 'cat-everyday', 200)],
        goals: [aGoal('goal-1', 'New boiler', 1500)],
        dismissals: [
          {
            id: 'dismissal-1',
            kind: 'duplicate',
            subjectKey: 'corner-shop-10-10',
            subjectIds: ['txn-1'],
            dismissedAt: AT('2025-01-05')
          }
        ]
      });

      /**
       * Everything about a file except WHEN it was taken.
       *
       * Two backups of the same untouched ledger are the same backup; the
       * timestamp is a note about the act of exporting, not about the data,
       * and comparing it would only ever assert that a clock moved.
       */
      const contents = (bundle: BackupBundle) => ({
        format: bundle.format,
        schemaVersion: bundle.schemaVersion,
        counts: bundle.counts,
        data: bundle.data,
        links: bundle.links,
        preferences: bundle.preferences
      });

      it('says a fresh store is empty, and says otherwise the moment it holds anything', async () => {
        // The question the restore dialog asks before it offers the button, so
        // a wrong answer either refuses a restore that was safe or allows one
        // over a login full of data.
        const fresh = await harness.create({});
        expect(await fresh.port.financialDataIsEmpty()).toBe(true);

        const holding = await harness.create({ accounts: threeAccounts() });
        expect(await holding.port.financialDataIsEmpty()).toBe(false);
      });

      it('empties the store, and then agrees that it is empty', async () => {
        // The two operations have to answer the same question about one store.
        // A wipe that emptied what it felt like and an emptiness check that
        // asked about something else would give the restore dialog two
        // different answers about the same login — and the one it acts on is
        // the one that unlocks the button.
        const { port, read } = await harness.create(aWholeLedger());
        expect(await port.financialDataIsEmpty()).toBe(false);

        await port.wipeAllFinancialData();

        expect(await port.financialDataIsEmpty()).toBe(true);
        const after = await read();
        expect(after.accounts).toEqual([]);
        expect(after.transactions).toEqual([]);
        expect(after.categories).toEqual([]);
        expect(after.budgets).toEqual([]);
        expect(after.goals).toEqual([]);
        // The two that hang off something other than the store, and are
        // therefore the two an incomplete wipe leaves behind in silence.
        expect(after.splits).toEqual([]);
        expect(after.dismissals).toEqual([]);
      });

      it('is safe to run twice, because that is the recovery when it stops', async () => {
        // Idempotence is not tidiness here, it is the whole repair. An engine
        // that erases in pieces cannot avoid stopping part-way (one statement
        // over 51,000 rows is cancelled by the database's own timeout, which is
        // why it is in pieces at all), so it makes that state SAFE instead:
        // deleting rows that have already gone is a no-op, and the dialog's
        // advice — run it again — has to be true rather than hopeful.
        const { port, read } = await harness.create(aWholeLedger());

        await port.wipeAllFinancialData();
        const afterFirst = asComparable(await read());

        await expect(port.wipeAllFinancialData()).resolves.toBeUndefined();

        expect(asComparable(await read())).toBe(afterFirst);
        expect(await port.financialDataIsEmpty()).toBe(true);
      });

      it('erases a store a file can then be poured straight back into', async () => {
        // THE ROUND TRIP, closed: collect → wipe → restore → collect. Slice 9
        // could prove the middle two against a store that started empty; this
        // is the journey a real person makes, which always begins with a login
        // that already holds their life.
        //
        // It is also what pins how much a wipe has to delete. "Empty" for the
        // flag is three tables; a file carries fourteen. An engine that cleared
        // the three and left one the file also holds would pass every
        // assertion above and then fail HERE — which is exactly where it fails
        // in real life, half-way through a restore, in front of somebody who
        // has just deliberately erased their own login.
        const store = await harness.create(aWholeLedger());
        const file = await store.port.collectBackup();

        await store.port.wipeAllFinancialData();
        await store.port.restoreBackup(file);

        const again = await store.port.collectBackup();

        // Row for row and penny for penny, matched by name because every id is
        // minted anew on the way in.
        expect(again.counts).toEqual(file.counts);
        const namesOf = (bundle: BackupBundle, entity: BackupEntity, field: string): string[] =>
          bundle.data[entity].map(row => String(row[field])).sort();
        expect(namesOf(again, 'accounts', 'name')).toEqual(namesOf(file, 'accounts', 'name'));
        expect(namesOf(again, 'transactions', 'description'))
          .toEqual(namesOf(file, 'transactions', 'description'));
        expect(namesOf(again, 'transactions', 'amount'))
          .toEqual(namesOf(file, 'transactions', 'amount'));
        expect(namesOf(again, 'categories', 'name')).toEqual(namesOf(file, 'categories', 'name'));
        expect(namesOf(again, 'budgets', 'amount')).toEqual(namesOf(file, 'budgets', 'amount'));
        expect(namesOf(again, 'goals', 'name')).toEqual(namesOf(file, 'goals', 'name'));
      });

      it('pours a file into an empty store and gets the same ledger back, to the penny', async () => {
        const source = await harness.create(aWholeLedger());
        const file = await source.port.collectBackup();

        const target = await harness.create({});
        const outcome = await target.port.restoreBackup(file);

        const before = await source.read();
        const after = await target.read();

        expect(after.accounts.map(account => account.name).sort())
          .toEqual(before.accounts.map(account => account.name).sort());
        expect(after.transactions.map(transaction => transaction.description).sort())
          .toEqual(before.transactions.map(transaction => transaction.description).sort());
        expect(after.categories.map(category => category.name).sort())
          .toEqual(before.categories.map(category => category.name).sort());
        expect(after.budgets.map(budget => budget.amount)).toEqual(before.budgets.map(budget => budget.amount));
        expect(after.goals.map(goal => goal.name)).toEqual(before.goals.map(goal => goal.name));

        // Money survives a trip through the file as money — matched by NAME,
        // because every id is new (see below). -70.1 is the figure that goes
        // wrong in float if anything on the way in or out re-adds the rows.
        const balanceByName = (state: PortStoreState, name: string): number | undefined =>
          state.accounts.find(account => account.name === name)?.balance;
        expect(balanceByName(after, 'Everyday')).toBe(balanceByName(before, 'Everyday'));
        expect(balanceByName(after, 'Rainy day')).toBe(balanceByName(before, 'Rainy day'));
        expect(balanceByName(after, 'Everyday')).toBe(-70.1);

        // Nothing the file held was left unaccounted for, and the store now
        // answers the emptiness question the other way.
        expect(outcome.restored.some(entry => entry.rows > 0)).toBe(true);
        expect(await target.port.financialDataIsEmpty()).toBe(false);

        // EVERY ID IS NEW. The primary keys in a backup are unique across the
        // whole store rather than per owner, so a restore that kept them would
        // collide with the rows of whoever exported the file — which is the
        // main case a backup exists for.
        const oldIds = new Set(before.accounts.map(account => account.id));
        expect(after.accounts.every(account => !oldIds.has(account.id))).toBe(true);
        // And the rows that pointed at those accounts followed them.
        const byName = new Map(after.accounts.map(account => [account.name, account.id]));
        const everyday = after.transactions.find(t => t.description === 'Corner shop');
        expect(everyday?.accountId).toBe(byName.get('Everyday'));
      });

      it('a restored ledger exports to the same file again, and again', async () => {
        // Generation 2 against generation 3, because generation 1 carries the
        // ids the fixture invented and every restore mints new ones. Two
        // restores from a store that starts fresh produce the same ids in the
        // same order, so a conversion that lost or invented a field on the way
        // through the file drifts between generations and shows up here.
        const source = await harness.create(aWholeLedger());
        const first = await source.port.collectBackup();

        const secondStore = await harness.create({});
        await secondStore.port.restoreBackup(first);
        const second = await secondStore.port.collectBackup();

        const thirdStore = await harness.create({});
        await thirdStore.port.restoreBackup(second);
        const third = await thirdStore.port.collectBackup();

        expect(contents(third)).toEqual(contents(second));
      });

      it('refuses to restore over a store that still holds something, and changes nothing', async () => {
        // A restore REPLACES; it does not merge. Refusing is what makes it safe
        // to attempt at all — nothing the user already has can be mixed with
        // the file, re-dated, or half-overwritten.
        const source = await harness.create(aWholeLedger());
        const file = await source.port.collectBackup();

        const occupied = await harness.create({ accounts: threeAccounts() });
        const before = asComparable(await occupied.read());

        await expect(occupied.port.restoreBackup(file)).rejects.toThrow();
        expect(asComparable(await occupied.read())).toBe(before);
      });

      it(
        BACKUP_COVERAGE[engine].notStored.length === 0
          ? 'holds every table the format carries, and says so'
          : `names the ${BACKUP_COVERAGE[engine].notStored.length} tables it cannot keep instead of dropping them in silence`,
        async () => {
          // B-11. "3 investments were skipped" tells somebody nothing they can
          // act on; knowing the file still holds them, and where they would
          // come back, does. So the answer is a list of names with reasons.
          const source = await harness.create(aWholeLedger());
          const file = await source.port.collectBackup();

          const unstorable = BACKUP_COVERAGE[engine].notStored;
          const row: BackupRow = { id: 'row-the-file-carries', user_id: 'source-login' };
          const carried: BackupBundle = {
            ...file,
            data: { ...file.data },
            counts: { ...file.counts }
          };
          for (const { entity } of unstorable) {
            carried.data[entity] = [row];
            carried.counts[entity] = 1;
          }

          const target = await harness.create({});
          const outcome = await target.port.restoreBackup(carried);

          expect(outcome.notStoredLocally.map(entry => entry.label).sort())
            .toEqual(unstorable.map(entry => entry.label).sort());
          // Every one of them carries a sentence, not a count.
          for (const entry of outcome.notStoredLocally) {
            expect(entry.rows).toBe(1);
            expect(entry.absence.length).toBeGreaterThan(0);
          }
        }
      );
    });
  });
}
