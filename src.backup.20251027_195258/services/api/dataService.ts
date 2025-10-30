/**
 * Unified Data Service Layer
 * This service provides a single interface for all data operations
 * and handles the switch between Supabase (cloud) and localStorage (fallback)
 */

import { AccountService } from './accountService';
import { TransactionService } from './transactionService';
import * as CategoryService from './categoryService';
import * as BudgetService from './budgetService';
import * as GoalService from './goalService';
import { isSupabaseConfigured } from '@wealthtracker/core';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import type { Account, Transaction, Budget, Goal, Category, Investment } from '../../types';
import { logger } from '../loggingService';

const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

const generateId = (prefix: string): string => {
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const toDate = (value: Date | string | number | null | undefined, fallback = new Date()): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
};

const toOptionalDate = (value: Date | string | number | null | undefined): Date | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const ACCOUNT_TYPES: ReadonlySet<Account['type']> = new Set([
  'current',
  'savings',
  'credit',
  'loan',
  'investment',
  'asset',
  'mortgage',
  'assets',
  'other',
  'checking',
]);

const TRANSACTION_TYPES: ReadonlySet<Transaction['type']> = new Set(['income', 'expense', 'transfer']);
const BUDGET_PERIODS: ReadonlySet<Budget['period']> = new Set(['monthly', 'weekly', 'yearly', 'custom']);
const GOAL_TYPES: ReadonlySet<Goal['type']> = new Set(['savings', 'debt-payoff', 'investment', 'custom']);
const CATEGORY_TYPES: ReadonlySet<Category['type']> = new Set(['income', 'expense', 'both']);
const CATEGORY_LEVELS: ReadonlySet<Category['level']> = new Set(['type', 'sub', 'detail']);

const normalizeAccount = (input: Partial<Account>): Account => {
  const now = new Date();
  const type = ACCOUNT_TYPES.has(input.type as Account['type']) ? (input.type as Account['type']) : 'other';
  const lastUpdated = toDate(input.lastUpdated ?? input.updatedAt, now);

  const account: Account = {
    id: input.id ?? generateId('acct'),
    name: input.name ?? 'Account',
    type,
    balance: input.balance ?? 0,
    currency: input.currency ?? 'USD',
    lastUpdated,
    updatedAt: toOptionalDate(input.updatedAt) ?? lastUpdated,
  };

  if (input.institution !== undefined) account.institution = input.institution;
  if (input.openingBalance !== undefined) account.openingBalance = input.openingBalance;

  const openingBalanceDate = toOptionalDate(input.openingBalanceDate);
  if (openingBalanceDate) {
    account.openingBalanceDate = openingBalanceDate;
  }

  if (input.holdings !== undefined) account.holdings = input.holdings;
  if (input.notes !== undefined) account.notes = input.notes;
  if (input.isActive !== undefined) account.isActive = input.isActive;
  if (input.plaidConnectionId !== undefined) account.plaidConnectionId = input.plaidConnectionId;
  if (input.plaidAccountId !== undefined) account.plaidAccountId = input.plaidAccountId;
  if (input.mask !== undefined) account.mask = input.mask;
  if (input.sortCode !== undefined) account.sortCode = input.sortCode;
  if (input.accountNumber !== undefined) account.accountNumber = input.accountNumber;
  if (input.available !== undefined) account.available = input.available;
  if (input.tags !== undefined) account.tags = [...input.tags];

  return account;
};

const normalizeTransaction = (input: Partial<Transaction>): Transaction => {
  const now = new Date();
  const transaction: Transaction = {
    id: input.id ?? generateId('txn'),
    date: toDate(input.date, now),
    amount: input.amount ?? 0,
    description: input.description ?? 'Transaction',
    category: input.category ?? 'uncategorized',
    accountId: input.accountId ?? 'account-unknown',
    type: TRANSACTION_TYPES.has(input.type as Transaction['type']) ? (input.type as Transaction['type']) : 'expense',
  };

  if (input.categoryName !== undefined) transaction.categoryName = input.categoryName;
  if (input.tags !== undefined) transaction.tags = [...input.tags];
  if (input.notes !== undefined) transaction.notes = input.notes;
  if (input.cleared !== undefined) transaction.cleared = input.cleared;
  if (input.reconciledWith !== undefined) transaction.reconciledWith = input.reconciledWith;
  if (input.reconciledNotes !== undefined) transaction.reconciledNotes = input.reconciledNotes;
  if (input.bankReference !== undefined) transaction.bankReference = input.bankReference;
  if (input.isRecurring !== undefined) transaction.isRecurring = input.isRecurring;
  if (input.isSplit !== undefined) transaction.isSplit = input.isSplit;
  if (input.isImported !== undefined) transaction.isImported = input.isImported;
  if (input.pending !== undefined) transaction.pending = input.pending;
  if (input.plaidTransactionId !== undefined) transaction.plaidTransactionId = input.plaidTransactionId;
  if (input.merchant !== undefined) transaction.merchant = input.merchant;
  if (input.paymentChannel !== undefined) transaction.paymentChannel = input.paymentChannel;
  if (input.goalId !== undefined) transaction.goalId = input.goalId;
  if (input.accountName !== undefined) transaction.accountName = input.accountName;
  if (input.recurringTransactionId !== undefined) transaction.recurringTransactionId = input.recurringTransactionId;
  if (input.addedBy !== undefined) transaction.addedBy = input.addedBy;
  if (input.linkedTransferId !== undefined) transaction.linkedTransferId = input.linkedTransferId;

  const reconciledDate = toOptionalDate(input.reconciledDate);
  if (reconciledDate) {
    transaction.reconciledDate = reconciledDate;
  }

  if (input.location) {
    transaction.location = {
      city: input.location.city ?? null,
      region: input.location.region ?? null,
      country: input.location.country ?? null,
    };
  }

  if (input.transferMetadata) {
    transaction.transferMetadata = { ...input.transferMetadata };
  }

  if (input.investmentData) {
    transaction.investmentData = { ...input.investmentData };
  }

  return transaction;
};

