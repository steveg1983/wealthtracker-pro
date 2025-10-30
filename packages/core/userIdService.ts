import type { Database } from '@wealthtracker/types';
import { isSupabaseConfigured, ensureSupabaseClient } from './supabase';
import type {
  SupabaseClientLike,
  SupabaseInstance,
  SupabaseMaybeSingleResult,
  SupabaseSingleResult,
} from './supabase';
import type { StructuredLogger } from './serviceFactory';

export type ClerkUserId = string;
export type DatabaseUserId = string;

export const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const isDatabaseUuid = (identifier: string | null | undefined): identifier is string =>
  typeof identifier === 'string' && UUID_REGEX.test(identifier);

type LoggerLike = Pick<StructuredLogger, 'debug' | 'info' | 'warn' | 'error'>;

type UserIdMappingRecord = {
  clerk_id: string;
  database_user_id: string;
  created_at: string;
  updated_at: string;
};

export interface UserIdService {
  getDatabaseUserId(identifier: string): Promise<DatabaseUserId | null>;
  getClerkUserId(databaseId: DatabaseUserId): Promise<ClerkUserId | null>;
  ensureUserExists(
    clerkId: ClerkUserId,
    email: string,
    firstName?: string,
    lastName?: string,
  ): Promise<DatabaseUserId>;
  getCurrentDatabaseUserId(): DatabaseUserId | null;
  getCurrentClerkId(): ClerkUserId | null;
  setCurrentUser(clerkId: ClerkUserId | null, databaseUserId: DatabaseUserId | null): void;
  clearCurrentUser(): void;
  clearCache(): void;
  __testing: {
    resetState(): void;
    mockLogger(loggerLike: LoggerLike | null): void;
    setSupabaseClient(client: SupabaseClientLike | null): void;
  };
}

export interface CreateUserIdServiceOptions {
  logger?: LoggerLike;
}

const noop = (): void => {
  // intentional no-op
};

const createConsoleLogger = (): LoggerLike => {
  if (typeof console === 'undefined') {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    };
  }

  return {
    debug: (message, data, source) => {
      if (typeof console.debug === 'function') {
        console.debug(source ? `[${source}] ${message}` : message, data ?? '');
      }
    },
    info: (message, data, source) => {
      if (typeof console.info === 'function') {
        console.info(source ? `[${source}] ${message}` : message, data ?? '');
      }
    },
    warn: (message, data, source) => {
      if (typeof console.warn === 'function') {
        console.warn(source ? `[${source}] ${message}` : message, data ?? '');
      }
    },
    error: (message, error, source) => {
      if (typeof console.error === 'function') {
        console.error(source ? `[${source}] ${message}` : message, error ?? '');
      }
    },
  };
};

export const defaultLogger = createConsoleLogger();

