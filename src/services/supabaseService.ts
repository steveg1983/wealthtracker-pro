/**
 * Supabase Service - Handles all database operations and subscriptions.
 * Now supports dependency injection so it can be deterministically tested.
 */

import { supabase } from '../lib/supabase';
import type { Account, Transaction, Budget, Goal } from '../types';
import { createScopedLogger, type ScopedLogger } from '../loggers/scopedLogger';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type SupabaseClientLike = typeof supabase;

interface _SupabaseTableQuery {
  select: (...args: unknown[]) => _SupabaseTableQuery;
  eq: (column: string, value: unknown) => _SupabaseTableQuery;
  order: (column: string, options?: Record<string, unknown>) => _SupabaseTableQuery;
  limit?: (value: number) => _SupabaseTableQuery;
  single?: () => _SupabaseTableQuery;
}

export interface SupabaseServiceOptions {
  supabaseClient?: SupabaseClientLike | null;
  logger?: ScopedLogger;
}

class SupabaseServiceImpl {
  private readonly client: SupabaseClientLike | null;
  private readonly logger: ScopedLogger;

  constructor(options: SupabaseServiceOptions = {}) {
    if ('supabaseClient' in options) {
      this.client = options.supabaseClient ?? null;
    } else {
      this.client = supabase ?? null;
    }
    this.logger = options.logger ?? createScopedLogger('SupabaseService');
  }

  private ensureClient() {
    if (!this.client) {
      return null;
    }
    return this.client;
  }

  async getUserProfile(clerkUserId: string) {
    const client = this.ensureClient();
    if (!client) return null;

    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (error) {
      this.logger.error('Error fetching user profile:', error);
      return null;
    }
    return data;
  }

  async getAccounts(userId: string) {
    const client = this.ensureClient();
    if (!client) return [];

    const { data, error } = await client
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error('Error fetching accounts:', error);
      return [];
    }

