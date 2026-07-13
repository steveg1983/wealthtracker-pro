
import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import type { Transaction, TransactionSplit, TransactionSplitInput } from '../../types';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { toDecimal } from '../../utils/decimal';

type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'>;
type SupabaseClientLike = typeof supabase;
type SupabaseConfiguredChecker = () => boolean;
type Logger = Pick<Console, 'error'>;
type UuidGenerator = () => string;
type DateProvider = () => Date;
type FetchLike = typeof fetch;
type AuthTokenProvider = () => Promise<string | null>;

export interface TransactionServiceOptions {
  supabaseClient?: SupabaseClientLike;
  isSupabaseConfigured?: SupabaseConfiguredChecker;
  storageAdapter?: StorageAdapterLike;
  logger?: Logger;
  now?: DateProvider;
  uuid?: UuidGenerator;
  fetchImpl?: FetchLike;
  authTokenProvider?: AuthTokenProvider;
}

/** Map camelCase Transaction fields to snake_case DB columns */
const CAMEL_TO_DB: Record<string, string> = {
  accountId: 'account_id',
  cleared: 'is_cleared',
  isRecurring: 'is_recurring',
  categoryId: 'category_id',
  transferAccountId: 'transfer_account_id',
  bankReference: 'bank_reference',
  isImported: 'is_imported',
  isSplit: 'is_split',
  goalId: 'goal_id',
  accountName: 'account_name',
  categoryName: 'category_name',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  recurringTransactionId: 'recurring_transaction_id',
  linkedTransferId: 'linked_transfer_id',
  plaidTransactionId: 'plaid_transaction_id',
  paymentChannel: 'payment_channel',
  addedBy: 'added_by',
};

/** Reverse map: snake_case DB columns → camelCase Transaction fields */
const DB_TO_CAMEL: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_DB).map(([camel, db]) => [db, camel])
);

function mapFromDbFields(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[DB_TO_CAMEL[key] ?? key] = value;
  }
  return result;
}

function mapToDbFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip complex nested objects that don't map to DB columns
    if (key === 'transferMetadata' || key === 'investmentData' || key === 'location') {
      continue;
    }
    result[CAMEL_TO_DB[key] ?? key] = value;
  }
  return result;
}

