#!/usr/bin/env tsx
/**
 * Test Data Seeding Script
 * Seeds test databases with realistic data for testing
 * Following CLAUDE.md principle: "Real tests, not mocks"
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment
config({ path: resolve(__dirname, '../.env.test.local') });

interface TestDatabase {
  name: 'unit' | 'integration' | 'e2e';
  url: string;
  anonKey: string;
}

// Test databases configuration
const testDatabases: TestDatabase[] = [
  {
    name: 'unit',
    url: process.env.VITE_TEST_SUPABASE_UNIT_URL!,
    anonKey: process.env.VITE_TEST_SUPABASE_UNIT_ANON_KEY!,
  },
  {
    name: 'integration',
    url: process.env.VITE_TEST_SUPABASE_INTEGRATION_URL!,
    anonKey: process.env.VITE_TEST_SUPABASE_INTEGRATION_ANON_KEY!,
  },
  {
    name: 'e2e',
    url: process.env.VITE_TEST_SUPABASE_E2E_URL!,
    anonKey: process.env.VITE_TEST_SUPABASE_E2E_ANON_KEY!,
  },
];

// Test users (must match Clerk test users)
const testUsers = [
  {
    id: 'test-user-1',
    email: 'test@wealthtracker.test',
    role: 'user',
  },
  {
    id: 'test-admin-1',
    email: 'admin@wealthtracker.test',
    role: 'admin',
  },
];

// Test accounts data
const testAccounts = [
  {
    name: 'Test Checking',
    type: 'checking',
    balance: '5000.00',
    currency: 'USD',
    institution: 'Test Bank',
  },
  {
    name: 'Test Savings',
    type: 'savings',
    balance: '10000.00',
    currency: 'USD',
    institution: 'Test Bank',
  },
  {
    name: 'Test Credit Card',
    type: 'credit',
    balance: '-1500.00',
    currency: 'USD',
    institution: 'Test Card Co',
    credit_limit: '5000.00',
  },
  {
    name: 'Test Investment',
    type: 'investment',
    balance: '25000.00',
    currency: 'USD',
    institution: 'Test Broker',
  },
];

// Test categories
const testCategories = [
  { name: 'Groceries', type: 'expense', color: '#10B981' },
  { name: 'Transportation', type: 'expense', color: '#3B82F6' },
  { name: 'Entertainment', type: 'expense', color: '#8B5CF6' },
  { name: 'Utilities', type: 'expense', color: '#F59E0B' },
  { name: 'Salary', type: 'income', color: '#059669' },
  { name: 'Investment Returns', type: 'income', color: '#7C3AED' },
];

// Test transactions (last 90 days)
function generateTestTransactions(accountId: string, userId: string) {
  const transactions = [];
  const now = new Date();
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Add 1-3 transactions per day
    const numTransactions = Math.floor(Math.random() * 3) + 1;
    
    for (let j = 0; j < numTransactions; j++) {
      const isExpense = Math.random() > 0.2; // 80% expenses, 20% income
      const category = isExpense 
        ? testCategories.filter(c => c.type === 'expense')[Math.floor(Math.random() * 4)]
        : testCategories.filter(c => c.type === 'income')[Math.floor(Math.random() * 2)];
      
      transactions.push({
        account_id: accountId,
        user_id: userId,
        date: date.toISOString().split('T')[0],
        description: `Test ${category.name} Transaction`,
        amount: isExpense 
          ? -(Math.random() * 200 + 10).toFixed(2)
          : (Math.random() * 1000 + 100).toFixed(2),
        category: category.name,
        type: category.type,
        status: 'completed',
      });
    }
  }
  
  return transactions;
}

// Test budgets
const testBudgets = [
  {
    name: 'Monthly Budget',
    amount: '3000.00',
    period: 'monthly',
    categories: ['Groceries', 'Transportation', 'Entertainment', 'Utilities'],
  },
];

async function seedDatabase(db: TestDatabase) {
  console.log(`\n🌱 Seeding ${db.name} test database...`);
  
  const supabase = createClient(db.url, db.anonKey);
  
  try {
    // Clear existing data
    if (process.env.TEST_DATA_CLEANUP === 'true') {
      console.log('  Clearing existing data...');
      await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('budgets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    
    // Seed users
    console.log('  Creating test users...');
    for (const user of testUsers) {
      const { error } = await supabase.from('users').upsert({
        clerk_id: user.id,
        email: user.email,
        created_at: new Date().toISOString(),
      });
      if (error) console.error(`    Error creating user ${user.email}:`, error.message);
    }
    
    // Seed categories
    console.log('  Creating categories...');
    for (const category of testCategories) {
      const { error } = await supabase.from('categories').upsert({
        ...category,
        user_id: testUsers[0].id,
      });
      if (error) console.error(`    Error creating category ${category.name}:`, error.message);
    }
    
    // Seed accounts for each user
    if (process.env.TEST_SEED_ACCOUNTS === 'true') {
      console.log('  Creating test accounts...');
      for (const user of testUsers) {
        for (const account of testAccounts) {
          const { data, error } = await supabase.from('accounts').insert({
            ...account,
            user_id: user.id,
            created_at: new Date().toISOString(),
          }).select().single();
          
          if (error) {
            console.error(`    Error creating account ${account.name}:`, error.message);
          } else if (data && process.env.TEST_SEED_TRANSACTIONS === 'true') {
            // Generate transactions for this account
            const transactions = generateTestTransactions(data.id, user.id);
            const { error: txError } = await supabase.from('transactions').insert(transactions);
            if (txError) console.error(`    Error creating transactions:`, txError.message);
          }
        }
      }
    }
    
    // Seed budgets
    if (process.env.TEST_SEED_BUDGETS === 'true') {
      console.log('  Creating test budgets...');
      for (const user of testUsers) {
        for (const budget of testBudgets) {
          const { error } = await supabase.from('budgets').insert({
            ...budget,
            user_id: user.id,
            created_at: new Date().toISOString(),
          });
          if (error) console.error(`    Error creating budget ${budget.name}:`, error.message);
        }
      }
    }
    
    console.log(`✅ ${db.name} database seeded successfully!`);
    
  } catch (error) {
    console.error(`❌ Error seeding ${db.name} database:`, error);
  }
}

async function main() {
  console.log('🚀 WealthTracker Test Data Seeder');
  console.log('================================');
  console.log('Following principle: "Real tests, not mocks"');
  
  // Verify environment
  const missingVars = [];
  for (const db of testDatabases) {
    if (!db.url || db.url === 'undefined') {
      missingVars.push(`VITE_TEST_SUPABASE_${db.name.toUpperCase()}_URL`);
    }
    if (!db.anonKey || db.anonKey === 'undefined') {
      missingVars.push(`VITE_TEST_SUPABASE_${db.name.toUpperCase()}_ANON_KEY`);
    }
  }
  
  if (missingVars.length > 0) {
    console.error('\n❌ Missing environment variables:');
    missingVars.forEach(v => console.error(`  - ${v}`));
    console.error('\nPlease create .env.test.local from .env.test.example and fill in the values.');
    process.exit(1);
  }
  
  // Seed all databases
  for (const db of testDatabases) {
    await seedDatabase(db);
  }
  
  console.log('\n✨ All test databases seeded successfully!');
  console.log('You can now run tests with real data.');
}

// Run the seeder
main().catch(console.error);