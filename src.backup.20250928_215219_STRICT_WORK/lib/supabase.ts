import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserResource } from '@clerk/types';

const runtimeSupabaseUrl = typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined;
const runtimeSupabaseAnonKey = typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : undefined;

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL ?? runtimeSupabaseUrl ?? '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? runtimeSupabaseAnonKey ?? '';

type SupabaseModule = typeof import('@supabase/supabase-js');

type StubSupabase = SupabaseClient<any> & { __isStub: true };

let supabaseModulePromise: Promise<SupabaseModule | null> | null = null;

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

export let supabase: SupabaseClient<any> = createStubSupabase();

if (typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey) {
  supabaseModulePromise = import('@supabase/supabase-js')
    .then((module) => {
      supabase = module.createClient(supabaseUrl, supabaseAnonKey);
      return module;
    })
    .catch(error => {
      console.error('Failed to initialise Supabase client', error);
      supabase = createStubSupabase();
      return null;
    });
} else {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured. Using stub client.');
  }
  supabaseModulePromise = Promise.resolve(null);
}

export async function ensureSupabaseClient(): Promise<SupabaseClient<any>> {
  if (!(supabase as any).__isStub) {
    return supabase;
  }

  if (!supabaseModulePromise || !supabaseUrl || !supabaseAnonKey) {
    return supabase;
  }

  try {
    const module = await supabaseModulePromise;
    if (module) {
      supabase = module.createClient(supabaseUrl, supabaseAnonKey);
    }
  } catch (error) {
    console.error('Failed to resolve Supabase client', error);
    supabase = createStubSupabase();
  }

  return supabase;
}

/**
 * Sync Clerk user data with Supabase user table
 * Creates or updates user record in Supabase when user signs in
 */
export async function syncClerkUser(clerkUser: UserResource): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return;
  }

  const client = await ensureSupabaseClient();
  if ((client as any).__isStub) {
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
