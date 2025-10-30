/**
 * Goal Service for Supabase Integration
 * Handles all goal CRUD operations with proper sync
 */

import { supabase } from '@wealthtracker/core';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import type { Goal } from '../../types';
import type { Database, Json } from '@app-types/supabase';

type GoalRow = Database['public']['Tables']['goals']['Row'];
type GoalInsert = Database['public']['Tables']['goals']['Insert'];
type GoalUpdate = Database['public']['Tables']['goals']['Update'];
import { logger } from '../loggingService';

const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

const generateGoalId = (): string => {
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `goal-${Math.random().toString(36).slice(2, 10)}`;
};

type GoalPriorityValue = Exclude<Goal['priority'], undefined>;
type GoalStatusValue = Exclude<Goal['status'], undefined>;

const GOAL_TYPES: ReadonlySet<Goal['type']> = new Set(['savings', 'debt-payoff', 'investment', 'custom']);
const GOAL_PRIORITIES: ReadonlySet<GoalPriorityValue> = new Set(['low', 'medium', 'high']);
const GOAL_STATUSES: ReadonlySet<GoalStatusValue> = new Set(['active', 'completed', 'paused']);
const CONTRIBUTION_FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'yearly']);

type GoalMetadata = Record<string, Json>;

const toIsoString = (value: Date | string | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const toDate = (value: Date | string | null | undefined, fallback: Date): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
};

const resolveGoalType = (value: string | null | undefined): Goal['type'] => {
  if (typeof value === 'string' && GOAL_TYPES.has(value as Goal['type'])) {
    return value as Goal['type'];
  }
  return 'savings';
};

const resolveGoalPriority = (value: string | null | undefined): GoalPriorityValue => {
  if (typeof value === 'string' && GOAL_PRIORITIES.has(value as GoalPriorityValue)) {
    return value as GoalPriorityValue;
  }
  return 'medium';
};

const resolveGoalStatus = (value: string | null | undefined): GoalStatusValue => {
  if (typeof value === 'string' && GOAL_STATUSES.has(value as GoalStatusValue)) {
    return value as GoalStatusValue;
  }
  return 'active';
};

const normalizeFrequencyForDb = (value: string | null | undefined): GoalUpdate['contribution_frequency'] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return CONTRIBUTION_FREQUENCIES.has(value)
    ? (value as GoalUpdate['contribution_frequency'])
    : null;
};

