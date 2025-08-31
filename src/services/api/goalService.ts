/**
 * Goal Service for Supabase Integration
 * Handles all goal CRUD operations with proper sync
 */

import { supabase } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import type { Goal } from '../../types';
import { logger } from '../loggingService';

/**
 * Transform database snake_case to TypeScript camelCase
 */
function transformGoalFromDb(dbGoal: any): Goal {
  return {
    id: dbGoal.id,
    name: dbGoal.name,
    description: dbGoal.description,
    targetAmount: dbGoal.target_amount,
    currentAmount: dbGoal.current_amount || 0,
    progress: dbGoal.current_amount && dbGoal.target_amount 
      ? (dbGoal.current_amount / dbGoal.target_amount) * 100 
      : 0,
    targetDate: dbGoal.target_date,
    category: dbGoal.category,
    priority: dbGoal.priority || 'medium',
    status: dbGoal.status || 'active',
    accountId: dbGoal.account_id,
    autoContribute: dbGoal.auto_contribute || false,
    contributionAmount: dbGoal.contribution_amount,
    contributionFrequency: dbGoal.contribution_frequency,
    icon: dbGoal.icon,
    color: dbGoal.color,
    createdAt: dbGoal.created_at,
    updatedAt: dbGoal.updated_at,
    completedAt: dbGoal.completed_at
  };
}

/**
 * Transform TypeScript to database format
 */
function transformGoalToDb(goal: Partial<Goal>): any {
  const dbGoal: any = {};
  
  if (goal.name !== undefined) dbGoal.name = goal.name;
  if (goal.description !== undefined) dbGoal.description = goal.description;
  if (goal.targetAmount !== undefined) dbGoal.target_amount = goal.targetAmount;
  if (goal.currentAmount !== undefined) dbGoal.current_amount = goal.currentAmount;
  if (goal.targetDate !== undefined) dbGoal.target_date = goal.targetDate;
  if (goal.category !== undefined) dbGoal.category = goal.category;
  if (goal.priority !== undefined) dbGoal.priority = goal.priority;
  if (goal.status !== undefined) dbGoal.status = goal.status;
  if (goal.accountId !== undefined) dbGoal.account_id = goal.accountId;
  if (goal.autoContribute !== undefined) dbGoal.auto_contribute = goal.autoContribute;
  if (goal.contributionAmount !== undefined) dbGoal.contribution_amount = goal.contributionAmount;
  if (goal.contributionFrequency !== undefined) dbGoal.contribution_frequency = goal.contributionFrequency;
  if (goal.icon !== undefined) dbGoal.icon = goal.icon;
  if (goal.color !== undefined) dbGoal.color = goal.color;
  if (goal.completedAt !== undefined) dbGoal.completed_at = goal.completedAt;
  
  return dbGoal;
}

/**
 * Get all goals for a user
 */
export async function getGoals(clerkId: string): Promise<Goal[]> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Convert Clerk ID to database UUID
    const userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      console.log('[GoalService] No user found, returning empty array');
      return [];
    }
    
    // Get all goals for the user
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('[GoalService] Error fetching goals:', error);
      throw error;
    }
    
    return (data || []).map(transformGoalFromDb);
    
  } catch (error) {
    logger.error('[GoalService] Error loading goals, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const stored = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS);
    return stored || [];
  }
}

/**
 * Get a single goal by ID
 */
export async function getGoal(goalId: string): Promise<Goal | null> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();
    
    if (error) {
      logger.error('[GoalService] Error fetching goal:', error);
      throw error;
    }
    
    return data ? transformGoalFromDb(data) : null;
    
  } catch (error) {
    // Fallback to localStorage
    const goals = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS) || [];
    return goals.find(g => g.id === goalId) || null;
  }
}

/**
 * Create a new goal
 */
export async function createGoal(
  clerkId: string,
  goal: Omit<Goal, 'id' | 'progress' | 'createdAt' | 'updatedAt'>
): Promise<Goal> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      throw new Error('User not found');
    }
    
    const dbGoal = {
      ...transformGoalToDb(goal),
      user_id: userId,
      current_amount: goal.currentAmount || 0
    };
    
    const { data, error } = await supabase
      .from('goals')
      .insert(dbGoal)
      .select()
      .single();
    
    if (error) {
      logger.error('[GoalService] Error creating goal:', error);
      throw error;
    }
    
    console.log('[GoalService] Goal created successfully:', data);
    return transformGoalFromDb(data);
    
  } catch (error) {
    logger.error('[GoalService] Error creating goal, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const newGoal: Goal = {
      ...goal,
      id: crypto.randomUUID(),
      progress: goal.currentAmount && goal.targetAmount 
        ? (goal.currentAmount / goal.targetAmount) * 100 
        : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const goals = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS) || [];
    goals.push(newGoal);
    await storageAdapter.set(STORAGE_KEYS.GOALS, goals);
    
    return newGoal;
  }
}

/**
 * Update a goal
 */