class TransactionServiceImpl {
  private readonly supabaseClient: SupabaseClientLike;
  private readonly supabaseChecker: SupabaseConfiguredChecker;
  private readonly storage: StorageAdapterLike;
  private readonly logger: Logger;
  private readonly nowProvider: DateProvider;
  private readonly uuid: UuidGenerator;
  private readonly fetchImpl: FetchLike | null;
  private readonly authTokenProvider: AuthTokenProvider | null;

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
    this.fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    this.authTokenProvider = options.authTokenProvider ?? (async () => {
      if (typeof window === 'undefined' || !window.Clerk?.session?.getToken) {
        return null;
      }
      return window.Clerk.session.getToken();
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

      // Supabase caps responses at 1000 rows by default — without explicit
      // paging, users with more transactions silently lose data from view.
      // Page through the full history with .range() until exhausted.
      const PAGE_SIZE = 1000;
      const rows: Record<string, unknown>[] = [];
      let from = 0;

      for (;;) {
        const { data, error } = await client
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('id', { ascending: false }) // stable tiebreak for paging
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          this.logger.error('Error fetching transactions:', error);
          throw new Error(handleSupabaseError(error));
        }

        const page = (data || []) as Record<string, unknown>[];
        rows.push(...page);

        if (page.length < PAGE_SIZE) {
          break;
        }
        from += PAGE_SIZE;
      }

      return rows.map(row => mapFromDbFields(row)) as unknown as Transaction[];
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
      const dbRow = mapToDbFields(transaction as unknown as Record<string, unknown>);
      dbRow.user_id = userId;

      // Atomic RPC: inserts the transaction AND adjusts the account balance in
      // one database transaction (SQL numeric math — no JS floats, no
      // read-modify-write race, no partial-failure drift).
      const { data, error } = await client.rpc('create_transaction_atomic', { p: dbRow });

      if (error) {
        this.logger.error('Error creating transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      return mapFromDbFields(data as Record<string, unknown>) as unknown as Transaction;
    } catch (error) {
      this.logger.error('TransactionService.createTransaction error:', error as Error);
      throw error;
    }
  }

  async updateTransaction(id: string, updates: Partial<Transaction>, userId?: string): Promise<Transaction> {
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
      const dbUpdates = mapToDbFields(updates as unknown as Record<string, unknown>);

      // Atomic RPC: updates the row and adjusts balances (including account
      // moves) in one database transaction with SQL numeric math.
      const { data, error } = await client.rpc('update_transaction_atomic', {
        p_id: id,
        p: dbUpdates,
        // Defence-in-depth IDOR guard: RLS already scopes the row, and passing
        // the owner makes the RPC fail closed on a mis-routed id.
        ...(userId ? { p_user_id: userId } : {})
      });

      if (error) {
        this.logger.error('Error updating transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      return mapFromDbFields(data as Record<string, unknown>) as unknown as Transaction;
    } catch (error) {
      this.logger.error('TransactionService.updateTransaction error:', error as Error);
      throw error;
    }
  }

  /**
   * Bulk-set the reconciliation cleared flag on a set of transactions in one
   * round trip. is_cleared never affects account balances, so this goes through
   * a dedicated RPC rather than N update_transaction_atomic calls.
   * Returns the number of rows actually updated.
   */
  async setTransactionsCleared(ids: string[], cleared: boolean, userId?: string): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const idSet = new Set(ids);
      let count = 0;
      const updated = transactions.map(t => {
        if (idSet.has(t.id)) {
          count += 1;
          return { ...t, cleared, updatedAt: this.getCurrentDate() };
        }
        return t;
      });
      await this.persistTransactions(updated);
      return count;
    }

    try {
      const client = this.supabaseClient!;
      // RLS scopes the update to the requesting user; passing the owner adds
      // the same defence-in-depth IDOR guard as the other atomic RPCs.
      const { data, error } = await client.rpc('set_transactions_cleared', {
        p_ids: ids,
        p_cleared: cleared,
        ...(userId ? { p_user_id: userId } : {})
      });

      if (error) {
        this.logger.error('Error setting cleared status:', error);
        throw new Error(handleSupabaseError(error));
      }

      return typeof data === 'number' ? data : ids.length;
    } catch (error) {
      this.logger.error('TransactionService.setTransactionsCleared error:', error as Error);
      throw error;
    }
  }

  /**
   * Apply a category to the listed transactions that are STILL uncategorized
   * (payee-memory propagation), in one round trip. Fill-blanks only — the RPC
   * enforces this server-side, so a stale client snapshot can never overwrite
   * a category the user set elsewhere. Returns the number of rows updated.
   */
  async applyCategoryToUncategorized(ids: string[], category: string, userId?: string): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const idSet = new Set(ids);
      let count = 0;
      const updated = transactions.map(t => {
        if (idSet.has(t.id) && (!t.category || t.category.trim() === '')) {
          count += 1;
          return { ...t, category, updatedAt: this.getCurrentDate() };
        }
        return t;
      });
      await this.persistTransactions(updated);
      return count;
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client.rpc('apply_category_to_uncategorized', {
        p_ids: ids,
        p_category: category,
        ...(userId ? { p_user_id: userId } : {})
      });

      if (error) {
        this.logger.error('Error applying category:', error);
        throw new Error(handleSupabaseError(error));
      }

