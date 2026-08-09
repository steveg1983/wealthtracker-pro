
/**
 * SIMPLE Account Service - dependency-injected variant.
 *
 * NOTHING IN THE APP CALLS THIS ANY MORE. Every account read and write goes
 * through the DataPort seam, whose cloud half is accountService: the boot's
 * account read and the account subscription moved there first, and the last
 * caller — the signed-in create path in AppContextSupabase — followed once
 * accountService's insert learned to send the sort code, the account number,
 * the opening balance date and the notes that only this service used to write.
 * What survives here is kept alive by tests: the differential mapper suite
 * (services/__tests__/accountMapping.test.tsx) reads an account through both
 * services to prove they cannot disagree again, and dataService's suite pins
 * one retired behaviour against the seam that replaced it. Retiring the file
 * means deciding what replaces those, which is a separate piece of work.
 */

import { supabase } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import { accountNumberUpdateForStorage } from '../../utils/accountNumberInput';
// The one account mapper. This service used to keep its own, which knew the
// bank details but not the low-balance alert, while accountService's knew the
// alert but not the bank details — and the app loaded accounts through this
// one at boot and that one on every refresh. See accountMapping.
import { mapAccountFromDb, mapAccountToDb } from './accountMapping';
import type { Account } from '../../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

type SupabaseClientLike = typeof supabase;
type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'>;
// `ensureUserExists` went with the create: it was that path's fallback for a
// login whose database row had not been made yet, and it minted one with an
// empty email. Nothing left here creates anything.
type UserIdServiceLike = Pick<typeof userIdService, 'getDatabaseUserId'>;
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

      return (data || []).map(mapAccountFromDb);
    } catch {
      this.logger.warn('[SimpleAccountService] Using localStorage fallback');
      return this.localAccounts();
    }
  }

  /**
   * The `type` this account is stored with, read straight off the row (the
   * column's own value, which says 'checking' where the app says 'current').
   * A row whose type cannot be read throws, so the account number is not
   * written at all: truncating on a guess would destroy a real 8-digit bank
   * number, and storing on a guess is the leak the caller exists to stop.
   */
  private async readStoredAccountType(
    client: NonNullable<SupabaseClientLike>,
    accountId: string
  ): Promise<unknown> {
    const { data, error } = await client
      .from('accounts')
      .select('type')
      .eq('id', accountId)
      .single();

    if (error || !data) {
      this.logger.error('[SimpleAccountService] Error reading account type:', error);
      throw new Error('Could not confirm the account type, so its account number was not saved');
    }

    return (data as Record<string, unknown>).type;
  }

  /**
   * The twin of the guarantee on the insert below: a credit account's number is
   * a card number, and a full one written here would live on in every backup
   * and export taken afterwards. Callers already trim; this is what holds when
   * a new one forgets to.
   *
   * An update need not carry the account's type, so where it does not the
   * stored one is read. Updates that do not touch the account number — nearly
   * all of them — cost nothing.
   */
  private async cardSafeUpdates(
    client: NonNullable<SupabaseClientLike>,
    accountId: string,
    updates: Partial<Account>
  ): Promise<Partial<Account>> {
    if (updates.accountNumber === undefined) {
      return updates;
    }
    const storedType = updates.type === undefined
      ? await this.readStoredAccountType(client, accountId)
      : undefined;
    return accountNumberUpdateForStorage(updates, storedType);
  }

  async updateAccount(accountId: string, updates: Partial<Account>): Promise<Account> {
    const client = this.clientReady;
    try {
      if (!client) {
        throw new Error('Supabase not configured');
      }

      const dbUpdates = mapAccountToDb(await this.cardSafeUpdates(client, accountId, updates));
      const { data, error } = await client
        .from('accounts')
        .update(dbUpdates as never)
        .eq('id', accountId)
        .select()
        .single();

      if (error) {
        this.logger.error('[SimpleAccountService] Error updating account:', error);
        throw error;
      }

      return mapAccountFromDb(data);
    } catch (error) {
      this.logger.error('[SimpleAccountService] Error updating account:', error as Error);
      throw error;
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
        .update({ is_active: false } as never)
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
