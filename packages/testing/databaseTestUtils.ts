import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { logger } from '@/services/loggingService';
import { getSupabaseTestClient } from './supabaseClient';

const pickOne = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const randomNumber = (min: number, max: number, precision = 2): number =>
  Number((min + Math.random() * (max - min)).toFixed(precision));
const randomRecentIso = () => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * 7));
  return date.toISOString();
};
const randomFutureIso = () => {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * 30) + 1);
  return date.toISOString();
};
const randomColor = () => {
  const value = Math.floor(Math.random() * 0xffffff);
  return `#${value.toString(16).padStart(6, '0')}`;
};

export const testDb = getSupabaseTestClient();

export const TEST_USER_ID = `test-user-${Date.now()}`;
export const TEST_USER_EMAIL = `test-${Date.now()}@test.com`;

type TrackedRecord = { table: string; id: string };

export class DatabaseTestHelpers {
  private readonly db: SupabaseClient;
  private createdRecords: TrackedRecord[] = [];

  constructor(db: SupabaseClient = testDb) {
    this.db = db;
  }

  private trackRecord(table: string, id: string) {
    this.createdRecords.push({ table, id });
  }

  async createTestUser(overrides: Record<string, unknown> = {}) {
    const payload = {
      id: randomUUID(),
      clerk_id: `clerk_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      email: `test-${randomUUID()}@example.com`,
      name: pickOne(['Alex Johnson', 'Taylor Morgan', 'Jordan Smith', 'Casey Rivera']),
      created_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db.from('users').insert(payload).select().single();
    if (error) throw error;

    this.trackRecord('users', data.id);
    return data;
  }

  async createTestAccount(userId: string, overrides: Record<string, unknown> = {}) {
    const payload = {
      id: randomUUID(),
      user_id: userId,
      name: `${pickOne(['Primary', 'Everyday', 'Family', 'Future'])} Account`,
      type: pickOne(['checking', 'savings', 'credit', 'investment'] as const),
      balance: randomNumber(0, 10000),
      currency: 'USD',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db.from('accounts').insert(payload).select().single();
    if (error) throw error;

    this.trackRecord('accounts', data.id);
    return data;
  }

  async createTestTransaction(accountId: string, overrides: Record<string, unknown> = {}) {
    const payload = {
      id: randomUUID(),
      account_id: accountId,
      amount: randomNumber(-1000, 1000),
      description: pickOne(['Grocery Run', 'Utility Bill', 'Salary Payment', 'Subscription']),
      date: randomRecentIso(),
      type: pickOne(['income', 'expense', 'transfer'] as const),
      category: pickOne(['food', 'transport', 'entertainment', 'salary']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db.from('transactions').insert(payload).select().single();
    if (error) throw error;

    this.trackRecord('transactions', data.id);
    return data;
  }

  async createTestCategory(overrides: Record<string, unknown> = {}) {
    const payload = {
      id: randomUUID(),
      name: pickOne(['Food', 'Transport', 'Utilities', 'Leisure']),
      type: pickOne(['income', 'expense'] as const),
      icon: pickOne(['💼', '🛒', '🚗', '🍔']),
      color: randomColor(),
      created_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db.from('categories').insert(payload).select().single();
    if (error) throw error;

    this.trackRecord('categories', data.id);
    return data;
  }

  async createTestBudget(userId: string, categoryId: string, overrides: Record<string, unknown> = {}) {
    const payload = {
      id: randomUUID(),
      user_id: userId,
      category_id: categoryId,
      name: `${pickOne(['Household', 'Travel', 'Savings', 'Growth'])} Budget`,
      amount: randomNumber(100, 2000),
      period: pickOne(['monthly', 'weekly', 'yearly'] as const),
      start_date: randomRecentIso(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db.from('budgets').insert(payload).select().single();
    if (error) throw error;

    this.trackRecord('budgets', data.id);
    return data;
  }

  async createTestGoal(userId: string, overrides: Record<string, unknown> = {}) {
    const payload = {
      id: randomUUID(),
      user_id: userId,
      name: `${pickOne(['Emergency', 'Retirement', 'Education', 'Freedom'])} Goal`,
      target_amount: randomNumber(1000, 50000),
      current_amount: randomNumber(0, 5000),
      target_date: randomFutureIso(),
      priority: pickOne(['low', 'medium', 'high'] as const),
      status: 'active' as const,
      auto_contribute: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db.from('goals').insert(payload).select().single();
    if (error) throw error;

    this.trackRecord('goals', data.id);
    return data;
  }

  async cleanup() {
    const order = [
      'notifications',
      'recurring_transactions',
      'goals',
      'budgets',
      'transactions',
      'accounts',
      'categories',
      'users',
    ];

    for (const table of order) {
      const ids = this.createdRecords.filter((record) => record.table === table).map((record) => record.id);
      if (ids.length === 0) continue;

      const { error } = await this.db.from(table).delete().in('id', ids);
      if (error) logger.error(`Failed to clean up ${table}:`, error);
    }

    this.createdRecords = [];
  }

  async verifyRecordExists(table: string, id: string) {
    const { data, error } = await this.db.from(table).select('id').eq('id', id).single();
    return !error && data !== null;
  }

  async getRealData(table: string, id: string) {
    const { data, error } = await this.db.from(table).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }
}

export async function withTestTransaction<T>(
  testFn: (helpers: DatabaseTestHelpers) => Promise<T>,
): Promise<T> {
  const helpers = new DatabaseTestHelpers();
  try {
    return await testFn(helpers);
  } finally {
    await helpers.cleanup();
  }
}

export async function seedTestDatabase() {
  const helpers = new DatabaseTestHelpers();

  const user = await helpers.createTestUser({ email: TEST_USER_EMAIL, name: 'Test User' });
  const checkingAccount = await helpers.createTestAccount(user.id, { name: 'Test Checking', type: 'checking', balance: 5000 });
  const savingsAccount = await helpers.createTestAccount(user.id, { name: 'Test Savings', type: 'savings', balance: 10000 });

  const foodCategory = await helpers.createTestCategory({ name: 'Food', type: 'expense' });
  const salaryCategory = await helpers.createTestCategory({ name: 'Salary', type: 'income' });

  await helpers.createTestTransaction(checkingAccount.id, {
    amount: -50,
    description: 'Grocery Store',
    type: 'expense',
    category: foodCategory.id,
  });

  await helpers.createTestTransaction(checkingAccount.id, {
    amount: 3000,
    description: 'Monthly Salary',
    type: 'income',
    category: salaryCategory.id,
  });

  await helpers.createTestBudget(user.id, foodCategory.id, { amount: 500, period: 'monthly' });
  await helpers.createTestGoal(user.id, { name: 'Emergency Fund', target_amount: 15000, current_amount: 5000 });

  return {
    user,
    accounts: [checkingAccount, savingsAccount],
    categories: [foodCategory, salaryCategory],
    helpers,
  };
}
