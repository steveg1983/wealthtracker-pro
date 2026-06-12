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
      update_transaction_atomic: {
        Args: { p_id: string; p: Record<string, unknown>; p_user_id?: string };
        Returns: Record<string, unknown>;
      };
      delete_transaction_atomic: {
        Args: { p_id: string; p_user_id?: string };
        Returns: Record<string, unknown>;
      };
      migrate_categories_atomic: {
        Args: { p_user_id: string; p_categories: Record<string, unknown>[] };
        Returns: Record<string, unknown>[];
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
