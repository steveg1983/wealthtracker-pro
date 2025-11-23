
/**
 * SIMPLE Account Service - dependency-injected variant.
 */

import { supabase } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import type { Account } from '../../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

type SupabaseClientLike = typeof supabase;
type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'>;
type UserIdServiceLike = Pick<typeof userIdService, 'getDatabaseUserId' | 'ensureUserExists'>;
type Logger = Pick<Console, 'log' | 'warn' | 'error'>;
type DateProvider = () => Date;
type UuidGenerator = () => string;

export interface SimpleAccountServiceOptions {
  supabaseClient?: SupabaseClientLike | null;
  storageAdapter?: StorageAdapterLike;
  userIdService?: UserIdServiceLike;
  logger?: Logger;
  now?: DateProvider;
  uuid?: UuidGenerator;
}

const noop = () => {};

type DbAccount = {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  institution?: string | null;
  is_active?: boolean;
  initial_balance?: number;
  created_at?: Date;
  updated_at?: Date;
  last_updated?: Date;
};

function transformAccountFromDb(dbAccount: DbAccount): Account {
  return {
    id: dbAccount.id,
    name: dbAccount.name,
    type: dbAccount.type === 'checking' ? 'current' : dbAccount.type,
    balance: dbAccount.balance,
    currency: dbAccount.currency,
    institution: dbAccount.institution || '',
    isActive: dbAccount.is_active,
    openingBalance: dbAccount.initial_balance,
    createdAt: dbAccount.created_at,
    updatedAt: dbAccount.updated_at,
    lastUpdated: dbAccount.updated_at || dbAccount.created_at
  } as Account;
}

class SimpleAccountServiceImpl {
  private readonly client: SupabaseClientLike | null;
  private readonly storage: StorageAdapterLike;
  private readonly userIds: UserIdServiceLike;
  private readonly logger: Logger;
  private readonly nowProvider: DateProvider;
  private readonly uuid: UuidGenerator;

  constructor(options: SimpleAccountServiceOptions = {}) {
    if ('supabaseClient' in options) {
      this.client = options.supabaseClient ?? null;
    } else {
      this.client = supabase ?? null;
    }
    this.storage = options.storageAdapter ?? storageAdapter;
    this.userIds = options.userIdService ?? userIdService;
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
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
  }

  private get clientReady(): SupabaseClientLike | null {
    return this.client;
  }

  private now(): Date {
    return new Date(this.nowProvider().getTime());
  }

  private async localAccounts(): Promise<Account[]> {
    return (await this.storage.get<Account[]>(STORAGE_KEYS.ACCOUNTS)) || [];
  }

  private async persistAccounts(accounts: Account[]): Promise<void> {
    await this.storage.set(STORAGE_KEYS.ACCOUNTS, accounts);
  }

  async createAccount(
    clerkId: string,
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Account> {
    const client = this.clientReady;
    let userId = await this.userIds.getDatabaseUserId(clerkId);
    try {
      if (!client) {
        throw new Error('Supabase not configured');
      }

      if (!userId) {
        userId = await this.userIds.ensureUserExists(clerkId, '', undefined, undefined);
        if (!userId) {
          throw new Error('Failed to resolve database user');
        }
        this.logger.log('[SimpleAccountService] Created user via userIdService:', userId);
      } else {
        this.logger.log('[SimpleAccountService] Using existing user:', userId);
      }

      const accountData = {
        user_id: userId,
        name: account.name,
        type: account.type === 'current' ? 'checking' : account.type,
        currency: account.currency || 'GBP',
        balance: account.balance || 0,
        initial_balance: account.openingBalance || account.balance || 0,
        is_active: account.isActive !== false,
        institution: account.institution || null
      };

      const { data, error } = await client
        .from('accounts')
        .insert(accountData)
        .select()
        .single();

      if (error || !data) {
        this.logger.error('[SimpleAccountService] Failed to create account:', error);
        throw error || new Error('Account creation returned no data');
      }

      return transformAccountFromDb(data);
    } catch (error) {
      this.logger.error('[SimpleAccountService] Error creating account, falling back:', error as Error);
      const now = this.now();
      const localAccount: Account = {
        ...account,
        id: this.uuid(),
        createdAt: now,
        updatedAt: now
      } as Account;
      const accounts = await this.localAccounts();
      accounts.push(localAccount);
      await this.persistAccounts(accounts);
      return localAccount;
    }
  }

  async getAccounts(userIdParam: string): Promise<Account[]> {
    const client = this.clientReady;
    try {
      if (!client) {
        throw new Error('Supabase not configured');
      }

      let userId: string | null = userIdParam;
      if (userIdParam.startsWith('user_')) {
        userId = await this.userIds.getDatabaseUserId(userIdParam);
        if (!userId) {
          this.logger.warn('[SimpleAccountService] No user found for Clerk ID:', userIdParam);
          return [];
        }
      }

      const { data, error } = await client
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        this.logger.error('[SimpleAccountService] Error fetching accounts:', error);
        throw error;
      }

      return (data || []).map(transformAccountFromDb);
    } catch {
      this.logger.warn('[SimpleAccountService] Using localStorage fallback');
      return this.localAccounts();
    }
  }

