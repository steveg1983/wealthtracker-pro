import { supabase, isSupabaseConfigured, handleSupabaseError } from '@wealthtracker/core';
import type { Account, Holding } from '../../types';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { logger } from '../loggingService';
import type { Database, Json } from '@app-types/supabase';

type SupabaseAccountRow = Database['public']['Tables']['accounts']['Row'];
type SupabaseAccountInsert = Database['public']['Tables']['accounts']['Insert'];
type SupabaseAccountUpdate = Database['public']['Tables']['accounts']['Update'];

type DomainAccountType = Account['type'];

type AccountCreateInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'lastUpdated'> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastUpdated?: Date;
  openingBalance?: number;
};

type AccountUpdateInput = Partial<Account> & {
  openingBalance?: number;
};

const SUPABASE_TO_DOMAIN_TYPE: Record<SupabaseAccountRow['type'], DomainAccountType> = {
  checking: 'current',
  savings: 'savings',
  credit: 'credit',
  cash: 'asset',
  investment: 'investment',
  other: 'other'
};

const DOMAIN_TO_SUPABASE_TYPE: Record<DomainAccountType, SupabaseAccountInsert['type']> = {
  current: 'checking',
  checking: 'checking',
  savings: 'savings',
  credit: 'credit',
  loan: 'other',
  investment: 'investment',
  asset: 'cash',
  assets: 'other',
  mortgage: 'other',
  other: 'other'
};

const mapDomainTypeToSupabase = (type: DomainAccountType): SupabaseAccountInsert['type'] => {
  return DOMAIN_TO_SUPABASE_TYPE[type] ?? 'other';
};

const isJsonObject = (value: Json | undefined): value is Record<string, Json | undefined> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toOptionalNumber = (value: Json | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toOptionalString = (value: Json | undefined): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const toOptionalTrimmedString = (value: Json | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseDateValue = (value: Json | undefined): Date | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return undefined;
};

const parseIsoDateString = (value: string | null | undefined): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseTags = (value: Json | undefined): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const tags = value.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
  return tags.length > 0 ? tags : undefined;
};

const parseHoldings = (value: Json | undefined): Holding[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const holdings: Holding[] = [];
  value.forEach(item => {
    if (!isJsonObject(item)) {
      return;
    }

    const ticker = toOptionalTrimmedString(item.ticker);
    const name = toOptionalString(item.name);
    const shares = toOptionalNumber(item.shares);
    const holdingValue = toOptionalNumber(item.value);

    if (!ticker || !name || shares === undefined || holdingValue === undefined) {
      return;
    }

    const holding: Holding = {
      ticker,
      name,
      shares,
      value: holdingValue
    };

    const averageCost = toOptionalNumber(item.averageCost);
    if (averageCost !== undefined) {
      holding.averageCost = averageCost;
    }

    const currentPrice = toOptionalNumber(item.currentPrice);
    if (currentPrice !== undefined) {
      holding.currentPrice = currentPrice;
    }

    const marketValue = toOptionalNumber(item.marketValue);
    if (marketValue !== undefined) {
      holding.marketValue = marketValue;
    }

    const gain = toOptionalNumber(item.gain);
    if (gain !== undefined) {
      holding.gain = gain;
    }

    const gainPercent = toOptionalNumber(item.gainPercent);
    if (gainPercent !== undefined) {
      holding.gainPercent = gainPercent;
    }

    const currency = toOptionalTrimmedString(item.currency);
    if (currency) {
      holding.currency = currency;
    }

    const lastUpdated = parseDateValue(item.lastUpdated);
    if (lastUpdated) {
      holding.lastUpdated = lastUpdated;
    }

    holdings.push(holding);
  });

  return holdings.length > 0 ? holdings : undefined;
};

const pruneUndefined = <T extends Record<string, unknown>>(obj: T): T => {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  }
  return obj;
};

const mapSupabaseTypeToDomain = (type: SupabaseAccountRow['type']): DomainAccountType => {
  return SUPABASE_TO_DOMAIN_TYPE[type] ?? 'other';
};