export async function updateGoal(
  goalId: string,
  updates: Partial<Goal>
): Promise<Goal> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const dbUpdates = transformGoalToDb(updates);
    
    // Check if goal is being completed
    if (updates.status === 'completed' && !dbUpdates.completed_at) {
      dbUpdates.completed_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('goals')
      .update(dbUpdates)
      .eq('id', goalId)
      .select()
      .single();
    
    if (error) {
      logger.error('[GoalService] Error updating goal:', error);
      throw error;
    }
    
    return transformGoalFromDb(data);
    
  } catch (error) {
    logger.error('[GoalService] Error updating goal, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const goals = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS) || [];
    const index = goals.findIndex(g => g.id === goalId);
    
    if (index !== -1) {
      const updatedGoal = { 
        ...goals[index], 
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Update progress
      if (updatedGoal.currentAmount !== undefined && updatedGoal.targetAmount) {
        updatedGoal.progress = (updatedGoal.currentAmount / updatedGoal.targetAmount) * 100;
      }
      
      // Set completed date if completing
      if (updates.status === 'completed' && !updatedGoal.completedAt) {
        updatedGoal.completedAt = new Date().toISOString();
      }
      
      goals[index] = updatedGoal;
      await storageAdapter.set(STORAGE_KEYS.GOALS, goals);
      return goals[index];
    }
    
    throw new Error('Goal not found');
  }
}

/**
 * Delete a goal
 */
export async function deleteGoal(goalId: string): Promise<void> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId);
    
    if (error) {
      logger.error('[GoalService] Error deleting goal:', error);
      throw error;
    }
    
    console.log('[GoalService] Goal deleted successfully');
    
  } catch (error) {
    logger.error('[GoalService] Error deleting goal, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const goals = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS) || [];
    const filtered = goals.filter(g => g.id !== goalId);
    await storageAdapter.set(STORAGE_KEYS.GOALS, filtered);
  }
}

/**
 * Contribute to a goal
 */
export async function contributeToGoal(
  goalId: string,
  amount: number,
  transactionId?: string
): Promise<Goal> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Get current goal
    const goal = await getGoal(goalId);
    if (!goal) {
      throw new Error('Goal not found');
    }
    
    // Update current amount
    const newAmount = (goal.currentAmount || 0) + amount;
    const isCompleted = newAmount >= goal.targetAmount;
    
    // Update the goal
    const updatedGoal = await updateGoal(goalId, {
      currentAmount: newAmount,
      status: isCompleted ? 'completed' : goal.status,
      completedAt: isCompleted ? new Date().toISOString() : undefined
    });
    
    // Record the contribution (if we have user context)
    if (transactionId) {
      const clerkId = userIdService.getCurrentClerkId();
      if (clerkId) {
        const userId = await userIdService.getDatabaseUserId(clerkId);
        if (userId) {
          await supabase
            .from('goal_contributions')
            .insert({
              goal_id: goalId,
              user_id: userId,
              amount: amount,
              transaction_id: transactionId,
              date: new Date().toISOString()
            });
        }
      }
    }
    
    return updatedGoal;
    
  } catch (error) {
    logger.error('[GoalService] Error contributing to goal:', error);
    
    // Fallback to just updating the goal amount
    return updateGoal(goalId, {
      currentAmount: ((await getGoal(goalId))?.currentAmount || 0) + amount
    });
  }
}

/**
 * Get active goals
 */
export async function getActiveGoals(clerkId: string): Promise<Goal[]> {
  const allGoals = await getGoals(clerkId);
  return allGoals.filter(goal => goal.status === 'active');
}

/**
 * Get completed goals
 */
export async function getCompletedGoals(clerkId: string): Promise<Goal[]> {
  const allGoals = await getGoals(clerkId);
  return allGoals.filter(goal => goal.status === 'completed');
}

/**
 * Calculate days remaining for a goal
 */
export function calculateDaysRemaining(goal: Goal): number | null {
  if (!goal.targetDate) return null;
  
  const today = new Date();
  const target = new Date(goal.targetDate);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Calculate required monthly contribution
 */
export function calculateMonthlyContribution(goal: Goal): number {
  const remaining = goal.targetAmount - (goal.currentAmount || 0);
  if (remaining <= 0) return 0;
  
  const daysRemaining = calculateDaysRemaining(goal);
  if (!daysRemaining || daysRemaining <= 0) return remaining;
  
  const monthsRemaining = daysRemaining / 30;
  return remaining / monthsRemaining;
}

/**
 * Subscribe to goal changes
 */
export async function subscribeToGoalChanges(
  clerkId: string,
  callback: (payload: any) => void
): Promise<() => void> {
  if (!supabase) {
    return () => {}; // No-op for localStorage
  }

  try {
    const dbUserId = await userIdService.getDatabaseUserId(clerkId);
    
    if (!dbUserId) {
      logger.warn('[GoalService] No database user found for subscription');
      return () => {};
    }

    const channel = supabase
      .channel(`goals-${dbUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `user_id=eq.${dbUserId}`
        },
        (payload) => {
          console.log('🔔 [GoalService] Real-time update received:', payload);
          callback(payload);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
    };
  } catch (error) {
    logger.error('[GoalService] Error setting up subscription:', error);
    return () => {};
  }
}

// Migrate existing localStorage goals to Supabase
export async function migrateGoalsToSupabase(clerkId: string): Promise<void> {
  try {
    const localGoals = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS);
    
    if (!localGoals || localGoals.length === 0) {
      console.log('[GoalService] No local goals to migrate');
      return;
    }
    
    console.log(`[GoalService] Migrating ${localGoals.length} goals to Supabase`);
    
    for (const goal of localGoals) {
      try {
        // Remove the id and progress so Supabase generates new ones
        const { id, progress, ...goalData } = goal;
        await createGoal(clerkId, goalData as any);
      } catch (error) {
        logger.error(`[GoalService] Failed to migrate goal ${goal.name}:`, error);
      }
    }
    
    // Clear localStorage after successful migration
    await storageAdapter.remove(STORAGE_KEYS.GOALS);
    console.log('[GoalService] Migration completed');
    
  } catch (error) {
    logger.error('[GoalService] Migration failed:', error);
  }
}

export default {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  contributeToGoal,
  getActiveGoals,
  getCompletedGoals,
  calculateDaysRemaining,
  calculateMonthlyContribution,
  subscribeToGoalChanges,
  migrateGoalsToSupabase
};