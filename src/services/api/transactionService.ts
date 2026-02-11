
import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import type { Transaction } from '../../types';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';

type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'>;
type SupabaseClientLike = typeof supabase;
type SupabaseConfiguredChecker = () => boolean;
type Logger = Pick<Console, 'error'>;
type UuidGenerator = () => string;
type DateProvider = () => Date;

export interface TransactionServiceOptions {
  supabaseClient?: SupabaseClientLike;
  isSupabaseConfigured?: SupabaseConfiguredChecker;
  storageAdapter?: StorageAdapterLike;
  logger?: Logger;
  now?: DateProvider;
  uuid?: UuidGenerator;
}

class TransactionServiceImpl {
  private readonly supabaseClient: SupabaseClientLike;
  private readonly supabaseChecker: SupabaseConfiguredChecker;
  private readonly storage: StorageAdapterLike;
  private readonly logger: Logger;
  private readonly nowProvider: DateProvider;
  private readonly uuid: UuidGenerator;

  constructor(options: TransactionServiceOptions = {}) {
    this.supabaseClient = options.supabaseClient ?? supabase;
    this.supabaseChecker = options.isSupabaseConfigured ?? isSupabaseConfigured;
    this.storage = options.storageAdapter ?? storageAdapter;
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? (() => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    });
  }

  private isSupabaseReady(): boolean {
    return Boolean(this.supabaseClient && this.supabaseChecker());
  }

  private getCurrentDate(): Date {
    const now = this.nowProvider();
    return new Date(now.getTime());
  }

  private async readStoredTransactions(): Promise<Transaction[]> {
    const stored = await this.storage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
    return stored || [];
  }

  private async persistTransactions(transactions: Transaction[]): Promise<void> {
    await this.storage.set(STORAGE_KEYS.TRANSACTIONS, transactions);
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      return this.readStoredTransactions();
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        this.logger.error('Error fetching transactions:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data || [];
    } catch (error) {
      this.logger.error('TransactionService.getTransactions error:', error as Error);
      return this.readStoredTransactions();
    }
  }

  async createTransaction(
    userId: string,
    transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Transaction> {
    if (!this.isSupabaseReady()) {
      const now = this.getCurrentDate();
      const newTransaction: Transaction = {
        ...transaction,
        id: this.uuid(),
        createdAt: now,
        updatedAt: now
      } as Transaction;

      const transactions = await this.readStoredTransactions();
      transactions.push(newTransaction);
      await this.persistTransactions(transactions);

      return newTransaction;
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transactions')
        .insert({
          ...transaction,
          user_id: userId
        } as never)
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      await this.updateAccountBalance(transaction.accountId, transaction.amount);
      return data!;
    } catch (error) {
      this.logger.error('TransactionService.createTransaction error:', error as Error);
      throw error;
    }
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const index = transactions.findIndex(t => t.id === id);

      if (index === -1) {
        throw new Error('Transaction not found');
      }

      const oldAmount = transactions[index].amount;
      const updated: Transaction = {
        ...transactions[index],
        ...updates,
        updatedAt: this.getCurrentDate()
      } as Transaction;

      transactions[index] = updated;
      await this.persistTransactions(transactions);

      if (updates.amount !== undefined && updates.amount !== oldAmount) {
        // No account balance update in local mode; DataService handles local adjustments.
      }

      return updated;
    }

    try {
      const client = this.supabaseClient!;
      const { data: oldTransaction } = await client
        .from('transactions')
        .select('amount, account_id')
        .eq('id', id)
        .single();

      const { data, error } = await client
        .from('transactions')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error('Error updating transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      if (oldTransaction && updates.amount !== undefined && updates.amount !== (oldTransaction as { amount?: number }).amount) {
        const difference = (updates.amount as number) - ((oldTransaction as { amount?: number }).amount ?? 0);
        const accountId = (oldTransaction as { account_id?: string }).account_id;
        if (accountId) {
          await this.updateAccountBalance(accountId, difference);
        }
      }

      return data!;
    } catch (error) {
      this.logger.error('TransactionService.updateTransaction error:', error as Error);
      throw error;
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const filtered = transactions.filter(t => t.id !== id);
      await this.persistTransactions(filtered);
      return;
    }

    try {
      const client = this.supabaseClient!;
      const { data: transaction } = await client
        .from('transactions')
        .select('amount, account_id')
        .eq('id', id)
        .single();

      const { error } = await client
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error('Error deleting transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      if (transaction) {
        const { account_id: accountId, amount } = transaction as { account_id?: string; amount?: number };
        if (accountId && typeof amount === 'number') {
          await this.updateAccountBalance(accountId, -amount);
        }
      }
    } catch (error) {
      this.logger.error('TransactionService.deleteTransaction error:', error as Error);
      throw error;
    }
  }

  async getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      return transactions.filter(t => {
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
      });
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('date', { ascending: false });

      if (error) {
        this.logger.error('Error fetching transactions by date range:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data || [];
    } catch (error) {
      this.logger.error('TransactionService.getTransactionsByDateRange error:', error as Error);
      throw error;
    }
  }

  async getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      return transactions.filter(t => t.accountId === accountId);
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false });

      if (error) {
        this.logger.error('Error fetching transactions by account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data || [];
    } catch (error) {
      this.logger.error('TransactionService.getTransactionsByAccount error:', error as Error);
      throw error;
    }
  }

  async getTransactionsByCategory(categoryId: string): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      return transactions.filter(t => t.category === categoryId);
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('category_id', categoryId)
        .order('date', { ascending: false });

      if (error) {
        this.logger.error('Error fetching transactions by category:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data || [];
    } catch (error) {
      this.logger.error('TransactionService.getTransactionsByCategory error:', error as Error);
      throw error;
    }
  }

  async bulkCreateTransactions(
    userId: string,
    transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      const stored = await this.readStoredTransactions();
      const now = this.getCurrentDate(); // Returns Date object
      const newTransactions: Transaction[] = transactions.map(transaction => ({
        ...transaction,
        id: this.uuid(),
        createdAt: now,    // Date object, not string
        updatedAt: now     // Date object, not string
      } as Transaction));

      stored.push(...newTransactions);  // No cast needed
      await this.persistTransactions(stored);
      return newTransactions;           // No cast needed
    }

    try {
      const client = this.supabaseClient!;
      const transactionsWithUser = transactions.map(t => ({
        ...t,
        user_id: userId
      }));

      const { data, error } = await client
        .from('transactions')
        .insert(transactionsWithUser as never)
        .select();

      if (error) {
        this.logger.error('Error bulk creating transactions:', error);
        throw new Error(handleSupabaseError(error));
      }

      for (const transaction of data || []) {
        const { account_id: accountId, amount } = transaction as { account_id?: string; amount?: number };
        if (accountId && typeof amount === 'number') {
          await this.updateAccountBalance(accountId, amount);
        }
      }

      return data || [];
    } catch (error) {
      this.logger.error('TransactionService.bulkCreateTransactions error:', error as Error);
      throw error;
    }
  }

  subscribeToTransactions(userId: string, callback: (payload: unknown) => void): () => void {
    if (!this.isSupabaseReady()) {
      return () => {};
    }

    const client = this.supabaseClient!;
    const subscription = client
      .channel(`transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  private async updateAccountBalance(accountId: string, amount: number): Promise<void> {
    if (!this.isSupabaseReady()) {
      return;
    }

    try {
      const client = this.supabaseClient!;
      const { data: account } = await client
        .from('accounts')
        .select('balance')
        .eq('id', accountId)
        .single();

      if (account) {
        const newBalance = ((account as { balance?: number } | null)?.balance || 0) + amount;

        await client
          .from('accounts')
          .update({ balance: newBalance } as never)
          .eq('id', accountId);
      }
    } catch (error) {
      this.logger.error('Error updating account balance:', error as Error);
    }
  }
}

let defaultTransactionService = new TransactionServiceImpl();

export class TransactionService {
  static configure(options: TransactionServiceOptions = {}) {
    defaultTransactionService = new TransactionServiceImpl(options);
  }

  private static get service(): TransactionServiceImpl {
    return defaultTransactionService;
  }

  static getTransactions(userId: string): Promise<Transaction[]> {
    return this.service.getTransactions(userId);
  }

  static createTransaction(
    userId: string,
    transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Transaction> {
    return this.service.createTransaction(userId, transaction);
  }

  static updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    return this.service.updateTransaction(id, updates);
  }

  static deleteTransaction(id: string): Promise<void> {
    return this.service.deleteTransaction(id);
  }

  static getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    return this.service.getTransactionsByDateRange(userId, startDate, endDate);
  }

  static getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
    return this.service.getTransactionsByAccount(accountId);
  }

  static getTransactionsByCategory(categoryId: string): Promise<Transaction[]> {
    return this.service.getTransactionsByCategory(categoryId);
  }

  static bulkCreateTransactions(
    userId: string,
    transactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<Transaction[]> {
    return this.service.bulkCreateTransactions(userId, transactions);
  }

  static subscribeToTransactions(userId: string, callback: (payload: unknown) => void): () => void {
    return this.service.subscribeToTransactions(userId, callback);
  }
}

export const createTransactionService = (options: TransactionServiceOptions = {}) =>
  new TransactionServiceImpl(options);