export const mapSupabaseAccountToDomain = (row: SupabaseAccountRow): Account => {
  const metadata = isJsonObject(row.metadata) ? row.metadata : {};
  const updatedAt = parseIsoDateString(row.updated_at) ?? new Date();
  const lastUpdated = parseIsoDateString(row.updated_at) ?? updatedAt;

  const account: Account = {
    id: row.id,
    name: row.name,
    type: mapSupabaseTypeToDomain(row.type),
    balance: typeof row.balance === 'number' && Number.isFinite(row.balance) ? row.balance : 0,
    currency: typeof row.currency === 'string' && row.currency.length > 0 ? row.currency : 'USD',
    lastUpdated
  };

  account.updatedAt = updatedAt;
  account.isActive = row.is_active;

  const institution = typeof row.institution === 'string' ? row.institution.trim() : undefined;
  if (institution) {
    account.institution = institution;
  }

  const openingBalance = toOptionalNumber(metadata.openingBalance);
  if (openingBalance !== undefined) {
    account.openingBalance = openingBalance;
  } else if (typeof row.initial_balance === 'number' && Number.isFinite(row.initial_balance)) {
    account.openingBalance = row.initial_balance;
  }

  const openingBalanceDate = parseDateValue(metadata.openingBalanceDate);
  if (openingBalanceDate) {
    account.openingBalanceDate = openingBalanceDate;
  }

  const notes = toOptionalString(metadata.notes);
  if (notes !== undefined) {
    account.notes = notes;
  }

  const plaidConnectionId = toOptionalTrimmedString(metadata.plaidConnectionId);
  if (plaidConnectionId) {
    account.plaidConnectionId = plaidConnectionId;
  }

  const plaidAccountId = toOptionalTrimmedString(metadata.plaidAccountId);
  if (plaidAccountId) {
    account.plaidAccountId = plaidAccountId;
  }

  const mask = toOptionalTrimmedString(metadata.mask);
  if (mask) {
    account.mask = mask;
  }

  const available = toOptionalNumber(metadata.available);
  if (available !== undefined) {
    account.available = available;
  }

  const tags = parseTags(metadata.tags);
  if (tags) {
    account.tags = tags;
  }

  const holdings = parseHoldings(metadata.holdings);
  if (holdings) {
    account.holdings = holdings;
  }

  const sortCode = typeof row.sort_code === 'string' ? row.sort_code.trim() : undefined;
  if (sortCode) {
    account.sortCode = sortCode;
  }

  const accountNumber = typeof row.account_number === 'string' ? row.account_number.trim() : undefined;
  if (accountNumber) {
    account.accountNumber = accountNumber;
  }

  return account;
};

