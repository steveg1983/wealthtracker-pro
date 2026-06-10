/**
 * Planning data persistence: budgets, goals, categories.
 *
 * Until 2026-06 these entities lived ONLY in React state — every budget and
 * goal was lost on page refresh, and nothing reached the cloud tables that
 * have existed since the initial schema.
 *
 * Budgets and goals: Supabase when configured (per-user, RLS-scoped), with
 * encrypted localStorage as the offline fallback.
 *
 * Categories: persisted to encrypted localStorage only for now. The default
 * category set uses non-UUID ids ('type-income', 'transfer-in', …) which the
 * uuid-keyed cloud table cannot store without an id-migration pass — tracked
 * as a P3 item in AUDIT_2026-06-10.md.
 */

import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { createScopedLogger } from '../../loggers/scopedLogger';
import type { Budget, Goal, Category } from '../../types';

const logger = createScopedLogger('PlanningService');

type Row = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ── Budget mapping ───────────────────────────────────────────────────────────

const budgetFromDb = (row: Row): Budget => ({
  id: String(row.id),
  // categoryId travels in the text `category` column — frontend category ids
  // are not UUIDs, so the uuid `category_id` column cannot hold them.
  categoryId: str(row.category) ?? '',
  amount: num(row.amount),
  period: (str(row.period) ?? 'monthly') as Budget['period'],
  isActive: row.is_active !== false,
  createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(),
  updatedAt: row.updated_at ? new Date(String(row.updated_at)) : new Date(),
  name: str(row.name),
  spent: num(row.spent),
  startDate: str(row.start_date),
  endDate: str(row.end_date),
  rollover: row.rollover === true,
  rolloverAmount: num(row.rollover_amount),
  alertThreshold: typeof row.alert_threshold === 'number' ? row.alert_threshold : undefined,
  notes: str(row.notes)
});

const budgetToDb = (b: Partial<Budget>, userId?: string): Row => {
  const row: Row = {};
  if (userId) row.user_id = userId;
  if (b.name !== undefined || b.categoryId !== undefined) {
    row.name = b.name ?? b.categoryId ?? 'Budget';
  }
  if (b.categoryId !== undefined) row.category = b.categoryId;
  if (b.amount !== undefined) row.amount = b.amount;
  if (b.period !== undefined) row.period = b.period;
  if (b.isActive !== undefined) row.is_active = b.isActive;
  if (b.spent !== undefined) row.spent = b.spent;
  if (b.startDate !== undefined) row.start_date = b.startDate;
  if (b.endDate !== undefined) row.end_date = b.endDate;
  if (b.rollover !== undefined) row.rollover = b.rollover;
  if (b.rolloverAmount !== undefined) row.rollover_amount = b.rolloverAmount;
  if (b.alertThreshold !== undefined) row.alert_threshold = b.alertThreshold;
  if (b.notes !== undefined) row.notes = b.notes;
  return row;
};

// ── Goal mapping ─────────────────────────────────────────────────────────────

const goalFromDb = (row: Row): Goal => {
  const metadata = (row.metadata ?? {}) as Row;
  const currentAmount = num(row.current_amount);
  return {
    id: String(row.id),
    name: str(row.name) ?? '',
    type: (str(metadata.type) ?? 'savings') as Goal['type'],
    targetAmount: num(row.target_amount),
    currentAmount,
    progress: currentAmount,
    targetDate: row.target_date ? new Date(String(row.target_date)) : new Date(),
    description: str(row.description),
    isActive: str(row.status) !== 'paused',
    achieved: str(row.status) === 'completed',
    status: (str(row.status) ?? 'active') as Goal['status'],
    createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)) : new Date(),
    category: str(row.category),
    priority: str(row.priority) as Goal['priority'],
    accountId: str(row.account_id) ?? undefined,
    autoContribute: row.auto_contribute === true,
    contributionFrequency: str(row.contribution_frequency),
    icon: str(row.icon),
    color: str(row.color),
    linkedAccountIds: Array.isArray(metadata.linkedAccountIds)
      ? (metadata.linkedAccountIds as string[])
      : undefined,
    contributionAmount: typeof metadata.contributionAmount === 'number'
      ? metadata.contributionAmount
      : undefined
  };
};

