/**
 * Budget Service for Supabase Integration
 * Handles all budget CRUD operations with proper sync
 */

import { supabase } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import type { Budget } from '../../types';
import type { Database, Json } from '../../types/supabase';
import { logger } from '../loggingService';

type BudgetsTable = Database['public']['Tables']['budgets'];
type BudgetRow = BudgetsTable['Row'];
type BudgetInsert = BudgetsTable['Insert'];
type BudgetUpdate = BudgetsTable['Update'];

interface BudgetMetadata {
  spent?: number;
  notes?: string;
  color?: string;
  budgeted?: number;
  limit?: number;
}

const parseBudgetMetadata = (metadata: Json | null | undefined): BudgetMetadata => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const record = metadata as Record<string, unknown>;
  const result: BudgetMetadata = {};

  if (typeof record.spent === 'number') result.spent = record.spent;
  if (typeof record.notes === 'string') result.notes = record.notes;
  if (typeof record.color === 'string') result.color = record.color;
  if (typeof record.budgeted === 'number') result.budgeted = record.budgeted;
  if (typeof record.limit === 'number') result.limit = record.limit;

  return result;
};

const serialiseBudgetMetadata = (metadata: BudgetMetadata): Json | undefined => {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return undefined;
  }

  const jsonObject: Record<string, Json> = {};
  for (const [key, value] of entries) {
    jsonObject[key] = (value ?? null) as Json;
  }
  return jsonObject;
};

const mergeBudgetMetadata = (
  existing: BudgetMetadata,
  updates: Partial<Budget>
): BudgetMetadata => {
  const merged: BudgetMetadata = { ...existing };

  if ('spent' in updates) {
    if (updates.spent === undefined) {
      delete merged.spent;
    } else {
      merged.spent = updates.spent;
    }
  }

  if ('notes' in updates) {
    if (updates.notes === undefined) {
      delete merged.notes;
    } else {
      merged.notes = updates.notes;
    }
  }

  if ('color' in updates) {
    if (updates.color === undefined) {
      delete merged.color;
    } else {
      merged.color = updates.color;
    }
  }

  if ('budgeted' in updates) {
    if (updates.budgeted === undefined) {
      delete merged.budgeted;
    } else {
      merged.budgeted = updates.budgeted;
    }
  }

  if ('limit' in updates) {
    if (updates.limit === undefined) {
      delete merged.limit;
    } else {
      merged.limit = updates.limit;
    }
  }

  return merged;
};

const mapPeriodToSupabase = (
  period: Budget['period']
): BudgetInsert['period'] => {
  if (period === 'quarterly') {
    return 'custom';
  }
  return period;
};

const mapBudgetRowToDomain = (row: BudgetRow): Budget => {
  const metadata = parseBudgetMetadata(row.metadata);
  const spent = metadata.spent ?? 0;

  const budget: Budget = {
    id: row.id,
    name: row.name,
    categoryId: row.category_id ?? '',
    amount: row.amount,
    period: row.period,
    isActive: row.is_active,
    spent,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };

  if (row.name) budget.name = row.name;
  if (row.start_date) budget.startDate = row.start_date;
  if (row.end_date) budget.endDate = row.end_date;
  if (row.rollover_enabled !== undefined) budget.rollover = row.rollover_enabled;
  if (row.rollover_amount !== undefined && row.rollover_amount !== null) {
    budget.rolloverAmount = row.rollover_amount;
  }
  if (row.alert_threshold !== undefined && row.alert_threshold !== null) {
    budget.alertThreshold = row.alert_threshold;
  }
  if (metadata.notes !== undefined) budget.notes = metadata.notes;
  if (metadata.color !== undefined) budget.color = metadata.color;
  if (metadata.budgeted !== undefined) budget.budgeted = metadata.budgeted;
  if (metadata.limit !== undefined) budget.limit = metadata.limit;

  return budget;
};

