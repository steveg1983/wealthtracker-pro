/**
 * Supabase Service - Handles all database operations
 * 
 * This service provides methods to:
 * - Create, read, update, delete data
 * - Handle real-time subscriptions
 * - Manage user data with proper isolation
 */

import { supabase } from '../lib/supabase';
import type { Account, Transaction, Budget, Goal } from '../types';
import { logger } from './loggingService';
import { 
  AccountCreateSchema, TransactionCreateSchema, BudgetCreateSchema, GoalCreateSchema,
  type AccountCreate, type TransactionCreate, type BudgetCreate, type GoalCreate
} from '../types/schemas';

export class SupabaseService {
  /**
   * Get or create user profile
   */
  static async getUserProfile(clerkUserId: string) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', clerkUserId)
        .single();

      if (error) {
        logger.error('Error fetching user profile:', error);
        return null;
      }
      return data;
    } catch (e) {
      logger.error('Error fetching user profile:', e);
      return null;
    }
  }

  /**
   * Accounts Management
   */
  static async getAccounts(userId: string) {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (error) {
      logger.error('Error fetching accounts:', error);
      return [];
    }
    
    return data || [];
  }

  static async createAccount(userId: string, account: Partial<Account> | AccountCreate) {
    if (!supabase) return null;

    const parsed = AccountCreateSchema.safeParse(account);
    if (!parsed.success) {
      logger.error('Invalid account payload', parsed.error);
      return null;
    }
    
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        type: parsed.data.type,
        balance: parsed.data.balance ?? 0,
        currency: parsed.data.currency ?? 'USD',
        institution: parsed.data.institution,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating account:', error);
      return null;
    }
    
    return data;
  }

  static async updateAccount(accountId: string, updates: Partial<Account>) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', accountId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating account:', error);
      return null;
    }
    
    return data;
  }

  static async deleteAccount(accountId: string) {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId);
    
    if (error) {
      logger.error('Error deleting account:', error);
      return false;
    }
    
    return true;
  }

  /**
   * Transactions Management
   */
  static async getTransactions(userId: string, limit = 100) {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);
    
    if (error) {
      logger.error('Error fetching transactions:', error);
      return [];
    }
    
    return data || [];
  }

  static async createTransaction(userId: string, transaction: Partial<Transaction> | TransactionCreate) {
    if (!supabase) return null;

    const parsed = TransactionCreateSchema.safeParse(transaction);
    if (!parsed.success) {
      logger.error('Invalid transaction payload', parsed.error);
      return null;
    }
    
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: parsed.data.accountId,
        date: parsed.data.date,
        description: parsed.data.description,
        amount: parsed.data.amount,
        type: parsed.data.type,
        category: parsed.data.category,
        notes: parsed.data.notes,
        tags: parsed.data.tags,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating transaction:', error);
      return null;
    }
    
    return data;
  }

  static async updateTransaction(transactionId: string, updates: Partial<Transaction>) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transactionId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating transaction:', error);
      return null;
    }
    
    return data;
  }

  static async deleteTransaction(transactionId: string) {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);
    
    if (error) {
      logger.error('Error deleting transaction:', error);
      return false;
    }
    
    return true;
  }

  /**
   * Budgets Management
   */
  static async getBudgets(userId: string) {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('category', { ascending: true });
    
    if (error) {
      logger.error('Error fetching budgets:', error);
      return [];
    }
    
    return data || [];
  }

  static async createBudget(userId: string, budget: Partial<Budget> | BudgetCreate) {
    if (!supabase) return null;

    const parsed = BudgetCreateSchema.safeParse(budget);
    if (!parsed.success) {
      logger.error('Invalid budget payload', parsed.error);
      return null;
    }
    
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        category: parsed.data.category,
        amount: parsed.data.amount,
        period: parsed.data.period ?? 'monthly',
        start_date: parsed.data.startDate,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating budget:', error);
      return null;
    }
    
    return data;
  }

  /**
   * Goals Management
   */
  static async getGoals(userId: string) {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('target_date', { ascending: true });
    
    if (error) {
      logger.error('Error fetching goals:', error);
      return [];
    }
    
    return data || [];
  }

  static async createGoal(userId: string, goal: Partial<Goal> | GoalCreate) {
    if (!supabase) return null;

    const parsed = GoalCreateSchema.safeParse(goal);
    if (!parsed.success) {
      logger.error('Invalid goal payload', parsed.error);
      return null;
    }
    
    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        description: parsed.data.description,
        target_amount: parsed.data.targetAmount,
        current_amount: parsed.data.currentAmount ?? 0,
        target_date: parsed.data.targetDate,
        category: parsed.data.category,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating goal:', error);
      return null;
    }
    
    return data;
  }

  /**
   * Real-time Subscriptions
   */
  static subscribeToAccounts(userId: string, callback: (payload: unknown) => void) {
    if (!supabase) return null;
    
    return supabase
      .channel('accounts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }

  static subscribeToTransactions(userId: string, callback: (payload: unknown) => void) {
    if (!supabase) return null;
    
    return supabase
      .channel('transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Batch Operations
   */
  static async importTransactions(userId: string, transactions: Partial<Transaction>[]) {
    if (!supabase) return { success: 0, failed: 0 };
    
    const results = await Promise.allSettled(
      transactions.map(t => this.createTransaction(userId, t))
    );
    
    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return { success, failed };
  }
}
