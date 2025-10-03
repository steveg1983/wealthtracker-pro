/**
 * Budget Service for Supabase Integration
 * Handles all budget CRUD operations with proper sync
 */

import { supabase } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import type { Budget } from '../../types';
import type { Database } from '../../types/supabase';

type BudgetRow = Database['public']['Tables']['budgets']['Row'] & {
  // Project-specific columns not present in generated types
  spent?: number;
  notes?: string | null;
  rollover?: boolean;
};
type BudgetUpdate = Database['public']['Tables']['budgets']['Update'] & {
  spent?: number;
  notes?: string | null;
  rollover?: boolean;
};
import { logger } from '../loggingService';

/**
 * Transforms database snake_case budget record to TypeScript camelCase format
 * @param {BudgetRow} dbBudget - The raw budget data from database
 * @returns {Budget} Transformed budget object with camelCase properties
 * @private
 */
function transformBudgetFromDb(dbBudget: BudgetRow): Budget {
  return {
    id: dbBudget.id,
    name: dbBudget.name,
    amount: dbBudget.amount,
    period: dbBudget.period,
    categoryId: dbBudget.category_id as any,
    spent: (dbBudget.spent as number | undefined) || 0,
    startDate: dbBudget.start_date,
    endDate: dbBudget.end_date,
    isActive: dbBudget.is_active !== false,
    rollover: (dbBudget.rollover as boolean | undefined) || false,
    rolloverAmount: dbBudget.rollover_amount || 0,
    alertThreshold: dbBudget.alert_threshold || 80,
    notes: (dbBudget.notes as string | null) || undefined,
    createdAt: dbBudget.created_at,
    updatedAt: dbBudget.updated_at
  };
}

/**
 * Transforms TypeScript camelCase budget to database snake_case format
 * @param {Partial<Budget>} budget - The budget data in TypeScript format
 * @returns {BudgetUpdate} Transformed budget object for database operations
 * @private
 */
function transformBudgetToDb(budget: Partial<Budget>): BudgetUpdate {
  const dbBudget: BudgetUpdate = {};
  
  if (budget.name !== undefined) dbBudget.name = budget.name;
  if (budget.amount !== undefined) dbBudget.amount = budget.amount;
  if (budget.period !== undefined) dbBudget.period = budget.period as any;
  if (budget.categoryId !== undefined) dbBudget.category_id = budget.categoryId as any;
  if (budget.spent !== undefined) (dbBudget as any).spent = budget.spent;
  if (budget.startDate !== undefined) dbBudget.start_date = budget.startDate;
  if (budget.endDate !== undefined) dbBudget.end_date = budget.endDate;
  if (budget.isActive !== undefined) dbBudget.is_active = budget.isActive;
  if (budget.rollover !== undefined) (dbBudget as any).rollover = budget.rollover;
  if (budget.rolloverAmount !== undefined) dbBudget.rollover_amount = budget.rolloverAmount;
  if (budget.alertThreshold !== undefined) dbBudget.alert_threshold = budget.alertThreshold;
  if (budget.notes !== undefined) (dbBudget as any).notes = budget.notes;
  
  return dbBudget;
}

/**
 * Retrieves all active budgets for a specific user
 * @param {string} clerkId - The Clerk authentication ID of the user
 * @returns {Promise<Budget[]>} Array of active budgets for the user
 * @throws {Error} If Supabase is not configured or database query fails
 * @example
 * const budgets = await getBudgets('clerk_user_123');
 * // Returns: [{id: 'budget-1', name: 'Groceries', amount: 500, ...}]
 */
export async function getBudgets(clerkId: string): Promise<Budget[]> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Convert Clerk ID to database UUID
    const userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      console.log('[BudgetService] No user found, returning empty array');
      return [];
    }
    
    // Get all budgets for the user
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('[BudgetService] Error fetching budgets:', error);
      throw error;
    }
    
    return (data || []).map(transformBudgetFromDb);
    
  } catch (error) {
    logger.error('[BudgetService] Error loading budgets, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const stored = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS);
    return stored || [];
  }
}

/**
 * Retrieves a single budget by its unique identifier
 * @param {string} budgetId - The unique identifier of the budget
 * @returns {Promise<Budget | null>} The budget if found, null otherwise
 * @throws {Error} If database query fails
 * @example
 * const budget = await getBudget('budget-123');
 * if (budget) {
 *   console.log(`Budget amount: ${budget.amount}`);
 * }
 */
export async function getBudget(budgetId: string): Promise<Budget | null> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('id', budgetId)
      .single();
    
    if (error) {
      logger.error('[BudgetService] Error fetching budget:', error);
      throw error;
    }
    
    return data ? transformBudgetFromDb(data) : null;
    
  } catch (error) {
    // Fallback to localStorage
    const budgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS) || [];
    return budgets.find(b => b.id === budgetId) || null;
  }
}

/**
 * Creates a new budget for a user
 * @param {string} clerkId - The Clerk authentication ID of the user
 * @param {Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt'>} budget - Budget data without system fields
 * @returns {Promise<Budget>} The newly created budget with all fields populated
 * @throws {Error} If user not found or budget creation fails
 * @example
 * const newBudget = await createBudget('clerk_user_123', {
 *   name: 'Monthly Groceries',
 *   amount: 500,
 *   period: 'monthly',
 *   categoryId: 'cat-food-123'
 * });
 */