const buildGoalMetadata = (goal: Partial<Goal>): Json | undefined => {
  const metadata: GoalMetadata = {};

  if ('type' in goal && goal.type) {
    metadata.type = goal.type;
  }

  if ('linkedAccountIds' in goal) {
    const ids = Array.isArray(goal.linkedAccountIds)
      ? goal.linkedAccountIds
          .map(id => (typeof id === 'string' ? id.trim() : String(id ?? '').trim()))
          .filter(id => id.length > 0)
      : [];
    metadata.linkedAccountIds = ids;
  }

  if ('icon' in goal) {
    const icon = (goal as { icon?: string | null }).icon;
    metadata.icon =
      typeof icon === 'string' && icon.trim().length > 0
        ? icon
        : null;
  }

  if ('color' in goal) {
    const color = (goal as { color?: string | null }).color;
    metadata.color =
      typeof color === 'string' && color.trim().length > 0
        ? color
        : null;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

/**
 * Transforms database snake_case goal record to TypeScript camelCase format
 * @param {GoalRow} dbGoal - The raw goal data from database
 * @returns {Goal} Transformed goal object with camelCase properties and calculated progress
 * @private
 */
function transformGoalFromDb(dbGoal: GoalRow): Goal {
  const now = new Date();
  const targetAmount = Number(dbGoal.target_amount ?? 0);
  const currentAmount = Number(dbGoal.current_amount ?? 0);
  const metadata =
    dbGoal.metadata && typeof dbGoal.metadata === 'object' && !Array.isArray(dbGoal.metadata)
      ? (dbGoal.metadata as Record<string, Json>)
      : {};

  const goal: Goal = {
    id: dbGoal.id,
    name: dbGoal.name ?? 'Goal',
    type: resolveGoalType(
      (metadata.type as string | undefined) ?? (dbGoal as { type?: string }).type
    ),
    targetAmount,
    currentAmount,
    targetDate: toDate(dbGoal.target_date, now),
    isActive: (dbGoal as { is_active?: boolean }).is_active ?? true,
    createdAt: toDate(dbGoal.created_at, now),
    progress: targetAmount === 0 ? 0 : (currentAmount / targetAmount) * 100,
    updatedAt: toDate(dbGoal.updated_at, now),
    priority: resolveGoalPriority((dbGoal as { priority?: string }).priority),
    status: resolveGoalStatus((dbGoal as { status?: string }).status),
  };

  if (dbGoal.description !== null && dbGoal.description !== undefined) {
    goal.description = dbGoal.description;
  }
  if (dbGoal.category !== null && dbGoal.category !== undefined) {
    goal.category = dbGoal.category;
  }
  if (dbGoal.auto_contribute !== null && dbGoal.auto_contribute !== undefined) {
    goal.autoContribute = dbGoal.auto_contribute;
  }
  if (dbGoal.contribution_amount !== null && dbGoal.contribution_amount !== undefined) {
    goal.contributionAmount = dbGoal.contribution_amount;
  }
  if (dbGoal.contribution_frequency) {
    if (CONTRIBUTION_FREQUENCIES.has(dbGoal.contribution_frequency)) {
      goal.contributionFrequency = dbGoal.contribution_frequency;
    }
  }
  const icon = metadata.icon;
  if (typeof icon === 'string' && icon.trim().length > 0) {
    goal.icon = icon;
  }

  const color = metadata.color;
  if (typeof color === 'string' && color.trim().length > 0) {
    goal.color = color;
  }
  const linkedAccountIds = metadata.linkedAccountIds;
  if (Array.isArray(linkedAccountIds)) {
    const ids = linkedAccountIds
      .map(id => (typeof id === 'string' ? id : undefined))
      .filter((value): value is string => Boolean(value));
    if (ids.length > 0) {
      goal.linkedAccountIds = ids;
    }
  }
  if (dbGoal.completed_at) {
    goal.completedAt = dbGoal.completed_at;
  }

  return goal;
}

const buildGoalInsert = (
  userId: string,
  goal: Omit<Goal, 'id' | 'progress' | 'createdAt' | 'updatedAt'>
): GoalInsert => {
  const nowIso = new Date().toISOString();
  const targetAmount = goal.targetAmount ?? 0;
  const currentAmount = goal.currentAmount ?? 0;

  const insert: GoalInsert = {
    user_id: userId,
    name: goal.name ?? 'Goal',
    description: goal.description ?? null,
    target_amount: targetAmount,
    current_amount: currentAmount,
    target_date: goal.targetDate ? toIsoString(goal.targetDate) ?? null : null,
    category: goal.category ?? null,
    priority: resolveGoalPriority(goal.priority),
    status: resolveGoalStatus(goal.status),
    auto_contribute: goal.autoContribute ?? false,
    contribution_amount: goal.contributionAmount ?? null,
    contribution_frequency: normalizeFrequencyForDb(goal.contributionFrequency) ?? null,
    created_at: nowIso,
    updated_at: nowIso,
    completed_at: goal.completedAt ? toIsoString(goal.completedAt) ?? null : null
  };

  const metadata = buildGoalMetadata(goal);
  if (metadata) {
    insert.metadata = metadata;
  }

  return insert;
};

const buildGoalUpdate = (goal: Partial<Goal>): GoalUpdate => {
  const update: GoalUpdate = {};

  if (goal.name !== undefined) {
    update.name = goal.name;
  }
  if (goal.description !== undefined) {
    update.description = goal.description ?? null;
  }
  if (goal.targetAmount !== undefined) {
    update.target_amount = goal.targetAmount;
  }
  if (goal.currentAmount !== undefined) {
    update.current_amount = goal.currentAmount;
  }
  if (goal.targetDate !== undefined) {
    update.target_date = goal.targetDate ? toIsoString(goal.targetDate) ?? null : null;
  }
  if (goal.category !== undefined) {
    update.category = goal.category ?? null;
  }
  if (goal.priority !== undefined) {
    update.priority = resolveGoalPriority(goal.priority);
  }
  if (goal.status !== undefined) {
    update.status = resolveGoalStatus(goal.status);
  }
  if (goal.autoContribute !== undefined) {
    update.auto_contribute = goal.autoContribute;
  }
  if (goal.contributionAmount !== undefined) {
    update.contribution_amount = goal.contributionAmount ?? null;
  }
  if (goal.contributionFrequency !== undefined) {
    update.contribution_frequency = normalizeFrequencyForDb(goal.contributionFrequency) ?? null;
  }
  if (goal.completedAt !== undefined) {
    update.completed_at = goal.completedAt ? toIsoString(goal.completedAt) ?? null : null;
  }

  const metadata = buildGoalMetadata(goal);
  if (metadata !== undefined) {
    update.metadata = metadata;
  }

  return update;
};

/**
 * Retrieves all goals for a specific user
 * @param {string} clerkId - The Clerk authentication ID of the user
 * @returns {Promise<Goal[]>} Array of goals sorted by creation date (newest first)
 * @throws {Error} If Supabase is not configured or database query fails
 * @example
 * const goals = await getGoals('clerk_user_123');
 * // Returns: [{id: 'goal-1', name: 'Emergency Fund', targetAmount: 10000, ...}]
 */
export async function getGoals(clerkId: string): Promise<Goal[]> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Convert Clerk ID to database UUID
    const userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      logger.info('[GoalService] No user found, returning empty array');
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
 * Retrieves a single goal by its unique identifier
 * @param {string} goalId - The unique identifier of the goal
 * @returns {Promise<Goal | null>} The goal if found, null otherwise
 * @throws {Error} If database query fails
 * @example
 * const goal = await getGoal('goal-123');
 * if (goal) {
 *   logger.info(`Progress: ${goal.progress}%`);
 * }
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

  } catch {
    // Fallback to localStorage
    const goals = await storageAdapter.get<Goal[]>(STORAGE_KEYS.GOALS) || [];
    return goals.find(g => g.id === goalId) || null;
  }
}