const normalizeBudget = (input: Partial<Budget>): Budget => {
  const now = new Date();
  const budget: Budget = {
    id: input.id ?? generateId('budget'),
    categoryId: input.categoryId ?? 'uncategorized',
    amount: input.amount ?? 0,
    period: BUDGET_PERIODS.has(input.period as Budget['period']) ? (input.period as Budget['period']) : 'monthly',
    isActive: input.isActive ?? true,
    createdAt: toDate(input.createdAt, now),
    spent: input.spent ?? 0,
    updatedAt: toDate(input.updatedAt, now),
  };

  if (input.name !== undefined) budget.name = input.name;
  if (input.color !== undefined) budget.color = input.color;
  if (input.budgeted !== undefined) budget.budgeted = input.budgeted;
  if (input.limit !== undefined) budget.limit = input.limit;
  if (input.startDate !== undefined) budget.startDate = input.startDate;
  if (input.endDate !== undefined) budget.endDate = input.endDate;
  if (input.rollover !== undefined) budget.rollover = input.rollover;
  if (input.rolloverAmount !== undefined) budget.rolloverAmount = input.rolloverAmount;
  if (input.alertThreshold !== undefined) budget.alertThreshold = input.alertThreshold;
  if (input.notes !== undefined) budget.notes = input.notes;

  return budget;
};

const normalizeGoal = (input: Partial<Goal>): Goal => {
  const now = new Date();
  const targetAmount = input.targetAmount ?? 0;
  const currentAmount = input.currentAmount ?? 0;
  const targetDate = toDate(input.targetDate, now);
  const progress = input.progress ?? (targetAmount === 0 ? 0 : (currentAmount / targetAmount) * 100);

  const goal: Goal = {
    id: input.id ?? generateId('goal'),
    name: input.name ?? 'Goal',
    type: GOAL_TYPES.has(input.type as Goal['type']) ? (input.type as Goal['type']) : 'savings',
    targetAmount,
    currentAmount,
    targetDate,
    isActive: input.isActive ?? true,
    createdAt: toDate(input.createdAt, now),
    progress,
    updatedAt: toDate(input.updatedAt, now),
  };

  if (input.description !== undefined) goal.description = input.description;
  if (input.linkedAccountIds !== undefined) goal.linkedAccountIds = [...input.linkedAccountIds];
  if (input.achieved !== undefined) goal.achieved = input.achieved;
  if (input.category !== undefined) goal.category = input.category;
  if (input.priority !== undefined) goal.priority = input.priority;
  if (input.status !== undefined) goal.status = input.status;
  if (input.accountId !== undefined) goal.accountId = input.accountId;
  if (input.autoContribute !== undefined) goal.autoContribute = input.autoContribute;
  if (input.contributionAmount !== undefined) goal.contributionAmount = input.contributionAmount;
  if (input.contributionFrequency !== undefined) goal.contributionFrequency = input.contributionFrequency;
  if (input.icon !== undefined) goal.icon = input.icon;
  if (input.color !== undefined) goal.color = input.color;
  if (input.completedAt !== undefined) goal.completedAt = input.completedAt;

  return goal;
};

