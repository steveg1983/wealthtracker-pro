/**
 * Budget Service REAL Test
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 * 
 * This test uses REAL Supabase database connections, not mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { 
  getBudgets, 
  getBudget, 
  createBudget, 
  updateBudget, 
  deleteBudget,
  calculateBudgetProgress,
  isBudgetOverLimit,
  shouldAlertBudget
} from '../api/budgetService';
import type { Budget } from '../../types';

// Use real Supabase test instance
const testSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Test data - using valid UUIDs
const TEST_USER_ID = '44444444-4444-4444-4444-' + Date.now().toString().padStart(12, '0').slice(-12);
const TEST_CLERK_ID = 'test_clerk_budget_' + Date.now();
const TEST_CATEGORY_ID = '55555555-5555-5555-5555-' + Date.now().toString().padStart(12, '0').slice(-12);
const createdBudgetIds: string[] = [];

describe('BudgetService - REAL Database Tests', () => {
  beforeEach(async () => {
    // Clear tracking arrays
    createdBudgetIds.length = 0;
    
    // Create test user (required by foreign key constraint)
    const { error: userError } = await testSupabase
      .from('users')
      .upsert({
        id: TEST_USER_ID,
        clerk_id: TEST_CLERK_ID,
        email: `test.budget.${Date.now()}@test.com`,
        created_at: new Date().toISOString(),
      });
    
    if (userError) {
      console.error('Failed to create test user:', userError);
    }
    
    // Create test category (required for budget foreign key)
    const { error: categoryError } = await testSupabase
      .from('categories')
      .upsert({
        id: TEST_CATEGORY_ID,
        user_id: TEST_USER_ID,
        name: 'Test Groceries Category',
        type: 'expense',
        color: '#10B981',
        created_at: new Date().toISOString(),
      });
    
    if (categoryError) {
      console.error('Failed to create test category:', categoryError);
    }
  });

  afterEach(async () => {
    // Clean up budgets first (due to foreign key constraints)
    if (createdBudgetIds.length > 0) {
      await testSupabase
        .from('budgets')
        .delete()
        .in('id', createdBudgetIds);
    }
    
    // Clean up test category
    await testSupabase
      .from('categories')
      .delete()
      .eq('id', TEST_CATEGORY_ID);
    
    // Clean up test user
    await testSupabase
      .from('users')
      .delete()
      .eq('id', TEST_USER_ID);
  });

  describe('createBudget - REAL', () => {
    it('should create a real budget in the database', async () => {
      // Arrange
      const budgetData = {
        name: 'Real Monthly Groceries Budget',
        amount: 500.00,
        period: 'monthly' as const,
        categoryId: TEST_CATEGORY_ID,
        startDate: new Date().toISOString(),
        spent: 0,
      };

      // Act - Create real budget
      const result = await createBudget(TEST_CLERK_ID, budgetData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Real Monthly Groceries Budget');
      expect(result.amount).toBe(500);
      expect(result.period).toBe('monthly');
      expect(result.categoryId).toBe(TEST_CATEGORY_ID);
      expect(result.id).toBeDefined();

      if (result.id) {
        createdBudgetIds.push(result.id);
        
        // Verify it actually exists in the database
        const { data: verifyData } = await testSupabase
          .from('budgets')
          .select('*')
          .eq('id', result.id)
          .single();
        
        expect(verifyData).toBeDefined();
        expect(verifyData?.name).toBe('Real Monthly Groceries Budget');
        expect(parseFloat(verifyData?.amount)).toBe(500);
      }
    });

    it('should handle yearly budget creation', async () => {
      // Arrange
      const yearlyBudget = {
        name: 'Annual Travel Budget',
        amount: 6000.00,
        period: 'yearly' as const,
        categoryId: TEST_CATEGORY_ID,
        startDate: new Date('2025-01-01').toISOString(),
        spent: 0,
      };

      // Act
      const result = await createBudget(TEST_CLERK_ID, yearlyBudget);

      // Assert
      expect(result).toBeDefined();
      expect(result.period).toBe('yearly');
      expect(result.amount).toBe(6000);
      
      if (result.id) {
        createdBudgetIds.push(result.id);
      }
    });

    it('should enforce category foreign key constraint', async () => {
      // Try to create budget with non-existent category
      const invalidBudget = {
        name: 'Should Fail Budget',
        amount: 100.00,
        period: 'monthly' as const,
        categoryId: 'non-existent-category-id',
        startDate: new Date().toISOString(),
        spent: 0,
      };

      // Should throw error due to foreign key violation
      await expect(
        createBudget(TEST_CLERK_ID, invalidBudget)
      ).rejects.toThrow();
    });
  });

  describe('getBudgets - REAL', () => {
    it('should retrieve real budgets from database', async () => {
      // Arrange - Create multiple real budgets
      const budgets = [
        {
          name: 'Groceries Budget',
          amount: 400.00,
          period: 'monthly' as const,
          categoryId: TEST_CATEGORY_ID,
          startDate: new Date().toISOString(),
          spent: 150.00,
        },
        {
          name: 'Entertainment Budget',
          amount: 200.00,
          period: 'monthly' as const,
          categoryId: TEST_CATEGORY_ID,
          startDate: new Date().toISOString(),
          spent: 75.00,
        },
      ];

      // Create budgets
      for (const budget of budgets) {
        const created = await createBudget(TEST_CLERK_ID, budget);
        if (created?.id) {
          createdBudgetIds.push(created.id);
        }
      }

      // Act - Retrieve budgets
      const retrievedBudgets = await getBudgets(TEST_CLERK_ID);

      // Assert
      expect(Array.isArray(retrievedBudgets)).toBe(true);
      expect(retrievedBudgets.length).toBeGreaterThanOrEqual(2);
      
      // Verify our test budgets are in the results
      const testBudgets = retrievedBudgets.filter(b => 
        createdBudgetIds.includes(b.id)
      );
      expect(testBudgets.length).toBe(2);
      
      // Check specific budgets
      const groceriesBudget = testBudgets.find(b => b.name === 'Groceries Budget');
      const entertainmentBudget = testBudgets.find(b => b.name === 'Entertainment Budget');
      
      expect(groceriesBudget).toBeDefined();
      expect(groceriesBudget?.amount).toBe(400);
      expect(entertainmentBudget).toBeDefined();
      expect(entertainmentBudget?.amount).toBe(200);
    });
  });

  describe('getBudget - REAL', () => {
    it('should retrieve a specific budget by ID', async () => {
      // Arrange - Create a budget
      const budget = await createBudget(TEST_CLERK_ID, {
        name: 'Specific Budget',
        amount: 300.00,
        period: 'monthly' as const,
        categoryId: TEST_CATEGORY_ID,
        startDate: new Date().toISOString(),
        spent: 0,
      });

      if (!budget?.id) {
        throw new Error('Failed to create test budget');
      }
      createdBudgetIds.push(budget.id);

      // Act
      const retrieved = await getBudget(budget.id);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(budget.id);
      expect(retrieved?.name).toBe('Specific Budget');
      expect(retrieved?.amount).toBe(300);
    });

    it('should return null for non-existent budget', async () => {
      // Act
      const result = await getBudget('non-existent-budget-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateBudget - REAL', () => {
    it('should update a real budget in the database', async () => {
      // Arrange - Create a real budget
      const originalBudget = await createBudget(TEST_CLERK_ID, {
        name: 'Original Budget Name',
        amount: 250.00,
        period: 'monthly' as const,
        categoryId: TEST_CATEGORY_ID,
        startDate: new Date().toISOString(),
        spent: 100.00,
      });

      if (!originalBudget?.id) {
        throw new Error('Failed to create test budget');
      }
      createdBudgetIds.push(originalBudget.id);

      // Act - Update the real budget
      const updated = await updateBudget(originalBudget.id, {
        name: 'Updated Budget Name',
        amount: 350.00,
        spent: 125.00,
      });

      // Assert
      expect(updated).toBeDefined();
      expect(updated.name).toBe('Updated Budget Name');
      expect(updated.amount).toBe(350);
      expect(updated.spent).toBe(125);

      // Verify the update in the database
      const { data: verifyData } = await testSupabase
        .from('budgets')
        .select('*')
        .eq('id', originalBudget.id)
        .single();

      expect(verifyData?.name).toBe('Updated Budget Name');
      expect(parseFloat(verifyData?.amount)).toBe(350);
      expect(parseFloat(verifyData?.spent || '0')).toBe(125);
    });
  });

  describe('deleteBudget - REAL', () => {
    it('should delete a real budget from database', async () => {
      // Arrange - Create a real budget
      const budget = await createBudget(TEST_CLERK_ID, {
        name: 'Budget to Delete',
        amount: 100.00,
        period: 'monthly' as const,
        categoryId: TEST_CATEGORY_ID,
        startDate: new Date().toISOString(),
        spent: 0,
      });

      if (!budget?.id) {
        throw new Error('Failed to create test budget');
      }
      // Don't add to cleanup array since we're deleting it

      // Act - Delete the budget
      await deleteBudget(budget.id);

      // Verify it's deleted from database
      const { data: verifyData } = await testSupabase
        .from('budgets')
        .select('*')
        .eq('id', budget.id)
        .single();

      // Should not exist
      expect(verifyData).toBeNull();
    });
  });

  describe('Budget Calculation Functions', () => {
    it('should calculate budget progress correctly', () => {
      // Arrange
      const budget: Budget = {
        id: 'test-id',
        name: 'Test Budget',
        amount: 1000,
        spent: 750,
        period: 'monthly',
        categoryId: 'cat-id',
        startDate: new Date().toISOString(),
        color: '#000',
      };

      // Act
      const progress = calculateBudgetProgress(budget);

      // Assert
      expect(progress).toBe(75); // 750/1000 = 75%
    });

    it('should identify when budget is over limit', () => {
      // Arrange
      const overBudget: Budget = {
        id: 'test-id',
        name: 'Test Budget',
        amount: 500,
        spent: 600,
        period: 'monthly',
        categoryId: 'cat-id',
        startDate: new Date().toISOString(),
        color: '#000',
      };

      const underBudget: Budget = {
        ...overBudget,
        spent: 400,
      };

      // Act & Assert
      expect(isBudgetOverLimit(overBudget)).toBe(true);
      expect(isBudgetOverLimit(underBudget)).toBe(false);
    });

    it('should determine when to alert about budget', () => {
      // Arrange
      const almostOverBudget: Budget = {
        id: 'test-id',
        name: 'Test Budget',
        amount: 100,
        spent: 85, // 85% - should alert
        period: 'monthly',
        categoryId: 'cat-id',
        startDate: new Date().toISOString(),
        color: '#000',
      };

      const safebudget: Budget = {
        ...almostOverBudget,
        spent: 70, // 70% - no alert
      };

      // Act & Assert
      expect(shouldAlertBudget(almostOverBudget)).toBe(true);
      expect(shouldAlertBudget(safebudget)).toBe(false);
    });
  });

  describe('Real Database Budget Constraints', () => {
    it('should handle concurrent budget operations correctly', async () => {
      const promises = [];
      
      // Create 5 budgets concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          createBudget(TEST_CLERK_ID, {
            name: `Concurrent Budget ${i}`,
            amount: 100 + i * 50,
            period: 'monthly' as const,
            categoryId: TEST_CATEGORY_ID,
            startDate: new Date().toISOString(),
            spent: 0,
          })
        );
      }

      // Act - Execute all concurrently
      const results = await Promise.all(promises);

      // Assert - All should succeed
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.name).toBe(`Concurrent Budget ${index}`);
        if (result?.id) {
          createdBudgetIds.push(result.id);
        }
      });

      // Verify all exist in database
      const { data: allBudgets } = await testSupabase
        .from('budgets')
        .select('*')
        .in('id', createdBudgetIds);

      expect(allBudgets?.length).toBeGreaterThanOrEqual(5);
    });
  });
});

/**
 * Test Data Factory for Real Budget Tests
 */
export class BudgetTestDataFactory {
  private supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  
  private createdIds = {
    budgets: [] as string[],
    categories: [] as string[],
    users: [] as string[],
  };

  async createTestBudget(clerkId: string, categoryId: string, overrides = {}) {
    const budget = await createBudget(clerkId, {
      name: 'Test Budget ' + Date.now(),
      amount: 500.00,
      period: 'monthly' as const,
      categoryId: categoryId,
      startDate: new Date().toISOString(),
      spent: 0,
      ...overrides,
    });

    if (budget?.id) {
      this.createdIds.budgets.push(budget.id);
    }
    return budget;
  }

  async cleanup() {
    // Clean up all created test data
    if (this.createdIds.budgets.length > 0) {
      await this.supabase
        .from('budgets')
        .delete()
        .in('id', this.createdIds.budgets);
    }
    
    if (this.createdIds.categories.length > 0) {
      await this.supabase
        .from('categories')
        .delete()
        .in('id', this.createdIds.categories);
    }
    
    if (this.createdIds.users.length > 0) {
      await this.supabase
        .from('users')
        .delete()
        .in('id', this.createdIds.users);
    }
  }
}