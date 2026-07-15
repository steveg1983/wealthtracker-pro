
/**
 * Unified Data Service Layer
 * This service provides a single interface for all data operations
 * and handles the switch between Supabase (cloud) and localStorage (fallback)
 */

import { UserService } from './userService';
import { AccountService } from './accountService';
import { TransactionService } from './transactionService';
import { isSupabaseConfigured } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import { toDecimal } from '../../utils/decimal';
import type { Account, Transaction, TransactionSplit, TransactionSplitInput, Budget, Goal, Category } from '../../types';

export interface AppData {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
}

 type Logger = Pick<Console, 'log' | 'warn' | 'error'>;
type AccountServiceLike = Pick<typeof AccountService,
  'getAccounts' | 'getClosedAccounts' | 'createAccount' | 'updateAccount' | 'deleteAccount'> & {
  subscribeToAccounts?: (userId: string, callback: (payload: unknown) => void) => () => void;
};
type TransactionServiceLike = Pick<typeof TransactionService,
  'getTransactions' | 'createTransaction' | 'updateTransaction' | 'deleteTransaction' | 'setTransactionsCleared' | 'applyCategoryToUncategorized' | 'getTransactionSplits' | 'setTransactionSplits' | 'getAllTransactionSplits' | 'linkTransferPair' | 'createTransferCounterpart'> & {
  subscribeToTransactions?: (userId: string, callback: (payload: unknown) => void) => () => void;
};
type UserIdServiceLike = Pick<typeof userIdService,
  'ensureUserExists' | 'getCurrentDatabaseUserId' | 'getCurrentUserIds'>;
type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'>;
type SupabaseChecker = () => boolean;
type DateProvider = () => Date;
type UuidGenerator = () => string;

export interface DataServiceOptions {
  accountService?: AccountServiceLike;
  transactionService?: TransactionServiceLike;
  userService?: typeof UserService;
  userIdService?: UserIdServiceLike;
  storageAdapter?: StorageAdapterLike;
  logger?: Logger;
  now?: DateProvider;
  uuid?: UuidGenerator;
  isSupabaseConfigured?: SupabaseChecker;
}

class DataServiceImpl {
  private readonly accountService: AccountServiceLike;
  private readonly transactionService: TransactionServiceLike;
  private readonly userService: typeof UserService;
  private readonly userIdService: UserIdServiceLike;
  private readonly storage: StorageAdapterLike;
  private readonly logger: Logger;
  private readonly nowProvider: DateProvider;
  private readonly uuid: UuidGenerator;
  private readonly supabaseChecker: SupabaseChecker;

  constructor(options: DataServiceOptions = {}) {
    this.accountService = options.accountService ?? AccountService;
    this.transactionService = options.transactionService ?? TransactionService;
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
  }

  private isSupabaseReady(): boolean {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    return Boolean(userId && this.supabaseChecker());
  }

  private async readCollection<T>(key: string): Promise<T[]> {
    const stored = await this.storage.get<T[]>(key);
    return stored || [];
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

  async loadAppData(): Promise<AppData> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (!userId && this.supabaseChecker()) {
      this.logger.warn('[DataService] No database ID available, using localStorage fallback');
    }

    try {
      const [accounts, transactions, budgets, goals, categories] = await Promise.all([
        this.getAccounts(),
        this.getTransactions(),
        this.getBudgets(),
        this.getGoals(),
        this.getCategories()
      ]);

      return { accounts, transactions, budgets, goals, categories };
    } catch (error) {
      this.logger.error('Error loading app data:', error as Error);
      return {
        accounts: [],
        transactions: [],
        budgets: [],
        goals: [],
        categories: []
      };
    }
  }

