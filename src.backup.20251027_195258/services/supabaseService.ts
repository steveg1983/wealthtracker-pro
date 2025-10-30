import { supabase } from '@wealthtracker/core';
import type { Account, Budget, Goal, Transaction } from '../types';
import { logger } from './loggingService';
import { AccountService } from './api/accountService';
import { TransactionService } from './api/transactionService';
import {
  getBudgets as fetchBudgets,
  createBudget as createBudgetRecord,
  updateBudget as updateBudgetRecord,
  deleteBudget as deleteBudgetRecord
} from './api/budgetService';
import {
  getGoals as fetchGoals,
  createGoal as createGoalRecord,
  updateGoal as updateGoalRecord,
  deleteGoal as deleteGoalRecord
} from './api/goalService';
import { userIdService } from './userIdService';

type AccountCreateInput = Parameters<(typeof AccountService)['createAccount']>[1];
type AccountUpdateInput = Parameters<(typeof AccountService)['updateAccount']>[1];
type TransactionCreateInput = Parameters<(typeof TransactionService)['createTransaction']>[1];
type TransactionUpdateInput = Parameters<(typeof TransactionService)['updateTransaction']>[1];
type BudgetCreateInput = Parameters<typeof createBudgetRecord>[1];
type GoalCreateInput = Parameters<typeof createGoalRecord>[1];

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
  static async getAccounts(userId: string): Promise<Account[]> {
    return AccountService.getAccounts(userId);
  }

  static async createAccount(userId: string, account: AccountCreateInput): Promise<Account | null> {
    try {
      return await AccountService.createAccount(userId, account);
    } catch (error) {
      logger.error('Error creating account:', error);
      return null;
    }
  }

  static async updateAccount(accountId: string, updates: AccountUpdateInput): Promise<Account | null> {
    try {
      return await AccountService.updateAccount(accountId, updates);
    } catch (error) {
      logger.error('Error updating account:', error);
      return null;
    }
  }

  static async deleteAccount(accountId: string): Promise<boolean> {
    try {
      await AccountService.deleteAccount(accountId);
      return true;
    } catch (error) {
      logger.error('Error deleting account:', error);
      return false;
    }
  }

  /**
   * Transactions Management
   */
  static async getTransactions(userId: string, limit = 100): Promise<Transaction[]> {
    const transactions = await TransactionService.getTransactions(userId);
    return transactions.slice(0, limit);
  }

  static async createTransaction(
    userId: string,
    transaction: TransactionCreateInput
  ): Promise<Transaction | null> {
    try {
      return await TransactionService.createTransaction(userId, transaction);
    } catch (error) {
      logger.error('Error creating transaction:', error);
      return null;
    }
  }

  static async updateTransaction(
    transactionId: string,
    updates: TransactionUpdateInput
  ): Promise<Transaction | null> {
    try {
      return await TransactionService.updateTransaction(transactionId, updates);
    } catch (error) {
      logger.error('Error updating transaction:', error);
      return null;
    }
  }

  static async deleteTransaction(transactionId: string): Promise<boolean> {
    try {
      await TransactionService.deleteTransaction(transactionId);
      return true;
    } catch (error) {
      logger.error('Error deleting transaction:', error);
      return false;
    }
  }

  /**
   * Budgets Management
   */
  static async getBudgets(userId: string): Promise<Budget[]> {
    const clerkId = await userIdService.getClerkUserId(userId);
    if (!clerkId) {
      logger.warn('Unable to resolve Clerk ID while fetching budgets', { userId });
      return [];
    }
    return fetchBudgets(clerkId);
  }

  static async createBudget(
    userId: string,
    budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Budget | null> {
    const clerkId = await userIdService.getClerkUserId(userId);
    if (!clerkId) {
      logger.warn('Unable to resolve Clerk ID while creating budget', { userId });
      return null;
    }
    try {
      const { spent: _spent, ...rest } = budget as typeof budget & { spent?: number };
      return await createBudgetRecord(clerkId, rest as BudgetCreateInput);
    } catch (error) {
      logger.error('Error creating budget:', error);
      return null;
    }
  }

  static async updateBudget(budgetId: string, updates: Partial<Budget>): Promise<Budget | null> {
    try {
      return await updateBudgetRecord(budgetId, updates);
    } catch (error) {
      logger.error('Error updating budget:', error);
      return null;
    }
  }

  static async deleteBudget(budgetId: string): Promise<boolean> {
    try {
      await deleteBudgetRecord(budgetId);
      return true;
    } catch (error) {
      logger.error('Error deleting budget:', error);
      return false;
    }
  }

  /**
   * Goals Management
   */
  static async getGoals(userId: string): Promise<Goal[]> {
    const clerkId = await userIdService.getClerkUserId(userId);
    if (!clerkId) {
      logger.warn('Unable to resolve Clerk ID while fetching goals', { userId });
      return [];
    }
    return fetchGoals(clerkId);
  }

  static async createGoal(
    userId: string,
    goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Goal | null> {
    const clerkId = await userIdService.getClerkUserId(userId);
    if (!clerkId) {
      logger.warn('Unable to resolve Clerk ID while creating goal', { userId });
      return null;
    }
    try {
      const { progress: _progress, ...rest } = goal as typeof goal & { progress?: number };
      return await createGoalRecord(clerkId, rest as GoalCreateInput);
    } catch (error) {
      logger.error('Error creating goal:', error);
      return null;
    }
  }

  static async updateGoal(goalId: string, updates: Partial<Goal>): Promise<Goal | null> {
    try {
      return await updateGoalRecord(goalId, updates);
    } catch (error) {
      logger.error('Error updating goal:', error);
      return null;
    }
  }

  static async deleteGoal(goalId: string): Promise<boolean> {
    try {
      await deleteGoalRecord(goalId);
      return true;
    } catch (error) {
      logger.error('Error deleting goal:', error);
      return false;
    }
  }
}
