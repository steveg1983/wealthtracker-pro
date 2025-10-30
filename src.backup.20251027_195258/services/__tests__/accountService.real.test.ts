/**
 * Account Service REAL Test
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 * 
 * This test uses REAL Supabase database connections, not mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AccountService } from '../api/accountService';
import { supabase as appSupabase } from '@wealthtracker/core';
import { userIdService } from '../userIdService';
import { toDecimal } from '@wealthtracker/utils';
import { describeSupabase } from '@wealthtracker/testing/supabaseRealTest';

type AccountInput = Parameters<typeof AccountService.createAccount>[1];

const supabase = appSupabase;

const TEST_EMAIL = process.env.VITEST_SUPABASE_EMAIL ?? process.env.VITE_SUPABASE_TEST_EMAIL;
const TEST_PASSWORD = process.env.VITEST_SUPABASE_PASSWORD ?? process.env.VITE_SUPABASE_TEST_PASSWORD;

const createdAccountIds: string[] = [];
let authUserId: string;

const describeIfSupabase = describeSupabase;

describeIfSupabase('AccountService - REAL Database Tests', () => {
  beforeEach(async () => {
    createdAccountIds.length = 0;
    userIdService.clearCache();

    if (!TEST_EMAIL || !TEST_PASSWORD) {
      throw new Error('Set VITEST_SUPABASE_EMAIL and VITEST_SUPABASE_PASSWORD to run account real tests');
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signInError) {
      throw new Error(`Failed to sign in account test user: ${signInError.message}`);
    }

    const session = await supabase.auth.getSession();
    authUserId = signInData.user?.id ?? session.data.session?.user?.id ?? '';
    if (!authUserId) {
      throw new Error('Unable to resolve authenticated user id for account tests');
    }

    const timestamp = new Date().toISOString();

    await supabase
      .from('users')
      .upsert({
        id: authUserId,
        clerk_id: authUserId,
        email: TEST_EMAIL,
        first_name: null,
        last_name: null,
        created_at: timestamp,
        updated_at: timestamp,
      });

    await supabase
      .from('user_id_mappings')
      .upsert({
        clerk_id: authUserId,
        database_user_id: authUserId,
        created_at: timestamp,
      });

    userIdService.setCurrentUser(authUserId, authUserId);
  });

  afterEach(async () => {
    if (createdAccountIds.length > 0) {
      await supabase
        .from('accounts')
        .delete()
        .in('id', createdAccountIds);
    }

    await supabase.auth.signOut();
    userIdService.clearCache();
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
      const result = await AccountService.createAccount(authUserId, accountData);

      // Assert
      expect(result).toBeDefined();
      expect(result?.name).toBe('Real Test Checking Account');
      expect(result?.type).toBe('current');
      expect(result?.balance).toBe(1000);
      expect(result?.id).toBeDefined();

      if (result?.id) {
        createdAccountIds.push(result.id);
        
        // Verify it actually exists in the database
        const { data: verifyData } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', result.id)
          .single();
        
        expect(verifyData).toBeDefined();
        expect(verifyData?.name).toBe('Real Test Checking Account');
      }
    });

    it('should coerce unsupported types to "other" rather than failing', async () => {
      // Arrange - Create first account
      const accountData = {
        name: 'Unique Account Name ' + Date.now(),
        type: 'savings' as const,
        balance: 5000.00,
        currency: 'USD',
        isActive: true,
      };

      // Act - Create account
      const firstAccount = await AccountService.createAccount(authUserId, accountData);
      if (firstAccount?.id) {
        createdAccountIds.push(firstAccount.id);
      }

      // Try to create with invalid type (service should coerce to a supported value)
      const invalidAccount = {
        name: 'Invalid Type Account',
        type: 'invalid_type',
        balance: 100.0,
        currency: 'USD',
      };

      const coercedAccount = await AccountService.createAccount(
        authUserId,
        invalidAccount as AccountInput,
      );
      expect(coercedAccount.type).toBe('other');

      if (coercedAccount.id) {
        createdAccountIds.push(coercedAccount.id);
        const { data: verifyData } = await supabase
          .from('accounts')
          .select('type')
          .eq('id', coercedAccount.id)
          .single();

        expect(verifyData?.type).toBe('other');
      }
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
        const created = await AccountService.createAccount(authUserId, account);
        if (created?.id) {
          createdAccountIds.push(created.id);
        }
      }

      // Act - Retrieve accounts
      const retrievedAccounts = await AccountService.getAccounts(authUserId);

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
      const originalAccount = await AccountService.createAccount(authUserId, {
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
      const { data: verifyData } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', originalAccount.id)
        .single();

      expect(verifyData?.name).toBe('Updated Name');
      expect(toDecimal(verifyData?.balance ?? 0).toNumber()).toBe(2000);
    });
  });

  describe('deleteAccount - REAL', () => {
    it('should soft delete a real account', async () => {
      // Arrange - Create a real account
      const account = await AccountService.createAccount(authUserId, {
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
      const { data: verifyData } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', account.id)
        .single();

      expect(verifyData?.is_active).toBe(false);
      
      // Clean up the soft-deleted account
      await supabase
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
          AccountService.createAccount(authUserId, {
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
      const { data: allAccounts } = await supabase
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
    const account = await AccountService.createAccount(authUserId, {
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
        await supabase
          .from(table)
          .delete()
          .in('id', ids);
      }
    }
  }
}
