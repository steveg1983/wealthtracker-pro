import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UserResource } from '@clerk/types';
import type { Database } from '../types/supabase';

type SupabaseDatabase = SupabaseClient<Database>;

type StubSupabase = SupabaseDatabase & { __isStub: true };

type SupabaseListener = (client: SupabaseDatabase | StubSupabase) => void;

const runtimeSupabaseUrl = typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined;
const runtimeSupabaseAnonKey = typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : undefined;

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL ?? runtimeSupabaseUrl ?? '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? runtimeSupabaseAnonKey ?? '';

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const stubQueryProxy = new Proxy(
  {},
  {
    get: (_target, property: string) => () =>
      Promise.reject(new Error(`[Supabase Stub] Attempted to call from().${property}`))
  }
);

function createStubSupabase(): StubSupabase {
  const stub = {
    __isStub: true as const,
    auth: {
      async getUser() {
        return {
          data: { user: null },
          error: new Error('[Supabase Stub] No user available')
        };
      }
    },
    from() {
      return stubQueryProxy as any;
    }
  } as unknown as StubSupabase;

  return stub;
}

const createSupabaseClient = (): SupabaseDatabase | StubSupabase => {
  if (!hasSupabaseConfig) {
    if (typeof window !== 'undefined') {
      console.warn('Supabase credentials not configured. Using stub client.');
    }
    return createStubSupabase();
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }) as SupabaseDatabase;
};

export let supabase: SupabaseDatabase | StubSupabase = createSupabaseClient();

const listeners: SupabaseListener[] = [];

const notifyListeners = (): void => {
  listeners.forEach(listener => {
    try {
      listener(supabase);
    } catch (error) {
      console.error('Supabase listener failed', error);
    }
  });
};

export const isSupabaseConfigured = (): boolean => hasSupabaseConfig;

export async function ensureSupabaseClient(): Promise<SupabaseDatabase | StubSupabase> {
  if ((supabase as StubSupabase).__isStub && hasSupabaseConfig) {
    supabase = createSupabaseClient();
    notifyListeners();
  }

  return supabase;
}

export function subscribeSupabase(listener: SupabaseListener): () => void {
  listeners.push(listener);
  try {
    listener(supabase);
  } catch (error) {
    console.error('Initial Supabase listener invocation failed', error);
  }

  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Sync Clerk user data with Supabase user table
 * Creates or updates user record in Supabase when user signs in
 */
export async function syncClerkUser(clerkUser: UserResource): Promise<void> {
  if (!hasSupabaseConfig) {
    return;
  }

  const client = await ensureSupabaseClient();
  if ((client as StubSupabase).__isStub) {
    return;
  }

  try {
    const userData = {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      first_name: clerkUser.firstName || '',
      last_name: clerkUser.lastName || '',
      full_name: clerkUser.fullName || '',
      image_url: clerkUser.imageUrl || '',
      created_at: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sign_in_at: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt).toISOString() : null,
      email_verified: clerkUser.primaryEmailAddress?.verification?.status === 'verified',
      has_mfa: clerkUser.totpEnabled || clerkUser.backupCodeEnabled || clerkUser.twoFactorEnabled
    };

    const { error } = await client
      .from('users')
      .upsert(userData, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error syncing user with Supabase:', error);
      throw error;
    }

    console.log('User synced successfully with Supabase');
  } catch (error) {
    console.error('Failed to sync user with Supabase:', error);
    // Don't throw here to avoid blocking auth flow
  }
}
