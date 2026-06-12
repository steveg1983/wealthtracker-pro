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

/**
 * Raised when a connection can only be recovered by the user re-linking their
 * bank (expired/absent refresh token, TrueLayer `invalid_grant`, etc.). The
 * sync handler turns this into a persisted `reauth_required` status so the UI's
 * Reauthorize CTA appears, instead of a generic `error` with a Sync button that
 * will always fail.
 */
export class ReauthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReauthRequiredError';
  }
}

/**
 * A token *refresh* failing means the long-lived refresh token is no longer
 * valid — the user must re-consent. TrueLayer signals this as `invalid_grant`
 * (HTTP 400), not 401, so a literal-401 check (issue #22) misses it. Treat any
 * refresh-call failure, plus a missing refresh token, as needs-reauth.
 */
export const isReauthRequiredError = (error: unknown): boolean => {
  if (error instanceof ReauthRequiredError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return /invalid_grant|no refresh token|token refresh failed|reauth/i.test(error.message);
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
    throw new ReauthRequiredError('TrueLayer access token expired and no refresh token is stored');
  }

  const refreshToken = decryptSecret(connection.refresh_token_encrypted);
  let refreshed;
  try {
    refreshed = await refreshAccessToken(refreshToken);
  } catch (error) {
    // A failed refresh (invalid_grant / 400 / 401 / expired refresh token) is
    // unrecoverable without the user re-linking — surface it as needs-reauth
    // rather than a transient error.
    const detail = error instanceof Error ? error.message : 'token refresh failed';
    throw new ReauthRequiredError(`TrueLayer token refresh failed: ${detail}`);
  }
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

/**
 * Persist the needs-reauth state the UI is already wired for (issue #21/#22):
 * status='reauth_required' + needs_reauth=true. The BankConnections component
 * shows its Reauthorize CTA and disables Sync for connections in this state.
 */
export const markConnectionNeedsReauth = async (
  supabase: SupabaseClient,
  connectionId: string,
  errorMessage: string
): Promise<void> => {
  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      status: 'reauth_required',
      needs_reauth: true,
      error: errorMessage.slice(0, 2000),
      updated_at: nowIso
    })
    .eq('id', connectionId);
};

/**
 * A sync that found no usable linked accounts (issue #23): record that it ran
 * (last_sync) WITHOUT forcing status back to 'connected'. Unconditionally
 * marking success here masked genuinely broken connections (error /
 * reauth_required) as healthy. A previously-connected connection keeps its
 * connected status via the unchanged column; a broken one retains its problem
 * state for the user to act on.
 */
export const markConnectionSyncNoAccounts = async (
  supabase: SupabaseClient,
  connectionId: string
): Promise<void> => {
  const nowIso = new Date().toISOString();
  await supabase
    .from('bank_connections')
    .update({
      last_sync: nowIso,
      updated_at: nowIso
    })
    .eq('id', connectionId);
};
