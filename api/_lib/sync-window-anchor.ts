import type { SupabaseClient } from '@supabase/supabase-js';
import { describeSupabaseFailure } from './supabase-failure.js';

/**
 * When this connection's TRANSACTIONS were last read successfully — the only
 * honest anchor for "how far back must the next read reach".
 *
 * `bank_connections.last_sync` is not it. That column is stamped by EVERY
 * successful run, and an account sync (balances) runs seconds before each
 * transaction sync. A manual or sign-in refresh is two requests, so the second
 * one re-read the connection and found `last_sync` seconds old — and asked the
 * provider for the last seven days, whatever the real gap was. The owner came
 * back after a fortnight (29 Sep 2026): the refresh brought 22–28 Sep and
 * nothing from 16–21 Sep, on every one of his banks, and only a hand-imported
 * statement filled the hole.
 *
 * `sync_history` records each transactions run and whether it succeeded, so
 * the last success there is the last moment the ledger was known to be
 * complete. A run that succeeded with nothing to write still counts — the
 * window it covered was read. Null when there has never been one, and the
 * caller falls back to `last_sync` (the behaviour before this existed).
 */
export const lastSuccessfulTransactionSyncAt = async (
  supabase: SupabaseClient,
  connectionId: string
): Promise<string | null> => {
  const { data, error, status } = await supabase
    .from('sync_history')
    .select('created_at')
    .eq('connection_id', connectionId)
    .eq('sync_type', 'transactions')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(`Failed to read the last transactions sync: ${describeSupabaseFailure(error, status)}`);
  }
  const row = (data ?? [])[0] as { created_at?: string | null } | undefined;
  return typeof row?.created_at === 'string' ? row.created_at : null;
};
