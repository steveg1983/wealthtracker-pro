import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRequiredEnv } from './env.js';

let supabase: SupabaseClient | null = null;

export const getServiceRoleSupabase = (): SupabaseClient => {
  if (!supabase) {
    const url = getRequiredEnv('VITE_SUPABASE_URL');
    // SECURITY: the service-role key is server-only and MUST use a non-VITE_ name.
    // VITE_-prefixed vars are inlined into the public browser bundle at build time —
    // the old `?? VITE_SUPABASE_SERVICE_ROLE_KEY` fallback meant that whenever that
    // var existed in the build env, the master key leaked into dist/ (confirmed live
    // in production 2026-06-12). The fallback is removed: only the non-prefixed name
    // is accepted, so a VITE_-prefixed service-role var can never be relied upon.
    const key = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabase;
};
