import { createClient } from '@supabase/supabase-js';

const importMetaEnv = typeof import.meta !== 'undefined' && import.meta?.env ? import.meta.env : undefined;
const envSupabaseUrl = importMetaEnv?.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const envSupabaseKey =
  importMetaEnv?.VITE_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;
const runFlag = importMetaEnv?.RUN_SUPABASE_REAL_TESTS ?? process.env.RUN_SUPABASE_REAL_TESTS;

export const hasSupabaseCredentials = Boolean(envSupabaseUrl && envSupabaseKey);
export const shouldRunSupabaseRealTests = runFlag === 'true' && hasSupabaseCredentials;
export const describeSupabase = shouldRunSupabaseRealTests ? describe : describe.skip;

export const ensureSupabaseTestUser = async () => {
  if (!shouldRunSupabaseRealTests) {
    throw new Error('Supabase real tests disabled. Set RUN_SUPABASE_REAL_TESTS=true and provide credentials.');
  }

  const generatedClerkId = `test_clerk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const generatedDatabaseId = crypto.randomUUID();

  return {
    clerkId: generatedClerkId,
    databaseUserId: generatedDatabaseId,
  };
};

const resolveWorkerId = () =>
  process.env.VITEST_WORKER_ID ??
  process.env.JEST_WORKER_ID ??
  process.env.TAP_WORKER_ID ??
  'main';

let cachedSupabaseClient;

export const getSupabaseTestClient = () => {
  if (!shouldRunSupabaseRealTests) {
    throw new Error('Supabase real tests disabled. Set RUN_SUPABASE_REAL_TESTS=true and provide credentials.');
  }

  if (!envSupabaseUrl || !envSupabaseKey) {
    throw new Error('Supabase credentials missing. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  if (!cachedSupabaseClient) {
    const workerId = resolveWorkerId();
    const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    const key = serviceRoleKey ?? envSupabaseKey;
    const storageKeyMode = serviceRoleKey ? 'service' : 'anon';

    cachedSupabaseClient = createClient(envSupabaseUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `supabase-test-${storageKeyMode}-${workerId}`,
      },
      global: serviceRoleKey
        ? {
            headers: {
              'X-Client-Info': 'supabase-tests-service-role',
            },
          }
        : undefined,
    });
  }

  return cachedSupabaseClient;
};
