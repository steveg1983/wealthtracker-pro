import { createClient } from '@supabase/supabase-js';
import { createScopedLogger } from '../../loggers/scopedLogger';
import { getSupabaseAccessToken } from '../../lib/supabaseToken';

// Database type is not properly exported, using unknown for now
type Database = unknown;

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
