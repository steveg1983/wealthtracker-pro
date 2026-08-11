/**
 * The seam, answered by a file on this device.
 *
 * The second implementation of `DataPort`, and the reason the seam was named at
 * all. It holds no SQL, no schema knowledge and no query language: every
 * question it asks is one verb over {@link CoreTransport}, and the ledger crate
 * decides what a verb means. What lives here is the other half of that
 * conversation — the owner, the app's shapes, and the promises the seam makes
 * that a verb cannot make for itself.
 *
 * ── WHAT THIS SLICE IMPLEMENTS, AND WHAT IT ADMITS IT DOES NOT ──────────────
 *
 * The eleven reads, the boot composite, the capability descriptor, the two
 * lifecycle no-ops, the sixteen writes slice 19 wired — and, since slice 20, the
 * three ACCOUNT writes, which are the first the crate had no Postgres function
 * to port (PHASE3-PLAN D-2: the cloud writes `accounts` directly over PostgREST,
 * so the oracle is the TypeScript writer and `schema.sql`'s constraints).
 * TWENTY-TWO operations of the seam are not here yet, and
 * that is a declared, counted, shrinking list rather than a silence: they are
 * named in `services/port/__tests__/contract.ts`'s `NOT_YET` ratchet, the
 * contract suite asserts that the operations this port is missing are EXACTLY
 * that list in both directions, and every rule that needs one of them is
 * skipped BY NAME with the operation printed. The count goes in the title of
 * every pull request that changes it, it may only go down, and the entry is
 * deleted when it reaches zero.
 *
 * ── WHAT A WRITE HANDS BACK, AND THE ONE COLUMN IT CANNOT ───────────────────
 *
 * Every write below answers with the row as stored, mapped by the same
 * `toTransaction` the reads use. It is not quite the same projection: a verb's
 * result is `TransactionRow`, which IS the audit entry's shape, and the audit
 * entry does not carry `needs_review`, `created_at` or `updated_at` (see
 * `crate::row`, which says so and says why neither set is a subset of the
 * other). So a written row comes back with `needsReview: false` and no
 * timestamps, whatever the file now holds.
 *
 * For the two timestamps that is harmless — nothing reads them off a write's
 * answer. For `needs_review` it is a real gap with a small blast radius: an
 * update that did not mention the flag answers `false` for a row that is still
 * new work, so a caller replacing its copy with the answer would un-bold a row
 * in the register until the next read. It is NOT fixed by widening
 * `TransactionRow`, because that would change the audit payload two engines
 * compare field by field and re-chain every hash; the fix is a result
 * projection of its own, and it belongs to the commit that gives this port a
 * caller (slice 27). Written down here rather than discovered there.
 *
 * The class therefore implements {@link LocalDataPortSurface} — the half of the
 * seam it really answers — rather than `DataPort`. That is not a technicality:
 * this file IS compiled by `tsc -b`, so the declaration is a proof, and the day
 * the last write lands the alias is deleted and `implements DataPort` takes its
 * place with the compiler checking it.
 *
 * ── THE OWNER (PHASE3-PLAN D-5) ─────────────────────────────────────────────
 *
 * Seam rule 1: no operation takes a user id, every implementation resolves its
 * own owner. Every read verb in the crate REQUIRES one — a local file can hold
 * more than one login's rows (a restored backup from an account that had two)
 * and there is no RLS to narrow an answer afterwards — so the port must have an
 * owner before it can ask anything.
 *
 * Whose? Not `LOCAL_SOURCE_USER_ID` ('local-device'): `schema.sql`'s users table
 * carries `CHECK (id = lower(id) AND length(id) = 36)` and would refuse it. That
 * string stays what it already is, a provenance marker in the browser bundle.
 * The owner of a local file is a uuid minted when the FILE is created, stored in
 * its one `users` row.
 *
 * **This slice does not mint it, because nothing opens files yet.** `create_file`
 * and `open_file` are the desktop shell's (PHASE3-PLAN §5, slice 27) and the
 * identity work is slice 28. What lands here is the shape of the answer: the
 * port is CONSTRUCTED with the open document — its transport and its owner —
 * and caches that owner for the document's life, which is D-5's *"resolves
 * owner ONCE at open"* with the resolution living in the thing that opens files.
 * A port is never told an owner per call, and there is nowhere to pass one.
 *
 * The uuid shape is CHECKED at construction rather than trusted, so R-3 fails
 * here — by name, with the schema's own rule quoted — instead of as a foreign
 * key violation on the first write, or as an empty ledger on the first read.
 *
 * ── THE READS THAT MAY NOT REJECT ───────────────────────────────────────────
 *
 * `loadBoot`, `loadBootTransactions` and `getAccountBalances` are the three the
 * seam says never reject, and this is where that is made true for a file. The
 * boot effect has ONE outer catch and reaching it replaces the whole app with
 * "Failed to load data" — for somebody whose ledger is fine and whose next
 * launch would have worked. So a transport that rejects costs whatever could
 * not be read, said out loud, and never a thrown promise. The crate deliberately
 * does NOT soften its own storage faults for the same reason its `load_boot`
 * documentation gives: six empty lists is what a NEW FILE legitimately answers
 * with, and a verb that said the same thing about a file it could not open would
 * make the two indistinguishable. One layer knows the difference, and it is this
 * one.
 *
 * ── THE STATS VOCABULARY IS THIS FILE'S, AND IT HAS TWO WORDS ───────────────
 *
 * `BootTransactionStats.fullFetchReason` says where a boot's rows came from.
 * Divergence B-1 gives the local core `'local mode'` — the same word browser
 * storage uses, and honest for the same reason: there is no snapshot layer,
 * because the rows are already on the device. The other word is `'load failed'`,
 * which is what `DataServiceImpl` already says when its own store will not open,
 * and it is the only answer available for a call that did not happen. A verb
 * cannot answer for the case where the verb did not run, which is why both words
 * live here rather than in the crate.
 */

