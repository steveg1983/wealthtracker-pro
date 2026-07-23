
import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import type { Account } from '../../types';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';

type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'>;
type SupabaseClientLike = typeof supabase;
type SupabaseConfiguredChecker = () => boolean;
type Logger = Pick<Console, 'error' | 'warn' | 'log'>;
type DateProvider = () => Date;
type UuidGenerator = () => string;

export interface AccountServiceOptions {
  supabaseClient?: SupabaseClientLike;
  isSupabaseConfigured?: SupabaseConfiguredChecker;
  storageAdapter?: StorageAdapterLike;
  logger?: Logger;
  now?: DateProvider;
  uuid?: UuidGenerator;
}

/** Map camelCase Account fields to snake_case DB columns for writes */
const ACCOUNT_CAMEL_TO_DB: Record<string, string> = {
  openingBalance: 'initial_balance',
  openingBalanceDate: 'opening_balance_date',
  isActive: 'is_active',
  plaidConnectionId: 'plaid_connection_id',
  plaidAccountId: 'plaid_account_id',
  lastUpdated: 'last_updated',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  sortCode: 'sort_code',
  accountNumber: 'account_number',
  creditLimit: 'credit_limit',
  bankBalance: 'bank_balance',
  lastReconciledDate: 'last_reconciled_date',
  lowBalanceAlertEnabled: 'low_balance_alert_enabled',
  lowBalanceThreshold: 'low_balance_threshold',
  archiveThroughDate: 'archive_through_date',
  parentAccountId: 'parent_account_id',
};

function mapAccountToDb(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'holdings' || key === 'tags') continue;
    if (value === undefined) continue;
    const dbKey = ACCOUNT_CAMEL_TO_DB[key] ?? key;
    // DB constraint expects 'checking', frontend uses 'current'
    result[dbKey] = key === 'type' && value === 'current' ? 'checking' : value;
  }
  return result;
}

/** Map snake_case DB row to camelCase Account fields for reads */
function mapAccountFromDb(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    type: row.type === 'checking' ? 'current' : row.type,
    bankBalance: row.bank_balance ?? null,
    lastReconciledDate: row.last_reconciled_date ?? null,
    openingBalance: row.initial_balance ?? row.opening_balance,
    // Without this the fallback load path silently dropped the opening-balance
    // date, so every balance walk seeded the lump at time-zero (see
    // openingDates.ts). Mirrors simpleAccountService's mapping.
    openingBalanceDate: row.opening_balance_date != null ? new Date(String(row.opening_balance_date)) : undefined,
    isActive: row.is_active,
    lastUpdated: row.last_updated ?? row.updated_at,
    lowBalanceAlertEnabled: row.low_balance_alert_enabled === true,
    lowBalanceThreshold: row.low_balance_threshold != null ? Number(row.low_balance_threshold) : undefined,
    archiveThroughDate: row.archive_through_date != null ? new Date(String(row.archive_through_date)) : null,
    parentAccountId: row.parent_account_id ?? null,
  };
}

class AccountServiceImpl {
  private readonly supabaseClient: SupabaseClientLike;
  private readonly supabaseChecker: SupabaseConfiguredChecker;
  private readonly storage: StorageAdapterLike;
  private readonly logger: Logger;
  private readonly nowProvider: DateProvider;
  private readonly uuid: UuidGenerator;

  constructor(options: AccountServiceOptions = {}) {
    this.supabaseClient = options.supabaseClient ?? supabase;
    this.supabaseChecker = options.isSupabaseConfigured ?? isSupabaseConfigured;
    this.storage = options.storageAdapter ?? storageAdapter;
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      log: options.logger?.log ?? (fallbackLogger?.log?.bind(fallbackLogger) ?? noop)
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

  private now(): Date {
    return new Date(this.nowProvider().getTime());
  }

  private async readAccounts(): Promise<Account[]> {
    const stored = await this.storage.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
    return stored || [];
  }

  private async persistAccounts(accounts: Account[]): Promise<void> {
    await this.storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
  }

  async getAccounts(userId: string): Promise<Account[]> {
    if (!this.isSupabaseReady()) {
      return this.readAccounts();
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        this.logger.error('Error fetching accounts:', error);
        throw new Error(handleSupabaseError(error));
      }

      return (data || []).map(row => mapAccountFromDb(row as Record<string, unknown>)) as unknown as Account[];
    } catch (error) {
      this.logger.error('AccountService.getAccounts error:', error as Error);
      return this.readAccounts();
    }
  }