const normaliseBudget = (
  raw: Budget | (Budget & Record<string, unknown>)
): Budget => {
  const candidate = raw as Budget & {
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  const createdAt = candidate.createdAt instanceof Date
    ? candidate.createdAt
    : candidate.createdAt
      ? new Date(candidate.createdAt)
      : new Date();

  const updatedAt = candidate.updatedAt instanceof Date
    ? candidate.updatedAt
    : candidate.updatedAt
      ? new Date(candidate.updatedAt)
      : createdAt;

  const normalised: Budget = {
    id: candidate.id,
    name: candidate.name ?? 'Untitled Budget',
    categoryId: candidate.categoryId ?? '',
    amount: candidate.amount ?? 0,
    period: candidate.period ?? 'monthly',
    isActive: candidate.isActive ?? true,
    spent: candidate.spent ?? 0,
    createdAt,
    updatedAt
  };

  if (candidate.startDate !== undefined) normalised.startDate = candidate.startDate;
  if (candidate.endDate !== undefined) normalised.endDate = candidate.endDate;
  if (candidate.rollover !== undefined) normalised.rollover = candidate.rollover;
  if (candidate.rolloverAmount !== undefined) normalised.rolloverAmount = candidate.rolloverAmount;
  if (candidate.alertThreshold !== undefined) normalised.alertThreshold = candidate.alertThreshold;
  if (candidate.notes !== undefined) normalised.notes = candidate.notes;
  if (candidate.color !== undefined) normalised.color = candidate.color;
  if (candidate.budgeted !== undefined) normalised.budgeted = candidate.budgeted;
  if (candidate.limit !== undefined) normalised.limit = candidate.limit;

  return normalised;
};

const buildBudgetInsert = (
  userId: string,
  budget: Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt'>
): BudgetInsert => {
  const nowIso = new Date().toISOString();

  const metadataInput: BudgetMetadata = {
    spent: 0
  };
  if (budget.notes !== undefined) metadataInput.notes = budget.notes;
  if (budget.color !== undefined) metadataInput.color = budget.color;
  if (budget.budgeted !== undefined) metadataInput.budgeted = budget.budgeted;
  if (budget.limit !== undefined) metadataInput.limit = budget.limit;

  const metadata = serialiseBudgetMetadata(metadataInput);
  const initialAlertThreshold = budget.alertThreshold ?? 80;
  const initialAlertEnabled = budget.alertThreshold !== undefined ? budget.alertThreshold > 0 : true;

  const insert: BudgetInsert = {
    user_id: userId,
    name: budget.name ?? 'Untitled Budget',
    amount: budget.amount,
    period: mapPeriodToSupabase(budget.period),
    category_id: budget.categoryId ?? null,
    start_date: budget.startDate ?? nowIso,
    end_date: budget.endDate ?? null,
    rollover_enabled: budget.rollover ?? false,
    rollover_amount: budget.rolloverAmount ?? 0,
    alert_enabled: initialAlertEnabled,
    alert_threshold: initialAlertThreshold,
    is_active: budget.isActive,
    created_at: nowIso,
    updated_at: nowIso
  };

  if (metadata !== undefined) {
    insert.metadata = metadata;
  }

  return insert;
};

const buildBudgetUpdate = (
  existingMeta: BudgetMetadata,
  updates: Partial<Budget>
): BudgetUpdate => {
  const update: BudgetUpdate = {
    updated_at: new Date().toISOString()
  };

  if (updates.name !== undefined) update.name = updates.name ?? 'Untitled Budget';
  if (updates.amount !== undefined) update.amount = updates.amount;
  if (updates.period !== undefined) update.period = mapPeriodToSupabase(updates.period);
  if (updates.categoryId !== undefined) update.category_id = updates.categoryId ?? null;
  if (updates.startDate !== undefined) update.start_date = updates.startDate ?? new Date().toISOString();
  if (updates.endDate !== undefined) update.end_date = updates.endDate ?? null;
  if (updates.isActive !== undefined) update.is_active = updates.isActive;
  if (updates.rollover !== undefined) update.rollover_enabled = updates.rollover;
  if (updates.rolloverAmount !== undefined) update.rollover_amount = updates.rolloverAmount ?? 0;
  if ('alertThreshold' in updates) {
    const thresholdValue = updates.alertThreshold ?? 0;
    update.alert_threshold = thresholdValue;
    update.alert_enabled = thresholdValue > 0;
  }

  const mergedMetadata = mergeBudgetMetadata(existingMeta, updates);
  const metadata = serialiseBudgetMetadata(mergedMetadata);
  if (metadata !== undefined) {
    update.metadata = metadata;
  }

  return update;
};

/**
 * Retrieves all active budgets for a specific user
 */
export async function getBudgets(clerkId: string): Promise<Budget[]> {
  try {
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }

    const userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      logger.info('[BudgetService] No user found, returning empty array');
      return [];
    }

    const { data, error } = await client
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[BudgetService] Error fetching budgets:', error);
      throw error;
    }

    return (data ?? []).map(mapBudgetRowToDomain);
  } catch (error) {
    logger.error('[BudgetService] Error loading budgets, falling back to localStorage:', error);
    const stored = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS);
    return (stored ?? []).map(normaliseBudget);
  }
}