      return typeof data === 'number' ? data : ids.length;
    } catch (error) {
      this.logger.error('TransactionService.applyCategoryToUncategorized error:', error as Error);
      throw error;
    }
  }

  /** Splits for one transaction, in display order (empty when not split). */
  async getTransactionSplits(transactionId: string): Promise<TransactionSplit[]> {
    if (!this.isSupabaseReady()) {
      const stored = (await this.storage.get<TransactionSplit[]>(STORAGE_KEYS.TRANSACTION_SPLITS)) ?? [];
      return stored
        .filter(s => s.transactionId === transactionId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transaction_splits')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('sort_order', { ascending: true });

      if (error) {
        this.logger.error('Error fetching transaction splits:', error);
        throw new Error(handleSupabaseError(error));
      }

      return ((data || []) as Record<string, unknown>[]).map(row => ({
        id: String(row.id),
        transactionId: String(row.transaction_id),
        category: String(row.category),
        amount: Number(row.amount),
        memo: typeof row.memo === 'string' && row.memo !== '' ? row.memo : undefined,
        sortOrder: Number(row.sort_order),
      }));
    } catch (error) {
      this.logger.error('TransactionService.getTransactionSplits error:', error as Error);
      throw error;
    }
  }

  /**
   * Replace a transaction's splits atomically (empty array un-splits it).
   * The server RPC enforces the invariants — ≥2 lines, valid non-transfer
   * categories, non-zero amounts, and sum == expectedAmount — and syncs the
   * transaction's amount/account balance when the sum changes it. The local
   * fallback mirrors the same rules so demo/offline behave identically.
   */
  async setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null,
    userId?: string
  ): Promise<{ isSplit: boolean; splitCount: number; amount: number }> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) {
        throw new Error('transaction_not_found');
      }
      if (transaction.type === 'transfer') {
        throw new Error('transfers cannot be split');
      }

      const stored = (await this.storage.get<TransactionSplit[]>(STORAGE_KEYS.TRANSACTION_SPLITS)) ?? [];
      const others = stored.filter(s => s.transactionId !== transactionId);

      if (splits.length === 0) {
        await this.storage.set(STORAGE_KEYS.TRANSACTION_SPLITS, others);
        await this.persistTransactions(transactions.map(t =>
          t.id === transactionId ? { ...t, isSplit: false, updatedAt: this.getCurrentDate() } : t
        ));
        return { isSplit: false, splitCount: 0, amount: transaction.amount };
      }

      if (splits.length < 2) {
        throw new Error('a split needs at least 2 lines');
      }
      let sum = toDecimal(0);
      for (const split of splits) {
        if (!split.category.trim()) {
          throw new Error('every split line needs a category');
        }
        if (!split.amount) {
          throw new Error('every split line needs a non-zero amount');
        }
        sum = sum.plus(toDecimal(split.amount));
      }
      if (expectedAmount !== null && !sum.equals(toDecimal(expectedAmount))) {
        throw new Error('split_total_mismatch: the split lines must sum to the transaction amount');
      }

      const newSplits = splits.map((split, index) => ({
        id: this.uuid(),
        transactionId,
        category: split.category,
        amount: split.amount,
        ...(split.memo ? { memo: split.memo } : {}),
        sortOrder: index + 1,
      }));
      await this.storage.set(STORAGE_KEYS.TRANSACTION_SPLITS, [...others, ...newSplits]);
      await this.persistTransactions(transactions.map(t =>
        t.id === transactionId
          ? { ...t, isSplit: true, category: '', amount: sum.toNumber(), updatedAt: this.getCurrentDate() }
          : t
      ));
      return { isSplit: true, splitCount: splits.length, amount: sum.toNumber() };
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client.rpc('set_transaction_splits', {
        p_transaction_id: transactionId,
        p_splits: splits,
        p_expected_amount: expectedAmount,
        ...(userId ? { p_user_id: userId } : {})
      });

      if (error) {
        this.logger.error('Error setting transaction splits:', error);
        throw new Error(handleSupabaseError(error));
      }

      const result = (data ?? {}) as Record<string, unknown>;
      return {
        isSplit: Boolean(result.is_split),
        splitCount: Number(result.split_count ?? 0),
        amount: Number(result.amount ?? expectedAmount ?? 0),
      };
    } catch (error) {
      this.logger.error('TransactionService.setTransactionSplits error:', error as Error);
      throw error;
    }
  }

  async deleteTransaction(id: string, userId?: string): Promise<void> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const filtered = transactions.filter(t => t.id !== id);
      await this.persistTransactions(filtered);
      return;
    }

    try {
      const deletedViaApi = await this.deleteTransactionViaApi(id);
      if (deletedViaApi) {
        return;
      }

      const client = this.supabaseClient!;

      // Atomic RPC: deletes the row and reverses the balance in one database
      // transaction. RLS scopes the delete to the requesting user; passing the
      // owner adds a defence-in-depth IDOR guard so a mis-routed id fails closed.
      const { error } = await client.rpc('delete_transaction_atomic', {
        p_id: id,
        ...(userId ? { p_user_id: userId } : {})
      });

      if (error) {
        this.logger.error('Error deleting transaction:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      this.logger.error('TransactionService.deleteTransaction error:', error as Error);
      throw error;
    }
  }

  private async deleteTransactionViaApi(id: string): Promise<boolean> {
    if (!this.fetchImpl || !this.authTokenProvider) {
      return false;
    }

    const token = await this.authTokenProvider();
    if (!token) {
      return false;
    }

    const response = await this.fetchImpl('/api/data/delete-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ transactionId: id })
    });

    if (response.ok) {
      return true;
    }

    let message = `Delete transaction failed: ${response.status}`;
    try {
      const payload = await response.json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) {
        message = payload.error;
      }
    } catch {
      // Ignore body parse errors and keep the status-based message.
    }

    throw new Error(message);
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

      return (data || []).map(row => mapFromDbFields(row as Record<string, unknown>)) as unknown as Transaction[];
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

      return (data || []).map(row => mapFromDbFields(row as Record<string, unknown>)) as unknown as Transaction[];
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

      return (data || []).map(row => mapFromDbFields(row as Record<string, unknown>)) as unknown as Transaction[];
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
      const created: Transaction[] = [];
      const failures: string[] = [];

      // Each row goes through the atomic RPC so the insert and the balance
      // adjustment commit together. Failures are collected, not silently
      // swallowed — a partially imported batch is reported to the caller.
      for (const t of transactions) {
        const dbRow = mapToDbFields(t as unknown as Record<string, unknown>);
        dbRow.user_id = userId;

        const { data, error } = await client.rpc('create_transaction_atomic', { p: dbRow });
        if (error) {
          this.logger.error('Error creating transaction in bulk import:', error);
          failures.push(handleSupabaseError(error));
          continue;
        }
        created.push(mapFromDbFields(data as Record<string, unknown>) as unknown as Transaction);
      }

      if (failures.length > 0) {
        throw new Error(
          `Imported ${created.length} of ${transactions.length} transactions; ` +
          `${failures.length} failed. First error: ${failures[0]}`
        );
      }

      return created;
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

  // NOTE: client-side balance mutation was removed deliberately. All balance
  // adjustments happen inside the atomic Postgres RPCs
  // (create/update/delete_transaction_atomic) using SQL numeric arithmetic —
  // never JavaScript float math, never read-modify-write.
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

  static updateTransaction(id: string, updates: Partial<Transaction>, userId?: string): Promise<Transaction> {
    return this.service.updateTransaction(id, updates, userId);
  }

  static deleteTransaction(id: string, userId?: string): Promise<void> {
    return this.service.deleteTransaction(id, userId);
  }

  static setTransactionsCleared(ids: string[], cleared: boolean, userId?: string): Promise<number> {
    return this.service.setTransactionsCleared(ids, cleared, userId);
  }

  static applyCategoryToUncategorized(ids: string[], category: string, userId?: string): Promise<number> {
    return this.service.applyCategoryToUncategorized(ids, category, userId);
  }

  static getTransactionSplits(transactionId: string): Promise<TransactionSplit[]> {
    return this.service.getTransactionSplits(transactionId);
  }

  static setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null,
    userId?: string
  ): Promise<{ isSplit: boolean; splitCount: number; amount: number }> {
    return this.service.setTransactionSplits(transactionId, splits, expectedAmount, userId);
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
