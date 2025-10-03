import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { logger } from '../loggingService';
import {
  supabase as sharedSupabase,
  ensureSupabaseClient,
  isSupabaseConfigured as baseIsSupabaseConfigured,
  subscribeSupabase
} from '../../lib/supabase';

let configurationWarningLogged = false;

const castClient = (client: unknown): (SupabaseClient<Database> & { __isStub?: boolean }) =>
  client as SupabaseClient<Database> & { __isStub?: boolean };

const shouldUseSupabase = (client: SupabaseClient<Database> & { __isStub?: boolean }): boolean => {
  return baseIsSupabaseConfigured() && !(client as { __isStub?: boolean }).__isStub;
};

export let supabase: SupabaseClient<Database> | null = null;

const updateSupabaseReference = (client: unknown): void => {
  const typedClient = castClient(client);
  supabase = shouldUseSupabase(typedClient) ? typedClient : null;

  if (!baseIsSupabaseConfigured() && !configurationWarningLogged && typeof window !== 'undefined') {
    logger.warn('Supabase credentials not configured. Using localStorage fallback.');
    configurationWarningLogged = true;
  }
};

updateSupabaseReference(sharedSupabase);
subscribeSupabase(updateSupabaseReference);

export const isSupabaseConfigured = (): boolean => baseIsSupabaseConfigured();

export const getCurrentUserId = async (): Promise<string | null> => {
  const client = await ensureSupabaseClient();
  const typedClient = castClient(client);
  if (!shouldUseSupabase(typedClient)) {
    return null;
  }

  const { data: { user } } = await typedClient.auth.getUser();
  return user?.id ?? null;
};

export const handleSupabaseError = (error: unknown): string => {
  const normalisedError = error as { message?: string; details?: string; hint?: string } | undefined;

  if (normalisedError?.message) {
    return normalisedError.message;
  }
  if (normalisedError?.details) {
    return normalisedError.details;
  }
  if (normalisedError?.hint) {
    return normalisedError.hint;
  }

  return 'An unexpected error occurred';
};