import type {
  Account,
  AccountUpdate,
  Budget,
  Category,
  CategoryMergeResult,
  Goal,
  SplitWriteResult,
  SuggestionDismissal,
  Transaction,
  TransactionSplit,
  TransactionSplitInput
} from '../../types';
import type {
  AccountBalanceSnapshot,
  BootSnapshot,
  BootTransactionStats,
  BootTransactionsResult,
  BulkImportResult,
  DataPortAccountWrites,
  DataPortBackupLifecycle,
  DataPortBoot,
  DataPortBulkWrites,
  DataPortCapabilities,
  DataPortCapabilityDescriptor,
  DataPortLifecycle,
  DataPortPlanningWrites,
  DataPortReads,
  DataPortTransactionWrites,
  DataPortSplitWrites,
  DataPortTransferWrites,
  MoneyNumber
} from '../port/dataPort';
import type { CoreTransport } from './coreTransport';
import { countOf, field, listOf, money, rowOf, rowsOf, textOf } from './mappers/values';
import {
  toAccount,
  toBalance,
  toBudget,
  toCategory,
  toDismissal,
  toGoal,
  toSplit,
  toTransaction
} from './mappers/rows';
import {
  toAccountCreatePayload,
  toAccountUpdatePatch,
  toCreatePayload,
  toImportRow,
  toSplitLine,
  toUpdatePatch
} from './mappers/writes';

/**
 * The half of the seam this slice answers.
 *
 * Written as an intersection so `tsc -b` checks every operation that IS
 * claimed. Deleted at slice 25, when the class says `implements DataPort` and
 * the compiler checks all fifty-six.
 */
export type LocalDataPortSurface =
  DataPortReads &
  DataPortBoot &
  DataPortAccountWrites &
  DataPortBulkWrites &
  DataPortSplitWrites &
  DataPortCapabilityDescriptor &
  Omit<
    DataPortTransactionWrites,
    | 'setTransactionsCleared'
    | 'finalizeReconciliation'
    | 'setTransactionArchived'
    | 'archiveTransactionsBefore'
    | 'unarchiveAccount'
  > &
  Omit<DataPortTransferWrites, 'repointTransfer'> &
  Pick<DataPortPlanningWrites, 'deleteUnusedCategories' | 'mergeCategories'> &
  Pick<DataPortBackupLifecycle, 'financialDataIsEmpty' | 'wipeAllFinancialData'> &
  Pick<DataPortLifecycle, 'initialize' | 'subscribeToUpdates'>;

/**
 * An open ledger file, as the port needs to see it.
 *
 * Two things and no more: how to ask it questions, and whose rows it holds.
 * Whatever opened the document supplies both — the harness for a spec, the
 * shell's `open_file` for a person.
 */
export interface LocalDocument {
  /** The uuid in the file's one `users` row, read when the document opened. */
  owner: string;
  /** How this document is reached. See {@link CoreTransport}. */
  transport: CoreTransport;
  /**
   * Where a read that could not happen is reported. Structural and injected
   * rather than the app's `createScopedLogger`, which reaches the cloud's
   * logging service: the desktop bundle must be able to answer PHASE3-PLAN §5's
   * "zero supabase" grep, and a logger is not worth failing it for. Defaults to
   * the console, never to silence — a boot that quietly served an empty ledger
   * is the failure this whole family of catches is designed around.
   */
  logger?: { error: (message: string, error: unknown) => void };
}

/** `users.id` must be a lowercase 36-character uuid — `schema.sql`'s CHECK. */
const OWNER_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * What a file on a device can do. Answered from constants, because every one of
 * these is a property of the engine rather than of the data in it, and the seam
 * requires the answer synchronously (`dataPort.ts`: every consumer is a render
 * or the tick of a write).
 */
