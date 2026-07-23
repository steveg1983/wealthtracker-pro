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
 * Categories: cloud-synced via the migrate_categories_atomic RPC. The default
 * category set uses non-UUID ids ('type-income', 'transfer-in', …) which the
 * uuid-keyed cloud table cannot store, AND transactions/budgets reference
 * categories by those text ids — so on a user's first cloud load the RPC
 * generates per-user uuids and remaps every reference in ONE database
 * transaction (orphaning is structurally impossible). Signed-out users keep
 * the encrypted-localStorage path with the original text ids.
 */

import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { createScopedLogger } from '../../loggers/scopedLogger';
import { getDefaultCategories } from '../../data/defaultCategories';
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

  // ----- Categories -----

  /** Local read (signed-out mode and cache). */
  static async getCategories(): Promise<Category[]> {
    return readLocal<Category>(STORAGE_KEYS.CATEGORIES);
  }

  /** Local write (signed-out mode and cache). */
  static async saveCategories(categories: Category[]): Promise<void> {
    await writeLocal(STORAGE_KEYS.CATEGORIES, categories);
  }

  /**
   * Cloud-aware category load with first-run migration/seeding.
   *
   * - Cloud has rows → return them (and refresh the local cache).
   * - Cloud empty → run migrate_categories_atomic with the user's
   *   localStorage categories (or the default set for brand-new users).
   *   The RPC inserts uuid-keyed copies AND remaps every transaction/budget
   *   category reference in one database transaction.
   * - userId null / Supabase unavailable → local mode.
   */
  static async ensureCategories(userId: string | null): Promise<Category[]> {
    if (!this.cloudReady || !userId) {
      const local = await this.getCategories();
      return local.length > 0 ? local : getDefaultCategories();
    }

    const { data, error } = await supabase!
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('level', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      logger.error('ensureCategories cloud read failed, using local fallback', error);
      const local = await this.getCategories();
      return local.length > 0 ? local : getDefaultCategories();
    }

    const rows = (data ?? []) as Row[];
    if (rows.length > 0) {
      const categories = rows.map(categoryFromDb);
      await this.saveCategories(categories); // refresh cache
      return categories;
    }

    // First cloud load: migrate localStorage categories (or seed defaults).
    const local = await this.getCategories();
    const source = local.length > 0 ? local : getDefaultCategories();

    const { data: migrated, error: rpcError } = await supabase!.rpc('migrate_categories_atomic', {
      p_user_id: userId,
      p_categories: source.map(categoryToRpcPayload)
    });

    if (rpcError) {
      // 'categories_already_migrated' = a concurrent session won the race —
      // re-read instead of failing.
      if (rpcError.message?.includes('categories_already_migrated')) {
        const retry = await supabase!
          .from('categories')
          .select('*')
          .eq('user_id', userId);
        const retryRows = ((retry.data ?? []) as Row[]).map(categoryFromDb);
        if (retryRows.length > 0) {
          await this.saveCategories(retryRows);
          return retryRows;
        }
      }
      logger.error('Category migration failed, staying on local set', rpcError);
      return source;
    }

    const categories = ((migrated ?? []) as Row[]).map(categoryFromDb);
    await this.saveCategories(categories);
    logger.info(`Categories migrated to cloud: ${categories.length} (from ${local.length > 0 ? 'localStorage' : 'defaults'})`);
    return categories;
  }

  static async createCategory(userId: string | null, category: Omit<Category, 'id'>): Promise<Category> {
    if (this.cloudReady && userId) {
      const row = categoryToDb(category, userId);
      const { data, error } = await supabase!
        .from('categories')
        .insert(row as never)
        .select()
        .single();
      if (error) throw new Error(handleSupabaseError(error));
      const created = categoryFromDb(data as Row);
      const cache = await this.getCategories();
      await this.saveCategories([...cache, created]);
      return created;
    }

    const newCategory: Category = { ...category, id: crypto.randomUUID() };
    const categories = await this.getCategories();
    categories.push(newCategory);
    await this.saveCategories(categories);
    return newCategory;
  }

  /**
   * Bulk delete of UNUSED categories (the Money-set "replace" import). Cloud
   * mode goes through the delete_unused_categories RPC, which re-verifies
   * EVERY row server-side (no transaction/budget/recurring references, no
   * children outside the batch, never type/transfer categories) — a stale
   * client snapshot can therefore never destroy referenced data. Returns the
   * number of rows actually deleted.
   */
  static async deleteUnusedCategories(userId: string | null, ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    if (this.cloudReady && userId) {
      const { data, error } = await supabase!.rpc('delete_unused_categories', {
        p_ids: ids,
        p_user_id: userId
      });
      if (error) throw new Error(handleSupabaseError(error));
      const deleted = typeof data === 'number' ? data : 0;
      // The RPC may have skipped rows; refresh the cache from the cloud so
      // the local view matches what actually survived.
      const { data: rows, error: readError } = await supabase!
        .from('categories')
        .select('*')
        .eq('user_id', userId);
      if (!readError && rows) {
        await this.saveCategories((rows as Row[]).map(categoryFromDb));
      }
      return deleted;
    }

    // Local mode: the in-memory snapshot IS the source of truth, so the
    // planner has seen every row and a plain filter is safe.
    const categories = await this.getCategories();
    const idSet = new Set(ids);
    const remaining = categories.filter(c => !idSet.has(c.id) && !idSet.has(c.parentId ?? ''));
    const deleted = categories.length - remaining.length;
    await this.saveCategories(remaining);
    return deleted;
  }

  /** Bulk create — one insert round trip instead of N (used by tree imports). */
  static async createCategories(userId: string | null, newCategories: Array<Omit<Category, 'id'>>): Promise<Category[]> {
    if (newCategories.length === 0) {
      return [];
    }

    if (this.cloudReady && userId) {
      const rows = newCategories.map(category => categoryToDb(category, userId));
      const { data, error } = await supabase!
        .from('categories')
        .insert(rows as never)
        .select();
      if (error) throw new Error(handleSupabaseError(error));
      const created = ((data ?? []) as Row[]).map(categoryFromDb);
      const cache = await this.getCategories();
      await this.saveCategories([...cache, ...created]);
      return created;
    }

    const created = newCategories.map(category => ({ ...category, id: crypto.randomUUID() } as Category));
    const categories = await this.getCategories();
    await this.saveCategories([...categories, ...created]);
    return created;
  }

  static async updateCategory(userId: string | null, id: string, updates: Partial<Category>): Promise<Category> {
    if (this.cloudReady && userId) {
      const { data, error } = await supabase!
        .from('categories')
        .update(categoryToDb(updates) as never)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new Error(handleSupabaseError(error));
      const updated = categoryFromDb(data as Row);
      const cache = await this.getCategories();
      await this.saveCategories(cache.map(c => c.id === id ? updated : c));
      return updated;
    }

    const categories = await this.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Category not found');
    categories[index] = { ...categories[index], ...updates };
    await this.saveCategories(categories);
    return categories[index];
  }

  static async deleteCategory(userId: string | null, id: string): Promise<void> {
    if (this.cloudReady && userId) {
      // parent_id FK is ON DELETE CASCADE — children go with the parent,
      // matching the client-side behaviour below.
      const { error } = await supabase!
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw new Error(handleSupabaseError(error));
      const cache = await this.getCategories();
      await this.saveCategories(cache.filter(c => c.id !== id && c.parentId !== id));
      return;
    }

    const categories = await this.getCategories();
    await this.saveCategories(categories.filter(c => c.id !== id && c.parentId !== id));
  }
}