  async getAccounts(): Promise<Account[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.getAccounts(userId);
    }
    return this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
  }

  /** Closed accounts for the Accounts page's Closed Accounts section. */
  async getClosedAccounts(): Promise<Account[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.getClosedAccounts(userId);
    }
    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    return accounts.filter(a => a.isActive === false);
  }

  async createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.createAccount(userId, account);
    }

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const newAccount: Account = {
      ...account,
      id: this.generateId()
    } as Account;
    accounts.push(newAccount);
    await this.persistCollection(STORAGE_KEYS.ACCOUNTS, accounts);
    return newAccount;
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.updateAccount(id, updates, userId);
    }

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const index = accounts.findIndex(account => account.id === id);
    if (index === -1) {
      throw new Error('Account not found');
    }

    accounts[index] = { ...accounts[index], ...updates } as Account;
    await this.persistCollection(STORAGE_KEYS.ACCOUNTS, accounts);
    return accounts[index];
  }

  async deleteAccount(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.deleteAccount(id, userId);
    }

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

    return this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
  }

  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.createTransaction(userId, transaction);
    }

    const transactions = await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const newTransaction: Transaction = {
      ...transaction,
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

    const transactions = await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const index = transactions.findIndex(transaction => transaction.id === id);
    if (index === -1) {
      throw new Error('Transaction not found');
    }

    const oldAmount = transactions[index].amount;
    const oldAccountId = transactions[index].accountId;

    transactions[index] = { ...transactions[index], ...updates } as Transaction;
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, transactions);

    if (updates.amount !== undefined && updates.amount !== oldAmount) {
      await this.updateAccountBalance(oldAccountId, -oldAmount + updates.amount);
    }

    return transactions[index];
  }

  async deleteTransaction(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.deleteTransaction(id, userId);
    }

    const transactions = await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      await this.updateAccountBalance(transaction.accountId, -transaction.amount);
    }
    const filtered = transactions.filter(t => t.id !== id);
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, filtered);
  }

  /** Bulk-set the reconciliation cleared flag; balance-neutral by definition. */
  async setTransactionsCleared(ids: string[], cleared: boolean): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.setTransactionsCleared(ids, cleared, userId);
    }

    const transactions = await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (idSet.has(t.id)) {
        count += 1;
        return { ...t, cleared };
      }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);
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

    const transactions = await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (idSet.has(t.id) && (!t.category || t.category.trim() === '')) {
        count += 1;
        return { ...t, category };
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

    return this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
  }

  /** Splits for one transaction, in display order (empty when not split). */
  async getTransactionSplits(transactionId: string): Promise<TransactionSplit[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.getTransactionSplits(transactionId);
    }

    const stored = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    return stored
      .filter(s => s.transactionId === transactionId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Replace a transaction's splits atomically (empty array un-splits it).
   * Server-side the RPC validates ≥2 lines / non-zero amounts / sum ==
   * expectedAmount and syncs the amount + account balance; the local path
   * mirrors those rules so demo/offline behave identically.
   */
  async setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null
  ): Promise<{ isSplit: boolean; splitCount: number; amount: number }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.setTransactionSplits(transactionId, splits, expectedAmount, userId);
    }

    const transactions = await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const index = transactions.findIndex(t => t.id === transactionId);
    if (index === -1) {
      throw new Error('Transaction not found');
    }
    const transaction = transactions[index];
    if (transaction.type === 'transfer') {
      throw new Error('Transfers cannot be split');
    }

    const stored = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    const others = stored.filter(s => s.transactionId !== transactionId);

    if (splits.length === 0) {
      await this.persistCollection(STORAGE_KEYS.TRANSACTION_SPLITS, others);
      transactions[index] = { ...transaction, isSplit: false } as Transaction;
      await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, transactions);
      return { isSplit: false, splitCount: 0, amount: transaction.amount };
    }

    if (splits.length < 2) {
      throw new Error('A split needs at least 2 lines');
    }
    let sum = toDecimal(0);
    for (const split of splits) {
      if (!split.category.trim()) {
        throw new Error('Every split line needs a category');
      }
      if (!split.amount) {
        throw new Error('Every split line needs a non-zero amount');
      }
      sum = sum.plus(toDecimal(split.amount));
    }
    if (expectedAmount !== null && !sum.equals(toDecimal(expectedAmount))) {
      throw new Error('The split lines must sum to the transaction amount');
    }

    const newSplits: TransactionSplit[] = splits.map((split, i) => ({
      id: this.generateId(),
      transactionId,
      category: split.category,
      amount: split.amount,
      ...(split.memo ? { memo: split.memo } : {}),
      sortOrder: i + 1,
    }));
    await this.persistCollection(STORAGE_KEYS.TRANSACTION_SPLITS, [...others, ...newSplits]);

    const newAmount = sum.toNumber();
    transactions[index] = { ...transaction, isSplit: true, category: '', amount: newAmount } as Transaction;
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, transactions);
    if (newAmount !== transaction.amount) {
      await this.updateAccountBalance(transaction.accountId, -transaction.amount + newAmount);
    }
    return { isSplit: true, splitCount: newSplits.length, amount: newAmount };
  }

  /** The account-managed To/From category id, or the legacy sentinel. */
  private async localTransferCategoryFor(accountId: string, amount: number): Promise<string> {
    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const transferCategory = categories.find(c => c.isTransferCategory === true && c.accountId === accountId);
    return transferCategory?.id ?? (amount < 0 ? 'transfer-out' : 'transfer-in');
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

    const transactions = await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
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

    const transactions = await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
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

  async getBudgets(): Promise<Budget[]> {
    return this.readCollection<Budget>(STORAGE_KEYS.BUDGETS);
  }

  async getGoals(): Promise<Goal[]> {
    return this.readCollection<Goal>(STORAGE_KEYS.GOALS);
  }

  async getCategories(): Promise<Category[]> {
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

  async refreshData(): Promise<AppData> {
    return this.loadAppData();
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

  static loadAppData(): Promise<AppData> {
    return this.service.loadAppData();
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

  static updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
    return this.service.updateAccount(id, updates);
  }

  static deleteAccount(id: string): Promise<void> {
    return this.service.deleteAccount(id);
  }

  static getTransactions(): Promise<Transaction[]> {
    return this.service.getTransactions();
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

  static getAllTransactionSplits(): Promise<TransactionSplit[]> {
    return this.service.getAllTransactionSplits();
  }

  static linkTransferPair(idA: string, idB: string): Promise<{ a: Transaction; b: Transaction }> {
    return this.service.linkTransferPair(idA, idB);
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
  ): Promise<{ isSplit: boolean; splitCount: number; amount: number }> {
    return this.service.setTransactionSplits(transactionId, splits, expectedAmount);
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

  static refreshData(): Promise<AppData> {
    return this.service.refreshData();
  }
}

export const createDataService = (options: DataServiceOptions = {}) => new DataServiceImpl(options);
