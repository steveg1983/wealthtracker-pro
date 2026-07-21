/**
 * Microsoft Money import execution — the destructive "total migration".
 *
 * Takes the app-shaped collections produced by `transformMsMoneyExport` and
 * replaces ALL of the user's data with them. Two write paths share one plan:
 *
 *  - LOCAL (demo / signed-out): rewrites the wealthtracker_* storage keys, the
 *    same contract demo seeding uses.
 *  - CLOUD (signed in): wipes then batch-inserts through the authenticated
 *    Supabase client under RLS — the same ordered wipe + two-pass transfer
 *    linking + split-leg pinning proven by scripts/mnyCloudImport.mts, minus
 *    the service role (each row is the user's own, so RLS permits it).
 *
 * DESTRUCTIVE: the caller MUST gate this behind an explicit confirmation and
 * (per the import UI) a fresh export of the current data. Balances are written
 * as the reconstructed final values, so no per-row balance maths runs here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account } from '../../../types';
import type { MsMoneyImportResult } from './transform';

export type ImportPhase =
  | 'wiping' | 'accounts' | 'categories' | 'transactions' | 'links' | 'splits' | 'verifying' | 'done';

export interface ImportProgress {
  phase: ImportPhase;
  /** 0–1 overall fraction, for a progress bar. */
  fraction: number;
  message: string;
}

export interface ImportOptions {
  onProgress?: (p: ImportProgress) => void;
}

const BATCH = 500;
const chunk = <T>(arr: T[], size = BATCH): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// ── LOCAL path ───────────────────────────────────────────────────────────────

/**
 * Replace local storage with the imported collections. Mirrors the demo-seed
 * storage contract so the app picks it up on the next load.
 */
export async function importToLocalStorage(
  result: MsMoneyImportResult,
  storageKeys: { ACCOUNTS: string; TRANSACTIONS: string; CATEGORIES: string; TRANSACTION_SPLITS: string; BUDGETS: string; GOALS: string; RECURRING: string },
  opts: ImportOptions = {}
): Promise<void> {
  const { onProgress } = opts;
  onProgress?.({ phase: 'accounts', fraction: 0.2, message: 'Writing accounts…' });
  window.localStorage.setItem(storageKeys.ACCOUNTS, JSON.stringify(result.accounts));
  onProgress?.({ phase: 'categories', fraction: 0.4, message: 'Writing categories…' });
  window.localStorage.setItem(storageKeys.CATEGORIES, JSON.stringify(result.categories));
  onProgress?.({ phase: 'transactions', fraction: 0.7, message: 'Writing transactions…' });
  window.localStorage.setItem(storageKeys.TRANSACTIONS, JSON.stringify(result.transactions));
  onProgress?.({ phase: 'splits', fraction: 0.9, message: 'Writing splits…' });
  window.localStorage.setItem(storageKeys.TRANSACTION_SPLITS, JSON.stringify(result.transactionSplits));
  // Everything else starts clean — a total migration replaces, never merges.
  window.localStorage.setItem(storageKeys.BUDGETS, '[]');
  window.localStorage.setItem(storageKeys.GOALS, '[]');
  window.localStorage.setItem(storageKeys.RECURRING, '[]');
  onProgress?.({ phase: 'done', fraction: 1, message: 'Import complete.' });
}

// ── CLOUD path (batched inserts under RLS) ──────────────────────────────────