const goalToDb = (g: Partial<Goal>, userId?: string): Row => {
  const row: Row = {};
  if (userId) row.user_id = userId;
  if (g.name !== undefined) row.name = g.name;
  if (g.description !== undefined) row.description = g.description;
  if (g.targetAmount !== undefined) row.target_amount = g.targetAmount;
  // `progress` is the canonical accumulated amount in the UI layer.
  if (g.progress !== undefined) row.current_amount = g.progress;
  else if (g.currentAmount !== undefined) row.current_amount = g.currentAmount;
  if (g.targetDate !== undefined) {
    row.target_date = g.targetDate instanceof Date
      ? g.targetDate.toISOString().slice(0, 10)
      : g.targetDate;
  }
  if (g.category !== undefined) row.category = g.category;
  if (g.priority !== undefined) row.priority = g.priority;
  if (g.status !== undefined) row.status = g.status;
  else if (g.achieved === true) row.status = 'completed';
  if (g.accountId !== undefined) row.account_id = g.accountId || null;
  if (g.autoContribute !== undefined) row.auto_contribute = g.autoContribute;
  if (g.contributionFrequency !== undefined) row.contribution_frequency = g.contributionFrequency || null;
  if (g.icon !== undefined) row.icon = g.icon;
  if (g.color !== undefined) row.color = g.color;
  // Fields without dedicated columns ride in metadata.
  if (g.type !== undefined || g.linkedAccountIds !== undefined || g.contributionAmount !== undefined) {
    row.metadata = {
      ...(g.type !== undefined ? { type: g.type } : {}),
      ...(g.linkedAccountIds !== undefined ? { linkedAccountIds: g.linkedAccountIds } : {}),
      ...(g.contributionAmount !== undefined ? { contributionAmount: g.contributionAmount } : {})
    };
  }
  return row;
};

// ── Local fallback helpers ───────────────────────────────────────────────────

const readLocal = async <T>(key: string): Promise<T[]> => {
  const stored = await storageAdapter.get<T[]>(key);
  return stored || [];
};

const writeLocal = async <T>(key: string, items: T[]): Promise<void> => {
  await storageAdapter.set(key, items);
};

// ── Service ──────────────────────────────────────────────────────────────────

export class PlanningService {
  private static get cloudReady(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  // ----- Budgets -----

  static async getBudgets(userId: string | null): Promise<Budget[]> {
    if (this.cloudReady && userId) {
      const { data, error } = await supabase!
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) {
        logger.error('getBudgets failed, using local fallback', error);
        return readLocal<Budget>(STORAGE_KEYS.BUDGETS);
      }
      return ((data ?? []) as Row[]).map(budgetFromDb);
    }
    return readLocal<Budget>(STORAGE_KEYS.BUDGETS);
  }