const normaliseLocalAccount = (raw: Account | (Account & Record<string, unknown>)): Account => {
  const candidate = raw as Account & {
    created_at?: string;
    updated_at?: string;
    lastUpdated?: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  const lastUpdated = candidate.lastUpdated instanceof Date
    ? candidate.lastUpdated
    : candidate.lastUpdated
      ? new Date(candidate.lastUpdated)
      : new Date();

  const updatedAtSource = candidate.updatedAt ?? candidate.updated_at;

  const updatedAt = updatedAtSource
    ? (updatedAtSource instanceof Date ? updatedAtSource : new Date(updatedAtSource))
    : new Date(lastUpdated);

  const openingBalance = 'openingBalance' in candidate
    ? candidate.openingBalance
    : 'initial_balance' in candidate
      ? Number(candidate.initial_balance)
      : undefined;

  const result: Account & Record<string, unknown> = {
    ...candidate,
    openingBalance: openingBalance ?? undefined,
    lastUpdated,
    updatedAt,
  };

  return pruneUndefined(result);
};

const buildMetadata = (account: Partial<Account> & { openingBalance?: number }): SupabaseAccountInsert['metadata'] => {
  const metadata: Record<string, Json> = {};

  if ('notes' in account) metadata.notes = account.notes ?? null;
  if ('plaidConnectionId' in account) metadata.plaidConnectionId = account.plaidConnectionId ?? null;
  if ('plaidAccountId' in account) metadata.plaidAccountId = account.plaidAccountId ?? null;
  if ('mask' in account) metadata.mask = account.mask ?? null;
  if ('available' in account) metadata.available = account.available ?? null;
  if ('tags' in account) metadata.tags = (account.tags ?? null) as Json;
  if ('openingBalanceDate' in account) {
    metadata.openingBalanceDate = account.openingBalanceDate
      ? account.openingBalanceDate instanceof Date
        ? account.openingBalanceDate.toISOString()
        : new Date(account.openingBalanceDate).toISOString()
      : null;
  }
  if ('openingBalance' in account) metadata.openingBalance = account.openingBalance ?? null;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

export class AccountService {
  /**
   * Retrieves all active accounts for a specific user
   * @param {string} userId - The unique identifier of the user
   * @returns {Promise<Account[]>} Array of active accounts for the user
   * @throws {Error} If there's an error fetching accounts from the database
   * @example
   * const accounts = await AccountService.getAccounts('user-123');
   * // Returns: [{id: 'acc-1', name: 'Checking', balance: 1000, ...}]
   */
  static async getAccounts(userId: string): Promise<Account[]> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const stored = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
      return stored || [];
    }

    try {
      const { data, error } = await supabase!
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching accounts:', error);
        throw new Error(handleSupabaseError(error));
      }

      return (data ?? []).map(mapSupabaseAccountToDomain);
    } catch (error) {
      logger.error('AccountService.getAccounts error:', error);
      // Fallback to localStorage on error
      const stored = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
      return (stored || []).map(normaliseLocalAccount);
    }
  }

  /**
   * Creates a new financial account for a user
   * @param {string} userId - The unique identifier of the user
   * @param {Omit<Account, 'id' | 'created_at' | 'updated_at'>} account - Account data without system fields
   * @returns {Promise<Account>} The newly created account with all fields populated
   * @throws {Error} If account creation fails or validation errors occur
   * @example
   * const newAccount = await AccountService.createAccount('user-123', {
   *   name: 'Savings Account',
   *   type: 'savings',
   *   balance: 5000,
   *   currency: 'GBP'
   * });
   */
  static async createAccount(userId: string, account: AccountCreateInput): Promise<Account> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const now = new Date();
      const newAccount = normaliseLocalAccount({
        ...(account as Account),
        id: crypto.randomUUID(),
        lastUpdated: account.lastUpdated ?? now,
        updatedAt: account.updatedAt ?? now
      });

      const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
      accounts.push(newAccount);
      await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);

      return normaliseLocalAccount(newAccount);
    }

    try {
      const metadata = buildMetadata(account);

      const accountData: SupabaseAccountInsert = {
        user_id: userId,
        name: account.name,
        type: mapDomainTypeToSupabase(account.type),
        currency: account.currency ?? 'GBP',
        balance: account.balance ?? 0,
        initial_balance: account.openingBalance ?? account.balance ?? 0,
        is_active: account.isActive ?? true,
        institution: account.institution ?? null,
        icon: (account as { icon?: string }).icon ?? null,
        color: (account as { color?: string }).color ?? null,
        account_number: account.accountNumber ?? null,
        sort_code: account.sortCode ?? null,
        ...(metadata !== undefined ? { metadata } : {})
      };

      logger.info('Creating account', accountData);

      const { data, error } = await supabase!
        .from('accounts')
        .insert(accountData)
        .select()
        .single();

      if (error) {
        logger.error('Error creating account:', error);
        throw new Error(handleSupabaseError(error));
      }

      logger.info('Account created successfully');
      if (!data) {
        throw new Error('Account creation returned no data');
      }

      return mapSupabaseAccountToDomain(data);
    } catch (error) {
      logger.error('AccountService.createAccount error:', error);
      throw error;
    }
  }

  /**
   * Updates an existing account with partial data
   * @param {string} id - The unique identifier of the account to update
   * @param {Partial<Account>} updates - Partial account data to update
   * @returns {Promise<Account>} The updated account with all fields
   * @throws {Error} If account not found or update fails
   * @example
   * const updated = await AccountService.updateAccount('acc-123', {
   *   balance: 2500,
   *   name: 'Primary Checking'
   * });
   */
  static async updateAccount(id: string, updates: AccountUpdateInput): Promise<Account> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
      const index = accounts.findIndex(a => a.id === id);
      
      if (index === -1) {
        throw new Error('Account not found');
      }
      
      const currentRaw = accounts[index];
      if (!currentRaw) {
        throw new Error('Account not found after lookup');
      }

      const now = new Date();
      const baseAccount = normaliseLocalAccount(currentRaw);
      const updatedAccount: Account = {
        ...baseAccount,
        ...updates,
        lastUpdated: updates.lastUpdated ?? now,
        updatedAt: updates.updatedAt ?? now
      } as Account;
      accounts[index] = updatedAccount;
      
      await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
      return normaliseLocalAccount(updatedAccount);
    }

    try {
      const metadata = buildMetadata(updates);
      const updatePayload: SupabaseAccountUpdate = {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.type !== undefined ? { type: mapDomainTypeToSupabase(updates.type) } : {}),
        ...(updates.balance !== undefined ? { balance: updates.balance } : {}),
        ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
        ...(updates.institution !== undefined ? { institution: updates.institution } : {}),
        ...((updates as { icon?: string }).icon !== undefined ? { icon: (updates as { icon?: string }).icon ?? null } : {}),
        ...((updates as { color?: string }).color !== undefined ? { color: (updates as { color?: string }).color ?? null } : {}),
        ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
        ...(updates.openingBalance !== undefined ? { initial_balance: updates.openingBalance } : {}),
        ...(updates.accountNumber !== undefined ? { account_number: updates.accountNumber ?? null } : {}),
        ...(updates.sortCode !== undefined ? { sort_code: updates.sortCode ?? null } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase!
        .from('accounts')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating account:', error);
        throw new Error(handleSupabaseError(error));
      }
      if (!data) {
        throw new Error('Account update returned no data');
      }

      return mapSupabaseAccountToDomain(data);
    } catch (error) {
      logger.error('AccountService.updateAccount error:', error);
      throw error;
    }
  }

  /**
   * Soft deletes an account by marking it as inactive
   * @param {string} id - The unique identifier of the account to delete
   * @returns {Promise<void>} Resolves when deletion is successful
   * @throws {Error} If account not found or deletion fails
   * @description Performs a soft delete by setting is_active to false, preserving data for audit trails
   * @example
   * await AccountService.deleteAccount('acc-123');
   */
  static async deleteAccount(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
      const filtered = accounts.filter(a => a.id !== id);
      await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, filtered);
      return;
    }

    try {
      const { error } = await supabase!
        .from('accounts')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        logger.error('Error deleting account:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      logger.error('AccountService.deleteAccount error:', error);
      throw error;
    }
  }

  /**
   * Retrieves a single account by its unique identifier
   * @param {string} id - The unique identifier of the account
   * @returns {Promise<Account | null>} The account if found, null otherwise
   * @throws {Error} If there's a database error (other than not found)
   * @example
   * const account = await AccountService.getAccountById('acc-123');
   * if (account) {
 *   logger.info(`Account balance: ${account.balance}`);
   * }
   */
  static async getAccountById(id: string): Promise<Account | null> {
    if (!isSupabaseConfigured()) {
      const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
      const match = accounts.find(a => a.id === id);
      return match ? normaliseLocalAccount(match) : null;
    }

    try {
      const { data, error } = await supabase!
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null;
        }
        logger.error('Error fetching account:', error);
        throw new Error(handleSupabaseError(error));
      }

      if (!data) {
        return null;
      }

      return mapSupabaseAccountToDomain(data);
    } catch (error) {
      logger.error('AccountService.getAccountById error:', error);
      throw error;
    }
  }

  /**
   * Update account balance
   */
  static async updateBalance(id: string, newBalance: number): Promise<void> {
    if (!isSupabaseConfigured()) {
      const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
      const index = accounts.findIndex(a => a.id === id);
      
      if (index !== -1) {
        const currentRaw = accounts[index];
        if (!currentRaw) {
          return;
        }
        const current = normaliseLocalAccount(currentRaw);
        const now = new Date();
        const updated: Account = {
          ...current,
          balance: newBalance,
          lastUpdated: now,
          updatedAt: now
        };
        accounts[index] = updated;
        await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
      }
      return;
    }

    try {
      const { error } = await supabase!
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', id);

      if (error) {
        logger.error('Error updating balance:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      logger.error('AccountService.updateBalance error:', error);
      throw error;
    }
  }

  /**
   * Recalculate account balance from transactions
   */
  static async recalculateBalance(accountId: string): Promise<number> {
    if (!isSupabaseConfigured()) {
      const transactions = await storageAdapter.get<Array<Pick<{ account_id: string; amount: number }, 'account_id' | 'amount'>>>(STORAGE_KEYS.TRANSACTIONS) || [];
      const accountTransactions = transactions.filter(t => t.account_id === accountId);
      const balance = accountTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      await this.updateBalance(accountId, balance);
      return balance;
    }

    try {
      // Get initial balance
      const { data: account } = await supabase!
        .from('accounts')
        .select('initial_balance')
        .eq('id', accountId)
        .single();

      // Get sum of all transactions
      const { data: transactions } = await supabase!
        .from('transactions')
        .select('amount')
        .eq('account_id', accountId);

      const transactionTotal = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const newBalance = (account?.initial_balance || 0) + transactionTotal;

      // Update the balance
      await this.updateBalance(accountId, newBalance);

      return newBalance;
    } catch (error) {
      logger.error('AccountService.recalculateBalance error:', error);
      throw error;
    }
  }

  /**
   * Get total balance across all accounts
   */
  static async getTotalBalance(userId: string): Promise<number> {
    if (!isSupabaseConfigured()) {
      const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
      return accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    }

    try {
      const { data, error } = await supabase!
        .from('accounts')
        .select('balance')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        logger.error('Error fetching total balance:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0;
    } catch (error) {
      logger.error('AccountService.getTotalBalance error:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time account updates
   */
  static subscribeToAccounts(
    userId: string,
    callback: (payload: unknown) => void
  ): () => void {
    if (!isSupabaseConfigured()) {
      return () => {}; // No-op unsubscribe
    }

    const subscription = supabase!
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

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  }
}
