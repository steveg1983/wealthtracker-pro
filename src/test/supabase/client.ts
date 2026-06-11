import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

// These real-infrastructure tests only execute when RUN_SUPABASE_REAL_TESTS is
// set (see the skipIf in supabase-smoke.test.ts). The general `vitest run`
// (test:smoke) COLLECTS this module but skips the tests — so the clients below
// are never used. Therefore: do NOT throw at import time when the Supabase env
// is absent (that fails collection in CI, where these creds aren't provided).
// Only enforce the guard when the tests are actually going to run.
const willRunRealTests = process.env.RUN_SUPABASE_REAL_TESTS === 'true';

if (willRunRealTests && (!url || !anonKey)) {
  throw new Error('[supabase-smoke] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

// Placeholders keep createClient from throwing during collection. createClient
// does not connect or validate at creation, and the clients are never invoked
// unless the real tests run (with real creds).
const safeUrl = url ?? 'http://localhost:54321';
const safeAnonKey = anonKey ?? 'placeholder-anon-key-not-used';

export const supabaseAnon: SupabaseClient = createClient(safeUrl, safeAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export const supabaseService: SupabaseClient | null = serviceRoleKey
  ? createClient(safeUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;
