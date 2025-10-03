/**
 * REAL Test Framework
 * Complete testing utilities for REAL database testing
 * NO MOCKS - Only real database operations
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '../../contexts/AppContextSupabase';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { BudgetProvider } from '../../contexts/BudgetContext';
import { GoalProvider } from '../../contexts/GoalContext';
import { CategoryProvider } from '../../contexts/CategoryContext';
import { AccountProvider } from '../../contexts/AccountContext';
import { TransactionProvider } from '../../contexts/TransactionContext';
import { logger } from '../../services/loggingService';

// Test database client - use singleton to avoid multiple instances
const TEST_SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const TEST_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!TEST_SUPABASE_URL || !TEST_SUPABASE_ANON_KEY) {
  logger.warn('Test database not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.test');
}

// Singleton instance to prevent "Multiple GoTrueClient instances" warning
let testDbInstance: SupabaseClient | null = null;

// Suppress the GoTrueClient warning in test environment
if (typeof global !== 'undefined' && global.console) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    // Suppress the specific Supabase warning about multiple instances
    const firstArg = args[0];
    if (typeof firstArg === 'string' && firstArg.includes('Multiple GoTrueClient instances detected')) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

export const testDb = (() => {
  if (!testDbInstance) {
    testDbInstance = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false, // Don't persist session in tests
        autoRefreshToken: false, // Don't auto-refresh in tests
        detectSessionInUrl: false, // Don't detect session in URL in tests
        storage: {
          // Use a custom storage that doesn't conflict
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      }
    });
  }
  return testDbInstance;
})();

/**
 * Real Database Operations for ALL entities
 */
export class RealTestDatabase {
  private db: SupabaseClient;
  private cleanupQueue: Array<{ table: string; id: string }> = [];
  
  constructor(db: SupabaseClient = testDb) {
    this.db = db;
  }

  // ============ SEED DEFAULT DATA ============
  async seedDefaultCategories(userId: string) {
    // This seeds the standard category hierarchy that the app expects
    const categories = [];
    
    // Create type-level categories
    const expenseType = await this.createCategory(userId, {
      name: 'Expense',
      type: 'expense',
      level: 'type',
      parent_id: null,
    });
    categories.push(expenseType);
    
    const incomeType = await this.createCategory(userId, {
      name: 'Income',
      type: 'income',
      level: 'type',
      parent_id: null,
    });
    categories.push(incomeType);
    
    // Create sub-categories
    const subs = [
      { name: 'Daily Expenses', type: 'expense', parent: expenseType.id },
      { name: 'Transport', type: 'expense', parent: expenseType.id },
      { name: 'Entertainment', type: 'expense', parent: expenseType.id },
      { name: 'Salaries', type: 'income', parent: incomeType.id },
      { name: 'Investments', type: 'income', parent: incomeType.id },
    ];
    
    for (const sub of subs) {
      const category = await this.createCategory(userId, {
        name: sub.name,
        type: sub.type,
        level: 'sub',
        parent_id: sub.parent,
      });
      categories.push(category);
    }
    
    return categories;
  }

