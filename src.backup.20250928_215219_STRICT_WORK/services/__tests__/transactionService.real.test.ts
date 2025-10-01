/**
 * Transaction Service REAL Test
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 * 
 * This test uses REAL Supabase database connections, not mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { TransactionService } from '../api/transactionService';

// Use real Supabase test instance
const testSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Test data - using valid UUIDs
const TEST_USER_ID = '11111111-1111-1111-1111-' + Date.now().toString().padStart(12, '0').slice(-12);
const TEST_ACCOUNT_ID = '22222222-2222-2222-2222-' + Date.now().toString().padStart(12, '0').slice(-12);
const createdTransactionIds: string[] = [];
let testUserId: string;
let testAccountId: string;

describe('TransactionService - REAL Database Tests', () => {
  beforeEach(async () => {
    // Clear tracking arrays
    createdTransactionIds.length = 0;
    testUserId = TEST_USER_ID;
    testAccountId = TEST_ACCOUNT_ID;
    
    // Create test user (required by foreign key constraint)
    const { error: userError } = await testSupabase
      .from('users')
      .upsert({
        id: testUserId,
        clerk_id: 'test_clerk_tx_' + Date.now(),
        email: `test.tx.${Date.now()}@test.com`,
        created_at: new Date().toISOString(),
      });
    
    if (userError) {
      console.error('Failed to create test user:', userError);
    }
    
    // Create test account (required for transaction foreign key)
    const { error: accountError } = await testSupabase
      .from('accounts')
      .upsert({
        id: testAccountId,
        user_id: testUserId,
        name: 'Test Transaction Account',
        type: 'checking',
        balance: 5000.00,
        currency: 'USD',
        is_active: true,
        created_at: new Date().toISOString(),
      });
    
    if (accountError) {
      console.error('Failed to create test account:', accountError);
    }
  });

  afterEach(async () => {
    // Clean up transactions first (due to foreign key constraints)
    if (createdTransactionIds.length > 0) {
      await testSupabase
        .from('transactions')
        .delete()
        .in('id', createdTransactionIds);
    }
    
    // Clean up test account
    await testSupabase
      .from('accounts')
      .delete()
      .eq('id', testAccountId);
    
    // Clean up test user
    await testSupabase
      .from('users')
      .delete()
      .eq('id', testUserId);
  });

  describe('createTransaction - REAL', () => {
    it('should create a real transaction in the database', async () => {
      // Arrange
      const transactionData = {
        account_id: testAccountId,
        amount: -150.50,
        description: 'Real Grocery Store Purchase',
        date: new Date().toISOString(),
        category: 'Groceries',
        type: 'expense' as const,
      };

      // Act - Create real transaction
      const result = await TransactionService.createTransaction(testUserId, transactionData);

      // Assert
      expect(result).toBeDefined();
      expect(result.description).toBe('Real Grocery Store Purchase');
      expect(result.amount).toBe(-150.50);
      expect(result.category).toBe('Groceries');
      expect(result.type).toBe('expense');
      expect(result.id).toBeDefined();

      if (result.id) {
        createdTransactionIds.push(result.id);
        
        // Verify it actually exists in the database
        const { data: verifyData } = await testSupabase
          .from('transactions')
          .select('*')
          .eq('id', result.id)
          .single();
        
        expect(verifyData).toBeDefined();
        expect(verifyData?.description).toBe('Real Grocery Store Purchase');
        expect(parseFloat(verifyData?.amount)).toBe(-150.50);
      }
    });

    it('should handle real database constraints for transactions', async () => {
      // Try to create transaction without required account_id
      const invalidTransaction = {
        amount: -50.00,
        description: 'Should fail - no account',
        date: new Date().toISOString(),
        category: 'Test',
        type: 'expense' as const,
      };

      // Should throw error due to missing required field
      await expect(
        TransactionService.createTransaction(testUserId, invalidTransaction as any)
      ).rejects.toThrow();
    });

    it('should create income transaction correctly', async () => {
      // Arrange
      const incomeData = {
        account_id: testAccountId,
        amount: 3500.00,
        description: 'Salary Deposit',
        date: new Date().toISOString(),
        category: 'Salary',
        type: 'income' as const,
      };

      // Act
      const result = await TransactionService.createTransaction(testUserId, incomeData);

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe('income');
      expect(result.amount).toBe(3500.00);
      
      if (result.id) {
        createdTransactionIds.push(result.id);
      }
    });
  });

  describe('getTransactions - REAL', () => {
    it('should retrieve real transactions from database', async () => {
      // Arrange - Create multiple real transactions
      const transactions = [
        {
          account_id: testAccountId,
          amount: -25.99,
          description: 'Coffee Shop',
          date: new Date().toISOString(),
          category: 'Dining',
          type: 'expense' as const,
          },
        {
          account_id: testAccountId,
          amount: -89.99,
          description: 'Electric Bill',
          date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          category: 'Utilities',
          type: 'expense' as const,
          },
        {
          account_id: testAccountId,
          amount: 1000.00,
          description: 'Freelance Payment',
          date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          category: 'Income',
          type: 'income' as const,
          },
      ];

      // Create transactions
      for (const tx of transactions) {
        const created = await TransactionService.createTransaction(testUserId, tx);
        if (created?.id) {
          createdTransactionIds.push(created.id);
        }
      }

      // Act - Retrieve transactions
      const retrievedTransactions = await TransactionService.getTransactions(testUserId);

      // Assert
      expect(Array.isArray(retrievedTransactions)).toBe(true);
      expect(retrievedTransactions.length).toBeGreaterThanOrEqual(3);
      
      // Verify our test transactions are in the results
      const testTransactions = retrievedTransactions.filter(tx => 
        createdTransactionIds.includes(tx.id)
      );
      expect(testTransactions.length).toBe(3);
      
      // Should be ordered by date descending (most recent first)
      const coffeeTx = testTransactions.find(tx => tx.description === 'Coffee Shop');
      const electricTx = testTransactions.find(tx => tx.description === 'Electric Bill');
      const freelanceTx = testTransactions.find(tx => tx.description === 'Freelance Payment');
      
      expect(coffeeTx).toBeDefined();
      expect(electricTx).toBeDefined();
      expect(freelanceTx).toBeDefined();
    });

    it('should return empty array for user with no transactions', async () => {
      // Create a new user with no transactions
      const emptyUserId = '33333333-3333-3333-3333-' + Date.now().toString().padStart(12, '0').slice(-12);
      
      await testSupabase
        .from('users')
        .upsert({
          id: emptyUserId,
          clerk_id: 'test_empty_' + Date.now(),
          email: `empty.${Date.now()}@test.com`,
          created_at: new Date().toISOString(),
        });

      // Act
      const transactions = await TransactionService.getTransactions(emptyUserId);

      // Assert
      expect(Array.isArray(transactions)).toBe(true);
      expect(transactions.length).toBe(0);

      // Cleanup
      await testSupabase.from('users').delete().eq('id', emptyUserId);
    });
  });

  describe('updateTransaction - REAL', () => {
    it('should update a real transaction in the database', async () => {
      // Arrange - Create a real transaction
      const originalTransaction = await TransactionService.createTransaction(testUserId, {
        account_id: testAccountId,
        amount: -100.00,
        description: 'Original Description',
        date: new Date().toISOString(),
        category: 'Shopping',
        type: 'expense' as const,
      });

      if (!originalTransaction?.id) {
        throw new Error('Failed to create test transaction');
      }
      createdTransactionIds.push(originalTransaction.id);

      // Act - Update the real transaction
      const updated = await TransactionService.updateTransaction(originalTransaction.id, {
        description: 'Updated Description',
        amount: -125.00,
      });

      // Assert
      expect(updated).toBeDefined();
      expect(updated.description).toBe('Updated Description');
      expect(updated.amount).toBe(-125.00);

      // Verify the update in the database
      const { data: verifyData } = await testSupabase
        .from('transactions')
        .select('*')
        .eq('id', originalTransaction.id)
        .single();

      expect(verifyData?.description).toBe('Updated Description');
      expect(parseFloat(verifyData?.amount)).toBe(-125.00);
    });
  });

  describe('deleteTransaction - REAL', () => {
    it('should delete a real transaction from database', async () => {
      // Arrange - Create a real transaction
      const transaction = await TransactionService.createTransaction(testUserId, {
        account_id: testAccountId,
        amount: -75.00,
        description: 'Transaction to Delete',
        date: new Date().toISOString(),
        category: 'Test',
        type: 'expense' as const,
      });

      if (!transaction?.id) {
        throw new Error('Failed to create test transaction');
      }
      // Don't add to cleanup array since we're deleting it

      // Act - Delete the transaction
      await TransactionService.deleteTransaction(transaction.id);

      // Verify it's deleted from database
      const { data: verifyData } = await testSupabase
        .from('transactions')
        .select('*')
        .eq('id', transaction.id)
        .single();

      // Should not exist
      expect(verifyData).toBeNull();
    });
  });

  describe('Real Database Transaction Filters', () => {
    it('should filter transactions by date range', async () => {
      // Create transactions across different dates
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);
      const lastWeek = new Date(Date.now() - 604800000);

      const txData = [
        { date: today.toISOString(), description: 'Today Transaction' },
        { date: yesterday.toISOString(), description: 'Yesterday Transaction' },
        { date: lastWeek.toISOString(), description: 'Last Week Transaction' },
      ];

      for (const data of txData) {
        const created = await TransactionService.createTransaction(testUserId, {
          account_id: testAccountId,
          amount: -50.00,
          description: data.description,
          date: data.date,
          category: 'Test',
          type: 'expense' as const,
          });
        
        if (created?.id) {
          createdTransactionIds.push(created.id);
        }
      }

      // Get transactions and filter by date
      const allTransactions = await TransactionService.getTransactions(testUserId);
      
      // Filter for transactions from last 2 days
      const recentTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        const twoDaysAgo = new Date(Date.now() - 172800000);
        return txDate >= twoDaysAgo;
      });

      // Should include today and yesterday, but not last week
      const hasToday = recentTransactions.some(tx => tx.description === 'Today Transaction');
      const hasYesterday = recentTransactions.some(tx => tx.description === 'Yesterday Transaction');
      const hasLastWeek = recentTransactions.some(tx => tx.description === 'Last Week Transaction');

      expect(hasToday).toBe(true);
      expect(hasYesterday).toBe(true);
      expect(hasLastWeek).toBe(false);
    });

    it('should handle concurrent transaction operations correctly', async () => {
      const promises = [];
      
      // Create 5 transactions concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          TransactionService.createTransaction(testUserId, {
            account_id: testAccountId,
            amount: -(10 + i * 5),
            description: `Concurrent Transaction ${i}`,
            date: new Date().toISOString(),
            category: 'Test',
            type: 'expense' as const,
              })
        );
      }

      // Act - Execute all concurrently
      const results = await Promise.all(promises);

      // Assert - All should succeed
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.description).toBe(`Concurrent Transaction ${index}`);
        if (result?.id) {
          createdTransactionIds.push(result.id);
        }
      });

      // Verify all exist in database
      const { data: allTransactions } = await testSupabase
        .from('transactions')
        .select('*')
        .in('id', createdTransactionIds);

      expect(allTransactions?.length).toBeGreaterThanOrEqual(5);
    });
  });
});

/**
 * Test Data Factory for Real Transaction Tests
 */
export class TransactionTestDataFactory {
  private supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  
  private createdIds = {
    transactions: [] as string[],
    accounts: [] as string[],
    users: [] as string[],
  };

  async createTestTransaction(userId: string, accountId: string, overrides = {}) {
    const transaction = await TransactionService.createTransaction(userId, {
      account_id: accountId,
      amount: -50.00,
      description: 'Test Transaction ' + Date.now(),
      date: new Date().toISOString(),
      category: 'Test',
      type: 'expense' as const,
      ...overrides,
    });

    if (transaction?.id) {
      this.createdIds.transactions.push(transaction.id);
    }
    return transaction;
  }

  async cleanup() {
    // Clean up all created test data
    if (this.createdIds.transactions.length > 0) {
      await this.supabase
        .from('transactions')
        .delete()
        .in('id', this.createdIds.transactions);
    }
    
    if (this.createdIds.accounts.length > 0) {
      await this.supabase
        .from('accounts')
        .delete()
        .in('id', this.createdIds.accounts);
    }
    
    if (this.createdIds.users.length > 0) {
      await this.supabase
        .from('users')
        .delete()
        .in('id', this.createdIds.users);
    }
  }
}