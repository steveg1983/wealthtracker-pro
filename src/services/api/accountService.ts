
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

      return data || [];
    } catch (error) {
      this.logger.error('AccountService.getAccounts error:', error as Error);
      return this.readAccounts();
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
        .insert(accountData)
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

  async updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
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
      const { data, error } = await (client as any)
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error('Error updating account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data as Account;
    } catch (error) {
      this.logger.error('AccountService.updateAccount error:', error as Error);
      throw error;
    }
  }

  async deleteAccount(id: string): Promise<void> {
    if (!this.isSupabaseReady()) {
      const accounts = await this.readAccounts();
      const filtered = accounts.filter(account => account.id !== id);
      await this.persistAccounts(filtered);
      return;
    }

    try {
      const client = this.supabaseClient!;
      const { error } = await (client as any)
        .from('accounts')
        .update({ is_active: false })
        .eq('id', id);

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
        if ((error as any).code === 'PGRST116') {
          return null;
        }
        this.logger.error('Error fetching account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data as Account;
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
      const { error } = await (client as any)
        .from('accounts')
        .update({ balance: newBalance })
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

  async recalculateBalance(accountId: string): Promise<number> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.storage.get<any[]>(STORAGE_KEYS.TRANSACTIONS) || [];
      const accountTransactions = transactions.filter(t => t.account_id === accountId);
      const balance = accountTransactions.reduce((sum, t) => sum + t.amount, 0);

      await this.updateBalance(accountId, balance);
      return balance;
    }

    try {
      const client = this.supabaseClient!;
      const { data: account } = await client
        .from('accounts')
        .select('initial_balance')
        .eq('id', accountId)
        .single();

      const { data: transactions } = await client
        .from('transactions')
        .select('amount')
        .eq('account_id', accountId);

      const transactionTotal = transactions?.reduce((sum, t) => sum + (t as any).amount, 0) || 0;
      const initialBalance = (account as any)?.initial_balance || 0;
      const newBalance = initialBalance + transactionTotal;

      await this.updateBalance(accountId, newBalance);
      return newBalance;
    } catch (error) {
      this.logger.error('AccountService.recalculateBalance error:', error as Error);
      throw error;
    }
  }

  subscribeToAccounts(userId: string, callback: (payload: any) => void): () => void {
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

  static createAccount(
    userId: string,
    account: Omit<Account, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Account> {
    return this.service.createAccount(userId, account);
  }

  static updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
    return this.service.updateAccount(id, updates);
  }

  static deleteAccount(id: string): Promise<void> {
    return this.service.deleteAccount(id);
  }

  static getAccountById(id: string): Promise<Account | null> {
    return this.service.getAccountById(id);
  }

  static updateBalance(id: string, newBalance: number): Promise<void> {
    return this.service.updateBalance(id, newBalance);
  }

  static recalculateBalance(accountId: string): Promise<number> {
    return this.service.recalculateBalance(accountId);
  }

  static subscribeToAccounts(userId: string, callback: (payload: any) => void): () => void {
    return this.service.subscribeToAccounts(userId, callback);
  }
}

export const createAccountService = (options: AccountServiceOptions = {}) =>
  new AccountServiceImpl(options);
