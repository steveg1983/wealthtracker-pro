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
 *  - the reconcile-sweep, dismissal pruning and dismissal idempotence;
 *  - and the DECLARED divergences (D-7, M-1), asserted per engine so that a
 *    difference between implementations is recorded rather than discovered.
 *
 * This file is not itself a test: it exports a function. `*.contract.test.ts`
 * files call it.
 */

import { describe, it, expect } from 'vitest';
import type { DataPort } from '../dataPort';
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
  'getAccounts',
  'getClosedAccounts',
  'getTransactions',
  'loadBootTransactions',
  'getAccountBalances',
  'getAllTransactionSplits',
  'getTransactionSplits',
  'getBudgets',
  'getGoals',
  'getCategories',
  'getSuggestionDismissals',
  // Account writes
  'createAccount',
  'updateAccount',
  'deleteAccount',
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
  'mergeCategories',
  // Dismissal writes
  'dismissSuggestion',
  'restoreSuggestion',
  // Lifecycle
  'initialize',
  'prepareCategories',
  'subscribeToUpdates'
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

        const listed = await port.getAccounts();
        expect(listed.find(account => account.id === stored.id)).toMatchObject({
          lowBalanceAlertEnabled: true,
          accountNumber: '12345678',
          sortCode: '00-00-00'
        });
      });

      it('closes an account rather than deleting it', async () => {
        // A deleted account is a hole in a ledger: its transactions would have
        // nowhere to belong. Every engine soft-closes.
        const { port, read } = await harness.create({
          accounts: threeAccounts(),
          transactions: [aTransaction('txn-1')]
        });

        await port.deleteAccount(ACCOUNT_A);

        const state = await read();
        expect(state.accounts.find(account => account.id === ACCOUNT_A)?.isActive).toBe(false);
        expect(transactionOf(state, 'txn-1')).toBeDefined();

        const closed = await port.getClosedAccounts();
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
        expect((await port.getCategories()).map(category => category.id).sort())
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

        expect((await mine.port.getBudgets()).map(budget => budget.id)).toEqual(['budget-mine']);
        expect((await mine.port.getGoals()).map(goal => goal.id)).toEqual(['goal-mine']);
        expect((await theirs.port.getBudgets()).map(budget => budget.id)).toEqual(['budget-theirs']);
        expect((await theirs.port.getGoals()).map(goal => goal.id)).toEqual(['goal-theirs']);
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

        expect((await port.getBudgets())[0].amount).toBe(70.1);
        expect((await port.getGoals())[0].targetAmount).toBe(0.3);
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
        expect((await port.getBudgets()).map(budget => [budget.id, budget.amount]))
          .toEqual([[created.id, 70.1]]);

        const edited = await port.updateBudget(created.id, { amount: 0.3 });

        // The whole budget comes back, not just the field that moved: the
        // caller replaces its copy with this answer.
        expect(edited).toMatchObject({ id: created.id, categoryId: 'cat-everyday', amount: 0.3 });
        expect((await port.getBudgets())[0].amount).toBe(0.3);
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
        expect(await theirs.port.getBudgets()).toEqual([]);
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

        const lines = await port.getTransactionSplits('txn-1');
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
        expect(await port.getSuggestionDismissals()).toHaveLength(1);
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

        expect(await port.getSuggestionDismissals()).toHaveLength(0);
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
  });
}