/**
 * Retrieves a single budget by its unique identifier
 */
export async function getBudget(budgetId: string): Promise<Budget | null> {
  try {
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await client
      .from('budgets')
      .select('*')
      .eq('id', budgetId)
      .single();

    if (error) {
      logger.error('[BudgetService] Error fetching budget:', error);
      throw error;
    }

    return data ? mapBudgetRowToDomain(data) : null;
  } catch (error) {
    const budgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS) || [];
    const found = budgets.find(b => b.id === budgetId);
    return found ? normaliseBudget(found) : null;
  }
}

/**
 * Creates a new budget for a user
 */
export async function createBudget(
  clerkId: string,
  budget: Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt'>
): Promise<Budget> {
  try {
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }

    const userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      throw new Error('User not found');
    }

    const insertPayload = buildBudgetInsert(userId, budget);

    const { data, error } = await client
      .from('budgets')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      logger.error('[BudgetService] Error creating budget:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Budget creation returned no data');
    }

    logger.info('[BudgetService] Budget created successfully');
    return mapBudgetRowToDomain(data);
  } catch (error) {
    logger.error('[BudgetService] Error creating budget, falling back to localStorage:', error);

    const now = new Date();
    const newBudget: Budget = normaliseBudget({
      ...budget,
      id: crypto.randomUUID(),
      spent: 0,
      createdAt: now,
      updatedAt: now
    } as Budget);

    const budgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS) || [];
    budgets.push(newBudget);
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, budgets);

    return newBudget;
  }
}

/**
 * Updates an existing budget with partial data
 */
export async function updateBudget(
  budgetId: string,
  updates: Partial<Budget>
): Promise<Budget> {
  try {
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }

    const { data: existing, error: existingError } = await client
      .from('budgets')
      .select('metadata')
      .eq('id', budgetId)
      .single();

    if (existingError) {
      logger.error('[BudgetService] Unable to load existing budget metadata:', existingError);
      throw existingError;
    }

    const existingMetadata = parseBudgetMetadata(existing?.metadata);
    const updatePayload = buildBudgetUpdate(existingMetadata, updates);

    const { data, error } = await client
      .from('budgets')
      .update(updatePayload)
      .eq('id', budgetId)
      .select()
      .single();

    if (error) {
      logger.error('[BudgetService] Error updating budget:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Budget update returned no data');
    }

    return mapBudgetRowToDomain(data);
  } catch (error) {
    logger.error('[BudgetService] Error updating budget, falling back to localStorage:', error);

    const budgets = await storageAdapter.get<Budget[]>(STORAGE_KEYS.BUDGETS) || [];
    const index = budgets.findIndex(b => b.id === budgetId);

    if (index === -1) {
      throw error instanceof Error ? error : new Error('Budget not found');
    }

    const existingBudget = budgets[index];
    if (!existingBudget) {
      throw error instanceof Error ? error : new Error('Budget not found');
    }

    const current = normaliseBudget(existingBudget);
    const updated: Budget = normaliseBudget({
      ...current,
      ...updates,
      updatedAt: new Date()
    } as Budget);

    budgets[index] = updated;
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, budgets);
    return updated;
  }
}

/**
 * Delete a budget
 */
export async function deleteBudget(budgetId: string): Promise<void> {
  try {
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }

    const { error } = await client
      .from('budgets')
      .delete()
      .eq('id', budgetId);

    if (error) {
      logger.error('[BudgetService] Error deleting budget:', error);
      throw error;
    }
  } catch (error) {
    logger.error('[BudgetService] Error deleting budget, falling back to localStorage:', error);

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
  const threshold = budget.alertThreshold ?? 80;
  return progress >= threshold;
}

/**
 * Subscribe to budget changes
 */
export async function subscribeToBudgetChanges(
  clerkId: string,
  callback: (payload: unknown) => void
): Promise<() => void> {
  const client = supabase;
  if (!client) {
    return () => {};
  }

  try {
    const dbUserId = await userIdService.getDatabaseUserId(clerkId);

    if (!dbUserId) {
      logger.warn('[BudgetService] No database user found for subscription');
      return () => {};
    }

    const channel = client
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
          logger.debug('[BudgetService] Real-time update received', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        logger.debug('[BudgetService] Subscription status', { status });
      });

    return () => {
      client.removeChannel(channel);
    };
  } catch (error) {
    logger.error('[BudgetService] Error subscribing to budget changes:', error);
    return () => {};
  }
}
