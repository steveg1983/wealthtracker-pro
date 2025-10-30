/**
 * Goal Service REAL Test
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 * 
 * This test uses REAL Supabase database connections, not mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  contributeToGoal,
  getActiveGoals,
  getCompletedGoals,
  calculateDaysRemaining,
  calculateMonthlyContribution
} from '../api/goalService';
import { userIdService } from '../userIdService';
import { toDecimal } from '@wealthtracker/utils';
import { supabase, isSupabaseStub } from '@wealthtracker/core';

// Use real Supabase test instance
const testSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Test data - using valid UUIDs
const TEST_USER_ID = '77777777-7777-7777-7777-' + Date.now().toString().padStart(12, '0').slice(-12);
const TEST_CLERK_ID = 'test_clerk_goal_' + Date.now();
const createdGoalIds: string[] = [];

const envSupabaseUrl = import.meta.env?.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const envSupabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const runFlag = import.meta.env?.RUN_SUPABASE_REAL_TESTS ?? process.env.RUN_SUPABASE_REAL_TESTS;
const hasSupabaseConfig = Boolean(envSupabaseUrl && envSupabaseKey);
const shouldRunRealTests = runFlag === 'true';
const describeIfReal =
  shouldRunRealTests && hasSupabaseConfig && !isSupabaseStub(supabase) ? describe : describe.skip;

describeIfReal('GoalService - REAL Database Tests', () => {
  beforeEach(async () => {
    // Clear tracking arrays
    createdGoalIds.length = 0;
    // Prime the userIdService cache so goalService doesn't block on Supabase lookups
    userIdService.clearCache();
    
    // Create test user (required by foreign key constraint)
    const { error: userError } = await testSupabase
      .from('users')
      .upsert({
        id: TEST_USER_ID,
        clerk_id: TEST_CLERK_ID,
        email: `test.goal.${Date.now()}@test.com`,
        created_at: new Date().toISOString(),
      });
    
    if (userError) {
      console.error('Failed to create test user:', userError);
    }
    
    // Create user_id_mapping for userIdService
    const { error: mappingError } = await testSupabase
      .from('user_id_mappings')
      .upsert({
        clerk_id: TEST_CLERK_ID,
        database_user_id: TEST_USER_ID,
        created_at: new Date().toISOString(),
      });
    
    if (mappingError) {
      console.error('Failed to create user mapping:', mappingError);
    }

    userIdService.setCurrentUser(TEST_CLERK_ID, TEST_USER_ID);
  });

  afterEach(async () => {
    // Clean up goals
    if (createdGoalIds.length > 0) {
      await testSupabase
        .from('goals')
        .delete()
        .in('id', createdGoalIds);
    }
    
    // Clean up user mapping
    await testSupabase
      .from('user_id_mappings')
      .delete()
      .eq('clerk_id', TEST_CLERK_ID);
    
    // Clean up test user
    await testSupabase
      .from('users')
      .delete()
      .eq('id', TEST_USER_ID);

    userIdService.clearCache();
  });

  describe('createGoal - REAL', () => {
    it('should create a real goal in the database', async () => {
      // Arrange
      const goalData = {
        name: 'Real Emergency Fund Goal',
        description: 'Build 6 months of expenses',
        targetAmount: 10000.00,
        currentAmount: 2500.00,
        targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        category: 'savings',
        priority: 'high' as const,
        isCompleted: false,
      };

      // Act - Create real goal
      const result = await createGoal(TEST_CLERK_ID, goalData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Real Emergency Fund Goal');
      expect(result.targetAmount).toBe(10000);
      expect(result.currentAmount).toBe(2500);
      expect(result.category).toBe('savings');
      expect(result.priority).toBe('high');
      expect(result.id).toBeDefined();

      if (result.id) {
        createdGoalIds.push(result.id);
        
        // Verify it actually exists in the database
        const { data: verifyData } = await testSupabase
          .from('goals')
          .select('*')
          .eq('id', result.id)
          .single();
        
        expect(verifyData).toBeDefined();
        expect(verifyData?.name).toBe('Real Emergency Fund Goal');
        expect(toDecimal(verifyData?.target_amount ?? 0).toNumber()).toBe(10000);
        expect(toDecimal(verifyData?.current_amount ?? 0).toNumber()).toBe(2500);
      }
    });

    it('should create investment goal correctly', async () => {
      // Arrange
      const investmentGoal = {
        name: 'Retirement Portfolio',
        description: 'Build retirement investment portfolio',
        targetAmount: 500000.00,
        currentAmount: 50000.00,
        targetDate: new Date(Date.now() + 20 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 20 years
        category: 'investment',
        priority: 'medium' as const,
        isCompleted: false,
      };

      // Act
      const result = await createGoal(TEST_CLERK_ID, investmentGoal);

      // Assert
      expect(result).toBeDefined();
      expect(result.category).toBe('investment');
      expect(result.targetAmount).toBe(500000);
      
      if (result.id) {
        createdGoalIds.push(result.id);
      }
    });

    it('should handle goal without target date', async () => {
      // Arrange
      const openEndedGoal = {
        name: 'General Savings',
        description: 'Save as much as possible',
        targetAmount: 100000.00,
        currentAmount: 0,
        category: 'savings',
        priority: 'low' as const,
        isCompleted: false,
      };

      // Act
      const result = await createGoal(TEST_CLERK_ID, openEndedGoal);

      // Assert
      expect(result).toBeDefined();
      expect(result.targetDate).toBeInstanceOf(Date);
      
      if (result.id) {
        createdGoalIds.push(result.id);
      }
    });
  });

  describe('getGoals - REAL', () => {
    it('should retrieve real goals from database', async () => {
      // Arrange - Create multiple real goals
      const goals = [
        {
          name: 'Vacation Fund',
          targetAmount: 5000.00,
          currentAmount: 1000.00,
          targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'travel',
          priority: 'medium' as const,
          isCompleted: false,
        },
        {
          name: 'New Car',
          targetAmount: 30000.00,
          currentAmount: 5000.00,
          targetDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'purchase',
          priority: 'low' as const,
          isCompleted: false,
        },
        {
          name: 'House Down Payment',
          targetAmount: 60000.00,
          currentAmount: 15000.00,
          targetDate: new Date(Date.now() + 1095 * 24 * 60 * 60 * 1000).toISOString(),
          category: 'purchase',
          priority: 'high' as const,
          isCompleted: false,
        },
      ];

      // Create goals
      for (const goal of goals) {
        const created = await createGoal(TEST_CLERK_ID, goal);
        if (created?.id) {
          createdGoalIds.push(created.id);
        }
      }

      // Act - Retrieve goals
      const retrievedGoals = await getGoals(TEST_CLERK_ID);

      // Assert
      expect(Array.isArray(retrievedGoals)).toBe(true);
      expect(retrievedGoals.length).toBeGreaterThanOrEqual(3);
      
      // Verify our test goals are in the results
      const testGoals = retrievedGoals.filter(g => 
        createdGoalIds.includes(g.id)
      );
      expect(testGoals.length).toBe(3);
      
      // Check specific goals
      const vacationGoal = testGoals.find(g => g.name === 'Vacation Fund');
      const houseGoal = testGoals.find(g => g.name === 'House Down Payment');
      
      expect(vacationGoal).toBeDefined();
      expect(vacationGoal?.targetAmount).toBe(5000);
      expect(houseGoal).toBeDefined();
      expect(houseGoal?.priority).toBe('high');
    });
  });

  describe('getGoal - REAL', () => {
    it('should retrieve a specific goal by ID', async () => {
      // Arrange - Create a goal
      const goal = await createGoal(TEST_CLERK_ID, {
        name: 'Specific Goal',
        targetAmount: 1000.00,
        currentAmount: 100.00,
        category: 'savings',
        priority: 'medium' as const,
        isCompleted: false,
      });

      if (!goal?.id) {
        throw new Error('Failed to create test goal');
      }
      createdGoalIds.push(goal.id);

      // Act
      const retrieved = await getGoal(goal.id);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(goal.id);
      expect(retrieved?.name).toBe('Specific Goal');
      expect(retrieved?.targetAmount).toBe(1000);
    });

    it('should return null for non-existent goal', async () => {
      // Act
      const result = await getGoal('non-existent-goal-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateGoal - REAL', () => {
    it('should update a real goal in the database', async () => {
      // Arrange - Create a real goal
      const originalGoal = await createGoal(TEST_CLERK_ID, {
        name: 'Original Goal Name',
        targetAmount: 5000.00,
        currentAmount: 1000.00,
        category: 'savings',
        priority: 'low' as const,
        isCompleted: false,
      });

      if (!originalGoal?.id) {
        throw new Error('Failed to create test goal');
      }
      createdGoalIds.push(originalGoal.id);

      // Act - Update the real goal
      const updated = await updateGoal(originalGoal.id, {
        name: 'Updated Goal Name',
        targetAmount: 7500.00,
        currentAmount: 2000.00,
        priority: 'high',
      });

      // Assert
      expect(updated).toBeDefined();
      expect(updated.name).toBe('Updated Goal Name');
      expect(updated.targetAmount).toBe(7500);
      expect(updated.currentAmount).toBe(2000);
      expect(updated.priority).toBe('high');

      // Verify the update in the database
      const { data: verifyData } = await testSupabase
        .from('goals')
        .select('*')
        .eq('id', originalGoal.id)
        .single();

      expect(verifyData?.name).toBe('Updated Goal Name');
      expect(toDecimal(verifyData?.target_amount ?? 0).toNumber()).toBe(7500);
      expect(toDecimal(verifyData?.current_amount ?? 0).toNumber()).toBe(2000);
    });

    it('should mark goal as completed when target reached', async () => {
      // Arrange
      const goal = await createGoal(TEST_CLERK_ID, {
        name: 'Almost Complete Goal',
        targetAmount: 1000.00,
        currentAmount: 900.00,
        category: 'savings',
        priority: 'high' as const,
        status: 'active',
      });

      if (!goal?.id) {
        throw new Error('Failed to create test goal');
      }
      createdGoalIds.push(goal.id);

      // Act - Update to reach target
      const updated = await updateGoal(goal.id, {
        currentAmount: 1000.00,
        status: 'completed',
      });

      // Assert
      expect(updated.currentAmount).toBe(1000);
      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeDefined();
    });
  });

  describe('contributeToGoal - REAL', () => {
    it('should add contribution to goal', async () => {
      // Arrange
      const goal = await createGoal(TEST_CLERK_ID, {
        name: 'Contribution Test Goal',
        targetAmount: 5000.00,
        currentAmount: 1000.00,
        category: 'savings',
        priority: 'medium' as const,
        isCompleted: false,
      });

      if (!goal?.id) {
        throw new Error('Failed to create test goal');
      }
      createdGoalIds.push(goal.id);

      // Act - Contribute $500
      const updated = await contributeToGoal(goal.id, 500.00);

      // Assert
      expect(updated.currentAmount).toBe(1500);
      
      // Verify in database
      const { data: verifyData } = await testSupabase
        .from('goals')
        .select('*')
        .eq('id', goal.id)
        .single();

      expect(toDecimal(verifyData?.current_amount ?? 0).toNumber()).toBe(1500);
    });

    it('should handle negative contribution (withdrawal)', async () => {
      // Arrange
      const goal = await createGoal(TEST_CLERK_ID, {
        name: 'Withdrawal Test Goal',
        targetAmount: 5000.00,
        currentAmount: 2000.00,
        category: 'savings',
        priority: 'medium' as const,
        isCompleted: false,
      });

      if (!goal?.id) {
        throw new Error('Failed to create test goal');
      }
      createdGoalIds.push(goal.id);

      // Act - Withdraw $300
      const updated = await contributeToGoal(goal.id, -300.00);

      // Assert
      expect(updated.currentAmount).toBe(1700);
    });
  });

  describe('deleteGoal - REAL', () => {
    it('should delete a real goal from database', async () => {
      // Arrange - Create a real goal
      const goal = await createGoal(TEST_CLERK_ID, {
        name: 'Goal to Delete',
        targetAmount: 1000.00,
        currentAmount: 0,
        category: 'savings',
        priority: 'low' as const,
        status: 'active',
      });

      if (!goal?.id) {
        throw new Error('Failed to create test goal');
      }
      // Don't add to cleanup array since we're deleting it

      // Act - Delete the goal
      await deleteGoal(goal.id);

      // Verify it's deleted from database
      const { data: verifyData } = await testSupabase
        .from('goals')
        .select('*')
        .eq('id', goal.id)
        .single();

      // Should not exist
      expect(verifyData).toBeNull();
    });
  });

  describe('Goal Filtering Functions', () => {
    it('should get only active goals', async () => {
      // Create mix of active and completed goals
      const activeGoal = await createGoal(TEST_CLERK_ID, {
        name: 'Active Goal',
        targetAmount: 1000.00,
        currentAmount: 500.00,
        category: 'savings',
        priority: 'high' as const,
        status: 'active',
      });

      const completedGoal = await createGoal(TEST_CLERK_ID, {
        name: 'Completed Goal',
        targetAmount: 1000.00,
        currentAmount: 1000.00,
        category: 'savings',
        priority: 'high' as const,
        status: 'completed',
      });

      if (activeGoal?.id) createdGoalIds.push(activeGoal.id);
      if (completedGoal?.id) createdGoalIds.push(completedGoal.id);

      // Act
      const activeGoals = await getActiveGoals(TEST_CLERK_ID);

      // Assert
      const testActiveGoals = activeGoals.filter(g => 
        g.id === activeGoal?.id || g.id === completedGoal?.id
      );
      
      expect(testActiveGoals.length).toBe(1);
      expect(testActiveGoals[0].name).toBe('Active Goal');
      expect(testActiveGoals[0].status).toBe('active');
    });

    it('should get only completed goals', async () => {
      // Create completed goal
      const completedGoal = await createGoal(TEST_CLERK_ID, {
        name: 'Achieved Goal',
        targetAmount: 2000.00,
        currentAmount: 2000.00,
        category: 'savings',
        priority: 'medium' as const,
        status: 'completed',
      });

      if (completedGoal?.id) createdGoalIds.push(completedGoal.id);

      // Act
      const completed = await getCompletedGoals(TEST_CLERK_ID);

      // Assert
      const testCompleted = completed.filter(g => g.id === completedGoal?.id);
      expect(testCompleted.length).toBe(1);
      expect(testCompleted[0].status).toBe('completed');
    });
  });

  describe('Goal Calculation Functions', () => {
    it('should calculate days remaining correctly', () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now

      const goal: Goal = {
        id: 'test-id',
        name: 'Test Goal',
        targetAmount: 1000,
        currentAmount: 500,
        targetDate: futureDate.toISOString(),
        category: 'savings',
        priority: 'medium',
        isCompleted: false,
      };

      // Act
      const daysRemaining = calculateDaysRemaining(goal);

      // Assert
      expect(daysRemaining).toBeDefined();
      expect(daysRemaining).toBeGreaterThanOrEqual(29);
      expect(daysRemaining).toBeLessThanOrEqual(31);
    });

    it('should calculate monthly contribution needed', () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 12); // 12 months from now

      const goal: Goal = {
        id: 'test-id',
        name: 'Test Goal',
        targetAmount: 12000,
        currentAmount: 0,
        targetDate: futureDate.toISOString(),
        category: 'savings',
        priority: 'high',
        isCompleted: false,
      };

      // Act
      const monthlyAmount = calculateMonthlyContribution(goal);

      // Assert
      expect(monthlyAmount).toBeDefined();
      expect(monthlyAmount).toBeGreaterThanOrEqual(900); // ~$1000/month
      expect(monthlyAmount).toBeLessThanOrEqual(1100);
    });

    it('should return 0 for completed goals', () => {
      const completedGoal: Goal = {
        id: 'test-id',
        name: 'Completed Goal',
        targetAmount: 1000,
        currentAmount: 1000,
        category: 'savings',
        priority: 'high',
        isCompleted: true,
      };

      const monthlyAmount = calculateMonthlyContribution(completedGoal);
      expect(monthlyAmount).toBe(0);
    });
  });

  describe('Real Database Goal Operations', () => {
    it('should handle concurrent goal operations correctly', async () => {
      const promises = [];
      
      // Create 5 goals concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          createGoal(TEST_CLERK_ID, {
            name: `Concurrent Goal ${i}`,
            targetAmount: 1000 + i * 500,
            currentAmount: i * 100,
            category: i % 2 === 0 ? 'savings' : 'investment',
            priority: ['high', 'medium', 'low'][i % 3] as Goal['priority'],
            isCompleted: false,
          })
        );
      }

      // Act - Execute all concurrently
      const results = await Promise.all(promises);

      // Assert - All should succeed
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.name).toBe(`Concurrent Goal ${index}`);
        if (result?.id) {
          createdGoalIds.push(result.id);
        }
      });

      // Verify all exist in database
      const { data: allGoals } = await testSupabase
        .from('goals')
        .select('*')
        .in('id', createdGoalIds);

      expect(allGoals?.length).toBeGreaterThanOrEqual(5);
    });
  });
});

/**
 * Test Data Factory for Real Goal Tests
 */
export class GoalTestDataFactory {
  private supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  
  private createdIds = {
    goals: [] as string[],
    users: [] as string[],
  };

  async createTestGoal(clerkId: string, overrides = {}) {
    const goal = await createGoal(clerkId, {
      name: 'Test Goal ' + Date.now(),
      targetAmount: 10000.00,
      currentAmount: 0,
      category: 'savings',
      priority: 'medium' as const,
      isCompleted: false,
      ...overrides,
    });

    if (goal?.id) {
      this.createdIds.goals.push(goal.id);
    }
    return goal;
  }

  async cleanup() {
    // Clean up all created test data
    if (this.createdIds.goals.length > 0) {
      await this.supabase
        .from('goals')
        .delete()
        .in('id', this.createdIds.goals);
    }
    
    if (this.createdIds.users.length > 0) {
      await this.supabase
        .from('users')
        .delete()
        .in('id', this.createdIds.users);
    }
  }
}
