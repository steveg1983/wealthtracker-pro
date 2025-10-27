import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database } from '@app-types/supabase';
import { logger } from '@/services/loggingService';
import { shouldRunSupabaseRealTests } from './supabaseRealTest';

const randomString = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const pickOne = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

const randomAmount = (min: number, max: number, precision = 2) =>
  Number((min + Math.random() * (max - min)).toFixed(precision));

const randomRecentIso = () => {
  const days = Math.floor(Math.random() * 14);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const randomFutureIso = () => {
  const days = Math.floor(Math.random() * 365) + 30;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const randomColor = () => {
  const value = Math.floor(Math.random() * 0xffffff);
  return `#${value.toString(16).padStart(6, '0')}`;
};

const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'investment'] as const;
const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
const CATEGORY_TYPES = ['income', 'expense'] as const;
const CATEGORY_LEVELS = ['type', 'sub', 'detail'] as const;
const PRIORITY_LEVELS = ['low', 'medium', 'high'] as const;
const FREQUENCIES = ['monthly', 'weekly', 'yearly'] as const;
const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const;

const TEST_SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const TEST_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

let testDbInstance: SupabaseClient | null = null;

const ensureCredentials = () => {
  if (!TEST_SUPABASE_URL || !TEST_SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase test database not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.test (or provide credentials via RUN_SUPABASE_REAL_TESTS).',
    );
  }
};

const createTestClient = (): SupabaseClient => {
  ensureCredentials();
  return createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });
};

const getActiveClient = (): SupabaseClient => {
  if (!shouldRunSupabaseRealTests) {
    throw new Error(
      'Supabase real tests are disabled. Enable by setting RUN_SUPABASE_REAL_TESTS=true and providing credentials.',
    );
  }
  if (!testDbInstance) {
    testDbInstance = createTestClient();
  }
  return testDbInstance;
};

const disabledClient = new Proxy(
  {},
  {
    get() {
      throw new Error(
        'Supabase real tests are disabled. Set RUN_SUPABASE_REAL_TESTS=true and provide credentials before accessing the test database client.',
      );
    },
  },
) as SupabaseClient<Database>;

export const testDb: SupabaseClient<Database> = shouldRunSupabaseRealTests
  ? (getActiveClient() as SupabaseClient<Database>)
  : disabledClient;

type CleanupItem = { table: TableName; id: string };
type TableName = keyof Database['public']['Tables'];

export class RealTestDatabase {
  private readonly db: SupabaseClient<Database>;
  private cleanupQueue: CleanupItem[] = [];

  constructor(db: SupabaseClient<Database> = testDb) {
    if (!shouldRunSupabaseRealTests) {
      throw new Error(
        'RealTestDatabase cannot be constructed while RUN_SUPABASE_REAL_TESTS is disabled.',
      );
    }
    this.db = db;
  }