  /**
   * Closed (deactivated) accounts — the Microsoft Money model: closing hides
   * an account and its transfer category but preserves every transaction, and
   * it can be reopened at any time from the Closed Accounts section.
   */
  async getClosedAccounts(userId: string): Promise<Account[]> {
    if (!this.isSupabaseReady()) {
      const accounts = await this.readAccounts();
      return accounts.filter(a => a.isActive === false);
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', false)
        .order('created_at', { ascending: true });

      if (error) {
        this.logger.error('Error fetching closed accounts:', error);
        throw new Error(handleSupabaseError(error));
      }

      return (data || []).map(row => mapAccountFromDb(row as Record<string, unknown>)) as unknown as Account[];
    } catch (error) {
      this.logger.error('AccountService.getClosedAccounts error:', error as Error);
      return [];
    }
  }

  async createAccount(
    userId: string,
    account: Omit<Account, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Account> {
    if (!this.isSupabaseReady()) {
      const now = this.now();
      const newAccount: Account = {
        ...account,
        id: this.uuid(),
        lastUpdated: now,
        balance: account.balance || 0,
        currency: account.currency || 'USD',
        type: account.type || 'checking'
      } as Account;

      const accounts = await this.readAccounts();
      accounts.push(newAccount);
      await this.persistAccounts(accounts);

      return newAccount;
    }

    try {
      const client = this.supabaseClient!;
      const mappedType = account.type === 'current' ? 'checking' : account.type;
      const accountData: Record<string, unknown> = {
        user_id: userId,
        name: account.name,
        type: mappedType || 'checking',
        currency: account.currency || 'GBP',
        balance: account.balance || 0,
        initial_balance: account.openingBalance || account.balance || 0,
        is_active: account.isActive !== undefined ? account.isActive : true,
        institution: account.institution || null,
        icon: null,
        color: null
      };

      this.logger.log('Creating account with data:', accountData);

      const { data, error } = await client
        .from('accounts')
        .insert(accountData as never)
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating account:', error);
        throw new Error(handleSupabaseError(error));
      }

      this.logger.log('Account created successfully:', data);
      return data as Account;
    } catch (error) {
      this.logger.error('AccountService.createAccount error:', error as Error);
      throw error;
    }
  }