  static async createBudget(userId: string | null, budget: Omit<Budget, 'id' | 'spent'>): Promise<Budget> {
    if (this.cloudReady && userId) {
      const row = budgetToDb({ ...budget, spent: 0 }, userId);
      if (!row.start_date) row.start_date = new Date().toISOString().slice(0, 10);
      if (!row.name) row.name = budget.categoryId || 'Budget';
      const { data, error } = await supabase!
        .from('budgets')
        .insert(row as never)
        .select()
        .single();
      if (error) throw new Error(handleSupabaseError(error));
      return budgetFromDb(data as Row);
    }

    const newBudget: Budget = {
      ...budget,
      id: crypto.randomUUID(),
      spent: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const budgets = await readLocal<Budget>(STORAGE_KEYS.BUDGETS);
    budgets.push(newBudget);
    await writeLocal(STORAGE_KEYS.BUDGETS, budgets);
    return newBudget;
  }

  static async updateBudget(userId: string | null, id: string, updates: Partial<Budget>): Promise<Budget> {
    if (this.cloudReady && userId) {
      const { data, error } = await supabase!
        .from('budgets')
        .update(budgetToDb(updates) as never)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new Error(handleSupabaseError(error));
      return budgetFromDb(data as Row);
    }

    const budgets = await readLocal<Budget>(STORAGE_KEYS.BUDGETS);
    const index = budgets.findIndex(b => b.id === id);
    if (index === -1) throw new Error('Budget not found');
    budgets[index] = { ...budgets[index], ...updates, updatedAt: new Date() };
    await writeLocal(STORAGE_KEYS.BUDGETS, budgets);
    return budgets[index];
  }

  static async deleteBudget(userId: string | null, id: string): Promise<void> {
    if (this.cloudReady && userId) {
      const { error } = await supabase!
        .from('budgets')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw new Error(handleSupabaseError(error));
      return;
    }

    const budgets = await readLocal<Budget>(STORAGE_KEYS.BUDGETS);
    await writeLocal(STORAGE_KEYS.BUDGETS, budgets.filter(b => b.id !== id));
  }

  // ----- Goals -----

  static async getGoals(userId: string | null): Promise<Goal[]> {
    if (this.cloudReady && userId) {
      const { data, error } = await supabase!
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) {
        logger.error('getGoals failed, using local fallback', error);
        return readLocal<Goal>(STORAGE_KEYS.GOALS);
      }
      return ((data ?? []) as Row[]).map(goalFromDb);
    }
    return readLocal<Goal>(STORAGE_KEYS.GOALS);
  }

  static async createGoal(userId: string | null, goal: Omit<Goal, 'id' | 'progress'>): Promise<Goal> {
    if (this.cloudReady && userId) {
      const row = goalToDb({ ...goal, progress: 0 }, userId);
      const { data, error } = await supabase!
        .from('goals')
        .insert(row as never)
        .select()
        .single();
      if (error) throw new Error(handleSupabaseError(error));
      return goalFromDb(data as Row);
    }

    const newGoal: Goal = {
      ...goal,
      id: crypto.randomUUID(),
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Goal;
    const goals = await readLocal<Goal>(STORAGE_KEYS.GOALS);
    goals.push(newGoal);
    await writeLocal(STORAGE_KEYS.GOALS, goals);
    return newGoal;
  }

  static async updateGoal(userId: string | null, id: string, updates: Partial<Goal>): Promise<Goal> {
    if (this.cloudReady && userId) {
      const { data, error } = await supabase!
        .from('goals')
        .update(goalToDb(updates) as never)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new Error(handleSupabaseError(error));
      return goalFromDb(data as Row);
    }

    const goals = await readLocal<Goal>(STORAGE_KEYS.GOALS);
    const index = goals.findIndex(g => g.id === id);
    if (index === -1) throw new Error('Goal not found');
    goals[index] = { ...goals[index], ...updates, updatedAt: new Date() };
    await writeLocal(STORAGE_KEYS.GOALS, goals);
    return goals[index];
  }

  static async deleteGoal(userId: string | null, id: string): Promise<void> {
    if (this.cloudReady && userId) {
      const { error } = await supabase!
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw new Error(handleSupabaseError(error));
      return;
    }

    const goals = await readLocal<Goal>(STORAGE_KEYS.GOALS);
    await writeLocal(STORAGE_KEYS.GOALS, goals.filter(g => g.id !== id));
  }

  // ----- Categories (local persistence only — see header note) -----

  static async getCategories(): Promise<Category[]> {
    return readLocal<Category>(STORAGE_KEYS.CATEGORIES);
  }

  static async saveCategories(categories: Category[]): Promise<void> {
    await writeLocal(STORAGE_KEYS.CATEGORIES, categories);
  }
}
