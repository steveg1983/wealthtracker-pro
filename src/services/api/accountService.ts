
import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import type { Account, AccountUpdate } from '../../types';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import {
  accountNumberForStorage,
  accountNumberUpdateForStorage,
  isCardAccountType
} from '../../utils/accountNumberInput';
// The one account mapper. This service used to keep its own, which knew the
// low-balance alert but not the bank details, while simpleAccountService's knew
// the bank details but not the alert — and the app loaded accounts through that
// one at boot and this one on every refresh. See accountMapping.
import { mapAccountFromDb, mapAccountToDb } from './accountMapping';

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

  /**
   * The `type` this account is stored with, read straight off the row.
   *
   * Raw rather than mapped: the column's own value (which says 'checking' where
   * the app says 'current'), because that is what isCardAccountTypeValue is
   * asked about. A row whose type cannot be read throws, and the account number
   * is not written at all — truncating on a guess would destroy a real 8-digit
   * bank number, and storing on a guess is the leak this exists to stop.
   */
  private async readStoredAccountType(id: string, userId?: string): Promise<unknown> {
    const client = this.supabaseClient!;
    // Scoped exactly like the update it guards: RLS does the work, the optional
    // user_id filter is the same belt-and-braces the write below carries.
    let query = client
      .from('accounts')
      .select('type')
      .eq('id', id);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query.single();

    if (error || !data) {
      this.logger.error('Error reading account type before storing an account number:', error);
      throw new Error('Could not confirm the account type, so its account number was not saved');
    }

    return (data as Record<string, unknown>).type;
  }

  /**
   * An update with its account number cut to the last 4 digits when the row is
   * a card.
   *
   * The account forms trim before they save, but a form only covers the callers
   * that remember it; this is the boundary that holds regardless. Without it an
   * importer, a script or a future caller writes a full card number into
   * accounts.account_number, and from there into every backup, JSON export and
   * audit row taken afterwards. A bank account number is a different thing and
   * is stored whole.
   *
   * Costs nothing on the updates that do not touch the account number, which is
   * nearly all of them.
   */
  private async cardSafeUpdates(
    id: string,
    updates: AccountUpdate,
    userId?: string
  ): Promise<AccountUpdate> {
    if (updates.accountNumber === undefined) {
      return updates;
    }
    // The payload answers it when it carries a type; otherwise the stored one
    // decides, and failing to read it refuses the write rather than guessing.
    const storedType = updates.type === undefined
      ? await this.readStoredAccountType(id, userId)
      : undefined;
    return accountNumberUpdateForStorage(updates, storedType);
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

      return (data || []).map(mapAccountFromDb);
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

      return (data || []).map(mapAccountFromDb);
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
        type: account.type || 'checking',
        // Local storage is no safer a home for a card number than the database:
        // it is what the backup file and the JSON export are built from.
        accountNumber: accountNumberForStorage(
          account.accountNumber,
          isCardAccountType(account.type)
        )
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
      // Mapped, not cast. The raw row went back to the caller for years, which
      // meant a freshly created account arrived in app state still spelling its
      // type 'checking' and carrying not one camelCase field — the same class
      // of gap as the two mappers this service used to disagree with.
      return mapAccountFromDb(data);
    } catch (error) {
      this.logger.error('AccountService.createAccount error:', error as Error);
      throw error;
    }
  }

  async updateAccount(id: string, updates: AccountUpdate, userId?: string): Promise<Account> {
    if (!this.isSupabaseReady()) {
      const accounts = await this.readAccounts();
      const index = accounts.findIndex(account => account.id === id);

      if (index === -1) {
        throw new Error('Account not found');
      }

      const updated: Account = {
        ...accounts[index],
        ...accountNumberUpdateForStorage(updates, accounts[index].type),
        lastUpdated: this.now()
      } as Account;

      accounts[index] = updated;
      await this.persistAccounts(accounts);
      return updated;
    }

    try {
      const client = this.supabaseClient!;
      const dbUpdates = mapAccountToDb(await this.cardSafeUpdates(id, updates, userId));
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

      return mapAccountFromDb(data);
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

      return mapAccountFromDb(data);
    } catch (error) {
      this.logger.error('AccountService.getAccountById error:', error as Error);
      throw error;
    }
  }

  // Neither recalculateBalance() nor updateBalance() lives here any more, and
  // for the same reason: both SET accounts.balance to an absolute figure, with
  // no audit entry, outside the atomic transaction RPCs that are the only
  // sanctioned way a balance moves (`balance = balance ± amount` — see the
  // ledger invariant in migration 20260613090000). recalculateBalance summed
  // transactions with a float reduce; updateBalance simply overwrote whatever
  // the caller passed, so a stale figure would have silently discarded every
  // transaction written since it was read. Both had zero callers. If a
  // recompute is ever needed it belongs in an audited RPC, not in the service
  // layer.

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
      // removeChannel, not subscription.unsubscribe(). This is the one
      // behaviour worth keeping from the sibling account subscription the
      // context used to open instead of this one.
      //
      // What actually differs, in @supabase/realtime-js 2.77.0: removeChannel
      // awaits the same leave push and then, if this was the client's LAST
      // channel, disconnects the socket (RealtimeClient.removeChannel). A bare
      // unsubscribe never disconnects, so a sign-out or an unmount leaves an
      // idle websocket and its heartbeat timer running for the rest of the
      // session. Deregistration is NOT the difference: the channel's own close
      // hook calls socket._remove on either path — and on neither path when the
      // leave push errors, which is a leak this change does not claim to fix.
      client.removeChannel(subscription);
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

  static updateAccount(id: string, updates: AccountUpdate, userId?: string): Promise<Account> {
    return this.service.updateAccount(id, updates, userId);
  }

  static deleteAccount(id: string, userId?: string): Promise<void> {
    return this.service.deleteAccount(id, userId);
  }

  static getAccountById(id: string): Promise<Account | null> {
    return this.service.getAccountById(id);
  }

  static subscribeToAccounts(userId: string, callback: (payload: unknown) => void): () => void {
    return this.service.subscribeToAccounts(userId, callback);
  }
}

export const createAccountService = (options: AccountServiceOptions = {}) =>
  new AccountServiceImpl(options);