/**
 * Creates a new financial goal for a user
 * @param {string} clerkId - The Clerk authentication ID of the user
 * @param {Omit<Goal, 'id' | 'progress' | 'createdAt' | 'updatedAt'>} goal - Goal data without system fields
 * @returns {Promise<Goal>} The newly created goal with all fields populated
 * @throws {Error} If user not found or goal creation fails
 * @example
 * const newGoal = await createGoal('clerk_user_123', {
 *   name: 'New Car',
 *   targetAmount: 25000,
 *   targetDate: '2025-12-31',
 *   category: 'savings'
 * });
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
    
    const dbGoal = buildGoalInsert(userId, goal);

    const { data, error } = await supabase
      .from('goals')
      .insert(dbGoal)
      .select()
      .single();
    
    if (error) {
      logger.error('[GoalService] Error creating goal:', error);
      throw error;
    }
    
    logger.info('[GoalService] Goal created successfully');
    return transformGoalFromDb(data);
    
  } catch (error) {
    logger.error('[GoalService] Error creating goal, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const timestamp = new Date();
    const targetAmount = goal.targetAmount ?? 0;
    const currentAmount = goal.currentAmount ?? 0;
    const newGoal: Goal = {
      ...goal,
      id: generateGoalId(),
      type: resolveGoalType(goal.type),
      targetAmount,
      currentAmount,
      progress: targetAmount === 0 ? 0 : (currentAmount / targetAmount) * 100,
      createdAt: timestamp,
      updatedAt: timestamp,
      priority: resolveGoalPriority(goal.priority),
      status: resolveGoalStatus(goal.status),
      isActive: goal.isActive ?? true,
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
    
    const dbUpdates = buildGoalUpdate(updates);
    dbUpdates.updated_at = new Date().toISOString();
    
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
      const existing = goals[index];
      if (!existing) {
        throw new Error('Goal not found after update');
      }

      const timestamp = new Date();
      const merged: Goal = {
        ...existing,
        ...updates,
        targetAmount: updates.targetAmount ?? existing.targetAmount,
        currentAmount: updates.currentAmount ?? existing.currentAmount,
        updatedAt: timestamp,
      };

      const { targetAmount, currentAmount } = merged;
      merged.progress = targetAmount === 0 ? 0 : (currentAmount / targetAmount) * 100;

      if (updates.status === 'completed' && !merged.completedAt) {
        merged.completedAt = new Date().toISOString();
      }

      goals[index] = merged;
      await storageAdapter.set(STORAGE_KEYS.GOALS, goals);
      return merged;
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
    
    logger.info('[GoalService] Goal deleted successfully');
    
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
    const payload: Partial<Goal> = {
      currentAmount: newAmount,
    };
    if (isCompleted) {
      payload.status = 'completed';
      payload.completedAt = new Date().toISOString();
    } else if (goal.status && GOAL_STATUSES.has(goal.status)) {
      payload.status = goal.status;
    }

    const updatedGoal = await updateGoal(goalId, payload);
    
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
  callback: (payload: unknown) => void
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
          logger.debug('[GoalService] Real-time update received', payload);
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
      logger.info('[GoalService] No local goals to migrate');
      return;
    }
    
    logger.info('[GoalService] Migrating goals to Supabase', { count: localGoals.length });
    
    for (const goal of localGoals) {
      try {
        // Remove the id and progress so Supabase generates new ones
        const { id, progress, createdAt, updatedAt, ...goalData } = goal;
        await createGoal(clerkId, goalData);
      } catch (error) {
        logger.error(`[GoalService] Failed to migrate goal ${goal.name}:`, error);
      }
    }
    
    // Clear localStorage after successful migration
    await storageAdapter.remove(STORAGE_KEYS.GOALS);
    logger.info('[GoalService] Migration completed');
    
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
