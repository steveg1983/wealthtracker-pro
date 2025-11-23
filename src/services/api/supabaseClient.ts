import { createClient } from '@supabase/supabase-js';
import { createScopedLogger } from '../../loggers/scopedLogger';

// Database type is not properly exported, using unknown for now
type Database = unknown;

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseLogger = createScopedLogger('SupabaseClient');

if (!supabaseUrl || !supabaseAnonKey) {
  supabaseLogger.warn?.('Supabase credentials not configured. Using localStorage fallback.');
}

// Create Supabase client
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
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

// Helper to get current user ID
export const getCurrentUserId = async (): Promise<string | null> => {
  if (!supabase) return null;
  
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
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
