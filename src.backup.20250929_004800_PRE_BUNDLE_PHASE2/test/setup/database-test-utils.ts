/**
 * REAL Database Test Utilities
 * Uses ACTUAL Supabase test database, not mocks!
 * 
 * PRINCIPLE: Test the REAL system, not fake mocks
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import { logger } from '../../services/loggingService';

// Get test database credentials from environment
const TEST_SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const TEST_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!TEST_SUPABASE_URL || !TEST_SUPABASE_ANON_KEY) {
  throw new Error(
    'Test database not configured! Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.test'
  );
}

// Create REAL Supabase client for tests
export const testDb = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);

// Test user for all tests (we'll create this user once)
export const TEST_USER_ID = 'test-user-' + Date.now();
export const TEST_USER_EMAIL = `test-${Date.now()}@test.com`;

/**
 * Database Test Helpers - Work with REAL data
 */
export class DatabaseTestHelpers {
  private db: SupabaseClient;
  private createdRecords: Array<{ table: string; id: string }> = [];

  constructor(db: SupabaseClient = testDb) {
    this.db = db;
  }

  /**
   * Create a REAL user in the database
   */
  async createTestUser(overrides = {}) {
    const userData = {
      id: faker.string.uuid(),
      clerk_id: `clerk_${faker.string.alphanumeric(24)}`,
      email: faker.internet.email(),
      name: faker.person.fullName(),
      created_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    
    this.trackRecord('users', data.id);
    return data;
  }

  /**
   * Create a REAL account in the database
   */
  async createTestAccount(userId: string, overrides = {}) {
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
      ...overrides,
    };

    const { data, error } = await this.db
      .from('accounts')
      .insert(accountData)
      .select()
      .single();

    if (error) throw error;
    
    this.trackRecord('accounts', data.id);
    return data;
  }