const DEVICE_CAPABILITIES: DataPortCapabilities = {
  // WORDS ONLY. Nothing branches on this; the four below are what decisions are
  // taken from. See `editionIsCopyOnly.test.ts`, which greps for the breach.
  edition: 'device',
  // Not a degraded 'ready'. The seam blesses this exactly: 'anonymous' is
  // "nobody is signing in… a device edition that has no logins at all", and it
  // is a perfectly good state to work in. 'connecting' would make the screens
  // that start irreversible work refuse forever.
  session: 'anonymous',
  // One file on one machine. Nothing else can change it, so nothing arrives.
  realtime: false,
  // ONE, and the sentence the seam asks for: the desktop holds one connection
  // behind a mutex, which is a QUEUE rather than concurrency. Answering 8 would
  // not make two writes overlap, it would make eight callers wait in a way none
  // of them was told about, and the caller that batched by this number would be
  // sizing its batches against a number that means nothing.
  maxConcurrentWrites: 1,
  // The file IS the only copy. That is a materially different thing to tell
  // somebody before they close the window, and the two backup screens say it
  // from here.
  backupTarget: 'device'
};

/** The two words this port's boot stats are allowed to use. See the header. */
const LOCAL_MODE = 'local mode';
const LOAD_FAILED = 'load failed';

/**
 * The phrase `wipe_user_financial_data` demands before it will do anything.
 *
 * Stated here rather than carried across the seam: see `wipeAllFinancialData`
 * below for why the confirmation belongs to the screen and the phrase belongs
 * to the implementation.
 */
const WIPE_CONFIRMATION = 'DELETE EVERYTHING';

const failedStats = (): BootTransactionStats => ({
  cached: 0,
  fetched: 0,
  total: 0,
  fullFetchReason: LOAD_FAILED
});

export class LocalDataPort implements LocalDataPortSurface {
  readonly #owner: string;

  readonly #transport: CoreTransport;

  readonly #logger: { error: (message: string, error: unknown) => void };