  async createUser(data: Record<string, unknown> = {}) {
    const userData = {
      id: randomUUID(),
      clerk_id: randomString('clerk_test'),
      email: `${randomString('user')}@example.com`,
      first_name: pickOne(['Alex', 'Sam', 'Jordan', 'Taylor']),
      last_name: pickOne(['Lee', 'Morgan', 'Casey', 'Reyes']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };

    const { data: user, error } = await this.db.from('users').insert(userData).select().single();

    if (error) throw new Error(`Failed to create user: ${error.message}`);
    this.cleanupQueue.push({ table: 'users', id: user.id });
    return user;
  }

  async createAccount(userId: string, data: Record<string, unknown> = {}) {
    const accountData = {
      id: randomUUID(),
      user_id: userId,
      name: `${pickOne(['Primary', 'Family', 'Everyday', 'Savings'])} Account`,
      type: pickOne(ACCOUNT_TYPES),
      balance: randomAmount(0, 10000),
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

  async createTransaction(userId: string, accountId: string, data: Record<string, unknown> = {}) {
    const transactionData = {
      id: randomUUID(),
      user_id: userId,
      account_id: accountId,
      amount: randomAmount(-1000, 1000),
      description: pickOne(['Grocery Shopping', 'Utility Bill', 'Salary Payment', 'Subscription']),
      date: randomRecentIso(),
      type: pickOne(TRANSACTION_TYPES),
      category: pickOne(['food', 'transport', 'entertainment', 'salary']),
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

  async createCategory(userId: string, data: Record<string, unknown> = {}) {
    const categoryData = {
      id: randomUUID(),
      user_id: userId,
      name: pickOne(['Food', 'Transport', 'Utilities', 'Leisure', 'Salary']),
      type: pickOne(CATEGORY_TYPES),
      level: pickOne(CATEGORY_LEVELS),
      parent_id: null,
      icon: pickOne(['🍔', '🚗', '🎮', '💰']),
      color: randomColor(),
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

  async createBudget(userId: string, categoryId: string, data: Record<string, unknown> = {}) {
    const budgetData = {
      id: randomUUID(),
      user_id: userId,
      category_id: categoryId,
      name: `${pickOne(['Household', 'Groceries', 'Travel', 'Health'])} Budget`,
      amount: randomAmount(100, 2000),
      period: pickOne(FREQUENCIES),
      start_date: randomRecentIso(),
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

  async createGoal(userId: string, data: Record<string, unknown> = {}) {
    const goalData = {
      id: randomUUID(),
      user_id: userId,
      name: `${pickOne(['Emergency', 'Vacation', 'Home', 'Education'])} Fund`,
      description: 'Automated test goal',
      target_amount: randomAmount(1000, 50000),
      current_amount: randomAmount(0, 5000),
      target_date: randomFutureIso(),
      priority: pickOne(PRIORITY_LEVELS),
      status: 'active' as const,
      auto_contribute: false,
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

  async createNotification(userId: string, data: Record<string, unknown> = {}) {
    const notificationData = {
      id: randomUUID(),
      user_id: userId,
      title: pickOne(['Budget Reminder', 'Goal Update', 'System Notice']),
      message: 'This is an automated notification generated for integration tests.',
      type: pickOne(NOTIFICATION_TYPES),
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

  async verifyExists(table: TableName, id: string) {
    const { data, error } = await this.db.from(table).select('id').eq('id', id).single();
    if (error) throw new Error(`Failed to verify ${table}: ${error.message}`);
    return Boolean(data);
  }

  async getRecord(table: TableName, id: string) {
    const { data, error } = await this.db.from(table).select('*').eq('id', id).single();
    if (error) throw new Error(`Failed to get ${table} record: ${error.message}`);
    return data;
  }

  async cleanup() {
    const tableOrder: TableName[] = [
      'notifications',
      'recurring_templates',
      'goals',
      'budgets',
      'transactions',
      'accounts',
      'categories',
      'users',
    ];

    for (const table of tableOrder) {
      const idsToDelete = this.cleanupQueue.filter((item) => item.table === table).map((item) => item.id);
      if (idsToDelete.length === 0) continue;

      const { error } = await this.db.from(table).delete().in('id', idsToDelete);
      if (error) logger.error(`Failed to clean up ${table}:`, error);
    }

    this.cleanupQueue = [];
  }

  async setupMinimalTest() {
    const user = await this.createUser({ email: 'test@example.com', first_name: 'Test', last_name: 'User' });
    const account = await this.createAccount(user.id, { name: 'Test Account', type: 'checking', balance: 1000 });
    return { user, account };
  }

  async setupCompleteTestScenario() {
    const user = await this.createUser({
      email: 'complete-test@example.com',
      first_name: 'Complete',
      last_name: 'Test User',
    });

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
      name: 'Checking Account',
      type: 'checking',
      balance: 3000,
    });

    const savingsAccount = await this.createAccount(user.id, {
      name: 'Savings Account',
      type: 'savings',
      balance: 12000,
    });

    const expense = await this.createTransaction(user.id, checkingAccount.id, {
      amount: -150,
      description: 'Grocery Shopping',
      category: groceriesCategory.id,
    });

    const income = await this.createTransaction(user.id, checkingAccount.id, {
      amount: 5000,
      description: 'Salary Deposit',
      category: salaryCategory.id,
    });

    const budget = await this.createBudget(user.id, groceriesCategory.id, {
      name: 'Groceries Budget',
      amount: 600,
    });

    const goal = await this.createGoal(user.id, {
      name: 'Emergency Fund',
      target_amount: 15000,
      current_amount: 5000,
    });

    return {
      user,
      accounts: [checkingAccount, savingsAccount],
      categories: {
        expenseType,
        incomeType,
        dailyExpensesSub,
        transportSub,
        salariesSub,
        foodCategory,
        groceriesCategory,
        transportationCategory,
        salaryCategory,
        all: [
          expenseType,
          incomeType,
          dailyExpensesSub,
          transportSub,
          salariesSub,
          foodCategory,
          groceriesCategory,
          transportationCategory,
          salaryCategory,
        ],
      },
      transactions: [expense, income],
      budget,
      goal,
    };
  }
}

export async function withRealDatabase<T>(testFn: (db: RealTestDatabase) => Promise<T>): Promise<T> {
  const db = new RealTestDatabase();
  try {
    return await testFn(db);
  } finally {
    await db.cleanup();
  }
}
