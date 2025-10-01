/**
 * Account Service REAL Test
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 * 
 * This test uses REAL Supabase database connections, not mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { AccountService } from '../api/accountService';

// Use real Supabase test instance
const TEST_SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const TEST_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Create real Supabase client for test cleanup
const testSupabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);

// Test data - using valid UUID for user_id
const TEST_USER_ID = '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0').slice(-12);
const createdAccountIds: string[] = [];

describe('AccountService - REAL Database Tests', () => {
  beforeEach(async () => {
    // Ensure we have a clean state
    createdAccountIds.length = 0;
    
    // Create a test user first (required by foreign key constraint)
    const { error: userError } = await testSupabase
      .from('users')
      .upsert({
        id: TEST_USER_ID,
        clerk_id: 'test_clerk_' + Date.now(),
        email: `test${Date.now()}@test.com`,
        created_at: new Date().toISOString(),
      });
    
    if (userError) {
      console.error('Failed to create test user:', userError);
    }
  });

  afterEach(async () => {
    // Clean up any accounts created during tests
    if (createdAccountIds.length > 0) {
      const { error } = await testSupabase
        .from('accounts')
        .delete()
        .in('id', createdAccountIds);
      
      if (error) {
        console.error('Cleanup error:', error);
      }
    }
    
    // Clean up test user
    await testSupabase
      .from('users')
      .delete()
      .eq('id', TEST_USER_ID);
  });

  describe('createAccount - REAL', () => {
    it('should create a real account in the database', async () => {
      // Arrange
      const accountData = {
        name: 'Real Test Checking Account',
        type: 'checking' as const,
        balance: 1000.00,
        currency: 'USD',
        institution: 'Real Test Bank',
        isActive: true,
      };

      // Act - Create real account
      const result = await AccountService.createAccount(TEST_USER_ID, accountData);

      // Assert
      expect(result).toBeDefined();
      expect(result?.name).toBe('Real Test Checking Account');
      expect(result?.type).toBe('checking');
      expect(result?.balance).toBe(1000);
      expect(result?.id).toBeDefined();

      if (result?.id) {
        createdAccountIds.push(result.id);
        
        // Verify it actually exists in the database
        const { data: verifyData } = await testSupabase
          .from('accounts')
          .select('*')
          .eq('id', result.id)
          .single();
        
        expect(verifyData).toBeDefined();
        expect(verifyData?.name).toBe('Real Test Checking Account');
      }
    });

    it('should handle real database constraints', async () => {
      // Arrange - Create first account
      const accountData = {
        name: 'Unique Account Name ' + Date.now(),
        type: 'savings' as const,
        balance: 5000.00,
        currency: 'USD',
        isActive: true,
      };

      // Act - Create account
      const firstAccount = await AccountService.createAccount(TEST_USER_ID, accountData);
      if (firstAccount?.id) {
        createdAccountIds.push(firstAccount.id);
      }

      // Try to create with invalid type (should be caught by DB constraint)
      const invalidAccount = {
        name: 'Invalid Type Account',
        type: 'invalid_type' as any,
        balance: 100.00,
        currency: 'USD',
      };

      // Should throw error due to constraint violation
      await expect(
        AccountService.createAccount(TEST_USER_ID, invalidAccount)
      ).rejects.toThrow('accounts_type_check');
    });
  });

  describe('getAccounts - REAL', () => {
    it('should retrieve real accounts from database', async () => {
      // Arrange - Create multiple real accounts
      const accounts = [
        {
          name: 'Real Checking ' + Date.now(),
          type: 'checking' as const,
          balance: 1000.00,
          currency: 'USD',
        },
        {
          name: 'Real Savings ' + Date.now(),
          type: 'savings' as const,
          balance: 5000.00,
          currency: 'USD',
        },
      ];

      // Create accounts
      for (const account of accounts) {
        const created = await AccountService.createAccount(TEST_USER_ID, account);
        if (created?.id) {
          createdAccountIds.push(created.id);
        }
      }

      // Act - Retrieve accounts
      const retrievedAccounts = await AccountService.getAccounts(TEST_USER_ID);

      // Assert
      expect(Array.isArray(retrievedAccounts)).toBe(true);
      expect(retrievedAccounts.length).toBeGreaterThanOrEqual(2);
      
      // Verify our test accounts are in the results
      const testAccounts = retrievedAccounts.filter(acc => 
        createdAccountIds.includes(acc.id)
      );
      expect(testAccounts.length).toBe(2);
    });
  });

  describe('updateAccount - REAL', () => {
    it('should update a real account in the database', async () => {
      // Arrange - Create a real account
      const originalAccount = await AccountService.createAccount(TEST_USER_ID, {
        name: 'Original Name',
        type: 'checking' as const,
        balance: 1000.00,
        currency: 'USD',
      });

      if (!originalAccount?.id) {
        throw new Error('Failed to create test account');
      }
      createdAccountIds.push(originalAccount.id);

      // Act - Update the real account
      const updated = await AccountService.updateAccount(originalAccount.id, {
        name: 'Updated Name',
        balance: 2000.00,
      });

      // Assert - updateAccount returns the updated Account
      expect(updated).toBeDefined();
      expect(updated.name).toBe('Updated Name');
      expect(updated.balance).toBe(2000);

      // Verify the update in the database
      const { data: verifyData } = await testSupabase
        .from('accounts')
        .select('*')
        .eq('id', originalAccount.id)
        .single();

      expect(verifyData?.name).toBe('Updated Name');
      expect(parseFloat(verifyData?.balance)).toBe(2000);
    });
  });

  describe('deleteAccount - REAL', () => {
    it('should soft delete a real account', async () => {
      // Arrange - Create a real account
      const account = await AccountService.createAccount(TEST_USER_ID, {
        name: 'Account to Delete',
        type: 'credit' as const,
        balance: -500.00,
        currency: 'USD',
      });

      if (!account?.id) {
        throw new Error('Failed to create test account');
      }
      // Don't add to cleanup array since we're deleting it

      // Act - Delete the account (returns void)
      await AccountService.deleteAccount(account.id);

      // Verify it's soft deleted (is_active = false)
      const { data: verifyData } = await testSupabase
        .from('accounts')
        .select('*')
        .eq('id', account.id)
        .single();

      expect(verifyData?.is_active).toBe(false);
      
      // Clean up the soft-deleted account
      await testSupabase
        .from('accounts')
        .delete()
        .eq('id', account.id);
    });
  });

  describe('Real Database Transactions', () => {
    it('should handle concurrent operations correctly', async () => {
      // This tests that our real database handles race conditions
      const promises = [];
      
      // Create 5 accounts concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          AccountService.createAccount(TEST_USER_ID, {
            name: `Concurrent Account ${i}`,
            type: 'checking' as const,
            balance: 1000 + i * 100,
            currency: 'USD',
          })
        );
      }

      // Act - Execute all concurrently
      const results = await Promise.all(promises);

      // Assert - All should succeed
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result?.name).toBe(`Concurrent Account ${index}`);
        if (result?.id) {
          createdAccountIds.push(result.id);
        }
      });

      // Verify all exist in database
      const { data: allAccounts } = await testSupabase
        .from('accounts')
        .select('*')
        .in('id', createdAccountIds);

      expect(allAccounts?.length).toBe(5);
    });
  });
});

/**
 * Test Data Factory for Real Database Tests
 * This is a helper class for creating and cleaning up test data
 */
export class TestDataFactory {
  private createdIds = {
    accounts: [] as string[],
    transactions: [] as string[],
    categories: [] as string[],
    budgets: [] as string[],
  };

  async createTestAccount(overrides = {}) {
    const account = await AccountService.createAccount(TEST_USER_ID, {
      name: 'Test Account ' + Date.now(),
      type: 'checking' as const,
      balance: 1000.00,
      currency: 'USD',
      ...overrides,
    });

    if (account?.id) {
      this.createdIds.accounts.push(account.id);
    }
    return account;
  }

  async cleanup() {
    // Clean up all created test data
    for (const [table, ids] of Object.entries(this.createdIds)) {
      if (ids.length > 0) {
        await testSupabase
          .from(table)
          .delete()
          .in('id', ids);
      }
    }
  }
}