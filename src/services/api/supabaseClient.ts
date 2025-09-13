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
export const handleSupabaseError = (error: any): string => {
  if (error?.message) {
    return error.message;
  }
  if (error?.details) {
    return error.details;
  }
  if (error?.hint) {
    return error.hint;
  }
  return 'An unexpected error occurred';
};

// Apply a custom JWT (Clerk → Supabase) for all future requests
export function setSupabaseAuthToken(token: string): void {
  if (!supabase) return;
  try {
    // For PostgREST
    // Set auth token via headers instead
    (supabase as any).rest.headers['Authorization'] = `Bearer ${token}`;
    // For Realtime (optional)
    if ((supabase as any).realtime?.setAuth) (supabase as any).realtime.setAuth(token);
    logger.info('Supabase auth token applied');
  } catch (error) {
    logger.error('Failed to apply Supabase auth token', error);
  }
}

export function clearSupabaseAuthToken(): void {
  if (!supabase) return;
  try {
    // Clear auth header; we do not manage GoTrue sessions here
    // Clear auth token via headers instead
    (supabase as any).rest.headers['Authorization'] = '';
    if ((supabase as any).realtime?.setAuth) (supabase as any).realtime.setAuth('');
    logger.info('Supabase auth token cleared');
  } catch (error) {
    logger.error('Failed to clear Supabase auth token', error);
  }
}
