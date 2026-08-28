/**
 * WHERE A RULE LIVES — the account, not the browser.
 *
 * Import rules were kept in `localStorage` from the day they were built, and
 * on 28 August 2026 the owner asked what the feature actually does. Three
 * answers, none of them good:
 *
 *   * a rule written at the desk did not exist on the phone;
 *   * clearing site data destroyed the lot, silently, with no copy in the
 *     account export either;
 *   * and the SERVER could not read them, which is the whole reason rules had
 *     never applied to bank feeds — the one path where "categorise
 *     transactions as they come in" actually describes what happens.
 *
 * ── THE CARRY-OVER ──────────────────────────────────────────────────────────
 *
 * Rules already in a browser are the user's work and must not evaporate on
 * the way past. `hydrate` moves them once: if the account holds no rules and
 * this browser does, they are uploaded and the local copy is then left alone
 * rather than deleted — an upload that half-worked should be repeatable, and
 * a stale local copy is harmless once the account is the thing being read.
 *
 * A rule is only migrated if it is well-formed, because the constraints on
 * the table are real (a rule with no conditions would match every transaction
 * ever imported). Anything unreadable is reported and skipped, never dropped
 * silently.
 */
import { supabase, handleSupabaseError } from '../api/supabaseClient';
import { userIdService } from '../userIdService';
import type { ImportRule } from '../../types/importRules';

interface ImportRuleRow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  conditions: unknown;
  actions: unknown;
  created_at: string;
  updated_at: string;
}

const SELECTED_COLUMNS = 'id, name, description, enabled, priority, conditions, actions, created_at, updated_at';

const requireClient = (action: string) => {
  if (!supabase) {
    throw new Error(`Not connected — ${action} could not be saved.`);
  }
  return supabase;
};

/**
 * Whose rules these are.
 *
 * Resolved here rather than passed in, because this file is the CLOUD half of
 * the seam and identity is a cloud idea. The shared service that calls it must
 * not import `userIdService` — a desktop build reaching identity was one of
 * the three violations the seam guard caught on the first attempt.
 */
const requireOwner = (): string => {
  const owner = userIdService.getCurrentDatabaseUserId();
  if (!owner) {
    throw new Error('Not signed in — rules could not be read or saved.');
  }
  return owner;
};

export function toRule(row: ImportRuleRow): ImportRule {
  return {
    id: row.id,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    enabled: row.enabled,
    priority: row.priority,
    conditions: Array.isArray(row.conditions) ? row.conditions as ImportRule['conditions'] : [],
    actions: Array.isArray(row.actions) ? row.actions as ImportRule['actions'] : [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export async function listRules(): Promise<ImportRule[]> {
  const client = requireClient('these rules');
  const userId = requireOwner();
  const { data, error } = await client
    .from('import_rules')
    .select(SELECTED_COLUMNS)
    .eq('user_id', userId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));
  return (data ?? []).map((row) => toRule(row as unknown as ImportRuleRow));
}

export async function insertRule(
  rule: Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ImportRule> {
  const client = requireClient('this rule');
  const userId = requireOwner();
  const { data, error } = await client
    .from('import_rules')
    .insert({
      user_id: userId,
      name: rule.name,
      description: rule.description ?? null,
      enabled: rule.enabled,
      priority: rule.priority,
      conditions: rule.conditions,
      actions: rule.actions
    })
    .select(SELECTED_COLUMNS)
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return toRule(data as unknown as ImportRuleRow);
}

export async function updateRuleRow(
  id: string,
  updates: Partial<Omit<ImportRule, 'id' | 'createdAt'>>
): Promise<void> {
  const client = requireClient('this change');
  const userId = requireOwner();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description ?? null;
  if (updates.enabled !== undefined) payload.enabled = updates.enabled;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.conditions !== undefined) payload.conditions = updates.conditions;
  if (updates.actions !== undefined) payload.actions = updates.actions;

  const { error } = await client
    .from('import_rules')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(handleSupabaseError(error));
}

export async function deleteRuleRow(id: string): Promise<void> {
  const client = requireClient('this deletion');
  const userId = requireOwner();
  const { error } = await client
    .from('import_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(handleSupabaseError(error));
}