// ── Category mapping ─────────────────────────────────────────────────────────

const categoryFromDb = (row: Row): Category => ({
  id: String(row.id),
  name: str(row.name) ?? '',
  type: (str(row.type) ?? 'expense') as Category['type'],
  level: (str(row.level) ?? 'detail') as Category['level'],
  parentId: str(row.parent_id) ?? null,
  color: str(row.color),
  icon: str(row.icon),
  isSystem: row.is_system === true,
  isTransferCategory: row.is_transfer_category === true,
  isRevaluationCategory: row.is_revaluation_category === true,
  accountId: str(row.account_id) ?? undefined,
  isActive: row.is_active !== false
});

const categoryToDb = (c: Partial<Category>, userId?: string): Row => {
  const row: Row = {};
  if (userId) row.user_id = userId;
  if (c.name !== undefined) row.name = c.name;
  if (c.type !== undefined) row.type = c.type;
  if (c.level !== undefined) row.level = c.level;
  if (c.parentId !== undefined) row.parent_id = c.parentId || null;
  if (c.color !== undefined) row.color = c.color;
  if (c.icon !== undefined) row.icon = c.icon;
  if (c.isSystem !== undefined) row.is_system = c.isSystem;
  if (c.isTransferCategory !== undefined) row.is_transfer_category = c.isTransferCategory;
  if (c.isRevaluationCategory !== undefined) row.is_revaluation_category = c.isRevaluationCategory;
  if (c.accountId !== undefined) row.account_id = c.accountId || null;
  if (c.isActive !== undefined) row.is_active = c.isActive;
  return row;
};

/** Shape the RPC expects: camelCase keys matching the frontend Category. */
const categoryToRpcPayload = (c: Category): Record<string, unknown> => ({
  id: c.id,
  name: c.name,
  type: c.type,
  level: c.level,
  parentId: c.parentId ?? null,
  color: c.color ?? null,
  icon: c.icon ?? null,
  isSystem: c.isSystem ?? false,
  isTransferCategory: c.isTransferCategory ?? false,
  isRevaluationCategory: c.isRevaluationCategory ?? false,
  accountId: c.accountId ?? null,
  isActive: c.isActive ?? true
});
