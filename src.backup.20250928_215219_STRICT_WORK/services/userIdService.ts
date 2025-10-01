import type { Database } from '../types/supabase';
import { lazyLogger as logger } from './serviceFactory';

export type ClerkUserId = string;
export type DatabaseUserId = string;

type LoggerLike = Pick<typeof logger, 'warn' | 'error' | 'info' | 'debug'>;

let activeLogger: LoggerLike = logger;

export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const clerkToDatabase = new Map<string, string>();
const databaseToClerk = new Map<string, string>();
let currentDatabaseUserId: DatabaseUserId | null = null;
let currentClerkId: ClerkUserId | null = null;
let supabaseModulePromise: Promise<typeof import('./api/supabaseClient')> | null = null;

function resetCacheState(): void {
  clerkToDatabase.clear();
  databaseToClerk.clear();
  currentClerkId = null;
  currentDatabaseUserId = null;
}

async function getSupabaseModule() {
  if (!supabaseModulePromise) {
    supabaseModulePromise = import('./api/supabaseClient');
  }
  return supabaseModulePromise;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cacheMapping(clerkId: ClerkUserId | null, databaseId: DatabaseUserId | null): void {
  if (clerkId && databaseId) {
    clerkToDatabase.set(clerkId, databaseId);
    databaseToClerk.set(databaseId, clerkId);
  }
  if (databaseId) {
    currentDatabaseUserId = databaseId;
  }
  if (clerkId) {
    currentClerkId = clerkId;
  }
}

async function fetchMappingByClerkId(clerkId: string): Promise<string | null> {
  const { supabase, isSupabaseConfigured } = await getSupabaseModule();
  if (!supabase || !isSupabaseConfigured()) {
    return clerkId;
  }

  try {
    const { data, error } = await supabase
      .from('user_id_mappings')
      .select('database_user_id')
      .eq('clerk_id', clerkId)
      .maybeSingle();

    if (error) {
      activeLogger.warn('[userIdService] Failed to fetch user mapping by clerk ID', error);
      return null;
    }

    if (data?.database_user_id) {
      cacheMapping(clerkId, data.database_user_id);
      return data.database_user_id;
    }
  } catch (fetchError) {
    activeLogger.error('[userIdService] Unexpected error fetching user mapping by clerk ID', fetchError);
  }

  return null;
}

async function fetchMappingByDatabaseId(databaseId: string): Promise<string | null> {
  const { supabase, isSupabaseConfigured } = await getSupabaseModule();
  if (!supabase || !isSupabaseConfigured()) {
    return databaseId;
  }

  try {
    const { data, error } = await supabase
      .from('user_id_mappings')
      .select('clerk_id')
      .eq('database_user_id', databaseId)
      .maybeSingle();

    if (error) {
      activeLogger.warn('[userIdService] Failed to fetch user mapping by database ID', error);
      return null;
    }

    if (data?.clerk_id) {
      cacheMapping(data.clerk_id, databaseId);
      return data.clerk_id;
    }
  } catch (fetchError) {
    activeLogger.error('[userIdService] Unexpected error fetching user mapping by database ID', fetchError);
  }

  return null;
}

export function isDatabaseUuid(identifier: string | null | undefined): identifier is string {
  return typeof identifier === "string" && UUID_REGEX.test(identifier);
}

async function ensureMappingRecord(clerkId: string, databaseId: string): Promise<void> {
  const { supabase, isSupabaseConfigured } = await getSupabaseModule();
  if (!supabase || !isSupabaseConfigured()) {
    return;
  }

  try {
    const timestamp = new Date().toISOString();
    const payload = {
      clerk_id: clerkId,
      database_user_id: databaseId,
      created_at: timestamp,
      updated_at: timestamp,
    } as Partial<Database['public']['Tables']['user_id_mappings']['Insert']>;

    const { error } = await supabase
      .from('user_id_mappings')
      .upsert(payload, { onConflict: 'clerk_id' });

    if (error) {
      activeLogger.warn('[userIdService] Failed to upsert user mapping', error);
    }
  } catch (error) {
    activeLogger.error('[userIdService] Unexpected error ensuring user mapping record', error);
  }
}

export async function resolveDatabaseUserId(userIdentifier: string): Promise<string | null> {
  if (!userIdentifier) {
    return null;
  }

  if (isDatabaseUuid(userIdentifier)) {
    cacheMapping(null, userIdentifier);
    return userIdentifier;
  }

  const cached = clerkToDatabase.get(userIdentifier);
  if (cached) {
    cacheMapping(userIdentifier, cached);
    return cached;
  }

  const { supabase, isSupabaseConfigured } = await getSupabaseModule();
  if (!supabase || !isSupabaseConfigured()) {
    cacheMapping(userIdentifier, userIdentifier);
    return userIdentifier;
  }

  const resolved = await fetchMappingByClerkId(userIdentifier);
  if (resolved) {
    return resolved;
  }

  activeLogger.warn('[userIdService] No mapping found for clerk ID; returning null', { clerkId: userIdentifier });
  return null;
}

async function ensureUserRow(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<string> {
  const { supabase, isSupabaseConfigured } = await getSupabaseModule();
  if (!supabase || !isSupabaseConfigured()) {
    return clerkId;
  }

  try {
    const { data: existingUser, error: userLookupError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .maybeSingle();

    if (userLookupError && userLookupError.code !== 'PGRST116') {
      activeLogger.warn('[userIdService] Error looking up user by clerk ID', userLookupError);
    }

    if (existingUser?.id) {
      return existingUser.id;
    }

    const generatedId = generateUuid();
    const now = new Date().toISOString();

    const insertPayload: Database['public']['Tables']['users']['Insert'] = {
      id: generatedId,
      clerk_id: clerkId,
      email,
      first_name: firstName ?? null,
      last_name: lastName ?? null,
      created_at: now,
      updated_at: now,
    };

    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      activeLogger.error('[userIdService] Failed to insert user row', insertError);
      return generatedId;
    }

    return insertedUser?.id ?? generatedId;
  } catch (error) {
    activeLogger.error('[userIdService] Unexpected error ensuring user row', error);
    return clerkId;
  }
}

// User ID service to handle mapping between Clerk IDs and database IDs
export const userIdService = {
  async getDatabaseUserId(identifier: string): Promise<DatabaseUserId | null> {
    return resolveDatabaseUserId(identifier);
  },

  async getClerkUserId(databaseId: DatabaseUserId): Promise<ClerkUserId | null> {
    if (!databaseId) {
      return null;
    }

    const cached = databaseToClerk.get(databaseId);
    if (cached) {
      cacheMapping(cached, databaseId);
      return cached;
    }

    const { supabase, isSupabaseConfigured } = await getSupabaseModule();
    if (!supabase || !isSupabaseConfigured()) {
      return databaseId;
    }

    const resolved = await fetchMappingByDatabaseId(databaseId);
    if (resolved) {
      return resolved;
    }

    activeLogger.warn('[userIdService] No clerk ID mapping found for database user ID', { databaseId });
    return null;
  },

  async ensureUserExists(
    clerkId: ClerkUserId,
    email: string,
    firstName?: string,
    lastName?: string
  ): Promise<DatabaseUserId> {
    if (!clerkId) {
      throw new Error('[userIdService] Clerk ID is required to ensure user exists');
    }

    if (isDatabaseUuid(clerkId)) {
      cacheMapping(null, clerkId);
      return clerkId;
    }

    const cached = clerkToDatabase.get(clerkId);
    if (cached) {
      cacheMapping(clerkId, cached);
      return cached;
    }

    const { supabase, isSupabaseConfigured } = await getSupabaseModule();
    if (!supabase || !isSupabaseConfigured()) {
      cacheMapping(clerkId, clerkId);
      return clerkId;
    }

    const existing = await fetchMappingByClerkId(clerkId);
    if (existing) {
      return existing;
    }

    const databaseId = await ensureUserRow(clerkId, email, firstName, lastName);
    await ensureMappingRecord(clerkId, databaseId);
    cacheMapping(clerkId, databaseId);
    return databaseId;
  },

  getCurrentDatabaseUserId(): DatabaseUserId | null {
    return currentDatabaseUserId;
  },

  getCurrentClerkId(): ClerkUserId | null {
    return currentClerkId;
  },

  setCurrentUser(clerkId: ClerkUserId | null, databaseUserId: DatabaseUserId | null): void {
    if (clerkId && databaseUserId) {
      cacheMapping(clerkId, databaseUserId);
      return;
    }

    if (databaseUserId) {
      currentDatabaseUserId = databaseUserId;
    }

    if (clerkId) {
      currentClerkId = clerkId;
    }
  },

  clearCurrentUser(): void {
    if (currentClerkId) {
      clerkToDatabase.delete(currentClerkId);
    }
    if (currentDatabaseUserId) {
      databaseToClerk.delete(currentDatabaseUserId);
    }
    currentClerkId = null;
    currentDatabaseUserId = null;
  },

  clearCache(): void {
    resetCacheState();
  }
};

type SupabaseTestingModule = Pick<
  Awaited<ReturnType<typeof getSupabaseModule>>,
  'supabase' | 'isSupabaseConfigured'
>;

export const __testing = {
  resetState(): void {
    resetCacheState();
    supabaseModulePromise = null;
    activeLogger = logger;
  },
  mockSupabaseModule(module: SupabaseTestingModule | null): void {
    if (module) {
      supabaseModulePromise = Promise.resolve(module as typeof import('./api/supabaseClient'));
    } else {
      supabaseModulePromise = null;
    }
  },
  mockLogger(loggerLike: LoggerLike | null): void {
    activeLogger = loggerLike ?? logger;
  }
};