export function createUserIdService(options: CreateUserIdServiceOptions = {}): UserIdService {
  let activeLogger: LoggerLike = options.logger ?? defaultLogger;

  const clerkToDatabase = new Map<string, string>();
  const databaseToClerk = new Map<string, string>();
  let currentDatabaseUserId: DatabaseUserId | null = null;
  let currentClerkId: ClerkUserId | null = null;
  let testingSupabaseClient: SupabaseClientLike | null = null;
  let hasTestingSupabaseOverride = false;

  const resetCacheState = (): void => {
    clerkToDatabase.clear();
    databaseToClerk.clear();
    currentClerkId = null;
    currentDatabaseUserId = null;
  };

  const setLogger = (loggerLike: LoggerLike | null): void => {
    activeLogger = loggerLike ?? defaultLogger;
  };

  const generateUuid = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  };

  const cacheMapping = (clerkId: ClerkUserId | null, databaseId: DatabaseUserId | null): void => {
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
  };

  const getSupabaseClient = async (): Promise<SupabaseClientLike | null> => {
    if (!isSupabaseConfigured()) {
      return null;
    }

    if (hasTestingSupabaseOverride) {
      return testingSupabaseClient;
    }

    return ensureSupabaseClient();
  };

  const fetchMappingByClerkId = async (clerkId: string): Promise<string | null> => {
    if (!isSupabaseConfigured()) {
      return clerkId;
    }

    try {
      const client = await getSupabaseClient();
      if (!client) {
        return clerkId;
      }
      const response = await client
        .from('user_id_mappings')
        .select('database_user_id')
        .eq('clerk_id', clerkId)
        .maybeSingle();

      const { data, error } = response as SupabaseMaybeSingleResult<{ database_user_id?: string }>;

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
  };

  const fetchMappingByDatabaseId = async (databaseId: string): Promise<string | null> => {
    if (!isSupabaseConfigured()) {
      return databaseId;
    }

    try {
      const client = await getSupabaseClient();
      if (!client) {
        return databaseId;
      }
      const response = await client
        .from('user_id_mappings')
        .select('clerk_id')
        .eq('database_user_id', databaseId)
        .maybeSingle();

      const { data, error } = response as SupabaseMaybeSingleResult<{ clerk_id?: string }>;

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
  };

  const ensureMappingRecord = async (clerkId: string, databaseId: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      const client = await getSupabaseClient();
      if (!client) {
        return;
      }
      const timestamp = new Date().toISOString();
      const payload: UserIdMappingRecord = {
        clerk_id: clerkId,
        database_user_id: databaseId,
        created_at: timestamp,
        updated_at: timestamp,
      };

      const { error } = await client
        .from('user_id_mappings')
        .upsert(payload, { onConflict: 'clerk_id' });

      if (error) {
        activeLogger.warn('[userIdService] Failed to upsert user mapping', error);
      }
    } catch (error) {
      activeLogger.error('[userIdService] Unexpected error ensuring user mapping record', error);
    }
  };

  const ensureUserRow = async (
    clerkId: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ): Promise<string> => {
    if (!isSupabaseConfigured()) {
      return clerkId;
    }

    try {
      const client = await getSupabaseClient();
      if (!client) {
        return clerkId;
      }
      const existingResponse = await client
        .from('users')
        .select('id')
        .eq('clerk_id', clerkId)
        .maybeSingle();

      const { data: existingUser, error: userLookupError } = existingResponse as SupabaseMaybeSingleResult<{ id?: string }>;

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

      const insertedResponse = await client
        .from('users')
        .insert(insertPayload)
        .select('id')
        .single();

      const { data: insertedUser, error: insertError } = insertedResponse as SupabaseSingleResult<{ id?: string }>;

      if (insertError) {
        activeLogger.error('[userIdService] Failed to insert user row', insertError);
        return generatedId;
      }

      return insertedUser?.id ?? generatedId;
    } catch (error) {
      activeLogger.error('[userIdService] Unexpected error ensuring user row', error);
      return clerkId;
    }
  };

  return {
    async getDatabaseUserId(identifier: string): Promise<DatabaseUserId | null> {
      if (!identifier) {
        return null;
      }

      if (isDatabaseUuid(identifier)) {
        cacheMapping(null, identifier);
        return identifier;
      }

      const cached = clerkToDatabase.get(identifier);
      if (cached) {
        cacheMapping(identifier, cached);
        return cached;
      }

      if (!isSupabaseConfigured() || (hasTestingSupabaseOverride && !testingSupabaseClient)) {
        cacheMapping(identifier, identifier);
        return identifier;
      }

      const resolved = await fetchMappingByClerkId(identifier);
      if (resolved) {
        return resolved;
      }

      activeLogger.warn('[userIdService] No mapping found for clerk ID; returning null', {
        clerkId: identifier,
      });
      return null;
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

      if (!isSupabaseConfigured() || (hasTestingSupabaseOverride && !testingSupabaseClient)) {
        return databaseId;
      }

      const resolved = await fetchMappingByDatabaseId(databaseId);
      if (resolved) {
        return resolved;
      }

      activeLogger.warn('[userIdService] No clerk ID mapping found for database user ID', {
        databaseId,
      });
      return null;
    },

    async ensureUserExists(
      clerkId: ClerkUserId,
      email: string,
      firstName?: string,
      lastName?: string,
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

      if (!isSupabaseConfigured()) {
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
    },

    __testing: {
      resetState(): void {
      resetCacheState();
      setLogger(options.logger ?? null);
        testingSupabaseClient = null;
        hasTestingSupabaseOverride = false;
      },
      mockLogger(loggerLike: LoggerLike | null): void {
        setLogger(loggerLike);
      },
      setSupabaseClient(client: SupabaseClientLike | null): void {
        hasTestingSupabaseOverride = true;
        testingSupabaseClient = client;
      },
    },
  };
}

export const userIdService = createUserIdService();
