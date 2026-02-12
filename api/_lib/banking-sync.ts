import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from './encryption.js';
import { refreshAccessToken } from './truelayer.js';

export interface TrueLayerConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  institution_id: string;
  institution_name: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
}

const isUnauthorizedTrueLayerError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  return /\b401\b/.test(error.message);
};

export const getUserTrueLayerConnection = async (
  supabase: SupabaseClient,
  userId: string,
  connectionId: string
): Promise<TrueLayerConnectionRow | null> => {
  const { data, error } = await supabase
    .from('bank_connections')
    .select('id, user_id, provider, institution_id, institution_name, access_token_encrypted, refresh_token_encrypted')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  if (data.provider !== 'truelayer') {
    return null;
  }

  return data as TrueLayerConnectionRow;
};

interface AccessTokenResolution {
  accessToken: string;
  refreshed: boolean;
}

const refreshConnectionAccessToken = async (
  supabase: SupabaseClient,
  connection: TrueLayerConnectionRow
): Promise<AccessTokenResolution> => {
  if (!connection.refresh_token_encrypted) {
    throw new Error('TrueLayer access token expired and no refresh token is stored');
  }

  const refreshToken = decryptSecret(connection.refresh_token_encrypted);
  const refreshed = await refreshAccessToken(refreshToken);
  const encryptedAccess = encryptSecret(refreshed.access_token);
  const encryptedRefresh = refreshed.refresh_token
    ? encryptSecret(refreshed.refresh_token)
    : connection.refresh_token_encrypted;

  const expiresAt = typeof refreshed.expires_in === 'number' && Number.isFinite(refreshed.expires_in)
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null;

  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      access_token_encrypted: encryptedAccess,
      refresh_token_encrypted: encryptedRefresh,
      token_last_refreshed: nowIso,
      refresh_attempts: 0,
      needs_reauth: false,
      expires_at: expiresAt,
      updated_at: nowIso
    })
    .eq('id', connection.id)
    .eq('user_id', connection.user_id);

  return {
    accessToken: refreshed.access_token,
    refreshed: true
  };
};

export const withTrueLayerAccessToken = async <T>(
  supabase: SupabaseClient,
  connection: TrueLayerConnectionRow,
  operation: (accessToken: string) => Promise<T>
): Promise<T> => {
  const accessToken = decryptSecret(connection.access_token_encrypted);
  try {
    return await operation(accessToken);
  } catch (error) {
    if (!isUnauthorizedTrueLayerError(error)) {
      throw error;
    }
  }

  const refreshed = await refreshConnectionAccessToken(supabase, connection);
  return operation(refreshed.accessToken);
};

export const markConnectionSyncSuccess = async (
  supabase: SupabaseClient,
  connectionId: string
): Promise<void> => {
  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      status: 'connected',
      error: null,
      last_sync: nowIso,
      updated_at: nowIso
    })
    .eq('id', connectionId);
};

export const markConnectionSyncFailure = async (
  supabase: SupabaseClient,
  connectionId: string,
  errorMessage: string
): Promise<void> => {
  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      status: 'error',
      error: errorMessage.slice(0, 2000),
      updated_at: nowIso
    })
    .eq('id', connectionId);
};
