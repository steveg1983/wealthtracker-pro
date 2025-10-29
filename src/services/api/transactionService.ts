import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import type { Transaction } from '../../types';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';

export class TransactionService {
  /**
   * Get all transactions for a user
   */
  static async getTransactions(userId: string): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const stored = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
      return stored || [];
    }

    try {
      const { data, error } = await supabase!
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data || [];
    } catch (error) {
      console.error('TransactionService.getTransactions error:', error);
      // Fallback to localStorage on error
      const stored = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
      return stored || [];
    }
  }

  /**
   * Create a new transaction
   */
  static async createTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const newTransaction = {
        ...transaction,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const transactions = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS) || [];
      transactions.push(newTransaction as Transaction);
      await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, transactions);
      
      return newTransaction as Transaction;
    }

    try {
      const { data, error } = await supabase!
        .from('transactions')
        .insert({
          ...transaction,
          user_id: userId
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      // Update account balance
      await this.updateAccountBalance(transaction.account_id, transaction.amount);

      return data;
    } catch (error) {
      console.error('TransactionService.createTransaction error:', error);
      throw error;
    }
  }

  /**
   * Update a transaction
   */
  static async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const transactions = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS) || [];
      const index = transactions.findIndex(t => t.id === id);
      
      if (index === -1) {
        throw new Error('Transaction not found');
      }
      
      const oldAmount = transactions[index].amount;
      transactions[index] = {
        ...transactions[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, transactions);
      return transactions[index];
    }

    try {
      // Get old transaction to calculate balance difference
      const { data: oldTransaction } = await supabase!
        .from('transactions')
        .select('amount, account_id')
        .eq('id', id)
        .single();

      const { data, error } = await supabase!
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      // Update account balance if amount changed
      if (oldTransaction && updates.amount !== undefined && updates.amount !== oldTransaction.amount) {
        const difference = (updates.amount as number) - oldTransaction.amount;
        await this.updateAccountBalance(oldTransaction.account_id, difference);
      }

      return data;
    } catch (error) {
      console.error('TransactionService.updateTransaction error:', error);
      throw error;
    }
  }

  /**
   * Delete a transaction
   */
  static async deleteTransaction(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const transactions = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS) || [];
      const filtered = transactions.filter(t => t.id !== id);
      await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, filtered);
      return;
    }

    try {
      // Get transaction to update account balance
      const { data: transaction } = await supabase!
        .from('transactions')
        .select('amount, account_id')
        .eq('id', id)
        .single();

      const { error } = await supabase!
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      // Update account balance
      if (transaction) {
        await this.updateAccountBalance(transaction.account_id, -transaction.amount);
      }
    } catch (error) {
      console.error('TransactionService.deleteTransaction error:', error);
      throw error;
    }
  }

  /**
   * Get transactions by date range
   */
  static async getTransactionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      const transactions = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS) || [];
      return transactions.filter(t => {
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
      });
    }

    try {
      const { data, error } = await supabase!
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions by date range:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data || [];
    } catch (error) {
      console.error('TransactionService.getTransactionsByDateRange error:', error);
      throw error;
    }
  }

  /**
   * Get transactions by account
   */
  static async getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      const transactions = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS) || [];
      return transactions.filter(t => t.account_id === accountId);
    }

    try {
      const { data, error } = await supabase!
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions by account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data || [];
    } catch (error) {
      console.error('TransactionService.getTransactionsByAccount error:', error);
      throw error;
    }
  }

  /**
   * Get transactions by category
   */
  static async getTransactionsByCategory(categoryId: string): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      const transactions = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS) || [];
      return transactions.filter(t => t.category === categoryId);
    }

    try {
      const { data, error } = await supabase!
        .from('transactions')
        .select('*')
        .eq('category_id', categoryId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions by category:', error);
        throw new Error(handleSupabaseError(error));
      }

      return data || [];
    } catch (error) {
      console.error('TransactionService.getTransactionsByCategory error:', error);
      throw error;
    }
  }

  /**
   * Bulk create transactions
   */
  static async bulkCreateTransactions(userId: string, transactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]): Promise<Transaction[]> {
    if (!isSupabaseConfigured()) {
      // Fallback to localStorage
      const newTransactions = transactions.map(t => ({
        ...t,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      const stored = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS) || [];
      stored.push(...newTransactions as Transaction[]);
      await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, stored);
      
      return newTransactions as Transaction[];
    }

    try {
      const transactionsWithUser = transactions.map(t => ({
        ...t,
        user_id: userId
      }));

      const { data, error } = await supabase!
        .from('transactions')
        .insert(transactionsWithUser)
        .select();

      if (error) {
        console.error('Error bulk creating transactions:', error);
        throw new Error(handleSupabaseError(error));
      }

      // Update account balances
      for (const transaction of data || []) {
        await this.updateAccountBalance(transaction.account_id, transaction.amount);
      }

      return data || [];
    } catch (error) {
      console.error('TransactionService.bulkCreateTransactions error:', error);
      throw error;
    }
  }

  /**
   * Helper to update account balance
   */
  private static async updateAccountBalance(accountId: string, amount: number): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      const { data: account } = await supabase!
        .from('accounts')
        .select('balance')
        .eq('id', accountId)
        .single();

      if (account) {
        const newBalance = (account.balance || 0) + amount;
        
        await supabase!
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', accountId);
      }
    } catch (error) {
      console.error('Error updating account balance:', error);
    }
  }

  /**
   * Subscribe to real-time transaction updates
   */
  static subscribeToTransactions(
    userId: string,
    callback: (payload: any) => void
  ): () => void {
    if (!isSupabaseConfigured()) {
      return () => {}; // No-op unsubscribe
    }

    const subscription = supabase!
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

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  }
}