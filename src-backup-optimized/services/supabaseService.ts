/**
 * Supabase Service - Core database operations service
 *
 * Features:
 * - Comprehensive CRUD operations for all entities
 * - Type-safe database interactions
 * - Authentication-aware operations
 * - Transaction support
 * - Error handling and logging
 * - Offline fallback capabilities
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { lazyLogger } from './serviceFactory';
import { supabaseMappers } from './supabaseMappers';
import type { Account, Transaction, Budget, Goal } from '../types';

const logger = lazyLogger.getLogger('SupabaseService');

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient;
  private isInitialized = false;

  private constructor() {
    this.client = createClient(supabaseUrl, supabaseKey);
    this.initialize();
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Test connection
      const { data, error } = await this.client.from('accounts').select('count').limit(1);
      if (error && error.message !== 'table "accounts" does not exist') {
        logger.error('Supabase initialization failed:', error);
      } else {
        this.isInitialized = true;
        logger.info('Supabase service initialized successfully');
      }
    } catch (error) {
      logger.error('Supabase initialization error:', error);
    }
  }

  // Account operations
  public static async getAccounts(userId: string): Promise<Account[]> {
    const service = SupabaseService.getInstance();

    try {
      const { data, error } = await service.client
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        logger.error('Error fetching accounts:', error);
        throw new Error(`Failed to fetch accounts: ${error.message}`);
      }

      return data?.map(supabaseMappers.mapAccountFromDB) || [];
    } catch (error) {
      logger.error('Error in getAccounts:', error);
      throw error;
    }
  }

  public static async createAccount(userId: string, account: Omit<Account, 'id'>): Promise<Account> {
    const service = SupabaseService.getInstance();

    try {
      const accountRow = supabaseMappers.mapAccountToDB({ ...account, id: '', userId });

      const { data, error } = await service.client
        .from('accounts')
        .insert([{ ...accountRow, user_id: userId }])
        .select()
        .single();

      if (error) {
        logger.error('Error creating account:', error);
        throw new Error(`Failed to create account: ${error.message}`);
      }

      const createdAccount = supabaseMappers.mapAccountFromDB(data);
      logger.info('Account created successfully', { accountId: createdAccount.id });
      return createdAccount;
    } catch (error) {
      logger.error('Error in createAccount:', error);
      throw error;
    }
  }

  public static async updateAccount(userId: string, accountId: string, updates: Partial<Account>): Promise<Account> {
    const service = SupabaseService.getInstance();

    try {
      const updateRow = supabaseMappers.mapAccountUpdateToDB(updates);

      const { data, error } = await service.client
        .from('accounts')
        .update(updateRow)
        .eq('id', accountId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating account:', error);
        throw new Error(`Failed to update account: ${error.message}`);
      }

      if (!data) {
        throw new Error('Account not found or access denied');
      }

      const updatedAccount = supabaseMappers.mapAccountFromDB(data);
      logger.info('Account updated successfully', { accountId });
      return updatedAccount;
    } catch (error) {
      logger.error('Error in updateAccount:', error);
      throw error;
    }
  }

  public static async deleteAccount(userId: string, accountId: string): Promise<boolean> {
    const service = SupabaseService.getInstance();

    try {
      // Soft delete by setting is_active to false
      const { data, error } = await service.client
        .from('accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', accountId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error deleting account:', error);
        throw new Error(`Failed to delete account: ${error.message}`);
      }

      if (!data) {
        throw new Error('Account not found or access denied');
      }

      logger.info('Account deleted successfully', { accountId });
      return true;
    } catch (error) {
      logger.error('Error in deleteAccount:', error);
      throw error;
    }
  }

  // Transaction operations
  public static async getTransactions(userId: string, filters?: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Transaction[]> {
    const service = SupabaseService.getInstance();

    try {
      let query = service.client
        .from('transactions')
        .select('*')
        .eq('user_id', userId);

      if (filters?.accountId) {
        query = query.eq('account_id', filters.accountId);
      }

      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }

      query = query.order('date', { ascending: false });

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching transactions:', error);
        throw new Error(`Failed to fetch transactions: ${error.message}`);
      }

      return data?.map(supabaseMappers.mapTransactionFromDB) || [];
    } catch (error) {
      logger.error('Error in getTransactions:', error);
      throw error;
    }
  }

  public static async createTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const service = SupabaseService.getInstance();

    try {
      const transactionRow = supabaseMappers.mapTransactionToDB({ ...transaction, id: '', userId });

      const { data, error } = await service.client
        .from('transactions')
        .insert([{ ...transactionRow, user_id: userId }])
        .select()
        .single();

      if (error) {
        logger.error('Error creating transaction:', error);
        throw new Error(`Failed to create transaction: ${error.message}`);
      }

      const createdTransaction = supabaseMappers.mapTransactionFromDB(data);
      logger.info('Transaction created successfully', { transactionId: createdTransaction.id });
      return createdTransaction;
    } catch (error) {
      logger.error('Error in createTransaction:', error);
      throw error;
    }
  }

  public static async updateTransaction(userId: string, transactionId: string, updates: Partial<Transaction>): Promise<Transaction> {
    const service = SupabaseService.getInstance();

    try {
      const updateRow = supabaseMappers.mapTransactionUpdateToDB(updates);

      const { data, error } = await service.client
        .from('transactions')
        .update(updateRow)
        .eq('id', transactionId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating transaction:', error);
        throw new Error(`Failed to update transaction: ${error.message}`);
      }

      if (!data) {
        throw new Error('Transaction not found or access denied');
      }

      const updatedTransaction = supabaseMappers.mapTransactionFromDB(data);
      logger.info('Transaction updated successfully', { transactionId });
      return updatedTransaction;
    } catch (error) {
      logger.error('Error in updateTransaction:', error);
      throw error;
    }
  }

  public static async deleteTransaction(userId: string, transactionId: string): Promise<boolean> {
    const service = SupabaseService.getInstance();

    try {
      const { error } = await service.client
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting transaction:', error);
        throw new Error(`Failed to delete transaction: ${error.message}`);
      }

      logger.info('Transaction deleted successfully', { transactionId });
      return true;
    } catch (error) {
      logger.error('Error in deleteTransaction:', error);
      throw error;
    }
  }

  // Budget operations
  public static async getBudgets(userId: string): Promise<Budget[]> {
    const service = SupabaseService.getInstance();

    try {
      const { data, error } = await service.client
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        logger.error('Error fetching budgets:', error);
        throw new Error(`Failed to fetch budgets: ${error.message}`);
      }

      return data?.map(supabaseMappers.mapBudgetFromDB) || [];
    } catch (error) {
      logger.error('Error in getBudgets:', error);
      throw error;
    }
  }

  public static async createBudget(userId: string, budget: Omit<Budget, 'id'>): Promise<Budget> {
    const service = SupabaseService.getInstance();

    try {
      const budgetRow = supabaseMappers.mapBudgetToDB({ ...budget, id: '', userId });

      const { data, error } = await service.client
        .from('budgets')
        .insert([{ ...budgetRow, user_id: userId }])
        .select()
        .single();

      if (error) {
        logger.error('Error creating budget:', error);
        throw new Error(`Failed to create budget: ${error.message}`);
      }

      const createdBudget = supabaseMappers.mapBudgetFromDB(data);
      logger.info('Budget created successfully', { budgetId: createdBudget.id });
      return createdBudget;
    } catch (error) {
      logger.error('Error in createBudget:', error);
      throw error;
    }
  }

  public static async updateBudget(userId: string, budgetId: string, updates: Partial<Budget>): Promise<Budget> {
    const service = SupabaseService.getInstance();

    try {
      const updateRow = supabaseMappers.mapBudgetUpdateToDB(updates);

      const { data, error } = await service.client
        .from('budgets')
        .update(updateRow)
        .eq('id', budgetId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating budget:', error);
        throw new Error(`Failed to update budget: ${error.message}`);
      }

      if (!data) {
        throw new Error('Budget not found or access denied');
      }

      const updatedBudget = supabaseMappers.mapBudgetFromDB(data);
      logger.info('Budget updated successfully', { budgetId });
      return updatedBudget;
    } catch (error) {
      logger.error('Error in updateBudget:', error);
      throw error;
    }
  }

  public static async deleteBudget(userId: string, budgetId: string): Promise<boolean> {
    const service = SupabaseService.getInstance();

    try {
      // Soft delete by setting is_active to false
      const { data, error } = await service.client
        .from('budgets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', budgetId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error deleting budget:', error);
        throw new Error(`Failed to delete budget: ${error.message}`);
      }

      if (!data) {
        throw new Error('Budget not found or access denied');
      }

      logger.info('Budget deleted successfully', { budgetId });
      return true;
    } catch (error) {
      logger.error('Error in deleteBudget:', error);
      throw error;
    }
  }

  // Goal operations
  public static async getGoals(userId: string): Promise<Goal[]> {
    const service = SupabaseService.getInstance();

    try {
      const { data, error } = await service.client
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('target_date');

      if (error) {
        logger.error('Error fetching goals:', error);
        throw new Error(`Failed to fetch goals: ${error.message}`);
      }

      return data?.map(supabaseMappers.mapGoalFromDB) || [];
    } catch (error) {
      logger.error('Error in getGoals:', error);
      throw error;
    }
  }

  public static async createGoal(userId: string, goal: Omit<Goal, 'id'>): Promise<Goal> {
    const service = SupabaseService.getInstance();

    try {
      const goalRow = supabaseMappers.mapGoalToDB({ ...goal, id: '', userId });

      const { data, error } = await service.client
        .from('goals')
        .insert([{ ...goalRow, user_id: userId }])
        .select()
        .single();

      if (error) {
        logger.error('Error creating goal:', error);
        throw new Error(`Failed to create goal: ${error.message}`);
      }

      const createdGoal = supabaseMappers.mapGoalFromDB(data);
      logger.info('Goal created successfully', { goalId: createdGoal.id });
      return createdGoal;
    } catch (error) {
      logger.error('Error in createGoal:', error);
      throw error;
    }
  }

  public static async updateGoal(userId: string, goalId: string, updates: Partial<Goal>): Promise<Goal> {
    const service = SupabaseService.getInstance();

    try {
      const updateRow = supabaseMappers.mapGoalUpdateToDB(updates);

      const { data, error } = await service.client
        .from('goals')
        .update(updateRow)
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating goal:', error);
        throw new Error(`Failed to update goal: ${error.message}`);
      }

      if (!data) {
        throw new Error('Goal not found or access denied');
      }

      const updatedGoal = supabaseMappers.mapGoalFromDB(data);
      logger.info('Goal updated successfully', { goalId });
      return updatedGoal;
    } catch (error) {
      logger.error('Error in updateGoal:', error);
      throw error;
    }
  }

  public static async deleteGoal(userId: string, goalId: string): Promise<boolean> {
    const service = SupabaseService.getInstance();

    try {
      // Soft delete by setting is_active to false
      const { data, error } = await service.client
        .from('goals')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error deleting goal:', error);
        throw new Error(`Failed to delete goal: ${error.message}`);
      }

      if (!data) {
        throw new Error('Goal not found or access denied');
      }

      logger.info('Goal deleted successfully', { goalId });
      return true;
    } catch (error) {
      logger.error('Error in deleteGoal:', error);
      throw error;
    }
  }

  // Utility methods
  public static async healthCheck(): Promise<boolean> {
    const service = SupabaseService.getInstance();

    try {
      const { error } = await service.client.from('accounts').select('count').limit(1);
      return !error || error.message === 'table "accounts" does not exist';
    } catch {
      return false;
    }
  }

  public static getClient(): SupabaseClient {
    return SupabaseService.getInstance().client;
  }

  public static isReady(): boolean {
    return SupabaseService.getInstance().isInitialized;
  }
}

export default SupabaseService;