export async function createBudget(
  clerkId: string,
  budget: Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt'>
): Promise<Budget> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      throw new Error('User not found');
    }
    
    const dbBudget = {
      ...transformBudgetToDb(budget),
      user_id: userId,
      spent: 0
    };
    
    const { data, error } = await supabase
      .from('budgets')
      .insert(dbBudget)
      .select()
      .single();
    
    if (error) {
      logger.error('[BudgetService] Error creating budget:', error);
      throw error;
    }
    
    console.log('[BudgetService] Budget created successfully:', data);
    return transformBudgetFromDb(data);
    
  } catch (error) {
    logger.error('[BudgetService] Error creating budget, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const newBudget: Budget = {
      ...budget,
      id: crypto.randomUUID(),
      spent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const budgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS) || [];
    budgets.push(newBudget);
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, budgets);
    
    return newBudget;
  }
}

/**
 * Updates an existing budget with partial data
 * @param {string} budgetId - The unique identifier of the budget to update
 * @param {Partial<Budget>} updates - Partial budget data to update
 * @returns {Promise<Budget>} The updated budget with all fields
 * @throws {Error} If budget not found or update fails
 * @example
 * const updated = await updateBudget('budget-123', {
 *   amount: 600,
 *   alertThreshold: 90
 * });
 */
export async function updateBudget(
  budgetId: string,
  updates: Partial<Budget>
): Promise<Budget> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const dbUpdates = transformBudgetToDb(updates);
    
    const { data, error } = await supabase
      .from('budgets')
      .update(dbUpdates)
      .eq('id', budgetId)
      .select()
      .single();
    
    if (error) {
      logger.error('[BudgetService] Error updating budget:', error);
      throw error;
    }
    
    return transformBudgetFromDb(data);
    
  } catch (error) {
    logger.error('[BudgetService] Error updating budget, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const budgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS) || [];
    const index = budgets.findIndex(b => b.id === budgetId);
    
    if (index !== -1) {
      budgets[index] = { 
        ...budgets[index], 
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await storageAdapter.set(STORAGE_KEYS.BUDGETS, budgets);
      return budgets[index];
    }
    
    throw new Error('Budget not found');
  }
}

/**
 * Delete a budget
 */
export async function deleteBudget(budgetId: string): Promise<void> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId);
    
    if (error) {
      logger.error('[BudgetService] Error deleting budget:', error);
      throw error;
    }
    
    console.log('[BudgetService] Budget deleted successfully');
    
  } catch (error) {
    logger.error('[BudgetService] Error deleting budget, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const budgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS) || [];
    const filtered = budgets.filter(b => b.id !== budgetId);
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, filtered);
  }
}

/**
 * Update budget spent amount
 */
export async function updateBudgetSpent(
  budgetId: string,
  spent: number
): Promise<Budget> {
  return updateBudget(budgetId, { spent });
}

/**
 * Get active budgets for a specific period
 */
export async function getActiveBudgets(
  clerkId: string,
  period?: Budget['period']
): Promise<Budget[]> {
  const allBudgets = await getBudgets(clerkId);
  
  return allBudgets.filter(budget => {
    if (!budget.isActive) return false;
    if (period && budget.period !== period) return false;
    return true;
  });
}

/**
 * Calculate budget progress percentage
 */
export function calculateBudgetProgress(budget: Budget): number {
  if (!budget.amount || budget.amount === 0) return 0;
  return Math.min(100, (budget.spent / budget.amount) * 100);
}

/**
 * Check if budget is over limit
 */
export function isBudgetOverLimit(budget: Budget): boolean {
  return budget.spent > budget.amount;
}

/**
 * Check if budget needs alert
 */
export function shouldAlertBudget(budget: Budget): boolean {
  const progress = calculateBudgetProgress(budget);
  return progress >= (budget.alertThreshold || 80);
}

/**
 * Subscribe to budget changes
 */
export async function subscribeToBudgetChanges(
  clerkId: string,
  callback: (payload: unknown) => void
): Promise<() => void> {
  if (!supabase) {
    return () => {}; // No-op for localStorage
  }

  try {
    const dbUserId = await userIdService.getDatabaseUserId(clerkId);
    
    if (!dbUserId) {
      logger.warn('[BudgetService] No database user found for subscription');
      return () => {};
    }

    const channel = supabase
      .channel(`budgets-${dbUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budgets',
          filter: `user_id=eq.${dbUserId}`
        },
        (payload) => {
          console.log('🔔 [BudgetService] Real-time update received:', payload);
          callback(payload);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
    };
  } catch (error) {
    logger.error('[BudgetService] Error setting up subscription:', error);
    return () => {};
  }
}

// Migrate existing localStorage budgets to Supabase
export async function migrateBudgetsToSupabase(clerkId: string): Promise<void> {
  try {
    const localBudgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS);
    
    if (!localBudgets || localBudgets.length === 0) {
      console.log('[BudgetService] No local budgets to migrate');
      return;
    }
    
    console.log(`[BudgetService] Migrating ${localBudgets.length} budgets to Supabase`);
    
    for (const budget of localBudgets) {
      try {
        // Remove the id so Supabase generates a new one
        const { id, ...budgetData } = budget;
        await createBudget(clerkId, budgetData as any);
      } catch (error) {
        logger.error(`[BudgetService] Failed to migrate budget ${budget.name}:`, error);
      }
    }
    
    // Clear localStorage after successful migration
    await storageAdapter.remove(STORAGE_KEYS.BUDGETS);
    console.log('[BudgetService] Migration completed');
    
  } catch (error) {
    logger.error('[BudgetService] Migration failed:', error);
  }
}

export default {
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  updateBudgetSpent,
  getActiveBudgets,
  calculateBudgetProgress,
  isBudgetOverLimit,
  shouldAlertBudget,
  subscribeToBudgetChanges,
  migrateBudgetsToSupabase
};