const normalizeCategoryEntity = (input: Partial<Category>): Category => {
  const category: Category = {
    id: input.id ?? generateId('cat'),
    name: input.name ?? 'Category',
    type: CATEGORY_TYPES.has(input.type as Category['type']) ? (input.type as Category['type']) : 'expense',
    level: CATEGORY_LEVELS.has(input.level as Category['level']) ? (input.level as Category['level']) : 'detail',
    isActive: input.isActive ?? true,
  };

  if (input.parentId !== undefined) category.parentId = input.parentId ?? null;
  if (input.color !== undefined) category.color = input.color;
  if (input.icon !== undefined) category.icon = input.icon;
  if (input.isSystem !== undefined) category.isSystem = input.isSystem;
  if (input.description !== undefined) category.description = input.description;
  if (input.isTransferCategory !== undefined) category.isTransferCategory = input.isTransferCategory;
  if (input.accountId !== undefined) category.accountId = input.accountId;

  return category;
};

export interface AppData {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
  investments: Investment[];
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
        logger.info('[DataService] Initializing for Clerk ID', { clerkId });
        // Delegate to userIdService for user creation and ID management
        const databaseId = await userIdService.ensureUserExists(clerkId, email, firstName, lastName);
        if (databaseId) {
          logger.info('[DataService] User initialized with database ID', { databaseId });
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
        categories,
        investments: []
      };
    } catch (error) {
      logger.error('Error loading app data:', error);
      // Return empty data on error
      return {
        accounts: [],
        transactions: [],
        budgets: [],
        goals: [],
        categories: [],
        investments: []
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
    return (stored || []).map(normalizeAccount);
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
    const timestamp = new Date();
    const newAccount = normalizeAccount({
      ...account,
      id: generateId('acct'),
      lastUpdated: account.lastUpdated ?? timestamp,
      updatedAt: account.updatedAt ?? timestamp,
    });
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
    const existing = accounts[index];
    if (!existing) {
      throw new Error('Account not found');
    }
    const merged = normalizeAccount({
      ...existing,
      ...updates,
      id,
      lastUpdated: updates.lastUpdated ?? existing.lastUpdated,
      updatedAt: updates.updatedAt ?? new Date(),
    });
    accounts[index] = merged;
    await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
    return merged;
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
    return (stored || []).map(normalizeTransaction);
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
    const newTransaction = normalizeTransaction({
      ...transaction,
      id: generateId('txn'),
    });
    const transactions = await this.getTransactions();
    transactions.push(newTransaction);
    await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, transactions);

    // Update account balance
    await this.updateAccountBalance(newTransaction.accountId, newTransaction.amount);

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

    const existing = transactions[index];
    if (!existing) {
      throw new Error('Transaction not found');
    }
    const merged = normalizeTransaction({
      ...existing,
      ...updates,
      id,
    });

    transactions[index] = merged;
    await storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, transactions);

    if (existing.accountId !== merged.accountId) {
      await this.updateAccountBalance(existing.accountId, -existing.amount);
      await this.updateAccountBalance(merged.accountId, merged.amount);
    } else if (merged.amount !== existing.amount) {
      await this.updateAccountBalance(merged.accountId, merged.amount - existing.amount);
    }

    return merged;
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
    return (stored || []).map(normalizeBudget);
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
    return (stored || []).map(normalizeGoal);
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
    const timestamp = new Date();
    const newBudget = normalizeBudget({
      ...budget,
      id: generateId('budget'),
      spent: budget.spent ?? 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
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

    const existing = budgets[index];
    if (!existing) {
      throw new Error('Budget not found');
    }

    const merged = normalizeBudget({
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    });

    budgets[index] = merged;
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, budgets);
    return merged;
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
    const timestamp = new Date();
    const newGoal = normalizeGoal({
      ...goal,
      id: generateId('goal'),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
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

    const existing = goals[index];
    if (!existing) {
      throw new Error('Goal not found');
    }

    const merged = normalizeGoal({
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    });

    goals[index] = merged;
    await storageAdapter.set(STORAGE_KEYS.GOALS, goals);
    return merged;
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
    return (stored || []).map(normalizeCategoryEntity);
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
    const index = accounts.findIndex(a => a.id === accountId);
    if (index === -1) {
      return;
    }

    const account = accounts[index];
    if (!account) {
      return;
    }

    const updated = normalizeAccount({
      ...account,
      balance: (account.balance ?? 0) + amount,
      lastUpdated: new Date(),
      updatedAt: new Date(),
    });

    accounts[index] = updated;
    await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
  }

  /**
   * Subscribe to real-time updates
   */
  static subscribeToUpdates(callbacks: {
    onAccountUpdate?: (payload: unknown) => void;
    onTransactionUpdate?: (payload: unknown) => void;
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
    return {
      clerkId: userIdService.getCurrentClerkId(),
      databaseId: userIdService.getCurrentDatabaseUserId(),
    };
  }

  /**
   * Force reload all data (useful after sync)
   */
  static async refreshData(): Promise<AppData> {
    return this.loadAppData();
  }
}
