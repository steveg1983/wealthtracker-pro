import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRequiredEnv } from './env.js';

let supabase: SupabaseClient | null = null;

export const getServiceRoleSupabase = (): SupabaseClient => {
  if (!supabase) {
    const url = getRequiredEnv('VITE_SUPABASE_URL');
    const key = getRequiredEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');
    supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabase;
};
