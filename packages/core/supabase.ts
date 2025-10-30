import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/postgrest-js';
import type { Database } from '@app-types/supabase';

export type SupabaseDatabase = SupabaseClient<Database>;
export type StubSupabase = SupabaseDatabase & { __isStub: true };
export type SupabaseInstance = SupabaseDatabase | StubSupabase;
export type SupabaseQueryError = PostgrestError | null;

export interface SupabaseSingleResult<Row = Record<string, unknown>> {
  data: Row;
  error: SupabaseQueryError;
}

export interface SupabaseMaybeSingleResult<Row = Record<string, unknown>> {
  data: Row | null;
  error: SupabaseQueryError;
}

export interface SupabaseQueryResult<Row = Record<string, unknown>> {
  data: Row[] | null;
  error: SupabaseQueryError;
}

export interface SupabaseInsertBuilderLike<Row = Record<string, unknown>> {
  select(columns: string): {
    single(): PromiseLike<SupabaseSingleResult<Row>>;
  };
}

export interface SupabaseFilterBuilderLike<Row = Record<string, unknown>> {
  eq(column: string, value: unknown): SupabaseFilterBuilderLike<Row>;
  maybeSingle(): PromiseLike<SupabaseMaybeSingleResult<Row>>;
  single(): PromiseLike<SupabaseSingleResult<Row>>;
}

export interface SupabaseQueryBuilderLike<Row = Record<string, unknown>, Insert = Record<string, unknown>> {
  select(columns: string): SupabaseFilterBuilderLike<Row>;
  insert(values: Insert | Insert[]): SupabaseInsertBuilderLike<Row>;
  upsert(values: Insert | Insert[], options?: { onConflict?: string }): PromiseLike<SupabaseQueryResult<Row>>;
}

export interface SupabaseClientOverride {
  from(table: string): SupabaseQueryBuilderLike;
}

export type SupabaseClientLike = SupabaseInstance | SupabaseClientOverride;

type SupabaseListener = (client: SupabaseInstance) => void;

const importMetaEnv =
  typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env
    ? ((import.meta as { env?: Record<string, string | undefined> }).env as Record<string, string | undefined>)
    : undefined;

const runtimeSupabaseUrl =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_SUPABASE_URL
    : undefined;
const runtimeSupabaseAnonKey =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env.VITE_SUPABASE_ANON_KEY
    : undefined;

const supabaseUrl = importMetaEnv?.VITE_SUPABASE_URL ?? runtimeSupabaseUrl ?? '';
const supabaseAnonKey = importMetaEnv?.VITE_SUPABASE_ANON_KEY ?? runtimeSupabaseAnonKey ?? '';

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const isRealTestEnv = ((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITEST_SUPABASE_MODE === 'real') || (typeof process !== 'undefined' && process.env?.VITEST_SUPABASE_MODE === 'real'));

const createStubQueryBuilder = (): ReturnType<SupabaseDatabase['from']> =>
  new Proxy(
    {},
    {
      get: (_target, property: string | symbol) => () =>
        Promise.reject(new Error(`[Supabase Stub] Attempted to call from().${String(property)}`)),
    },
  ) as ReturnType<SupabaseDatabase['from']>;

function createStubSupabase(): StubSupabase {
  const stub = {
    __isStub: true as const,
    auth: {
      async getUser() {
        return {
          data: { user: null },
          error: new Error('[Supabase Stub] No user available'),
        };
      },
    },
    from() {
      return createStubQueryBuilder();
    },
  } as unknown as StubSupabase;

  return stub;
}

const createSupabaseClient = (): SupabaseInstance => {
  if (isRealTestEnv) {
    return createStubSupabase();
  }

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
      detectSessionInUrl: true,
      storageKey: 'supabase-web-auth',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }) as SupabaseDatabase;
};

export const isSupabaseStub = (client: SupabaseInstance): client is StubSupabase => '__isStub' in client;

export let supabase: SupabaseInstance = createSupabaseClient();

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

export async function ensureSupabaseClient(): Promise<SupabaseInstance> {
  if (isSupabaseStub(supabase) && hasSupabaseConfig) {
    supabase = createSupabaseClient();
    notifyListeners();
  }

  return supabase;
}

export function setSupabaseClient(client: SupabaseInstance): void {
  supabase = client;
  notifyListeners();
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

export const handleSupabaseError = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const err = error as { message?: string; details?: string; hint?: string };
    if (typeof err.message === 'string') {
      return err.message;
    }
    if (typeof err.details === 'string') {
      return err.details;
    }
    if (typeof err.hint === 'string') {
      return err.hint;
    }
  }
  return 'An unexpected error occurred';
};

export const getCurrentUserId = async (): Promise<string | null> => {
  const client = await ensureSupabaseClient();
  if (isSupabaseStub(client)) {
    return null;
  }

  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
};

export interface ClerkUserLike {
  id: string;
  primaryEmailAddress?: {
    emailAddress?: string;
    verification?: {
      status?: string | null;
    };
  } | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  imageUrl?: string | null;
  createdAt?: string | number | Date | null;
  lastSignInAt?: string | number | Date | null;
  totpEnabled?: boolean;
  backupCodeEnabled?: boolean;
  twoFactorEnabled?: boolean;
}

export async function syncClerkUser(clerkUser: ClerkUserLike): Promise<void> {
  if (!hasSupabaseConfig) {
    return;
  }

  const client = await ensureSupabaseClient();
  if (isSupabaseStub(client)) {
    return;
  }

  try {
    const hasMfa = clerkUser.totpEnabled || clerkUser.backupCodeEnabled || clerkUser.twoFactorEnabled;

    const userData: Database['public']['Tables']['users']['Insert'] = {
      id: clerkUser.id,
      clerk_id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
      first_name: clerkUser.firstName ?? '',
      last_name: clerkUser.lastName ?? '',
      full_name: clerkUser.fullName ?? '',
      image_url: clerkUser.imageUrl ?? '',
      subscription_tier: 'free',
      subscription_status: 'active',
      created_at: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sign_in_at: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt).toISOString() : null,
      email_verified: clerkUser.primaryEmailAddress?.verification?.status === 'verified',
      has_mfa: hasMfa ?? null,
    };

    const { error } = await client.from('users').upsert(userData, {
      onConflict: 'id',
    });

    if (error) {
      console.error('Error syncing user with Supabase:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to sync user with Supabase:', error);
  }
}
