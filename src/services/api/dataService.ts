
/**
 * Unified Data Service Layer
 * This service provides a single interface for all data operations
 * and handles the switch between Supabase (cloud) and localStorage (fallback)
 */

import { UserService } from './userService';
import { AccountService } from './accountService';
import { TransactionService, type TransactionLoadResult } from './transactionService';
import { PlanningService } from './planningService';
import { SuggestionDismissalService } from './suggestionDismissalService';
import { isSupabaseConfigured } from './supabaseClient';
import { hasSupabaseTokenGetter } from '../../lib/supabaseToken';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import { toDecimal, type DecimalInstance } from '../../utils/decimal';
import { normalizeTransactionDates, toDateValue } from '../../utils/dateBoundary';
import {
  accountNumberForStorage,
  accountNumberUpdateForStorage,
  isCardAccountType
} from '../../utils/accountNumberInput';
import { splitDeclaresTransferLeg } from '../../utils/transactionSplits';
import type { AccountBalanceSnapshot, BootTransactionsResult, DataPort } from '../port/dataPort';
import type { Account, AccountUpdate, Transaction, TransactionSplit, TransactionSplitInput, SplitWriteResult, Budget, Goal, Category, CategoryMergeResult, DismissalKind, SuggestionDismissal } from '../../types';

 type Logger = Pick<Console, 'log' | 'warn' | 'error'>;
type AccountServiceLike = Pick<typeof AccountService,
  'getAccounts' | 'getClosedAccounts' | 'createAccount' | 'updateAccount' | 'deleteAccount'> & {
  subscribeToAccounts?: (userId: string, callback: (payload: unknown) => void) => () => void;
};
type TransactionServiceLike = Pick<typeof TransactionService,
  'getTransactions' | 'createTransaction' | 'updateTransaction' | 'deleteTransaction' | 'setTransactionsCleared' | 'applyCategoryToUncategorized' | 'confirmTransactionCategories' | 'getTransactionSplits' | 'setTransactionSplits' | 'setTransactionSplitsWithLegs' | 'getAllTransactionSplits' | 'linkTransferPair' | 'linkSplitLineTransfer' | 'clearTransferLinks' | 'setTransactionArchived' | 'repairClaimedTransfer' | 'createTransferCounterpart' | 'archiveTransactionsBefore' | 'unarchiveAccount'> & {
  subscribeToTransactions?: (userId: string, callback: (payload: unknown) => void) => () => void;
  /**
   * Optional so an injected test double stays a partial stand-in; without it
   * the boot simply takes the uncached full-fetch path.
   */
  loadTransactionsForBoot?: (userId: string) => Promise<TransactionLoadResult>;
  /**
   * Optional for the same reason (the `loadTransactionsForBoot` precedent
   * above): a double that does not implement it leaves the seam answering
   * "I don't know" — an empty map — which is the honest answer and the one the
   * balance seeding already handles.
   */
  getAccountBalances?: () => Promise<ReadonlyMap<string, AccountBalanceSnapshot>>;
};
type PlanningServiceLike = Pick<typeof PlanningService, 'mergeCategories'>;
type SuggestionDismissalServiceLike = Pick<typeof SuggestionDismissalService,
  'list' | 'dismiss' | 'restore'>;
type UserIdServiceLike = Pick<typeof userIdService,
  'ensureUserExists' | 'getCurrentDatabaseUserId' | 'getCurrentUserIds'>;
type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'>;
type SupabaseChecker = () => boolean;
type CloudSessionChecker = () => boolean;
type DateProvider = () => Date;
type UuidGenerator = () => string;

export interface DataServiceOptions {
  accountService?: AccountServiceLike;
  transactionService?: TransactionServiceLike;
  planningService?: PlanningServiceLike;
  suggestionDismissalService?: SuggestionDismissalServiceLike;
  userService?: typeof UserService;
  userIdService?: UserIdServiceLike;
  storageAdapter?: StorageAdapterLike;
  logger?: Logger;
  now?: DateProvider;
  uuid?: UuidGenerator;
  isSupabaseConfigured?: SupabaseChecker;
  /** Whether a signed-in (Clerk) session exists right now. */
  hasCloudSession?: CloudSessionChecker;
}

class DataServiceImpl implements DataPort {
  private readonly accountService: AccountServiceLike;
  private readonly transactionService: TransactionServiceLike;
  private readonly planningService: PlanningServiceLike;
  private readonly suggestionDismissalService: SuggestionDismissalServiceLike;
  private readonly userService: typeof UserService;
  private readonly userIdService: UserIdServiceLike;
  private readonly storage: StorageAdapterLike;
  private readonly logger: Logger;
  private readonly nowProvider: DateProvider;
  private readonly uuid: UuidGenerator;
  private readonly supabaseChecker: SupabaseChecker;
  private readonly hasCloudSession: CloudSessionChecker;