  // ============ USER OPERATIONS ============
  async createUser(data: Partial<{
    id?: string;
    clerk_id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    created_at?: string;
    updated_at?: string;
  }> = {}) {
    const userData = {
      id: faker.string.uuid(),
      clerk_id: `clerk_test_${faker.string.alphanumeric(24)}`,
      email: faker.internet.email(),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };

    const { data: user, error } = await this.db
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create user: ${error.message}`);
    this.cleanupQueue.push({ table: 'users', id: user.id });
    return user;
  }

  // ============ ACCOUNT OPERATIONS ============
  async createAccount(userId: string, data: Partial<{
    id?: string;
    user_id?: string;
    name?: string;
    type?: 'checking' | 'savings' | 'credit' | 'investment';
    balance?: number;
    currency?: string;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  }> = {}) {
    const accountData = {
      id: faker.string.uuid(),
      user_id: userId,
      name: faker.company.name() + ' Account',
      type: faker.helpers.arrayElement(['checking', 'savings', 'credit', 'investment']),
      balance: faker.number.float({ min: 0, max: 10000, precision: 0.01 }),
      currency: 'USD',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };

    const { data: account, error } = await this.db
      .from('accounts')
      .insert(accountData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create account: ${error.message}`);
    this.cleanupQueue.push({ table: 'accounts', id: account.id });
    return account;
  }

  async updateAccount(id: string, updates: Record<string, unknown>) {
    const { data, error } = await this.db
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update account: ${error.message}`);
    return data;
  }

  async deleteAccount(id: string) {
    const { error } = await this.db
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete account: ${error.message}`);
  }

  // ============ TRANSACTION OPERATIONS ============
  async createTransaction(userId: string, accountId: string, data: Partial<{
    id?: string;
    user_id?: string;
    account_id?: string;
    amount?: number;
    description?: string;
    date?: string;
    type?: 'income' | 'expense' | 'transfer';
    category?: string;
    created_at?: string;
    updated_at?: string;
  }> = {}) {
    const transactionData = {
      id: faker.string.uuid(),
      user_id: userId,
      account_id: accountId,
      amount: faker.number.float({ min: -1000, max: 1000, precision: 0.01 }),
      description: faker.commerce.productName(),
      date: faker.date.recent().toISOString(),
      type: faker.helpers.arrayElement(['income', 'expense', 'transfer']),
      category: faker.helpers.arrayElement(['food', 'transport', 'entertainment', 'salary']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };

    const { data: transaction, error } = await this.db
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create transaction: ${error.message}`);
    this.cleanupQueue.push({ table: 'transactions', id: transaction.id });
    return transaction;
  }

  async getTransactions(accountId: string) {
    const { data, error } = await this.db
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to get transactions: ${error.message}`);
    return data;
  }

  // ============ CATEGORY OPERATIONS ============
  async createCategory(userId: string, data: Partial<{
    id?: string;
    user_id?: string;
    name?: string;
    type?: 'income' | 'expense';
    level?: 'type' | 'sub' | 'detail';
    parent_id?: string | null;
    icon?: string;
    color?: string;
    created_at?: string;
  }> = {}) {
    const categoryData = {
      id: faker.string.uuid(),
      user_id: userId,
      name: faker.commerce.department(),
      type: faker.helpers.arrayElement(['income', 'expense']),
      level: faker.helpers.arrayElement(['type', 'sub', 'detail']),
      parent_id: null,
      icon: faker.helpers.arrayElement(['🍔', '🚗', '🎮', '💰']),
      color: faker.color.rgb(),
      created_at: new Date().toISOString(),
      ...data,
    };

    const { data: category, error } = await this.db
      .from('categories')
      .insert(categoryData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create category: ${error.message}`);
    this.cleanupQueue.push({ table: 'categories', id: category.id });
    return category;
  }

  async getCategories(type?: 'income' | 'expense') {
    let query = this.db.from('categories').select('*');
    if (type) query = query.eq('type', type);
    
    const { data, error } = await query;
    if (error) throw new Error(`Failed to get categories: ${error.message}`);
    return data;
  }

  // ============ BUDGET OPERATIONS ============
  async createBudget(userId: string, categoryId: string, data: Partial<{
    id?: string;
    user_id?: string;
    category_id?: string;
    name?: string;
    amount?: number;
    period?: 'monthly' | 'weekly' | 'yearly';
    start_date?: string;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  }> = {}) {
    const budgetData = {
      id: faker.string.uuid(),
      user_id: userId,
      category_id: categoryId,
      name: data.name || faker.commerce.department() + ' Budget',
      amount: faker.number.float({ min: 100, max: 2000, precision: 0.01 }),
      period: faker.helpers.arrayElement(['monthly', 'weekly', 'yearly']),
      start_date: faker.date.recent().toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };

    const { data: budget, error } = await this.db
      .from('budgets')
      .insert(budgetData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create budget: ${error.message}`);
    this.cleanupQueue.push({ table: 'budgets', id: budget.id });
    return budget;
  }

  async updateBudget(id: string, updates: Record<string, unknown>) {
    const { data, error } = await this.db
      .from('budgets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update budget: ${error.message}`);
    return data;
  }

  // ============ GOAL OPERATIONS ============
  async createGoal(userId: string, data: Partial<{
    id?: string;
    user_id?: string;
    name?: string;
    description?: string;
    target_amount?: number;
    current_amount?: number;
    target_date?: string;
    priority?: 'low' | 'medium' | 'high';
    status?: string;
    created_at?: string;
    updated_at?: string;
  }> = {}) {
    const goalData = {
      id: faker.string.uuid(),
      user_id: userId,
      name: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      target_amount: faker.number.float({ min: 1000, max: 50000, precision: 0.01 }),
      current_amount: faker.number.float({ min: 0, max: 5000, precision: 0.01 }),
      target_date: faker.date.future().toISOString(),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };

    const { data: goal, error } = await this.db
      .from('goals')
      .insert(goalData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create goal: ${error.message}`);
    this.cleanupQueue.push({ table: 'goals', id: goal.id });
    return goal;
  }

  async updateGoal(id: string, updates: Record<string, unknown>) {
    const { data, error } = await this.db
      .from('goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update goal: ${error.message}`);
    return data;
  }

  // ============ RECURRING TRANSACTION OPERATIONS ============
  async createRecurringTransaction(userId: string, data: Partial<{
    id?: string;
    user_id?: string;
    description?: string;
    amount?: number;
    frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    next_date?: string;
    is_active?: boolean;
    created_at?: string;
  }> = {}) {
    const recurringData = {
      id: faker.string.uuid(),
      user_id: userId,
      description: faker.commerce.productName(),
      amount: faker.number.float({ min: -1000, max: 1000, precision: 0.01 }),
      frequency: faker.helpers.arrayElement(['daily', 'weekly', 'monthly', 'yearly']),
      next_date: faker.date.future().toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      ...data,
    };

    const { data: recurring, error } = await this.db
      .from('recurring_transactions')
      .insert(recurringData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create recurring transaction: ${error.message}`);
    this.cleanupQueue.push({ table: 'recurring_transactions', id: recurring.id });
    return recurring;
  }

  // ============ NOTIFICATION OPERATIONS ============
  async createNotification(userId: string, data: Partial<{
    id?: string;
    user_id?: string;
    title?: string;
    message?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    is_read?: boolean;
    created_at?: string;
  }> = {}) {
    const notificationData = {
      id: faker.string.uuid(),
      user_id: userId,
      title: faker.lorem.sentence(),
      message: faker.lorem.paragraph(),
      type: faker.helpers.arrayElement(['info', 'success', 'warning', 'error']),
      is_read: false,
      created_at: new Date().toISOString(),
      ...data,
    };

    const { data: notification, error } = await this.db
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create notification: ${error.message}`);
    this.cleanupQueue.push({ table: 'notifications', id: notification.id });
    return notification;
  }

  // ============ VALIDATION & VERIFICATION ============
  async verifyExists(table: string, id: string) {
    const { data, error } = await this.db
      .from(table)
      .select('id')
      .eq('id', id)
      .single();

    return !error && data !== null;
  }

  async getRecord(table: string, id: string) {
    const { data, error } = await this.db
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get ${table} record: ${error.message}`);
    return data;
  }

  // ============ CLEANUP ============
  async cleanup() {
    // Clean up in reverse order to handle foreign key constraints
    const tableOrder = [
      'notifications',
      'recurring_transactions',
      'goals',
      'budgets',
      'transactions',
      'accounts',
      'categories',
      'users',
    ];

    for (const table of tableOrder) {
      const idsToDelete = this.cleanupQueue
        .filter(item => item.table === table)
        .map(item => item.id);

      if (idsToDelete.length > 0) {
        const { error } = await this.db
          .from(table)
          .delete()
          .in('id', idsToDelete);

        if (error) {
          logger.error(`Failed to clean up ${table}:`, error);
        }
      }
    }

    this.cleanupQueue = [];
  }

  // ============ MINIMAL TEST SETUP ============
  async setupMinimalTest() {
    // Super minimal setup - just user and one account
    const user = await this.createUser({
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
    });

    const account = await this.createAccount(user.id, {
      name: 'Test Account',
      type: 'checking',
      balance: 1000,
    });

    return { user, account };
  }

  // ============ COMPLEX TEST SCENARIOS ============
  async setupCompleteTestScenario() {
    // Create a complete test scenario with all entities
    const user = await this.createUser({
      email: 'complete-test@example.com',
      first_name: 'Complete',
      last_name: 'Test User',
    });

    // Create complete category hierarchy (like real app expects)
    // Level 1: Type categories
    const expenseType = await this.createCategory(user.id, {
      name: 'Expense',
      type: 'expense',
      level: 'type',
      parent_id: null,
    });

    const incomeType = await this.createCategory(user.id, {
      name: 'Income',
      type: 'income',
      level: 'type',
      parent_id: null,
    });

    // Level 2: Sub categories
    const dailyExpensesSub = await this.createCategory(user.id, {
      name: 'Daily Expenses',
      type: 'expense',
      level: 'sub',
      parent_id: expenseType.id,
    });

    const transportSub = await this.createCategory(user.id, {
      name: 'Transport',
      type: 'expense',
      level: 'sub',
      parent_id: expenseType.id,
    });

    const salariesSub = await this.createCategory(user.id, {
      name: 'Salaries',
      type: 'income',
      level: 'sub',
      parent_id: incomeType.id,
    });

    // Level 3: Detail categories (what BudgetModal actually uses)
    const foodCategory = await this.createCategory(user.id, {
      name: 'Food',
      type: 'expense',
      level: 'detail',
      parent_id: dailyExpensesSub.id,
    });

    const groceriesCategory = await this.createCategory(user.id, {
      name: 'Groceries',
      type: 'expense',
      level: 'detail',
      parent_id: dailyExpensesSub.id,
    });

    const transportationCategory = await this.createCategory(user.id, {
      name: 'Transportation',
      type: 'expense',
      level: 'detail',
      parent_id: transportSub.id,
    });

    const salaryCategory = await this.createCategory(user.id, {
      name: 'Salary',
      type: 'income',
      level: 'detail',
      parent_id: salariesSub.id,
    });

    const checkingAccount = await this.createAccount(user.id, {
      name: 'Test Checking',
      type: 'checking',
      balance: 5000,
    });

    const savingsAccount = await this.createAccount(user.id, {
      name: 'Test Savings',
      type: 'savings',
      balance: 10000,
    });

    // Create transactions
    const expense = await this.createTransaction(user.id, checkingAccount.id, {
      amount: -50,
      description: 'Groceries',
      type: 'expense',
      category: foodCategory.id,
    });

    const income = await this.createTransaction(user.id, checkingAccount.id, {
      amount: 3000,
      description: 'Monthly Salary',
      type: 'income',
      category: salaryCategory.id,
    });

    // Create budget
    const budget = await this.createBudget(user.id, foodCategory.id, {
      name: 'Food Budget',
      amount: 500,
      period: 'monthly',
    });

    // Create goal
    const goal = await this.createGoal(user.id, {
      name: 'Emergency Fund',
      target_amount: 15000,
      current_amount: 5000,
    });

    // Skip recurring transaction due to RLS policy
    // const recurring = await this.createRecurringTransaction(user.id, {
    //   description: 'Monthly Rent',
    //   amount: -1200,
    //   frequency: 'monthly',
    // });

    return {
      user,
      accounts: [checkingAccount, savingsAccount],
      categories: {
        // Type level
        expenseType,
        incomeType,
        // Sub level
        dailyExpensesSub,
        transportSub,
        salariesSub,
        // Detail level (used in UI)
        foodCategory,
        groceriesCategory,
        transportationCategory,
        salaryCategory,
        // All categories array
        all: [
          expenseType, incomeType,
          dailyExpensesSub, transportSub, salariesSub,
          foodCategory, groceriesCategory, transportationCategory, salaryCategory
        ]
      },
      transactions: [expense, income],
      budget,
      goal,
      // recurring,
    };
  }
}

/**
 * REAL Test Provider with all contexts
 */
interface RealTestProviderProps {
  children: React.ReactNode;
  testDb?: RealTestDatabase;
  initialData?: {
    accounts?: unknown[];
    transactions?: unknown[];
    categories?: unknown[];
    budgets?: unknown[];
    goals?: unknown[];
  };
}

export function RealTestProvider({ children, testDb, initialData }: RealTestProviderProps) {
  // Use test Clerk key
  const testClerkKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_fake';

  // Mock user for testing
  const mockUser = {
    id: 'test-clerk-id',
    primaryEmailAddress: { emailAddress: 'test@example.com' },
    fullName: 'Test User',
  };

  return (
    <BrowserRouter>
      <ClerkProvider publishableKey={testClerkKey}>
        <AppProvider>
          <ToastProvider>
            <NotificationProvider>
              <NavigationProvider>
                <PreferencesProvider>
                  <AccountProvider>
                    <CategoryProvider>
                      <TransactionProvider>
                        <BudgetProvider>
                          <GoalProvider>
                            {children}
                          </GoalProvider>
                        </BudgetProvider>
                      </TransactionProvider>
                    </CategoryProvider>
                  </AccountProvider>
                </PreferencesProvider>
              </NavigationProvider>
            </NotificationProvider>
          </ToastProvider>
        </AppProvider>
      </ClerkProvider>
    </BrowserRouter>
  );
}

/**
 * Custom render for REAL tests
 */
export function renderWithRealData(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: RealTestProvider,
    ...options,
  });
}

/**
 * Test transaction wrapper
 */
export async function withRealDatabase<T>(
  testFn: (db: RealTestDatabase) => Promise<T>
): Promise<T> {
  const db = new RealTestDatabase();
  try {
    return await testFn(db);
  } finally {
    await db.cleanup();
  }
}

// Re-export testing utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';