  constructor(document: LocalDocument) {
    if (!OWNER_SHAPE.test(document.owner)) {
      // R-3, refused where it can still be understood. `schema.sql` would
      // refuse this too — `CHECK (id = lower(id) AND length(id) = 36)` on
      // users — but only on a write, and every read would meanwhile answer
      // with an empty ledger, which reads exactly like a new file.
      throw new Error(
        `A local ledger is owned by the uuid in its own users row, and ${JSON.stringify(
          document.owner
        )} is not one. The file's schema refuses any id that is not 36 lowercase characters.`
      );
    }
    this.#owner = document.owner;
    this.#transport = document.transport;
    this.#logger = document.logger ?? {
      error: (message, error) => {
        console.error(`[LocalDataPort] ${message}`, error);
      }
    };
  }

  /**
   * One verb, asked of this document's owner.
   *
   * The owner is added HERE and only here, which is what makes seam rule 1 a
   * property of the code rather than a habit: there is no method below that
   * could accidentally send someone else's id, because none of them builds a
   * payload with a `user_id` in it.
   */
  async #ask(verb: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    return this.#transport.call(verb, { user_id: this.#owner, ...payload });
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  async listAccounts(): Promise<Account[]> {
    const answer = await this.#ask('list_accounts');
    return rowsOf(answer, 'list_accounts', 'accounts').map(toAccount);
  }

  async listClosedAccounts(): Promise<Account[]> {
    const answer = await this.#ask('list_closed_accounts');
    return rowsOf(answer, 'list_closed_accounts', 'closed_accounts').map(toAccount);
  }

  async listTransactions(): Promise<Transaction[]> {
    const answer = await this.#ask('list_transactions');
    return rowsOf(answer, 'list_transactions', 'transactions').map(toTransaction);
  }

  /**
   * The boot's transaction read.
   *
   * The same verb `listTransactions` asks, and a different QUESTION: this one
   * is allowed to serve a snapshot and report that it did. A file has no
   * snapshot layer to serve from, so it reports the truth — B-1's `'local
   * mode'`, `cached: 0` — and the rows are the same rows either way.
   *
   * NEVER REJECTS. See the header.
   */
  async loadBootTransactions(): Promise<BootTransactionsResult> {
    try {
      const transactions = await this.listTransactions();
      return {
        transactions,
        stats: {
          cached: 0,
          fetched: transactions.length,
          total: transactions.length,
          fullFetchReason: LOCAL_MODE
        }
      };
    } catch (error) {
      this.#logger.error('The ledger file could not be read for the boot', error);
      return { transactions: [], stats: failedStats() };
    }
  }

  /**
   * Every account's balance, DERIVED by the file.
   *
   * NEVER REJECTS AND NEVER GUESSES: an empty map means "I don't know" and the
   * app sums the rows itself. A map of zeros would be a different answer
   * entirely — the seeding rule keys off the map being non-empty, so zeros
   * would paint every account at £0.00 and present it as real money.
   *
   * B-2 gives the local core 'answers', and the verb behind it is the one place
   * in this engine that computes money rather than reading it: it aggregates,
   * it counts archived rows in (archiving is a view flag and never moves a
   * balance), and it never touches `accounts.balance`. Those properties are the
   * crate's, asserted there; what matters here is that this is a SECOND opinion
   * about a figure the app also computes for itself, and two numbers are only
   * worth having while they are arrived at independently.
   */
  async getAccountBalances(): Promise<ReadonlyMap<string, AccountBalanceSnapshot>> {
    const balances = new Map<string, AccountBalanceSnapshot>();
    try {
      const answer = await this.#ask('account_balances');
      for (const row of rowsOf(answer, 'account_balances', 'account_balances')) {
        const { accountId, snapshot } = toBalance(row);
        balances.set(accountId, snapshot);
      }
    } catch (error) {
      this.#logger.error('The ledger file could not compute its balances', error);
      return new Map();
    }
    return balances;
  }

  async listTransactionSplits(): Promise<TransactionSplit[]> {
    const answer = await this.#ask('list_transaction_splits');
    return rowsOf(answer, 'list_transaction_splits', 'transaction_splits').map(toSplit);
  }

  async listTransactionSplitsFor(transactionId: string): Promise<TransactionSplit[]> {
    const answer = await this.#ask('splits_for', { transaction_id: transactionId });
    return rowsOf(answer, 'splits_for', 'splits').map(toSplit);
  }

  async listBudgets(): Promise<Budget[]> {
    const answer = await this.#ask('list_budgets');
    return rowsOf(answer, 'list_budgets', 'budgets').map(toBudget);
  }

  async listGoals(): Promise<Goal[]> {
    const answer = await this.#ask('list_goals');
    return rowsOf(answer, 'list_goals', 'goals').map(toGoal);
  }

  async listCategories(): Promise<Category[]> {
    const answer = await this.#ask('list_categories');
    return rowsOf(answer, 'list_categories', 'categories').map(toCategory);
  }

  async listSuggestionDismissals(): Promise<SuggestionDismissal[]> {
    const answer = await this.#ask('list_suggestion_dismissals');
    return rowsOf(answer, 'list_suggestion_dismissals', 'suggestion_dismissals').map(toDismissal);
  }

  // ── The boot, in one crossing ─────────────────────────────────────────────

  /**
   * Everything the app boots with, from ONE snapshot of ONE file.
   *
   * BOOT_COMPOSITION's local-core row is `{ fansOut: false }`, and this method
   * is what makes it true: it does not call the reads above, it asks the
   * `load_boot` verb, which wraps six reads in one deferred read transaction.
   * The ordering rules the cloud has to KEEP — categories before transactions,
   * budgets and goals together — are not kept here; they are unable to be
   * broken here, which is a stronger property and the reason the contract suite
   * asserts a different shape for this engine.
   *
   * ONE phase, timed here. The cloud names five because it makes five crossings
   * and any one of them can be the slow one; there is one crossing here, so a
   * second name would be an invented breakdown of an indivisible answer. What
   * the six parts cost is measured where measuring means something —
   * `tests/reads_at_scale.rs`, on a fifty-thousand-row ledger.
   *
   * `getAccountBalances` is NOT folded in, and the omission is load-bearing
   * even for a file that could answer instantly: the seeding rule it feeds
   * fires only while `transactions.length === 0`, so an early answer that
   * arrives WITH the transactions is the same as no answer at all.
   *
   * NEVER REJECTS. See the header.
   */
  async loadBoot(): Promise<BootSnapshot> {
    const phases: Record<string, number> = {};
    const started = performance.now();

    const snapshot: BootSnapshot = {
      accounts: [],
      categories: [],
      transactions: [],
      transactionStats: failedStats(),
      splits: [],
      budgets: [],
      goals: [],
      phases
    };

    try {
      const answer = await this.#ask('load_boot');
      snapshot.accounts = rowsOf(answer, 'load_boot', 'accounts').map(toAccount);
      snapshot.categories = rowsOf(answer, 'load_boot', 'categories').map(toCategory);
      snapshot.transactions = rowsOf(answer, 'load_boot', 'transactions').map(toTransaction);
      // The one key that is not the seam's own name for the field: `splits`
      // here is `transaction_splits` there, because the crate names a read
      // after the question it answers and `splits_for` already owns the bare
      // word for one parent's lines.
      snapshot.splits = rowsOf(answer, 'load_boot', 'transaction_splits').map(toSplit);
      snapshot.budgets = rowsOf(answer, 'load_boot', 'budgets').map(toBudget);
      snapshot.goals = rowsOf(answer, 'load_boot', 'goals').map(toGoal);
      snapshot.transactionStats = {
        cached: 0,
        fetched: snapshot.transactions.length,
        total: snapshot.transactions.length,
        fullFetchReason: LOCAL_MODE
      };
    } catch (error) {
      this.#logger.error('The ledger file could not be opened for the boot', error);
    }

    phases.load_boot = Math.round(performance.now() - started);
    return snapshot;
  }

  // ── Account writes ────────────────────────────────────────────────────────

  /**
   * One account, as somebody typed it.
   *
   * ── B-7, AND THE ONE FIELD THE ANSWER CANNOT CARRY ──────────────────────
   *
   * The seam's promise is that a create hands the WHOLE account back, because
   * the caller puts the object straight into app state and the settings modal
   * seeds its form from whatever is there. So the verb answers with the same
   * projection `listAccounts` answers with, read back from storage after the
   * write, and it comes through the same `mapAccountFromDb` — nothing is
   * reconstructed from the request.
   *
   * `creditLimit` is the exception and it is not this port's to fix: no
   * migration has ever created `accounts.credit_limit`, in the cloud or here
   * (`accountMapping.ts` says so and maps it in both directions "for the day the
   * column exists"). The field can only ever arrive from browser storage, and
   * `contract.ts`'s `CREDIT_LIMIT_STORAGE` declares that rather than leaving it
   * to be discovered.
   *
   * ── THE TWO MONEY FIELDS BECOME ONE ─────────────────────────────────────
   *
   * `Omit<Account, 'id'>` carries a balance and an opening balance, and a
   * ledger with no transactions cannot honour two different figures without
   * breaking B-1. `writes.ts` folds them the way the cloud's own writer folds
   * them — `openingBalance || balance || 0` — and the verb has no second money
   * argument to send the loser to. `ACCOUNT_BALANCE_AT_BIRTH` declares it.
   */
  async createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    const answer = await this.#ask('create_account', toAccountCreatePayload(account));
    return toAccount(rowOf(answer, 'create_account', 'answer'));
  }

  /**
   * A partial edit of an account.
   *
   * The patch is passed through WHOLE rather than filtered, for the reason
   * `updateTransaction` gives above and `writes.ts` argues at length: an engine
   * that refuses a field it does not recognise can only refuse what it is shown.
   * Here that matches the cloud rather than diverging from it —
   * `mapAccountToDb` sends an unmapped field under its own name and PostgREST
   * refuses the whole update, because there is no such column.
   *
   * The field worth naming is `balance`. `AccountUpdate` is a
   * `Partial<Account>`, so a caller can state one, and the cloud will WRITE it —
   * an absolute balance setter, unaudited, with no transaction to justify the
   * figure. It crosses this seam unchanged and the verb refuses it by name.
   */
  async updateAccount(id: string, updates: AccountUpdate): Promise<Account> {
    const answer = await this.#ask('update_account', {
      id,
      patch: toAccountUpdatePatch(updates)
    });
    return toAccount(rowOf(answer, 'update_account', 'answer'));
  }

  /**
   * Close an account, which is a soft close in every implementation.
   *
   * The seam is explicit: *"the account leaves the live list and its
   * transactions stay exactly where they are. Nothing in this seam hard-deletes
   * an account, because a deleted account is a hole in a ledger."* One column
   * moves, and the account's To/From category follows it out of the transaction
   * dropdowns — C-4, done by the file's own trigger, so it cannot be forgotten
   * by a caller and cannot be done twice.
   *
   * Answers `void`, and the verb answers with the closed row anyway. Discarded
   * here rather than widened into the seam: `closeAccount` is called by a screen
   * that re-reads both account lists, and a return value nobody reads is a
   * return value that will one day be read wrongly.
   */
  async closeAccount(id: string): Promise<void> {
    await this.#ask('close_account', { id });
  }

  // ── Transaction writes ────────────────────────────────────────────────────

  /**
   * One row, typed by a person.
   *
   * The draft is FILTERED to the verb's own arguments (`writes.ts`'s
   * `CREATE_KEYS`), which reproduces what `create_transaction_atomic` does with
   * the same object: it reads the keys it knows out of a jsonb blob and ignores
   * the rest. `Omit<Transaction, 'id'>` carries `isSplit`, `archived` and a
   * handful of others that this verb has no argument for, and a port that sent
   * them would turn every ordinary create into a refusal.
   *
   * Born reviewed, and the absence is where that happens: the verb has no
   * `needs_review` argument, so the column's own default (`0`) answers, which is
   * the rule `20260810090000` states — *"a row the user typed into the Quick Add
   * bar or the full editor is born reviewed; they were looking at it as they
   * made it"*.
   */
  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const answer = await this.#ask('create_transaction', toCreatePayload(transaction));
    return toTransaction(rowOf(answer, 'create_transaction', 'transaction'));
  }

  /**
   * A partial edit of the fields a row's own editor owns.
   *
   * The patch is passed through WHOLE rather than filtered — see `writes.ts` for
   * why the create and the update make opposite decisions about a key the verb
   * has not heard of. In one sentence: D-7 gives this engine 'refuses', and it
   * can only refuse what it is shown.
   */
  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const answer = await this.#ask('update_transaction', {
      id,
      patch: toUpdatePatch(updates)
    });
    return toTransaction(rowOf(answer, 'update_transaction', 'transaction'));
  }

  /**
   * Remove one row, and reverse its account by exactly its amount.
   *
   * The seam's two promises beyond the delete itself are the FILE's here rather
   * than this method's, which is why there is nothing to do about either: the
   * survivor of a linked pair is unlinked by
   * `transactions_linked_transfer_id_fkey`'s ON DELETE SET NULL, and a dismissed
   * suggestion about the row is pruned by the schema's own AFTER DELETE trigger.
   * Both are stated in `schema.sql` and both are asserted through this operation
   * by the contract suite, so a schema that lost either would fail here rather
   * than in a register offering to jump to a transaction that is gone.
   */
  async deleteTransaction(id: string): Promise<void> {
    await this.#ask('delete_transaction', { id });
  }

  /**
   * File a category on the rows of a payee that are still blank.
   *
   * Fill-blanks only, and it leaves `needsReview` exactly as it was. The
   * contrast with `confirmTransactionCategories` below is the point and it is
   * the crate's, not this file's: this is a decision about a CATEGORY taken from
   * a list of payees, where the rows' dates, amounts and accounts were never on
   * screen, so one run of the bulk tool must not mark a whole imported statement
   * as dealt with.
   */
  async applyCategoryToUncategorized(ids: string[], category: string): Promise<number> {
    const answer = await this.#ask('apply_category_to_uncategorized', { ids, category });
    return countOf(answer, 'apply_category_to_uncategorized', 'applied');
  }

  /**
   * Agree with the suggested category on a set of rows — and end their review
   * with it, because answering the question a row was asking IS reviewing it.
   */
  async confirmTransactionCategories(ids: string[]): Promise<number> {
    const answer = await this.#ask('confirm_transaction_categories', { ids });
    return countOf(answer, 'confirm_transaction_categories', 'confirmed');
  }

  // ── A file's worth of rows ────────────────────────────────────────────────

  /**
   * Add a statement to ONE account, atomically.
   *
   * ── IT REPORTS RATHER THAN THROWS ───────────────────────────────────────
   *
   * The one write on this port with a catch around it, and the seam is explicit
   * about why: *"412 of 900 landed" is an outcome a caller has to render rather
   * than a failure it can retry blindly*. Both importers slice the array they
   * handed in at `inserted` and show the remainder as the payments that are
   * missing, so a rejection would turn a useful screen into "Import failed" and
   * nothing else. The engine's own sentence rides out in `error`, unchanged,
   * because the caller prints it.
   *
   * ── B-9, AND THE TWO SILENCES IT DECLARES ───────────────────────────────
   *
   * `inserted` is a PREFIX count and here it can only be 0 or all of them: one
   * verb, one SQLite transaction, so there is no chunk boundary to stop at.
   * Both are prefixes, which is what the callers actually depend on.
   *
   * `onProgress` is never called, and that is declared rather than approximated
   * — one atomic write has no honest fraction, and a bar creeping to 90% is how
   * somebody waits on a write that already failed. `options.source` is likewise
   * not used: it says the rows carry the bank's own transaction ids, which the
   * cloud keys its chunks by so a re-post cannot land twice. A single atomic
   * write cannot half-land, so there is nothing here for a key to protect, and
   * `alreadyPresent` is 0 — *"a statement rather than a stub"*, in the seam's
   * own words. (The verb behind this does support `import_source`, so honouring
   * it is a decision waiting for a caller rather than a gap in the crate.)
   */
  async importTransactions(
    accountId: string,
    transactions: ReadonlyArray<Omit<Transaction, 'id'>>
  ): Promise<BulkImportResult> {
    const total = transactions.length;
    try {
      const answer = await this.#ask('import_transactions', {
        account_id: accountId,
        rows: transactions.map(toImportRow)
      });
      const result = rowOf(answer, 'import_transactions', 'answer');
      // The two counts mean different things on the two sides of this
      // boundary. The verb's `skipped` is "this login already held a row under
      // that import id"; the seam's `alreadyPresent` is the same rows, and its
      // `inserted` is everything now IN THE ACCOUNT — written by this run or
      // already there under this run's own key. So the seam's inserted is the
      // verb's two counts together, and `alreadyPresent` is a subset of it,
      // which is exactly what the contract asserts.
      const written = countOf(result, 'import_transactions', 'inserted');
      const alreadyPresent = countOf(result, 'import_transactions', 'skipped');
      const inserted = written + alreadyPresent;
      return { inserted, alreadyPresent, total, complete: inserted === total };
    } catch (error) {
      return {
        inserted: 0,
        alreadyPresent: 0,
        total,
        complete: false,
        // The ledger's own prose, or the transport's fault sentence — either
        // way it is already written for a person (seam rule 4), so it is not
        // prefixed or re-worded on the way to the screen.
        error: error instanceof Error ? error.message : 'The import could not be written.'
      };
    }
  }

  // ── Transfers ─────────────────────────────────────────────────────────────

  /**
   * Join two existing rows as the two halves of one transfer.
   *
   * Balance-neutral: no amount moves, only the link and the categories that name
   * each side. The crate answers with `transaction` and `other_side` — the house
   * key every result carries, plus a name that says what it is rather than which
   * argument it was — and the seam's `{a, b}` is those two in the order they
   * were asked for.
   */
  async linkTransferPair(idA: string, idB: string): Promise<{ a: Transaction; b: Transaction }> {
    const answer = await this.#ask('link_transfer_pair', { id_a: idA, id_b: idB });
    return {
      a: toTransaction(rowOf(answer, 'link_transfer_pair', 'transaction')),
      b: toTransaction(rowOf(answer, 'link_transfer_pair', 'other_side'))
    };
  }

  /** Join one LINE of a split to an existing row; amounts are compared against the line. */
  async linkSplitLineTransfer(
    splitId: string,
    transactionId: string
  ): Promise<{ split: TransactionSplit; transaction: Transaction }> {
    const answer = await this.#ask('link_split_line_transfer', {
      split_id: splitId,
      transaction_id: transactionId
    });
    return {
      split: toSplit(rowOf(answer, 'link_split_line_transfer', 'split')),
      transaction: toTransaction(rowOf(answer, 'link_split_line_transfer', 'transaction'))
    };
  }

  /**
   * Break the links on the named rows, and count the ones that really broke.
   *
   * `clear_transfer_links` rather than a table update, because that is what the
   * client's `clearTransferLinks` has actually called since `20260805145035`.
   * The count is rows ACTUALLY unlinked: a row already unlinked, and a row whose
   * link lives on a split line, are both skipped without a write and neither is
   * counted — the line owns that link, and clearing it here would leave the line
   * pointing at nothing.
   */
  async unlinkTransfers(ids: string[]): Promise<number> {
    const answer = await this.#ask('clear_transfer_links', { ids });
    return countOf(answer, 'clear_transfer_links', 'unlinked');
  }

  /** Re-pair a counterpart onto the row that really matches it. Three rows, one transaction. */
  async repairClaimedTransfer(
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ): Promise<{ stranded: Transaction; counterpart: Transaction; partner: Transaction }> {
    const answer = await this.#ask('repair_claimed_transfer', {
      stranded_id: strandedId,
      counterpart_id: counterpartId,
      partner_id: partnerId,
      adjustment_category_id: adjustmentCategoryId
    });
    return {
      stranded: toTransaction(rowOf(answer, 'repair_claimed_transfer', 'transaction')),
      counterpart: toTransaction(rowOf(answer, 'repair_claimed_transfer', 'counterpart')),
      partner: toTransaction(rowOf(answer, 'repair_claimed_transfer', 'partner'))
    };
  }

  /**
   * Make the other side of a transfer in the target account, and link it.
   *
   * The one verb in the transfer family that moves money — it mints a row in
   * another account's register, so that account moves by the new row's amount
   * and the source does not, because the source row's amount is unchanged. Net
   * worth is the same afterwards, which is what makes it a transfer rather than
   * income appearing from nowhere.
   */
  async createTransferCounterpart(
    id: string,
    targetAccountId: string
  ): Promise<{ source: Transaction; counterpart: Transaction }> {
    const answer = await this.#ask('create_transfer_counterpart', {
      id,
      target_account_id: targetAccountId
    });
    return {
      source: toTransaction(rowOf(answer, 'create_transfer_counterpart', 'transaction')),
      counterpart: toTransaction(rowOf(answer, 'create_transfer_counterpart', 'counterpart'))
    };
  }

  // ── Splits ────────────────────────────────────────────────────────────────

  /**
   * Replace a transaction's split lines, all or nothing.
   *
   * `set_transaction_splits_with_legs` and never the older
   * `set_transaction_splits`, for both kinds of payload. The seam says the
   * choice between server paths *"is the implementation's decision, not the
   * caller's"*, and the cloud makes it per call because both functions exist
   * there; only one was ported, because the with-legs writer is a strict
   * superset — it matches lines by id, so an ordinary line beside a transfer leg
   * can be re-filed, and a plain replace is what it does when no line declares a
   * target.
   *
   * `expectedAmount` is OMITTED when the caller passes null rather than sent as
   * one. Absent is the verb's "do not check", which is the cloud's
   * `p_expected_amount IS NOT NULL` guard; a JSON null would be a caller stating
   * an amount of nothing.
   */
  async setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: MoneyNumber | null
  ): Promise<SplitWriteResult> {
    const answer = await this.#ask('set_transaction_splits_with_legs', {
      id: transactionId,
      splits: splits.map(toSplitLine),
      ...(expectedAmount === null ? {} : { expected_amount: String(expectedAmount) })
    });
    return {
      isSplit: field(answer, 'is_split') === true,
      splitCount: countOf(answer, 'set_transaction_splits_with_legs', 'split_count'),
      // The parent's total as the WRITE computed it, which is the figure the
      // caller moves its own balance by. `?? 0` is unreachable for an answer
      // this crate produced (the field is a `Money`, never absent) and says
      // "nothing" rather than throwing if it ever is.
      amount: money(field(answer, 'amount')) ?? 0,
      // Real rows in other accounts — the lines that BECAME transfer legs in
      // this write. The caller updates those accounts' balances from them
      // rather than guessing, which is why an empty list and a missing key are
      // not the same answer and `listOf` refuses the second.
      counterparts: listOf(answer, 'set_transaction_splits_with_legs', 'counterparts').map(
        toTransaction
      )
    };
  }

  // ── Categories, in bulk ───────────────────────────────────────────────────

  /**
   * Remove the categories nothing is filed against.
   *
   * B-6 gives this engine 're-judges every row and keeps the ones still in use',
   * and the count is what ACTUALLY went — never the size of the list. The caller
   * prints that figure ("pruned 40, kept 12 in use") and re-reads the category
   * set because of it, so a count derived from the request would be a guess in
   * the shape of a fact.
   */
  async deleteUnusedCategories(ids: string[]): Promise<number> {
    const answer = await this.#ask('delete_unused_categories', { ids });
    return countOf(rowOf(answer, 'delete_unused_categories', 'answer'), 'delete_unused_categories', 'deleted');
  }

  /** Move every reference from one category to another, then remove the source. */
  async mergeCategories(sourceId: string, targetId: string): Promise<CategoryMergeResult> {
    const answer = await this.#ask('merge_categories', {
      source_id: sourceId,
      target_id: targetId
    });
    const named = (key: string): number => countOf(answer, 'merge_categories', key);
    return {
      // Echoed by the verb because the source is gone and this is the only
      // record of which id the caller named.
      sourceId: textOf(answer, 'merge_categories', 'source_id'),
      targetId: textOf(answer, 'merge_categories', 'target_id'),
      transactions: named('transactions'),
      splitLines: named('split_lines'),
      splitTransactions: named('split_transactions'),
      budgets: named('budgets'),
      recurring: named('recurring')
    };
  }

  // ── Emptying it ───────────────────────────────────────────────────────────

  /**
   * Is there anything here at all?
   *
   * REJECTS rather than guessing, unlike the three boot reads. There is no
   * honest fallback: `true` from a file that could not be opened would unlock
   * the restore button in front of a ledger full of data.
   */
  async financialDataIsEmpty(): Promise<boolean> {
    const answer = await this.#ask('user_financial_data_is_empty');
    return rowOf(answer, 'user_financial_data_is_empty', 'answer').empty === true;
  }

  /**
   * Erase everything this file holds.
   *
   * ── THE PHRASE IS SUPPLIED HERE, AND THAT IS THE SEAM'S DECISION ────────
   *
   * `wipeAllFinancialData` takes no confirmation: the SCREEN holds it, and both
   * callers refuse to enable their button until it has been typed exactly. A
   * phrase that travelled across the seam would be a string an implementation
   * could get wrong; the screen's is one the user typed. So the implementation
   * supplies whatever its own engine demands, and this is that literal.
   *
   * It is the fourth copy — the SQL function's own check, the crate's
   * `CONFIRMATION`, `LOCAL_WIPE_CONFIRMATION` and this — and that is safe
   * precisely because every one of them CHECKS it: a copy that drifted would
   * refuse every wipe on the first run rather than weaken one, and the contract
   * suite asks for a wipe that works.
   *
   * `onProgress` is never called, for `importTransactions`'s reason: one atomic
   * write has no honest fraction. The callers already treat silence as normal.
   */
  async wipeAllFinancialData(): Promise<void> {
    await this.#ask('wipe_user_financial_data', { confirm: WIPE_CONFIRMATION });
  }

  // ── Lifecycle, and what this engine can do ────────────────────────────────

  /**
   * Nothing to reconcile: a file has no login to look up and no row to create
   * for one. The seam already calls this "a no-op for an implementation that
   * has no accounts to reconcile", and the arguments are accepted and ignored
   * rather than removed, because the caller is the same boot effect either way.
   */
  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * One file on one machine: there is nothing to hear from, so nothing ever
   * fires and the handle is a no-op. B-8 declares that (`delivers: 'never'`)
   * rather than leaving it as a gap to be filled in later, and the contract
   * asserts what every engine owes regardless: the handle is a function, calling
   * it twice is safe, and nothing arrives after it has been called.
   *
   * `capabilities().realtime` is `false` beside it, which is what lets a caller
   * skip the debounce timers and suppression windows that exist solely to cope
   * with events that will never arrive.
   */
  subscribeToUpdates(): () => void {
    return () => {};
  }

  capabilities(): DataPortCapabilities {
    return { ...DEVICE_CAPABILITIES };
  }
}
