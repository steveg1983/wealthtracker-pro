import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { logger } from '../loggingService';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  logger.warn('Supabase credentials not configured. Using localStorage fallback.');
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
  const err = error as { message?: string; details?: string };
  if (err?.message) {
    return err.message;
  }
  if (err?.details) {
    return err.details;
  }
  const errWithHint = error as { hint?: string };
  if (errWithHint?.hint) {
    return errWithHint.hint;
  }
  return 'An unexpected error occurred';
};