/**
 * Test Database Connection Test
 * Verifies that REAL database tests can connect and operate
 */

import { it, expect } from 'vitest';
import { describeSupabase, testDb, withRealDatabase } from './setup/real-test-framework';

describeSupabase('Database Connection - REAL TESTS', () => {
  it('can connect to test database', async () => {
    // Simple connection test
    const { data, error } = await testDb.from('users').select('id').limit(1);
    
    // Should not have an error
    expect(error).toBeNull();
    // Data should be an array (even if empty)
    expect(Array.isArray(data)).toBe(true);
  });

  it('can create and retrieve REAL data', async () => {
    await withRealDatabase(async (db) => {
      // Create a user
      const user = await db.createUser({
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      });
      
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      
      // Verify it's really in the database
      const { data } = await testDb
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      expect(data).toBeDefined();
      expect(data.email).toBe('test@example.com');
    });
  });

  it('can create complete test scenario', async () => {
    await withRealDatabase(async (db) => {
      // Create complete scenario
      const scenario = await db.setupCompleteTestScenario();
      
      // Verify all parts were created
      expect(scenario.user).toBeDefined();
      expect(scenario.accounts).toHaveLength(2);
      expect(scenario.categories.all).toHaveLength(9); // 2 types + 3 subs + 4 details
      expect(scenario.transactions).toHaveLength(2);
      expect(scenario.budget).toBeDefined();
      expect(scenario.goal).toBeDefined();
      
      // Verify data is in database
      const { data: users } = await testDb.from('users').select('*').eq('id', scenario.user.id);
      expect(users).toHaveLength(1);
      
      const { data: accounts } = await testDb.from('accounts').select('*').eq('user_id', scenario.user.id);
      expect(accounts).toHaveLength(2);
    });
  });

  it('cleans up test data properly', async () => {
    let userId: string;
    
    // Create data inside withRealDatabase
    await withRealDatabase(async (db) => {
      const user = await db.createUser();
      userId = user.id;
      
      // Verify it exists
      const exists = await db.verifyExists('users', userId);
      expect(exists).toBe(true);
    });
    
    // After withRealDatabase, data should be cleaned up
    const { data } = await testDb.from('users').select('*').eq('id', userId!);
    expect(data).toHaveLength(0);
  });
});