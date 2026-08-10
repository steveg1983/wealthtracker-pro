import { createClient } from '@supabase/supabase-js';
import { createScopedLogger } from '../../loggers/scopedLogger';
import { getSupabaseAccessToken } from '../../lib/supabaseToken';

// Minimal schema typing. Tables stay loosely typed (full generated types are a
// future improvement) but the atomic RPCs are declared so calls type-check.
type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type Database = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, never>;
    Functions: {
      create_transaction_atomic: {
        Args: { p: Record<string, unknown> };
        Returns: Record<string, unknown>;
      };
      // p_user_id is REQUIRED on every RPC below that takes one, even where the
      // SQL gives it a NULL default. NULL there does not mean "me": it means
      // the statement names no owner at all and falls back to RLS alone, so the
      // defence-in-depth IDOR guard quietly disappears and a mis-routed id gets
      // one fewer chance to fail closed. Requiring it here means no call site
      // can drop it by accident. (archive_transactions_before and
      // unarchive_account already require it in SQL — only the type was loose.)
      update_transaction_atomic: {
        Args: { p_id: string; p: Record<string, unknown>; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      delete_transaction_atomic: {
        Args: { p_id: string; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      set_transactions_cleared: {
        Args: { p_ids: string[]; p_cleared: boolean; p_user_id: string };
        Returns: number;
      };
      apply_category_to_uncategorized: {
        Args: { p_ids: string[]; p_category: string; p_user_id: string };
        Returns: number;
      };
      // Agree with the app's suggested category. Takes no category on purpose:
      // it only flips category_confirmed (and clears needs_review, because
      // answering the question a row was asking IS reviewing that row), so it
      // cannot move a category or a balance however it is called
      // (20260808100000_category_provenance.sql, widened by
      // 20260810090000_imported_rows_arrive_new.sql).
      confirm_transaction_categories: {
        Args: { p_ids: string[]; p_user_id: string };
        Returns: number;
      };
      set_transaction_splits: {
        Args: {
          p_transaction_id: string;
          p_splits: { category: string; amount: number; memo?: string }[];
          p_expected_amount: number | null;
          p_user_id: string;
        };
        Returns: Record<string, unknown>;
      };
      // The split writer that understands TRANSFER LEGS. Two fields the plain
      // set_transaction_splits payload has no use for: `id` names the stored
      // line an element replaces (so lines are matched, not wholesale
      // replaced), and `transfer_account_id` makes a line one leg of a
      // transfer — spelled the database's way, because that is how it reads
      // back out of the audit log.
      set_transaction_splits_with_legs: {
        Args: {
          p_transaction_id: string;
          p_splits: {
            category: string;
            amount: number;
            memo?: string;
            id?: string;
            transfer_account_id?: string;
          }[];
          p_expected_amount: number | null;
          p_user_id: string;
        };
        Returns: Record<string, unknown>;
      };
      link_transfer_pair: {
        Args: { p_id_a: string; p_id_b: string; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      // The split-line counterpart of link_transfer_pair: pairs an existing
      // split LINE with an existing transaction (amounts opposite between the
      // LINE and the row, never the parent). Declared here because the
      // database has it; the transfer-matching sweep is its caller.
      link_split_line_transfer: {
        Args: { p_split_id: string; p_transaction_id: string; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      create_transfer_counterpart: {
        Args: { p_id: string; p_target_account_id: string; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      clear_transfer_links: {
        Args: { p_ids: string[]; p_user_id: string };
        Returns: number;
      };
      set_transactions_archived: {
        Args: { p_ids: string[]; p_archived: boolean; p_user_id: string };
        Returns: number;
      };
      repair_claimed_transfer: {
        Args: {
          p_stranded_id: string;
          p_counterpart_id: string;
          p_partner_id: string;
          p_adjustment_category_id: string;
          p_user_id: string;
        };
        Returns: Record<string, unknown>;
      };
      delete_unused_categories: {
        Args: { p_ids: string[]; p_user_id: string };
        Returns: number;
      };
      merge_categories: {
        Args: { p_source_id: string; p_target_id: string; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      migrate_categories_atomic: {
        Args: { p_user_id: string; p_categories: Record<string, unknown>[] };
        Returns: Record<string, unknown>[];
      };
      archive_transactions_before: {
        Args: { p_account_id: string; p_cutoff: string; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      unarchive_account: {
        Args: { p_account_id: string; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      // No arguments by design: the function reads the caller's identity from
      // the JWT. numeric/bigint columns can arrive as strings, so the rows stay
      // loosely typed and are narrowed at the call site.
      account_balances: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>[];
      };
      // ── Backup and restore (20260807083000) ──────────────────────────────
      // p_rows is deliberately Record<string, unknown>[]: the restore takes
      // WHOLE database rows and hands them to jsonb_populate_recordset against
      // the table's own rowtype. Naming columns here would be a promise to keep
      // a hand-written list correct forever, and a backup that silently drops a
      // column is worse than one that fails.
      user_financial_data_is_empty: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      wipe_user_financial_data: {
        Args: { p_confirm: string; p_user_id: string };
        Returns: Record<string, unknown>;
      };
      // RETURNS bigint. PostgREST sends that as a JSON number, but the call
      // site narrows a string too rather than trusting the wire format on the
      // one operation whose row counts are the only receipt the user gets.
      restore_user_chunk: {
        Args: { p_entity: string; p_rows: Record<string, unknown>[]; p_user_id: string };
        Returns: number | string;
      };
      finalize_user_restore: {
        Args: { p_links: Record<string, unknown>; p_user_id: string };
        Returns: Record<string, unknown>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseLogger = createScopedLogger('SupabaseClient');

if (!supabaseUrl || !supabaseAnonKey) {
  supabaseLogger.warn?.('Supabase credentials not configured. Using localStorage fallback.');
}

// Clerk is the auth provider (Supabase third-party auth). Every request carries
// the Clerk session JWT via accessToken so RLS policies can identify the user.
// With accessToken set, supabase.auth.* methods must NOT be called.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      accessToken: getSupabaseAccessToken,
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return supabase !== null;
};

// Helper to handle Supabase errors
export const handleSupabaseError = (error: unknown): string => {
  const err = error as { message?: string; details?: string; hint?: string };
  if (typeof err?.message === 'string') {
    return err.message;
  }
  if (typeof err?.details === 'string') {
    return err.details;
  }
  if (typeof err?.hint === 'string') {
    return err.hint;
  }
  return 'An unexpected error occurred';
};
