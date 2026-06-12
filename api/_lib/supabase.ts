import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRequiredEnv, getOptionalEnv } from './env.js';

let supabase: SupabaseClient | null = null;

export const getServiceRoleSupabase = (): SupabaseClient => {
  if (!supabase) {
    const url = getRequiredEnv('VITE_SUPABASE_URL');
    // SECURITY: the service-role key is server-only and must use a non-VITE_ name —
    // VITE_-prefixed vars get inlined into the public browser bundle at build time.
    // The legacy fallback exists only so existing deployments keep working until the
    // Vercel env var is renamed; remove it once SUPABASE_SERVICE_ROLE_KEY is set there.
    const key =
      getOptionalEnv('SUPABASE_SERVICE_ROLE_KEY') ??
      getRequiredEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');
    supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabase;
};
