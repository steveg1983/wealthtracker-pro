import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import type { Account } from '../../types';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';

export class AccountService {
  /**
   * Get all accounts for a user
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
        console.error('Error fetching accounts:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data || [];
    } catch (error) {
      console.error('AccountService.getAccounts error:', error);
      // Fallback to localStorage on error
      const stored = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
      return stored || [];
    }
  }

  /**
   * Create a new account
   */
  static async createAccount(userId: string, account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<Account> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const newAccount = {
        ...account,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
      accounts.push(newAccount as Account);
      await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
      
      return newAccount as Account;
    }

    try {
      // Prepare the account data without problematic fields
      // Map 'current' to 'checking' as that's what the database expects
      const accountType = account.type === 'current' ? 'checking' : account.type;
      
      // Map account type properly (current -> checking for UK compatibility)
      const mappedType = accountType === 'current' ? 'checking' : accountType;
      
      const accountData: any = {
        user_id: userId,
        name: account.name,
        type: mappedType || 'checking',
        currency: account.currency || 'GBP',
        balance: account.balance || 0,
        initial_balance: account.initialBalance || account.balance || 0,
        is_active: account.isActive !== undefined ? account.isActive : true,
        institution: account.institution || null,
        icon: account.icon || null,
        color: account.color || null
      };

      console.log('Creating account with data:', accountData);

      const { data, error } = await supabase!
        .from('accounts')
        .insert(accountData)
        .select()
        .single();

      if (error) {
        console.error('Error creating account:', error);
        throw new Error(handleSupabaseError(error));
      }

      console.log('Account created successfully:', data);
      return data;
    } catch (error) {
      console.error('AccountService.createAccount error:', error);
      throw error;
    }
  }

  /**
   * Update an account
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
        updated_at: new Date().toISOString()
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
        console.error('Error updating account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data;
    } catch (error) {
      console.error('AccountService.updateAccount error:', error);
      throw error;
    }
  }

  /**
   * Delete an account (soft delete - marks as inactive)
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
        console.error('Error deleting account:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      console.error('AccountService.deleteAccount error:', error);
      throw error;
    }
  }

  /**
   * Get account by ID
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
        console.error('Error fetching account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data;
    } catch (error) {
      console.error('AccountService.getAccountById error:', error);
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
        accounts[index].updated_at = new Date().toISOString();
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
        console.error('Error updating balance:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      console.error('AccountService.updateBalance error:', error);
      throw error;
    }
  }

  /**
   * Recalculate account balance from transactions
   */
  static async recalculateBalance(accountId: string): Promise<number> {
    if (!isSupabaseConfigured()) {
      const transactions = await storageAdapter.get<any[]>(STORAGE_KEYS.TRANSACTIONS) || [];
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
      console.error('AccountService.recalculateBalance error:', error);
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
        console.error('Error fetching total balance:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0;
    } catch (error) {
      console.error('AccountService.getTotalBalance error:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time account updates
   */
  static subscribeToAccounts(
    userId: string,
    callback: (payload: any) => void
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