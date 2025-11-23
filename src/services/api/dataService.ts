
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
import type { Account, Transaction, Budget, Goal, Category } from '../../types';

export interface AppData {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
}

 type Logger = Pick<Console, 'log' | 'warn' | 'error'>;
type AccountServiceLike = Pick<typeof AccountService,
  'getAccounts' | 'createAccount' | 'updateAccount' | 'deleteAccount'> & {
  subscribeToAccounts?: (userId: string, callback: (payload: unknown) => void) => () => void;
};
type TransactionServiceLike = Pick<typeof TransactionService,
  'getTransactions' | 'createTransaction' | 'updateTransaction' | 'deleteTransaction'> & {
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
      return this.accountService.updateAccount(id, updates);
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
      return this.accountService.deleteAccount(id);
    }

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const filtered = accounts.filter(account => account.id !== id);
    await this.persistCollection(STORAGE_KEYS.ACCOUNTS, filtered);
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
      return this.transactionService.updateTransaction(id, updates);
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
      return this.transactionService.deleteTransaction(id);
    }

    const transactions = await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      await this.updateAccountBalance(transaction.accountId, -transaction.amount);
    }
    const filtered = transactions.filter(t => t.id !== id);
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, filtered);
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
      return;
    }

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      account.balance = (account.balance || 0) + amount;
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