  async updateAccount(accountId: string, updates: Partial<Account>): Promise<Account> {
    const client = this.clientReady;
    try {
      if (!client) {
        throw new Error('Supabase not configured');
      }

      const { data, error } = await client
        .from('accounts')
        .update(updates)
        .eq('id', accountId)
        .select()
        .single();

      if (error) {
        this.logger.error('[SimpleAccountService] Error updating account:', error);
        throw error;
      }

      return transformAccountFromDb(data);
    } catch {
      const accounts = await this.localAccounts();
      const index = accounts.findIndex(account => account.id === accountId);
      if (index === -1) {
        throw new Error('Account not found');
      }
      accounts[index] = { ...accounts[index], ...updates } as Account;
      await this.persistAccounts(accounts);
      return accounts[index];
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    const client = this.clientReady;
    try {
      if (!client) {
        throw new Error('Supabase not configured');
      }

      const { error } = await client
        .from('accounts')
        .delete()
        .eq('id', accountId);

      if (error) {
        this.logger.error('[SimpleAccountService] Error deleting account:', error);
        throw error;
      }
    } catch {
      const accounts = await this.localAccounts();
      const filtered = accounts.filter(account => account.id !== accountId);
      await this.persistAccounts(filtered);
    }
  }

  async subscribeToAccountChanges(clerkId: string, callback: (payload: unknown) => void): Promise<() => void> {
    const client = this.clientReady;
    if (!client) {
      return () => {};
    }

    try {
      const dbUserId = await this.userIds.getDatabaseUserId(clerkId);
      if (!dbUserId) {
        this.logger.warn('[SimpleAccountService] No database user found for Clerk ID:', clerkId);
        return () => {};
      }

      const channel = client
        .channel(`accounts-${dbUserId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'accounts',
            filter: `user_id=eq.${dbUserId}`
          },
          callback
        )
        .subscribe((status, error) => {
          if (error) {
            this.logger.error('[SimpleAccountService] Subscription error:', error);
          } else {
            this.logger.log('[SimpleAccountService] Subscription status:', status);
          }
        });

      return () => {
        client.removeChannel(channel as RealtimeChannel);
      };
    } catch (error) {
      this.logger.error('[SimpleAccountService] Error setting up subscription:', error as Error);
      return () => {};
    }
  }
}

let defaultService = new SimpleAccountServiceImpl();

export const configureSimpleAccountService = (options: SimpleAccountServiceOptions = {}) => {
  defaultService = new SimpleAccountServiceImpl(options);
};

export async function createAccount(
  clerkId: string,
  account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Account> {
  return defaultService.createAccount(clerkId, account);
}

export function getAccounts(userId: string): Promise<Account[]> {
  return defaultService.getAccounts(userId);
}

export function updateAccount(accountId: string, updates: Partial<Account>): Promise<Account> {
  return defaultService.updateAccount(accountId, updates);
}

export function deleteAccount(accountId: string): Promise<void> {
  return defaultService.deleteAccount(accountId);
}

export function subscribeToAccountChanges(
  clerkId: string,
  callback: (payload: unknown) => void
): Promise<() => void> {
  return defaultService.subscribeToAccountChanges(clerkId, callback);
}

export const createSimpleAccountService = (options: SimpleAccountServiceOptions = {}) =>
  new SimpleAccountServiceImpl(options);