  async updateAccount(id: string, updates: Partial<Account>, userId?: string): Promise<Account> {
    if (!this.isSupabaseReady()) {
      const accounts = await this.readAccounts();
      const index = accounts.findIndex(account => account.id === id);

      if (index === -1) {
        throw new Error('Account not found');
      }

      const updated: Account = {
        ...accounts[index],
        ...updates,
        lastUpdated: this.now()
      } as Account;

      accounts[index] = updated;
      await this.persistAccounts(accounts);
      return updated;
    }

    try {
      const client = this.supabaseClient!;
      const dbUpdates = mapAccountToDb(updates as unknown as Record<string, unknown>);
      // RLS already scopes writes to the authenticated user; the optional
      // user_id filter is defence-in-depth so a caller that knows the owner
      // can never touch a mis-routed row even if RLS were ever relaxed.
      let query = client
        .from('accounts')
        .update(dbUpdates as never)
        .eq('id', id);
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query
        .select()
        .single();

      if (error) {
        this.logger.error('Error updating account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return mapAccountFromDb(data as Record<string, unknown>) as unknown as Account;
    } catch (error) {
      this.logger.error('AccountService.updateAccount error:', error as Error);
      throw error;
    }
  }

  async deleteAccount(id: string, userId?: string): Promise<void> {
    if (!this.isSupabaseReady()) {
      // Local mode mirrors the cloud semantics: closing is a SOFT close
      // (isActive=false, reopenable), never a hard delete — the Close button
      // promises "you can reopen it at any time".
      const accounts = await this.readAccounts();
      const updated = accounts.map(account =>
        account.id === id ? { ...account, isActive: false } : account
      );
      await this.persistAccounts(updated);
      return;
    }

    try {
      const client = this.supabaseClient!;
      // RLS scopes the soft-delete to the authenticated user; the optional
      // user_id filter is belt-and-braces for callers that know the owner.
      let query = client
        .from('accounts')
        .update({ is_active: false } as never)
        .eq('id', id);
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { error } = await query;

      if (error) {
        this.logger.error('Error deleting account:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      this.logger.error('AccountService.deleteAccount error:', error as Error);
      throw error;
    }
  }

  async getAccountById(id: string): Promise<Account | null> {
    if (!this.isSupabaseReady()) {
      const accounts = await this.readAccounts();
      return accounts.find(account => account.id === id) || null;
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (typeof (error as { code?: string }).code === 'string' && (error as { code?: string }).code === 'PGRST116') {
          return null;
        }
        this.logger.error('Error fetching account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return mapAccountFromDb(data as Record<string, unknown>) as unknown as Account;
    } catch (error) {
      this.logger.error('AccountService.getAccountById error:', error as Error);
      throw error;
    }
  }

  async updateBalance(id: string, newBalance: number): Promise<void> {
    if (!this.isSupabaseReady()) {
      const accounts = await this.readAccounts();
      const index = accounts.findIndex(account => account.id === id);

      if (index !== -1) {
        accounts[index].balance = newBalance;
        accounts[index].lastUpdated = this.now();
        await this.persistAccounts(accounts);
      }
      return;
    }

    try {
      const client = this.supabaseClient!;
      const { error } = await client
        .from('accounts')
        .update({ balance: newBalance } as never)
        .eq('id', id);

      if (error) {
        this.logger.error('Error updating balance:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      this.logger.error('AccountService.updateBalance error:', error as Error);
      throw error;
    }
  }

  // recalculateBalance() removed (re-audit #27): it summed transactions with
  // float `reduce((sum, t) => sum + t.amount, 0)`, wrote the result straight to
  // accounts.balance with no audit entry, and had no caller (not in the
  // DataService Pick type). The canonical, audited balance path is the atomic
  // transaction RPCs. A SQL recompute (balance = initial + Σamount) should be
  // an audited RPC if ever needed — not a float reduce in the service layer.

  subscribeToAccounts(userId: string, callback: (payload: unknown) => void): () => void {
    if (!this.isSupabaseReady()) {
      return () => {};
    }

    const client = this.supabaseClient!;
    const subscription = client
      .channel(`accounts:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
}

let defaultAccountService = new AccountServiceImpl();

export class AccountService {
  static configure(options: AccountServiceOptions = {}) {
    defaultAccountService = new AccountServiceImpl(options);
  }

  private static get service(): AccountServiceImpl {
    return defaultAccountService;
  }

  static getAccounts(userId: string): Promise<Account[]> {
    return this.service.getAccounts(userId);
  }

  static getClosedAccounts(userId: string): Promise<Account[]> {
    return this.service.getClosedAccounts(userId);
  }

  static createAccount(
    userId: string,
    account: Omit<Account, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Account> {
    return this.service.createAccount(userId, account);
  }

  static updateAccount(id: string, updates: Partial<Account>, userId?: string): Promise<Account> {
    return this.service.updateAccount(id, updates, userId);
  }

  static deleteAccount(id: string, userId?: string): Promise<void> {
    return this.service.deleteAccount(id, userId);
  }

  static getAccountById(id: string): Promise<Account | null> {
    return this.service.getAccountById(id);
  }

  static updateBalance(id: string, newBalance: number): Promise<void> {
    return this.service.updateBalance(id, newBalance);
  }

  static subscribeToAccounts(userId: string, callback: (payload: unknown) => void): () => void {
    return this.service.subscribeToAccounts(userId, callback);
  }
}

export const createAccountService = (options: AccountServiceOptions = {}) =>
  new AccountServiceImpl(options);