  constructor(options: DataServiceOptions = {}) {
    this.accountService = options.accountService ?? AccountService;
    this.transactionService = options.transactionService ?? TransactionService;
    this.planningService = options.planningService ?? PlanningService;
    this.suggestionDismissalService =
      options.suggestionDismissalService ?? SuggestionDismissalService;
    this.userService = options.userService ?? UserService;
    this.userIdService = options.userIdService ?? userIdService;
    this.storage = options.storageAdapter ?? storageAdapter;
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      log: options.logger?.log ?? (fallbackLogger?.log?.bind(fallbackLogger) ?? noop),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? (() => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    });
    this.supabaseChecker = options.isSupabaseConfigured ?? isSupabaseConfigured;
    this.hasCloudSession = options.hasCloudSession ?? hasSupabaseTokenGetter;
  }

  private isSupabaseReady(): boolean {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    return Boolean(userId && this.supabaseChecker());
  }

  /**
   * A signed-in (Clerk) session exists but the database user id hasn't
   * resolved yet — still connecting, or resolution failed. In this state the
   * browser-local fallback must NOT run: it would read demo/import data (or
   * divert writes) inside a signed-in view. Reads return empty; writes refuse.
   */
  private isCloudSessionPending(): boolean {
    return this.supabaseChecker() && this.hasCloudSession() &&
      !this.userIdService.getCurrentDatabaseUserId();
  }

  private guardCloudWrite(): void {
    if (this.isCloudSessionPending()) {
      throw new Error('Still connecting to your account — please try again in a moment.');
    }
  }

  private async readCollection<T>(key: string): Promise<T[]> {
    const stored = await this.storage.get<T[]>(key);
    return stored || [];
  }

  /**
   * The browser-local transaction collection (local mode, demo data, offline
   * fallback). It is stored as JSON, so every `date` comes back as the string
   * it was serialised to — the same boundary the network path has. These rows
   * go straight into app state and into the balance/budget maths, so the type
   * is made true here rather than at each reader.
   */
  private async readLocalTransactions(): Promise<Transaction[]> {
    return normalizeTransactionDates(await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS));
  }

  private async persistCollection<T>(key: string, value: T[]): Promise<void> {
    await this.storage.set(key, value);
  }

  private generateId(): string {
    return this.uuid();
  }

  async initialize(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<void> {
    if (!this.supabaseChecker()) {
      return;
    }

    try {
      this.logger.log('[DataService] Initializing for Clerk ID:', clerkId);
      const databaseId = await this.userIdService.ensureUserExists(clerkId, email, firstName, lastName);
      if (databaseId) {
        this.logger.log('[DataService] User initialized with database ID:', databaseId);
      } else {
        this.logger.warn('[DataService] No database ID returned from userIdService');
      }
    } catch (error) {
      this.logger.error('[DataService] Failed to initialize user:', error as Error);
    }
  }

  /**
   * The boot's transaction read. Unlike getTransactions (used by the bank-sync
   * and real-time refreshes, which always want a straight re-pull) this goes
   * through the local snapshot + delta path, and reports which it used.
   *
   * NEVER REJECTS — the seam says so, and this is where that is made true. The
   * boot effect has ONE outer catch, and reaching it replaces the whole app
   * with "Failed to load data" for somebody whose ledger is perfectly fine. The
   * cloud path already swallows its own failures (a delta that will not load
   * costs a refetch; a refetch that will not load falls back to stored rows),
   * but the store underneath can still refuse to open, so the guarantee is
   * stated here rather than assumed. A failure costs an empty list with the
   * reason said out loud on the boot-timing line.
   */
  async loadBootTransactions(): Promise<BootTransactionsResult> {
    try {
      const userId = this.userIdService.getCurrentDatabaseUserId();
      if (!userId && this.supabaseChecker()) {
        this.logger.warn(this.hasCloudSession()
          ? '[DataService] Signed in but database user id unresolved — returning empty data (local fallback blocked)'
          : '[DataService] No database ID available, using localStorage fallback');
      }

      if (userId && this.supabaseChecker()) {
        if (this.transactionService.loadTransactionsForBoot) {
          return await this.transactionService.loadTransactionsForBoot(userId);
        }
        const rows = await this.transactionService.getTransactions(userId);
        return {
          transactions: rows,
          stats: { cached: 0, fetched: rows.length, total: rows.length, fullFetchReason: 'no cache' }
        };
      }

      const rows = this.isCloudSessionPending()
        ? []
        : await this.readLocalTransactions();
      return {
        transactions: rows,
        stats: { cached: 0, fetched: 0, total: rows.length, fullFetchReason: 'local mode' }
      };
    } catch (error) {
      this.logger.error('Error loading transactions:', error as Error);
      return {
        transactions: [],
        stats: { cached: 0, fetched: 0, total: 0, fullFetchReason: 'load failed' }
      };
    }
  }

  /**
   * Every account's balance in one round trip, computed by the store.
   *
   * NEVER REJECTS, AND NEVER GUESSES. An empty map means "I don't know", and
   * the app falls back to summing the rows itself — which is the source of
   * truth anyway. Zeros would be a guess: the seeding rule keys off the map
   * being non-empty, so a map of zeros would paint every account at £0.00 and
   * present it as real money.
   */
  async getAccountBalances(): Promise<ReadonlyMap<string, AccountBalanceSnapshot>> {
    // Same condition the transaction service applies to itself (a configured
    // client IS `isSupabaseConfigured()` — see supabaseClient.ts), so routing
    // through here asks exactly the question the direct call asked.
    if (!this.supabaseChecker() || !this.transactionService.getAccountBalances) {
      return new Map();
    }
    try {
      return await this.transactionService.getAccountBalances();
    } catch (error) {
      this.logger.error('Error loading account balances:', error as Error);
      return new Map();
    }
  }

  async getAccounts(): Promise<Account[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.getAccounts(userId);
    }
    if (this.isCloudSessionPending()) return [];
    return this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
  }

  /** Closed accounts for the Accounts page's Closed Accounts section. */
  async getClosedAccounts(): Promise<Account[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.getClosedAccounts(userId);
    }
    if (this.isCloudSessionPending()) return [];
    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    return accounts.filter(a => a.isActive === false);
  }

  async createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.createAccount(userId, account);
    }
    this.guardCloudWrite();

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const newAccount: Account = {
      ...account,
      // Local mode is no safer a home for a card number than the cloud: this
      // storage is what the backup file and the JSON export are built from.
      accountNumber: accountNumberForStorage(
        account.accountNumber,
        isCardAccountType(account.type)
      ),
      id: this.generateId()
    } as Account;
    accounts.push(newAccount);
    await this.persistCollection(STORAGE_KEYS.ACCOUNTS, accounts);
    return newAccount;
  }

  async updateAccount(id: string, updates: AccountUpdate): Promise<Account> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.updateAccount(id, updates, userId);
    }
    this.guardCloudWrite();

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const index = accounts.findIndex(account => account.id === id);
    if (index === -1) {
      throw new Error('Account not found');
    }

    accounts[index] = {
      ...accounts[index],
      ...accountNumberUpdateForStorage(updates, accounts[index].type)
    } as Account;
    await this.persistCollection(STORAGE_KEYS.ACCOUNTS, accounts);
    return accounts[index];
  }

  async deleteAccount(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.deleteAccount(id, userId);
    }
    this.guardCloudWrite();

    // Local mode mirrors the cloud semantics: a SOFT close (reopenable from
    // the Closed Accounts section), never a hard delete.
    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const updated = accounts.map(account =>
      account.id === id ? { ...account, isActive: false } : account
    );
    await this.persistCollection(STORAGE_KEYS.ACCOUNTS, updated);
  }

  async getTransactions(): Promise<Transaction[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.getTransactions(userId);
    }

    if (this.isCloudSessionPending()) return [];
    return this.readLocalTransactions();
  }

  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.createTransaction(userId, transaction);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    // The caller's date crosses the boundary here: this row is handed straight
    // back to the context and pushed into app state.
    const newTransaction: Transaction = {
      ...transaction,
      date: toDateValue(transaction.date),
      id: this.generateId()
    } as Transaction;

    transactions.push(newTransaction);
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, transactions);
    await this.updateAccountBalance(transaction.accountId, transaction.amount);
    return newTransaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.updateTransaction(id, updates, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const index = transactions.findIndex(transaction => transaction.id === id);
    if (index === -1) {
      throw new Error('Transaction not found');
    }

    const oldAmount = transactions[index].amount;
    const oldAccountId = transactions[index].accountId;

    transactions[index] = {
      ...transactions[index],
      ...updates,
      ...(updates.date !== undefined ? { date: toDateValue(updates.date) } : {})
    } as Transaction;
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, transactions);

    if (updates.amount !== undefined && updates.amount !== oldAmount) {
      // Decimal delta — raw float subtraction here drifted the local ledger
      // (e.g. -70.3 - (-70.1) = -0.19999999999999574).
      await this.updateAccountBalance(
        oldAccountId,
        toDecimal(updates.amount).minus(toDecimal(oldAmount)).toNumber()
      );
    }

    return transactions[index];
  }

  async deleteTransaction(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.deleteTransaction(id, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      await this.updateAccountBalance(transaction.accountId, -transaction.amount);
    }
    const filtered = transactions.filter(t => t.id !== id);
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, filtered);

    // Mirrors the trg_prune_suggestion_dismissals trigger: a suggestion about a
    // row that no longer exists can never be offered again, so its dismissal is
    // dead weight. Same behaviour in demo mode as in the cloud.
    const dismissals = await this.readLocalDismissals();
    const survivors = dismissals.filter(d => !d.subjectIds.includes(id));
    if (survivors.length !== dismissals.length) {
      await this.persistCollection(STORAGE_KEYS.SUGGESTION_DISMISSALS, survivors);
    }
  }

  /** Bulk-set the reconciliation cleared flag; balance-neutral by definition. */
  async setTransactionsCleared(ids: string[], cleared: boolean): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.setTransactionsCleared(ids, cleared, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const cutoffByAccount = new Map(
      accounts.map(a => [a.id, a.archiveThroughDate ? new Date(a.archiveThroughDate) : null])
    );
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (idSet.has(t.id)) {
        count += 1;
        // Reconcile-sweep (mirrors the cloud trigger): a transaction that
        // becomes reconciled on/before its account's archive cutoff is
        // archived automatically, so it drops off the live list cleanly.
        const cutoff = cutoffByAccount.get(t.accountId);
        const sweep = cleared && !t.archived && cutoff != null && new Date(t.date) <= cutoff;
        return { ...t, cleared, ...(sweep ? { archived: true } : {}) };
      }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);
    return count;
  }

  /**
   * Soft-archive an account's reconciled transactions on/before the cutoff and
   * stamp the account's archive_through_date. Balance-neutral (archiving only
   * hides rows). Cloud: one atomic RPC. Local: flag the matching transactions
   * and update the account. Returns the number archived.
   */
  async archiveTransactionsBefore(accountId: string, cutoff: Date): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.archiveTransactionsBefore(
        accountId, cutoff.toISOString().slice(0, 10), userId
      );
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    let count = 0;
    const updated = transactions.map(t => {
      if (t.accountId === accountId && !t.archived && t.cleared === true && new Date(t.date) <= cutoff) {
        count += 1;
        return { ...t, archived: true };
      }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    await this.persistCollection(
      STORAGE_KEYS.ACCOUNTS,
      accounts.map(a => (a.id === accountId ? { ...a, archiveThroughDate: cutoff } : a))
    );
    return count;
  }

  /** Bring an account's archived transactions back into the live register. */
  async unarchiveAccount(accountId: string): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.unarchiveAccount(accountId, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    let count = 0;
    const updated = transactions.map(t => {
      if (t.accountId === accountId && t.archived) { count += 1; return { ...t, archived: false }; }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    await this.persistCollection(
      STORAGE_KEYS.ACCOUNTS,
      accounts.map(a => (a.id === accountId ? { ...a, archiveThroughDate: null } : a))
    );
    return count;
  }

  /**
   * Apply a category to the listed transactions that are still uncategorized
   * (payee-memory propagation); fill-blanks only, balance-neutral.
   */
  async applyCategoryToUncategorized(ids: string[], category: string): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.applyCategoryToUncategorized(ids, category, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (idSet.has(t.id) && (!t.category || t.category.trim() === '')) {
        count += 1;
        // CONFIRMED, not suggested: every caller of this is the user filing a
        // payee they have just chosen a category for. Payee memory spreading
        // that decision to identical rows is the decision, not a guess about
        // it — asking him to re-confirm the very rows he asked to be filed
        // would make the bulk tool slower than doing it one at a time.
        return { ...t, category, categoryConfirmed: true };
      }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);
    return count;
  }

  /**
   * Agree with the suggested categories on a set of rows. Balance-neutral: one
   * boolean, never the category itself, never an amount.
   */
  async confirmTransactionCategories(ids: string[]): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.confirmTransactionCategories(ids, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (idSet.has(t.id) && t.categoryConfirmed === false) {
        count += 1;
        return { ...t, categoryConfirmed: true };
      }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);
    return count;
  }

  /** Every split line of the user's transactions (for category aggregation). */
  async getAllTransactionSplits(): Promise<TransactionSplit[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.getAllTransactionSplits(userId);
    }

    if (this.isCloudSessionPending()) return [];
    return this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
  }

  /** Splits for one transaction, in display order (empty when not split). */
  async getTransactionSplits(transactionId: string): Promise<TransactionSplit[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.getTransactionSplits(transactionId);
    }

    if (this.isCloudSessionPending()) return [];
    const stored = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    return stored
      .filter(s => s.transactionId === transactionId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Replace a transaction's splits atomically (empty array un-splits it).
   *
   * Two server paths, chosen by the line set itself: one that declares a
   * TRANSFER LEG goes to set_transaction_splits_with_legs, which matches lines
   * by id (so an ordinary line beside a leg can be re-filed) and creates the
   * counterpart for any line that becomes a leg; everything else takes
   * set_transaction_splits, which replaces the set exactly as it always has.
   * The local path mirrors both sets of rules in ONE implementation so
   * demo/offline behave identically.
   */
  async setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null
  ): Promise<SplitWriteResult> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      if (splitDeclaresTransferLeg(splits)) {
        return this.transactionService.setTransactionSplitsWithLegs(
          transactionId, splits, expectedAmount, userId
        );
      }
      const result = await this.transactionService.setTransactionSplits(
        transactionId, splits, expectedAmount, userId
      );
      return { ...result, counterparts: [] };
    }
    this.guardCloudWrite();
    return this.setTransactionSplitsLocally(transactionId, splits, expectedAmount);
  }

  /**
   * The local/demo half of the split write — the mirror of
   * set_transaction_splits AND set_transaction_splits_with_legs, kept in one
   * place because they differ only in what they allow, not in what they mean.
   *
   * All-or-nothing: every check runs BEFORE the first persist, so a refusal
   * leaves browser storage exactly as it was (the same stance as
   * repairClaimedTransfer and mergeCategories).
   *
   * The rule about legs, precisely: a line already linked to a counterpart may
   * change only its position and memo. Removing one, or changing its amount,
   * target or category, strands or falsifies the transaction on the other side
   * and is refused by name. Every other line in the same split is free.
   */
  private async setTransactionSplitsLocally(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null
  ): Promise<SplitWriteResult> {
    const transactions = await this.readLocalTransactions();
    const index = transactions.findIndex(t => t.id === transactionId);
    if (index === -1) {
      throw new Error('Transaction not found');
    }
    const transaction = transactions[index];
    if (transaction.type === 'transfer') {
      throw new Error('Transfers cannot be split');
    }

    const stored = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    const mine = stored.filter(s => s.transactionId === transactionId);
    const others = stored.filter(s => s.transactionId !== transactionId);
    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const accountName = (id: string | undefined): string =>
      accounts.find(a => a.id === id)?.name ?? 'another account';

    const keptIds = new Set(splits.map(s => s.id).filter((id): id is string => Boolean(id)));
    if (keptIds.size !== splits.filter(s => s.id).length) {
      throw new Error('Two of these lines claim to be the same stored line — reload and look again');
    }
    // Dropping a linked leg leaves its counterpart pointing at a line that no
    // longer exists. Named before anything is written.
    for (const line of mine) {
      if (line.linkedTransferId && !keptIds.has(line.id)) {
        throw new Error(
          `The line transferring to "${accountName(line.transferAccountId)}" is one half of a transfer — the transaction on the other side would be left pointing at a line that no longer exists. Delete that transfer first, then edit the split.`
        );
      }
    }

    if (splits.length === 0) {
      await this.persistCollection(STORAGE_KEYS.TRANSACTION_SPLITS, others);
      transactions[index] = { ...transaction, isSplit: false } as Transaction;
      await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, transactions);
      return { isSplit: false, splitCount: 0, amount: transaction.amount, counterparts: [] };
    }

    if (splits.length < 2) {
      throw new Error('A split needs at least 2 lines');
    }

    let sum = toDecimal(0);
    const nextLines: TransactionSplit[] = [];
    const counterparts: Transaction[] = [];
    // account id → the delta this write owes it, applied in ONE pass at the end.
    const balanceDeltas = new Map<string, DecimalInstance>();

    for (const [i, split] of splits.entries()) {
      if (!split.category.trim()) {
        throw new Error('Every split line needs a category');
      }
      if (!split.amount) {
        throw new Error('Every split line needs a non-zero amount');
      }

      const previous = split.id ? mine.find(s => s.id === split.id) : undefined;
      if (split.id && !previous) {
        throw new Error('One of these lines is not part of this split any more — reload and look again');
      }

      const target = split.transferAccountId;
      const targetAccount = target ? accounts.find(a => a.id === target) : undefined;
      if (target) {
        if (!targetAccount) {
          throw new Error('A transfer line names an account that is not yours, or no longer exists');
        }
        if (target === transaction.accountId) {
          throw new Error('A transfer needs two different accounts');
        }
      }
      // A To/From category names an account, so it must name the same one the
      // line does. Unlike the server, a category that is simply absent from
      // local storage is not fatal — demo/offline fixtures routinely carry
      // transactions without the tree they were filed against.
      const category = categories.find(c => c.id === split.category);
      if (category?.isTransferCategory === true) {
        if (!target) {
          throw new Error('That line is filed under a To/From account category but does not say which account is on the other side');
        }
        if (category.accountId !== target) {
          throw new Error('That line is filed under one account\'s To/From category but transfers to a different account');
        }
      }

      const memo = split.memo ? { memo: split.memo } : {};
      const sortOrder = i + 1;

      if (previous?.linkedTransferId) {
        // Pinned by the row on the other side: position and memo may move,
        // nothing else may.
        if (!toDecimal(split.amount).equals(toDecimal(previous.amount))) {
          throw new Error(
            `The line transferring to "${accountName(previous.transferAccountId)}" has to stay as it is, because the transaction on the other side is for exactly that much — change the other lines, or delete that transfer first.`
          );
        }
        if (target !== previous.transferAccountId) {
          throw new Error(
            `That line is already linked to a transaction in "${accountName(previous.transferAccountId)}" — moving it would strand that row. Delete that transfer first, then edit the split.`
          );
        }
        if (split.category !== previous.category) {
          throw new Error(
            'That line is one half of a transfer — its category names the account on the other side. Delete that transfer first, then re-file it.'
          );
        }
        nextLines.push({ ...previous, ...memo, sortOrder });
      } else {
        const line: TransactionSplit = {
          id: previous?.id ?? this.generateId(),
          transactionId,
          category: split.category,
          amount: split.amount,
          ...memo,
          sortOrder,
          ...(target ? { transferAccountId: target } : {}),
        };

        // A line that BECOMES a leg gets its other side made now. A line that
        // already pointed at this account keeps whatever link state it has —
        // creating a second counterpart would invent money.
        if (target && previous?.transferAccountId !== target) {
          const sourceAccount = accounts.find(a => a.id === transaction.accountId);
          if (
            sourceAccount?.currency && targetAccount?.currency &&
            sourceAccount.currency !== targetAccount.currency
          ) {
            throw new Error(
              `Transfers between accounts in different currencies are not supported yet (${sourceAccount.currency} and ${targetAccount.currency})`
            );
          }
          // Opposite of the LINE, never of the parent — whose total includes
          // the other lines, and is supposed to differ.
          const counterpartAmount = toDecimal(split.amount).negated().toNumber();
          const counterpart: Transaction = {
            id: this.generateId(),
            date: transaction.date,
            description: transaction.description,
            amount: counterpartAmount,
            type: 'transfer',
            category: this.localTransferCategoryFrom(categories, transaction.accountId, counterpartAmount),
            accountId: target,
            notes: split.memo ?? transaction.notes,
            cleared: false,
            transferAccountId: transaction.accountId,
            linkedTransferId: transactionId,
            linkedTransferSplitId: line.id,
          };
          line.linkedTransferId = counterpart.id;
          counterparts.push(counterpart);
          balanceDeltas.set(
            target,
            (balanceDeltas.get(target) ?? toDecimal(0)).plus(toDecimal(counterpartAmount))
          );
        }

        nextLines.push(line);
      }

      sum = sum.plus(toDecimal(split.amount));
    }

    if (expectedAmount !== null && !sum.equals(toDecimal(expectedAmount))) {
      throw new Error('The split lines must sum to the transaction amount');
    }

    // ── Past every refusal: persist ───────────────────────────────────────────
    const newAmount = sum.toNumber();
    if (newAmount !== transaction.amount) {
      balanceDeltas.set(
        transaction.accountId,
        (balanceDeltas.get(transaction.accountId) ?? toDecimal(0))
          .plus(sum.minus(toDecimal(transaction.amount)))
      );
    }

    await this.persistCollection(STORAGE_KEYS.TRANSACTION_SPLITS, [...others, ...nextLines]);
    transactions[index] = { ...transaction, isSplit: true, category: '', amount: newAmount } as Transaction;
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, [...transactions, ...counterparts]);
    if (balanceDeltas.size > 0) {
      await this.persistCollection(
        STORAGE_KEYS.ACCOUNTS,
        accounts.map(account => {
          const delta = balanceDeltas.get(account.id);
          // Decimal arithmetic — IEEE-754 float math is banned on money values.
          return delta
            ? { ...account, balance: toDecimal(account.balance || 0).plus(delta).toNumber() }
            : account;
        })
      );
    }

    return { isSplit: true, splitCount: nextLines.length, amount: newAmount, counterparts };
  }

  /** The account-managed To/From category id, or the legacy sentinel. */
  private localTransferCategoryFrom(categories: Category[], accountId: string, amount: number): string {
    const transferCategory = categories.find(c => c.isTransferCategory === true && c.accountId === accountId);
    return transferCategory?.id ?? (amount < 0 ? 'transfer-out' : 'transfer-in');
  }

  /** As above, reading the category collection itself. */
  private async localTransferCategoryFor(accountId: string, amount: number): Promise<string> {
    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    return this.localTransferCategoryFrom(categories, accountId, amount);
  }

  /**
   * Join two existing rows into a linked transfer pair. Mirrors the
   * link_transfer_pair RPC's invariants locally so demo/offline behave
   * identically. Balance-neutral: amounts are untouched.
   */
  async linkTransferPair(idA: string, idB: string): Promise<{ a: Transaction; b: Transaction }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.linkTransferPair(idA, idB, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const a = transactions.find(t => t.id === idA);
    const b = transactions.find(t => t.id === idB);
    if (!a || !b) {
      throw new Error('Transaction not found');
    }
    if (a.accountId === b.accountId) {
      throw new Error('A transfer needs two different accounts');
    }
    const amountA = toDecimal(a.amount);
    if (amountA.isZero() || !toDecimal(b.amount).equals(amountA.negated())) {
      throw new Error('Transfer sides must have exactly opposite non-zero amounts');
    }
    if (a.isSplit || b.isSplit) {
      throw new Error('A split transaction cannot become a transfer — remove the split first');
    }
    if (a.linkedTransferId || b.linkedTransferId) {
      throw new Error('Transaction is already part of a linked transfer');
    }

    const newA: Transaction = {
      ...a,
      type: 'transfer',
      category: await this.localTransferCategoryFor(b.accountId, a.amount),
      transferAccountId: b.accountId,
      linkedTransferId: b.id,
    };
    const newB: Transaction = {
      ...b,
      type: 'transfer',
      category: await this.localTransferCategoryFor(a.accountId, b.amount),
      transferAccountId: a.accountId,
      linkedTransferId: a.id,
    };
    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      transactions.map(t => (t.id === idA ? newA : t.id === idB ? newB : t))
    );
    return { a: newA, b: newB };
  }

  /**
   * Join an existing split LINE to an existing transaction as the two halves
   * of a transfer. Mirrors the link_split_line_transfer RPC's invariants
   * locally so demo/offline behave identically.
   *
   * The amounts are compared against the LINE, never the split PARENT: the
   * parent's total includes the other lines and is SUPPOSED to differ. Like
   * the RPC, this is balance-neutral (nothing about any amount or account
   * moves) and all-or-nothing: every check runs before the first persist.
   */
  async linkSplitLineTransfer(
    splitId: string,
    transactionId: string
  ): Promise<{ split: TransactionSplit; transaction: Transaction }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.linkSplitLineTransfer(splitId, transactionId, userId);
    }
    this.guardCloudWrite();

    const splits = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    const line = splits.find(s => s.id === splitId);
    if (!line) {
      throw new Error('That split line no longer exists');
    }
    const transactions = await this.readLocalTransactions();
    const parent = transactions.find(t => t.id === line.transactionId);
    if (!parent) {
      throw new Error('The split that line belongs to no longer exists');
    }
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    if (transaction.id === parent.id) {
      throw new Error('A transaction cannot be linked to itself');
    }
    if (line.linkedTransferId) {
      throw new Error('That line is already one half of a transfer — reload and look again');
    }
    if (transaction.linkedTransferId || transaction.linkedTransferSplitId) {
      throw new Error('Transaction is already part of a linked transfer');
    }
    if (transaction.isSplit) {
      throw new Error('A split transaction cannot become a transfer — remove the split first');
    }
    if (transaction.archived === true) {
      throw new Error('That row is archived — bring it back into the register before pairing it');
    }
    if (transaction.accountId === parent.accountId) {
      throw new Error('A transfer needs two different accounts');
    }
    if (line.transferAccountId && line.transferAccountId !== transaction.accountId) {
      throw new Error('That line transfers to a different account from the one that row sits in');
    }
    const lineAmount = toDecimal(line.amount);
    if (lineAmount.isZero() || !toDecimal(transaction.amount).equals(lineAmount.negated())) {
      throw new Error('Transfer sides must have exactly opposite non-zero amounts');
    }

    // ── Past every refusal: persist ───────────────────────────────────────────
    const newLine: TransactionSplit = {
      ...line,
      transferAccountId: transaction.accountId,
      linkedTransferId: transaction.id,
    };
    // The row over there files under the To/From category of the account the
    // SPLIT sits in, and points back at both the parent and the exact line.
    const newTransaction: Transaction = {
      ...transaction,
      type: 'transfer',
      category: await this.localTransferCategoryFor(parent.accountId, transaction.amount),
      transferAccountId: parent.accountId,
      linkedTransferId: parent.id,
      linkedTransferSplitId: line.id,
    };

    await this.persistCollection(
      STORAGE_KEYS.TRANSACTION_SPLITS,
      splits.map(s => (s.id === splitId ? newLine : s))
    );
    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      transactions.map(t => (t.id === transactionId ? newTransaction : t))
    );
    return { split: newLine, transaction: newTransaction };
  }

  /**
   * Break linked transfer pairs — clear linkedTransferId on the named rows.
   *
   * The un-doing of linkTransferPair, and the step a corrective re-pair needs
   * before the link RPC will accept a row. Balance-neutral: only the link is
   * removed. Rows whose opposite is a split LINE are refused by the cloud path
   * (their link also lives on the split line) and skipped locally, so the two
   * modes agree. Returns the number of rows actually unlinked.
   */
  async unlinkTransfers(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.clearTransferLinks(ids, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (!idSet.has(t.id) || t.linkedTransferSplitId) return t;
      if (!t.linkedTransferId) return t;
      count += 1;
      const { linkedTransferId: _removed, ...rest } = t;
      return rest;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);
    return count;
  }

  /**
   * Soft-archive (or restore) one transaction. Balance-neutral and reversible —
   * the row is never deleted, just hidden from the live register.
   */
  async setTransactionArchived(id: string, archived: boolean): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.setTransactionArchived(id, archived, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    if (!transactions.some(t => t.id === id)) {
      throw new Error('Transaction not found');
    }
    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      transactions.map(t => (t.id === id ? { ...t, archived } : t))
    );
  }

  /**
   * Re-pair a counterpart onto the row that really matches it: break the wrong
   * pairing, file the row it displaces as Account Adjustment, and link the
   * right pair.
   *
   * Cloud mode is ONE call — repair_claimed_transfer does all three in a single
   * database transaction, so there is no half-repaired state to compensate for
   * and no audit gap. Local/demo mirrors the RPC's invariants and its outcome,
   * and is likewise all-or-nothing: every check runs before the single persist.
   */
  async repairClaimedTransfer(
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ): Promise<{ stranded: Transaction; counterpart: Transaction; partner: Transaction }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.repairClaimedTransfer(
        strandedId, counterpartId, partnerId, adjustmentCategoryId, userId
      );
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const stranded = transactions.find(t => t.id === strandedId);
    const counterpart = transactions.find(t => t.id === counterpartId);
    const partner = transactions.find(t => t.id === partnerId);
    if (!stranded || !counterpart || !partner) {
      throw new Error('Transaction not found');
    }
    // The pairing being broken must still be the one the caller saw — mutual,
    // both ways round, so a stale list cannot unlink a pair that has moved on.
    if (counterpart.linkedTransferId !== partner.id || partner.linkedTransferId !== counterpart.id) {
      throw new Error('Those two rows are not linked to each other any more — reload and look again');
    }
    if (stranded.isSplit || counterpart.isSplit || partner.isSplit) {
      throw new Error('A split transaction cannot become a transfer — remove the split first');
    }
    if (stranded.linkedTransferSplitId || counterpart.linkedTransferSplitId || partner.linkedTransferSplitId) {
      throw new Error('One of these legs is the opposite side of a split line — edit the split to unpick it first');
    }
    if (stranded.archived || counterpart.archived || partner.archived) {
      throw new Error('One of these rows is archived — bring it back into the register before re-pairing it');
    }
    if (stranded.linkedTransferId) {
      throw new Error('Transaction is already part of a linked transfer');
    }
    if (counterpart.accountId === stranded.accountId) {
      throw new Error('A transfer needs two different accounts');
    }
    const counterpartAmount = toDecimal(counterpart.amount);
    if (counterpartAmount.isZero() || !counterpartAmount.equals(toDecimal(stranded.amount).negated())) {
      throw new Error('Transfer sides must have exactly opposite non-zero amounts');
    }

    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    if (stranded.category && categories.some(c => c.id === stranded.category)) {
      throw new Error('That row has been filed under a category since this list was built — reload and look again');
    }
    const adjustment = categories.find(c => c.id === adjustmentCategoryId);
    if (!adjustment || adjustment.isTransferCategory === true || adjustment.level === 'type') {
      throw new Error(`Unknown or transfer category: ${adjustmentCategoryId}`);
    }

    // The displaced row stops being half of a transfer, so the transfer
    // scaffolding goes with the link: no partner, no target account, typed by
    // the money's own direction, filed under the adjustment.
    const { linkedTransferId: _partnerLink, transferAccountId: _partnerTarget, ...partnerRest } = partner;
    const newPartner: Transaction = {
      ...partnerRest,
      category: adjustmentCategoryId,
      type: toDecimal(partner.amount).isNegative() ? 'expense' : 'income',
    };
    const newCounterpart: Transaction = {
      ...counterpart,
      type: 'transfer',
      category: await this.localTransferCategoryFor(stranded.accountId, counterpart.amount),
      transferAccountId: stranded.accountId,
      linkedTransferId: stranded.id,
    };
    const newStranded: Transaction = {
      ...stranded,
      type: 'transfer',
      category: await this.localTransferCategoryFor(counterpart.accountId, stranded.amount),
      transferAccountId: counterpart.accountId,
      linkedTransferId: counterpart.id,
    };

    // Balance-neutral: no amount, sign or account moves, so no balance write.
    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      transactions.map(t =>
        t.id === partnerId ? newPartner
          : t.id === counterpartId ? newCounterpart
            : t.id === strandedId ? newStranded
              : t
      )
    );
    return { stranded: newStranded, counterpart: newCounterpart, partner: newPartner };
  }

  /**
   * Money-style "create the other side": insert the counterpart in the target
   * account, convert the source into a linked transfer, and move the target
   * account's balance. Mirrors the create_transfer_counterpart RPC.
   */
  async createTransferCounterpart(
    id: string,
    targetAccountId: string
  ): Promise<{ source: Transaction; counterpart: Transaction }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.createTransferCounterpart(id, targetAccountId, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const source = transactions.find(t => t.id === id);
    if (!source) {
      throw new Error('Transaction not found');
    }
    if (toDecimal(source.amount).isZero()) {
      throw new Error('A zero-amount transaction cannot become a transfer');
    }
    if (source.isSplit) {
      throw new Error('A split transaction cannot become a transfer — remove the split first');
    }
    if (source.linkedTransferId) {
      throw new Error('Transaction is already part of a linked transfer');
    }
    if (source.accountId === targetAccountId) {
      throw new Error('A transfer needs two different accounts');
    }

    // Mirrors the RPC's cross-currency guard: the counterpart is -amount with
    // no conversion, so both accounts must share a currency (when both set).
    const allAccounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const sourceAccount = allAccounts.find(a => a.id === source.accountId);
    const targetAccount = allAccounts.find(a => a.id === targetAccountId);
    if (
      sourceAccount?.currency && targetAccount?.currency &&
      sourceAccount.currency !== targetAccount.currency
    ) {
      throw new Error(
        `Transfers between accounts in different currencies are not supported yet (${sourceAccount.currency} and ${targetAccount.currency})`
      );
    }

    const counterpartAmount = toDecimal(source.amount).negated().toNumber();
    const counterpart: Transaction = {
      id: this.generateId(),
      date: source.date,
      description: source.description,
      amount: counterpartAmount,
      type: 'transfer',
      category: await this.localTransferCategoryFor(source.accountId, counterpartAmount),
      accountId: targetAccountId,
      notes: source.notes,
      cleared: false,
      transferAccountId: source.accountId,
      linkedTransferId: source.id,
    } as Transaction;
    const newSource: Transaction = {
      ...source,
      type: 'transfer',
      category: await this.localTransferCategoryFor(targetAccountId, source.amount),
      transferAccountId: targetAccountId,
      linkedTransferId: counterpart.id,
    };

    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      [...transactions.map(t => (t.id === id ? newSource : t)), counterpart]
    );
    await this.updateAccountBalance(targetAccountId, counterpartAmount);
    return { source: newSource, counterpart };
  }

  /**
   * Join two categories: every reference moves from source to target, then the
   * source goes.
   *
   * Cloud mode is ONE call — merge_categories does all of it in a single
   * database transaction, so there is no half-merged state to compensate for
   * and no audit gap. Local/demo mirrors the RPC's rules and its outcome, and
   * is likewise all-or-nothing: every validation runs BEFORE the first persist,
   * so a refusal leaves browser storage exactly as it was.
   *
   * Recurring templates have no local writer (nothing persists
   * STORAGE_KEYS.RECURRING today), so the local count for them is always 0 —
   * the cloud path moves the real ones.
   */
  async mergeCategories(sourceId: string, targetId: string): Promise<CategoryMergeResult> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.mergeCategories(userId, sourceId, targetId);
    }
    this.guardCloudWrite();

    if (!sourceId || !targetId) {
      throw new Error('A merge needs the category to merge away and the category to merge it into');
    }
    if (sourceId === targetId) {
      throw new Error('A category cannot be merged into itself');
    }

    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const source = categories.find(c => c.id === sourceId);
    const target = categories.find(c => c.id === targetId);
    if (!source || !target) {
      throw new Error('Category not found');
    }

    // The source guards, in the RPC's order and wording.
    if (source.level === 'type') {
      throw new Error(`"${source.name}" is a top-level heading, not a category things are filed under`);
    }
    if (source.isTransferCategory === true) {
      throw new Error('Transfer categories are managed automatically from their account — close the account instead');
    }
    if (source.isRevaluationCategory === true || source.isSystem === true) {
      throw new Error(`"${source.name}" is a built-in category the app files transactions under automatically, so it cannot be merged away`);
    }
    if (source.isUnassignedBucket === true) {
      throw new Error(`Rows in "${source.name}" are not categorised at all — file them from the review band rather than merging the whole bucket into a real category`);
    }
    if (categories.some(c => c.parentId === sourceId)) {
      throw new Error(`"${source.name}" has categories under it — merging a whole group is not supported yet; merge its detail categories one at a time`);
    }

    // The target guards.
    if (target.level === 'type') {
      throw new Error(`"${target.name}" is a top-level heading — nothing is filed against one`);
    }
    if (target.isTransferCategory === true) {
      throw new Error(`"${target.name}" belongs to an account's transfer bookkeeping — filing ordinary transactions there would invent transfers that never happened`);
    }
    if (target.isUnassignedBucket === true) {
      throw new Error(`"${target.name}" means "not categorised" — merging into it would un-file transactions that are already filed`);
    }
    if (target.isActive === false) {
      throw new Error(`"${target.name}" is hidden, so nothing can be filed under it — pick a category that is in use`);
    }
    if (categories.some(c => c.parentId === targetId)) {
      throw new Error(`"${target.name}" is a group, and transactions belong to a category inside it — pick one of its detail categories`);
    }

    // Direction: a 'both' target takes either, because it carries no direction
    // of its own; nothing else crosses.
    if (target.type !== 'both' && target.type !== source.type) {
      throw new Error(
        `"${source.name}" is an ${source.type} category and "${target.name}" is an ${target.type} one — merging across the two would file money on the wrong side of every report`
      );
    }

    const transactions = await this.readLocalTransactions();
    const splits = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    const budgets = await this.readCollection<Budget>(STORAGE_KEYS.BUDGETS);

    let movedTransactions = 0;
    const nextTransactions = transactions.map(t => {
      if (t.category !== sourceId) return t;
      movedTransactions += 1;
      return { ...t, category: targetId };
    });

    // Split lines keep their amounts and memos: two lines of one transaction
    // landing on the same target stay two lines, because adding them together
    // would destroy the user's own breakdown.
    let movedSplitLines = 0;
    const touchedParents = new Set<string>();
    const nextSplits = splits.map(s => {
      if (s.category !== sourceId) return s;
      movedSplitLines += 1;
      touchedParents.add(s.transactionId);
      return { ...s, category: targetId };
    });

    let movedBudgets = 0;
    const nextBudgets = budgets.map(b => {
      if (b.categoryId !== sourceId) return b;
      movedBudgets += 1;
      return { ...b, categoryId: targetId, updatedAt: this.nowProvider() };
    });

    // Every check has passed, so the writes go together. Categories LAST: if a
    // write fails part way, references pointing at a category that still exists
    // is a recoverable state, and the reverse is not.
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, nextTransactions);
    await this.persistCollection(STORAGE_KEYS.TRANSACTION_SPLITS, nextSplits);
    await this.persistCollection(STORAGE_KEYS.BUDGETS, nextBudgets);
    await this.persistCollection(
      STORAGE_KEYS.CATEGORIES,
      categories.filter(c => c.id !== sourceId)
    );

    return {
      sourceId,
      targetId,
      transactions: movedTransactions,
      splitLines: movedSplitLines,
      splitTransactions: touchedParents.size,
      budgets: movedBudgets,
      recurring: 0
    };
  }

  /**
   * Suggestions the user has told the sweeps to stop offering.
   *
   * The local/demo mirror is a plain collection in browser storage, keyed the
   * same way the table is — (kind, subjectKey) — so demo mode behaves exactly
   * like the cloud: refuse a suggestion, close the sweep, re-open it, and the
   * suggestion is still gone.
   */
  async getSuggestionDismissals(): Promise<SuggestionDismissal[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.suggestionDismissalService.list(userId);
    }
    if (this.isCloudSessionPending()) return [];
    return this.readLocalDismissals();
  }

  /**
   * Record a refusal. Idempotent in both modes: refusing something already
   * refused returns the existing record, so a double-click (or a second device)
   * cannot turn a decision into an error message.
   */
  async dismissSuggestion(
    kind: DismissalKind,
    subjectKey: string,
    subjectIds: string[]
  ): Promise<SuggestionDismissal> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.suggestionDismissalService.dismiss(userId, kind, subjectKey, subjectIds);
    }
    this.guardCloudWrite();

    const stored = await this.readLocalDismissals();
    const existing = stored.find(d => d.kind === kind && d.subjectKey === subjectKey);
    if (existing) return existing;

    const dismissal: SuggestionDismissal = {
      id: this.generateId(),
      kind,
      subjectKey,
      subjectIds,
      dismissedAt: this.nowProvider(),
    };
    await this.persistCollection(STORAGE_KEYS.SUGGESTION_DISMISSALS, [...stored, dismissal]);
    return dismissal;
  }

  /** Undo a refusal: the suggestion is offered again from the next scan. */
  async restoreSuggestion(kind: DismissalKind, subjectKey: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.suggestionDismissalService.restore(userId, kind, subjectKey);
    }
    this.guardCloudWrite();

    const stored = await this.readLocalDismissals();
    await this.persistCollection(
      STORAGE_KEYS.SUGGESTION_DISMISSALS,
      stored.filter(d => !(d.kind === kind && d.subjectKey === subjectKey))
    );
  }

  /**
   * The browser-local dismissals. Stored as JSON, so `dismissedAt` comes back
   * as the string it was serialised to — made true here rather than at each
   * reader, the same boundary readLocalTransactions handles for dates.
   */
  private async readLocalDismissals(): Promise<SuggestionDismissal[]> {
    const stored = await this.readCollection<SuggestionDismissal>(STORAGE_KEYS.SUGGESTION_DISMISSALS);
    return stored.map(dismissal => ({
      ...dismissal,
      subjectIds: dismissal.subjectIds ?? [],
      dismissedAt: new Date(dismissal.dismissedAt),
    }));
  }

  // Budgets/goals/categories are local-only here (PlanningService owns the
  // cloud path) — but a signed-in session must still never read them from
  // browser-local storage, so the same pending gate applies.
  async getBudgets(): Promise<Budget[]> {
    if (this.isCloudSessionPending()) return [];
    return this.readCollection<Budget>(STORAGE_KEYS.BUDGETS);
  }

  async getGoals(): Promise<Goal[]> {
    if (this.isCloudSessionPending()) return [];
    return this.readCollection<Goal>(STORAGE_KEYS.GOALS);
  }

  async getCategories(): Promise<Category[]> {
    if (this.isCloudSessionPending()) return [];
    return this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
  }

  private async updateAccountBalance(accountId: string, amount: number): Promise<void> {
    if (this.isSupabaseReady()) {
      // Cloud mode: balances are adjusted atomically inside the Postgres RPCs
      // (create/update/delete_transaction_atomic) — never in JS.
      return;
    }

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      // Decimal arithmetic — IEEE-754 float math is banned on money values.
      account.balance = toDecimal(account.balance || 0).plus(toDecimal(amount)).toNumber();
      await this.persistCollection(STORAGE_KEYS.ACCOUNTS, accounts);
    }
  }

  subscribeToUpdates(callbacks: {
    onAccountUpdate?: (payload: unknown) => void;
    onTransactionUpdate?: (payload: unknown) => void;
  }): () => void {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (!userId || !this.supabaseChecker()) {
      return () => {};
    }

    const unsubscribers: Array<() => void> = [];

    if (callbacks.onAccountUpdate && this.accountService.subscribeToAccounts) {
      unsubscribers.push(this.accountService.subscribeToAccounts(userId, callbacks.onAccountUpdate));
    }

    if (callbacks.onTransactionUpdate && this.transactionService.subscribeToTransactions) {
      unsubscribers.push(this.transactionService.subscribeToTransactions(userId, callbacks.onTransactionUpdate));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  isUsingSupabase(): boolean {
    return this.isSupabaseReady();
  }

  getUserIds(): { clerkId: string | null; databaseId: string | null } {
    return this.userIdService.getCurrentUserIds();
  }
}

let defaultDataService = new DataServiceImpl();

export class DataService {
  static configure(options: DataServiceOptions = {}) {
    defaultDataService = new DataServiceImpl(options);
  }

  private static get service(): DataServiceImpl {
    return defaultDataService;
  }

  static initialize(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<void> {
    return this.service.initialize(clerkId, email, firstName, lastName);
  }

  static getClosedAccounts(): Promise<Account[]> {
    return this.service.getClosedAccounts();
  }

  static getAccounts(): Promise<Account[]> {
    return this.service.getAccounts();
  }

  static createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    return this.service.createAccount(account);
  }

  static updateAccount(id: string, updates: AccountUpdate): Promise<Account> {
    return this.service.updateAccount(id, updates);
  }

  static deleteAccount(id: string): Promise<void> {
    return this.service.deleteAccount(id);
  }

  static getTransactions(): Promise<Transaction[]> {
    return this.service.getTransactions();
  }

  static loadBootTransactions(): Promise<BootTransactionsResult> {
    return this.service.loadBootTransactions();
  }

  static getAccountBalances(): Promise<ReadonlyMap<string, AccountBalanceSnapshot>> {
    return this.service.getAccountBalances();
  }

  static createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    return this.service.createTransaction(transaction);
  }

  static updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    return this.service.updateTransaction(id, updates);
  }

  static deleteTransaction(id: string): Promise<void> {
    return this.service.deleteTransaction(id);
  }

  static setTransactionsCleared(ids: string[], cleared: boolean): Promise<number> {
    return this.service.setTransactionsCleared(ids, cleared);
  }

  static applyCategoryToUncategorized(ids: string[], category: string): Promise<number> {
    return this.service.applyCategoryToUncategorized(ids, category);
  }

  static confirmTransactionCategories(ids: string[]): Promise<number> {
    return this.service.confirmTransactionCategories(ids);
  }

  static archiveTransactionsBefore(accountId: string, cutoff: Date): Promise<number> {
    return this.service.archiveTransactionsBefore(accountId, cutoff);
  }

  static unarchiveAccount(accountId: string): Promise<number> {
    return this.service.unarchiveAccount(accountId);
  }

  static getAllTransactionSplits(): Promise<TransactionSplit[]> {
    return this.service.getAllTransactionSplits();
  }

  static linkTransferPair(idA: string, idB: string): Promise<{ a: Transaction; b: Transaction }> {
    return this.service.linkTransferPair(idA, idB);
  }

  static linkSplitLineTransfer(
    splitId: string,
    transactionId: string
  ): Promise<{ split: TransactionSplit; transaction: Transaction }> {
    return this.service.linkSplitLineTransfer(splitId, transactionId);
  }

  static unlinkTransfers(ids: string[]): Promise<number> {
    return this.service.unlinkTransfers(ids);
  }

  static setTransactionArchived(id: string, archived: boolean): Promise<void> {
    return this.service.setTransactionArchived(id, archived);
  }

  static repairClaimedTransfer(
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ): Promise<{ stranded: Transaction; counterpart: Transaction; partner: Transaction }> {
    return this.service.repairClaimedTransfer(
      strandedId, counterpartId, partnerId, adjustmentCategoryId
    );
  }

  static createTransferCounterpart(
    id: string,
    targetAccountId: string
  ): Promise<{ source: Transaction; counterpart: Transaction }> {
    return this.service.createTransferCounterpart(id, targetAccountId);
  }

  static getTransactionSplits(transactionId: string): Promise<TransactionSplit[]> {
    return this.service.getTransactionSplits(transactionId);
  }

  static setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null
  ): Promise<SplitWriteResult> {
    return this.service.setTransactionSplits(transactionId, splits, expectedAmount);
  }

  static mergeCategories(sourceId: string, targetId: string): Promise<CategoryMergeResult> {
    return this.service.mergeCategories(sourceId, targetId);
  }

  static getSuggestionDismissals(): Promise<SuggestionDismissal[]> {
    return this.service.getSuggestionDismissals();
  }

  static dismissSuggestion(
    kind: DismissalKind,
    subjectKey: string,
    subjectIds: string[]
  ): Promise<SuggestionDismissal> {
    return this.service.dismissSuggestion(kind, subjectKey, subjectIds);
  }

  static restoreSuggestion(kind: DismissalKind, subjectKey: string): Promise<void> {
    return this.service.restoreSuggestion(kind, subjectKey);
  }

  static getBudgets(): Promise<Budget[]> {
    return this.service.getBudgets();
  }

  static getGoals(): Promise<Goal[]> {
    return this.service.getGoals();
  }

  static getCategories(): Promise<Category[]> {
    return this.service.getCategories();
  }

  static subscribeToUpdates(callbacks: {
    onAccountUpdate?: (payload: unknown) => void;
    onTransactionUpdate?: (payload: unknown) => void;
  }): () => void {
    return this.service.subscribeToUpdates(callbacks);
  }

  static isUsingSupabase(): boolean {
    return this.service.isUsingSupabase();
  }

  static getUserIds(): { clerkId: string | null; databaseId: string | null } {
    return this.service.getUserIds();
  }
}

export const createDataService = (options: DataServiceOptions = {}) => new DataServiceImpl(options);