const DB_ACCOUNT_TYPE = (t: Account['type']): string => (t === 'current' ? 'checking' : t);
const dateOnly = (d: Date | string): string =>
  (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

interface CloudPlan {
  accounts: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  transactions: Record<string, unknown>[];   // inserted WITHOUT linked_transfer_id
  transferLinks: { id: string; linked_transfer_id: string }[];
  splits: Record<string, unknown>[];
  splitLegPins: { id: string; linked_transfer_split_id: string }[];
}

/**
 * Pure: turn the app-shaped collections into DB rows with fresh UUIDs and every
 * cross-reference remapped. Separated from the I/O so it can be unit-tested.
 */
export function planCloudImport(
  result: MsMoneyImportResult,
  userId: string,
  newId: () => string
): CloudPlan {
  const acctId = new Map(result.accounts.map(a => [a.id, newId()]));
  const catId = new Map(result.categories.map(c => [c.id, newId()]));
  const txnId = new Map(result.transactions.map(t => [t.id, newId()]));
  const splitId = new Map(result.transactionSplits.map(s => [s.id, newId()]));
  const cat = (id?: string): string | null => (id && catId.get(id)) || null;

  const accounts = result.accounts.map((a): Record<string, unknown> => ({
    id: acctId.get(a.id),
    user_id: userId,
    name: a.name,
    type: DB_ACCOUNT_TYPE(a.type),
    balance: a.balance,
    initial_balance: a.openingBalance ?? 0,
    opening_balance_date: a.openingBalanceDate ? dateOnly(a.openingBalanceDate) : null,
    currency: a.currency || 'GBP',
    is_active: a.isActive !== false,
    notes: a.notes ?? null,
  }));

  const categories = result.categories
    // System categories (type/transfer roots) already exist per-user; only the
    // Money-derived sub/detail + To/From rows are inserted.
    .filter(c => c.isSystem !== true)
    .map((c): Record<string, unknown> => ({
      id: catId.get(c.id),
      user_id: userId,
      name: c.name,
      type: c.type,
      level: c.level,
      parent_id: c.parentId && catId.has(c.parentId) ? catId.get(c.parentId) : c.parentId ?? null,
      is_transfer_category: c.isTransferCategory === true,
      account_id: c.accountId ? acctId.get(c.accountId) ?? null : null,
      is_active: c.isActive !== false,
    }));

  const transactions = result.transactions.map((t): Record<string, unknown> => ({
    id: txnId.get(t.id),
    user_id: userId,
    account_id: acctId.get(t.accountId),
    description: t.description,
    amount: t.amount,
    type: t.type,
    date: dateOnly(t.date),
    category: t.isSplit ? '' : (cat(t.category) ?? ''),
    notes: t.notes ?? null,
    is_cleared: t.cleared === true,
    is_split: t.isSplit === true,
    transfer_account_id: t.transferAccountId ? acctId.get(t.transferAccountId) ?? null : null,
    is_recurring: false,
  }));

  // Transfer pairs reference each other, so links go in as a second pass.
  const transferLinks = result.transactions
    .filter(t => t.linkedTransferId && txnId.has(t.linkedTransferId))
    .map(t => ({ id: txnId.get(t.id)!, linked_transfer_id: txnId.get(t.linkedTransferId!)! }));

  const splits = result.transactionSplits.map((s): Record<string, unknown> => ({
    id: splitId.get(s.id),
    transaction_id: txnId.get(s.transactionId),
    user_id: userId,
    category: cat(s.category) ?? '',
    amount: s.amount,
    memo: s.memo ?? null,
    sort_order: s.sortOrder,
    transfer_account_id: s.transferAccountId ? acctId.get(s.transferAccountId) ?? null : null,
    linked_transfer_id: s.linkedTransferId ? txnId.get(s.linkedTransferId) ?? null : null,
  }));

  const splitLegPins = result.transactions
    .filter(t => t.linkedTransferSplitId && splitId.has(t.linkedTransferSplitId))
    .map(t => ({ id: txnId.get(t.id)!, linked_transfer_split_id: splitId.get(t.linkedTransferSplitId!)! }));

  return { accounts, categories, transactions, transferLinks, splits, splitLegPins };
}

/**
 * Delete ALL of the user's financial data under the authenticated client.
 * Wipe order matters: accounts BEFORE categories (the
 * protect_transfer_category trigger only lets a To/From category go once its
 * account row is gone), and self-referential transfer links are cleared
 * before the transaction wipe. Bank-account links cascade away with their
 * accounts; bank connections themselves are kept.
 *
 * Used by the MS Money total migration AND the Danger Zone "Clear All Data".
 */
export async function wipeCloudData(supabase: SupabaseClient, userId: string): Promise<void> {
  {
    const { error } = await supabase.from('transactions')
      .update({ linked_transfer_id: null, linked_transfer_split_id: null })
      .eq('user_id', userId).not('linked_transfer_id', 'is', null);
    if (error) throw new Error(`Failed while unlinking transfers: ${error.message}`);
  }
  for (const table of ['transaction_splits', 'transactions', 'budgets', 'goals', 'accounts', 'categories']) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`Failed while clearing ${table}: ${error.message}`);
  }
}

/** The local-mode equivalent: empty every financial collection. */
export function wipeLocalData(
  storageKeys: { ACCOUNTS: string; TRANSACTIONS: string; CATEGORIES: string; TRANSACTION_SPLITS: string; BUDGETS: string; GOALS: string; RECURRING: string }
): void {
  for (const key of Object.values(storageKeys)) {
    window.localStorage.setItem(key, '[]');
  }
}

/**
 * Execute the plan against Supabase under the authenticated client.
 */
export async function importToCloud(
  result: MsMoneyImportResult,
  supabase: SupabaseClient,
  userId: string,
  newId: () => string,
  opts: ImportOptions = {}
): Promise<void> {
  const { onProgress } = opts;
  const plan = planCloudImport(result, userId, newId);
  const fail = (stage: string, message: string): never => {
    throw new Error(`Import failed while ${stage}: ${message}`);
  };

  onProgress?.({ phase: 'wiping', fraction: 0.02, message: 'Backing out existing data…' });
  await wipeCloudData(supabase, userId);

  const insert = async (table: string, rows: Record<string, unknown>[], phase: ImportPhase, base: number, span: number) => {
    const batches = chunk(rows);
    let done = 0;
    for (const b of batches) {
      const { error } = await supabase.from(table).insert(b);
      if (error) fail(`inserting ${table}`, error.message);
      done += b.length;
      onProgress?.({ phase, fraction: base + span * (done / Math.max(rows.length, 1)),
        message: `Importing ${table.replace('_', ' ')}… ${done}/${rows.length}` });
    }
  };

  await insert('accounts', plan.accounts, 'accounts', 0.05, 0.1);
  await insert('categories', plan.categories, 'categories', 0.15, 0.1);
  await insert('transactions', plan.transactions, 'transactions', 0.25, 0.45);

  onProgress?.({ phase: 'links', fraction: 0.72, message: 'Linking transfers…' });
  for (const b of chunk(plan.transferLinks)) {
    for (const l of b) {
      const { error } = await supabase.from('transactions')
        .update({ linked_transfer_id: l.linked_transfer_id }).eq('id', l.id);
      if (error) fail('linking transfers', error.message);
    }
  }

  await insert('transaction_splits', plan.splits, 'splits', 0.8, 0.12);

  onProgress?.({ phase: 'splits', fraction: 0.95, message: 'Linking split transfers…' });
  for (const p of plan.splitLegPins) {
    const { error } = await supabase.from('transactions')
      .update({ linked_transfer_split_id: p.linked_transfer_split_id }).eq('id', p.id);
    if (error) fail('pinning split legs', error.message);
  }

  onProgress?.({ phase: 'done', fraction: 1, message: 'Import complete.' });
}