    return data || [];
  }

  async createAccount(userId: string, account: Partial<Account>) {
    const client = this.ensureClient();
    if (!client) return null;

    const { data, error } = await client
      .from('accounts')
      .insert({
        user_id: userId,
        name: account.name,
        type: account.type,
        balance: account.balance || 0,
        currency: account.currency || 'USD',
        institution: account.institution,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating account:', error);
      return null;
    }

    return data;
  }

  async updateAccount(accountId: string, updates: Partial<Account>) {
    const client = this.ensureClient();
    if (!client) return null;

    const { data, error } = await client
      .from('accounts')
      .update(updates)
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating account:', error);
      return null;
    }

    return data;
  }

  async deleteAccount(accountId: string) {
    const client = this.ensureClient();
    if (!client) return false;

    const { error } = await client
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      this.logger.error('Error deleting account:', error);
      return false;
    }

    return true;
  }

  async getTransactions(userId: string, limit = 100) {
    const client = this.ensureClient();
    if (!client) return [];

    const query = client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    const { data, error } = await (typeof query.limit === 'function' ? query.limit(limit) : query);

    if (error) {
      this.logger.error('Error fetching transactions:', error);
      return [];
    }

    return data || [];
  }

  async createTransaction(userId: string, transaction: Partial<Transaction>) {
    const client = this.ensureClient();
    if (!client) return null;

    const { data, error } = await client
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: transaction.accountId,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
        notes: transaction.notes,
        tags: transaction.tags
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating transaction:', error);
      return null;
    }

    return data;
  }

  async updateTransaction(transactionId: string, updates: Partial<Transaction>) {
    const client = this.ensureClient();
    if (!client) return null;

    const { data, error } = await client
      .from('transactions')
      .update(updates)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating transaction:', error);
      return null;
    }

    return data;
  }

  async deleteTransaction(transactionId: string) {
    const client = this.ensureClient();
    if (!client) return false;

    const { error } = await client
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) {
      this.logger.error('Error deleting transaction:', error);
      return false;
    }

    return true;
  }

  async getBudgets(userId: string) {
    const client = this.ensureClient();
    if (!client) return [];

    const { data, error } = await client
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('category', { ascending: true });

    if (error) {
      this.logger.error('Error fetching budgets:', error);
      return [];
    }

    return data || [];
  }

  async createBudget(userId: string, budget: Partial<Budget>) {
    const client = this.ensureClient();
    if (!client) return null;

    const { data, error } = await client
      .from('budgets')
      .insert({
        user_id: userId,
        name: budget.name,
        category: budget.categoryId,
        amount: budget.amount,
        period: budget.period || 'monthly',
        start_date: budget.startDate,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating budget:', error);
      return null;
    }

    return data;
  }

  async getGoals(userId: string) {
    const client = this.ensureClient();
    if (!client) return [];

    const { data, error } = await client
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('target_date', { ascending: true });

    if (error) {
      this.logger.error('Error fetching goals:', error);
      return [];
    }

    return data || [];
  }

  async createGoal(userId: string, goal: Partial<Goal>) {
    const client = this.ensureClient();
    if (!client) return null;

    const { data, error } = await client
      .from('goals')
      .insert({
        user_id: userId,
        name: goal.name,
        description: goal.description,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount || 0,
        target_date: goal.targetDate,
        category: goal.category
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating goal:', error);
      return null;
    }

    return data;
  }

  subscribeToAccounts(userId: string, callback: (payload: RealtimePostgresChangesPayload<Account>) => void) {
    const client = this.ensureClient();
    if (!client) return null;

    return client
      .channel('accounts_changes')
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
  }

  subscribeToTransactions(
    userId: string,
    callback: (payload: RealtimePostgresChangesPayload<Transaction>) => void
  ) {
    const client = this.ensureClient();
    if (!client) return null;

    return client
      .channel('transactions_changes')
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
  }

  async importTransactions(userId: string, transactions: Partial<Transaction>[]) {
    const client = this.ensureClient();
    if (!client) return { success: 0, failed: 0 };

    const results = await Promise.allSettled(
      transactions.map(t => this.createTransaction(userId, t))
    );

    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return { success, failed };
  }
}

let defaultSupabaseService = new SupabaseServiceImpl();

export class SupabaseService {
  static configure(options: SupabaseServiceOptions = {}) {
    defaultSupabaseService = new SupabaseServiceImpl(options);
  }

  private static get service(): SupabaseServiceImpl {
    return defaultSupabaseService;
  }

  static getUserProfile(clerkUserId: string) {
    return this.service.getUserProfile(clerkUserId);
  }

  static getAccounts(userId: string) {
    return this.service.getAccounts(userId);
  }

  static createAccount(userId: string, account: Partial<Account>) {
    return this.service.createAccount(userId, account);
  }

  static updateAccount(accountId: string, updates: Partial<Account>) {
    return this.service.updateAccount(accountId, updates);
  }

  static deleteAccount(accountId: string) {
    return this.service.deleteAccount(accountId);
  }

  static getTransactions(userId: string, limit?: number) {
    return this.service.getTransactions(userId, limit);
  }

  static createTransaction(userId: string, transaction: Partial<Transaction>) {
    return this.service.createTransaction(userId, transaction);
  }

  static updateTransaction(transactionId: string, updates: Partial<Transaction>) {
    return this.service.updateTransaction(transactionId, updates);
  }

  static deleteTransaction(transactionId: string) {
    return this.service.deleteTransaction(transactionId);
  }

  static getBudgets(userId: string) {
    return this.service.getBudgets(userId);
  }

  static createBudget(userId: string, budget: Partial<Budget>) {
    return this.service.createBudget(userId, budget);
  }

  static getGoals(userId: string) {
    return this.service.getGoals(userId);
  }

  static createGoal(userId: string, goal: Partial<Goal>) {
    return this.service.createGoal(userId, goal);
  }

  static subscribeToAccounts(
    userId: string,
    callback: (payload: RealtimePostgresChangesPayload<Account>) => void
  ) {
    return this.service.subscribeToAccounts(userId, callback);
  }

  static subscribeToTransactions(
    userId: string,
    callback: (payload: RealtimePostgresChangesPayload<Transaction>) => void
  ) {
    return this.service.subscribeToTransactions(userId, callback);
  }

  static importTransactions(userId: string, transactions: Partial<Transaction>[]) {
    return this.service.importTransactions(userId, transactions);
  }
}

export const createSupabaseService = (options: SupabaseServiceOptions = {}) =>
  new SupabaseServiceImpl(options);
