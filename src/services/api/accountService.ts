import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import type { Account } from '../../types';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { logger } from '../loggingService';
import type { Database } from '../../types/supabase';

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

      return data || [];
    } catch (error) {
      logger.error('AccountService.getAccounts error:', error);
      // Fallback to localStorage on error
      const stored = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
      return stored || [];
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
  static async createAccount(userId: string, account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<Account> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const newAccount = {
        ...account,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updatedAt: new Date()
      };
      
      const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
      accounts.push(newAccount as Account);
      await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
      
      return newAccount as Account;
    }

    try {
      // Prepare the account data without problematic fields
      // Map 'current' to 'checking' as that's what the database expects
      // Map account type properly (current -> checking for UK compatibility)
      const accountType = (account.type as string) === 'current' ? 'checking' : account.type;
      const mappedType = accountType;

      const accountData: Database['public']['Tables']['accounts']['Insert'] = {
        user_id: userId,
        name: account.name,
        type: (mappedType as any) || 'checking',
        currency: account.currency || 'GBP',
        balance: account.balance || 0,
        initial_balance: account.balance || 0,
        is_active: account.isActive !== undefined ? account.isActive : true,
        institution: account.institution || null,
        icon: null,
        color: null
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
      return data;
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
  static async updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
      const index = accounts.findIndex(a => a.id === id);
      
      if (index === -1) {
        throw new Error('Account not found');
      }
      
      accounts[index] = {
        ...accounts[index],
        ...updates,
        updatedAt: new Date()
      };
      
      await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
      return accounts[index];
    }

    try {
      const { data, error } = await supabase!
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data;
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
      return accounts.find(a => a.id === id) || null;
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

      return data;
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
        accounts[index].balance = newBalance;
        accounts[index].updatedAt = new Date();
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
