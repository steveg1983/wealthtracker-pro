/**
 * Unified Data Service Layer
 * This service provides a single interface for all data operations
 * and handles the switch between Supabase (cloud) and localStorage (fallback)
 */

import { UserService } from './userService';
import { AccountService } from './accountService';
import { TransactionService } from './transactionService';
import * as CategoryService from './categoryService';
import * as BudgetService from './budgetService';
import * as GoalService from './goalService';
import { isSupabaseConfigured } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import type { Account, Transaction, Budget, Goal, Category } from '../../types';
import { logger } from '../loggingService';

export interface AppData {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
}

export class DataService {
  // Removed local storage of IDs - now using centralized userIdService

  /**
   * Initialize the data service with user credentials
   * Now delegates ID management to userIdService
   */
  static async initialize(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        console.log('[DataService] Initializing for Clerk ID:', clerkId);
        // Delegate to userIdService for user creation and ID management
        const databaseId = await userIdService.ensureUserExists(clerkId, email, firstName, lastName);
        if (databaseId) {
          console.log('[DataService] User initialized with database ID:', databaseId);
        } else {
          logger.warn('[DataService] No database ID returned from userIdService');
        }
      } catch (error) {
        logger.error('[DataService] Failed to initialize user:', error);
        // Continue with localStorage fallback
      }
    }
  }

  /**
   * Load all app data
   * NOTE: This should only be called AFTER userIdService has been initialized
   */
  static async loadAppData(): Promise<AppData> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (!userId && isSupabaseConfigured()) {
      logger.warn('[DataService] No database ID available, using localStorage fallback');
    }

    try {
      // Load data from Supabase or localStorage
      const [accounts, transactions, budgets, goals, categories] = await Promise.all([
        this.getAccounts(),
        this.getTransactions(),
        this.getBudgets(),
        this.getGoals(),
        this.getCategories()
      ]);

      return {
        accounts,
        transactions,
        budgets,
        goals,
        categories
      };
    } catch (error) {
      logger.error('Error loading app data:', error);
      // Return empty data on error
      return {
        accounts: [],
        transactions: [],
        budgets: [],
        goals: [],
        categories: []
      };
    }
  }

  /**
   * Get all accounts
   */
  static async getAccounts(): Promise<Account[]> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (userId && isSupabaseConfigured()) {
      return AccountService.getAccounts(userId);
    }
    // Fallback to localStorage
    const stored = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
    return stored || [];
  }

  /**
   * Create account
   */
  static async createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (userId && isSupabaseConfigured()) {
      return AccountService.createAccount(userId, account);
    }
    // Fallback to localStorage
    const newAccount = {
      ...account,
      id: crypto.randomUUID()
    };
    const accounts = await this.getAccounts();
    accounts.push(newAccount);
    await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
    return newAccount;
  }

  /**
   * Update account
   */
  static async updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (userId && isSupabaseConfigured()) {
      return AccountService.updateAccount(id, updates);
    }
    // Fallback to localStorage
    const accounts = await this.getAccounts();
    const index = accounts.findIndex(a => a.id === id);
    if (index === -1) throw new Error('Account not found');
    accounts[index] = { ...accounts[index], ...updates };
    await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
    return accounts[index];
  }

  /**
   * Delete account
   */
  static async deleteAccount(id: string): Promise<void> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (userId && isSupabaseConfigured()) {
      return AccountService.deleteAccount(id);
    }
    // Fallback to localStorage
    const accounts = await this.getAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, filtered);
  }

  /**
   * Get all transactions
   */
  static async getTransactions(): Promise<Transaction[]> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (userId && isSupabaseConfigured()) {
      return TransactionService.getTransactions(userId);
    }
    // Fallback to localStorage
    const stored = await storageAdapter.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
    return stored || [];
  }

  /**
   * Create transaction
   */
  static async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (userId && isSupabaseConfigured()) {
      return TransactionService.createTransaction(userId, transaction);
    }
    // Fallback to localStorage
    const newTransaction = {
      ...transaction,
      id: crypto.randomUUID()
    };
    const transactions = await this.getTransactions();
    transactions.push(newTransaction);
    await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, transactions);
    
    // Update account balance
    await this.updateAccountBalance(transaction.accountId, transaction.amount);
    
    return newTransaction;
  }

  /**
   * Update transaction
   */
  static async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (userId && isSupabaseConfigured()) {
      return TransactionService.updateTransaction(id, updates);
    }
    // Fallback to localStorage
    const transactions = await this.getTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Transaction not found');
    
    const oldAmount = transactions[index].amount;
    const oldAccountId = transactions[index].accountId;
    
    transactions[index] = { ...transactions[index], ...updates };
    await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, transactions);
    
    // Update account balances
    if (updates.amount !== undefined && updates.amount !== oldAmount) {
      await this.updateAccountBalance(oldAccountId, -oldAmount + updates.amount);
    }
    
    return transactions[index];
  }

  /**
   * Delete transaction
   */
  static async deleteTransaction(id: string): Promise<void> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (userId && isSupabaseConfigured()) {
      return TransactionService.deleteTransaction(id);
    }
    // Fallback to localStorage
    const transactions = await this.getTransactions();
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      await this.updateAccountBalance(transaction.accountId, -transaction.amount);
    }
    const filtered = transactions.filter(t => t.id !== id);
    await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, filtered);
  }

  /**
   * Get budgets
   */
  static async getBudgets(): Promise<Budget[]> {
    const clerkId = userIdService.getCurrentClerkId();
    if (clerkId && isSupabaseConfigured()) {
      try {
        return await BudgetService.getBudgets(clerkId);
      } catch (error) {
        logger.error('[DataService] Error loading budgets from Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const stored = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS);
    return stored || [];
  }

  /**
   * Get goals
   */
  static async getGoals(): Promise<Goal[]> {
    const clerkId = userIdService.getCurrentClerkId();
    if (clerkId && isSupabaseConfigured()) {
      try {
        return await GoalService.getGoals(clerkId);
      } catch (error) {
        logger.error('[DataService] Error loading goals from Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const stored = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS);
    return stored || [];
  }

  /**
   * Create budget
   */
  static async createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
    const clerkId = userIdService.getCurrentClerkId();
    if (clerkId && isSupabaseConfigured()) {
      try {
        return await BudgetService.createBudget(clerkId, budget);
      } catch (error) {
        logger.error('[DataService] Error creating budget in Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const newBudget: Budget = {
      ...budget,
      id: crypto.randomUUID(),
      spent: budget.spent || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const budgets = await this.getBudgets();
    budgets.push(newBudget);
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, budgets);
    return newBudget;
  }

  /**
   * Update budget
   */
  static async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    const clerkId = userIdService.getCurrentClerkId();
    if (clerkId && isSupabaseConfigured()) {
      try {
        return await BudgetService.updateBudget(id, updates);
      } catch (error) {
        logger.error('[DataService] Error updating budget in Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const budgets = await this.getBudgets();
    const index = budgets.findIndex(b => b.id === id);
    if (index === -1) throw new Error('Budget not found');
    
    budgets[index] = { 
      ...budgets[index], 
      ...updates,
      updatedAt: new Date()
    };
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, budgets);
    return budgets[index];
  }

  /**
   * Delete budget
   */
  static async deleteBudget(id: string): Promise<void> {
    const clerkId = userIdService.getCurrentClerkId();
    if (clerkId && isSupabaseConfigured()) {
      try {
        return await BudgetService.deleteBudget(id);
      } catch (error) {
        logger.error('[DataService] Error deleting budget from Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const budgets = await this.getBudgets();
    const filtered = budgets.filter(b => b.id !== id);
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, filtered);
  }

  /**
   * Create goal
   */
  static async createGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'progress'>): Promise<Goal> {
    const clerkId = userIdService.getCurrentClerkId();
    if (clerkId && isSupabaseConfigured()) {
      try {
        return await GoalService.createGoal(clerkId, goal);
      } catch (error) {
        logger.error('[DataService] Error creating goal in Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const newGoal: Goal = {
      ...goal,
      id: crypto.randomUUID(),
      progress: (goal.currentAmount / goal.targetAmount) * 100,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const goals = await this.getGoals();
    goals.push(newGoal);
    await storageAdapter.set(STORAGE_KEYS.GOALS, goals);
    return newGoal;
  }

  /**
   * Update goal
   */
  static async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
    const clerkId = userIdService.getCurrentClerkId();
    if (clerkId && isSupabaseConfigured()) {
      try {
        return await GoalService.updateGoal(id, updates);
      } catch (error) {
        logger.error('[DataService] Error updating goal in Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const goals = await this.getGoals();
    const index = goals.findIndex(g => g.id === id);
    if (index === -1) throw new Error('Goal not found');
    
    const updatedGoal = { 
      ...goals[index], 
      ...updates,
      updatedAt: new Date()
    };
    
    // Recalculate progress if amounts changed
    if (updates.currentAmount !== undefined || updates.targetAmount !== undefined) {
      updatedGoal.progress = (updatedGoal.currentAmount / updatedGoal.targetAmount) * 100;
    }
    
    goals[index] = updatedGoal;
    await storageAdapter.set(STORAGE_KEYS.GOALS, goals);
    return goals[index];
  }

  /**
   * Delete goal
   */
  static async deleteGoal(id: string): Promise<void> {
    const clerkId = userIdService.getCurrentClerkId();
    if (clerkId && isSupabaseConfigured()) {
      try {
        return await GoalService.deleteGoal(id);
      } catch (error) {
        logger.error('[DataService] Error deleting goal from Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const goals = await this.getGoals();
    const filtered = goals.filter(g => g.id !== id);
    await storageAdapter.set(STORAGE_KEYS.GOALS, filtered);
  }

  /**
   * Get categories
   */
  static async getCategories(): Promise<Category[]> {
    const clerkId = userIdService.getCurrentClerkId();
    if (clerkId && isSupabaseConfigured()) {
      try {
        return await CategoryService.getCategories(clerkId);
      } catch (error) {
        logger.error('[DataService] Error loading categories from Supabase:', error);
      }
    }
    
    // Fallback to localStorage
    const stored = await storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES);
    return stored || [];
  }

  /**
   * Helper to update account balance (localStorage only)
   */
  private static async updateAccountBalance(accountId: string, amount: number): Promise<void> {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (userId && isSupabaseConfigured()) {
      // Supabase handles this automatically
      return;
    }
    
    const accounts = await this.getAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      account.balance = (account.balance || 0) + amount;
      await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
    }
  }

  /**
   * Subscribe to real-time updates
   */
  static subscribeToUpdates(callbacks: {
    onAccountUpdate?: (payload: any) => void;
    onTransactionUpdate?: (payload: any) => void;
  }): () => void {
    const userId = userIdService.getCurrentDatabaseUserId();
    if (!userId || !isSupabaseConfigured()) {
      return () => {}; // No-op for localStorage
    }

    const unsubscribers: (() => void)[] = [];

    if (callbacks.onAccountUpdate) {
      unsubscribers.push(
        AccountService.subscribeToAccounts(userId, callbacks.onAccountUpdate)
      );
    }

    if (callbacks.onTransactionUpdate) {
      unsubscribers.push(
        TransactionService.subscribeToTransactions(userId, callbacks.onTransactionUpdate)
      );
    }

    // Return function to unsubscribe all
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  /**
   * Check if using Supabase or localStorage
   */
  static isUsingSupabase(): boolean {
    const userId = userIdService.getCurrentDatabaseUserId();
    return userId !== null && isSupabaseConfigured();
  }

  /**
   * Get current user IDs for debugging
   */
  static getUserIds(): { clerkId: string | null; databaseId: string | null } {
    // Delegate to userIdService for current user IDs
    return userIdService.getCurrentUserIds();
  }

  /**
   * Force reload all data (useful after sync)
   */
  static async refreshData(): Promise<AppData> {
    return this.loadAppData();
  }
}