  /**
   * Create a REAL transaction in the database
   */
  async createTestTransaction(accountId: string, overrides = {}) {
    const transactionData = {
      id: faker.string.uuid(),
      account_id: accountId,
      amount: faker.number.float({ min: -1000, max: 1000, precision: 0.01 }),
      description: faker.commerce.productName(),
      date: faker.date.recent().toISOString(),
      type: faker.helpers.arrayElement(['income', 'expense', 'transfer']),
      category: faker.helpers.arrayElement(['food', 'transport', 'entertainment', 'salary']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error) throw error;
    
    this.trackRecord('transactions', data.id);
    return data;
  }

  /**
   * Create a REAL category in the database
   */
  async createTestCategory(overrides = {}) {
    const categoryData = {
      id: faker.string.uuid(),
      name: faker.commerce.department(),
      type: faker.helpers.arrayElement(['income', 'expense']),
      level: faker.helpers.arrayElement(['type', 'sub', 'detail']),
      parent_id: null,
      icon: faker.helpers.arrayElement(['🍔', '🚗', '🎮', '💰']),
      color: faker.color.rgb(),
      created_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db
      .from('categories')
      .insert(categoryData)
      .select()
      .single();

    if (error) throw error;
    
    this.trackRecord('categories', data.id);
    return data;
  }

  /**
   * Create a REAL budget in the database
   */
  async createTestBudget(userId: string, categoryId: string, overrides = {}) {
    const budgetData = {
      id: faker.string.uuid(),
      user_id: userId,
      category_id: categoryId,
      amount: faker.number.float({ min: 100, max: 2000, precision: 0.01 }),
      period: faker.helpers.arrayElement(['monthly', 'weekly', 'yearly']),
      start_date: faker.date.recent().toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db
      .from('budgets')
      .insert(budgetData)
      .select()
      .single();

    if (error) throw error;
    
    this.trackRecord('budgets', data.id);
    return data;
  }

  /**
   * Create a REAL goal in the database
   */
  async createTestGoal(userId: string, overrides = {}) {
    const goalData = {
      id: faker.string.uuid(),
      user_id: userId,
      name: faker.lorem.words(3),
      type: faker.helpers.arrayElement(['savings', 'debt', 'investment']),
      target_amount: faker.number.float({ min: 1000, max: 50000, precision: 0.01 }),
      current_amount: faker.number.float({ min: 0, max: 5000, precision: 0.01 }),
      target_date: faker.date.future().toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    const { data, error } = await this.db
      .from('goals')
      .insert(goalData)
      .select()
      .single();

    if (error) throw error;
    
    this.trackRecord('goals', data.id);
    return data;
  }

  /**
   * Track created records for cleanup
   */
  private trackRecord(table: string, id: string) {
    this.createdRecords.push({ table, id });
  }

  /**
   * Clean up ALL test data created during tests
   * CRITICAL: Always call this in afterEach()
   */
  async cleanup() {
    // Delete in reverse order to handle foreign key constraints
    const tables = ['goals', 'budgets', 'transactions', 'accounts', 'categories', 'users'];
    
    for (const table of tables) {
      const recordsToDelete = this.createdRecords
        .filter(r => r.table === table)
        .map(r => r.id);
      
      if (recordsToDelete.length > 0) {
        const { error } = await this.db
          .from(table)
          .delete()
          .in('id', recordsToDelete);
        
        if (error) {
          logger.error(`Failed to clean up ${table}:`, error);
        }
      }
    }
    
    this.createdRecords = [];
  }

  /**
   * Verify data actually exists in the database
   */
  async verifyRecordExists(table: string, id: string) {
    const { data, error } = await this.db
      .from(table)
      .select('id')
      .eq('id', id)
      .single();
    
    return !error && data !== null;
  }

  /**
   * Get REAL data from the database
   */
  async getRealData(table: string, id: string) {
    const { data, error } = await this.db
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }
}

/**
 * Test Transaction - ensures all database operations in a test are rolled back
 * NOTE: Supabase doesn't support transactions in the same way as traditional DBs,
 * so we track and manually clean up instead
 */
export async function withTestTransaction<T>(
  testFn: (helpers: DatabaseTestHelpers) => Promise<T>
): Promise<T> {
  const helpers = new DatabaseTestHelpers();
  
  try {
    return await testFn(helpers);
  } finally {
    // ALWAYS clean up test data
    await helpers.cleanup();
  }
}

/**
 * Seed test database with realistic data
 */
export async function seedTestDatabase() {
  const helpers = new DatabaseTestHelpers();
  
  // Create test user
  const user = await helpers.createTestUser({
    email: TEST_USER_EMAIL,
    name: 'Test User',
  });
  
  // Create multiple accounts
  const checkingAccount = await helpers.createTestAccount(user.id, {
    name: 'Test Checking',
    type: 'checking',
    balance: 5000,
  });
  
  const savingsAccount = await helpers.createTestAccount(user.id, {
    name: 'Test Savings',
    type: 'savings',
    balance: 10000,
  });
  
  // Create categories
  const foodCategory = await helpers.createTestCategory({
    name: 'Food',
    type: 'expense',
  });
  
  const salaryCategory = await helpers.createTestCategory({
    name: 'Salary',
    type: 'income',
  });
  
  // Create transactions
  await helpers.createTestTransaction(checkingAccount.id, {
    amount: -50.00,
    description: 'Grocery Store',
    type: 'expense',
    category: foodCategory.id,
  });
  
  await helpers.createTestTransaction(checkingAccount.id, {
    amount: 3000.00,
    description: 'Monthly Salary',
    type: 'income',
    category: salaryCategory.id,
  });
  
  // Create budget
  await helpers.createTestBudget(user.id, foodCategory.id, {
    amount: 500,
    period: 'monthly',
  });
  
  // Create goal
  await helpers.createTestGoal(user.id, {
    name: 'Emergency Fund',
    target_amount: 15000,
    current_amount: 5000,
  });
  
  return {
    user,
    accounts: [checkingAccount, savingsAccount],
    categories: [foodCategory, salaryCategory],
    helpers, // Return helpers so test can clean up
  };
}