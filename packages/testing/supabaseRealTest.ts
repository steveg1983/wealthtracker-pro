import { describe } from 'vitest';
import type { Database } from '@app-types/supabase';
import { getSupabaseTestClient as getSharedSupabaseClient } from './supabaseClient';

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const envSupabaseUrl = toStringOrUndefined(import.meta.env?.VITE_SUPABASE_URL) ?? toStringOrUndefined(process.env.VITE_SUPABASE_URL);
const envSupabaseAnonKey =
  toStringOrUndefined(import.meta.env?.VITE_SUPABASE_ANON_KEY) ?? toStringOrUndefined(process.env.VITE_SUPABASE_ANON_KEY);
const runFlag = toStringOrUndefined(import.meta.env?.RUN_SUPABASE_REAL_TESTS) ?? toStringOrUndefined(process.env.RUN_SUPABASE_REAL_TESTS);

export const hasSupabaseCredentials = Boolean(envSupabaseUrl && envSupabaseAnonKey);
export const shouldRunSupabaseRealTests = runFlag === 'true' && hasSupabaseCredentials;
const describeSupabaseImpl = (title: string, factory: () => void) => {
  if (shouldRunSupabaseRealTests) {
    describe(title, factory);
    return;
  }

  const skipper = (describe as unknown as { skip?: typeof describe }).skip;
  if (typeof skipper === 'function') {
    skipper(title, factory);
    return;
  }

  // Fall back to a no-op if skip is unavailable.
};

const describeSupabaseCast = describeSupabaseImpl as typeof describe;

(describeSupabaseCast as any).skip = (title: string, factory: () => void) => {
  const skipper = (describe as unknown as { skip?: typeof describe }).skip;
  if (typeof skipper === 'function') {
    skipper(title, factory);
  }
};

(describeSupabaseCast as any).only = (title: string, factory: () => void) => {
  const only = (describe as unknown as { only?: typeof describe }).only;
  if (typeof only === 'function') {
    only(title, factory);
  }
};

export const describeSupabase = describeSupabaseCast;
export type SupabaseTestClient = SupabaseClient<Database>;

export interface SupabaseTestUser {
  clerkId: string;
  databaseUserId: string;
}

export const ensureSupabaseTestUser = async (): Promise<SupabaseTestUser> => {
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

export const getSupabaseTestClient = (): SupabaseTestClient => {
  if (!shouldRunSupabaseRealTests) {
    throw new Error('Supabase real tests disabled. Set RUN_SUPABASE_REAL_TESTS=true and provide credentials.');
  }

  if (!envSupabaseUrl || !envSupabaseAnonKey) {
    throw new Error('Supabase credentials missing. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const serviceRoleAvailable =
    Boolean(process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) || Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return getSharedSupabaseClient({
    mode: serviceRoleAvailable ? 'service' : 'anon',
    fallbackToAnon: true,
  }) as SupabaseTestClient;
};
